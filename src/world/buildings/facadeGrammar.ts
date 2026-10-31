import type { BuildingPhase } from '../../data/types';
import type { MatKey } from '../materials';
import type { TileInfo } from '../textures';
import type { PartBounds } from './PartBuilder';

/**
 * The facade grammar: where the slice kit's modules (tools/blender/kits/slice.py) go on a
 * building. Every module frames a window that the facade texture already paints on a wall
 * (textures.ts), so the grammar walks the painted window grid of each dressable wall, the same
 * grid the metre UVs of PartBuilder lay down, and puts a module on every window it can see.
 * A window is skipped where something else stands in front of it or the wall is hidden behind
 * another part (a door, a tower, a balcony front, a rounded corner).
 *
 * Pure: (the parts' bounds, the phase, the painted tiles) → placements in building-local
 * metres. Nothing here changes the footprint, the heights or the picking mesh.
 */

/** The materials kit modules are made of (Blender material names). */
export type KitMat = 'trim' | 'stone' | 'wood' | 'metal';

export interface Placement {
  module: string;
  /** Origin of the module (bottom middle of its window, on the wall plane). */
  x: number;
  y: number;
  z: number;
  /** Turn about +y: 0 faces +z (the street front of a site). */
  rotY: number;
  /** Stretch along the wall (ledges run the length of a facade). */
  sx: number;
  colors: Partial<Record<KitMat, string>>;
}

/** The painted windows of a facade atlas, by textures.ts, and the modules that frame them. */
interface FacadeSpec {
  /** Size of one window tile, metres (the atlas repeats it). */
  tile: [number, number];
  /** The painted window, measured up from the bottom of its tile, and its width. */
  bottom: number;
  top: number;
  /** `window`: one module per painted window; `ribbon`: a ledge along each band, mullions per tile. */
  kind: 'window' | 'ribbon';
  module: (tile: TileInfo | undefined) => string;
  /** How far the module reaches: half its width, from the window's bottom up, out from the wall. */
  clear: { half: number; up: number; out: number };
  colors: (wall: string, tile: TileInfo | undefined) => Partial<Record<KitMat, string>>;
}

export const FACADES: Partial<Record<MatKey, FacadeSpec>> = {
  // Ahuzat Bayit houses: tall shuttered windows; the shutters match the painted ones
  plaster: {
    tile: [3.2, 3.6],
    bottom: 0.85,
    top: 2.6,
    kind: 'window',
    module: (t) => (t?.open === false ? 'ottoman_closed' : 'ottoman_open'),
    clear: { half: 1.08, up: 1.85, out: 0.16 },
    colors: (_w, t) => ({ trim: '#f1eadb', stone: '#d6c9ad', wood: t?.shutter ?? '#4d7766' }),
  },
  arched: {
    tile: [3.0, 3.4],
    bottom: 0.8,
    top: 2.7,
    kind: 'window',
    module: () => 'eclectic_window',
    clear: { half: 0.7, up: 2.0, out: 0.18 },
    colors: () => ({ trim: '#f4ecdc', stone: '#d8cbb0' }),
  },
  bauhaus: {
    tile: [4.0, 3.1],
    bottom: 0.95,
    top: 2.15,
    kind: 'ribbon',
    module: () => 'bauhaus_ledge',
    clear: { half: 2.0, up: 1.4, out: 0.5 },
    colors: (wall) => ({ trim: wall, metal: '#2f3432' }),
  },
  modern: {
    tile: [3.4, 3.2],
    bottom: 0.35,
    top: 2.85,
    kind: 'window',
    module: () => 'modern_frame',
    clear: { half: 1.35, up: 2.5, out: 0.1 },
    colors: () => ({ metal: '#9aa1a6' }),
  },
};

/** Every module the grammar can place (the kit must have them all; tests/kit.test.ts). */
export const MODULES = [
  'ottoman_open',
  'ottoman_closed',
  'eclectic_window',
  'bauhaus_ledge',
  'bauhaus_mullions',
  'modern_frame',
  'gym_portal',
  'iron_railing',
  'picket_fence',
  'pillar_cap',
];

/** Looks up a painted tile: the facade, the tile's column and its row counted up from v = 0. */
export type TileLookup = (mat: MatKey, column: number, row: number) => TileInfo | undefined;

