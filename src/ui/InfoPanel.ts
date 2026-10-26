import { STYLE_INFO } from '../data/styleInfo';
import type { BuildingPhase, BuildingSite, TimelineEvent } from '../data/types';
import { phaseAt } from '../world/fabric';
import { fmtYears, h } from './dom';

const STYLE_SHORT: Record<string, string> = {
  'ottoman-house': 'Ottoman-era house',
  eclectic: 'Eclectic',
  bauhaus: 'International Style',
  shikun: 'Austerity block',
  brutalist: 'Late-modern concrete',
  'modern-residential': 'Contemporary',
  'glass-tower': 'Glass tower',
  'jaffa-stone': 'Jaffa stone house',
  tent: 'Protest tent',
};

function phaseLabel(p: BuildingPhase): string {
  const raw = STYLE_SHORT[p.style] ?? p.style.replace(/-/g, ' ');
  const base = raw.charAt(0).toUpperCase() + raw.slice(1);
  const w = p.weathering ?? 0;
  const state = w > 0.4 ? ' · weathered' : w === 0 && p.from >= 2004 && (p.style === 'bauhaus' || p.style === 'eclectic') ? ' · restored' : '';
  const size = p.height ? ` · ${Math.round(p.height)} m` : p.floors ? ` · ${p.floors} floor${p.floors > 1 ? 's' : ''}` : '';
  return base + state + size;
}

/** Side panel describing a building (its whole life story) or a historical event. */
export class InfoPanel {
  onJump?: (year: number) => void;
  onClose?: () => void;
  current?: string;

  constructor(private root: HTMLElement) {}

  hide() {
    this.root.classList.add('hidden');
    this.current = undefined;
  }

  private shell(title: string, he?: string) {
    this.root.replaceChildren();
    this.root.classList.remove('hidden');
    const close = h('button', { class: 'close', 'aria-label': 'Close' }, '×');
    close.onclick = () => {
      this.hide();
      this.onClose?.();
    };
    this.root.append(close, h('h2', {}, title));
    if (he) this.root.append(h('div', { class: 'he', lang: 'he', dir: 'rtl' }, he));
  }

  showSite(site: BuildingSite, year: number) {
    this.current = site.id;
    const phase = phaseAt(site, year) ?? site.phases.filter((p) => p.from <= year).pop() ?? site.phases[0];
    const style = STYLE_INFO[phase.style];
    const info = site.info;
    if (site.landmark || info) {
      this.shell(site.name?.en ?? style?.name.en ?? 'Building', site.name?.he);
    } else {
      this.shell(style?.name.en ?? 'Building', style?.name.he);
    }
    const meta: string[] = [];
    if (info?.architect) meta.push(`Architect: ${info.architect}`);
    if (info?.address) meta.push(info.address);
    if (!site.landmark && style) meta.push(`Typical of ${style.period}`);
    const metaEl = h('div', { class: 'meta' });
    const conf = info?.confidence ?? 'illustrative';
    metaEl.append(h('span', { class: `badge ${conf}`, title: confidenceText(conf) }, conf));
    metaEl.append(meta.join(' · '));
    this.root.append(metaEl);

    if (info) this.root.append(h('p', {}, info.summary.en));
    if (!site.landmark && !info) {
      this.root.append(
        h('p', {}, 'An ordinary building in this reconstruction — not a specific historical address. Its life story follows how buildings on this street typically changed.'),
      );
    }
    if (phase.note) this.root.append(h('p', {}, phase.note.en));

    if (site.phases.length > 0 && phase.style !== 'tent') {
      this.root.append(h('h3', {}, 'Life of this site'));
      const list = h('div', { class: 'phases' });
      for (const p of site.phases) {
        const b = h('button', { class: `phase${p === phase ? ' current' : ''}` }, h('span', { class: 'yrs' }, fmtYears(p.from, p.to)), h('span', {}, phaseLabel(p), p.note ? h('small', {}, p.note.en) : null));
        b.onclick = () => this.onJump?.(p.from);
        list.append(b);
      }
      this.root.append(list);
    }

    if (style && phase.style !== 'tent') {
      this.root.append(h('h3', {}, site.landmark ? 'About the style' : 'About this style'));
      this.root.append(h('p', {}, style.text.en));
      this.root.append(h('ul', {}, ...style.look.map((l) => h('li', {}, l))));
    }
    if (info?.facts?.length) {
      this.root.append(h('h3', {}, 'Did you know?'));
      this.root.append(h('ul', {}, ...info.facts.map((f) => h('li', {}, f.en))));
    }
    const sources = [...(info?.sources ?? []), ...(!info ? style?.sources ?? [] : [])];
    if (sources.length) {
      this.root.append(h('h3', {}, 'Sources'));
      this.root.append(h('ul', {}, ...sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label)))));
    }
  }

  showEvent(ev: TimelineEvent) {
    this.current = `event:${ev.id}`;
    this.shell(ev.title.en, ev.title.he);
    const meta = h('div', { class: 'meta' });
    meta.append(h('span', { class: `badge ${ev.confidence}` }, ev.confidence), ev.date ?? String(ev.year));
    this.root.append(meta, h('p', {}, ev.text.en));
    if (ev.sources?.length) {
      this.root.append(h('h3', {}, 'Sources'));
      this.root.append(h('ul', {}, ...ev.sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label)))));
    }
  }
}

export function confidenceText(c: string) {
  return c === 'documented'
    ? 'Dates and facts backed by the cited sources'
    : c === 'approximate'
      ? 'Real place; dates, size or position are approximate'
      : 'Illustrative reconstruction, not a specific historical record';
}
