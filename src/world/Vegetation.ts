import * as THREE from 'three';
import { hashString, mulberry32, smoothstep, valueNoise2 } from '../core/math';
import { devFactor } from '../data/development';
import { baseHeight, seaward } from '../data/geography';
import { STREETS, frameAt, streetById, streetLength } from '../data/streets';
import type { BuildingSite } from '../data/types';
import { PAVED_MIDDLE } from './Streets';
import type { TreeKit } from './TreeKit';

/** `shrub` and `agave` are the boulevard bed's planting: drawn from the kit only, near the camera. */
type Kind = 'ficus' | 'poinciana' | 'palm' | 'sycamore' | 'cypress' | 'shrub' | 'agave';

interface Tree {
  kind: Kind;
  x: number;
  z: number;
  planted: number;
  removed: number;
  scale: number;
  hue: number;
  rot: number;
  /** Planted in a street (boulevard or sidewalk) rather than a garden or the dunes. */
  street?: boolean;
  /** What protects it while young: a ladder guard (Herzl, 1910s) or a single stake. */
  guard?: 'ladder' | 'stake';
}

/** A street tree young enough for a guard round it: where, which guard, and the years it has one. */
export interface TreeGuard {
  x: number;
  z: number;
  kind: 'ladder' | 'stake';
  from: number;
  to: number;
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
  /** The pack's tree models, drawn for trees near the camera (the blobs stand in further out). */
  private kit?: TreeKit;
  private year = -1;
  private near = { at: new THREE.Vector3(Infinity, 0, 0), radius: 0 };

