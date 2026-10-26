import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hashString, interpKeys, mulberry32 } from '../core/math';
import { baseHeight } from '../data/geography';
import { STREETS, frameAt, streetLength } from '../data/streets';
import type { Street } from '../data/types';

type VType = 'camel' | 'cart' | 'car20' | 'bus' | 'car60' | 'car';

interface Vehicle {
  type: VType;
  street: Street;
  len: number;
  offset: number;
  dir: number;
  s: number;
  speed: number;
  index: number;
}

/** Simple vertex-coloured box models. White parts take the per-instance colour. */
class Kit {
  parts: THREE.BufferGeometry[] = [];
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rotX = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y + h / 2, z);
    this.push(g, color);
  }
  wheel(r: number, x: number, z: number, w = 0.2) {
    const g = new THREE.CylinderGeometry(r, r, w, 10);
    g.rotateZ(Math.PI / 2);
    g.translate(x, r, z);
    this.push(g, '#1b1b1b');
  }
  sphere(r: number, x: number, y: number, z: number, color: string, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, 10, 8);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    this.push(g, color);
  }
  private push(g: THREE.BufferGeometry, color: string) {
    const ng = g.toNonIndexed();
    const c = new THREE.Color(color);
    const arr = new Float32Array(ng.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    ng.deleteAttribute('uv');
    this.parts.push(ng);
  }
  build() {
    return mergeGeometries(this.parts)!;
  }
}

function legs(k: Kit, xs: number[], zs: number[], h: number, t: number, color: string) {
  for (const x of xs) for (const z of zs) k.box(t, h, t, x, 0, z, color);
}

const MODELS: Record<VType, () => THREE.BufferGeometry> = {
  camel: () => {
    const k = new Kit();
    legs(k, [-0.25, 0.25], [-0.6, 0.6], 1.2, 0.14, '#ffffff');
    k.box(0.7, 0.7, 1.8, 0, 1.15, 0, '#ffffff');
    k.sphere(0.45, 0, 1.95, -0.1, '#ffffff', 1, 0.9, 1.3);
    k.box(0.22, 0.9, 0.25, 0, 1.4, 1.1, '#ffffff', -0.5);
    k.box(0.25, 0.25, 0.55, 0, 2.1, 1.45, '#ffffff');
    k.box(0.9, 0.5, 0.5, 0, 1.8, -0.75, '#8b7b5e'); // load of building sand / goods
    return k.build();
  },
  cart: () => {
    const k = new Kit();
    legs(k, [-0.18, 0.18], [1.4, 2.2], 0.95, 0.11, '#5a4636');
    k.box(0.5, 0.55, 1.2, 0, 0.95, 1.8, '#6a5240');
    k.box(0.2, 0.45, 0.5, 0, 1.4, 2.5, '#6a5240', -0.6);
    k.box(1.5, 0.12, 2.2, 0, 0.75, -0.3, '#ffffff');
    k.box(1.5, 0.4, 0.08, 0, 0.87, -1.4, '#ffffff');
    k.box(0.08, 0.4, 2.2, 0.72, 0.87, -0.3, '#ffffff');
    k.box(0.08, 0.4, 2.2, -0.72, 0.87, -0.3, '#ffffff');
    k.wheel(0.55, 0.85, -0.3, 0.08);
    k.wheel(0.55, -0.85, -0.3, 0.08);
    k.box(0.05, 0.05, 2.0, 0.3, 0.8, 1.2, '#4a3a2c');
    k.box(0.05, 0.05, 2.0, -0.3, 0.8, 1.2, '#4a3a2c');
    return k.build();
  },
  car20: () => {
    const k = new Kit();
    k.box(1.6, 0.6, 3.8, 0, 0.45, 0, '#ffffff');
    k.box(1.5, 0.75, 1.8, 0, 1.05, -0.4, '#ffffff');
    k.box(1.4, 0.45, 1.6, 0, 1.15, -0.4, '#2a3138');
    k.box(1.0, 0.45, 1.2, 0, 0.9, 1.3, '#ffffff');
    for (const x of [-0.8, 0.8]) for (const z of [-1.3, 1.25]) k.wheel(0.38, x, z, 0.18);
    k.box(1.9, 0.08, 0.5, 0, 0.62, 1.25, '#1b1b1b');
    k.box(1.9, 0.08, 0.5, 0, 0.62, -1.3, '#1b1b1b');
    return k.build();
  },
  bus: () => {
    const k = new Kit();
    k.box(2.4, 2.3, 10, 0, 0.45, 0, '#ffffff');
    k.box(2.42, 0.85, 9.4, 0, 1.55, -0.1, '#27303a');
    k.box(2.42, 0.25, 10.02, 0, 0.9, 0, '#2f5d8a');
    for (const x of [-1.1, 1.1]) for (const z of [-3.6, 3.4]) k.wheel(0.5, x, z, 0.3);
    return k.build();
  },
  car60: () => {
    const k = new Kit();
    k.box(1.6, 0.65, 3.9, 0, 0.3, 0, '#ffffff');
    k.box(1.4, 0.55, 1.9, 0, 0.95, -0.2, '#ffffff');
    k.box(1.42, 0.38, 1.7, 0, 1.0, -0.2, '#26303a');
    k.box(1.7, 0.12, 0.15, 0, 0.35, 1.97, '#cfcfcf');
    for (const x of [-0.75, 0.75]) for (const z of [-1.25, 1.25]) k.wheel(0.32, x, z, 0.2);
    return k.build();
  },
  car: () => {
    const k = new Kit();
    k.box(1.8, 0.7, 4.4, 0, 0.3, 0, '#ffffff');
    k.box(1.6, 0.6, 2.4, 0, 1.0, -0.25, '#ffffff');
    k.box(1.62, 0.45, 2.3, 0, 1.05, -0.25, '#1f262c');
    for (const x of [-0.85, 0.85]) for (const z of [-1.4, 1.4]) k.wheel(0.34, x, z, 0.22);
    return k.build();
  },
};

