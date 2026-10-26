import { hashString, mulberry32 } from '../core/math';
import { firstBuildYear } from '../data/development';
import { JAFFA, NEVE_TZEDEK, RAILWAY, seaward } from '../data/geography';
import { LANDMARKS } from '../data/landmarks';
import { STREETS, frameAt, halfWidth, placeOnStreet, streetById, streetLength, type Side } from '../data/streets';
import type { BuildingPhase, BuildingSite, BuildingStyle, Street } from '../data/types';

/**
 * Procedural "urban fabric": the ordinary buildings between the landmarks.
 * Every parcel gets a deterministic life story — built, weathered, restored,
 * demolished and replaced — following the city's real architectural periods.
 * Hand-authored or GIS-imported sites can replace parcels later.
 */

export const END_YEAR = 2025;

// ---------------------------------------------------------------- geometry utils

export interface Rect {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
}

function axes(r: Rect): [[number, number], [number, number]] {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  return [
    [c, -s],
    [s, c],
  ];
}

function corners(r: Rect): [number, number][] {
  const [ax, az] = axes(r);
  const out: [number, number][] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      out.push([r.x + ax[0] * r.hw * sx + az[0] * r.hd * sz, r.z + ax[1] * r.hw * sx + az[1] * r.hd * sz]);
  return out;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  if (Math.hypot(a.x - b.x, a.z - b.z) > Math.hypot(a.hw, a.hd) + Math.hypot(b.hw, b.hd)) return false;
  const ca = corners(a);
  const cb = corners(b);
  for (const ax of [...axes(a), ...axes(b)]) {
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const [x, z] of ca) {
      const p = x * ax[0] + z * ax[1];
      minA = Math.min(minA, p);
      maxA = Math.max(maxA, p);
    }
    for (const [x, z] of cb) {
      const p = x * ax[0] + z * ax[1];
      minB = Math.min(minB, p);
      maxB = Math.max(maxB, p);
    }
    if (maxA <= minB || maxB <= minA) return false;
  }
  return true;
}

function corridorRects(points: [number, number][], half: number): Rect[] {
  const rects: Rect[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    rects.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: half, hd: len / 2 + half * 0.5, rot: Math.atan2(x1 - x0, z1 - z0) });
  }
  return rects;
}

export function siteRect(s: Pick<BuildingSite, 'x' | 'z' | 'rot' | 'width' | 'depth' | 'phases'>, pad = 0): Rect {
  let w = s.width;
  let d = s.depth;
  for (const p of s.phases) {
    w = Math.max(w, p.width ?? 0);
    d = Math.max(d, p.depth ?? 0);
  }
  return { x: s.x, z: s.z, hw: w / 2 + pad, hd: d / 2 + pad, rot: s.rot };
}

// ---------------------------------------------------------------- life stories

interface ParcelCtx {
  commercial: boolean;
  boulevard: boolean;
}

const PALETTES: Partial<Record<BuildingStyle, string[]>> = {
  'ottoman-house': ['#e9dcc0', '#e3cfa8', '#efe4cc', '#dcc6a0'],
  eclectic: ['#efe2c6', '#ead3b2', '#f0dccb', '#e6dcc0', '#f2e8d2'],
  bauhaus: ['#f4f2ec', '#f1ede2', '#efeee9', '#f3efe4'],
  shikun: ['#e8dfcc', '#e2d9c6', '#ece4d4'],
  brutalist: ['#b4b0a6', '#a9a69e', '#bdb8ac'],
  'modern-residential': ['#f1f0ec', '#e2ddd3', '#d9cfbd', '#ecebe7'],
  'glass-tower': ['#9fb4c4', '#a9bcc6', '#8fa7b8', '#b3c2c9'],
  'jaffa-stone': ['#d7c39b', '#cdb58a', '#dccbaa', '#c9b08a'],
};

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function styleFor(year: number, ctx: ParcelCtx): BuildingStyle {
  if (year < 1915) return 'ottoman-house';
  if (year < 1931) return 'eclectic';
  if (year < 1949) return 'bauhaus';
  if (year < 1966) return 'shikun';
  if (year < 1992) return ctx.commercial ? 'brutalist' : year < 1976 ? 'shikun' : 'modern-residential';
  return 'modern-residential';
}

function floorsFor(style: BuildingStyle, rng: () => number): number {
  switch (style) {
    case 'ottoman-house':
      return rng() < 0.6 ? 1 : 2;
    case 'eclectic':
      return 2 + Math.floor(rng() * 2);
    case 'bauhaus':
      return 3 + Math.floor(rng() * 2);
    case 'shikun':
      return 3 + Math.floor(rng() * 2);
    case 'brutalist':
      return 5 + Math.floor(rng() * 4);
    case 'modern-residential':
      return 6 + Math.floor(rng() * 4);
    default:
      return 2;
  }
}

