import { h } from '../ui/dom';

const STEP_MS = 70;

/**
 * A split-flap ("Solari") board for the year: when the year changes, every digit
 * flips forward through the digits in between, like a station departure board.
 */
export class Flap {
  readonly el: HTMLElement;
  private cells: { el: HTMLElement; digit: string }[] = [];
  private timers: number[] = [];
  private value = '';
  /** Called once per flip step (for a soft click). */
  onStep?: () => void;

  constructor(len = 4) {
    this.el = h('div', { class: 'flap', role: 'img' });
    for (let i = 0; i < len; i++) {
      const el = h('span', { class: 'flap-cell' });
      this.cells.push({ el, digit: '' });
      this.el.append(el);
      this.paint(i, ' ', ' ');
    }
  }

  /** Static halves show `next` on top and `prev` below until the leaves finish. */
  private paint(i: number, next: string, prev: string, animate = false) {
    const half = (cls: string, d: string) => h('span', { class: cls }, h('b', {}, d));
    const el = this.cells[i].el;
    el.replaceChildren(half('t', next), half('b', animate ? prev : next));
    if (animate) {
      const top = half('ft', prev);
      const bot = half('fb', next);
      el.append(top, bot);
      // when the falling leaf lands, the static bottom shows the new digit
      bot.addEventListener('animationend', () => {
        (el.querySelector('.b b') as HTMLElement).textContent = next;
        top.remove();
        bot.remove();
      });
    }
    this.cells[i].digit = next;
  }

  set(text: string, instant = false) {
    if (text === this.value) return;
    this.value = text;
    this.el.setAttribute('aria-label', text);
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let longest = 0;
    text
      .padStart(this.cells.length, ' ')
      .split('')
      .forEach((target, i) => {
        const from = this.cells[i].digit;
        if (from === target) return;
        if (instant || reduce || !/\d/.test(from) || !/\d/.test(target)) return this.paint(i, target, target);
        // flip forward through the digits in between (9 → 0 wraps)
        const steps = (Number(target) - Number(from) + 10) % 10;
        let d = Number(from);
        for (let s = 1; s <= steps; s++) {
          const prev = String(d);
          d = (d + 1) % 10;
          const next = String(d);
          this.timers.push(window.setTimeout(() => this.paint(i, next, prev, true), s * STEP_MS));
        }
        longest = Math.max(longest, steps);
      });
    for (let s = 1; s <= longest; s += 2) this.timers.push(window.setTimeout(() => this.onStep?.(), s * STEP_MS));
  }
}