const SPEED: Record<VType, number> = { camel: 1.3, cart: 2.0, car20: 6, bus: 6.5, car60: 8, car: 8.5 };
const LENGTH: Record<VType, number> = { camel: 3.5, cart: 5, car20: 5, bus: 12, car60: 5, car: 5.5 };

const WEIGHTS: Record<VType, [number, number][]> = {
  camel: [
    [1909, 0.5],
    [1925, 0.2],
    [1936, 0],
  ],
  cart: [
    [1909, 0.5],
    [1930, 0.3],
    [1950, 0.05],
    [1956, 0],
  ],
  car20: [
    [1919, 0],
    [1925, 0.4],
    [1945, 0.5],
    [1955, 0.1],
    [1961, 0],
  ],
  bus: [
    [1924, 0],
    [1930, 0.1],
    [2025, 0.08],
  ],
  car60: [
    [1950, 0],
    [1960, 0.6],
    [1975, 0.7],
    [1990, 0.1],
    [1996, 0],
  ],
  car: [
    [1980, 0],
    [1990, 0.8],
    [2025, 0.85],
  ],
};

/** Vehicles per 100 m of lane. */
const DENSITY: [number, number][] = [
  [1909, 0.12],
  [1916, 0.2],
  [1917, 0.02],
  [1919, 0.2],
  [1925, 0.4],
  [1935, 0.8],
  [1960, 1.3],
  [1980, 2.1],
  [2010, 2.3],
  [2025, 2.0],
];

