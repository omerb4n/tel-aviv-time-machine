import * as THREE from 'three';
import type { BuildingPhase, BuildingSite } from '../../data/types';
import type { PartBuilder } from './PartBuilder';

/**
 * Style generators: each turns (site footprint, phase, rng) into parts.
 * Local frame: x across the frontage, +z towards the street, y up from ground.
 */

type Rng = () => number;
interface Ctx {
  pb: PartBuilder;
  w: number;
  d: number;
  floors: number;
  phase: BuildingPhase;
  wall: string;
  rng: Rng;
}

const GRIME = new THREE.Color('#8f8a7f');

export function wallColor(phase: BuildingPhase): string {
  const c = new THREE.Color(phase.color ?? '#eeeeee');
  const w = phase.weathering ?? 0;
  if (w > 0) c.lerp(GRIME, w * 0.5);
  return '#' + c.getHexString();
}

function foundation(c: Ctx, w = c.w, d = c.d, color = '#b9ab8e') {
  c.pb.box('stone', w + 0.3, 3.6, d + 0.3, 0, -3, 0, color);
}

function parapet(c: Ctx, w: number, d: number, y: number, h: number, t: number, color: string, z = 0, mat: 'trim' | 'stone' = 'trim') {
  const { pb } = c;
  pb.box(mat, w, h, t, 0, y, z + d / 2 - t / 2, color);
  pb.box(mat, w, h, t, 0, y, z - d / 2 + t / 2, color);
  pb.box(mat, t, h, d - 2 * t, w / 2 - t / 2, y, z, color);
  pb.box(mat, t, h, d - 2 * t, -w / 2 + t / 2, y, z, color);
}

/** Solar water heaters (dud shemesh), antennas and AC units: the clutter of 1965–2000. */
function roofClutter(c: Ctx, w: number, d: number, y: number, n: number) {
  const { pb, rng } = c;
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * (w - 3);
    const z = (rng() - 0.5) * (d - 3);
    pb.box('dark', 1.0, 0.08, 1.8, x, y + 0.5, z, '#26364a', 0);
    pb.box('metal', 0.1, 0.9, 0.1, x, y, z - 0.8, '#999');
    const tank = new THREE.CylinderGeometry(0.32, 0.32, 1.3, 10);
    tank.rotateZ(Math.PI / 2);
    tank.translate(x, y + 1.25, z + 1.0);
    pb.add('metal', tank, '#d9d9d4', 'keep');
  }
  if (rng() < 0.7) {
    const x = (rng() - 0.5) * w * 0.6;
    pb.box('metal', 0.06, 3.5, 0.06, x, y, (rng() - 0.5) * d * 0.5, '#777');
    pb.box('metal', 1.6, 0.05, 0.05, x, y + 3.2, 0, '#777');
  }
}

function acUnits(c: Ctx, w: number, d: number, y0: number, floors: number, F: number) {
  const { pb, rng } = c;
  for (let f = 0; f < floors; f++) {
    if (rng() < 0.45) continue;
    const side = rng() < 0.5 ? -1 : 1;
    pb.box('metal', 0.25, 0.55, 0.8, side * (w / 2 + 0.12), y0 + f * F + 0.6, (rng() - 0.5) * (d - 3), '#cfcfc9');
  }
}

// ---------------------------------------------------------------- generic fabric

