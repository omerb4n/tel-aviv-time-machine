import * as THREE from 'three';
import type { Ambience } from '../audio/Ambience';
import { type CameraRig, EYE } from '../core/CameraRig';
import { clamp, easeInOutCubic } from '../core/math';
import type { TimeController } from '../core/TimeController';
import { LANDMARKS } from '../data/landmarks';
import { STYLE_INFO } from '../data/styleInfo';
import type { BuildingSite } from '../data/types';
import { h } from '../ui/dom';
import type { BuildingManager } from '../world/buildings/BuildingManager';
import { phaseAt } from '../world/fabric';
import type { PostFX } from '../world/PostFX';
import { TIERS, type Tier } from '../world/Quality';
import { COLLECTIONS, DISCOVERIES, POIS, SECTIONS, START, YEARS } from './content';
import { compareFinds, inYears, lookFinds, type LookHit } from './discover';
import { GameUI, type NotebookSpec } from './GameUI';
import { Interactables } from './Interactables';
import { Joystick } from './Joystick';
import { hintArea, streetAt, yearLayer, type YearLayer } from './mapData';
import { FullMap, MiniMap, type MapOverlay } from './MapView';
import { NotebookState, type Found, type SaveData } from './NotebookState';
import { alignment, containRect, type Frame, MATCH, printFrame, settles, subjectAlpha, wrapAngle } from './rephoto';
import { Sfx } from './sfx';
import type { Discovery, PhotoDef, Poi, SectionId, Trigger, Years } from './types';

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
  /** The picture-quality tier, and a way to change it (remembered on this device). */
  quality: { get: () => Tier; set: (t: Tier) => void };
}

const QUALITY_NAMES: Record<Tier, string> = { phone: 'light', laptop: 'balanced', desktop: 'full' };

const SAVE_KEY = 'tlvtm.notebook.v1';
/** Style stamps and landmarks collected in the case builds, carried into the notebook. */
const PROFILE_KEY = 'tlvtm.profile.v1';
const FULLSCREEN_KEY = 'tlvtm.fullscreen';
const TAP_OFFSETS: [number, number][] = [[0, 0], [0, 16], [0, -16], [16, 0], [-16, 0], [12, 12], [-12, 12], [12, -12], [-12, -12], [0, 30], [0, -30], [30, 0], [-30, 0]];
/** A look must be held this long (seconds) to notice something; the centre is checked this often. */
const NOTICE_HOLD = 1.1;
/** Holding still this long (s) near a photo's spot lets the view settle into it… */
const SETTLE_AFTER = 0.35;
/** …at this rate (1/s). */
const SETTLE_RATE = 2.2;
const NOTICE_EVERY = 0.15;

type Lens =
  | { kind: 'idle' }
  | { kind: 'travel-capture'; year: number; from: number }
  | { kind: 'travel'; t: number; from: number; to: number }
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
  /** The print's edges in the reference view (see `REF`). */
  frame: Frame;
  /** Match points in photo coordinates (0 … 1). */
  marks: { u: number; v: number }[];
  /** The print is the real photograph, not the reconstruction. */
  real: boolean;
}

/** The reference view the photos are fitted in: the game camera (50° tall) at 4:3. */
const REF = 4 / 3;

interface Holding {
  disc: Discovery;
  photo: PhotoDef;
  /** The years the photo lines up in. */
  years: Years;
  held: number;
  /** Aids switched on: 1 tracing, 2 match points, 3 directions. */
  aid: number;
  focus: 'none' | 'near' | 'lock';
  /** Nearly lined up and still: the view is settling into the photographer's spot. */
  settling?: boolean;
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

/** The saved notebook, with the style stamps and landmarks of the case builds merged in. */
function loadState(): NotebookState {
  const st = new NotebookState(DISCOVERIES, read<SaveData>(SAVE_KEY));
  const prof = read<{ landmarks?: string[]; stamps?: string[] }>(PROFILE_KEY);
  prof?.landmarks?.forEach((x) => st.landmarks.add(x));
  prof?.stamps?.forEach((x) => st.stamps.add(x));
  return st;
}

/** First sentence of a text, and the rest. */
function split(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(.+)$/s);
  return m ? [m[1], m[2]] : [text, ''];
}

const photoOf = (d: Discovery) => (d.trigger.kind === 'photo' ? d.trigger.photo : undefined);

/**
 * The exploration game: an open city walked at street level in seven years, and a field
 * notebook that records what the player notices (by looking closely, by comparing two years
 * in one place, and by standing where old photographs were taken).
 * See docs/GAME_DESIGN.md and docs/UI_DESIGN.md.
 */
export class Game {
  state = loadState();
  readonly ui: GameUI;
  readonly inter: Interactables;
  readonly sfx = new Sfx();
  active = false;
  /** Called when the player chooses the classic free timeline. */
  onFreeMode?: (fromGame: boolean) => void;

  private lens: Lens = { kind: 'idle' };
  private photos = new Map<string, PhotoPlate>();
  /** The real photographs, by photo id, once loaded. */
  private archive = new Map<string, HTMLImageElement>();
  private holding?: Holding;
  private lastYear?: number;
  private saveTimer = 0;
  private ray = new THREE.Raycaster();
  private titleEl?: HTMLElement;
  private v = new THREE.Vector3();
  private keyPeek = false;
  private mini = new MiniMap();
  private full: FullMap;
  private layer?: YearLayer;
  private tab: SectionId = 'architecture';
  /** Discoveries waiting for their card. */
  private queue: Discovery[] = [];
  /** What the centre of the view has been resting on, and for how long. */
  private notice?: { id: string; t: number };
  private noticeClock = 0;

