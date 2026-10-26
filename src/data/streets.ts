import { bearingDir } from '../core/geo';
import type { Street } from './types';

/**
 * Approximate street layout of the Ahuzat Bayit core (Herzl / Rothschild / Ahad Ha'am /
 * Lilienblum / Yehuda HaLevi / Nahalat Binyamin / Allenby).
 *
 * Geometry is hand-sketched from modern maps: orientations and spacing are close,
 * exact kerb lines are not. Milestone 2 replaces this with OSM / municipal GIS
 * centrelines converted through core/geo.ts `toLocal`.
 */
function path(start: [number, number], ...legs: [bearing: number, length: number][]): [number, number][] {
  const pts: [number, number][] = [start];
  let [x, z] = start;
  for (const [b, len] of legs) {
    const [dx, dz] = bearingDir(b);
    x += dx * len;
    z += dz * len;
    pts.push([x, z]);
  }
  return pts;
}

/** Bearing of the Rothschild-parallel streets in the old core. */
export const GRID_BEARING = 62;

export const STREETS: Street[] = [
  {
    id: 'herzl',
    name: { en: 'Herzl St', he: 'רחוב הרצל' },
    points: path([42, 470], [355, 610]),
    width: 16,
    sidewalk: 3,
    opened: 1909,
    paved: 1925,
    fabric: { from: 10, to: 600, firstBuild: 1910, frontage: 20 },
  },
  {
    id: 'rothschild',
    name: { en: 'Rothschild Blvd', he: 'שדרות רוטשילד' },
    points: path([0, 0], [GRID_BEARING, 420], [38, 640]),
    width: 30,
    sidewalk: 3.5,
    promenade: 14,
    opened: 1909,
    paved: 1927,
    fabric: { from: 22, to: 1050, firstBuild: 1910, frontage: 24 },
  },
  {
    id: 'ahad-haam',
    name: { en: "Ahad Ha'am St", he: 'רחוב אחד העם' },
    points: path([-70, -96], [GRID_BEARING, 980]),
    width: 14,
    sidewalk: 2.5,
    opened: 1910,
    paved: 1926,
    fabric: { from: 90, to: 950, firstBuild: 1911, frontage: 20 },
  },
  {
    id: 'lilienblum',
    name: { en: 'Lilienblum St', he: 'רחוב לילינבלום' },
    points: path([-60, 124], [GRID_BEARING, 640]),
    width: 13,
    sidewalk: 2.5,
    opened: 1910,
    paved: 1926,
    fabric: { from: 20, to: 620, firstBuild: 1910, frontage: 20 },
  },
  {
    id: 'yehuda-halevi',
    name: { en: 'Yehuda HaLevi St', he: 'רחוב יהודה הלוי' },
    points: path([-40, 214], [GRID_BEARING, 900]),
    width: 14,
    sidewalk: 2.5,
    opened: 1911,
    paved: 1928,
    fabric: { from: 20, to: 880, firstBuild: 1912, frontage: 20 },
  },
  {
    id: 'nahalat-binyamin',
    name: { en: 'Nahalat Binyamin St', he: 'רחוב נחלת בנימין' },
    points: path([215, 380], [355, 590]),
    width: 13,
    sidewalk: 2.5,
    opened: 1911,
    paved: 1926,
    fabric: { from: 20, to: 580, firstBuild: 1912, frontage: 20 },
  },
  {
    id: 'allenby',
    name: { en: 'Allenby St', he: 'רחוב אלנבי' },
    points: path([520, 260], [330, 1300]),
    width: 18,
    sidewalk: 3,
    opened: 1918,
    paved: 1925,
    fabric: { from: 20, to: 1250, firstBuild: 1920, frontage: 22 },
  },
];

export function streetById(id: string): Street {
  const s = STREETS.find((st) => st.id === id);
  if (!s) throw new Error(`Unknown street ${id}`);
  return s;
}

export interface StreetFrame {
  x: number;
  z: number;
  /** unit direction of travel */
  dx: number;
  dz: number;
}

export function streetLength(st: Street): number {
  let len = 0;
  for (let i = 1; i < st.points.length; i++) {
    len += Math.hypot(st.points[i][0] - st.points[i - 1][0], st.points[i][1] - st.points[i - 1][1]);
  }
  return len;
}

/** Point + direction at arc length `s` along the street polyline. */
export function frameAt(st: Street, s: number): StreetFrame {
  let rem = Math.max(0, s);
  for (let i = 1; i < st.points.length; i++) {
    const [x0, z0] = st.points[i - 1];
    const [x1, z1] = st.points[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (rem <= seg || i === st.points.length - 1) {
      const t = Math.min(rem / seg, 1);
      return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, dx: (x1 - x0) / seg, dz: (z1 - z0) / seg };
    }
    rem -= seg;
  }
  const p = st.points[0];
  return { x: p[0], z: p[1], dx: 1, dz: 0 };
}

export type Side = 'L' | 'R';

/** Outward normal (from street centre towards the given side). */
export function sideNormal(f: StreetFrame, side: Side): [number, number] {
  return side === 'L' ? [f.dz, -f.dx] : [-f.dz, f.dx];
}

/** Total half-width from centreline to the back of the sidewalk. */
export function halfWidth(st: Street): number {
  return st.width / 2 + (st.promenade ?? 0) / 2;
}

/**
 * Place a building of the given depth fronting a street.
 * Returns centre + rotation such that local +z faces the street.
 */
export function placeOnStreet(streetId: string, s: number, side: Side, depth: number, setback = 3) {
  const st = streetById(streetId);
  const f = frameAt(st, s);
  const [nx, nz] = sideNormal(f, side);
  const off = halfWidth(st) + setback + depth / 2;
  return { x: f.x + nx * off, z: f.z + nz * off, rot: Math.atan2(-nx, -nz) };
}
