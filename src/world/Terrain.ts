import * as THREE from 'three';
import { fbm2, interpKeys, lerp, smoothstep } from '../core/math';
import { devFactor } from '../data/development';
import { SEA_LEVEL, baseHeight, seaward, settledMask } from '../data/geography';
import type { TextureSet } from './textures';

const SIZE = 9000;
const SEG = 300;

/** Dune height field (metres) — wind-shaped ridges running roughly NNE like the coast. */
export function duneHeight(x: number, z: number): number {
  const u = x * 0.94 + z * 0.34;
  const v = -x * 0.34 + z * 0.94;
  const ridges = Math.pow(Math.abs(Math.sin(u * 0.021 + fbm2(x * 0.004, z * 0.004) * 3)), 1.6);
  const hills = fbm2(x * 0.006 + 13, z * 0.006 - 7, 4) * 0.5 + 0.5;
  return (ridges * 4.5 + hills * 7) * (0.6 + 0.4 * Math.sin(v * 0.004));
}

/**
 * The ground: sand dunes that flatten into streets and gardens as the city grows.
 * Heights and colours are recomputed on the CPU when the year changes.
 */
export class Terrain {
  readonly mesh: THREE.Mesh;
  private base: Float32Array;
  private dune: Float32Array;
  private xz: Float32Array;
  private noiseA: Float32Array;
  private noiseB: Float32Array;
  private lastYear = -1;

  constructor(tex: TextureSet) {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const n = pos.count;
    this.base = new Float32Array(n);
    this.dune = new Float32Array(n);
    this.xz = new Float32Array(n * 2);
    this.noiseA = new Float32Array(n);
    this.noiseB = new Float32Array(n);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      this.xz[i * 2] = x;
      this.xz[i * 2 + 1] = z;
      this.base[i] = baseHeight(x, z);
      const inland = 1 - smoothstep(-160, -30, seaward(x, z));
      this.dune[i] = duneHeight(x, z) * inland * (1 - settledMask(x, z));
      this.noiseA[i] = 0.5 + 0.5 * fbm2(x * 0.02, z * 0.02);
      this.noiseB[i] = lerp(0.92, 1.06, fbm2(x * 0.05, z * 0.05) * 0.5 + 0.5);
      uv.setXY(i, x / 24, z / 24);
    }
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const map = tex.sand.clone();
    map.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.97 });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }

  setYear(year: number) {
    const y = Math.round(year * 2) / 2;
    if (y === this.lastYear) return;
    this.lastYear = y;
    const g = this.mesh.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = g.attributes.color as THREE.BufferAttribute;
    const sand = new THREE.Color('#e3cfa5');
    const wetSand = new THREE.Color('#bda57c');
    // Urban ground: packed earth in the early years, paved and dusty grey later.
    const t = smoothstep(1915, 1960, y);
    const urban = new THREE.Color('#cdb994').lerp(new THREE.Color('#a29c90'), t);
    const garden = new THREE.Color('#8f9a63');
    const c = new THREE.Color();
    const greenery = interpKeys(
      [
        [1909, 0],
        [1925, 0.25],
        [1960, 0.35],
        [2025, 0.3],
      ],
      y,
    );
    for (let i = 0; i < pos.count; i++) {
      const x = this.xz[i * 2];
      const z = this.xz[i * 2 + 1];
      const wild = devFactor(x, z, y);
      pos.setY(i, this.base[i] + this.dune[i] * wild);
      const sw = seaward(x, z);
      c.copy(urban).lerp(garden, greenery * this.noiseA[i]);
      c.lerp(sand, wild);
      if (sw > -70) c.lerp(sand, smoothstep(-70, -40, sw));
      if (sw > -20) c.lerp(wetSand, smoothstep(-20, 10, sw));
      const k = this.noiseB[i];
      col.setXYZ(i, c.r * k, c.g * k, c.b * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    g.computeVertexNormals();
  }

  static seaLevel = SEA_LEVEL;
}
