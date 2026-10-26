import * as THREE from 'three';
import { hashString, interpKeys, mulberry32 } from '../core/math';
import { baseHeight } from '../data/geography';
import { STREETS, frameAt, streetById, streetLength } from '../data/streets';
import type { Street } from '../data/types';

/**
 * Pedestrians: low-poly instanced figures with a vertex-shader walk cycle.
 * Crowd size, clothing and hats follow the period; special gatherings recreate
 * key moments (the 1909 lottery, 14 May 1948, the 2011 tent protest).
 */

const CAP = 900;

interface Walker {
  street: Street;
  len: number;
  offset: number;
  s: number;
  dir: number;
  speed: number;
  dress: boolean;
  hat: boolean;
  // static crowd member
  fixed?: { x: number; z: number; face: number };
}

interface Palette {
  tops: string[];
  bottoms: string[];
  dresses: string[];
  hats: string[];
  hatP: number;
  dressP: number;
}

const PALETTES: [number, Palette][] = [
  [
    1900,
    {
      tops: ['#f2efe6', '#e8e0cc', '#d9d2c0', '#3b3a36', '#5a4a3a'],
      bottoms: ['#2e2b28', '#4a4036', '#3a3a40', '#6b5a45'],
      dresses: ['#2f2c2a', '#e9e4d8', '#4b4a55', '#6d5a4a'],
      hats: ['#2a2622', '#e8e2d2', '#5a4632', '#8e2a22'],
      hatP: 0.75,
      dressP: 0.4,
    },
  ],
  [
    1931,
    {
      tops: ['#f3f1ea', '#c9b88f', '#a9c0d3', '#e6dfcf', '#f0e9d8'],
      bottoms: ['#bfae85', '#3c3a36', '#5c5448', '#e9e4d8'],
      dresses: ['#e9e4d8', '#9bb3c9', '#c96f5a', '#f2efe6', '#5f7f6a'],
      hats: ['#e8e2d2', '#2a2622', '#c9b88f'],
      hatP: 0.45,
      dressP: 0.38,
    },
  ],
  [
    1948,
    {
      tops: ['#f4f2ec', '#9bb7d4', '#c3b28a', '#d8d0c0', '#7c96b0'],
      bottoms: ['#b6a57d', '#2f3a4a', '#4a4740', '#8a7b5c'],
      dresses: ['#f2efe6', '#9fb8d0', '#d98c6a', '#7ea07a'],
      hats: ['#e8e2d2', '#9fb3c8', '#c3b28a'],
      hatP: 0.3,
      dressP: 0.32,
    },
  ],
  [
    1970,
    {
      tops: ['#d9893a', '#a4553a', '#e8d7a8', '#6b8f5a', '#f2efe6', '#3a5a8a'],
      bottoms: ['#3a4f7a', '#6b4a2f', '#2f2f2f', '#5b6b8a'],
      dresses: ['#d9893a', '#c4a24a', '#7a9a5a', '#a4553a'],
      hats: ['#e8e2d2'],
      hatP: 0.05,
      dressP: 0.2,
    },
  ],
  [
    1990,
    {
      tops: ['#1d1d1f', '#f5f5f5', '#2f5d8a', '#c23b3b', '#e0c040', '#7a7a7a', '#4a7a5a', '#e98a9a'],
      bottoms: ['#2d3e5f', '#1a1a1a', '#3f5f86', '#c8b89a', '#5a5a5a'],
      dresses: ['#1d1d1f', '#f5f5f5', '#c23b3b', '#3f6fa8'],
      hats: ['#1d1d1f', '#f5f5f5', '#2f5d8a'],
      hatP: 0.1,
      dressP: 0.15,
    },
  ],
];

const SKIN = ['#e9c4a2', '#d8a983', '#c18e66', '#a5714c', '#7d5236', '#f0d0b4'];

