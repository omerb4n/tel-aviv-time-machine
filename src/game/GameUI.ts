import { eraAt } from '../data/eras';
import type { Confidence, Localized, SourceRef, Street } from '../data/types';
import { h } from '../ui/dom';
import { Flap } from './Flap';

/**
 * All DOM for the exploration game. Game.ts decides what to show; this only renders.
 *
 * Visual language (docs/UI_DESIGN.md): a time walker's kit made of period objects.
 * A ceramic street sign, a paper objective tag, a split-flap year board, punched
 * tickets for anchored years, typed archive index cards with rubber stamps.
 */

const STAMP: Record<Confidence, string> = {
  documented: 'Documented',
  approximate: 'Approximate',
  illustrative: 'Illustrative',
};

export interface CardSpec {
  /** Typed line at the top, e.g. "Clue 2 / 5". */
  kicker: string;
  title: string;
  /** The one sentence the card says up front. */
  gist: string;
  /** Shown under "More" (full story, facts, sources). */
  more?: { text?: string; facts?: string[]; sources?: SourceRef[] };
  image?: string;
  confidence?: Confidence;
  /** A ticket stapled to the card, e.g. a newly anchored year. */
  ticket?: { label: string; value: string };
  /** Card flavour: an index card (default), a postcard or a plain sheet. */
  kind?: 'index' | 'postcard' | 'sheet';
  actions: { label: string; primary?: boolean; run: () => void }[];
}

export interface TagSpec {
  kicker: string;
  text: string;
  /** Lead steps: 'done' | 'now' | ''. */
  steps: ('done' | 'now' | '')[];
  hint?: string;
  canHint: boolean;
}

export interface CaseFileSpec {
  number: number;
  title: string;
  question: string;
  years: { year: number; locked: boolean }[];
  leads: { state: 'done' | 'now' | 'locked'; title: string; gist?: string; text?: string; hint?: string; year?: number }[];
  solved: boolean;
  readyToSolve: boolean;
  notes: { title: string; text: string; got: boolean }[];
  stamps: { name: string; got: boolean }[];
  landmarks: { names: string[]; total: number };
}

export interface PhotoView {
  /** 'none' while searching, 'near' when the view is roughly right, 'lock' when it matches. */
  focus: 'none' | 'near' | 'lock';
  /** How many aids are on (0 … 3). */
  aid: number;
  /** Match points: photo position and live position, in CSS pixels. */
  marks?: { px: number; py: number; lx: number; ly: number; visible: boolean }[];
  advice?: string;
}

const svg = (path: string, vb = '0 0 24 24') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', vb);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = path;
  return s;
};

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  journal: `<path ${S} d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM9 3v18M12 8h4M12 11h4"/>`,
  menu: `<path ${S} d="M4 7h16M4 12h16M4 17h16"/>`,
  examine: `<circle ${S} stroke-width="2.2" cx="10.5" cy="10.5" r="6"/><path ${S} stroke-width="2.6" d="M15 15l5.5 5.5"/>`,
  walk: `<path ${S} d="M8 4.5c1.6 0 2.3 2 2.3 4.2S9.4 13 8 13s-2.2-2.2-2.2-4.3S6.4 4.5 8 4.5zM6.3 15.2l3.4.3-.4 3.1a1.5 1.5 0 0 1-3-.3zM16 7.5c1.6 0 2.2 2.1 2.2 4.3S17.4 16 16 16s-2.3-2-2.3-4.2.7-4.3 2.3-4.3zM14.3 18.2l3.4-.3.3 2.6a1.5 1.5 0 0 1-3 .4z"/>`,
  ticket: `<path ${S} d="M3 6h18v3.5a2.5 2.5 0 0 0 0 5V18H3v-3.5a2.5 2.5 0 0 0 0-5z"/><path ${S} stroke-dasharray="1.5 2.2" d="M9 6v12"/>`,
  peek: `<circle ${S} cx="12" cy="12" r="8"/><circle ${S} cx="12" cy="12" r="3"/><path ${S} d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>`,
  hint: `<path ${S} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>`,
  map: `<path ${S} d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>`,
  photo: `<rect ${S} x="3" y="6" width="18" height="13" rx="1"/><circle ${S} cx="12" cy="12.5" r="3.4"/><path ${S} d="M8 6l1.5-2h5L16 6"/>`,
  sound: `<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path ${S} d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>`,
  mute: `<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path ${S} d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>`,
  play: `<path fill="currentColor" d="M8 5v14l11-7z"/>`,
  restart: `<path ${S} d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>`,
  free: `<path ${S} d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>`,
  fullscreen: `<path ${S} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  help: `<circle ${S} cx="12" cy="12" r="9"/><path ${S} d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2v.1"/>`,
};