/** Probability that a building of this style is replaced, and the window when it happens. */
const REPLACEMENT: Partial<Record<BuildingStyle, { p: number; from: number; span: number }>> = {
  'ottoman-house': { p: 0.85, from: 1924, span: 24 },
  eclectic: { p: 0.4, from: 1955, span: 45 },
  bauhaus: { p: 0.12, from: 1965, span: 25 },
  shikun: { p: 0.45, from: 1990, span: 30 },
  brutalist: { p: 0.35, from: 2003, span: 20 },
};

/**
 * Split a building's life into weathering sub-phases: fresh → grimy (with rooftop
 * solar heaters and AC units) → optionally restored after the 2003 UNESCO listing.
 */
function weatherPhases(base: BuildingPhase, end: number, rng: () => number): BuildingPhase[] {
  const s = base.style;
  if (s !== 'bauhaus' && s !== 'eclectic' && s !== 'shikun') return [{ ...base, to: end }];
  const grimeAt = Math.max(base.from + 22, 1962) + Math.floor(rng() * 6);
  if (grimeAt >= end) return [{ ...base, to: end, weathering: 0.1 }];
  const out: BuildingPhase[] = [{ ...base, to: grimeAt - 1, weathering: 0.1 }];
  const restoreP = s === 'bauhaus' ? 0.65 : s === 'eclectic' ? 0.45 : 0.15;
  const restoreAt = 2004 + Math.floor(rng() * 16);
  if (rng() < restoreP && restoreAt < end) {
    out.push({ ...base, from: grimeAt, to: restoreAt - 1, weathering: 0.75 });
    const tama = s !== 'eclectic' && rng() < 0.3;
    out.push({
      ...base,
      from: restoreAt,
      to: end,
      weathering: 0,
      floors: (base.floors ?? 3) + (tama ? 1 : 0),
      note: tama ? { en: 'Restored, with an extra rooftop floor added under the TAMA 38 programme.' } : { en: 'Restored after the 2003 UNESCO listing.' },
    });
  } else {
    out.push({ ...base, from: grimeAt, to: end, weathering: 0.75 });
  }
  return out;
}

export function lifeStory(y0: number, rng: () => number, ctx: ParcelCtx, w: number, d: number): BuildingPhase[] {
  const phases: BuildingPhase[] = [];
  let y = y0;
  let style = styleFor(y, ctx);
  for (let guard = 0; guard < 6 && y <= END_YEAR; guard++) {
    const floors = floorsFor(style, rng);
    const color = pick(rng, PALETTES[style] ?? ['#eeeeee']);
    const rep = REPLACEMENT[style];
    let end = END_YEAR;
    if (rep && rng() < rep.p) end = Math.min(END_YEAR, Math.max(y + 8, rep.from + Math.floor(rng() * rep.span)));
    const base: BuildingPhase = { from: y, style, floors, color };
    if (style === 'glass-tower') {
      base.height = 80 + Math.floor(rng() * 90);
      base.width = w;
      base.depth = d + 3;
    }
    phases.push(...weatherPhases(base, end, rng));
    if (end >= END_YEAR) break;
    y = end + 2; // a year of demolition and construction
    const towerP = ctx.boulevard ? 0.75 : ctx.commercial ? 0.3 : 0.08;
    style = y >= 2003 && rng() < towerP ? 'glass-tower' : styleFor(y, ctx);
  }
  // Clamp: a phase that would start after the end of time is dropped.
  return phases.filter((p) => p.from <= END_YEAR).map((p) => (p.to !== undefined && p.to >= END_YEAR ? { ...p, to: undefined } : p));
}

// ---------------------------------------------------------------- generation

const AHUZAT_CORE = { x: 60, z: 0, r: 270 };

export function generateFabric(): BuildingSite[] {
  const sites: BuildingSite[] = [];
  const obstacles: Rect[] = [];
  for (const st of STREETS) obstacles.push(...corridorRects(st.points, halfWidth(st) + 0.5));
  obstacles.push(...corridorRects(RAILWAY, 5));
  for (const l of LANDMARKS) obstacles.push(siteRect(l, 2));

  const tryAdd = (site: BuildingSite): boolean => {
    let r = siteRect(site, 1.2);
    if (obstacles.some((o) => rectsOverlap(o, r))) {
      // A tower may not fit: fall back to a mid-rise on the original footprint.
      if (!site.phases.some((p) => p.style === 'glass-tower')) return false;
      site.phases = site.phases.map((p) =>
        p.style === 'glass-tower' ? { ...p, style: 'modern-residential', height: undefined, width: undefined, depth: undefined, floors: 8 } : p,
      );
      r = siteRect(site, 1.2);
      if (obstacles.some((o) => rectsOverlap(o, r))) return false;
    }
    if (seaward(site.x, site.z) > -30) return false;
    obstacles.push(siteRect(site, 0));
    sites.push(site);
    return true;
  };

  for (const st of STREETS) streetFabric(st, tryAdd);
  clusterFabric('neve-tzedek', NEVE_TZEDEK.x, NEVE_TZEDEK.z, NEVE_TZEDEK.r, 0.12, 1890, 'ottoman-house', tryAdd);
  clusterFabric('jaffa', JAFFA.x, JAFFA.z, JAFFA.r * 0.95, 0.35, 1850, 'jaffa-stone', tryAdd);
  sites.push(...protestTents());
  return sites;
}

