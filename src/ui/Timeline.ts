import { ERAS } from '../data/eras';
import { EVENTS } from '../data/events';
import type { TimelineEvent } from '../data/types';
import type { TimeController } from '../core/TimeController';
import { h } from './dom';

const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const SPEEDS = [1, 2, 5, 10];

/** The time slider: eras band, event markers, decade ticks, play and speed. */
export class Timeline {
  private main: HTMLDivElement;
  private fill: HTMLDivElement;
  private thumb: HTMLDivElement;
  private play: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private eraEls: { el: HTMLDivElement; from: number; to: number }[] = [];
  private tip: HTMLDivElement;
  onEvent?: (e: TimelineEvent) => void;
  onScrub?: () => void;

  constructor(
    root: HTMLElement,
    private time: TimeController,
  ) {
    this.play = h('button', { class: 'tl-play', title: 'Play / pause (Space)', 'aria-label': 'Play' }) as HTMLButtonElement;
    this.play.innerHTML = PLAY;
    this.play.onclick = () => {
      this.time.togglePlay();
      this.render();
    };
    this.speedBtn = h('button', { class: 'tl-speed', title: 'Playback speed (years per second)' }, `${time.speed}×`) as HTMLButtonElement;
    this.speedBtn.onclick = () => {
      const i = (SPEEDS.indexOf(this.time.speed) + 1) % SPEEDS.length;
      this.time.speed = SPEEDS[i];
      this.speedBtn.textContent = `${this.time.speed}×`;
    };

    this.main = h('div', { class: 'tl-main', role: 'slider', 'aria-label': 'Year', tabindex: '0' }) as HTMLDivElement;
    const eras = h('div', { class: 'tl-eras' });
    for (const era of ERAS) {
      const el = h('div', { class: 'tl-era', title: `${era.title.en} (${era.from}–${era.to})` }, era.title.en) as HTMLDivElement;
      el.style.left = `${this.pct(era.from)}%`;
      el.style.width = `${this.pct(era.to + 1) - this.pct(era.from)}%`;
      eras.append(el);
      this.eraEls.push({ el, from: era.from, to: era.to });
    }
    const track = h('div', { class: 'tl-track' });
    this.fill = h('div', { class: 'tl-fill' }) as HTMLDivElement;
    this.thumb = h('div', { class: 'tl-thumb' }) as HTMLDivElement;
    track.append(this.fill, this.thumb);
    const ticks = h('div', { class: 'tl-ticks' });
    for (let y = Math.ceil(time.min / 10) * 10; y <= time.max; y += 10) {
      const t = h('div', { class: 'tl-tick' }, String(y));
      t.style.left = `${this.pct(y)}%`;
      ticks.append(t);
    }
    const events = h('div', { class: 'tl-events' });
    this.tip = h('div', { class: 'tl-ev-tip hidden' }) as HTMLDivElement;
    for (const ev of EVENTS) {
      const b = h('button', { class: `tl-ev${ev.major ? ' major' : ''}`, 'aria-label': `${ev.year}: ${ev.title.en}` });
      b.style.left = `${this.pct(ev.year + (ev.id === 'gymnasium-cornerstone' ? 0.5 : 0))}%`;
      b.addEventListener('pointerenter', () => {
        this.tip.textContent = `${ev.date ?? ev.year} · ${ev.title.en}`;
        this.tip.style.left = b.style.left;
        this.tip.classList.remove('hidden');
      });
      b.addEventListener('pointerleave', () => this.tip.classList.add('hidden'));
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onEvent?.(ev);
      });
      events.append(b);
    }
    this.main.append(eras, events, track, ticks, this.tip);
    root.append(this.play, this.main, this.speedBtn);

    let dragging = false;
    const setFromX = (clientX: number) => {
      const r = this.main.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      this.time.set(Math.round(this.time.min + k * (this.time.max - this.time.min)));
      this.onScrub?.();
    };
    this.main.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.time.playing = false;
      this.main.setPointerCapture(e.pointerId);
      setFromX(e.clientX);
    });
    this.main.addEventListener('pointermove', (e) => dragging && setFromX(e.clientX));
    this.main.addEventListener('pointerup', () => (dragging = false));
    // Scroll through time: wheel over the timeline moves years.
    let acc = 0;
    root.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        const steps = Math.trunc(acc / 40);
        if (steps) {
          acc -= steps * 40;
          this.time.playing = false;
          this.time.step(steps);
          this.onScrub?.();
        }
      },
      { passive: false },
    );
    this.main.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
      if (e.key === 'ArrowLeft') this.time.step(e.shiftKey ? -10 : -1);
      if (e.key === 'ArrowRight') this.time.step(e.shiftKey ? 10 : 1);
    });
  }

  private pct(year: number) {
    return ((year - this.time.min) / (this.time.max - this.time.min)) * 100;
  }

  render() {
    const p = this.pct(this.time.year);
    this.fill.style.width = `${p}%`;
    this.thumb.style.left = `${p}%`;
    this.main.setAttribute('aria-valuenow', String(Math.floor(this.time.year)));
    this.play.innerHTML = this.time.playing ? PAUSE : PLAY;
    const y = Math.floor(this.time.year);
    for (const e of this.eraEls) e.el.classList.toggle('on', y >= e.from && y <= e.to);
  }
}
