import { hashString } from '../core/math';
import { coastX, JAFFA, NEVE_TZEDEK, RAILWAY, RAILWAY_YEARS } from '../data/geography';
import { halfWidth, STREETS } from '../data/streets';
import type { BuildingSite, Street } from '../data/types';
import { phaseAt } from '../world/fabric';

/**
 * What the map shows for a given year. Pure data (no canvas), so it is unit-testable.
 * The map is always the map *of the current year*: travelling in time redraws it.
 */

export interface Footprint {
  x: number;
  z: number;
  /** Half extents. */
  hw: number;
  hd: number;
  rot: number;
  /** Landmark id, if the site is a landmark. */
  landmark?: string;
}

export interface MapStreet {
  street: Street;
  /** Still a sand track (opened but not yet paved). */
  unpaved: boolean;
}

export interface YearLayer {
  year: number;
  /** "survey" = a hand-inked pre-state map; "modern" = a clean city map. */
  style: 'survey' | 'modern';
  streets: MapStreet[];
  footprints: Footprint[];
  railway: boolean;
  places: { x: number; z: number; label: string }[];
  /** Coastline as [x, z] points from north to south. */
  coast: [number, number][];
}

export const MAP_BOUNDS = { minX: -2300, maxX: 1600, minZ: -1600, maxZ: 1600 };

/** Builds the map layer of a year from the scene's sites. */
export function yearLayer(year: number, sites: BuildingSite[]): YearLayer {
  const y = Math.floor(year);
  const footprints: Footprint[] = [];
  for (const s of sites) {
    const p = phaseAt(s, y);
    if (!p || p.style === 'tent') continue;
    footprints.push({ x: s.x, z: s.z, hw: (p.width ?? s.width) / 2, hd: (p.depth ?? s.depth) / 2, rot: s.rot, landmark: s.landmark ? s.id : undefined });
  }
  const coast: [number, number][] = [];
  for (let z = MAP_BOUNDS.minZ; z <= MAP_BOUNDS.maxZ; z += 50) coast.push([coastX(z), z]);
  return {
    year: y,
    style: y < 1948 ? 'survey' : 'modern',
    streets: STREETS.filter((s) => s.opened <= y).map((street) => ({ street, unpaved: y < street.paved })),
    footprints,
    railway: y >= RAILWAY_YEARS.from && y <= RAILWAY_YEARS.to,
    places: [
      { x: JAFFA.x, z: JAFFA.z, label: 'Jaffa' },
      { x: NEVE_TZEDEK.x, z: NEVE_TZEDEK.z, label: 'Neve Tzedek' },
    ],
    coast,
  };
}

export { RAILWAY };

/** Distance from a point to a polyline. */
export function distToPolyline(x: number, z: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** The street the player is standing on (or right beside), if any, in a year. */
export function streetAt(x: number, z: number, year: number, margin = 12): Street | undefined {
  let best: Street | undefined;
  let bestD = Infinity;
  for (const st of STREETS) {
    if (st.opened > year) continue;
    const d = distToPolyline(x, z, st.points) - halfWidth(st) - st.sidewalk;
    if (d < margin && d < bestD) {
      best = st;
      bestD = d;
    }
  }
  return best;
}

/**
 * The "search area" a hint draws on the map: a circle that contains the target but is not
 * centred on it (otherwise the circle would give the exact spot away).
 */
export function hintArea(target: { x: number; z: number }, seed: string, r = 70): { x: number; z: number; r: number } {
  const h = hashString(seed);
  const a = ((h % 360) * Math.PI) / 180;
  const off = r * (0.25 + ((h >>> 9) % 100) / 400); // 0.25 … 0.5 of the radius
  return { x: target.x + Math.cos(a) * off, z: target.z + Math.sin(a) * off, r };
}