const PALETTE: Record<VType, string[]> = {
  camel: ['#c8a676', '#b8925e', '#d4b48a'],
  cart: ['#8a6a4a', '#7a5c40', '#9a7a58'],
  car20: ['#1d1f22', '#2a3a2e', '#3a2a24', '#22303e'],
  bus: ['#e9e2cf', '#d9cba6', '#cfd8d8'],
  car60: ['#8fb0c9', '#e7e2d3', '#c9b48a', '#a8463a', '#6f8f74', '#d8c46a'],
  car: ['#f2f2f2', '#c0c4c8', '#1e2124', '#5e646a', '#2c4a72', '#8a1f24'],
};

const CAP = 260;

export class Traffic {
  readonly root = new THREE.Group();
  private meshes = new Map<VType, THREE.InstancedMesh>();
  private vehicles: Vehicle[] = [];
  private year = -1;

  constructor() {
    this.root.name = 'traffic';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
    for (const t of Object.keys(MODELS) as VType[]) {
      const im = new THREE.InstancedMesh(MODELS[t](), mat, CAP);
      im.castShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      this.meshes.set(t, im);
      this.root.add(im);
    }
  }

  get count() {
    return this.vehicles.length;
  }

  setYear(year: number) {
    const y = Math.floor(year);
    if (y === this.year) return;
    this.year = y;
    const rng = mulberry32(hashString(`traffic${y}`));
    const weights = (Object.keys(WEIGHTS) as VType[]).map((t) => [t, interpKeys(WEIGHTS[t], y)] as const).filter(([, w]) => w > 0);
    const wsum = weights.reduce((a, [, w]) => a + w, 0);
    const dens = interpKeys(DENSITY, y);
    const counts = new Map<VType, number>();
    const c = new THREE.Color();
    this.vehicles = [];
    for (const st of STREETS) {
      if (y < st.opened) continue;
      const paved = y >= st.paved;
      const len = streetLength(st);
      const prom = (st.promenade ?? 0) / 2;
      const road = st.width / 2 - st.sidewalk;
      for (const dir of [1, -1]) {
        // right-hand traffic: +1 drives on the right of the centreline
        const offset = -dir * (prom ? prom + road / 2 : road / 2);
        const n = Math.round((dens * len) / 100);
        const lane: VType[] = [];
        for (let i = 0; i < n; i++) {
          let r = rng() * wsum;
          let type: VType = weights[0]?.[0] ?? 'car';
          for (const [t, w] of weights) {
            if ((r -= w) <= 0) {
              type = t;
              break;
            }
          }
          if (!paved && type !== 'camel' && type !== 'cart') continue;
          lane.push(type);
          if (type === 'camel') lane.push('camel', 'camel'); // camels walked in small caravans
        }
        if (!lane.length) continue;
        const speed = Math.min(...lane.map((t) => SPEED[t]));
        let s = rng() * len;
        for (const type of lane) {
          const idx = counts.get(type) ?? 0;
          if (idx >= CAP) continue;
          counts.set(type, idx + 1);
          const im = this.meshes.get(type)!;
          c.set(PALETTE[type][Math.floor(rng() * PALETTE[type].length)]);
          im.setColorAt(idx, c);
          this.vehicles.push({ type, street: st, len, offset, dir, s: s % len, speed, index: idx });
          s += type === 'camel' ? LENGTH.camel : len / lane.length;
        }
      }
    }
    for (const [t, im] of this.meshes) {
      im.count = counts.get(t) ?? 0;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  update(dt: number) {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    for (const v of this.vehicles) {
      v.s += v.speed * v.dir * dt;
      if (v.s > v.len) v.s -= v.len;
      if (v.s < 0) v.s += v.len;
      const f = frameAt(v.street, v.s);
      const x = f.x + f.dz * v.offset;
      const z = f.z - f.dx * v.offset;
      p.set(x, baseHeight(x, z) + 0.05, z);
      q.setFromAxisAngle(up, Math.atan2(f.dx * v.dir, f.dz * v.dir));
      m4.compose(p, q, one);
      this.meshes.get(v.type)!.setMatrixAt(v.index, m4);
    }
    for (const im of this.meshes.values()) im.instanceMatrix.needsUpdate = true;
  }
}