function ottomanHouse(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 3.7;
  const hw = Math.min(c.w - 2, 9 + rng() * 4);
  const hd = Math.min(c.d - 3, 9 + rng() * 2);
  const zc = c.d / 2 - hd / 2 - 3.2;
  const H = c.floors * F;
  foundation(c, hw, hd);
  pb.box('stone', hw + 0.3, 0.7, hd + 0.3, 0, 0, zc, '#cdbf9f');
  pb.box('plaster', hw, H, hd, 0, 0.01, zc, wall);
  pb.box('trim', hw + 0.5, 0.35, hd + 0.5, 0, H - 0.2, zc, '#f3ece0');
  pb.hipRoof('roof', hw + 1.1, hd + 1.1, 2.4 + rng() * 0.8, 0, H + 0.15, zc, '#d0d0d0');
  if (rng() < 0.6) pb.box('stone', 0.6, 1.4, 0.6, hw * 0.25, H + 0.8, zc - hd * 0.15, '#c7b79a'); // chimney
  // front steps and door canopy
  pb.box('stone', 2.4, 0.35, 1.2, 0, 0, zc + hd / 2 + 0.6, '#d6c9ad');
  pb.box('wood', 1.3, 2.3, 0.15, 0, 0.7, zc + hd / 2 + 0.02, '#6b4a33');
  if (c.floors > 1 && rng() < 0.6) {
    pb.box('wood', hw * 0.45, 0.18, 1.3, 0, F, zc + hd / 2 + 0.65, '#7a5638');
    pb.box('metal', hw * 0.45, 0.9, 0.06, 0, F + 0.18, zc + hd / 2 + 1.27, '#2f3a33');
  }
  // garden wall with gate pillars
  const fz = c.d / 2 - 0.15;
  const seg = (c.w - 1.6) / 2;
  pb.box('plaster', seg, 0.9, 0.3, -(seg / 2 + 0.8), 0, fz, wall);
  pb.box('plaster', seg, 0.9, 0.3, seg / 2 + 0.8, 0, fz, wall);
  pb.box('stone', 0.5, 1.5, 0.5, -0.8, 0, fz, '#d2c3a4');
  pb.box('stone', 0.5, 1.5, 0.5, 0.8, 0, fz, '#d2c3a4');
}

function eclectic(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 3.4;
  const bw = c.w - 1;
  const bd = c.d - 2.5;
  const H = c.floors * F;
  const z0 = -1;
  foundation(c, bw, bd);
  pb.box('stone', bw + 0.3, 0.8, bd + 0.3, 0, 0, z0, '#c9b998');
  pb.box('arched', bw, H, bd, 0, 0.01, z0, wall);
  pb.box('trim', bw + 0.6, 0.4, bd + 0.6, 0, H - 0.1, z0, '#f4ecdc');
  pb.box('trim', bw + 0.02, 0.3, 0.06, 0, H - 0.9, z0 + bd / 2 + 0.02, ['#3f73a8', '#3d8a7c', '#b0553a'][Math.floor(rng() * 3)]);
  parapet(c, bw + 0.4, bd + 0.4, H + 0.3, 0.9, 0.3, '#f1e8d6', z0);
  for (const x of [-bw / 2, 0, bw / 2]) pb.box('trim', 0.6, 1.5, 0.6, x, H + 0.3, z0 + bd / 2, '#f4ecdc');
  for (let f = 1; f < c.floors; f++) {
    pb.box('trim', bw * 0.4, 0.2, 1.2, 0, f * F, z0 + bd / 2 + 0.6, '#efe6d5');
    pb.box('metal', bw * 0.4, 0.95, 0.06, 0, f * F + 0.2, z0 + bd / 2 + 1.17, '#2c3330');
  }
  const r = rng();
  if (r < 0.3) {
    pb.cylinder('trim', 1.7, 1.7, 1.3, 0, H + 0.3, z0, '#efe4cf', 16);
    pb.dome('trim', 1.8, 0, H + 1.6, z0, '#6d9c8f');
  } else if (r < 0.55) {
    const tx = (rng() < 0.5 ? -1 : 1) * (bw / 2 - 2);
    pb.box('arched', 4, H + 2.8, 4, tx, 0, z0 + bd / 2 - 2, wall);
    pb.hipRoof('roof', 4.8, 4.8, 2.4, tx, H + 2.8, z0 + bd / 2 - 2, '#d0d0d0');
  }
  if ((c.phase.weathering ?? 0) > 0.4) {
    roofClutter(c, bw, bd, H + 0.3, 1 + Math.floor(rng() * 3));
    acUnits(c, bw, bd, 0, c.floors, F);
  }
}

