import { interpKeys, smoothstep } from '../core/math';
import { settledMask } from './geography';

/**
 * A simple growth model: the urbanised area is a disc whose centre drifts north
 * and whose radius grows over time. It drives where dunes flatten into streets
 * and when procedural buildings first appear. Mirrored in GLSL (world/shaders.ts).
 */
export const DEV_RADIUS: [number, number][] = [
  [1900, 0],
  [1908, 0],
  [1909, 200],
  [1911, 330],
  [1916, 420],
  [1920, 560],
  [1925, 850],
  [1930, 1300],
  [1935, 1800],
  [1945, 2400],
  [1960, 3500],
  [1975, 5000],
];
export const DEV_CX: [number, number][] = [
  [1909, 60],
  [1920, 150],
  [1935, 450],
  [1960, 800],
];
export const DEV_CZ: [number, number][] = [
  [1909, 0],
  [1920, -120],
  [1935, -600],
  [1960, -1100],
];

export function devState(year: number) {
  return { r: interpKeys(DEV_RADIUS, year), cx: interpKeys(DEV_CX, year), cz: interpKeys(DEV_CZ, year) };
}

/** 0 = urbanised, 1 = wild dunes. */
export function devFactor(x: number, z: number, year: number): number {
  const { r, cx, cz } = devState(year);
  const d = Math.hypot(x - cx, z - cz);
  const wild = r <= 0 ? 1 : smoothstep(r * 0.8, r + 150, d);
  return Math.min(wild, 1 - settledMask(x, z));
}

/** First year a location is urbanised enough to build on. */
export function firstBuildYear(x: number, z: number): number {
  for (let y = 1909; y <= 2000; y++) if (devFactor(x, z, y) < 0.25) return y;
  return 2000;
}