function streetFabric(st: Street, tryAdd: (s: BuildingSite) => boolean) {
  const fab = st.fabric;
  if (!fab) return;
  const len = Math.min(fab.to, streetLength(st));
  const frontage = fab.frontage ?? 20;
  const ctx: ParcelCtx = {
    commercial: st.id === 'rothschild' || st.id === 'allenby' || st.id === 'herzl',
    boulevard: st.id === 'rothschild',
  };
  for (const side of ['L', 'R'] as Side[]) {
    const rng = mulberry32(hashString(`${st.id}:${side}`));
    for (let s = fab.from; s < len; s += frontage) {
      if (rng() < 0.08) continue; // an empty lot or a garden
      const w = frontage - 3 - rng() * 2;
      const d = 12 + rng() * 5;
      const p = placeOnStreet(st.id, s + frontage / 2, side, d, 3.5 + rng() * 2);
      const core = Math.hypot(p.x - AHUZAT_CORE.x, p.z - AHUZAT_CORE.z) < AHUZAT_CORE.r;
      let y0 = Math.max(fab.firstBuild, firstBuildYear(p.x, p.z)) + Math.floor(rng() * 4);
      if (core && y0 <= 1913) y0 = rng() < 0.75 ? 1910 : 1911;
      tryAdd({
        id: `${st.id}-${side}-${Math.round(s)}`,
        ...p,
        width: w,
        depth: d,
        phases: lifeStory(y0, rng, ctx, w, d),
      });
    }
  }
}

function clusterFabric(
  id: string,
  cx: number,
  cz: number,
  radius: number,
  rot: number,
  built: number,
  style: BuildingStyle,
  tryAdd: (s: BuildingSite) => boolean,
) {
  const rng = mulberry32(hashString(id));
  const spacing = style === 'jaffa-stone' ? 13 : 19;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = -radius; i <= radius; i += spacing) {
    for (let j = -radius; j <= radius; j += spacing) {
      if (Math.hypot(i, j) > radius * (0.75 + rng() * 0.3)) continue;
      if (rng() < 0.12) continue;
      const jx = i + (rng() - 0.5) * 4;
      const jz = j + (rng() - 0.5) * 4;
      const w = spacing - 3 - rng() * 3;
      const d = spacing - 3 - rng() * 3;
      const x = cx + jx * c + jz * s;
      const z = cz - jx * s + jz * c;
      const color = pick(rng, PALETTES[style] ?? ['#ddd']);
      const floors = style === 'jaffa-stone' ? 1 + Math.floor(rng() * 3) : rng() < 0.7 ? 1 : 2;
      const phases: BuildingPhase[] =
        style === 'jaffa-stone'
          ? [{ from: built, style, floors, color }]
          : rng() < 0.75
            ? [{ from: built, style, floors, color }]
            : [
                { from: built, to: 1925 + Math.floor(rng() * 10), style, floors, color },
                ...lifeStory(1938 + Math.floor(rng() * 10), rng, { commercial: false, boulevard: false }, w, d),
              ];
      tryAdd({ id: `${id}-${i}-${j}`, x, z, rot: rot + (rng() - 0.5) * 0.12, width: w, depth: d, phases });
    }
  }
}

function protestTents(): BuildingSite[] {
  const st = streetById('rothschild');
  const rng = mulberry32(2011);
  const out: BuildingSite[] = [];
  for (let s = 260; s < 980; s += 9 + rng() * 6) {
    const f = frameAt(st, s);
    const off = (rng() < 0.5 ? -1 : 1) * (2.5 + rng() * 2.5);
    out.push({
      id: `tent-${Math.round(s)}`,
      name: { en: 'Protest tent', he: 'אוהל מחאה' },
      x: f.x + f.dz * off,
      z: f.z - f.dx * off,
      rot: Math.atan2(f.dx, f.dz) + (rng() - 0.5) * 0.8,
      width: 2.6 + rng(),
      depth: 3 + rng(),
      phases: [{ from: 2011, to: 2011, style: 'tent', color: pick(rng, ['#e8e2d0', '#3f6fa8', '#d2553a', '#e0b23c', '#5b8f5a']) }],
      info: {
        summary: { en: 'Summer 2011: hundreds of tents lined Rothschild Boulevard in a protest over the cost of housing.' },
        sources: [{ label: '2011 Israeli housing protests – Wikipedia', url: 'https://en.wikipedia.org/wiki/2011_Israeli_housing_protests' }],
        confidence: 'documented',
      },
    });
  }
  return out;
}

/** Landmarks + fabric: the full list of sites in the scene. */
export function allSites(): BuildingSite[] {
  return [...LANDMARKS, ...generateFabric()];
}

export function phaseAt(site: BuildingSite, year: number): BuildingPhase | undefined {
  const y = Math.floor(year);
  return site.phases.find((p) => y >= p.from && (p.to === undefined || y <= p.to));
}
