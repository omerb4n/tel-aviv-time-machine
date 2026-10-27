import { eraAt } from '../data/eras';
import type { Confidence, Localized, SourceRef } from '../data/types';
import { h } from '../ui/dom';
import type { GameState } from './GameState';
import type { Lead } from './types';

const BADGE: Record<Confidence, string> = {
  documented: 'Documented',
  approximate: 'Approximate',
  illustrative: 'Illustrative',
};

export interface CardSpec {
  kicker: string;
  title: string;
  text: string;
  image?: string;
  facts?: string[];
  sources?: SourceRef[];
  confidence?: Confidence;
  /** e.g. "Year anchored: 1962" */
  reward?: string;
  actions: { label: string; primary?: boolean; run: () => void }[];
}

const icon = (path: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = path;
  return svg;
};

const ICONS = {
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM9 3v18" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8h4M12 11h4" stroke="currentColor" stroke-width="1.6"/>',
  photo: '<rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 6l1.5-2h5L16 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" fill="none"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  examine: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
};

/** All DOM for the exploration game. Game.ts decides what to show; this only renders. */
export class GameUI {
  readonly root: HTMLElement;
  readonly objective: HTMLElement;
  readonly compass: HTMLElement;
  readonly buttons: HTMLElement;
  readonly marker: HTMLElement;
  readonly overlay: HTMLElement;
  readonly overlayImg: HTMLImageElement;
  readonly meter: HTMLElement;
  readonly prompt: HTMLElement;
  /** Big contextual button shown when the current lead's target is in reach. */
  readonly examineBtn: HTMLButtonElement;
  readonly card: HTMLElement;
  readonly toastEl: HTMLElement;
  readonly controlsHint: HTMLElement;
  readonly yearLabel: HTMLElement;
  btnJournal!: HTMLButtonElement;
  btnPhoto!: HTMLButtonElement;
  btnSound!: HTMLButtonElement;
  btnMenu!: HTMLButtonElement;
  private toastTimer = 0;

  onHint?: () => void;
  /** Tap on a compass year. */
  onTravel?: (year: number) => void;
  /** Press-and-hold on a compass year. */
  onPeek?: (year: number, on: boolean) => void;

  constructor(parent: HTMLElement) {
    this.root = h('div', { id: 'game', class: 'hidden' });
    this.objective = h('section', { class: 'g-objective glass' });
    this.yearLabel = h('div', { class: 'g-year' });
    this.compass = h('nav', { class: 'g-compass glass', 'aria-label': 'Time compass' });
    this.buttons = h('div', { class: 'g-buttons' });
    this.marker = h('div', { class: 'g-marker hidden' }, h('span', {}, ''));
    this.overlayImg = h('img', { alt: '' });
    this.meter = h('div', { class: 'g-meter glass' });
    this.overlay = h('div', { class: 'g-photo hidden' }, this.overlayImg, this.meter);
    this.prompt = h('div', { class: 'g-prompt hidden' });
    this.examineBtn = h('button', { class: 'g-examine hidden' }) as HTMLButtonElement;
    this.card = h('div', { class: 'g-modal hidden', role: 'dialog' });
    this.toastEl = h('div', { class: 'g-toast glass hidden', 'aria-live': 'polite' });
    this.controlsHint = h('div', { class: 'g-controls glass hidden' });
    this.root.append(this.overlay, this.objective, this.yearLabel, this.buttons, this.marker, this.prompt, this.examineBtn, this.compass, this.toastEl, this.controlsHint, this.card);
    parent.append(this.root);

    const btn = (cls: string, title: string, ic: string, label: string) => {
      const b = h('button', { class: `g-btn ${cls}`, title, 'aria-label': title }) as HTMLButtonElement;
      b.append(icon(ic), h('span', {}, label));
      this.buttons.append(b);
      return b;
    };
    this.btnPhoto = btn('photo', 'Hold up the photo (P)', ICONS.photo, 'Photo');
    this.btnJournal = btn('journal', 'Journal (J)', ICONS.journal, 'Journal');
    this.btnSound = btn('sound', 'Sound (M)', ICONS.sound, 'Sound');
    this.btnMenu = btn('menu', 'Menu', ICONS.menu, 'Menu');
  }

  show(on: boolean) {
    this.root.classList.toggle('hidden', !on);
  }

