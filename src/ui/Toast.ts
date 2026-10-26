import type { TimelineEvent } from '../data/types';
import { h } from './dom';

/** A card that pops up when time passes a historical event. */
export class Toast {
  private timer = 0;
  onShow?: (e: TimelineEvent) => void;
  onMore?: (e: TimelineEvent) => void;

  constructor(private root: HTMLElement) {}

  show(ev: TimelineEvent) {
    clearTimeout(this.timer);
    const x = h('button', { class: 'x', 'aria-label': 'Dismiss' }, '×');
    x.onclick = () => this.hide();
    const show = h('button', { class: 'btn' }, 'Take me there');
    show.onclick = () => this.onShow?.(ev);
    const more = h('button', { class: 'btn ghost' }, 'Read more');
    more.onclick = () => this.onMore?.(ev);
    const text = ev.text.en.length > 220 ? ev.text.en.slice(0, ev.text.en.lastIndexOf(' ', 210)) + '…' : ev.text.en;
    this.root.replaceChildren(
      x,
      h('div', { class: 'kicker' }, ev.date ?? String(ev.year)),
      h('h4', {}, ev.title.en),
      h('p', {}, text),
      h('div', { class: 'actions' }, ...(ev.view ? [show] : []), more),
    );
    this.root.classList.remove('hidden');
    this.timer = window.setTimeout(() => this.hide(), 14000);
  }

  hide() {
    this.root.classList.add('hidden');
  }
}