function bauhaus(c: Ctx, forcePilotis = false) {
  const { pb, rng, wall } = c;
  const F = 3.1;
  const bw = c.w - 1;
  const bd = c.d - 3;
  const z0 = -1.2;
  const weathered = (c.phase.weathering ?? 0) > 0.4;
  const pilotis = forcePilotis || (c.phase.from >= 1934 && rng() < 0.55);
  const y0 = pilotis ? F : 0;
  const H = y0 + c.floors * F;
  foundation(c, bw, bd);
  if (pilotis) {
    pb.box('dark', bw * 0.35, F, bd * 0.5, -bw * 0.15, 0, z0 - bd * 0.1, '#30363a');
    pb.box('bauhaus', bw * 0.2, F, bd * 0.6, bw * 0.3, 0, z0 - bd * 0.1, wall);
    const nx = Math.max(2, Math.round(bw / 4.5));
    for (let i = 0; i <= nx; i++) {
      const x = -bw / 2 + 0.4 + (i * (bw - 0.8)) / nx;
      pb.cylinder('trim', 0.22, 0.22, F, x, 0, z0 + bd / 2 - 0.4, '#f2f0ea', 10);
      pb.cylinder('trim', 0.22, 0.22, F, x, 0, z0 - bd / 2 + 0.4, '#f2f0ea', 10);
    }
  }
  pb.box('bauhaus', bw, c.floors * F, bd, 0, y0, z0, wall);
  // ribbon balconies — the signature of the White City
  const partial = rng() < 0.5;
  const bWidth = partial ? bw * (0.55 + rng() * 0.2) : bw + 0.3;
  const bx = partial ? (rng() < 0.5 ? -1 : 1) * (bw - bWidth) / 2 : 0;
  const closedFloors = new Set<number>();
  if (weathered) for (let f = 0; f < c.floors; f++) if (rng() < 0.45) closedFloors.add(f);
  for (let f = 0; f < c.floors; f++) {
    const y = y0 + f * F;
    pb.box('trim', bWidth, 0.18, 1.5, bx, y, z0 + bd / 2 + 0.75, '#f6f5f1');
    if (closedFloors.has(f)) {
      // balconies enclosed with shutters ("sagur mirpeset") during the decades of neglect
      pb.box('shikun', bWidth, F - 0.2, 0.14, bx, y + 0.18, z0 + bd / 2 + 1.43, wall);
    } else {
      pb.box('trim', bWidth, 1.0, 0.14, bx, y + 0.18, z0 + bd / 2 + 1.43, wall);
    }
  }
  pb.box('trim', bWidth + 0.2, 0.2, 1.7, bx, H, z0 + bd / 2 + 0.75, '#f6f5f1');
  // rounded corner
  if (rng() < 0.45) {
    const side = bx > 0 ? -1 : 1;
    const rc = Math.min(3.0, bd / 3);
    const cx = side * (bw / 2 - rc * 0.55);
    const cz = z0 + bd / 2 - rc * 0.55;
    pb.cylinder('bauhaus', rc, rc, c.floors * F, cx, y0, cz, wall, 22);
    for (let f = 0; f < c.floors; f++) {
      pb.cylinder('trim', rc + 1.2, rc + 1.2, 0.18, cx, y0 + f * F, cz, '#f6f5f1', 24);
      pb.cylinder('trim', rc + 1.2, rc + 1.2, 1.0, cx, y0 + f * F + 0.18, cz, wall, 24, true);
    }
  }
  // thermometer window lighting the stair
  pb.box('dark', 0.14, c.floors * F - 1.2, 1.0, (bx > 0 ? -1 : 1) * (bw / 2 + 0.05), y0 + 0.6, z0, '#2b3238');
  parapet(c, bw, bd, H, 1.0, 0.25, wall, z0);
  if (rng() < 0.6) {
    pb.box('bauhaus', 4.2, 2.7, 3.2, (rng() - 0.5) * (bw - 5), H, z0 - bd / 2 + 2, wall);
  }
  if (rng() < 0.5 && !weathered) {
    for (let i = 0; i < 6; i++) pb.box('trim', 0.12, 0.12, 3.2, -2.5 + i, H + 2.6, z0 + 1, '#f2f0ea');
    for (const x of [-2.6, 2.6]) for (const z of [-0.5, 2.5]) pb.box('trim', 0.15, 2.6, 0.15, x, H, z0 + z, '#f2f0ea');
  }
  if (weathered) {
    roofClutter(c, bw, bd, H, 2 + Math.floor(rng() * 4));
    acUnits(c, bw, bd, y0, c.floors, F);
  }
}

