import * as THREE from 'three';
import type { Ambience } from '../audio/Ambience';
import type { CameraRig } from '../core/CameraRig';
import { clamp, easeInOutCubic } from '../core/math';
import type { TimeController } from '../core/TimeController';
import { LANDMARKS } from '../data/landmarks';
import { STYLE_INFO } from '../data/styleInfo';
import type { BuildingSite } from '../data/types';
import { h } from '../ui/dom';
import type { BuildingManager } from '../world/buildings/BuildingManager';
import { phaseAt } from '../world/fabric';
import type { PostFX } from '../world/PostFX';
import { GameState, type SaveData } from './GameState';
import { GameUI } from './GameUI';
import { Interactables } from './Interactables';
import { Joystick } from './Joystick';
import { alignment, wrapAngle } from './rephoto';
import { Sfx } from './sfx';
import type { CaseDef, Lead, PhotoDef, Poi } from './types';

/** What the game needs from the 3D world. */
export interface WorldApi {
  time: TimeController;
  rig: CameraRig;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  post: PostFX;
  buildings: BuildingManager;
  scene: THREE.Scene;
  audio: Ambience;
  /** Ground height used by the walking camera. */
  ground: (x: number, z: number) => number;
  /** Switch the whole world to a year instantly (no rise/sink animation). */
  jumpTo: (year: number) => void;
}

const SAVE_KEY = 'tlvtm.case.v1';
const NOTE_FOR_SITE: Record<string, string> = { 'first-kiosk': 'first-kiosk', 'dizengoff-house': 'independence-hall' };
const GYM = { x: -14, z: -176 };
const TAP_OFFSETS: [number, number][] = [[0, 0], [0, 16], [0, -16], [16, 0], [-16, 0], [12, 12], [-12, 12], [12, -12], [-12, -12], [0, 30], [0, -30], [30, 0], [-30, 0]];

type Lens =
  | { kind: 'idle' }
  | { kind: 'travel-capture'; year: number; done?: () => void }
  | { kind: 'travel'; t: number; done?: () => void }
  | { kind: 'peek-capture'; year: number; base: number }
  | { kind: 'peek'; t: number; base: number; year: number; closing: boolean };

interface PhotoPlate {
  overlay: string;
  card: string;
  ratio: number;
}

function load(): SaveData | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The exploration game: a case to solve on foot, at street level, by noticing things,
 * standing where old photos were taken and slipping through anchored years.
 * See docs/GAME_DESIGN.md.
 */
export class Game {
  state: GameState;
  readonly ui: GameUI;
  readonly inter: Interactables;
  readonly sfx = new Sfx();
  active = false;
  /** Called when the player chooses the classic free timeline. */
  onFreeMode?: (fromGame: boolean) => void;

  private lens: Lens = { kind: 'idle' };
  private photos = new Map<string, PhotoPlate>();
  private holding?: { lead: Lead; photo: PhotoDef; held: number };
  private lastYear?: number;
  private saveTimer = 0;
  private ray = new THREE.Raycaster();
  private titleEl?: HTMLElement;
  private v = new THREE.Vector3();
  private keyPeek = false;

  constructor(
    private w: WorldApi,
    readonly def: CaseDef,
    uiRoot: HTMLElement,
  ) {
    this.state = new GameState(def, load());
    this.ui = new GameUI(uiRoot);
    this.inter = new Interactables(def.pois);
    w.scene.add(this.inter.root);
    this.inter.setYear(w.time.year);
    w.time.onChange((y) => {
      this.inter.setYear(y);
      if (this.active) this.renderHud();
    });
    if (matchMedia('(pointer: coarse)').matches) new Joystick(this.ui.root, w.rig.moveInput);

    this.ui.onHint = () => this.hint();
    this.ui.onTravel = (y) => this.travel(y);
    this.ui.onPeek = (y, on) => (on ? this.peek(y) : this.unpeek());
    this.ui.onSolve = () => this.solve();
    this.ui.btnPhoto.onclick = () => this.togglePhoto();
    this.ui.btnJournal.onclick = () => this.journal();
    this.ui.btnSound.onclick = () => void this.toggleSound();
    this.ui.btnMenu.onclick = () => this.menu();
    window.addEventListener('keydown', (e) => this.onKey(e));
    // safety net: a peek always ends when the pointer is released anywhere
    window.addEventListener('pointerup', () => {
      if (this.lens.kind.startsWith('peek') && !this.keyPeek) this.unpeek();
    });
    window.addEventListener('keyup', (e) => {
      if (this.active && e.code === 'KeyQ' && this.lens.kind.startsWith('peek')) {
        this.keyPeek = false;
        this.unpeek();
      }
    });
  }