const icon = (name: keyof typeof ICONS) => svg(ICONS[name]);

export class GameUI {
  readonly root: HTMLElement;
  readonly examineBtn: HTMLButtonElement;
  readonly mapSlot: HTMLElement;
  private sign: HTMLElement;
  private tag: HTMLButtonElement;
  private hintBtn: HTMLButtonElement;
  private flap = new Flap();
  private era: HTMLElement;
  private tickets: HTMLElement;
  private tip: HTMLElement;
  private postcard: HTMLButtonElement;
  private prompt: HTMLElement;
  private marker: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private photo: HTMLElement;
  private photoImg: HTMLImageElement;
  private tracing: HTMLImageElement;
  private marks: SVGSVGElement;
  private photoAdvice: HTMLElement;
  private aidBtn: HTMLButtonElement;
  private modal: HTMLElement;
  private signKey = '';
  private compassKey = '';

  onHint?: () => void;
  onCase?: () => void;
  onMenu?: () => void;
  onExamine?: () => void;
  onPostcard?: () => void;
  onAid?: () => void;
  onPhotoClose?: () => void;
  onSolve?: () => void;
  /** Tap on a year ticket. */
  onTravel?: (year: number) => void;
  /** Press-and-hold on a year ticket. */
  onPeek?: (year: number, on: boolean) => void;
  /** Flap clicks. */
  onFlapStep?: () => void;

  constructor(parent: HTMLElement) {
    this.root = h('div', { id: 'game', class: 'hidden' });

    // top left: where am I, what am I doing
    this.sign = h('div', { class: 'g-sign hidden', 'aria-live': 'polite' });
    this.tag = h('button', { class: 'g-tag', 'aria-label': 'Open the case file' }) as HTMLButtonElement;
    this.hintBtn = h('button', { class: 'g-hint', title: 'Hint (H)', 'aria-label': 'Hint' }, '?') as HTMLButtonElement;
    const topLeft = h('div', { class: 'g-tl' }, this.sign, h('div', { class: 'g-tag-row' }, this.tag, this.hintBtn));

    // top right: map and tools
    this.mapSlot = h('div', { class: 'g-map-slot' });
    const journal = h('button', { class: 'g-round', title: 'Case file (J)', 'aria-label': 'Case file' }, icon('journal')) as HTMLButtonElement;
    const menu = h('button', { class: 'g-round', title: 'Menu (Esc)', 'aria-label': 'Menu' }, icon('menu')) as HTMLButtonElement;
    const topRight = h('div', { class: 'g-tr' }, this.mapSlot, h('div', { class: 'g-tools' }, journal, menu));

    // bottom: the year board and tickets
    this.era = h('div', { class: 'g-era' });
    this.tickets = h('div', { class: 'g-tickets', role: 'group', 'aria-label': 'Anchored years' });
    this.tip = h('div', { class: 'g-tip hidden' });
    const bottom = h('div', { class: 'g-bottom' }, this.flap.el, this.era, this.tickets, this.tip);
    this.flap.onStep = () => this.onFlapStep?.();

    this.postcard = h('button', { class: 'g-postcard hidden', title: 'Hold up the postcard (P)', 'aria-label': 'Hold up the postcard' }) as HTMLButtonElement;
    this.examineBtn = h('button', { class: 'g-examine hidden' }) as HTMLButtonElement;
    this.prompt = h('div', { class: 'g-prompt hidden' });
    this.marker = h('div', { class: 'g-marker hidden' }, h('span', {}, ''));
    this.toastEl = h('div', { class: 'g-toast hidden', 'aria-live': 'polite' });

    // the held-up photograph
    this.photoImg = h('img', { class: 'ph-img', alt: '' }) as HTMLImageElement;
    this.tracing = h('img', { class: 'ph-trace hidden', alt: '' }) as HTMLImageElement;
    this.marks = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.marks.classList.add('ph-marks');
    this.photoAdvice = h('div', { class: 'ph-advice hidden' });
    this.aidBtn = h('button', { class: 'g-btn-paper' }) as HTMLButtonElement;
    const away = h('button', { class: 'g-btn-ink' }, 'Put away') as HTMLButtonElement;
    const frame = h('div', { class: 'ph-frame' }, ...['tl', 'tr', 'bl', 'br'].map((c) => h('i', { class: c })));
    this.photo = h(
      'div',
      { class: 'g-photo hidden' },
      this.photoImg,
      this.tracing,
      this.marks,
      frame,
      h('div', { class: 'ph-caption' }),
      this.photoAdvice,
      h('div', { class: 'ph-bar' }, this.aidBtn, away),
    );

    this.modal = h('div', { class: 'g-modal hidden', role: 'dialog' });

    this.root.append(this.photo, topLeft, topRight, this.marker, this.prompt, this.examineBtn, this.postcard, bottom, this.toastEl, this.modal);
    parent.append(this.root);

    this.tag.onclick = () => this.onCase?.();
    this.hintBtn.onclick = () => this.onHint?.();
    journal.onclick = () => this.onCase?.();
    menu.onclick = () => this.onMenu?.();
    this.examineBtn.onclick = () => this.onExamine?.();
    this.postcard.onclick = () => this.onPostcard?.();
    this.aidBtn.onclick = () => this.onAid?.();
    away.onclick = () => this.onPhotoClose?.();
  }