const DENSITY: [number, number][] = [
  [1900, 0],
  [1909, 50],
  [1912, 120],
  [1916, 160],
  [1917, 8],
  [1918, 20],
  [1920, 200],
  [1925, 350],
  [1935, 600],
  [1948, 650],
  [1965, 650],
  [1980, 450],
  [1995, 520],
  [2010, 700],
  [2025, 720],
];

interface Gathering {
  from: number;
  to: number;
  x: number;
  z: number;
  r: number;
  n: number;
}

function promenadePoint(s: number) {
  const f = frameAt(streetById('rothschild'), s);
  return { x: f.x, z: f.z };
}

const GATHERINGS: Gathering[] = [
  { from: 1909, to: 1909, x: 40, z: -20, r: 9, n: 90 }, // the seashell lottery on the dunes
  { from: 1948, to: 1948, ...promenadePoint(118), r: 16, n: 220 }, // crowds outside the museum, 14 May 1948
  { from: 2011, to: 2011, ...promenadePoint(620), r: 18, n: 200 }, // a rally among the tents
];

function personGeometry(dress: boolean): THREE.BufferGeometry {
  const parts: { g: THREE.BufferGeometry; limb: number; part: number }[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    return g;
  };
  if (dress) {
    const skirt = new THREE.CylinderGeometry(0.2, 0.33, 0.85, 8);
    skirt.translate(0, 0.5, 0);
    parts.push({ g: skirt, limb: 0, part: 2 });
    parts.push({ g: box(0.11, 0.2, 0.12, -0.08, 0, 0), limb: 1, part: 0 });
    parts.push({ g: box(0.11, 0.2, 0.12, 0.08, 0, 0), limb: 2, part: 0 });
  } else {
    parts.push({ g: box(0.15, 0.86, 0.16, -0.1, 0, 0), limb: 1, part: 2 });
    parts.push({ g: box(0.15, 0.86, 0.16, 0.1, 0, 0), limb: 2, part: 2 });
  }
  parts.push({ g: box(0.42, 0.62, 0.24, 0, 0.86, 0), limb: 0, part: 1 });
  parts.push({ g: box(0.1, 0.6, 0.11, -0.27, 0.84, 0), limb: 3, part: 1 });
  parts.push({ g: box(0.1, 0.6, 0.11, 0.27, 0.84, 0), limb: 4, part: 1 });
  const head = new THREE.SphereGeometry(0.12, 10, 8);
  head.scale(1, 1.15, 1);
  head.translate(0, 1.62, 0);
  parts.push({ g: head, limb: 0, part: 0 });

  const pos: number[] = [];
  const nor: number[] = [];
  const limb: number[] = [];
  const part: number[] = [];
  for (const p of parts) {
    const g = p.g.toNonIndexed();
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
    for (let i = 0; i < g.attributes.position.count; i++) {
      limb.push(p.limb);
      part.push(p.part);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aLimb', new THREE.Float32BufferAttribute(limb, 1));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

function hatGeometry(): THREE.BufferGeometry {
  const brim = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12).toNonIndexed();
  brim.translate(0, 1.73, 0);
  const crown = new THREE.CylinderGeometry(0.11, 0.13, 0.13, 12).toNonIndexed();
  crown.translate(0, 1.8, 0);
  const g = new THREE.BufferGeometry();
  const pa = [...(brim.attributes.position.array as Float32Array), ...(crown.attributes.position.array as Float32Array)];
  const na = [...(brim.attributes.normal.array as Float32Array), ...(crown.attributes.normal.array as Float32Array)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(na, 3));
  return g;
}

function walkerMaterial(uTime: { value: number }, hat: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        attribute float aPhase;
        attribute float aMove;
        attribute vec3 aTop;
        attribute vec3 aBottom;
        attribute vec3 aSkin;
        ${hat ? '' : 'attribute float aLimb; attribute float aPart;'}
        varying vec3 vPersonColor;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float cyc = uTime * 7.0 + aPhase;
        ${
          hat
            ? 'vPersonColor = aTop;'
            : `
        float swing = sin(cyc) * 0.55 * aMove;
        if (aLimb > 0.5) {
          bool isArm = aLimb > 2.5;
          float side = (aLimb < 1.5 || (aLimb > 2.5 && aLimb < 3.5)) ? 1.0 : -1.0;
          float pivot = isArm ? 1.42 : 0.86;
          float ang = swing * side * (isArm ? -0.7 : 1.0);
          vec3 p = transformed;
          p.y -= pivot;
          float c = cos(ang), s = sin(ang);
          p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
          p.y += pivot;
          transformed = p;
        }
        vPersonColor = aPart < 0.5 ? aSkin : (aPart < 1.5 ? aTop : aBottom);`
        }
        transformed.y += abs(sin(cyc)) * 0.035 * aMove;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPersonColor;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vPersonColor;');
  };
  return m;
}

export class People {
  readonly root = new THREE.Group();
  private uTime = { value: 0 };
  private meshes: { body: THREE.InstancedMesh; walkers: Walker[] }[] = [];
  private hats: THREE.InstancedMesh;
  private hatOwners: { mesh: number; index: number }[] = [];
  private year = -1;

  constructor() {
    this.root.name = 'people';
    for (const dress of [false, true]) {
      const geo = personGeometry(dress);
      this.addInstanceAttributes(geo);
      const body = new THREE.InstancedMesh(geo, walkerMaterial(this.uTime, false), CAP);
      body.castShadow = true;
      body.frustumCulled = false;
      body.count = 0;
      this.root.add(body);
      this.meshes.push({ body, walkers: [] });
    }
    const hg = hatGeometry();
    this.addInstanceAttributes(hg);
    this.hats = new THREE.InstancedMesh(hg, walkerMaterial(this.uTime, true), CAP);
    this.hats.frustumCulled = false;
    this.hats.count = 0;
    this.root.add(this.hats);
  }

  private addInstanceAttributes(g: THREE.BufferGeometry) {
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1));
    g.setAttribute('aMove', new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1));
    g.setAttribute('aTop', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3));
    g.setAttribute('aBottom', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3));
    g.setAttribute('aSkin', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3));
  }

  get count() {
    return this.meshes[0].body.count + this.meshes[1].body.count;
  }

  setYear(year: number) {
    const y = Math.floor(year);
    if (y === this.year) return;
    this.year = y;
    const rng = mulberry32(hashString(`people${y}`));
    const pal = [...PALETTES].reverse().find(([from]) => y >= from)![1];
    const streets = STREETS.filter((s) => y >= s.opened);
    const total = Math.round(interpKeys(DENSITY, y));
    const walkers: Walker[] = [];
    if (streets.length) {
      const lengths = streets.map(streetLength);
      const sum = lengths.reduce((a, b) => a + b, 0);
      for (let i = 0; i < total; i++) {
        let pick = rng() * sum;
        let k = 0;
        while (pick > lengths[k] && k < streets.length - 1) pick -= lengths[k++];
        const st = streets[k];
        const prom = (st.promenade ?? 0) / 2;
        const onPromenade = prom > 0 && rng() < 0.55;
        const edge = st.width / 2 + prom - st.sidewalk / 2;
        const offset = onPromenade ? (rng() - 0.5) * (prom * 2 - 3) : (rng() < 0.5 ? -1 : 1) * (edge + (rng() - 0.5) * (st.sidewalk - 1));
        walkers.push({
          street: st,
          len: lengths[k],
          offset,
          s: rng() * lengths[k],
          dir: rng() < 0.5 ? -1 : 1,
          speed: 1.0 + rng() * 0.5,
          dress: rng() < pal.dressP,
          hat: rng() < pal.hatP,
        });
      }
    }
    for (const g of GATHERINGS) {
      if (y < g.from || y > g.to) continue;
      for (let i = 0; i < g.n; i++) {
        const a = rng() * Math.PI * 2;
        const r = g.r * (0.35 + Math.sqrt(rng()) * 0.65);
        const x = g.x + Math.cos(a) * r;
        const z = g.z + Math.sin(a) * r;
        walkers.push({
          street: STREETS[0],
          len: 1,
          offset: 0,
          s: 0,
          dir: 1,
          speed: 0,
          dress: rng() < pal.dressP,
          hat: rng() < pal.hatP,
          fixed: { x, z, face: Math.atan2(g.x - x, g.z - z) + (rng() - 0.5) * 0.6 },
        });
      }
    }
    // Distribute into the two body meshes and assign colours.
    const c = new THREE.Color();
    this.meshes[0].walkers = [];
    this.meshes[1].walkers = [];
    this.hatOwners = [];
    for (const w of walkers) {
      const mi = w.dress ? 1 : 0;
      const m = this.meshes[mi];
      if (m.walkers.length >= CAP) continue;
      const i = m.walkers.length;
      m.walkers.push(w);
      const geo = m.body.geometry;
      const set = (name: string, hex: string) => {
        c.set(hex);
        (geo.attributes[name] as THREE.InstancedBufferAttribute).setXYZ(i, c.r, c.g, c.b);
      };
      set('aTop', pal.tops[Math.floor(rng() * pal.tops.length)]);
      const bottoms = w.dress ? pal.dresses : pal.bottoms;
      set('aBottom', bottoms[Math.floor(rng() * bottoms.length)]);
      set('aSkin', SKIN[Math.floor(rng() * SKIN.length)]);
      (geo.attributes.aPhase as THREE.InstancedBufferAttribute).setX(i, rng() * 6.28);
      (geo.attributes.aMove as THREE.InstancedBufferAttribute).setX(i, w.fixed ? 0 : 1);
      if (w.hat && this.hatOwners.length < CAP) {
        const hi = this.hatOwners.length;
        this.hatOwners.push({ mesh: mi, index: i });
        c.set(pal.hats[Math.floor(rng() * pal.hats.length)]);
        (this.hats.geometry.attributes.aTop as THREE.InstancedBufferAttribute).setXYZ(hi, c.r, c.g, c.b);
        (this.hats.geometry.attributes.aPhase as THREE.InstancedBufferAttribute).setX(hi, (geo.attributes.aPhase as THREE.InstancedBufferAttribute).getX(i));
        (this.hats.geometry.attributes.aMove as THREE.InstancedBufferAttribute).setX(hi, w.fixed ? 0 : 1);
      }
    }
    for (const m of this.meshes) {
      m.body.count = m.walkers.length;
      for (const n of ['aTop', 'aBottom', 'aSkin', 'aPhase', 'aMove']) m.body.geometry.attributes[n].needsUpdate = true;
    }
    this.hats.count = this.hatOwners.length;
    for (const n of ['aTop', 'aPhase', 'aMove']) this.hats.geometry.attributes[n].needsUpdate = true;
  }

  update(dt: number, t: number) {
    this.uTime.value = t;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    for (const m of this.meshes) {
      m.walkers.forEach((w, i) => {
        let face: number;
        if (w.fixed) {
          p.set(w.fixed.x, baseHeight(w.fixed.x, w.fixed.z), w.fixed.z);
          face = w.fixed.face;
        } else {
          w.s += w.speed * w.dir * dt;
          if (w.s < 0 || w.s > w.len) {
            w.dir *= -1;
            w.s = Math.min(Math.max(w.s, 0), w.len);
          }
          const f = frameAt(w.street, w.s);
          const x = f.x + f.dz * w.offset;
          const z = f.z - f.dx * w.offset;
          p.set(x, baseHeight(x, z) + 0.17, z);
          face = Math.atan2(f.dx * w.dir, f.dz * w.dir);
        }
        q.setFromAxisAngle(up, face);
        m4.compose(p, q, one);
        m.body.setMatrixAt(i, m4);
      });
      m.body.instanceMatrix.needsUpdate = true;
    }
    this.hatOwners.forEach((h, i) => {
      this.meshes[h.mesh].body.getMatrixAt(h.index, m4);
      this.hats.setMatrixAt(i, m4);
    });
    this.hats.instanceMatrix.needsUpdate = true;
  }
}