  // ------------------------------------------------------------------ HUD
  renderObjective(state: GameState, lead: Lead | undefined, hintTier: number) {
    const def = state.def;
    const steps = def.leads.map((l) => h('i', { class: state.done.has(l.id) ? 'on' : l === lead ? 'now' : '' }));
    const hintBtn = h('button', { class: 'g-hint-btn', title: 'Hint (H)' }) as HTMLButtonElement;
    hintBtn.append(icon(ICONS.hint), h('span', {}, hintTier < 0 ? 'Hint' : 'More help'));
    hintBtn.onclick = () => this.onHint?.();
    let body: (Node | string)[];
    if (lead) {
      body = [h('h3', {}, lead.title.en), h('p', {}, lead.text.en)];
      if (hintTier >= 0) body.push(h('p', { class: 'g-hint' }, lead.hints[Math.min(hintTier, lead.hints.length - 1)].en));
      if (hintTier < lead.hints.length - 1) body.push(hintBtn);
    } else if (state.readyToSolve) body = [h('h3', {}, 'Solve the case'), h('p', {}, 'You have every clue. Open your journal and answer the question.')];
    else body = [h('h3', {}, 'Case closed'), h('p', {}, 'Free travel is unlocked. Wander through any year, or open the menu for the classic timeline.')];
    this.objective.replaceChildren(
      h('div', { class: 'g-kicker' }, `Case ${def.number} · ${def.title.en}`),
      ...body,
      h('div', { class: 'g-steps' }, ...steps),
    );
  }

  renderYear(year: number, peeking?: number) {
    const y = peeking ?? year;
    const era = eraAt(y);
    this.yearLabel.classList.toggle('peeking', peeking !== undefined);
    this.yearLabel.replaceChildren(
      h('div', { class: 'g-year-num' }, String(y)),
      h('div', { class: 'g-year-era' }, peeking !== undefined ? `Peeking · ${era.title.en}` : era.title.en),
    );
  }

  private compassKey = '';

  renderCompass(slots: { year: number; locked: boolean }[], current: number, free: boolean) {
    // Re-rendering would drop a chip that is being held for a peek, so only rebuild on change.
    const key = JSON.stringify([slots, current, free]);
    if (key === this.compassKey) return;
    this.compassKey = key;
    const chips: HTMLElement[] = [];
    for (const s of slots) {
      if (s.locked) {
        chips.push(h('span', { class: 'g-chip locked', title: 'Find a clue to anchor this year' }, '????'));
        continue;
      }
      const c = h('button', { class: `g-chip${s.year === current ? ' now' : ''}` }, String(s.year)) as HTMLButtonElement;
      let timer = 0;
      let peeking = false;
      c.onpointerdown = (e) => {
        if (s.year === current) return;
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        timer = window.setTimeout(() => {
          peeking = true;
          c.classList.add('peek');
          this.onPeek?.(s.year, true);
        }, 280);
      };
      const up = () => {
        window.clearTimeout(timer);
        if (peeking) {
          peeking = false;
          c.classList.remove('peek');
          this.onPeek?.(s.year, false);
        } else if (s.year !== current) this.onTravel?.(s.year);
      };
      c.onpointerup = up;
      c.onpointercancel = () => {
        window.clearTimeout(timer);
        if (peeking) {
          peeking = false;
          this.onPeek?.(s.year, false);
        }
      };
      c.oncontextmenu = (e) => e.preventDefault();
      chips.push(c);
    }
    const help = h('div', { class: 'g-compass-help' }, free ? 'Free travel: tap a year or open the timeline' : 'Tap a year to travel · hold to peek');
    this.compass.replaceChildren(h('div', { class: 'g-chips' }, ...chips), help);
  }