  // ------------------------------------------------------------------ lifecycle

  /** Renders the archival photo plates (call once the world is built, before the title). */
  preparePhotos() {
    const { rig, time } = this.w;
    const year = time.year;
    this.inter.root.visible = false;
    for (const lead of this.def.leads) {
      if (lead.trigger.kind !== 'rephoto') continue;
      const p = lead.trigger.photo;
      this.w.jumpTo(p.year);
      rig.teleport(p.pose.x, p.pose.z, p.pose.yaw, p.pose.pitch);
      rig.update(0);
      this.photos.set(p.id, this.renderPlate(p));
    }
    this.inter.root.visible = true;
    this.w.jumpTo(year);
  }

  private renderPlate(p: PhotoDef): PhotoPlate {
    this.w.post.render();
    const src = this.w.canvas;
    const W = src.width;
    const H = src.height;
    const ratio = Math.min(W / H, 4 / 3);
    const cw = Math.round(H * ratio);
    const scale = Math.min(1, 900 / H);
    const c = document.createElement('canvas');
    c.width = Math.round(cw * scale);
    c.height = Math.round(H * scale);
    const g = c.getContext('2d')!;
    g.drawImage(src, (W - cw) / 2, 0, cw, H, 0, 0, c.width, c.height);
    // age the print: warm monochrome, crushed contrast, vignette, dust
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % c.width;
      const py = Math.floor(i / 4 / c.width);
      const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      const k = Math.min(1, Math.max(0, (l - 0.5) * 1.18 + 0.52));
      const vx = px / c.width - 0.5;
      const vy = py / c.height - 0.5;
      const vig = 1 - (vx * vx + vy * vy) * 1.3;
      const n = (Math.random() - 0.5) * 0.07;
      const v = Math.max(0, (k + n) * vig);
      d[i] = Math.min(255, v * 255 * 1.06 + 12);
      d[i + 1] = Math.min(255, v * 255 * 0.94 + 6);
      d[i + 2] = Math.min(255, v * 255 * 0.76);
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,250,235,0.35)';
    for (let i = 0; i < 14; i++) {
      g.lineWidth = Math.random() * 1.2;
      g.beginPath();
      const x = Math.random() * c.width;
      g.moveTo(x, Math.random() * c.height);
      g.lineTo(x + (Math.random() - 0.5) * 30, Math.random() * c.height);
      g.stroke();
    }
    const overlay = c.toDataURL('image/jpeg', 0.86);
    // postcard: cream border and a caption
    const pad = Math.round(c.height * 0.06);
    const pc = document.createElement('canvas');
    pc.width = c.width + pad * 2;
    pc.height = c.height + pad * 3.2;
    const pg = pc.getContext('2d')!;
    pg.fillStyle = '#efe6d2';
    pg.fillRect(0, 0, pc.width, pc.height);
    pg.drawImage(c, pad, pad);
    pg.fillStyle = '#4a3b2a';
    pg.font = `italic ${Math.round(pad * 0.9)}px "Frank Ruhl Libre", Georgia, serif`;
    pg.textAlign = 'center';
    pg.fillText(p.caption.en, pc.width / 2, c.height + pad * 2.25);
    return { overlay, card: pc.toDataURL('image/jpeg', 0.86), ratio };
  }

  /** The title screen: begin/continue the case, or open the classic timeline. */
  showTitle(parent: HTMLElement) {
    const d = this.def;
    const hasSave = this.state.done.size > 0 || this.state.where !== undefined;
    const begin = h('button', { class: 'btn big' }, hasSave ? 'Continue the case' : 'Begin') as HTMLButtonElement;
    const fresh = h('button', { class: 'btn ghost' }, 'Start over') as HTMLButtonElement;
    const free = h('button', { class: 'btn ghost' }, 'Free explore · classic timeline') as HTMLButtonElement;
    const el = h(
      'div',
      { id: 'title' },
      h(
        'div',
        { class: 'title-inner' },
        h('div', { class: 'title-brand' }, 'Tel Aviv ', h('span', {}, 'Time Machine')),
        h('div', { class: 'title-he', lang: 'he', dir: 'rtl' }, 'מכונת הזמן של תל אביב'),
        h(
          'div',
          { class: 'title-case glass' },
          h('div', { class: 'g-kicker' }, `Case ${d.number}`),
          h('h2', {}, d.title.en),
          h('p', {}, d.tagline.en),
          h('div', { class: 'g-actions' }, begin, hasSave ? fresh : null),
        ),
        h('div', { class: 'title-next' }, h('span', {}, 'Coming next:'), ...d.teasers.map((t) => h('span', { class: 'locked' }, `🔒 ${t.en}`))),
        free,
      ),
    );
    parent.append(el);
    this.titleEl = el;
    const go = (resume: boolean) => {
      this.sfx.unlock();
      void this.w.audio.enable().then(() => this.ui.btnSound.classList.toggle('active', this.w.audio.enabled));
      el.classList.add('done');
      window.setTimeout(() => el.remove(), 900);
      this.enter(resume);
    };
    begin.onclick = () => go(true);
    fresh.onclick = () => {
      this.reset();
      go(false);
    };
    free.onclick = () => {
      el.classList.add('done');
      window.setTimeout(() => el.remove(), 900);
      this.onFreeMode?.(false);
    };
  }

  get titleOpen() {
    return !!this.titleEl?.isConnected;
  }

  private reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* private mode */
    }
    this.state = new GameState(this.def);
  }

  /** Enter the game (from the title or from free mode). */
  enter(resume = true) {
    const { rig } = this.w;
    this.active = true;
    document.body.classList.add('mode-game');
    document.body.classList.remove('mode-free');
    this.ui.show(true);
    rig.lockStreet = true;
    const where = resume ? this.state.where : undefined;
    const year = where?.year ?? this.def.start.year;
    this.w.jumpTo(year);
    if (where) rig.teleport(where.x, where.z, where.yaw);
    else {
      const p = this.def.start.pose;
      rig.teleport(p.x, p.z, p.yaw, p.pitch);
    }
    this.renderHud();
    const fresh = this.state.done.size === 0;
    if (fresh && !where) this.intro();
    else this.showControls();
  }

  /** Leave the game for the classic free timeline. */
  exit() {
    this.save();
    this.active = false;
    this.closePhoto();
    this.ui.closeModal();
    this.ui.show(false);
    this.w.rig.lockStreet = false;
    this.w.rig.inputEnabled = true;
    document.body.classList.remove('mode-game');
    document.body.classList.add('mode-free');
  }

  private intro() {
    const lead = this.def.leads[0];
    const plate = lead.trigger.kind === 'rephoto' ? this.photos.get(lead.trigger.photo.id) : undefined;
    this.ui.showCard({
      kicker: `Case ${this.def.number} · ${this.def.title.en}`,
      title: 'An old postcard',
      text: this.def.intro.en,
      image: plate?.card,
      actions: [
        {
          label: 'Start exploring',
          primary: true,
          run: () => {
            this.ui.closeModal();
            this.showControls();
          },
        },
      ],
    });
  }

  private showControls() {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.ui.controlsHint.innerHTML = touch
      ? 'Left stick to walk · drag to look · <b>tap</b> things to examine'
      : 'Drag to look · <b>W A S D</b> to walk · <b>click</b> to examine · <b>P</b> photo · <b>J</b> journal';
    this.ui.controlsHint.classList.remove('hidden', 'fade');
    window.setTimeout(() => this.ui.controlsHint.classList.add('fade'), 9000);
  }

  private save() {
    const c = this.w.camera.position;
    const year = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    if (this.state.anchors.has(year)) this.state.where = { year, x: c.x, z: c.z, yaw: this.w.rig.yaw };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state.toJSON()));
    } catch {
      /* storage may be unavailable; progress is then per-session */
    }
  }

  // ------------------------------------------------------------------ HUD

  private renderHud() {
    const s = this.state;
    const lead = s.current;
    this.ui.renderObjective(s, lead, lead ? s.hintTier(lead.id) : -1);
    const y = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    this.ui.renderYear(y, this.lens.kind === 'peek' ? this.lens.year : undefined);
    this.ui.renderCompass(s.compass, y, s.solved);
    this.inter.wanted = new Set(s.open.flatMap((l) => (l.trigger.kind === 'poi' ? [l.trigger.poiId] : [])));
    const photoLead = s.open.find((l) => l.trigger.kind === 'rephoto');
    this.ui.btnPhoto.classList.toggle('hidden', !photoLead);
  }

  private hint() {
    const lead = this.state.current;
    if (!lead) return;
    this.state.nextHint(lead.id);
    this.sfx.tick();
    this.save();
    this.renderHud();
  }

  // ------------------------------------------------------------------ time lens

  /** Slip to another anchored year with an expanding lens. */
  travel(year: number, done?: () => void) {
    if (this.lens.kind !== 'idle' || !this.state.anchors.has(year) || year === Math.floor(this.w.time.year)) return;
    this.closePhoto();
    this.lastYear = Math.floor(this.w.time.year);
    this.w.post.wipe.capture();
    this.lens = { kind: 'travel-capture', year, done };
    this.sfx.whoosh(year > this.lastYear);
  }

  /** Look into another anchored year through a small lens, without leaving. */
  peek(year: number) {
    if (this.lens.kind !== 'idle' || year === Math.floor(this.w.time.year)) return;
    this.w.post.wipe.capture();
    this.lens = { kind: 'peek-capture', year, base: Math.floor(this.w.time.year) };
    this.sfx.whoosh(true, 0.6);
  }

  unpeek() {
    if (this.lens.kind === 'peek') this.lens.closing = true;
    else if (this.lens.kind === 'peek-capture') this.lens = { kind: 'idle' };
  }

  private updateLens(dt: number) {
    const L = this.lens;
    const wipe = this.w.post.wipe;
    if (L.kind === 'travel-capture' && !wipe.capturing) {
      this.w.jumpTo(L.year);
      this.lens = { kind: 'travel', t: 0, done: L.done };
      wipe.radius = 0.001;
      this.renderHud();
    } else if (L.kind === 'travel') {
      L.t += dt;
      const k = Math.min(1, L.t / 1.5);
      wipe.radius = 0.001 + easeInOutCubic(k) * 1.3;
      if (k >= 1) {
        wipe.radius = 0;
        this.lens = { kind: 'idle' };
        this.save();
        L.done?.();
      }
    } else if (L.kind === 'peek-capture' && !wipe.capturing) {
      this.w.jumpTo(L.year);
      this.lens = { kind: 'peek', t: 0, base: L.base, year: L.year, closing: false };
      wipe.radius = 0.001;
      this.renderHud();
      this.checkDoubleExposure(L.year, L.base);
    } else if (L.kind === 'peek') {
      L.t = clamp(L.t + (L.closing ? -dt * 1.6 : dt), 0, 0.45);
      wipe.radius = 0.001 + easeInOutCubic(L.t / 0.45) * 0.3;
      if (L.closing && L.t <= 0) {
        wipe.radius = 0;
        this.lens = { kind: 'idle' };
        this.w.jumpTo(L.base);
        this.renderHud();
      }
    }
    this.w.rig.inputEnabled = !this.ui.modalOpen && (this.lens.kind === 'idle' || this.lens.kind === 'travel');
  }

  private checkDoubleExposure(peekYear: number, base: number) {
    const c = this.w.camera.position;
    if (peekYear <= 1961 && base >= 1965 && Math.hypot(c.x - GYM.x, c.z - GYM.z) < 170) this.note('double-exposure');
  }

  // ------------------------------------------------------------------ rephotography

  private togglePhoto() {
    if (this.holding) return this.closePhoto();
    const lead = this.state.open.find((l) => l.trigger.kind === 'rephoto');
    if (!lead || lead.trigger.kind !== 'rephoto') return;
    const plate = this.photos.get(lead.trigger.photo.id);
    if (!plate) return;
    this.holding = { lead, photo: lead.trigger.photo, held: 0 };
    this.ui.showPhoto(plate.overlay, plate.ratio);
    this.ui.btnPhoto.classList.add('active');
    this.sfx.tick();
  }

  private closePhoto() {
    this.holding = undefined;
    this.ui.showPhoto(undefined);
    this.ui.btnPhoto.classList.remove('active');
  }

  private updatePhoto(dt: number) {
    const H = this.holding;
    if (!H) return;
    const { rig, camera } = this.w;
    const view = { x: camera.position.x, z: camera.position.z, yaw: rig.yaw, pitch: rig.pitch };
    const a = alignment(H.photo.pose, view);
    let advice: string;
    if (a.dist > 6) {
      const dx = H.photo.pose.x - view.x;
      const dz = H.photo.pose.z - view.z;
      const rel = wrapAngle(Math.atan2(-dx, -dz) - view.yaw) * (180 / Math.PI);
      const dir = Math.abs(rel) < 35 ? 'ahead' : Math.abs(rel) > 145 ? 'behind you' : rel > 0 ? 'to your left' : 'to your right';
      advice = a.dist > 45 ? 'Compare the street in the photo with what you see.' : `The photographer stood a bit ${dir}.`;
    } else if (a.yawErr > 9) advice = wrapAngle(H.photo.pose.yaw - view.yaw) > 0 ? 'Turn a little left.' : 'Turn a little right.';
    else if (a.pitchErr > 9) advice = H.photo.pose.pitch > view.pitch ? 'Look up a little.' : 'Look down a little.';
    else advice = 'Perfect.';
    H.held = a.matched ? H.held + dt : 0;
    this.ui.renderMeter(a.score, advice, a.matched);
    if (H.held > 0.7) {
      const lead = H.lead;
      this.closePhoto();
      this.completeLead(lead);
    }
  }

  // ------------------------------------------------------------------ examining

  /** Handles a tap/click on the scene. Returns true if it hit something. */
  tap(clientX: number, clientY: number): boolean {
    if (!this.active || this.ui.modalOpen || this.lens.kind !== 'idle') return false;
    // Forgiving taps: try the exact point first, then a small ring around it (fingers, archways).
    const ndc = new THREE.Vector2();
    let poi: ReturnType<Interactables['pick']>;
    let site: ReturnType<BuildingManager['pick']>;
    for (const [ox, oy] of TAP_OFFSETS) {
      ndc.set(((clientX + ox) / window.innerWidth) * 2 - 1, -((clientY + oy) / window.innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, this.w.camera);
      poi = this.inter.pick(this.ray);
      site = this.w.buildings.pick(this.ray);
      if (poi || site) break;
    }
    if (poi && (!site || poi.distance <= this.ray.ray.origin.distanceTo(site.object.getWorldPosition(this.v)))) {
      this.examinePoi(poi.poi, poi.distance);
      return true;
    }
    if (site && !site.object.userData.ghost) {
      const c = this.w.camera.position;
      // distance to the footprint edge, roughly
      const d = Math.max(0, Math.hypot(c.x - site.site.x, c.z - site.site.z) - Math.min(site.site.width, site.site.depth) / 2);
      this.examineSite(site.site, d);
      return true;
    }
    return false;
  }

  private examinePoi(poi: Poi, dist: number) {
    const year = Math.floor(this.w.time.year);
    const lead = this.state.def.leads.find((l) => l.trigger.kind === 'poi' && l.trigger.poiId === poi.id);
    if (dist > 30) return this.ui.toast('Too far away to make out — walk closer.');
    if (lead && this.state.canComplete(lead, year)) return this.completeLead(lead);
    if (lead && this.state.done.has(lead.id)) return this.ui.toast(`${lead.clue.title.en} — already in your journal.`);
    this.ui.toast(`${poi.label.en}. Something to remember…`);
  }

  private examineSite(site: BuildingSite, dist: number) {
    const year = Math.floor(this.w.time.year);
    const lead = this.state.open.find((l) => l.trigger.kind === 'site' && l.trigger.siteId === site.id && this.state.canComplete(l, year));
    if (lead && lead.trigger.kind === 'site') {
      if (dist > lead.trigger.maxDist) return this.ui.toast('Get closer for a good look.');
      return this.completeLead(lead);
    }
    const phase = phaseAt(site, year);
    if (!phase) return;
    if (site.landmark && site.info) {
      if (dist > 140) return this.ui.toast(`${site.name?.en ?? 'A landmark'} — walk closer to look.`);
      const isNew = this.state.collect('landmarks', site.id);
      const note = NOTE_FOR_SITE[site.id];
      if (note) this.note(note, false);
      if (!isNew) return this.ui.toast(`${site.name?.en} · ${phase.from}`);
      this.sfx.chime();
      this.save();
      return this.ui.showCard({
        kicker: `Landmark discovered · ${this.state.landmarks.size}/${LANDMARKS.length}`,
        title: site.name?.en ?? 'Landmark',
        text: site.info.summary.en,
        facts: site.info.facts?.map((f) => f.en),
        sources: site.info.sources,
        confidence: site.info.confidence,
        actions: [{ label: 'Continue', primary: true, run: () => this.ui.closeModal() }],
      });
    }
    const style = STYLE_INFO[phase.style];
    if (!style) return;
    if (dist > 60) return this.ui.toast('Too far to make out the details — walk closer.');
    const isNew = this.state.collect('stamps', phase.style);
    if (!isNew) return this.ui.toast(`${style.name.en} · built ${phase.from}`);
    this.sfx.chime();
    this.save();
    this.ui.showCard({
      kicker: `New style stamp · ${this.state.stamps.size}/${Object.keys(STYLE_INFO).length}`,
      title: style.name.en,
      text: style.text.en,
      facts: style.look.map((l) => `Look for: ${l}`),
      sources: style.sources,
      confidence: 'documented',
      reward: `${style.period} · this one was built in ${phase.from}`,
      actions: [{ label: 'Continue', primary: true, run: () => this.ui.closeModal() }],
    });
  }

  private note(id: string, announce = true) {
    if (!this.state.collect('notes', id)) return;
    this.save();
    const n = this.def.notes.find((x) => x.id === id);
    if (!n) return;
    this.sfx.chime();
    if (announce) this.ui.toast(`Field note · ${n.title.en}`, 3500);
  }

  private completeLead(lead: Lead) {
    const newYear = this.state.complete(lead.id);
    this.save();
    this.sfx.chime(true);
    this.renderHud();
    if (lead.autoTravel && newYear !== undefined) this.travel(newYear, () => this.showClue(lead, newYear, true));
    else this.showClue(lead, newYear, false);
  }

  private showClue(lead: Lead, newYear: number | undefined, traveled: boolean) {
    const c = lead.clue;
    const after = () => {
      this.ui.closeModal();
      if (this.state.readyToSolve) this.deduce();
    };
    const actions =
      newYear !== undefined && !traveled
        ? [
            {
              label: `Travel to ${newYear}`,
              primary: true,
              run: () => {
                this.ui.closeModal();
                this.travel(newYear);
              },
            },
            { label: 'Later', run: after },
          ]
        : [{ label: 'Continue', primary: true, run: after }];
    this.ui.showCard({
      kicker: 'Clue found',
      title: c.title.en,
      text: c.text.en,
      sources: c.sources,
      confidence: c.confidence,
      reward: newYear !== undefined ? (traveled ? `You slipped into ${newYear} · it is now on your time compass` : `Year anchored: ${newYear}`) : undefined,
      actions,
    });
  }

  private deduce() {
    const d = this.def.deduction;
    this.ui.showDeduction(d.question, d.options, () => this.solved());
  }

  private solve() {
    if (this.state.readyToSolve) this.deduce();
  }

  private solved() {
    this.state.solved = true;
    this.save();
    this.sfx.chime(true);
    this.renderHud();
    const r = this.def.resolution;
    this.ui.showCard({
      kicker: 'Case closed',
      title: r.title.en,
      text: r.text.en,
      facts: r.facts.map((f) => f.en),
      sources: r.sources,
      confidence: 'documented',
      reward: 'Unlocked: free travel through every year, 1900–2025',
      actions: [
        {
          label: 'Open the full timeline',
          primary: true,
          run: () => {
            this.ui.closeModal();
            this.exit();
            this.onFreeMode?.(true);
          },
        },
        { label: 'Keep walking', run: () => this.ui.closeModal() },
      ],
    });
  }

  // ------------------------------------------------------------------ menus

  private journal() {
    if (this.ui.modalOpen) return this.ui.closeModal();
    const landmarkNames = new Map(LANDMARKS.map((l) => [l.id, l.name?.en ?? l.id]));
    const styleNames = Object.entries(STYLE_INFO).map(([k, v]) => [k, v!.name.en] as [string, string]);
    this.ui.showJournal(this.state, { landmarkNames, landmarkTotal: LANDMARKS.length, styleNames }, () => this.ui.closeModal());
  }

  private menu() {
    if (this.ui.modalOpen) return this.ui.closeModal();
    this.ui.showCard({
      kicker: 'Menu',
      title: 'Paused',
      text: 'Your progress is saved in this browser.',
      actions: [
        { label: 'Resume', primary: true, run: () => this.ui.closeModal() },
        {
          label: 'Free explore · classic timeline',
          run: () => {
            this.exit();
            this.onFreeMode?.(true);
          },
        },
        {
          label: 'Restart case',
          run: () => {
            this.ui.closeModal();
            this.reset();
            this.enter(false);
          },
        },
      ],
    });
  }

  private async toggleSound() {
    const a = this.w.audio;
    if (a.enabled) a.disable();
    else await a.enable();
    this.sfx.enabled = a.enabled;
    this.ui.btnSound.classList.toggle('active', a.enabled);
  }

  private onKey(e: KeyboardEvent) {
    if (!this.active || (e.target as HTMLElement)?.tagName === 'INPUT' || e.repeat) return;
    if (e.code === 'Escape') {
      if (this.ui.modalOpen) this.ui.closeModal();
      else if (this.holding) this.closePhoto();
      else this.menu();
      return;
    }
    if (this.ui.modalOpen) return;
    const anchored = this.state.compass.filter((s) => !s.locked).map((s) => s.year);
    if (e.code === 'KeyP') this.togglePhoto();
    else if (e.code === 'KeyJ') this.journal();
    else if (e.code === 'KeyH') this.hint();
    else if (e.code === 'KeyM') void this.toggleSound();
    else if (e.code === 'KeyE') this.tap(window.innerWidth / 2, window.innerHeight / 2);
    else if (e.code === 'KeyQ') {
      const cur = Math.floor(this.w.time.year);
      const target = this.lastYear !== undefined && this.lastYear !== cur ? this.lastYear : anchored.find((y) => y !== cur);
      if (target !== undefined) {
        this.keyPeek = true;
        this.peek(target);
      }
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const y = anchored[Number(e.code.slice(5)) - 1];
      if (y !== undefined) this.travel(y);
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, t: number) {
    // props stay in the world in free mode, but their sparkles belong to the game
    if (!this.active) this.inter.wanted.clear();
    this.inter.update(t, this.w.camera.position);
    if (!this.active) return;
    this.updateLens(dt);
    this.updatePhoto(dt);
    this.updateGuidance();
    this.saveTimer += dt;
    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      this.save();
    }
  }

  /** Context prompts and the on-screen marker of the final hint tier. */
  private updateGuidance() {
    const lead = this.state.current;
    const c = this.w.camera.position;
    const year = Math.floor(this.w.time.year);
    let prompt: string | undefined;
    if (lead && this.lens.kind === 'idle' && !this.ui.modalOpen) {
      const d = Math.hypot(lead.target.x - c.x, lead.target.z - c.z);
      if (lead.trigger.kind === 'rephoto' && !this.holding && d < 18) prompt = 'This looks like the spot — hold up the photo (P)';
      else if (lead.trigger.kind === 'poi' && this.inter.present(lead.trigger.poiId) && d < 14) prompt = 'Tap the glimmer to examine';
      else if (lead.years && (year < lead.years[0] || year > lead.years[1]) && d < 60) prompt = 'Nothing here in this year — try another on your time compass';
    }
    this.ui.setPrompt(prompt);
    this.ui.btnPhoto.classList.toggle('pulse', !!prompt && lead?.trigger.kind === 'rephoto');

    if (!lead || this.state.hintTier(lead.id) < lead.hints.length - 1 || this.holding) return this.ui.placeMarker(undefined);
    const ty = lead.target.y ?? 2;
    this.v.set(lead.target.x, this.w.ground(lead.target.x, lead.target.z) + ty, lead.target.z);
    const dist = Math.hypot(lead.target.x - c.x, lead.target.z - c.z);
    this.v.project(this.w.camera);
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    let sx = (this.v.x * 0.5 + 0.5) * W;
    let sy = (-this.v.y * 0.5 + 0.5) * Hh;
    const behind = this.v.z > 1;
    const off = behind || sx < 40 || sx > W - 40 || sy < 80 || sy > Hh - 120;
    if (behind) {
      sx = W - sx;
      sy = Hh - 140;
    }
    if (off) {
      sx = clamp(sx, 40, W - 40);
      sy = clamp(sy, 90, Hh - 140);
    }
    this.ui.placeMarker(sx, sy, `${Math.round(dist)} m`, off);
  }
}
