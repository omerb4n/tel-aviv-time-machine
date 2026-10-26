import * as THREE from 'three';
import { hashString, mulberry32, smoothstep, valueNoise2 } from '../core/math';
import { devFactor } from '../data/development';
import { baseHeight, seaward } from '../data/geography';
import { STREETS, frameAt, streetById, streetLength } from '../data/streets';
import type { BuildingSite } from '../data/types';

type Kind = 'ficus' | 'palm' | 'sycamore' | 'cypress';

interface Tree {
  kind: Kind;
  x: number;
  z: number;
  planted: number;
  removed: number;
  scale: number;
  hue: number;
  rot: number;
}

function canopyGeometry(seed: number, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = 1 + 0.22 * valueNoise2(v.x * 2.3 + seed, v.z * 2.3 + v.y * 1.7);
    v.multiplyScalar(n);
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function palmCrown(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const frond = new THREE.ConeGeometry(0.45, 3.2, 4, 1);
    frond.scale(1, 1, 0.25);
    frond.translate(0, 1.6, 0);
    frond.rotateZ(Math.PI / 2 - 0.35 - (i % 3) * 0.18);
    frond.rotateY((i / 9) * Math.PI * 2);
    parts.push(frond.toNonIndexed());
  }
  const merged = new THREE.BufferGeometry();
  const arrays = parts.map((p) => p.attributes.position.array as Float32Array);
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const pos = new Float32Array(total);
  let o = 0;
  for (const a of arrays) {
    pos.set(a, o);
    o += a.length;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  return merged;
}

/** Trees that are planted, grow over decades and are sometimes cut down. */
export class Vegetation {
  readonly root = new THREE.Group();
  private trees: Tree[] = [];
  private trunks: THREE.InstancedMesh;
  private canopies: THREE.InstancedMesh;
  private palmTrunks: THREE.InstancedMesh;
  private palmCrowns: THREE.InstancedMesh;
  private cypresses: THREE.InstancedMesh;

  constructor(sites: BuildingSite[]) {
    this.collect(sites);
    const count = (k: Kind) => this.trees.filter((t) => t.kind === k).length;
    const broad = count('ficus') + count('sycamore');
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const bark = new THREE.MeshStandardMaterial({ color: '#6e5d4b', roughness: 0.95 });
    const leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
    this.trunks = new THREE.InstancedMesh(trunkGeo, bark, broad);
    this.canopies = new THREE.InstancedMesh(canopyGeometry(3), leaves, broad);
    const palmTrunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1, 6);
    palmTrunkGeo.translate(0, 0.5, 0);
    this.palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, new THREE.MeshStandardMaterial({ color: '#8a7760', roughness: 1 }), count('palm'));
    this.palmCrowns = new THREE.InstancedMesh(palmCrown(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide }), count('palm'));
    const cyp = new THREE.ConeGeometry(1, 1, 7);
    cyp.translate(0, 0.5, 0);
    this.cypresses = new THREE.InstancedMesh(cyp, leaves, count('cypress'));
    for (const m of [this.trunks, this.canopies, this.palmTrunks, this.palmCrowns, this.cypresses]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.root.add(m);
    }
    this.root.name = 'vegetation';
  }

  private collect(sites: BuildingSite[]) {
    // Rothschild Boulevard: two rows of trees down the promenade.
    const roth = streetById('rothschild');
    const rl = streetLength(roth);
    const rng = mulberry32(hashString('trees'));
    for (let s = 8; s < rl; s += 9) {
      const f = frameAt(roth, s);
      const planted = s < 450 ? 1911 + Math.floor(s / 90) : 1925 + Math.floor((s - 450) / 160);
      for (const side of [-1, 1]) {
        const off = side * ((roth.promenade ?? 14) / 2 - 2.2);
        this.trees.push({
          kind: rng() < 0.08 ? 'palm' : 'ficus',
          x: f.x + f.dz * off,
          z: f.z - f.dx * off,
          planted,
          removed: 9999,
          scale: 0.9 + rng() * 0.3,
          hue: rng(),
          rot: rng() * 6.28,
        });
      }
    }
    // Street trees on other streets, from the 1930s.
    for (const st of STREETS) {
      if (st.id === 'rothschild') continue;
      const len = streetLength(st);
      const off = st.width / 2 - 0.8;
      for (let s = 12; s < len; s += 13) {
        if (rng() < 0.35) continue;
        const f = frameAt(st, s);
        const side = rng() < 0.5 ? -1 : 1;
        this.trees.push({
          kind: rng() < 0.15 ? 'palm' : 'ficus',
          x: f.x + f.dz * off * side,
          z: f.z - f.dx * off * side,
          planted: Math.max(st.paved + 6, 1932) + Math.floor(rng() * 12),
          removed: 9999,
          scale: 0.6 + rng() * 0.3,
          hue: rng(),
          rot: rng() * 6.28,
        });
      }
    }
    // Garden trees around houses, until the plot becomes a tower.
    for (const site of sites) {
      if (site.landmark || site.phases[0]?.style === 'tent') continue;
      const first = site.phases[0];
      if (!first || first.style === 'glass-tower') continue;
      const tower = site.phases.find((p) => p.style === 'glass-tower');
      const r = mulberry32(hashString(site.id + 'garden'));
      const n = first.style === 'jaffa-stone' ? (r() < 0.15 ? 1 : 0) : 1 + Math.floor(r() * 2);
      const c = Math.cos(site.rot);
      const s = Math.sin(site.rot);
      for (let i = 0; i < n; i++) {
        const lx = (r() < 0.5 ? -1 : 1) * (site.width / 2 - 1.2);
        const lz = site.depth / 2 - 1.0 - r() * 1.5;
        const kindR = r();
        this.trees.push({
          kind: kindR < 0.22 ? 'palm' : kindR < 0.32 ? 'cypress' : 'ficus',
          x: site.x + lx * c + lz * s,
          z: site.z - lx * s + lz * c,
          planted: first.from + 1,
          removed: tower ? tower.from - 1 : 9999,
          scale: 0.45 + r() * 0.35,
          hue: r(),
          rot: r() * 6.28,
        });
      }
    }
    // Lone sycamores in the dunes (gone once the city arrives).
    const wr = mulberry32(99);
    for (let i = 0; i < 45; i++) {
      const x = -900 + wr() * 3200;
      const z = -2200 + wr() * 2800;
      if (seaward(x, z) > -80) continue;
      let removed = 2100;
      for (let y = 1900; y < 2000; y++)
        if (devFactor(x, z, y) < 0.6) {
          removed = y;
          break;
        }
      if (removed <= 1900) continue;
      this.trees.push({ kind: 'sycamore', x, z, planted: 1700, removed, scale: 1.1 + wr() * 0.5, hue: wr(), rot: wr() * 6.28 });
    }
  }

  setYear(year: number) {
    const y = Math.floor(year);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let nb = 0;
    let np = 0;
    let nc = 0;
    for (const t of this.trees) {
      if (y < t.planted || y > t.removed) continue;
      const age = y - t.planted;
      const grow = 0.15 + 0.85 * smoothstep(0, t.kind === 'palm' ? 25 : 45, age);
      const gy = baseHeight(t.x, t.z) + 0.1;
      q.setFromAxisAngle(up, t.rot);
      if (t.kind === 'ficus' || t.kind === 'sycamore') {
        const big = t.kind === 'sycamore' ? 1.4 : 1;
        const h = (2.6 + 4.2 * grow) * t.scale * big;
        const r = (1.1 + 3.9 * grow) * t.scale * big;
        m.compose(new THREE.Vector3(t.x, gy, t.z), q, new THREE.Vector3(1 + grow, h, 1 + grow));
        this.trunks.setMatrixAt(nb, m);
        m.compose(new THREE.Vector3(t.x, gy + h + r * 0.35, t.z), q, new THREE.Vector3(r, r, r));
        this.canopies.setMatrixAt(nb, m);
        col.setHSL(0.24 + t.hue * 0.06, 0.38 + t.hue * 0.12, 0.2 + t.hue * 0.08);
        if (t.kind === 'sycamore') col.offsetHSL(0.02, -0.1, 0.03);
        this.canopies.setColorAt(nb, col);
        nb++;
      } else if (t.kind === 'palm') {
        const h = (2 + 13 * grow) * t.scale;
        m.compose(new THREE.Vector3(t.x, gy, t.z), q, new THREE.Vector3(1, h, 1));
        this.palmTrunks.setMatrixAt(np, m);
        const s = 0.6 + 0.6 * grow;
        m.compose(new THREE.Vector3(t.x, gy + h, t.z), q, new THREE.Vector3(s, s, s));
        this.palmCrowns.setMatrixAt(np, m);
        col.setHSL(0.22 + t.hue * 0.05, 0.4, 0.25);
        this.palmCrowns.setColorAt(np, col);
        np++;
      } else {
        const h = (2 + 9 * grow) * t.scale;
        m.compose(new THREE.Vector3(t.x, gy, t.z), q, new THREE.Vector3(0.9 + grow * 0.5, h, 0.9 + grow * 0.5));
        this.cypresses.setMatrixAt(nc, m);
        col.setHSL(0.3, 0.35, 0.16 + t.hue * 0.05);
        this.cypresses.setColorAt(nc, col);
        nc++;
      }
    }
    this.trunks.count = nb;
    this.canopies.count = nb;
    this.palmTrunks.count = np;
    this.palmCrowns.count = np;
    this.cypresses.count = nc;
    for (const im of [this.trunks, this.canopies, this.palmTrunks, this.palmCrowns, this.cypresses]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}
