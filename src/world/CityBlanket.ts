import * as THREE from 'three';
import { hashString, mulberry32 } from '../core/math';
import { firstBuildYear } from '../data/development';
import { JAFFA, NEVE_TZEDEK, RAILWAY, seaward } from '../data/geography';
import { LANDMARKS } from '../data/landmarks';
import { GRID_BEARING, STREETS, halfWidth } from '../data/streets';
import { rectsOverlap, siteRect } from './fabric';
import type { TextureSet } from './textures';

/**
 * The wider city: thousands of simplified instanced blocks that fill the land
 * beyond the detailed core, growing outward and upward with the years.
 */

interface Block {
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  phases: { from: number; to: number; h: number; tower: boolean; color: THREE.Color; ribbon: boolean; roofX: number; roofZ: number }[];
  roofUntil: number;
}

const CELL = 56;
const EXTENT = { x0: -1300, x1: 3800, z0: -3800, z1: 1500 };
const CBD = { x: 1900, z: -1250, r: 1100 }; // the business district around Azrieli / Kaplan

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function nearPolyline(x: number, z: number, pts: [number, number][], r: number) {
  for (let i = 1; i < pts.length; i++) if (distToSegment(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) < r) return true;
  return false;
}

function heightFor(year: number, rng: () => number): number {
  if (year < 1915) return 4 + rng() * 3;
  if (year < 1931) return 7 + rng() * 4;
  if (year < 1949) return 10 + rng() * 4;
  if (year < 1966) return 9 + rng() * 5;
  if (year < 1992) return 12 + rng() * 12;
  return 18 + rng() * 14;
}

function colorFor(year: number, rng: () => number, tower: boolean): THREE.Color {
  if (tower) return new THREE.Color().setHSL(0.56 + rng() * 0.04, 0.12 + rng() * 0.1, 0.62 + rng() * 0.1);
  const l = year < 1931 ? 0.78 : year < 1949 ? 0.88 : year < 1992 ? 0.74 : 0.84;
  const pastel = rng() < 0.18;
  return new THREE.Color().setHSL(pastel ? rng() : 0.08 + rng() * 0.06, pastel ? 0.25 : 0.1 + rng() * 0.25, l + (rng() - 0.5) * 0.12);
}

function worldUVMaterial(map: THREE.Texture, emissive: THREE.Texture, size: [number, number], opts: THREE.MeshStandardMaterialParameters) {
  const m = map.clone();
  const e = emissive.clone();
  for (const t of [m, e]) {
    t.repeat.set(1 / size[0], 1 / size[1]);
    t.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({ map: m, emissiveMap: e, emissive: new THREE.Color(1, 0.86, 0.62), emissiveIntensity: 0, ...opts });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `
      vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec3 lp = position * sc;
      vec2 wuv = abs(normal.y) > 0.5 ? vec2(0.15, 0.3) : (abs(normal.x) > 0.5 ? vec2(lp.z + sc.z * 0.5, lp.y) : vec2(lp.x + sc.x * 0.5, lp.y));
      vMapUv = (mapTransform * vec3(wuv, 1.0)).xy;
      vEmissiveMapUv = (emissiveMapTransform * vec3(wuv, 1.0)).xy;
      `,
    );
  };
  return mat;
}

export class CityBlanket {
  readonly root = new THREE.Group();
  private blocks: Block[] = [];
  private bodies: THREE.InstancedMesh;
  private ribbons: THREE.InstancedMesh;
  private roofRooms: THREE.InstancedMesh;
  private towers: THREE.InstancedMesh;
  private roofs: THREE.InstancedMesh;
  private materials: THREE.MeshStandardMaterial[] = [];
  private year = -1;