function shikun(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 2.9;
  const bw = c.w - 1;
  const bd = c.d - 3;
  const z0 = -1;
  const pilotis = rng() < 0.6;
  const y0 = pilotis ? F : 0;
  const H = y0 + c.floors * F;
  foundation(c, bw, bd);
  if (pilotis) {
    pb.box('shikun', bw * 0.3, F, bd * 0.6, 0, 0, z0, wall);
    for (const x of [-bw / 2 + 0.4, -bw / 6, bw / 6, bw / 2 - 0.4])
      for (const z of [-bd / 2 + 0.4, bd / 2 - 0.4]) pb.box('trim', 0.4, F, 0.4, x, 0, z0 + z, '#d9d2c2');
  }
  pb.box('shikun', bw, c.floors * F, bd, 0, y0, z0, wall);
  for (let f = 0; f < c.floors; f++)
    for (const x of [-bw / 4, bw / 4]) {
      pb.box('trim', 2.6, 0.15, 1.1, x, y0 + f * F, z0 + bd / 2 + 0.55, '#e8e1d2');
      pb.box('trim', 2.6, 1.0, 0.1, x, y0 + f * F + 0.15, z0 + bd / 2 + 1.05, wall);
    }
  parapet(c, bw, bd, H, 0.6, 0.2, wall, z0);
  if (c.phase.from >= 1958 || (c.phase.weathering ?? 0) > 0.4) roofClutter(c, bw, bd, H, 3 + Math.floor(rng() * 4));
  if ((c.phase.weathering ?? 0) > 0.4) acUnits(c, bw, bd, y0, c.floors, F);
}

function brutalist(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 3.4;
  const bw = c.w - 0.5;
  const bd = c.d - 2;
  foundation(c, bw, bd);
  pb.box('dark', bw - 2, F, bd - 2, 0, 0, 0, '#2a3034');
  pb.box('concrete', bw, (c.floors - 1) * F, bd, 0, F, 0, wall);
  for (let f = 1; f <= c.floors; f++) pb.box('trim', bw + 1.2, 0.3, bd + 1.2, 0, f * F - 0.3, 0, wall);
  const H = c.floors * F;
  pb.box('concrete', bw * 0.4, 3, bd * 0.4, (rng() - 0.5) * bw * 0.3, H, 0, wall);
  pb.box('metal', 0.1, 6, 0.1, bw * 0.3, H, -bd * 0.2, '#888');
}

function modernResidential(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 3.2;
  const bw = c.w - 1;
  const bd = c.d - 2.5;
  const z0 = -1;
  const body = c.floors - 1;
  foundation(c, bw, bd);
  pb.box('dark', bw, F, bd - 1, 0, 0, z0 - 0.5, '#33393d');
  pb.box('modern', bw, (body - 1) * F, bd, 0, F, z0, wall);
  for (let f = 1; f < body; f++) {
    pb.box('trim', bw * 0.8, 0.22, 1.7, 0, f * F, z0 + bd / 2 + 0.85, '#f4f4f2');
    pb.box('rail', bw * 0.8, 1.05, 0.05, 0, f * F + 0.22, z0 + bd / 2 + 1.67, '#cfe2ea');
  }
  const H = body * F;
  pb.box('modern', bw * 0.65, F, bd * 0.65, -bw * 0.12, H, z0 - bd * 0.1, wall);
  pb.box('trim', bw * 0.85, 0.25, bd * 0.85, -bw * 0.05, H + F, z0 - bd * 0.05, '#e8e8e6');
  pb.box('rail', bw, 1.05, 0.05, 0, H, z0 + bd / 2 - 0.03, '#cfe2ea');
  if (rng() < 0.4) pb.box('stone', bw + 0.1, 2 * F, 0.15, 0, F, z0 + bd / 2 - 0.05, '#d8ccb4');
}

function glassTower(c: Ctx, height: number) {
  const { pb, rng, wall } = c;
  const pw = c.w;
  const pd = c.d;
  foundation(c, pw, pd);
  pb.box('stone', pw, 9, pd, 0, 0, 0, '#d9d1c3');
  pb.box('dark', pw + 0.2, 4.5, pd + 0.2, 0, 0, 0, '#2b3135');
  const tw = Math.max(10, pw - 5);
  const td = Math.max(10, pd - 5);
  const th = height - 9;
  if (rng() < 0.35) {
    const r = Math.min(tw, td) / 2;
    pb.cylinder('glass', r, r, th, 0, 9, 0, wall, 28);
    pb.cylinder('metal', r * 0.92, r * 0.92, 4, 0, height, 0, '#9aa5ad', 28);
  } else {
    pb.box('glass', tw, th, td, 0, 9, 0, wall);
    for (const sx of [-1, 1]) pb.box('metal', 0.5, th, 0.5, (sx * tw) / 2, 9, td / 2, '#c9cfd3');
    pb.box('metal', tw * 0.9, 4, td * 0.9, 0, height, 0, '#a7b0b6');
    pb.box('trim', tw + 0.6, 0.6, td + 0.6, 0, height, 0, '#dfe3e6');
  }
}

