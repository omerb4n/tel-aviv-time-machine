import * as THREE from 'three';
import type { Ambience } from '../audio/Ambience';
import type { CameraRig } from '../core/CameraRig';
import { clamp, easeInOutCubic } from '../core/math';
import type { TimeController } from '../core/TimeController';
import { seaward } from '../data/geography';
import { LANDMARKS } from '../data/landmarks';
import { STYLE_INFO } from '../data/styleInfo';
import type { BuildingSite, Localized } from '../data/types';
import { h } from '../ui/dom';
import type { BuildingManager } from '../world/buildings/BuildingManager';
import { phaseAt } from '../world/fabric';
import type { PostFX } from '../world/PostFX';
import { GameState, type SaveData } from './GameState';
import { GameUI, type CaseFileSpec } from './GameUI';
import { Interactables } from './Interactables';
import { Joystick } from './Joystick';
import { hintArea, streetAt, yearLayer, type YearLayer } from './mapData';
import { FullMap, MiniMap, type MapOverlay } from './MapView';
import { alignment, MATCH, wrapAngle } from './rephoto';
import { COMING } from './cases';
import { Sfx } from './sfx';
import type { CaseDef, Lead, NoteTrigger, PhotoDef, Poi } from './types';

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

/** One save per case; the first prototype saved Case 1 under the legacy key. */
const saveKey = (caseId: string) => `tlvtm.case.${caseId}.v1`;
const LEGACY_KEY = 'tlvtm.case.v1';
/** What carries over between cases: collections, and the last case played. */
const PROFILE_KEY = 'tlvtm.profile.v1';
interface Profile {
  landmarks: string[];
  stamps: string[];
  last?: string;
}
const TAP_OFFSETS: [number, number][] = [[0, 0], [0, 16], [0, -16], [16, 0], [-16, 0], [12, 12], [-12, 12], [12, -12], [-12, -12], [0, 30], [0, -30], [30, 0], [-30, 0]];

type Lens =
  | { kind: 'idle' }
  | { kind: 'travel-capture'; year: number; done?: () => void }
  | { kind: 'travel'; t: number; done?: () => void }
  | { kind: 'peek-capture'; year: number; base: number }
  | { kind: 'peek'; t: number; base: number; year: number; closing: boolean };

interface PhotoPlate {
  /** The aged photograph, as seen when held up. */
  overlay: string;
  /** The same photo as a postcard with a border and caption. */
  card: string;
  /** Outlines of the photo (an alignment aid). */
  tracing: string;
  /** Width / height. */
  ratio: number;
  /** Match points in photo coordinates (0 … 1). */
  marks: { u: number; v: number }[];
}

interface Holding {
  lead: Lead;
  photo: PhotoDef;
  held: number;
  /** Aids switched on: 1 tracing, 2 match points, 3 directions. */
  aid: number;
  focus: 'none' | 'near' | 'lock';
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; progress is then per-session */
  }
}

function load(caseId: string): SaveData | undefined {
  const save = read<SaveData>(saveKey(caseId));
  if (save) return save;
  const legacy = read<SaveData>(LEGACY_KEY);
  return legacy?.caseId === caseId ? legacy : undefined;
}

/** A case's saved state, with the collections shared across cases merged in. */
function loadState(def: CaseDef): GameState {
  const st = new GameState(def, load(def.id));
  const prof = read<Profile>(PROFILE_KEY);
  prof?.landmarks.forEach((x) => st.landmarks.add(x));
  prof?.stamps.forEach((x) => st.stamps.add(x));
  return st;
}

/** First sentence of a text, and the rest. */
function split(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(.+)$/s);
  return m ? [m[1], m[2]] : [text, ''];
}