  constructor(tex: TextureSet) {
    this.root.name = 'city-blanket';
    this.generate();
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const f = tex.facades.shikun;
    const g = tex.facades.glass;
    const bodyMat = worldUVMaterial(f.map, f.emissive, f.size, { roughness: 0.9 });
    const rb = tex.facades.bauhaus;
    const ribbonMat = worldUVMaterial(rb.map, rb.emissive, rb.size, { roughness: 0.85 });
    const towerMat = worldUVMaterial(g.map, g.emissive, g.size, { roughness: 0.15, metalness: 0.7 });
    this.materials.push(bodyMat, towerMat, ribbonMat);
    const roof = new THREE.ConeGeometry(1, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);
    const n = this.blocks.length;
    this.bodies = new THREE.InstancedMesh(box, bodyMat, n);
    this.ribbons = new THREE.InstancedMesh(box, ribbonMat, n);
    this.roofRooms = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.9 }), n);
    this.towers = new THREE.InstancedMesh(box, towerMat, Math.ceil(n * 0.25));
    const roofMap = tex.roofTile.clone();
    roofMap.needsUpdate = true;
    this.roofs = new THREE.InstancedMesh(roof, new THREE.MeshStandardMaterial({ map: roofMap, color: '#d6d6d6', roughness: 0.8, flatShading: true }), n);
    for (const m of [this.bodies, this.ribbons, this.roofRooms, this.towers, this.roofs]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.count = 0;
      this.root.add(m);
    }
  }

  private generate() {
    const rng = mulberry32(hashString('blanket'));
    const rot = ((90 - GRID_BEARING) * Math.PI) / 180;
    const ax = [Math.cos(rot), -Math.sin(rot)];
    const az = [Math.sin(rot), Math.cos(rot)];
    const landmarkRects = LANDMARKS.map((l) => siteRect(l, 6));
    const span = Math.max(EXTENT.x1 - EXTENT.x0, EXTENT.z1 - EXTENT.z0);
    const cx = (EXTENT.x0 + EXTENT.x1) / 2;
    const cz = (EXTENT.z0 + EXTENT.z1) / 2;
    for (let i = -span / 2; i < span / 2; i += CELL) {
      for (let j = -span / 2; j < span / 2; j += CELL) {
        for (let sub = 0; sub < 4; sub++) {
          const li = i + (sub % 2) * (CELL / 2) + CELL / 4;
          const lj = j + Math.floor(sub / 2) * (CELL / 2) + CELL / 4;
          const x = cx + ax[0] * li + az[0] * lj;
          const z = cz + ax[1] * li + az[1] * lj;
          if (x < EXTENT.x0 || x > EXTENT.x1 || z < EXTENT.z0 || z > EXTENT.z1) continue;
          if (seaward(x, z) > -70) continue;
          if (Math.hypot(x - JAFFA.x, z - JAFFA.z) < JAFFA.r + 60) continue;
          if (Math.hypot(x - NEVE_TZEDEK.x, z - NEVE_TZEDEK.z) < NEVE_TZEDEK.r + 50) continue;
          if (STREETS.some((st) => nearPolyline(x, z, st.points, halfWidth(st) + 30))) continue;
          if (nearPolyline(x, z, RAILWAY, 14)) continue;
          if (rng() < 0.2) continue;
          const w = 9 + rng() * 13;
          const d = 8 + rng() * 11;
          const brot = rot + (rng() - 0.5) * 0.08;
          const r = { x, z, hw: w / 2, hd: d / 2, rot: brot };
          if (landmarkRects.some((lr) => rectsOverlap(lr, r))) continue;
          const y0 = Math.max(1911, firstBuildYear(x, z)) + Math.floor(rng() * 6);
          if (y0 > 2025) continue;
          const block: Block = { x, z, rot: brot, w, d, phases: [], roofUntil: -1 };
          let y = y0;
          for (let k = 0; k < 4 && y <= 2025; k++) {
            const h = heightFor(y, rng);
            const replaceP = y < 1915 ? 0.85 : y < 1931 ? 0.4 : y < 1949 ? 0.12 : y < 1992 ? 0.3 : 0;
            const end = rng() < replaceP ? Math.min(2025, y + 15 + Math.floor(rng() * 40)) : 2025;
            const nearCbd = Math.max(0, 1 - Math.hypot(x - CBD.x, z - CBD.z) / CBD.r);
            const tower = y >= 1998 && rng() < 0.02 + nearCbd * 0.35;
            const ph = tower ? 50 + rng() * (60 + nearCbd * 120) : h;
            block.phases.push({
              from: y,
              to: end,
              h: ph,
              tower,
              color: colorFor(y, rng, tower),
              ribbon: y >= 1931 && y < 1949 ? rng() < 0.85 : y >= 1992 && rng() < 0.4,
              roofX: (rng() - 0.5) * 0.5,
              roofZ: (rng() - 0.5) * 0.5,
            });
            if (y < 1915) block.roofUntil = end;
            if (end >= 2025) break;
            y = end + 2;
          }
          this.blocks.push(block);
        }
      }
    }
  }

  setYear(year: number) {
    const y = Math.floor(year);
    if (y === this.year) return;
    this.year = y;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let nb = 0;
    let nrb = 0;
    let nrr = 0;
    let nt = 0;
    let nr = 0;
    for (const b of this.blocks) {
      const ph = b.phases.find((x) => y >= x.from && y <= x.to);
      if (!ph) continue;
      q.setFromAxisAngle(up, b.rot);
      p.set(b.x, 0, b.z);
      if (ph.tower) {
        if (nt >= this.towers.instanceMatrix.count) continue;
        s.set(b.w, ph.h, b.d);
        m.compose(p, q, s);
        this.towers.setMatrixAt(nt, m);
        this.towers.setColorAt(nt++, ph.color);
      } else {
        s.set(b.w, ph.h, b.d);
        m.compose(p, q, s);
        if (ph.ribbon) {
          this.ribbons.setMatrixAt(nrb, m);
          this.ribbons.setColorAt(nrb++, ph.color);
        } else {
          this.bodies.setMatrixAt(nb, m);
          this.bodies.setColorAt(nb++, ph.color);
        }
        if (ph.from >= 1931 && ph.h > 8) {
          const c = Math.cos(b.rot);
          const sn = Math.sin(b.rot);
          const lx = ph.roofX * b.w;
          const lz = ph.roofZ * b.d;
          p.set(b.x + lx * c + lz * sn, ph.h, b.z - lx * sn + lz * c);
          s.set(b.w * 0.3, 2.6, b.d * 0.35);
          m.compose(p, q, s);
          this.roofRooms.setMatrixAt(nrr++, m);
          p.set(b.x, 0, b.z);
        }
        if (y <= b.roofUntil && ph.from < 1915) {
          p.y = ph.h;
          s.set(b.w * 0.75, 2.6, b.d * 0.75);
          m.compose(p, q, s);
          this.roofs.setMatrixAt(nr++, m);
        }
      }
    }
    this.bodies.count = nb;
    this.ribbons.count = nrb;
    this.roofRooms.count = nrr;
    this.towers.count = nt;
    this.roofs.count = nr;
    for (const im of [this.bodies, this.ribbons, this.roofRooms, this.towers, this.roofs]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }

  setNight(n: number) {
    for (const mt of this.materials) mt.emissiveIntensity = n * 1.4;
  }

  get count() {
    return this.bodies.count + this.ribbons.count + this.towers.count;
  }
}
