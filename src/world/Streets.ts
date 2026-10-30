import * as THREE from 'three';
import { RAILWAY, RAILWAY_YEARS, baseHeight } from '../data/geography';
import { STREETS, frameAt, streetLength } from '../data/streets';
import type { Street } from '../data/types';
import type { AssetPack } from './AssetPack';
import type { TextureSet } from './textures';

/** Lateral band of a street: [from, to] offsets from the centreline (metres). */
function ribbon(points: [number, number][], o1: number, o2: number, lift: number, step = 8): THREE.BufferGeometry {
  const st = { points } as Street;
  const len = streetLength(st);
  const n = Math.max(2, Math.ceil(len / step) + 1);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * len;
    const f = frameAt(st, s);
    // left normal = (dz, -dx)
    for (const o of [o1, o2]) {
      const x = f.x + f.dz * o;
      const z = f.z - f.dx * o;
      pos.push(x, baseHeight(x, z) + lift, z);
      uv.push(o, s);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure normals point up regardless of winding
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) if (nor.getY(i) < 0) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  return g;
}

interface StreetMeshes {
  street: Street;
  dirt: THREE.Mesh[];
  paved: THREE.Mesh[];
  sidewalks: THREE.Mesh[];
  promenade: THREE.Mesh[];
}

/** Streets that appear as sandy tracks, then get paved, kerbed and lit. */
export class Streets {
  readonly root = new THREE.Group();
  private items: StreetMeshes[] = [];
  private rail: THREE.Group;
  private lamps: THREE.InstancedMesh;
  private lampHeads: THREE.InstancedMesh;
  private lampData: { year: number; matrix: THREE.Matrix4 }[] = [];
  readonly lampMaterial: THREE.MeshStandardMaterial;
  /** Surfaces that take a photo set from the asset pack, and the tint it gets. */
  private surfaces: { mat: THREE.MeshStandardMaterial; set: string; tint: string }[] = [];