/**
 * The exploration game: a case to solve on foot, at street level, by noticing things,
 * standing where old photos were taken and slipping through anchored years.
 * See docs/GAME_DESIGN.md and docs/UI_DESIGN.md.
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
  private holding?: Holding;
  private lastYear?: number;
  private saveTimer = 0;
  private noteTimer = 0;
  private ray = new THREE.Raycaster();
  private titleEl?: HTMLElement;
  private v = new THREE.Vector3();
  private keyPeek = false;
  private mini = new MiniMap();
  private full: FullMap;
  private layer?: YearLayer;
  private caseTab: 'case' | 'finds' = 'case';

  /** The case being played. */
  def: CaseDef;

  constructor(
    private w: WorldApi,
    readonly cases: CaseDef[],
    uiRoot: HTMLElement,
  ) {
    const last = read<Profile>(PROFILE_KEY)?.last;
    this.def = cases.find((c) => c.id === last) ?? cases[0];
    this.state = loadState(this.def);
    this.ui = new GameUI(uiRoot);
    // every case's props stand in the world; only the current case's leads make them sparkle
    this.inter = new Interactables(cases.flatMap((c) => c.pois));
    w.scene.add(this.inter.root);
    this.inter.setYear(w.time.year);
    w.time.onChange((y) => {
      this.inter.setYear(y);
      if (this.active) this.renderHud();
    });
    if (matchMedia('(pointer: coarse)').matches) new Joystick(this.ui.root, w.rig.moveInput);

    this.ui.mapSlot.append(this.mini.el);
    this.full = new FullMap(this.ui.root);
    this.full.onClose = () => this.closeMap();
    this.mini.el.onclick = () => this.openMap();
    void document.fonts?.ready.then(() => this.mini.invalidate());

    this.ui.onHint = () => this.hint();
    this.ui.onTravel = (y) => this.travel(y);
    this.ui.onPeek = (y, on) => (on ? this.peek(y) : this.unpeek());
    this.ui.onSolve = () => this.solve();
    this.ui.onCase = () => (this.state.readyToSolve ? this.solve() : this.caseFile());
    this.ui.onMenu = () => this.menu();
    this.ui.onExamine = () => this.examineHere();
    this.ui.onPostcard = () => this.togglePhoto();
    this.ui.onAid = () => this.aid();
    this.ui.onPhotoClose = () => this.closePhoto();
    this.ui.onFlapStep = () => this.sfx.flap();
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
    for (const lead of this.cases.flatMap((c) => c.leads)) {
      if (lead.trigger.kind !== 'rephoto') continue;
      const p = lead.trigger.photo;
      this.w.jumpTo(p.year);
      rig.teleport(p.pose.x, p.pose.z, p.pose.yaw, p.pose.pitch);
      rig.update(0);
      this.inter.hideMarkers();
      this.photos.set(p.id, this.renderPlate(p));
    }
    this.w.jumpTo(year);
  }

  private renderPlate(p: PhotoDef): PhotoPlate {
    // A postcard is landscape. On a portrait screen, render it at 4:3 with the same vertical
    // field of view: the phone then sees exactly the middle of the photo, so it still lines up.
    const { camera, post } = this.w;
    const renderer = post.composer.renderer;
    const [vw, vh] = [window.innerWidth, window.innerHeight];
    const narrow = vw / vh < 4 / 3;
    if (narrow) {
      const pw = Math.round(vh * (4 / 3));
      camera.aspect = 4 / 3;
      camera.updateProjectionMatrix();
      renderer.setSize(pw, vh, false);
      post.setSize(pw, vh);
    }
    post.render();
    const plate = this.readPlate(p);
    if (narrow) {
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();
      renderer.setSize(vw, vh, false);
      post.setSize(vw, vh);
    }
    return plate;
  }

  private readPlate(p: PhotoDef): PhotoPlate {
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

    // match points, projected with the photographer's camera
    this.w.camera.updateMatrixWorld();
    const marks = p.marks.map((m) => {
      this.v.set(m.x, this.w.ground(m.x, m.z) + m.y, m.z).project(this.w.camera);
      return { u: ((this.v.x * 0.5 + 0.5) * W - (W - cw) / 2) / cw, v: -this.v.y * 0.5 + 0.5 };
    });

    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const cwid = c.width;
    const lum = new Float32Array(cwid * c.height);
    for (let i = 0; i < lum.length; i++) lum[i] = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;

    // the tracing: the photo's outlines in cream ink (Sobel edges)
    const t = document.createElement('canvas');
    t.width = cwid;
    t.height = c.height;
    const tg = t.getContext('2d')!;
    const ti = tg.createImageData(cwid, c.height);
    for (let y = 1; y < c.height - 1; y++)
      for (let x = 1; x < cwid - 1; x++) {
        const i = y * cwid + x;
        const gx = lum[i - cwid + 1] + 2 * lum[i + 1] + lum[i + cwid + 1] - lum[i - cwid - 1] - 2 * lum[i - 1] - lum[i + cwid - 1];
        const gy = lum[i + cwid - 1] + 2 * lum[i + cwid] + lum[i + cwid + 1] - lum[i - cwid - 1] - 2 * lum[i - cwid] - lum[i - cwid + 1];
        const a = clamp((Math.hypot(gx, gy) - 0.18) * 3.2, 0, 1);
        ti.data[i * 4] = 255;
        ti.data[i * 4 + 1] = 240;
        ti.data[i * 4 + 2] = 200;
        ti.data[i * 4 + 3] = a * 255;
      }
    tg.putImageData(ti, 0, 0);

    // age the print: warm monochrome, crushed contrast, vignette, dust
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % cwid;
      const py = Math.floor(i / 4 / cwid);
      const k = Math.min(1, Math.max(0, (lum[i / 4] - 0.5) * 1.18 + 0.52));
      const vx = px / cwid - 0.5;
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
      const x = Math.random() * cwid;
      g.moveTo(x, Math.random() * c.height);
      g.lineTo(x + (Math.random() - 0.5) * 30, Math.random() * c.height);
      g.stroke();
    }
    const overlay = c.toDataURL('image/jpeg', 0.86);
    // postcard: cream border and a caption
    const pad = Math.round(c.height * 0.06);
    const pc = document.createElement('canvas');
    pc.width = cwid + pad * 2;
    pc.height = c.height + pad * 3.2;
    const pg = pc.getContext('2d')!;
    pg.fillStyle = '#efe6d2';
    pg.fillRect(0, 0, pc.width, pc.height);
    pg.drawImage(c, pad, pad);
    pg.fillStyle = '#4a3b2a';
    pg.font = `italic ${Math.round(pad * 0.9)}px "Frank Ruhl Libre", Georgia, serif`;
    pg.textAlign = 'center';
    pg.fillText(p.caption.en, pc.width / 2, c.height + pad * 2.25);
    return { overlay, card: pc.toDataURL('image/jpeg', 0.86), tracing: t.toDataURL('image/png'), ratio, marks };
  }

  /** The title screen: a 1930s-style poster with each case as a ticket. */
  showTitle(parent: HTMLElement) {
    const free = h('button', { class: 'g-btn-text light' }, 'Free explore · the classic timeline') as HTMLButtonElement;
    const el = h('div', { id: 'title' });
    const go = (def: CaseDef, fresh: boolean) => {
      this.sfx.unlock();
      void this.w.audio.enable().then(() => (this.sfx.enabled = this.w.audio.enabled));
      this.selectCase(def);
      if (fresh) this.reset();
      el.classList.add('done');
      window.setTimeout(() => el.remove(), 900);
      this.enter(!fresh);
    };
    const tickets = this.cases.map((def) => {
      const st = def.id === this.def.id ? this.state : new GameState(def, load(def.id));
      const started = st.done.size > 0 || st.where !== undefined;
      const status = st.solved ? 'Solved ✓' : started ? `In progress · ${st.done.size}/${def.leads.length}` : 'New';
      const begin = h('button', { class: `g-btn-ink${def.id === this.def.id ? ' big' : ''}` }, st.solved ? 'Walk again' : started ? 'Continue' : 'Begin') as HTMLButtonElement;
      begin.onclick = () => go(def, false);
      let fresh: HTMLButtonElement | null = null;
      if (started) {
        fresh = h('button', { class: 'g-btn-text' }, 'Start over') as HTMLButtonElement;
        fresh.onclick = () => go(def, true);
      }
      return h(
        'div',
        { class: `poster-ticket${def.id === this.def.id ? ' current' : ''}` },
        h('div', { class: 'pt-stub' }, h('small', {}, 'Case'), h('b', {}, String(def.number))),
        h('div', { class: 'pt-body' }, h('b', {}, def.title.en), h('small', {}, def.tagline.en), h('i', { class: 'pt-status' }, status), h('div', { class: 'g-actions' }, begin, fresh)),
      );
    });
    el.append(
      h(
        'div',
        { class: 'poster' },
        h('div', { class: 'poster-band', lang: 'he', dir: 'rtl' }, 'מכונת הזמן של תל אביב'),
        h('h1', {}, h('span', {}, 'Tel Aviv'), h('span', {}, 'Time Machine')),
        h('p', { class: 'poster-sub' }, 'Walk its streets from 1909 to today. Notice what changed — and find out why.'),
        ...tickets,
        h('div', { class: 'poster-next' }, ...COMING.map((t, i) => h('span', {}, h('small', {}, `Case ${this.cases.length + i + 1}`), t))),
      ),
      free,
    );
    parent.append(el);
    this.titleEl = el;
    free.onclick = () => {
      el.classList.add('done');
      window.setTimeout(() => el.remove(), 900);
      this.onFreeMode?.(false);
    };
  }

  /** Switch to another case (its own save; shared collections). */
  selectCase(def: CaseDef) {
    if (def.id === this.def.id) return;
    // only a case that was actually played has a position worth saving
    if (this.active) this.save();
    this.def = def;
    this.state = loadState(def);
    this.lastYear = undefined;
    write(PROFILE_KEY, { ...this.profile(), last: def.id });
  }

  /** Back to the title poster (to choose a case). */
  private toTitle() {
    this.exit();
    document.body.classList.remove('mode-free');
    this.showTitle(document.body);
  }

  get titleOpen() {
    return !!this.titleEl?.isConnected;
  }

  private reset() {
    try {
      localStorage.removeItem(saveKey(this.def.id));
      if (read<SaveData>(LEGACY_KEY)?.caseId === this.def.id) localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* private mode */
    }
    this.state = loadState(this.def);
  }

  private profile(): Profile {
    const prof = read<Profile>(PROFILE_KEY) ?? { landmarks: [], stamps: [] };
    return {
      landmarks: [...new Set([...prof.landmarks, ...this.state.landmarks])],
      stamps: [...new Set([...prof.stamps, ...this.state.stamps])],
      last: this.def.id,
    };
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
    this.mini.invalidate();
    this.renderHud();
    if (this.state.done.size === 0 && !where) this.intro();
  }

  /** Leave the game for the classic free timeline. */
  exit() {
    this.save();
    this.active = false;
    this.closePhoto();
    this.closeMap();
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
      kind: 'postcard',
      kicker: `Case ${this.def.number} · ${this.def.title.en}`,
      title: 'An old postcard',
      gist: this.def.intro.en,
      image: plate?.card,
      actions: [{ label: 'Next', primary: true, run: () => this.howToPlay() }],
    });
  }

  private howToPlay() {
    this.ui.showHowTo(matchMedia('(pointer: coarse)').matches, () => this.ui.closeModal());
  }

  private save() {
    const c = this.w.camera.position;
    const year = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    if (this.state.anchors.has(year)) this.state.where = { year, x: c.x, z: c.z, yaw: this.w.rig.yaw };
    write(saveKey(this.def.id), this.state.toJSON());
    write(PROFILE_KEY, this.profile());
  }

  // ------------------------------------------------------------------ HUD

  private renderHud() {
    const s = this.state;
    const lead = s.current;
    const steps = this.def.leads.map((l) => (s.done.has(l.id) ? 'done' : l === lead ? 'now' : '') as 'done' | 'now' | '');
    const tier = lead ? s.hintTier(lead.id) : -1;
    if (lead)
      this.ui.renderTag({
        kicker: `Case ${this.def.number}`,
        text: lead.short.en,
        steps,
        hint: tier >= 0 ? lead.hints[Math.min(tier, lead.hints.length - 1)].en : undefined,
        canHint: tier < lead.hints.length - 1,
      });
    else if (s.readyToSolve) this.ui.renderTag({ kicker: `Case ${this.def.number} · every clue found`, text: 'Tap here to solve the case', steps, canHint: false });
    else this.ui.renderTag({ kicker: `Case ${this.def.number} · closed`, text: 'Free travel: wander any year', steps, canHint: false });

    const y = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    this.ui.renderYear(y, this.lens.kind === 'peek' ? this.lens.year : undefined);
    const anchored = s.compass.filter((c) => !c.locked).length;
    const tip = anchored < 2 ? undefined : !s.seen.has('travel') ? 'Tap a year to travel' : !s.seen.has('peek') ? 'Hold a year to peek' : undefined;
    this.ui.renderCompass(s.compass, y, tip);
    this.inter.wanted = new Set(s.open.flatMap((l) => (l.trigger.kind === 'poi' ? [l.trigger.poiId] : [])));
    const photoLead = s.open.find((l) => l.trigger.kind === 'rephoto');
    const plate = photoLead?.trigger.kind === 'rephoto' ? this.photos.get(photoLead.trigger.photo.id) : undefined;
    this.ui.setPostcard(plate?.card);
  }

  private hint() {
    const lead = this.state.current;
    if (!lead) return;
    const tier = this.state.nextHint(lead.id);
    this.sfx.tick();
    this.save();
    this.renderHud();
    // from the second hint on, the map shows where to look: draw the eye to it
    if (tier >= 1) {
      this.mini.el.classList.remove('ping');
      void this.mini.el.offsetWidth;
      this.mini.el.classList.add('ping');
    }
  }

  // ------------------------------------------------------------------ map

  private yearLayer(): YearLayer {
    const y = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    if (!this.layer || this.layer.year !== y) this.layer = yearLayer(y, this.w.buildings.sites);
    return this.layer;
  }

  private mapOverlay(): MapOverlay {
    const s = this.state;
    const c = this.w.camera.position;
    const lead = s.current;
    const tier = lead ? s.hintTier(lead.id) : -1;
    let hint: MapOverlay['hint'];
    if (lead && tier >= 1) {
      const exact = tier >= lead.hints.length - 1;
      hint = exact ? { x: lead.target.x, z: lead.target.z, r: 0, exact } : { ...hintArea(lead.target, lead.id), exact };
    }
    return {
      player: { x: c.x, z: c.z, yaw: this.w.rig.yaw },
      trail: s.trail,
      pins: LANDMARKS.filter((l) => s.landmarks.has(l.id)).map((l) => ({ x: l.x, z: l.z, label: l.name?.en ?? '' })),
      stamps: this.def.leads.flatMap((l, i) => (s.done.has(l.id) ? [{ x: l.target.x, z: l.target.z, n: i + 1 }] : [])),
      hint,
    };
  }

  private openMap() {
    if (!this.active || this.holding || this.lens.kind !== 'idle') return;
    this.ui.closeModal();
    const c = this.w.camera.position;
    const st = streetAt(c.x, c.z, Math.floor(this.w.time.year));
    this.full.show(this.yearLayer(), this.mapOverlay(), st ? `You are on ${st.name.en}` : 'You are here');
    this.sfx.tick();
  }

  private closeMap() {
    if (this.full.open) this.full.hide();
  }

  // ------------------------------------------------------------------ time lens

  /** Slip to another anchored year with an expanding lens. */
  travel(year: number, done?: () => void) {
    if (this.lens.kind !== 'idle' || !this.state.anchors.has(year) || year === Math.floor(this.w.time.year)) return;
    this.closePhoto();
    this.closeMap();
    this.lastYear = Math.floor(this.w.time.year);
    this.w.post.wipe.capture();
    this.lens = { kind: 'travel-capture', year, done };
    this.sfx.whoosh(year > this.lastYear);
    this.state.seen.add('travel');
  }

  /** Look into another anchored year through a small lens, without leaving. */
  peek(year: number) {
    if (this.lens.kind !== 'idle' || year === Math.floor(this.w.time.year)) return;
    this.w.post.wipe.capture();
    this.lens = { kind: 'peek-capture', year, base: Math.floor(this.w.time.year) };
    this.sfx.whoosh(true, 0.6);
    this.state.seen.add('peek');
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
      this.noteOn((t) => t.kind === 'peek' && this.inYears(L.base, t.from) && this.inYears(L.year, t.to) && this.within(t));
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
    this.w.rig.inputEnabled = !this.ui.modalOpen && !this.full.open && (this.lens.kind === 'idle' || this.lens.kind === 'travel');
  }

  // ------------------------------------------------------------------ field notes

  private inYears(y: number, [a, b]: [number, number]) {
    return y >= a && y <= b;
  }

  private within(t: { x: number; z: number; r: number }) {
    const c = this.w.camera.position;
    return Math.hypot(c.x - t.x, c.z - t.z) <= t.r;
  }

  /** Awards every note of the current case whose trigger matches. */
  private noteOn(match: (t: NoteTrigger) => boolean) {
    for (const n of this.def.notes) if (!this.state.notes.has(n.id) && match(n.trigger)) this.note(n.id);
  }

  /** Notes earned by being somewhere (checked a few times a second). */
  private checkPlaceNotes() {
    const year = Math.floor(this.w.time.year);
    const c = this.w.camera.position;
    this.noteOn((t) => (t.kind === 'area' && this.inYears(year, t.years) && this.within(t)) || (t.kind === 'coast' && this.inYears(year, t.years) && seaward(c.x, c.z) > -25));
  }

  // ------------------------------------------------------------------ rephotography
  //
  // No meter: you line the photo up by eye. Camera-style corner brackets appear when the
  // view is roughly right and lock when it matches. Three optional aids, one at a time:
  // the photo's outlines, match points, then plain directions.

  private togglePhoto() {
    if (this.holding) return this.closePhoto();
    const lead = this.state.open.find((l) => l.trigger.kind === 'rephoto');
    if (!lead || lead.trigger.kind !== 'rephoto' || this.lens.kind !== 'idle') return;
    const plate = this.photos.get(lead.trigger.photo.id);
    if (!plate) return;
    this.closeMap();
    this.ui.closeModal();
    this.holding = { lead, photo: lead.trigger.photo, held: 0, aid: 0, focus: 'none' };
    this.ui.showPhoto({ src: plate.overlay, tracing: plate.tracing, ratio: plate.ratio, caption: `${lead.trigger.photo.caption.en} · line it up by eye` });
    this.sfx.tick();
  }

  private closePhoto() {
    if (!this.holding) return;
    this.holding = undefined;
    this.ui.showPhoto(undefined);
  }

  private aid() {
    const H = this.holding;
    if (!H || H.aid >= 3) return;
    H.aid++;
    this.sfx.tick();
  }

  private updatePhoto(dt: number) {
    const H = this.holding;
    if (!H) return;
    const { rig, camera } = this.w;
    const view = { x: camera.position.x, z: camera.position.z, yaw: rig.yaw, pitch: rig.pitch };
    const a = alignment(H.photo.pose, view);
    // a photo of 1909 lines up only in 1909: the crowd, the dune and the light must be there
    const rightYear = this.state.canComplete(H.lead, Math.floor(this.w.time.year));
    const matched = a.matched && rightYear;
    const focus = matched ? 'lock' : a.near ? 'near' : 'none';
    if (focus !== 'none' && H.focus === 'none') this.sfx.focus();
    H.focus = focus;

    let marks;
    const plate = this.photos.get(H.photo.id);
    if (H.aid >= 2 && plate) {
      const W = window.innerWidth;
      const Hh = window.innerHeight;
      const pw = Hh * plate.ratio;
      const left = (W - pw) / 2;
      marks = H.photo.marks.map((m, i) => {
        this.v.set(m.x, this.w.ground(m.x, m.z) + m.y, m.z).project(camera);
        const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.4 && Math.abs(this.v.y) < 1.4;
        return { px: left + plate.marks[i].u * pw, py: plate.marks[i].v * Hh, lx: (this.v.x * 0.5 + 0.5) * W, ly: (-this.v.y * 0.5 + 0.5) * Hh, visible };
      });
    }

    let advice: string | undefined;
    if (H.aid >= 3) {
      if (a.dist > MATCH.dist) {
        const dx = H.photo.pose.x - view.x;
        const dz = H.photo.pose.z - view.z;
        const rel = wrapAngle(Math.atan2(-dx, -dz) - view.yaw) * (180 / Math.PI);
        const dir = Math.abs(rel) < 35 ? 'ahead' : Math.abs(rel) > 145 ? 'behind you' : rel > 0 ? 'to your left' : 'to your right';
        advice = a.dist > 45 ? 'Find the street in the photo first.' : `The photographer stood a bit ${dir}.`;
      } else if (a.yawErr > MATCH.yaw) advice = wrapAngle(H.photo.pose.yaw - view.yaw) > 0 ? 'Turn a little left.' : 'Turn a little right.';
      else if (a.pitchErr > MATCH.pitch) advice = H.photo.pose.pitch > view.pitch ? 'Look up a little.' : 'Look down a little.';
      else advice = 'Hold still…';
    }
    if (a.near && !rightYear) advice = `This is the spot, but the photo was taken in ${H.photo.year}.`;
    this.ui.renderPhoto({ focus, aid: H.aid, marks, advice });

    H.held = matched ? H.held + dt : 0;
    if (H.held > 0.7) {
      const { lead, aid } = H;
      this.sfx.shutter();
      this.ui.root.classList.add('flash');
      window.setTimeout(() => this.ui.root.classList.remove('flash'), 500);
      this.closePhoto();
      if (aid === 0) this.noteOn((t) => t.kind === 'eye');
      this.completeLead(lead);
    }
  }

  // ------------------------------------------------------------------ examining

  /** Handles a tap/click on the scene. Returns true if it hit something. */
  tap(clientX: number, clientY: number): boolean {
    if (!this.active || this.ui.modalOpen || this.full.open || this.holding || this.lens.kind !== 'idle') return false;
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
    if (dist > 30) return this.ui.toast('Too far away — walk closer.');
    if (lead && this.state.canComplete(lead, year)) return this.completeLead(lead);
    if (lead && this.state.done.has(lead.id)) return this.ui.toast(`${lead.clue.title.en} — in your case file.`);
    this.ui.toast(`${poi.label.en}. Remember it…`);
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
      if (dist > 140) return this.ui.toast(`${site.name?.en ?? 'A landmark'} — walk closer.`);
      const isNew = this.state.collect('landmarks', site.id);
      this.noteOn((t) => t.kind === 'site' && t.siteId === site.id);
      if (!isNew) return this.ui.toast(`${site.name?.en} · ${phase.from}`);
      this.sfx.chime();
      this.save();
      const [gist, rest] = split(site.info.summary.en);
      return this.ui.showCard({
        kicker: `Landmark ${this.state.landmarks.size} / ${LANDMARKS.length}`,
        title: site.name?.en ?? 'Landmark',
        gist,
        more: { text: rest, facts: site.info.facts?.map((f) => f.en), sources: site.info.sources },
        confidence: site.info.confidence,
        ticket: { label: 'Built', value: String(phase.from) },
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
    const [gist, rest] = split(style.text.en);
    this.ui.showCard({
      kicker: `Style stamp ${this.state.stamps.size} / ${Object.keys(STYLE_INFO).length}`,
      title: style.name.en,
      gist,
      more: { text: rest, facts: style.look.map((l) => `Look for: ${l}`), sources: style.sources },
      confidence: 'documented',
      ticket: { label: style.period, value: String(phase.from) },
      actions: [{ label: 'Continue', primary: true, run: () => this.ui.closeModal() }],
    });
  }

  /** The current lead, if its target can be examined from where the player stands right now. */
  private inReach(): { lead: Lead; label: string } | undefined {
    const lead = this.state.current;
    if (!lead || this.lens.kind !== 'idle' || this.ui.modalOpen || this.holding || this.full.open) return undefined;
    if (!this.state.canComplete(lead, Math.floor(this.w.time.year))) return undefined;
    const c = this.w.camera.position;
    const tr = lead.trigger;
    const label = `Examine ${lead.examine?.en ?? 'it'}`;
    if (tr.kind === 'site') {
      const site = LANDMARKS.find((s) => s.id === tr.siteId);
      if (!site) return undefined;
      // distance to the footprint edge, roughly (as for taps)
      const d = Math.max(0, Math.hypot(c.x - site.x, c.z - site.z) - Math.min(site.width, site.depth) / 2);
      return d <= Math.min(tr.maxDist, 40) ? { lead, label } : undefined;
    }
    if (tr.kind === 'poi') {
      const poi = this.def.pois.find((p) => p.id === tr.poiId);
      if (!poi || !this.inter.present(poi.id)) return undefined;
      return Math.hypot(c.x - poi.x, c.z - poi.z) < 16 ? { lead, label } : undefined;
    }
    return undefined;
  }

  /** Examine the current lead's target if it is in reach. Returns whether it was. */
  private examineHere(): boolean {
    const reach = this.inReach();
    if (!reach) return false;
    this.completeLead(reach.lead);
    return true;
  }

  private note(id: string) {
    if (!this.state.collect('notes', id)) return;
    this.save();
    const n = this.def.notes.find((x) => x.id === id);
    if (!n) return;
    this.sfx.chime();
    this.ui.toast(`Field note · ${n.title.en}`, 3500);
  }

  private completeLead(lead: Lead) {
    const newYear = this.state.complete(lead.id);
    this.save();
    this.renderHud();
    const next = () => {
      this.sfx.chime(true);
      if (lead.autoTravel && newYear !== undefined) this.travel(newYear, () => this.showClue(lead, newYear, true));
      else this.showClue(lead, newYear, false);
    };
    const r = lead.clue.reveal;
    if (!r) return next();
    this.ui.showReveal(
      r.prompt.en,
      r.draws.map((d) => ({ label: d.label.en, value: d.value.en, tone: d.tone })),
      () => this.sfx.tick(),
      next,
    );
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
    const n = this.def.leads.indexOf(lead) + 1;
    this.ui.showCard({
      kicker: `Clue ${n} / ${this.def.leads.length}`,
      title: c.title.en,
      gist: c.gist.en,
      more: { text: c.text.en, sources: c.sources },
      confidence: c.confidence,
      ticket: newYear !== undefined ? { label: traveled ? 'You are now in' : 'New year', value: String(newYear) } : undefined,
      actions,
    });
  }

  private deduce() {
    const d = this.def.deduction;
    this.ui.showDeduction(d.question, d.options, () => this.solved());
  }

  private solve() {
    if (!this.state.readyToSolve) return;
    this.ui.closeModal();
    this.deduce();
  }

  private solved() {
    this.state.solved = true;
    this.save();
    this.sfx.chime(true);
    this.renderHud();
    const r = this.def.resolution;
    const [gist, rest] = split(r.text.en);
    this.ui.showCard({
      kicker: 'Case closed',
      title: r.title.en,
      gist,
      more: { text: rest, facts: r.facts.map((f) => f.en), sources: r.sources },
      confidence: 'documented',
      ticket: { label: 'Unlocked', value: 'All years' },
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

  private caseFile(tab = this.caseTab) {
    this.closeMap();
    this.caseTab = tab;
    const s = this.state;
    const L = (x: Localized) => x.en;
    const spec: CaseFileSpec = {
      number: this.def.number,
      title: L(this.def.title),
      question: L(this.def.question),
      years: s.compass,
      leads: this.def.leads.map((l) => {
        if (s.done.has(l.id)) return { state: 'done' as const, title: L(l.clue.title), gist: L(l.clue.gist), text: L(l.clue.text), year: l.clue.anchors };
        if (s.open.includes(l)) {
          const tier = s.hintTier(l.id);
          return { state: 'now' as const, title: L(l.title), text: L(l.text), hint: tier >= 0 ? L(l.hints[tier]) : undefined };
        }
        return { state: 'locked' as const, title: '' };
      }),
      solved: s.solved,
      readyToSolve: s.readyToSolve,
      notes: this.def.notes.map((n) => ({ title: L(n.title), text: L(n.text), got: s.notes.has(n.id) })),
      stamps: Object.entries(STYLE_INFO).map(([id, v]) => ({ name: v!.name.en, got: s.stamps.has(id) })),
      landmarks: { names: LANDMARKS.filter((l) => s.landmarks.has(l.id)).map((l) => l.name?.en ?? l.id), total: LANDMARKS.length },
    };
    this.ui.showCaseFile(spec, tab, (t) => this.caseFile(t), () => this.ui.closeModal());
  }

  private menu() {
    this.closeMap();
    const sound = this.w.audio.enabled;
    let armed = false;
    this.ui.showMenu([
      { label: 'Resume', icon: 'play', run: () => this.ui.closeModal() },
      { label: sound ? 'Sound: on' : 'Sound: off', icon: sound ? 'sound' : 'mute', run: () => void this.toggleSound().then(() => this.menu()) },
      { label: 'Map', icon: 'map', run: () => this.openMap() },
      { label: 'How to play', icon: 'help', run: () => this.howToPlay() },
      { label: 'Choose a case', icon: 'journal', run: () => this.toTitle() },
      {
        label: 'Free explore · timeline',
        icon: 'free',
        run: () => {
          this.exit();
          this.onFreeMode?.(true);
        },
      },
      {
        label: 'Restart case',
        icon: 'restart',
        danger: true,
        run: () => {
          if (!armed) {
            armed = true;
            const el = document.querySelector('.g-menu-item.danger span');
            if (el) el.textContent = 'Tap again to restart';
            return;
          }
          this.ui.closeModal();
          this.reset();
          this.enter(false);
        },
      },
    ]);
  }

  private async toggleSound() {
    const a = this.w.audio;
    if (a.enabled) a.disable();
    else await a.enable();
    this.sfx.enabled = a.enabled;
  }

  private onKey(e: KeyboardEvent) {
    if (!this.active || (e.target as HTMLElement)?.tagName === 'INPUT' || e.repeat) return;
    if (e.code === 'Escape') {
      if (this.full.open) this.closeMap();
      else if (this.ui.modalOpen) this.ui.closeModal();
      else if (this.holding) this.closePhoto();
      else this.menu();
      return;
    }
    if (e.code === 'KeyM') return this.full.open ? this.closeMap() : this.openMap();
    if (this.ui.modalOpen || this.full.open) return;
    const anchored = this.state.compass.filter((s) => !s.locked).map((s) => s.year);
    if (e.code === 'KeyP') this.togglePhoto();
    else if (e.code === 'KeyJ') this.caseFile();
    else if (e.code === 'KeyH') {
      if (this.holding) this.aid();
      else this.hint();
    } else if (e.code === 'KeyE') {
      if (!this.examineHere()) this.tap(window.innerWidth / 2, window.innerHeight / 2);
    } else if (e.code === 'KeyQ') {
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
    const c = this.w.camera.position;
    const year = this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
    if (this.lens.kind === 'idle') this.state.walk(c.x, c.z);
    this.ui.setStreet(streetAt(c.x, c.z, year));
    if (!this.full.open) this.mini.draw(this.yearLayer(), this.mapOverlay());
    this.noteTimer += dt;
    if (this.noteTimer > 0.4 && this.lens.kind === 'idle') {
      this.noteTimer = 0;
      this.checkPlaceNotes();
    }
    this.saveTimer += dt;
    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      this.save();
    }
  }

  /** Context prompts, the Examine button and the on-screen marker of the final hint tier. */
  private updateGuidance() {
    const lead = this.state.current;
    const c = this.w.camera.position;
    const year = Math.floor(this.w.time.year);
    let prompt: string | undefined;
    const reach = this.inReach();
    let nearSpot = false;
    if (lead && !reach && this.lens.kind === 'idle' && !this.ui.modalOpen && !this.holding) {
      const d = Math.hypot(lead.target.x - c.x, lead.target.z - c.z);
      if (lead.trigger.kind === 'rephoto' && d < 18) nearSpot = true;
      else if (lead.years && (year < lead.years[0] || year > lead.years[1]) && d < 60) prompt = `Not in ${year} — try another year`;
    }
    this.ui.setPrompt(prompt);
    this.ui.setExamine(reach?.label);
    this.ui.root.classList.toggle('near-spot', nearSpot);

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