  // ------------------------------------------------------------------ messages
  toast(text: string, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  setPrompt(text: string | undefined) {
    this.prompt.classList.toggle('hidden', !text);
    if (text) this.prompt.textContent = text;
  }

  /** Show the Examine button with a label, or hide it (undefined). */
  setExamine(label: string | undefined) {
    this.examineBtn.classList.toggle('hidden', !label);
    if (label && this.examineBtn.dataset.label !== label) {
      this.examineBtn.dataset.label = label;
      this.examineBtn.replaceChildren(icon(ICONS.examine), h('span', {}, label));
    }
  }

  get modalOpen() {
    return !this.card.classList.contains('hidden');
  }

  closeModal() {
    this.card.classList.add('hidden');
    this.card.replaceChildren();
  }

  showCard(spec: CardSpec) {
    const box = h('div', { class: 'g-card glass' });
    box.append(h('div', { class: 'g-kicker' }, spec.kicker), h('h2', {}, spec.title));
    if (spec.reward) box.append(h('div', { class: 'g-reward' }, spec.reward));
    if (spec.image) box.append(h('img', { class: 'g-card-img', src: spec.image, alt: spec.title }));
    box.append(h('p', {}, spec.text));
    if (spec.facts?.length) box.append(h('ul', {}, ...spec.facts.map((f) => h('li', {}, f))));
    const meta: Node[] = [];
    if (spec.confidence) meta.push(h('span', { class: `badge ${spec.confidence}` }, BADGE[spec.confidence]));
    for (const s of spec.sources ?? []) meta.push(h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label));
    if (meta.length) box.append(h('div', { class: 'g-sources' }, ...meta));
    const actions = h('div', { class: 'g-actions' });
    for (const a of spec.actions) {
      const b = h('button', { class: `btn${a.primary ? '' : ' ghost'}` }, a.label) as HTMLButtonElement;
      b.onclick = () => a.run();
      actions.append(b);
    }
    box.append(actions);
    this.card.replaceChildren(box);
    this.card.classList.remove('hidden');
    (actions.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  showDeduction(question: Localized, options: { text: Localized; correct?: boolean; feedback: Localized }[], done: () => void) {
    const box = h('div', { class: 'g-card glass' });
    const fb = h('p', { class: 'g-feedback' });
    box.append(h('div', { class: 'g-kicker' }, 'Solve the case'), h('h2', {}, question.en));
    const list = h('div', { class: 'g-options' });
    for (const o of options) {
      const b = h('button', { class: 'g-option' }, o.text.en) as HTMLButtonElement;
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
    this.card.replaceChildren(box);
    this.card.classList.remove('hidden');
  }

  showJournal(state: GameState, extra: { landmarkNames: Map<string, string>; landmarkTotal: number; styleNames: [string, string][] }, close: () => void) {
    const def = state.def;
    const box = h('div', { class: 'g-card g-journal glass' });
    const x = h('button', { class: 'close', 'aria-label': 'Close' }, '×') as HTMLButtonElement;
    x.onclick = close;
    box.append(x, h('div', { class: 'g-kicker' }, `Field journal · Case ${def.number}`), h('h2', {}, def.title.en));
    // leads & clues
    const leads = h('ol', { class: 'g-leads' });
    for (const l of def.leads) {
      if (state.done.has(l.id)) leads.append(h('li', { class: 'done' }, h('b', {}, l.clue.title.en), h('p', {}, l.clue.text.en)));
      else if (l.requires.every((r) => state.done.has(r))) leads.append(h('li', { class: 'open' }, h('b', {}, l.title.en), h('p', {}, l.text.en)));
      else leads.append(h('li', { class: 'locked' }, h('b', {}, '? ? ?')));
    }
    box.append(h('h3', {}, 'Clues'), leads);
    if (state.solved) box.append(h('p', { class: 'g-solved' }, '✔ Case closed'));
    // years
    box.append(
      h('h3', {}, 'Anchored years'),
      h('div', { class: 'g-chips' }, ...state.compass.map((s) => h('span', { class: `g-chip static${s.locked ? ' locked' : ''}` }, s.locked ? '????' : String(s.year)))),
    );
    // field notes
    const notes = h('div', { class: 'g-grid' });
    for (const n of def.notes) {
      const got = state.notes.has(n.id);
      notes.append(h('div', { class: `g-tile${got ? ' got' : ''}` }, h('b', {}, got ? n.title.en : 'Undiscovered'), got ? h('small', {}, n.text.en) : null));
    }
    box.append(h('h3', {}, `Field notes · ${state.notes.size}/${def.notes.length}`), notes);
    // stamps
    const stamps = h('div', { class: 'g-grid stamps' });
    for (const [id, name] of extra.styleNames) {
      const got = state.stamps.has(id);
      stamps.append(h('div', { class: `g-tile stamp${got ? ' got' : ''}` }, h('b', {}, got ? name : '?')));
    }
    box.append(h('h3', {}, `Style stamps · ${state.stamps.size}/${extra.styleNames.length}`), h('p', { class: 'g-small' }, 'Tap ordinary buildings up close to identify their architectural style.'), stamps);
    // landmarks
    const lm = [...state.landmarks].map((id) => extra.landmarkNames.get(id) ?? id);
    box.append(
      h('h3', {}, `Landmarks · ${state.landmarks.size}/${extra.landmarkTotal}`),
      h('p', { class: 'g-small' }, lm.length ? lm.join(' · ') : 'Tap famous buildings to record them.'),
    );
    if (state.readyToSolve) {
      const b = h('button', { class: 'btn' }, 'Solve the case') as HTMLButtonElement;
      b.onclick = () => this.onSolve?.();
      box.append(h('div', { class: 'g-actions' }, b));
    }
    this.card.replaceChildren(box);
    this.card.classList.remove('hidden');
  }

  onSolve?: () => void;

  /** Rephotography overlay. `ratio` = photo width / height. */
  showPhoto(src: string | undefined, ratio = 4 / 3) {
    this.overlay.classList.toggle('hidden', !src);
    if (!src) return;
    this.overlayImg.src = src;
    this.overlayImg.style.width = `calc(100vh * ${ratio})`;
  }

  renderMeter(score: number, advice: string, matched: boolean) {
    const pct = Math.round(score * 100);
    this.meter.classList.toggle('ok', matched);
    this.meter.replaceChildren(
      h('div', { class: 'g-meter-label' }, matched ? 'Hold still…' : `Line up the view · ${pct}%`),
      h('div', { class: 'g-meter-bar' }, h('i', { style: `width:${pct}%` })),
      h('small', {}, advice),
    );
  }

  /** Places the on-screen marker for the final hint tier (or hides it). */
  placeMarker(sx: number | undefined, sy = 0, label = '', behind = false) {
    if (sx === undefined) {
      this.marker.classList.add('hidden');
      return;
    }
    this.marker.classList.remove('hidden');
    this.marker.classList.toggle('edge', behind);
    this.marker.style.transform = `translate(${sx}px, ${sy}px)`;
    (this.marker.firstChild as HTMLElement).textContent = label;
  }
}