  constructor(tex: TextureSet) {
    this.root.name = 'streets';
    const mk = (t: THREE.Texture, repeat: number, color: string, rough = 0.95) => {
      const map = t.clone();
      map.repeat.set(1 / repeat, 1 / repeat);
      map.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map, color, roughness: rough, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    };
    const dirtMat = mk(tex.sand, 10, '#cdb48a');
    const asphaltMat = mk(tex.asphalt, 6, '#c9c5bc', 0.9);
    const pavingMat = mk(tex.paving, 2.5, '#ffffff');
    const promenadeMat = mk(tex.sand, 8, '#d8c6a0');
    this.surfaces = [
      { mat: dirtMat, set: 'sand', tint: '#f0e4cc' },
      { mat: asphaltMat, set: 'asphalt', tint: '#ebe3d6' },
      { mat: pavingMat, set: 'paving', tint: '#f4eee4' },
      { mat: promenadeMat, set: 'sand', tint: '#f6ecd8' },
    ];

    STREETS.forEach((st, i) => {
      const lift = 0.04 + i * 0.006;
      const prom = (st.promenade ?? 0) / 2;
      const road = st.width / 2 - st.sidewalk;
      const item: StreetMeshes = { street: st, dirt: [], paved: [], sidewalks: [], promenade: [] };
      const bands: [number, number][] = prom ? [[prom, prom + road], [-prom - road, -prom]] : [[-road, road]];
      for (const [a, b] of bands) {
        item.dirt.push(new THREE.Mesh(ribbon(st.points, a - st.sidewalk * (a < 0 ? 1 : 0), b + st.sidewalk * (b > 0 ? 1 : 0), lift), dirtMat));
        item.paved.push(new THREE.Mesh(ribbon(st.points, a, b, lift + 0.01), asphaltMat));
      }
      const outer = prom + road;
      item.sidewalks.push(new THREE.Mesh(ribbon(st.points, outer, outer + st.sidewalk, lift + 0.15), pavingMat));
      item.sidewalks.push(new THREE.Mesh(ribbon(st.points, -outer - st.sidewalk, -outer, lift + 0.15), pavingMat));
      if (prom) {
        item.promenade.push(new THREE.Mesh(ribbon(st.points, -prom, prom, lift + 0.05), promenadeMat));
        item.sidewalks.push(new THREE.Mesh(ribbon(st.points, -1.6, 1.6, lift + 0.12), pavingMat));
      }
      for (const m of [...item.dirt, ...item.paved, ...item.sidewalks, ...item.promenade]) {
        m.receiveShadow = true;
        m.visible = false;
        this.root.add(m);
      }
      this.items.push(item);
      this.collectLamps(st);
    });

    // Railway: ballast and rails
    this.rail = new THREE.Group();
    const ballast = new THREE.Mesh(ribbon(RAILWAY, -2.2, 2.2, 0.08), mk(tex.stone, 3, '#8d8273'));
    ballast.receiveShadow = true;
    const railMat = new THREE.MeshStandardMaterial({ color: '#5c534a', metalness: 0.7, roughness: 0.4 });
    this.rail.add(ballast, new THREE.Mesh(ribbon(RAILWAY, 0.62, 0.72, 0.3), railMat), new THREE.Mesh(ribbon(RAILWAY, -0.72, -0.62, 0.3), railMat));
    this.root.add(this.rail);

    // Street lamps (electric street lighting spread through the 1920s)
    const post = new THREE.CylinderGeometry(0.07, 0.1, 5, 6);
    post.translate(0, 2.5, 0);
    const head = new THREE.SphereGeometry(0.28, 10, 8);
    head.translate(0, 5.1, 0);
    this.lamps = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ color: '#2f3432', metalness: 0.5, roughness: 0.5 }), this.lampData.length);
    this.lampMaterial = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 0 });
    this.lampHeads = new THREE.InstancedMesh(head, this.lampMaterial, this.lampData.length);
    this.lamps.castShadow = true;
    this.root.add(this.lamps, this.lampHeads);
  }

  private collectLamps(st: Street) {
    const len = streetLength(st);
    const off = st.width / 2 + (st.promenade ?? 0) / 2 - st.sidewalk + 0.6;
    for (let s = 10; s < len; s += 32) {
      const f = frameAt(st, s);
      for (const side of [1, -1]) {
        const x = f.x + f.dz * off * side;
        const z = f.z - f.dx * off * side;
        const year = Math.max(1924, st.paved) + Math.floor((s / len) * 6);
        this.lampData.push({ year, matrix: new THREE.Matrix4().makeTranslation(x, baseHeight(x, z) + 0.15, z) });
      }
    }
  }

  setYear(year: number) {
    const y = Math.floor(year);
    for (const it of this.items) {
      const open = y >= it.street.opened;
      const paved = y >= it.street.paved;
      for (const m of it.dirt) m.visible = open && !paved;
      for (const m of it.promenade) m.visible = open;
      for (const m of it.paved) m.visible = paved;
      for (const m of it.sidewalks) m.visible = paved;
    }
    this.rail.visible = y >= RAILWAY_YEARS.from && y <= RAILWAY_YEARS.to;
    let n = 0;
    for (const l of this.lampData) {
      if (y < l.year) continue;
      this.lamps.setMatrixAt(n, l.matrix);
      this.lampHeads.setMatrixAt(n, l.matrix);
      n++;
    }
    this.lamps.count = n;
    this.lampHeads.count = n;
    this.lamps.instanceMatrix.needsUpdate = true;
    this.lampHeads.instanceMatrix.needsUpdate = true;
  }

  /** Swaps the canvas textures of roads and sidewalks for the pack's photo sets. */
  async applyPack(pack: AssetPack) {
    const used = this.surfaces.filter((s) => pack.has(s.set));
    const sets = await Promise.all(used.map((s) => pack.material(s.set)));
    used.forEach(({ mat, tint }, i) => {
      const set = sets[i];
      // UVs are metres across and along the street; clones share the uploaded texture
      const tiled = (t: THREE.Texture) => {
        const c = t.clone();
        c.repeat.set(1 / set.tile, 1 / set.tile);
        return c;
      };
      mat.map = tiled(set.map);
      mat.normalMap = tiled(set.normalMap);
      mat.roughnessMap = mat.aoMap = tiled(set.orm);
      mat.roughness = 1;
      mat.color.set(tint);
      mat.needsUpdate = true;
    });
  }

  setNight(n: number) {
    this.lampMaterial.emissiveIntensity = n * 6;
  }
}