  constructor(
    private w: WorldApi,
    uiRoot: HTMLElement,
  ) {
    this.ui = new GameUI(uiRoot);
    this.inter = new Interactables(POIS);
    w.scene.add(this.inter.root);
    this.inter.setYear(w.time.year);
    w.time.onChange((y) => {
      this.inter.setYear(y);
      if (this.active) this.renderHud();
    });
    if (matchMedia('(pointer: coarse)').matches) new Joystick(this.ui.root, w.rig.moveInput);
    // rise above the roofs and come down again (R / F on a keyboard)
    const lift = (dir: 1 | -1) => {
      const b = h('button', { class: 'g-lift', title: dir > 0 ? 'Rise (R)' : 'Come down (F)', 'aria-label': dir > 0 ? 'Rise' : 'Come down' }, dir > 0 ? '▲' : '▼') as HTMLButtonElement;
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        w.rig.moveInput.up = dir;
      };
      b.onpointerup = b.onpointercancel = () => (w.rig.moveInput.up = 0);
      b.oncontextmenu = (e) => e.preventDefault();
      return b;
    };
    this.ui.root.append(h('div', { class: 'g-lifts' }, lift(1), lift(-1)));

    this.ui.mapSlot.append(this.mini.el);
    this.full = new FullMap(this.ui.root);
    this.full.onClose = () => this.closeMap();
    this.mini.el.onclick = () => this.openMap();
    void document.fonts?.ready.then(() => this.mini.invalidate());

    this.ui.onTravel = (y) => this.travel(y);
    this.ui.onPeek = (y, on) => (on ? this.peek(y) : this.unpeek());
    this.ui.onNotebook = () => this.notebook();
    this.ui.onMenu = () => this.menu();
    this.ui.onExamine = () => this.tap(window.innerWidth / 2, window.innerHeight / 2);
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

  /** Where a new notebook starts. */
  get start() {
    return START;
  }

  // ------------------------------------------------------------------ lifecycle

  /**
   * Loads the real archive photographs. Resolves once all have loaded or failed, or after
   * `timeout` ms: a print that is not there in time is replaced by the reconstruction.
   */
  loadArchive(timeout = 12000): Promise<void> {
    const jobs = DISCOVERIES.flatMap((d) => {
      const p = photoOf(d);
      return p?.archive ? [p] : [];
    }).map(
      (p) =>
        new Promise<void>((done) => {
          const img = new Image();
          img.onload = () => {
            this.archive.set(p.id, img);
            done();
          };
          img.onerror = () => done();
          img.src = p.archive!.src;
        }),
    );
    return Promise.race([Promise.all(jobs).then(() => undefined), new Promise<void>((done) => window.setTimeout(done, timeout))]);
  }

  /** Renders the archival photo plates (call once the world is built, before the title). */
  preparePhotos() {
    const { rig, time } = this.w;
    const year = time.year;
    for (const d of DISCOVERIES) {
      const p = photoOf(d);
      if (!p) continue;
      this.w.jumpTo(p.year);
      rig.teleport(p.pose.x, p.pose.z, p.pose.yaw, p.pose.pitch, p.pose.height);
      rig.update(0);
      this.inter.hideMarkers();
      this.photos.set(p.id, this.renderPlate(p));
    }
    this.w.jumpTo(year);
  }

  private renderPlate(p: PhotoDef): PhotoPlate {
    const { camera, post } = this.w;
    const renderer = post.composer.renderer;
    // the match points as the reference camera sees them, and the print fitted over them
    camera.aspect = REF;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const inView = p.marks.map((m) => {
      this.v.set(m.x, this.w.ground(m.x, m.z) + m.y, m.z).project(camera);
      return { u: this.v.x * 0.5 + 0.5, v: -this.v.y * 0.5 + 0.5 };
    });
    const real = p.archive ? this.archive.get(p.id) : undefined;
    const frame = real ? printFrame(p.archive!.marks, inView, real.naturalWidth, real.naturalHeight, REF) : { u0: 0, v0: 0, u1: 1, v1: 1 };
    const ratio = real ? real.naturalWidth / real.naturalHeight : REF;
    // render the world exactly as the print frames it, for the tracing
    const ph = 900;
    const pw = Math.round(ph * ratio);
    renderer.setSize(pw, ph, false);
    post.setSize(pw, ph);
    this.frameView(frame, { x: 0, y: 0, w: pw }, pw, ph);
    post.render();
    const marks = real ? p.archive!.marks.map(([u, v]) => ({ u, v })) : inView;
    const plate = this.readPlate(p, real, ratio, frame, marks);
    this.unframeView();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    post.setSize(window.innerWidth, window.innerHeight);
    return plate;
  }

  /**
   * Aims the camera so that `rect` of a `sw` × `sh` screen shows exactly the part `frame` of
   * the reference view, and the rest of the screen carries on around it.
   */
  private frameView(frame: Frame, rect: { x: number; y: number; w: number }, sw: number, sh: number) {
    const { camera } = this.w;
    const [RW, RH] = [1000 * REF, 1000];
    const k = ((frame.u1 - frame.u0) * RW) / rect.w;
    camera.aspect = REF;
    camera.setViewOffset(RW, RH, frame.u0 * RW - rect.x * k, frame.v0 * RH - rect.y * k, sw * k, sh * k);
  }