  show(on: boolean) {
    this.root.classList.toggle('hidden', !on);
  }

  // ------------------------------------------------------------------ HUD

  /** The ceramic street sign (Eisenberg's blue tiles). */
  setStreet(st: Street | undefined) {
    const key = st?.id ?? '';
    if (key === this.signKey) return;
    this.signKey = key;
    this.sign.classList.toggle('hidden', !st);
    if (st) this.sign.replaceChildren(h('b', { lang: 'he', dir: 'rtl' }, st.name.he ?? ''), h('span', {}, st.name.en));
  }

  renderTag(t: TagSpec) {
    const dots = h('span', { class: 'dots' }, ...t.steps.map((s) => h('i', { class: s })));
    this.tag.replaceChildren(h('span', { class: 'k' }, h('span', {}, t.kicker), dots), h('span', { class: 'txt' }, t.text), t.hint ? h('span', { class: 'note' }, t.hint) : '');
    this.hintBtn.classList.toggle('hidden', !t.canHint);
  }

  renderYear(year: number, peeking?: number) {
    const y = peeking ?? year;
    this.flap.set(String(y));
    this.root.classList.toggle('peeking', peeking !== undefined);
    this.era.textContent = peeking !== undefined ? `Peeking · ${eraAt(y).title.en}` : eraAt(y).title.en;
  }

  /** Anchored years as tickets; locked years as blank stubs. */
  renderCompass(slots: { year: number; locked: boolean }[], current: number, tip?: string) {
    this.tip.classList.toggle('hidden', !tip);
    if (tip) this.tip.textContent = tip;
    // Re-rendering would drop a ticket that is being held for a peek, so only rebuild on change.
    const key = JSON.stringify([slots, current]);
    if (key === this.compassKey) return;
    this.compassKey = key;
    const els: HTMLElement[] = [];
    for (const s of slots) {
      if (s.locked) {
        els.push(h('span', { class: 'g-ticket locked', 'aria-label': 'Year not found yet' }, '????'));
        continue;
      }
      const now = s.year === current;
      const c = h('button', { class: `g-ticket${now ? ' now' : ''}`, 'aria-label': `${s.year}${now ? ' (you are here)' : ''}` }, String(s.year)) as HTMLButtonElement;
      let timer = 0;
      let peeking = false;
      c.onpointerdown = (e) => {
        if (now) return;
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        timer = window.setTimeout(() => {
          peeking = true;
          c.classList.add('peek');
          this.onPeek?.(s.year, true);
        }, 280);
      };
      c.onpointerup = () => {
        window.clearTimeout(timer);
        if (peeking) {
          peeking = false;
          c.classList.remove('peek');
          this.onPeek?.(s.year, false);
        } else if (!now) this.onTravel?.(s.year);
      };
      c.onpointercancel = () => {
        window.clearTimeout(timer);
        if (peeking) {
          peeking = false;
          this.onPeek?.(s.year, false);
        }
      };
      c.oncontextmenu = (e) => e.preventDefault();
      els.push(c);
    }
    this.tickets.replaceChildren(...els);
  }

  /** The postcard in your pocket (a thumbnail), or nothing. */
  setPostcard(src: string | undefined, pulse = false) {
    this.postcard.classList.toggle('hidden', !src);
    this.postcard.classList.toggle('pulse', pulse);
    if (src && this.postcard.dataset.src !== src) {
      this.postcard.dataset.src = src;
      this.postcard.replaceChildren(h('img', { src, alt: '' }), h('span', {}, 'Hold up'));
    }
  }