function jaffaStone(c: Ctx) {
  const { pb, rng, wall } = c;
  const F = 3.6;
  const H = c.floors * F;
  foundation(c, c.w, c.d, '#a99a7c');
  pb.box('arched', c.w, H, c.d, 0, 0, 0, wall);
  parapet(c, c.w, c.d, H, 0.7, 0.35, wall, 0, 'stone');
  if (rng() < 0.35) {
    pb.cylinder('stone', 1.9, 1.9, 0.8, (rng() - 0.5) * 3, H, (rng() - 0.5) * 3, wall, 14);
    pb.dome('stone', 2.0, 0, H + 0.8, 0, wall, 0.8);
  }
  if (rng() < 0.25) pb.box('arched', c.w * 0.4, F, c.d * 0.4, c.w * 0.2, H, -c.d * 0.2, wall);
}

// ---------------------------------------------------------------- landmarks

function gymnasium(c: Ctx) {
  const { pb, wall } = c;
  foundation(c, 60, 22);
  // stair and forecourt
  pb.box('stone', 22, 0.5, 4, 0, 0, 12, '#d8cbb0');
  pb.box('stone', 18, 0.5, 2.5, 0, 0.5, 11, '#d8cbb0');
  for (const s of [-1, 1]) {
    pb.box('arched', 21, 7.2, 15, s * 20, 0, -1, wall);
    pb.box('trim', 21.6, 0.5, 15.6, s * 20, 7.0, -1, '#f5ecd8');
    for (let i = 0; i < 7; i++) pb.box('trim', 1.2, 0.8, 0.5, s * (10.6 + i * 3.2), 7.5, 6.6, '#f5ecd8');
  }
  pb.box('arched', 17, 10.5, 20, 0, 0, 0, wall);
  for (const s of [-1, 1]) {
    pb.pylon('trim', 4.6, 3.2, 17, s * 7, 0, 8.2, wall);
    pb.box('trim', 3.8, 0.6, 3.8, s * 7, 17, 8.2, '#f6eedc');
    pb.pylon('trim', 2.6, 0.2, 2.6, s * 7, 17.6, 8.2, '#c9b07a');
  }
  pb.box('dark', 5, 6, 0.4, 0, 0.5, 10.1, '#3a2f28');
  pb.disc('dark', 2.5, 0.4, 0, 6.5, 10.1, '#3a2f28');
  pb.box('trim', 9, 1.2, 0.6, 0, 9.6, 10.2, '#f6eedc');
  pb.box('trim', 17.6, 0.6, 20.6, 0, 10.4, 0, '#f6eedc');
}

function shalomTower(c: Ctx, height: number) {
  const { pb, wall } = c;
  foundation(c, 70, 40);
  pb.box('dark', 68, 4.5, 38, 0, 0, 0, '#2b3034');
  pb.box('concrete', 70, 12, 40, 0, 4.5, 0, wall);
  pb.box('trim', 71, 0.6, 41, 0, 16.2, 0, wall);
  const th = height - 16.5;
  pb.box('concrete', 44, th, 19, 0, 16.5, -4, wall);
  for (let i = -5; i <= 5; i++) pb.box('trim', 0.6, th, 0.5, i * 4.3, 16.5, 5.6, '#e9e6de');
  pb.box('concrete', 20, 5, 10, 0, height, -4, wall);
  pb.cylinder('metal', 0.3, 0.3, 14, 4, height + 5, -4, '#c8c8c8', 8);
}

function kiosk(c: Ctx) {
  const { pb, wall } = c;
  pb.box('stone', 4.4, 0.3, 4.4, 0, 0, 0, '#cbbd9f');
  pb.cylinder('wood', 1.6, 1.6, 2.6, 0, 0.3, 0, wall, 8);
  pb.cylinder('trim', 2.6, 1.7, 0.5, 0, 2.9, 0, '#e9dfc8', 8);
  pb.dome('trim', 1.5, 0, 3.4, 0, '#5d8a7a', 1.2);
  pb.cylinder('metal', 0.06, 0.06, 1.2, 0, 5.2, 0, '#444', 6);
}