  constructor(sites: BuildingSite[]) {
    this.collect(sites);
    const count = (k: Kind) => this.trees.filter((t) => t.kind === k).length;
    const broad = count('ficus') + count('poinciana') + count('sycamore');
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
    // Rothschild Boulevard, from the photographs (docs/REFERENCE_BOARD.md). Planted from 1911:
    // rows of Italian cypress along both edges of the promenade (the 1920s prints; gone by the
    // 1940s prints: removal year approximate). Royal poinciana reached the country in the 1920s
    // and the ficus came in the 1930s (municipal archives via the UW horticulture library);
    // they alternate in the inner rows. The northern stretch was planted later.
    const roth = streetById('rothschild');
    const rl = streetLength(roth);
    const rng = mulberry32(hashString('trees'));
    const prom = (roth.promenade ?? 14) / 2;
    const later = (s: number) => (s < 450 ? 0 : 14);
    const street = (kind: Kind, x: number, z: number, planted: number, removed: number, scale: number, guard?: Tree['guard']): Tree => ({
      kind,
      x,
      z,
      planted,
      removed,
      scale,
      hue: rng(),
      rot: rng() * 6.28,
      street: true,
      guard,
    });
    for (let s = 6; s < rl; s += 4.5) {
      const f = frameAt(roth, s);
      for (const side of [-1, 1]) {
        const off = side * (prom - 0.9);
        this.trees.push(street('cypress', f.x + f.dz * off, f.z - f.dx * off, 1911 + later(s), 1938, 0.95 + rng() * 0.2));
      }
    }
    for (let s = 8, i = 0; s < rl; s += 9, i++) {
      const f = frameAt(roth, s);
      for (const side of [-1, 1]) {
        const off = side * (prom - 2.1);
        const ficus = (i + (side > 0 ? 1 : 0)) % 2 === 0;
        const planted = (ficus ? 1933 : 1925) + later(s) / 2 + Math.floor(rng() * 3);
        this.trees.push(street(ficus ? 'ficus' : 'poinciana', f.x + f.dz * off, f.z - f.dx * off, planted, 9999, 0.95 + rng() * 0.25, 'stake'));
      }
    }
    // the planted bed down the middle, until the path is paved (1920s prints): low flowering
    // shrubs either side of its axis, an agave every so often
    for (let s = 5, i = 0; s < rl; s += 2.8, i++) {
      const f = frameAt(roth, s);
      const agave = i % 9 === 4;
      const off = agave ? 0 : (i % 2 ? 0.75 : -0.75);
      this.trees.push(street(agave ? 'agave' : 'shrub', f.x + f.dz * off, f.z - f.dx * off, 1912 + later(s), PAVED_MIDDLE - 1, 0.8 + rng() * 0.4));
    }
    // Herzl Street, 1910s: saplings at the kerb in ladder guards (Soskin's prints of 1910–11).
    // Their kind is not known (illustrative); by the 1930s Herzl is a street of shops.
    // Only along the stretch built by then (site ids carry their distance along the street).
    const herzl = streetById('herzl');
    const built = sites.filter((x) => /^herzl-/.test(x.id) && (x.phases[0]?.from ?? 9999) <= 1912).map((x) => Number(x.id.split('-').pop()));
    const kerb = herzl.width / 2 - herzl.sidewalk + 0.6;
    for (let s = Math.min(...built) - 10; s < Math.max(...built) + 10; s += 9)
      for (const side of [-1, 1]) {
        const f = frameAt(herzl, s);
        this.trees.push(street('ficus', f.x + f.dz * kerb * side, f.z - f.dx * kerb * side, 1910, 1934, 0.6 + rng() * 0.2, 'ladder'));
      }
    // Street trees on the other streets, from the 1930s: poinciana and ficus, a few palms.
    for (const st of STREETS) {
      if (st.id === 'rothschild' || st.id === 'herzl') continue;
      const len = streetLength(st);
      const off = st.width / 2 - 0.8;
      for (let s = 12; s < len; s += 13) {
        if (rng() < 0.35) continue;
        const f = frameAt(st, s);
        const side = rng() < 0.5 ? -1 : 1;
        const k = rng();
        const kind: Kind = k < 0.15 ? 'palm' : k < 0.6 ? 'poinciana' : 'ficus';
        const planted = Math.max(st.paved + 6, 1932) + Math.floor(rng() * 12);
        this.trees.push(street(kind, f.x + f.dz * off * side, f.z - f.dx * off * side, planted, 9999, 0.6 + rng() * 0.3, kind === 'palm' ? undefined : 'stake'));
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

  /**
   * Young street trees and what protects them, as the prints show: ladder guards on Herzl in the
   * 1910s, a single stake elsewhere; palms and cypresses none.
   */
  guards(): TreeGuard[] {
    return this.trees
      .filter((t) => t.guard)
      .map((t) => ({ x: t.x, z: t.z, kind: t.guard!, from: t.planted, to: Math.min(t.removed, t.planted + (t.guard === 'ladder' ? 9 : 8)) }));
  }

  /** Turns on the pack's tree models for trees within the radius given to `setDetail`. */
  setKit(kit: TreeKit) {
    this.kit = kit;
    this.root.add(kit.root);
    if (this.year >= 0) this.layout();
  }

  /** Where the near trees are counted from (the camera) and how far; re-lays them out every few metres. */
  setDetail(at: THREE.Vector3, radius: number): boolean {
    if (!this.kit) return false;
    if (at.distanceToSquared(this.near.at) < 36 && radius === this.near.radius) return false;
    this.near.at.copy(at);
    this.near.radius = radius;
    if (this.year >= 0) this.layout();
    return true;
  }

  setYear(year: number) {
    const y = Math.floor(year);
    if (y === this.year) return;
    this.year = y;
    this.layout();
  }

  private layout() {
    const y = this.year;
    const kit = this.kit;
    kit?.clear();
    const { at, radius } = this.near;
    const r2 = radius * radius;
    const s3 = new THREE.Vector3();
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
      // street trees stand in the raised boulevard or sidewalk
      const gy = baseHeight(t.x, t.z) + (t.street ? 0.18 : 0.1);
      q.setFromAxisAngle(up, t.rot);
      const near = kit && (t.x - at.x) ** 2 + (t.z - at.z) ** 2 + (gy - at.y) ** 2 < r2;
      if (t.kind === 'shrub' || t.kind === 'agave') {
        if (near) this.addKitTree(kit, t, grow, gy, m, q, s3, col);
        continue;
      }
      if (near && this.addKitTree(kit, t, grow, gy, m, q, s3, col)) continue;
      if (t.kind === 'ficus' || t.kind === 'poinciana' || t.kind === 'sycamore') {
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

  /**
   * One tree from the kit, scaled by its growth (the models are mature trees).
   */
  private addKitTree(kit: TreeKit, t: Tree, grow: number, gy: number, m: THREE.Matrix4, q: THREE.Quaternion, s: THREE.Vector3, col: THREE.Color): boolean {
    const p = new THREE.Vector3(t.x, gy, t.z);
    col.setHSL(0.2 + t.hue * 0.08, 0.25 + t.hue * 0.2, 0.82 + t.hue * 0.1);
    if (t.kind === 'ficus' || t.kind === 'poinciana' || t.kind === 'sycamore') {
      // a young tree is a thin stem with a few leaves, not a small copy of the grown one
      if (grow < 0.4) return kit.add('sapling', m.compose(p, q, s.setScalar(0.7 + grow)), col);
      const k = (0.2 + 0.8 * grow) * t.scale * (t.kind === 'sycamore' ? 1.4 : 1);
      return kit.add(t.kind === 'poinciana' ? 'poinciana' : 'ficus', m.compose(p, q, s.setScalar(k)), col);
    }
    if (t.kind === 'shrub' || t.kind === 'agave') {
      // agaves are blue-grey
      if (t.kind === 'agave') col.set('#b4c9c4');
      return kit.add(t.kind, m.compose(p, q, s.setScalar((0.4 + 0.6 * grow) * t.scale)), col);
    }
    if (t.kind === 'palm') {
      const h = (2 + 13 * grow) * t.scale;
      const k = 0.55 + 0.5 * grow;
      if (!kit.add('palm_trunk', m.compose(p, q, s.set(1, h, 1)), col)) return false;
      p.y += h;
      return kit.add('palm_crown', m.compose(p, q, s.setScalar(k)), col);
    }
    const h = (2 + 9 * grow) * t.scale;
    return kit.add('cypress', m.compose(p, q, s.set(0.5 + h / 20, h / 10.3, 0.5 + h / 20)), col);
  }
}