type Vec3 = [number, number, number];
interface Face {
  /** Axis of the outward normal (0 = x, 2 = z) and its sign. */
  axis: 0 | 2;
  sign: 1 | -1;
  /** The plane, the start of the u axis along it, and the run length. */
  plane: number;
  u0: number;
  length: number;
  rotY: number;
}

const EPS = 0.005;
/** An obstacle this thin in front of a wall (a painted band, a door frame) doesn't hide a window. */
const THIN = 0.06;

function faces(b: PartBounds): Face[] {
  const [x0, , z0] = b.min;
  const [x1, , z1] = b.max;
  return [
    { axis: 2, sign: 1, plane: z1, u0: x0, length: x1 - x0, rotY: 0 },
    { axis: 2, sign: -1, plane: z0, u0: x0, length: x1 - x0, rotY: Math.PI },
    { axis: 0, sign: 1, plane: x1, u0: z0, length: z1 - z0, rotY: Math.PI / 2 },
    { axis: 0, sign: -1, plane: x0, u0: z0, length: z1 - z0, rotY: -Math.PI / 2 },
  ];
}

/** A point on a face: `u` along it, height `y`, `out` metres in front of it. */
function onFace(f: Face, u: number, y: number, out = 0): Vec3 {
  const n = f.plane + f.sign * out;
  return f.axis === 2 ? [f.u0 + u, y, n] : [n, y, f.u0 + u];
}

/** The box a module needs in front of a face: `u` from…to along it, y from…to. */
function clearBox(f: Face, ua: number, ub: number, ya: number, yb: number, out: number): { min: Vec3; max: Vec3 } {
  const a = onFace(f, ua, ya, -0.05);
  const b = onFace(f, ub, yb, out);
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  };
}

/** Does any other part hide the wall here or stand in front of it? */
function blocked(f: Face, box: { min: Vec3; max: Vec3 }, parts: PartBounds[], self: PartBounds): boolean {
  for (const o of parts) {
    if (o === self) continue;
    let overlap = true;
    for (let i = 0; i < 3; i++) if (o.min[i] >= box.max[i] - EPS || o.max[i] <= box.min[i] + EPS) overlap = false;
    if (!overlap) continue;
    const front = f.sign > 0 ? o.max[f.axis] - f.plane : f.plane - o.min[f.axis];
    const behind = f.sign > 0 ? f.plane - o.min[f.axis] : o.max[f.axis] - f.plane;
    if (front > THIN || behind > 0.05) return true;
  }
  return false;
}

/** Mixes a colour towards grime as the phase weathers, like `wallColor` in styles.ts. */
function weathered(hex: string, w: number): string {
  const k = Math.min(1, Math.max(0, w)) * 0.5;
  const c = parseInt(hex.slice(1), 16);
  const g = [0x8f, 0x8a, 0x7f];
  const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v, i) => Math.round(v + (g[i] - v) * k));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * The modules for one building phase. `parts` are its PartBuilder bounds, `wall` its painted
 * wall colour (`wallColor`), `tileAt` the painted tiles (textures.ts).
 */