function waterTower(c: Ctx) {
  const { pb, wall } = c;
  pb.box('stone', 4.6, 13, 4.6, 0, 0, 0, wall);
  pb.box('dark', 1.1, 2.2, 0.1, 0, 0, 2.32, '#3a3029');
  pb.box('trim', 5.4, 0.5, 5.4, 0, 13, 0, '#e8dcc2');
  pb.box('wood', 6.4, 3.6, 6.4, 0, 13.5, 0, '#8a7a62');
  pb.hipRoof('roof', 7.2, 7.2, 2.0, 0, 17.1, 0, '#cccccc');
}

function foundersMonument(c: Ctx) {
  const { pb, wall } = c;
  pb.cylinder('stone', 6, 6.2, 0.7, 0, 0, 0, wall, 28);
  pb.cylinder('water', 5.6, 5.6, 0.1, 0, 0.62, 0, '#4f7f95', 28);
  pb.box('stone', 3.2, 1.2, 2.2, 0, 0.6, 0, wall);
  pb.box('stone', 2.4, 8.5, 1.4, 0, 1.8, 0, wall);
  pb.box('trim', 2.5, 4.5, 1.5, 0, 3.5, 0, '#a89a7d');
}

function museumCube(c: Ctx) {
  const { pb, wall } = c;
  const w = c.phase.width ?? c.w;
  const d = c.d - 2;
  foundation(c, w, d);
  pb.box('bauhaus', w, 8, d, 0, 0, -1, wall);
  pb.box('trim', w + 0.3, 0.6, d + 0.3, 0, 8, -1, wall);
  pb.box('trim', 8, 0.25, 3, 0, 4.2, d / 2 + 0.5, '#f6f4ee');
  for (let i = 0; i < 4; i++) pb.box('stone', 9 - i * 0.6, 0.3, 1.2, 0, i * 0.3, d / 2 + 2.8 - i * 0.6, '#ddd3c0');
  pb.box('dark', 3, 3.6, 0.1, 0, 0.6, d / 2 - 0.95, '#3a3f42');
}

function synagogue(c: Ctx, arches: boolean) {
  const { pb, wall } = c;
  foundation(c, 26, 26);
  pb.box('arched', 24, 12, 24, 0, 0, 0, wall);
  pb.box('trim', 25, 0.8, 25, 0, 12, 0, wall);
  for (const x of [-11, 11]) for (const z of [-11, 11]) pb.box('arched', 4, 15, 4, x, 0, z, wall);
  pb.cylinder('stone', 8, 8, 3, 0, 12.8, 0, wall, 24);
  pb.dome('trim', 8.4, 0, 15.8, 0, arches ? '#b9b4a6' : '#8fa39a', 0.9);
  if (arches) {
    for (let i = -2; i <= 2; i++)
      for (const [sx, sz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = sx ? sx * 14 : i * 5.6;
        const z = sz ? sz * 14 : i * 5.6;
        pb.box('concrete', 1.4, 17, 1.4, x, 0, z, '#d9d5cb');
      }
    parapetRing(c, 29.4, 17, 2.2, '#d9d5cb');
  }
}

function parapetRing(c: Ctx, size: number, y: number, h: number, color: string) {
  const { pb } = c;
  pb.box('concrete', size, h, 1.4, 0, y, size / 2 - 0.7, color);
  pb.box('concrete', size, h, 1.4, 0, y, -size / 2 + 0.7, color);
  pb.box('concrete', 1.4, h, size, size / 2 - 0.7, y, 0, color);
  pb.box('concrete', 1.4, h, size, -size / 2 + 0.7, y, 0, color);
}

function pagodaHouse(c: Ctx) {
  const { pb, wall } = c;
  const H = 3 * 3.4;
  foundation(c, 14, 14);
  pb.box('arched', 13, H, 13, 0, 0, 0, wall);
  for (let f = 1; f < 3; f++) pb.box('trim', 13.6, 0.2, 13.6, 0, f * 3.4, 0, '#f3e9d6');
  pb.hipRoof('roof', 16, 16, 1.6, 0, H, 0, '#d0d0d0');
  pb.box('arched', 8, 2.2, 8, 0, H + 0.8, 0, wall);
  pb.hipRoof('roof', 10.5, 10.5, 1.4, 0, H + 3.0, 0, '#d0d0d0');
  pb.box('arched', 4, 1.8, 4, 0, H + 3.6, 0, wall);
  pb.hipRoof('roof', 5.6, 5.6, 2.6, 0, H + 5.4, 0, '#d0d0d0');
}

function clockTower(c: Ctx) {
  const { pb, wall } = c;
  foundation(c, 5, 5);
  pb.box('stone', 5.2, 4, 5.2, 0, 0, 0, wall);
  pb.pylon('stone', 4.4, 3.6, 18, 0, 4, 0, wall);
  pb.box('trim', 4.4, 0.6, 4.4, 0, 22, 0, '#e6d8b8');
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    pb.disc('trim', 1.05, 0.2, Math.sin(a) * 1.9, 18.5, Math.cos(a) * 1.9, '#f8f5ec', a);
  for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) pb.box('stone', 0.5, 2.6, 0.5, x, 22.6, z, wall);
  pb.box('stone', 4.2, 0.5, 4.2, 0, 25.2, 0, wall);
  pb.pylon('stone', 2.6, 0.4, 2.2, 0, 25.7, 0, wall);
}

