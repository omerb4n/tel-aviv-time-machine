import { MAJOR_EVENTS } from '../data/events';
import type { TimelineEvent } from '../data/types';
import { h } from './dom';

const STOP_SECONDS = 16;

/** A guided, narrated journey through the major moments of the city's history. */
export class Tour {
  private i = 0;
  private t = 0;
  private paused = false;
  active = false;
  onStop?: (e: TimelineEvent) => void;
  onEnd?: () => void;

  constructor(private root: HTMLElement) {}

  start() {
    this.active = true;
    this.go(0);
  }

  stop() {
    this.active = false;
    this.root.classList.add('hidden');
    this.onEnd?.();
  }

  private go(i: number) {
    if (i < 0) i = 0;
    if (i >= MAJOR_EVENTS.length) return this.stop();
    this.i = i;
    this.t = 0;
    const ev = MAJOR_EVENTS[i];
    this.onStop?.(ev);
    this.render(ev);
  }

  private render(ev: TimelineEvent) {
    const prev = h('button', { class: 'btn ghost' }, '‹ Back');
    prev.onclick = () => this.go(this.i - 1);
    const next = h('button', { class: 'btn' }, this.i === MAJOR_EVENTS.length - 1 ? 'Finish' : 'Next ›');
    next.onclick = () => this.go(this.i + 1);
    const pause = h('button', { class: 'btn ghost' }, this.paused ? 'Resume' : 'Pause');
    pause.onclick = () => {
      this.paused = !this.paused;
      pause.textContent = this.paused ? 'Resume' : 'Pause';
    };
    const exit = h('button', { class: 'btn ghost' }, 'Exit tour');
    exit.onclick = () => this.stop();
    const dots = h('div', { class: 'dots' }, ...MAJOR_EVENTS.map((_, k) => h('span', { class: `dot${k === this.i ? ' on' : ''}` })));
    const src = ev.sources?.length ? h('div', { class: 'sources' }, 'Source: ', ...ev.sources.slice(0, 2).flatMap((s, k) => [k ? ' · ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label)])) : null;
    this.root.replaceChildren(
      h('div', { class: 'kicker' }, `Guided tour · ${this.i + 1} / ${MAJOR_EVENTS.length} · ${ev.date ?? ev.year}`),
      h('h4', {}, ev.title.en),
      h('p', {}, ev.text.en),
      src ?? '',
      h('div', { class: 'actions' }, prev, next, pause, exit, dots),
    );
    this.root.classList.remove('hidden');
  }

  update(dt: number) {
    if (!this.active || this.paused) return;
    this.t += dt;
    if (this.t > STOP_SECONDS) this.go(this.i + 1);
  }
}