  toast(text: string, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  setPrompt(text: string | undefined) {
    this.prompt.classList.toggle('hidden', !text);
    if (text && this.prompt.textContent !== text) this.prompt.textContent = text;
  }

  /** Show the Examine button with a label, or hide it (undefined). */
  setExamine(label: string | undefined) {
    this.examineBtn.classList.toggle('hidden', !label);
    if (label && this.examineBtn.dataset.label !== label) {
      this.examineBtn.dataset.label = label;
      this.examineBtn.replaceChildren(icon('examine'), h('span', {}, label));
    }
  }

  /** Places the on-screen marker for the final hint tier (or hides it). */
  placeMarker(sx: number | undefined, sy = 0, label = '', edge = false) {
    if (sx === undefined) {
      this.marker.classList.add('hidden');
      return;
    }
    this.marker.classList.remove('hidden');
    this.marker.classList.toggle('edge', edge);
    this.marker.style.transform = `translate(${sx}px, ${sy}px)`;
    (this.marker.firstChild as HTMLElement).textContent = label;
  }

  // ------------------------------------------------------------------ rephotography

  /** Hold up a photo (or put it away with undefined). `ratio` = photo width / height. */
  showPhoto(p: { src: string; tracing: string; ratio: number; caption: string } | undefined) {
    this.photo.classList.toggle('hidden', !p);
    this.root.classList.toggle('holding', !!p);
    if (!p) return;
    this.photoImg.src = p.src;
    this.tracing.src = p.tracing;
    for (const el of [this.photoImg, this.tracing]) el.style.width = `calc(100vh * ${p.ratio})`;
    (this.photo.querySelector('.ph-frame') as HTMLElement).style.width = `min(100vw, calc(100vh * ${p.ratio}))`;
    (this.photo.querySelector('.ph-caption') as HTMLElement).textContent = p.caption;
  }

  renderPhoto(v: PhotoView) {
    this.photo.dataset.focus = v.focus;
    this.tracing.classList.toggle('hidden', v.aid < 1);
    const label = v.aid >= 3 ? 'All aids on' : v.aid === 0 ? 'Need an aid?' : `Another aid · ${v.aid}/3`;
    if (this.aidBtn.dataset.label !== label) {
      this.aidBtn.dataset.label = label;
      this.aidBtn.replaceChildren(icon('hint'), h('span', {}, label));
    }
    this.aidBtn.disabled = v.aid >= 3;
    this.photoAdvice.classList.toggle('hidden', !v.advice);
    if (v.advice && this.photoAdvice.textContent !== v.advice) this.photoAdvice.textContent = v.advice;
    const NS = 'http://www.w3.org/2000/svg';
    const nodes: SVGElement[] = [];
    const COLORS = ['#e9b872', '#7fd1c7', '#f08a6c'];
    v.marks?.forEach((m, i) => {
      const c = COLORS[i % COLORS.length];
      const el = (tag: string, attrs: Record<string, string | number>) => {
        const e = document.createElementNS(NS, tag);
        for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val));
        nodes.push(e);
      };
      if (m.visible) {
        el('line', { x1: m.px, y1: m.py, x2: m.lx, y2: m.ly, stroke: c, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
        el('circle', { cx: m.lx, cy: m.ly, r: 13, fill: 'none', stroke: c, 'stroke-width': 3 });
      }
      el('circle', { cx: m.px, cy: m.py, r: 6, fill: c, stroke: '#1d1a15', 'stroke-width': 2 });
    });
    this.marks.replaceChildren(...nodes);
  }

  // ------------------------------------------------------------------ modal cards

  get modalOpen() {
    return !this.modal.classList.contains('hidden');
  }

  closeModal() {
    this.modal.classList.add('hidden');
    this.modal.replaceChildren();
  }

  private open(box: HTMLElement, closable: boolean) {
    this.modal.replaceChildren(box);
    this.modal.classList.remove('hidden');
    this.modal.onclick = closable ? (e) => e.target === this.modal && this.closeModal() : null;
    (box.querySelector('.g-btn-ink, button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  private actions(list: CardSpec['actions']) {
    return h(
      'div',
      { class: 'g-actions' },
      ...list.map((a) => {
        const b = h('button', { class: a.primary ? 'g-btn-ink' : 'g-btn-text' }, a.label) as HTMLButtonElement;
        b.onclick = () => a.run();
        return b;
      }),
    );
  }

  /** An archive index card: one sentence up front, the rest behind "More". */
  showCard(spec: CardSpec) {
    const box = h('article', { class: `g-card ${spec.kind ?? 'index'}` });
    box.append(h('div', { class: 'g-kick' }, spec.kicker));
    if (spec.ticket) box.append(h('div', { class: 'g-staple' }, h('small', {}, spec.ticket.label), h('b', {}, spec.ticket.value)));
    box.append(h('h2', {}, spec.title));
    if (spec.image) box.append(h('img', { class: 'g-card-img', src: spec.image, alt: spec.title }));
    box.append(h('p', { class: 'g-gist' }, spec.gist));
    if (spec.confidence) box.append(h('div', { class: `g-stamp ${spec.confidence}` }, STAMP[spec.confidence]));
    const m = spec.more;
    if (m && (m.text || m.facts?.length || m.sources?.length)) {
      const body = h('div', { class: 'g-more-body' });
      if (m.text) body.append(h('p', {}, m.text));
      if (m.facts?.length) body.append(h('ul', {}, ...m.facts.map((f) => h('li', {}, f))));
      if (m.sources?.length) body.append(h('div', { class: 'g-sources' }, ...m.sources.map((s) => h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label))));
      box.append(h('details', { class: 'g-more' }, h('summary', {}, 'More'), body));
    }
    box.append(this.actions(spec.actions));
    this.open(box, false);
  }

  showDeduction(question: Localized, options: { text: Localized; correct?: boolean; feedback: Localized }[], done: () => void) {
    const box = h('article', { class: 'g-card index' });
    const fb = h('p', { class: 'g-feedback' });
    box.append(h('div', { class: 'g-kick' }, 'Solve the case'), h('h2', {}, question.en));
    const list = h('div', { class: 'g-options' });
    for (const o of options) {
      const b = h('button', { class: 'g-option' }, h('i', {}), h('span', {}, o.text.en)) as HTMLButtonElement;
      b.onclick = () => {
        fb.textContent = o.feedback.en;
        b.classList.add(o.correct ? 'right' : 'wrong');
        if (o.correct) {
          list.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
          window.setTimeout(done, 900);
        }
      };
      list.append(b);
    }
    box.append(list, fb);
    this.open(box, true);
  }

  /**
   * A hands-on draw before a clue: tap each item (a shell) to turn it over and read it.
   * Continue appears once everything is revealed.
   */
  showReveal(prompt: string, look: 'shells' | 'cards', draws: { label: string; value: string; tone: 'light' | 'dark' }[], onFlip: () => void, done: () => void) {
    const box = h('article', { class: 'g-card sheet reveal' });
    const go = h('button', { class: 'g-btn-ink', disabled: '' }, 'Continue') as HTMLButtonElement;
    go.onclick = () => {
      this.closeModal();
      done();
    };
    let left = draws.length;
    const items = draws.map((d) => {
      const b = h('button', { class: `g-shell ${d.tone} ${look}`, 'aria-label': d.label }, h('span', { class: 'shell' }), h('small', {}, d.label), h('b', {}, d.value)) as HTMLButtonElement;
      b.onclick = () => {
        if (b.classList.contains('open')) return;
        b.classList.add('open');
        onFlip();
        if (--left === 0) go.disabled = false;
      };
      return b;
    });
    box.append(h('div', { class: 'g-kick' }, 'Your turn'), h('h2', {}, prompt), h('div', { class: 'g-shells' }, ...items), h('div', { class: 'g-actions' }, go));
    this.open(box, false);
  }

  /** How to play: four pictograms, a few words each. */
  showHowTo(touch: boolean, done: () => void) {
    const tile = (ic: keyof typeof ICONS, title: string, sub: string) => h('div', { class: 'g-how' }, icon(ic), h('b', {}, title), h('small', {}, sub));
    const box = h('article', { class: 'g-card sheet how' });
    const go = h('button', { class: 'g-btn-ink' }, 'Start walking') as HTMLButtonElement;
    go.onclick = done;
    box.append(
      h('div', { class: 'g-kick' }, 'How to play'),
      h(
        'div',
        { class: 'g-how-grid' },
        tile('walk', 'Walk & look', touch ? 'stick to walk · drag to look' : 'W A S D · drag to look'),
        tile('examine', 'Examine', 'what glimmers or is marked'),
        tile('ticket', 'Travel', 'tap a year ticket'),
        tile('peek', 'Peek', 'hold a year ticket'),
      ),
      h('p', { class: 'g-how-foot' }, h('b', { class: 'q' }, '?'), h('span', {}, 'hint'), icon('map'), h('span', {}, 'tap the map to open it')),
      h('div', { class: 'g-actions' }, go),
    );
    this.open(box, false);
  }

  /** A short list of big choices. No paragraphs. */
  showMenu(items: { label: string; icon: keyof typeof ICONS; run: () => void; danger?: boolean }[]) {
    const box = h('nav', { class: 'g-card sheet menu' });
    box.append(
      h('div', { class: 'g-kick' }, 'Menu'),
      ...items.map((it) => {
        const b = h('button', { class: `g-menu-item${it.danger ? ' danger' : ''}` }, icon(it.icon), h('span', {}, it.label)) as HTMLButtonElement;
        b.onclick = () => it.run();
        return b;
      }),
    );
    this.open(box, true);
  }

  /** The case file: the question, the trail of clues, and your finds. */
  showCaseFile(f: CaseFileSpec, tab: 'case' | 'finds', onTab: (t: 'case' | 'finds') => void, close: () => void) {
    const box = h('article', { class: 'g-card folder' });
    const x = h('button', { class: 'g-x', 'aria-label': 'Close' }, '×') as HTMLButtonElement;
    x.onclick = close;
    const tabBtn = (id: 'case' | 'finds', label: string) => {
      const b = h('button', { class: `g-tab${tab === id ? ' on' : ''}` }, label) as HTMLButtonElement;
      b.onclick = () => onTab(id);
      return b;
    };
    box.append(h('div', { class: 'g-tabs' }, tabBtn('case', `Case ${f.number}`), tabBtn('finds', 'Finds')), x);
    const page = h('div', { class: 'g-page' });
    if (tab === 'case') {
      page.append(h('h2', {}, f.title), h('p', { class: 'g-question' }, f.question));
      page.append(h('div', { class: 'g-years' }, ...f.years.map((y) => h('span', { class: `g-ticket static${y.locked ? ' locked' : ''}` }, y.locked ? '????' : String(y.year)))));
      const list = h('ol', { class: 'g-trail' });
      f.leads.forEach((l, i) => {
        if (l.state === 'locked') return list.append(h('li', { class: 'locked' }, h('i', {}, String(i + 1)), h('b', {}, '? ? ?')));
        if (l.state === 'now')
          return list.append(h('li', { class: 'now' }, h('i', {}, String(i + 1)), h('b', {}, l.title), h('p', {}, l.text ?? ''), l.hint ? h('p', { class: 'note' }, l.hint) : ''));
        const more = l.text ? h('details', {}, h('summary', {}, 'More'), h('p', {}, l.text)) : '';
        list.append(h('li', { class: 'done' }, h('i', {}, '✓'), h('b', {}, l.title, l.year ? h('small', {}, ` · ${l.year}`) : ''), h('p', {}, l.gist ?? ''), more));
      });
      page.append(list);
      if (f.solved) page.append(h('div', { class: 'g-stamp documented big' }, 'Case closed'));
      if (f.readyToSolve) {
        const b = h('button', { class: 'g-btn-ink' }, 'Solve the case') as HTMLButtonElement;
        b.onclick = () => this.onSolve?.();
        page.append(h('div', { class: 'g-actions' }, b));
      }
    } else {
      const got = f.notes.filter((n) => n.got).length;
      page.append(
        h('h3', {}, `Field notes · ${got}/${f.notes.length}`),
        h('div', { class: 'g-notes' }, ...f.notes.map((n) => h('div', { class: `g-note${n.got ? ' got' : ''}` }, h('b', {}, n.got ? n.title : '? ? ?'), n.got ? h('small', {}, n.text) : ''))),
        h('h3', {}, `Style stamps · ${f.stamps.filter((s) => s.got).length}/${f.stamps.length}`),
        h('div', { class: 'g-postage' }, ...f.stamps.map((s) => h('div', { class: `g-pstamp${s.got ? ' got' : ''}` }, h('span', {}, s.got ? s.name : '?')))),
        h('p', { class: 'g-small' }, 'Examine ordinary buildings up close to learn their style.'),
        h('h3', {}, `Landmarks · ${f.landmarks.names.length}/${f.landmarks.total}`),
        f.landmarks.names.length ? h('div', { class: 'g-chips' }, ...f.landmarks.names.map((n) => h('span', {}, n))) : h('p', { class: 'g-small' }, 'Examine famous buildings to record them.'),
      );
    }
    box.append(page);
    this.open(box, true);
  }
}