  private unframeView() {
    const { camera } = this.w;
    camera.clearViewOffset();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  private readPlate(p: PhotoDef, real: HTMLImageElement | undefined, ratio: number, frame: Frame, marks: { u: number; v: number }[]): PhotoPlate {
    const src = this.w.canvas;
    const c = document.createElement('canvas');
    c.height = Math.min(900, src.height);
    c.width = Math.round(c.height * ratio);
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0, c.width, c.height);

    const cwid = c.width;
    const luminance = () => {
      const d = g.getImageData(0, 0, cwid, c.height).data;
      const lum = new Float32Array(cwid * c.height);
      for (let i = 0; i < lum.length; i++) lum[i] = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;
      return lum;
    };
    let lum = luminance();

    // the tracing: the scene's outlines in cream ink (Sobel edges). Traced from the model, so
    // it lines up with the view even when the print is a real photograph.
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

    // the real photograph, whole: the view is framed to fit it
    if (real) {
      g.drawImage(real, 0, 0, cwid, c.height);
      lum = luminance();
    }

    // age the print: warm monochrome, crushed contrast, vignette, dust. A real photograph is
    // old already: it only gets the tone and a softer touch.
    const img = g.getImageData(0, 0, cwid, c.height);
    const d = img.data;
    const [gain, grain, vignette] = real ? [1.05, 0.03, 0.6] : [1.18, 0.07, 1.3];
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % cwid;
      const py = Math.floor(i / 4 / cwid);
      const k = Math.min(1, Math.max(0, (lum[i / 4] - 0.5) * gain + 0.52));
      const vx = px / cwid - 0.5;
      const vy = py / c.height - 0.5;
      const vig = 1 - (vx * vx + vy * vy) * vignette;
      const n = (Math.random() - 0.5) * grain;
      const v = Math.max(0, (k + n) * vig);
      d[i] = Math.min(255, v * 255 * 1.06 + 12);
      d[i + 1] = Math.min(255, v * 255 * 0.94 + 6);
      d[i + 2] = Math.min(255, v * 255 * 0.76);
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,250,235,0.35)';
    for (let i = 0; i < (real ? 5 : 14); i++) {
      g.lineWidth = Math.random() * 1.2;
      g.beginPath();
      const x = Math.random() * cwid;
      g.moveTo(x, Math.random() * c.height);
      g.lineTo(x + (Math.random() - 0.5) * 30, Math.random() * c.height);
      g.stroke();
    }
    // held up, the print is see-through where it is empty and solid where its subjects are
    const strength = subjectAlpha(lum, cwid, c.height);
    const o = document.createElement('canvas');
    o.width = cwid;
    o.height = c.height;
    const od = g.getImageData(0, 0, cwid, c.height);
    for (let i = 0; i < strength.length; i++) od.data[i * 4 + 3] = strength[i] * 255;
    o.getContext('2d')!.putImageData(od, 0, 0);
    const overlay = o.toDataURL('image/webp', 0.86);
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
    return { overlay, card: pc.toDataURL('image/jpeg', 0.86), tracing: t.toDataURL('image/png'), ratio, frame, marks, real: !!real };
  }

  /** The title screen: a 1930s-style poster with the notebook as a ticket. */
  showTitle(parent: HTMLElement) {
    const free = h('button', { class: 'g-btn-text light' }, 'Free explore · the classic timeline') as HTMLButtonElement;
    const el = h('div', { id: 'title' });
    const go = (fresh: boolean) => {
      this.sfx.unlock();
      this.fullscreen();
      void this.w.audio.enable().then(() => (this.sfx.enabled = this.w.audio.enabled));
      if (fresh) this.reset();
      el.classList.add('done');
      window.setTimeout(() => el.remove(), 900);
      this.enter(!fresh);
    };
    const [n, total] = this.state.count();
    const started = n > 0 || this.state.where !== undefined;
    const begin = h('button', { class: 'g-btn-ink big' }, started ? 'Continue' : 'Begin') as HTMLButtonElement;
    begin.onclick = () => go(false);
    let fresh: HTMLButtonElement | null = null;
    if (started) {
      fresh = h('button', { class: 'g-btn-text' }, 'Start a new notebook') as HTMLButtonElement;
      fresh.onclick = () => go(true);
    }
    el.append(
      h(
        'div',
        { class: 'poster' },
        h('div', { class: 'poster-band', lang: 'he', dir: 'rtl' }, 'מכונת הזמן של תל אביב'),
        h('h1', {}, h('span', {}, 'Tel Aviv'), h('span', {}, 'Time Machine')),
        h('p', { class: 'poster-sub' }, 'Walk its streets from 1909 to today. Notice how the city was built, and keep a notebook of what you find.'),
        h(
          'div',
          { class: 'poster-ticket current' },
          h('div', { class: 'pt-stub' }, h('small', {}, 'Found'), h('b', {}, String(n))),
          h(
            'div',
            { class: 'pt-body' },
            h('b', {}, 'Field notebook'),
            h('small', {}, 'Architecture · urbanism · culture'),
            h('i', { class: 'pt-status' }, started ? `${n} / ${total} noticed` : 'Nothing is marked. What you notice is yours.'),
            h('div', { class: 'g-actions' }, begin, fresh),
          ),
        ),
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

  /** Back to the title poster. */
  private toTitle() {
    this.exit();
    document.body.classList.remove('mode-free');
    this.showTitle(document.body);
  }

  get titleOpen() {
    return !!this.titleEl?.isConnected;
  }

  /** A new, empty notebook. */
  private reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* private mode */
    }
    this.state = loadState();
    this.queue = [];
    this.lastYear = undefined;
  }

  /** Enter the game (from the title or from free mode). */
  enter(resume = true) {
    const { rig } = this.w;
    // Photo plates are rendered at load from the title screen. A page opened on a
    // #year= link skips the title, so render them now, before they are needed.
    if (this.photos.size === 0) this.preparePhotos();
    this.fullscreen();
    this.active = true;
    document.body.classList.add('mode-game');
    document.body.classList.remove('mode-free');
    this.ui.show(true);
    rig.lockStreet = true;
    const where = resume ? this.state.where : undefined;
    this.w.jumpTo(where?.year ?? START.year);
    if (where) rig.teleport(where.x, where.z, where.yaw, undefined, where.h);
    else rig.teleport(START.pose.x, START.pose.z, START.pose.yaw, START.pose.pitch);
    this.mini.invalidate();
    this.renderHud();
    if (!this.state.seen.has('intro')) this.intro();
  }

  /** Leave the game for the classic free timeline. */
  exit() {
    this.save();
    this.active = false;
    this.closePhoto();
    this.closeMap();
    this.ui.closeModal();
    this.ui.setNotice(undefined);
    this.ui.show(false);
    this.w.rig.lockStreet = false;
    this.w.rig.inputEnabled = true;
    document.body.classList.remove('mode-game');
    document.body.classList.add('mode-free');
  }

  private intro() {
    this.state.seen.add('intro');
    this.save();
    this.ui.showCard({
      kicker: 'Rothschild Boulevard · today',
      title: 'Notice what changed',
      gist: 'In 1909 this boulevard was a sand dune. Walk the city in seven different years: nothing here is marked, and what you notice yourself goes into your notebook.',
      aside: {
        title: 'Your notebook',
        text: 'Architecture, urbanism and culture. Each page says what to look for, never where. Old photographs turn up when you notice what is in them; then find where each was taken.',
      },
      actions: [{ label: 'Next', primary: true, run: () => this.howToPlay() }],
    });
  }

  private howToPlay() {
    this.ui.showHowTo(matchMedia('(pointer: coarse)').matches, () => this.ui.closeModal());
  }

  /** The year the player stands in (not the one they peek into). */
  private get year() {
    return this.lens.kind === 'peek' ? this.lens.base : Math.floor(this.w.time.year);
  }

  private save() {
    const c = this.w.camera.position;
    this.state.where = { year: this.year, x: c.x, z: c.z, yaw: this.w.rig.yaw, h: Math.round(this.w.rig.lift * 10) / 10 };
    write(SAVE_KEY, this.state.toJSON());
  }

  // ------------------------------------------------------------------ HUD

  private renderHud() {
    const s = this.state;
    const [n, total] = s.count();
    const latest = s.latest;
    this.ui.renderTag({ kicker: `Notebook · ${n} / ${total}`, text: latest ? latest.title.en : 'Look closely. Slip between years.' });
    const y = this.year;
    this.ui.renderYear(y, this.lens.kind === 'peek' ? this.lens.year : undefined);
    const tip = !s.seen.has('travel') ? 'Tap a year to travel' : !s.seen.has('peek') ? 'Hold a year to peek' : undefined;
    this.ui.renderCompass(
      YEARS.map((year) => ({ year, locked: false })),
      y,
      tip,
    );
    const pocket = s.pocket;
    const p = pocket && photoOf(pocket);
    this.ui.setPostcard(p ? this.photos.get(p.id)?.card : undefined);
  }

  // ------------------------------------------------------------------ the notebook

  private notebook(tab: SectionId = this.tab) {
    this.closeMap();
    this.tab = tab;
    const s = this.state;
    const sectionCount = (id: SectionId) =>
      COLLECTIONS.filter((c) => c.section === id).reduce(
        (acc, c) => {
          const [f, t] = s.count(c.id);
          return [acc[0] + f, acc[1] + t];
        },
        [0, 0],
      );
    const spec: NotebookSpec = {
      sections: SECTIONS.map((sec) => {
        const [found, total] = sectionCount(sec.id);
        return { id: sec.id, title: sec.title, found, total };
      }),
      total: s.count(),
      collections: COLLECTIONS.filter((c) => c.section === tab).map((c) => {
        const [found, total] = s.count(c.id);
        return {
          title: c.title.en,
          intro: c.intro.en,
          start: c.start?.en,
          found,
          total,
          entries: DISCOVERIES.filter((d) => d.collection === c.id).map((d) => {
            const f = s.found.get(d.id);
            const p = photoOf(d);
            const plate = p && this.photos.get(p.id);
            if (!f) {
              const hidden = d.trigger.kind === 'photo' && !s.photos.has(d.id);
              const riddle = d.trigger.kind === 'photo' && hidden ? d.trigger.clue.en : d.riddle.en;
              return { id: d.id, title: d.title.en, found: false, riddle, nudge: s.nudged.has(d.id) ? d.nudge.en : undefined, photo: hidden ? undefined : plate?.card };
            }
            const st = streetAt(f.x, f.z, f.year);
            return {
              id: d.id,
              title: d.title.en,
              found: true,
              gist: d.gist.en,
              text: d.text.en,
              where: `Noticed in ${f.year}${st ? ` · ${st.name.en}` : ''}`,
              sources: p ? [p.reference, ...d.sources] : d.sources,
              photo: plate?.real ? plate.card : undefined,
              eye: f.eye,
            };
          }),
        };
      }),
      stamps: tab === 'architecture' ? Object.entries(STYLE_INFO).map(([id, v]) => ({ name: v!.name.en, got: s.stamps.has(id) })) : undefined,
      landmarks: tab === 'culture' ? { names: LANDMARKS.filter((l) => s.landmarks.has(l.id)).map((l) => l.name?.en ?? l.id), total: LANDMARKS.length } : undefined,
    };
    this.ui.showNotebook(spec, tab, {
      tab: (t) => this.notebook(t as SectionId),
      nudge: (id) => {
        this.state.nudged.add(id);
        this.save();
        this.sfx.tick();
        this.notebook();
        if (this.state.byId(id)?.area) {
          this.mini.el.classList.remove('ping');
          void this.mini.el.offsetWidth;
          this.mini.el.classList.add('ping');
        }
      },
      hold: (id) => this.holdUp(id),
      close: () => this.ui.closeModal(),
    });
  }

  // ------------------------------------------------------------------ discovering

  /** Records a discovery and shows its card (after any card already open). */
  private discover(d: Discovery, extra: Partial<Found> = {}) {
    const c = this.w.camera.position;
    if (!this.state.discover(d.id, { year: this.year, x: Math.round(c.x), z: Math.round(c.z), ...extra })) return;
    this.notice = undefined;
    this.ui.setNotice(undefined);
    this.save();
    this.renderHud();
    this.sfx.chime(true);
    this.queue.push(d);
    if (!this.ui.modalOpen && !this.holding) this.showNext();
  }

  private showNext() {
    const d = this.queue.shift();
    if (!d) return;
    const col = COLLECTIONS.find((c) => c.id === d.collection)!;
    const sec = SECTIONS.find((x) => x.id === col.section)!;
    const [k, n] = this.state.count(col.id);
    const f = this.state.found.get(d.id)!;
    const p = photoOf(d);
    const plate = p && this.photos.get(p.id);
    this.ui.showCard({
      kicker: `${sec.title} · ${col.title.en} · ${k} / ${n}`,
      title: d.title.en,
      gist: d.gist.en,
      image: plate?.real ? plate.card : undefined,
      credit: plate?.real ? p?.archive?.credit.en : undefined,
      aside: this.state.firstIn(col.id) ? { title: `A new page: ${col.title.en}`, text: col.intro.en } : undefined,
      more: { text: d.text.en, facts: d.facts?.map((x) => x.en), sources: p ? [p.reference, ...d.sources] : d.sources },
      confidence: d.confidence,
      ticket: { label: f.eye ? 'By eye, in' : 'Noticed in', value: String(f.year) },
      actions: [
        {
          label: 'Continue',
          primary: true,
          run: () => {
            this.ui.closeModal();
            this.showNext();
          },
        },
        {
          label: 'Open the notebook',
          run: () => {
            this.ui.closeModal();
            this.queue = [];
            this.notebook(sec.id);
          },
        },
      ],
    });
  }

  /** What noticing finds for this discovery: its own trigger, or for a photograph still to turn up, its subject. */
  private noticeBy(d: Discovery): Trigger {
    return d.trigger.kind === 'photo' && !this.state.photos.has(d.id) ? d.trigger.find : d.trigger;
  }

  /** The first undiscovered look (or photograph subject) that this view of a building makes. */
  private lookAt(hit: LookHit, year: number): Discovery | undefined {
    const c = this.w.camera.position;
    return this.state.missing.find((d) => {
      const t = this.noticeBy(d);
      return t.kind === 'look' && lookFinds(t, hit, c.x, c.z, year);
    });
  }

  /** The first undiscovered discovery (or photograph subject) about this prop, if it is close enough. */
  private poiFinds(poi: Poi, dist: number): Discovery | undefined {
    return this.state.missing.find((d) => {
      const t = this.noticeBy(d);
      return t.kind === 'poi' && t.poi === poi.id && dist <= t.maxDist && this.inter.present(poi.id);
    });
  }

  /** Something was noticed: a discovery, or the subject of a photograph that now turns up. */
  private noticed(d: Discovery) {
    if (d.trigger.kind === 'photo' && !this.state.photos.has(d.id)) this.turnUp(d);
    else this.discover(d);
  }

  /** A photograph of what was just noticed turns up: it joins the notebook, ready to hold up. */
  private turnUp(d: Discovery) {
    if (d.trigger.kind !== 'photo' || !this.state.findPhoto(d.id)) return;
    this.notice = undefined;
    this.ui.setNotice(undefined);
    this.save();
    this.renderHud();
    this.sfx.chime();
    const plate = this.photos.get(d.trigger.photo.id);
    const card = () =>
      this.ui.showCard({
        kind: 'postcard',
        kicker: 'An old photograph turns up',
        title: d.trigger.kind === 'photo' ? d.trigger.photo.caption.en : d.title.en,
        gist: `${d.riddle.en} Stand where the photographer stood, in the right year, and it lines up.`,
        image: plate?.card,
        aside: { title: 'Clipped into your notebook', text: 'Hold it up any time with the photograph button (P), or from the notebook.' },
        actions: [
          { label: 'Hold it up', primary: true, run: () => this.holdUp(d.id) },
          { label: 'Later', run: () => (this.ui.closeModal(), this.showNext()) },
        ],
      });
    if (this.ui.modalOpen || this.holding) this.ui.toast('An old photograph turned up: it is in your notebook.');
    else card();
  }

  /** After a peek or a slip from `base` into `other`: did comparing the two years here find anything? */
  private compare(base: number, other: number) {
    const c = this.w.camera.position;
    for (const d of this.state.missing)
      if (d.trigger.kind === 'compare' && compareFinds(d.trigger, c.x, c.z, base, other, () => this.w.buildings.sites)) this.discover(d);
  }

  /**
   * Noticing: what rests in the centre of the view fills a ring; hold the look and it is
   * noticed. Only things not yet in the notebook, close enough and in their years count.
   */
  private updateNotice(dt: number) {
    const free = this.lens.kind === 'idle' && !this.ui.modalOpen && !this.full.open && !this.holding;
    if (!free) {
      this.notice = undefined;
      this.ui.setNotice(undefined);
      return;
    }
    this.noticeClock += dt;
    if (this.noticeClock < NOTICE_EVERY) return;
    const step = this.noticeClock;
    this.noticeClock = 0;
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.w.camera);
    this.ray.far = 80;
    const year = Math.floor(this.w.time.year);
    const poi = this.inter.pick(this.ray);
    const site = this.w.buildings.pick(this.ray);
    let d: Discovery | undefined;
    if (poi && (!site || poi.distance <= site.distance)) d = this.poiFinds(poi.poi, poi.distance);
    else if (site && !site.object.userData.ghost) d = this.lookAt({ site: site.site, point: site.point }, year);
    this.ray.far = Infinity;
    if (!d) {
      this.notice = undefined;
      this.ui.setNotice(undefined);
      return;
    }
    this.notice = this.notice?.id === d.id ? { id: d.id, t: this.notice.t + step } : { id: d.id, t: 0 };
    const t = this.notice.t;
    this.ui.setNotice(t < 0.2 ? undefined : clamp((t - 0.2) / (NOTICE_HOLD - 0.2), 0, 1));
    if (t >= NOTICE_HOLD) this.noticed(d);
  }

  // ------------------------------------------------------------------ map

  private yearLayer(): YearLayer {
    const y = this.year;
    if (!this.layer || this.layer.year !== y) this.layer = yearLayer(y, this.w.buildings.sites);
    return this.layer;
  }

  private mapOverlay(): MapOverlay {
    const s = this.state;
    const c = this.w.camera.position;
    return {
      player: { x: c.x, z: c.z, yaw: this.w.rig.yaw },
      trail: s.trail,
      pins: LANDMARKS.filter((l) => s.landmarks.has(l.id)).map((l) => ({ x: l.x, z: l.z, label: l.name?.en ?? '' })),
      stamps: [...s.found.values()].map((f, i) => ({ x: f.x, z: f.z, n: i + 1 })),
      hints: s.missing.flatMap((d) => (s.nudged.has(d.id) && d.area ? [hintArea(d.area, d.id, d.area.r)] : [])),
    };
  }

  private openMap() {
    if (!this.active || this.holding || this.lens.kind !== 'idle') return;
    this.ui.closeModal();
    const c = this.w.camera.position;
    const st = streetAt(c.x, c.z, this.year);
    this.full.show(this.yearLayer(), this.mapOverlay(), st ? `You are on ${st.name.en}` : 'You are here');
    this.sfx.tick();
  }

  private closeMap() {
    if (this.full.open) this.full.hide();
  }

  // ------------------------------------------------------------------ time lens

  /** Slip to another year with an expanding lens. */
  travel(year: number) {
    const from = Math.floor(this.w.time.year);
    if (this.lens.kind !== 'idle' || year === from) return;
    this.closePhoto();
    this.closeMap();
    this.lastYear = from;
    this.w.post.wipe.capture();
    this.lens = { kind: 'travel-capture', year, from };
    this.sfx.whoosh(year > from);
    this.state.seen.add('travel');
  }

  /** Look into another year through a small lens, without leaving. */
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
      this.lens = { kind: 'travel', t: 0, from: L.from, to: L.year };
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
        this.compare(L.from, L.to);
      }
    } else if (L.kind === 'peek-capture' && !wipe.capturing) {
      this.w.jumpTo(L.year);
      this.lens = { kind: 'peek', t: 0, base: L.base, year: L.year, closing: false };
      wipe.radius = 0.001;
      this.renderHud();
      this.compare(L.base, L.year);
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

  // ------------------------------------------------------------------ rephotography
  //
  // No meter: you line the photo up by eye. Camera-style corner brackets appear when the
  // view is roughly right and lock when it matches. Three optional aids, one at a time:
  // the photo's outlines, match points, then plain directions.

  /** The photograph button: put the photo away, hold up the only one, or choose among several. */
  private togglePhoto() {
    if (this.holding) return this.closePhoto();
    const left = this.state.photosLeft;
    if (left.length > 1 && this.lens.kind === 'idle') {
      this.closeMap();
      return this.ui.showCard({
        kind: 'sheet',
        kicker: `Photographs to place · ${left.length}`,
        title: 'Which one now?',
        gist: 'Pick a photograph, then stand where it was taken.',
        choices: left.flatMap((d) => {
          const p = photoOf(d);
          const plate = p && this.photos.get(p.id);
          return p && plate ? [{ image: plate.card, label: p.caption.en, run: () => this.holdUp(d.id) }] : [];
        }),
        actions: [{ label: 'Not now', run: () => this.ui.closeModal() }],
      });
    }
    this.holdPocket();
  }

  /** Puts this photograph in the pocket and holds it up. */
  private holdUp(id: string) {
    this.state.photo = id;
    this.save();
    this.ui.closeModal();
    this.renderHud();
    this.holdPocket();
  }

  private holdPocket() {
    if (this.holding) return;
    const disc = this.state.pocket;
    if (!disc || disc.trigger.kind !== 'photo' || this.lens.kind !== 'idle') return;
    const photo = disc.trigger.photo;
    const plate = this.photos.get(photo.id);
    if (!plate) return;
    this.closeMap();
    this.ui.closeModal();
    this.holding = { disc, photo, years: disc.trigger.years, held: 0, aid: 0, focus: 'none' };
    this.ui.showPhoto({ src: plate.overlay, tracing: plate.tracing, caption: `${photo.caption.en} · line it up by eye` });
    this.sfx.tick();
  }

  private closePhoto() {
    if (!this.holding) return;
    this.holding = undefined;
    this.unframeView();
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
    // a photo lines up only in the years when the place looked like it (the 1909 crowd)
    const rightYear = inYears(Math.floor(this.w.time.year), H.years);
    // a helping hand: nearly lined up and holding still, the view settles into the photographer's spot
    const pose = H.photo.pose;
    const before = alignment(pose, { x: camera.position.x, z: camera.position.z, yaw: rig.yaw, pitch: rig.pitch, height: rig.lift });
    H.settling = rightYear && settles(before) && rig.idleFor > SETTLE_AFTER;
    if (H.settling) rig.ease({ x: pose.x, z: pose.z, yaw: pose.yaw, pitch: pose.pitch, lift: pose.height ?? EYE }, 1 - Math.exp(-SETTLE_RATE * dt));
    const view = { x: camera.position.x, z: camera.position.z, yaw: rig.yaw, pitch: rig.pitch, height: rig.lift };
    const a = alignment(pose, view);
    const matched = a.matched && rightYear;
    const focus = matched ? 'lock' : a.near ? 'near' : 'none';
    if (focus !== 'none' && H.focus === 'none') this.sfx.focus();
    H.focus = focus;

    // the camera is cropped to the print: inside it, the world is framed exactly as the photo
    const plate = this.photos.get(H.photo.id)!;
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const rect = containRect(W, Hh, plate.ratio);
    this.frameView(plate.frame, rect, W, Hh);
    camera.updateMatrixWorld();

    let marks;
    if (H.aid >= 2) {
      marks = H.photo.marks.map((m, i) => {
        this.v.set(m.x, this.w.ground(m.x, m.z) + m.y, m.z).project(camera);
        const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.4 && Math.abs(this.v.y) < 1.4;
        return { px: rect.x + plate.marks[i].u * rect.w, py: rect.y + plate.marks[i].v * rect.h, lx: (this.v.x * 0.5 + 0.5) * W, ly: (-this.v.y * 0.5 + 0.5) * Hh, visible };
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
      } else if (a.heightErr > MATCH.height) advice = (H.photo.pose.height ?? 1.7) > rig.lift ? 'The photographer stood higher up: rise (R, or ▲).' : 'Come down a little (F, or ▼).';
      else if (a.yawErr > MATCH.yaw) advice = wrapAngle(H.photo.pose.yaw - view.yaw) > 0 ? 'Turn a little left.' : 'Turn a little right.';
      else if (a.pitchErr > MATCH.pitch) advice = H.photo.pose.pitch > view.pitch ? 'Look up a little.' : 'Look down a little.';
      else advice = 'Hold still…';
    }
    if (H.settling && !a.matched) advice = 'Almost: hold still…';
    if (a.near && !rightYear) {
      const stop = YEARS.find((y) => inYears(y, H.years));
      advice = `This is the spot, but it doesn’t look like this in ${Math.floor(this.w.time.year)}.${stop ? ` Try ${stop}.` : ''}`;
    }
    this.ui.renderPhoto({ focus, aid: H.aid, marks, advice, rect });

    H.held = matched ? H.held + dt : 0;
    if (H.held > 0.7) {
      const { disc, aid } = H;
      this.sfx.shutter();
      this.ui.root.classList.add('flash');
      window.setTimeout(() => this.ui.root.classList.remove('flash'), 500);
      this.closePhoto();
      this.discover(disc, aid === 0 ? { eye: true } : {});
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
    if (poi && (!site || poi.distance <= site.distance)) {
      this.examinePoi(poi.poi, poi.distance);
      return true;
    }
    if (site && !site.object.userData.ghost) {
      this.examineSite(site.site, site.point);
      return true;
    }
    return false;
  }

  private examinePoi(poi: Poi, dist: number) {
    const d = this.poiFinds(poi, dist);
    if (d) return this.noticed(d);
    if (
      dist > 30 &&
      this.state.missing.some((x) => {
        const t = this.noticeBy(x);
        return t.kind === 'poi' && t.poi === poi.id;
      })
    )
      return this.ui.toast('Too far away — walk closer.');
    this.ui.toast(poi.label.en);
  }

  private examineSite(site: BuildingSite, point: { x: number; z: number }) {
    const year = Math.floor(this.w.time.year);
    const d = this.lookAt({ site, point }, year);
    if (d) return this.noticed(d);
    const phase = phaseAt(site, year);
    if (!phase) return;
    const c = this.w.camera.position;
    // distance to the footprint edge, roughly
    const dist = Math.max(0, Math.hypot(c.x - site.x, c.z - site.z) - Math.min(site.width, site.depth) / 2);
    if (site.landmark && site.info) {
      if (dist > 140) return this.ui.toast(`${site.name?.en ?? 'A landmark'} — walk closer.`);
      const isNew = this.state.collect('landmarks', site.id);
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
    if (!style) return site.info ? this.ui.toast(split(site.info.summary.en)[0]) : undefined;
    if (dist > 60) return this.ui.toast('Too far to make out the details — walk closer.');
    const isNew = this.state.collect('stamps', phase.style);
    if (!isNew) return this.ui.toast(`${style.name.en} · built ${phase.from}`);
    this.sfx.chime();
    this.save();
    const [gist, rest] = split(style.text.en);
    this.ui.showCard({
      kicker: `Style ${this.state.stamps.size} / ${Object.keys(STYLE_INFO).length}`,
      title: style.name.en,
      gist,
      more: { text: rest, facts: style.look.map((l) => `Look for: ${l}`), sources: style.sources },
      confidence: 'documented',
      ticket: { label: style.period, value: String(phase.from) },
      actions: [{ label: 'Continue', primary: true, run: () => this.ui.closeModal() }],
    });
  }

  /** Collision for the walking camera, at an eye height above the ground. */
  blocked(x: number, z: number, eye = 0): boolean {
    return this.w.buildings.blockedAt(x, z, 0.35, eye);
  }

  // ------------------------------------------------------------------ menus

  private menu() {
    this.closeMap();
    const sound = this.w.audio.enabled;
    let armed = false;
    this.ui.showMenu([
      { label: 'Resume', icon: 'play', run: () => this.ui.closeModal() },
      { label: 'Notebook', icon: 'journal', run: () => this.notebook() },
      { label: 'Map', icon: 'map', run: () => this.openMap() },
      { label: sound ? 'Sound: on' : 'Sound: off', icon: sound ? 'sound' : 'mute', run: () => void this.toggleSound().then(() => this.menu()) },
      ...(document.fullscreenEnabled
        ? [{ label: this.fullscreenPref() ? 'Full screen: on' : 'Full screen: off', icon: 'fullscreen' as const, run: () => this.toggleFullscreen() }]
        : []),
      {
        label: `Picture: ${QUALITY_NAMES[this.w.quality.get()]}`,
        icon: 'photo',
        run: () => {
          const q = this.w.quality.get();
          this.w.quality.set(TIERS[(TIERS.indexOf(q) + 1) % TIERS.length]);
          this.menu();
        },
      },
      { label: 'How to play', icon: 'help', run: () => this.howToPlay() },
      { label: 'Title screen', icon: 'restart', run: () => this.toTitle() },
      {
        label: 'Free explore · timeline',
        icon: 'free',
        run: () => {
          this.exit();
          this.onFreeMode?.(true);
        },
      },
      {
        label: 'Start a new notebook',
        icon: 'restart',
        danger: true,
        run: () => {
          if (!armed) {
            armed = true;
            const el = document.querySelector('.g-menu-item.danger span');
            if (el) el.textContent = 'Tap again: this clears your notebook';
            return;
          }
          this.ui.closeModal();
          this.reset();
          this.enter(false);
        },
      },
    ]);
  }

  // ------------------------------------------------------------------ full screen
  // On by default on touch devices. Browsers allow it only inside a tap, so it is requested
  // when the player taps Begin / Continue, and from the menu toggle.

  private fullscreenPref(): boolean {
    const v = read<boolean>(FULLSCREEN_KEY);
    return v ?? matchMedia('(pointer: coarse)').matches;
  }

  private fullscreen() {
    if (!this.fullscreenPref() || !document.fullscreenEnabled || document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  }

  private toggleFullscreen() {
    const on = !this.fullscreenPref();
    write(FULLSCREEN_KEY, on);
    if (on) this.fullscreen();
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    this.menu();
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
      // the Esc that frees a captured mouse does nothing else
      if (this.w.rig.escFreedMouse) return;
      if (this.full.open) this.closeMap();
      else if (this.ui.modalOpen) this.ui.closeModal();
      else if (this.holding) this.closePhoto();
      else this.menu();
      return;
    }
    if (e.code === 'KeyM') return this.full.open ? this.closeMap() : this.openMap();
    if (e.code === 'KeyJ') return this.ui.modalOpen ? this.ui.closeModal() : this.notebook();
    if (this.ui.modalOpen || this.full.open) return;
    if (e.code === 'KeyP') this.togglePhoto();
    else if (e.code === 'KeyH') this.aid();
    else if (e.code === 'KeyE') this.tap(window.innerWidth / 2, window.innerHeight / 2);
    else if (e.code === 'KeyQ') {
      const cur = Math.floor(this.w.time.year);
      const target = this.lastYear !== undefined && this.lastYear !== cur ? this.lastYear : YEARS.find((y) => y !== cur);
      if (target !== undefined) {
        this.keyPeek = true;
        this.peek(target);
      }
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const y = YEARS[Number(e.code.slice(5)) - 1];
      if (y !== undefined) this.travel(y);
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, t: number) {
    // nothing in the world is marked: props never sparkle
    this.inter.wanted.clear();
    this.inter.update(t, this.w.camera.position);
    if (!this.active) return;
    this.updateLens(dt);
    this.updatePhoto(dt);
    this.updateNotice(dt);
    const c = this.w.camera.position;
    if (this.lens.kind === 'idle') this.state.walk(c.x, c.z);
    this.ui.setStreet(streetAt(c.x, c.z, this.year));
    if (!this.full.open) this.mini.draw(this.yearLayer(), this.mapOverlay());
    if (this.queue.length && !this.ui.modalOpen && !this.holding && this.lens.kind === 'idle') this.showNext();
    this.saveTimer += dt;
    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      this.save();
    }
  }
}
