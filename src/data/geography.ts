import { clamp, interpKeys, smoothstep } from '../core/math';

/**
 * Coarse physical geography in local metres: coastline, Jaffa hill and
 * pre-1909 settlements. Approximate — good enough for silhouettes and mood.
 */

/** Coastline as x for a given z (points ordered by decreasing z). West of it is sea. */
const COAST: [z: number, x: number][] = [
  [-4000, -150],
  [-2240, -340],
  [-1200, -560],
  [0, -760],
  [250, -1000],
  [700, -1500],
  [1000, -1900],
  [1400, -2050],
  [3000, -2600],
];

export function coastX(z: number): number {
  return interpKeys(COAST, z);
}

/** Positive distance into the sea, negative inland (metres, along x). */
export function seaward(x: number, z: number): number {
  return coastX(z) - x;
}

export const JAFFA = { x: -1680, z: 930, r: 300, height: 28 };
export const NEVE_TZEDEK = { x: -440, z: 290, r: 170 };

/** Old Jaffa railway alignment (1892–1948), approximate. */
export const RAILWAY: [number, number][] = [
  [-812, 420],
  [-560, 440],
  [-300, 470],
  [60, 505],
  [500, 600],
  [1200, 900],
];
export const SEA_LEVEL = -1.2;
export const RAILWAY_YEARS = { from: 1892, to: 1948 };

/** Static terrain height (hills, beach slope, sea floor), independent of the year. */
export function baseHeight(x: number, z: number): number {
  const sw = seaward(x, z);
  let h = -9 * smoothstep(-60, 180, sw);
  const dj = Math.hypot(x - JAFFA.x, z - JAFFA.z);
  h += JAFFA.height * Math.pow(clamp(1 - dj / JAFFA.r, 0, 1), 1.6);
  return h;
}

/** Areas that were already built before Tel Aviv (no dunes there). */
export function settledMask(x: number, z: number): number {
  const dj = Math.hypot(x - JAFFA.x, z - JAFFA.z);
  const dn = Math.hypot(x - NEVE_TZEDEK.x, z - NEVE_TZEDEK.z);
  return Math.max(1 - smoothstep(JAFFA.r * 0.9, JAFFA.r * 1.6, dj), 1 - smoothstep(NEVE_TZEDEK.r, NEVE_TZEDEK.r + 120, dn));
}