export function dressPhase(phase: BuildingPhase, parts: PartBounds[], wall: string, tileAt: TileLookup, plot?: { w: number; d: number }): Placement[] {
  const out: Placement[] = [];
  const w = phase.weathering ?? 0;
  const tint = (colors: Partial<Record<KitMat, string>>) => {
    const t: Partial<Record<KitMat, string>> = {};
    for (const [k, v] of Object.entries(colors) as [KitMat, string][]) t[k] = k === 'trim' && v === wall ? v : weathered(v, w);
    return t;
  };
  for (const b of parts) {
    const spec = b.box ? FACADES[b.mat] : undefined;
    if (!spec) continue;
    const [tw, th] = spec.tile;
    const rows: number[] = [];
    for (let j = Math.max(0, Math.floor(b.min[1] / th)); (j + 1) * th <= b.max[1] + th; j++) {
      const lo = j * th + spec.bottom;
      const hi = j * th + spec.top;
      if (lo >= b.min[1] + 0.05 && hi <= b.max[1] - 0.1) rows.push(j);
    }
    if (!rows.length) continue;
    for (const f of faces(b)) {
      if (f.length < tw * 0.5) continue;
      const cols = Math.ceil(f.length / tw - 0.01);
      for (const j of rows) {
        const y = j * th + spec.bottom;
        if (spec.kind === 'window') {
          for (let k = 0; k < cols; k++) {
            // a part tile at the end of a wall still shows its window whole if the wall is long enough
            if ((k + 0.5) * tw + spec.clear.half > f.length + 0.01) break;
            const u = (k + 0.5) * tw;
            const tile = tileAt(b.mat, k % 4, j % 4);
            const box = clearBox(f, u - spec.clear.half, u + spec.clear.half, y, y + spec.clear.up, spec.clear.out);
            if (blocked(f, box, parts, b)) continue;
            const [x, , z] = onFace(f, u, y);
            out.push({ module: spec.module(tile), x, y, z, rotY: f.rotY, sx: 1, colors: tint(spec.colors(wall, tile)) });
          }
        } else {
          // ribbon: the ledge runs over every clear stretch of the band, mullions on whole tiles
          let run = -1;
          const flush = (end: number) => {
            if (run < 0) return;
            const [x, , z] = onFace(f, (run + end) / 2, y);
            out.push({ module: spec.module(undefined), x, y, z, rotY: f.rotY, sx: end - run, colors: tint(spec.colors(wall, undefined)) });
            run = -1;
          };
          for (let k = 0; k < cols; k++) {
            const ua = k * tw;
            const ub = Math.min(f.length, (k + 1) * tw);
            const box = clearBox(f, ua, ub, y - 0.05, y + spec.clear.up, spec.clear.out);
            if (blocked(f, box, parts, b)) {
              flush(ua);
              continue;
            }
            if (run < 0) run = ua;
            if (ub - ua > tw - 0.01) {
              const [x, , z] = onFace(f, ua + tw / 2, y);
              out.push({ module: 'bauhaus_mullions', x, y, z, rotY: f.rotY, sx: 1, colors: tint(spec.colors(wall, undefined)) });
            }
          }
          flush(f.length);
        }
      }
    }
  }
  // garden walls (low plastered walls at the plot front) carry a wrought-iron railing
  for (const b of parts) {
    if (!b.box || b.mat !== 'plaster' || b.max[1] > 1.3 || b.max[1] - b.min[1] < 0.5) continue;
    const along = b.max[0] - b.min[0] >= b.max[2] - b.min[2];
    const len = along ? b.max[0] - b.min[0] : b.max[2] - b.min[2];
    if (len < 0.8) continue;
    out.push({
      module: 'iron_railing',
      x: (b.min[0] + b.max[0]) / 2,
      y: b.max[1],
      z: (b.min[2] + b.max[2]) / 2,
      rotY: along ? 0 : Math.PI / 2,
      sx: len - 0.1,
      colors: { metal: '#2c302d' },
    });
  }
  // garden-wall pillars (stone, about 0.5 × 1.5 × 0.5 m) wear a moulded cap
  for (const b of parts) {
    const [w, h, d] = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
    if (!b.box || b.mat !== 'stone' || w > 0.7 || d > 0.7 || h < 1 || h > 2.2 || b.min[1] > 0.1) continue;
    out.push({ module: 'pillar_cap', x: (b.min[0] + b.max[0]) / 2, y: b.max[1], z: (b.min[2] + b.max[2]) / 2, rotY: 0, sx: 1, colors: tint({ trim: '#ece4d2' }) });
  }
  // eclectic houses of the 1920s: a picket fence along the plot front, a gate in the middle
  if (plot && phase.style === 'eclectic' && phase.from < 1935) {
    const z = plot.d / 2 - 0.25;
    const half = plot.w / 2 - 0.3;
    if (half > 2) {
      const len = half - 0.9;
      for (const s of [-1, 1])
        out.push({ module: 'picket_fence', x: s * (0.9 + len / 2), y: 0, z, rotY: 0, sx: len, colors: tint({ wood: '#e9e4d6' }) });
    }
  }
  if (phase.style === 'gymnasium') {
    // the portal round the arched door (styles.ts: door leaf 5 × 6 m, front at z = 10.3)
    out.push({ module: 'gym_portal', x: 0, y: 0.5, z: 10.3, rotY: 0, sx: 1, colors: tint({ trim: '#f5ecd8' }) });
  }
  return out;
}