function church(c: Ctx) {
  const { pb, wall } = c;
  foundation(c, 18, 40);
  pb.box('stone', 15, 14, 34, 0, 0, -2, wall);
  pb.gable('roof', 15.6, 4.5, 34.6, 0, 14, -2, '#c9c9c9');
  pb.box('stone', 18, 20, 7, 0, 0, 16, wall);
  for (const x of [-6, 6]) {
    pb.box('stone', 5, 27, 5, x, 0, 17, wall);
    pb.pylon('stone', 4, 0.4, 4, x, 27, 17, wall);
  }
  pb.disc('dark', 2, 0.3, 0, 13, 19.6, '#3a3632');
}

function cylinderTower(c: Ctx, h: number) {
  const { pb, wall } = c;
  pb.cylinder('stone', 22, 22, 8, 0, 0, 0, '#d9d1c3', 28);
  pb.cylinder('glass', 18, 18, h - 8, 0, 8, 0, wall, 32);
  pb.cylinder('metal', 16, 16, 5, 0, h, 0, '#b8c2c8', 32);
}

function triangleTower(c: Ctx, h: number) {
  const { pb, wall } = c;
  pb.cylinder('stone', 22, 22, 8, 0, 0, 0, '#d9d1c3', 3);
  pb.cylinder('glass', 20, 20, h - 8, 0, 8, 0, wall, 3);
  pb.cylinder('metal', 18, 18, 5, 0, h, 0, '#b8c2c8', 3);
}

function tent(c: Ctx) {
  c.pb.gable('canvas', c.w, 1.7, c.d, 0, 0, 0, c.wall);
}

export function buildPhase(pb: PartBuilder, site: BuildingSite, phase: BuildingPhase, rng: Rng) {
  const c: Ctx = {
    pb,
    w: phase.width ?? site.width,
    d: phase.depth ?? site.depth,
    floors: phase.floors ?? 2,
    phase,
    wall: wallColor(phase),
    rng,
  };
  switch (phase.style) {
    case 'ottoman-house':
      return ottomanHouse(c);
    case 'eclectic':
      return eclectic(c);
    case 'bauhaus':
      return bauhaus(c, site.id === 'engel-house');
    case 'shikun':
      return shikun(c);
    case 'brutalist':
      return brutalist(c);
    case 'modern-residential':
      return modernResidential(c);
    case 'glass-tower':
      return glassTower(c, phase.height ?? 100);
    case 'jaffa-stone':
      return jaffaStone(c);
    case 'gymnasium':
      return gymnasium(c);
    case 'shalom-tower':
      return shalomTower(c, phase.height ?? 129);
    case 'kiosk':
      return kiosk(c);
    case 'water-tower':
      return waterTower(c);
    case 'founders-monument':
      return foundersMonument(c);
    case 'museum-cube':
      return museumCube(c);
    case 'synagogue-dome':
      return synagogue(c, false);
    case 'synagogue-arches':
      return synagogue(c, true);
    case 'pagoda-house':
      return pagodaHouse(c);
    case 'clock-tower':
      return clockTower(c);
    case 'church':
      return church(c);
    case 'cylinder-tower':
      return cylinderTower(c, phase.height ?? 180);
    case 'triangle-tower':
      return triangleTower(c, phase.height ?? 170);
    case 'tent':
      return tent(c);
  }
}
