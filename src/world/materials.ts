import * as THREE from 'three';
import type { AssetPack } from './AssetPack';
import { buildingShader, photoDetail, type BuildingShader } from './buildingShader';
import type { PhotoSet } from './AssetPack';
import type { TextureSet } from './textures';

export type MatKey =
  | 'plaster'
  | 'arched'
  | 'bauhaus'
  | 'shikun'
  | 'concrete'
  | 'modern'
  | 'glass'
  | 'roof'
  | 'stone'
  | 'trim'
  | 'dark'
  | 'metal'
  | 'rail'
  | 'canvas'
  | 'water'
  | 'wood';

export interface MaterialLibrary {
  get(key: MatKey): THREE.Material;
  /** 0 = day, 1 = night: drives lit windows. */
  setNight(n: number): void;
  /** Lays the pack's photo materials over the buildings (resolves once they are in). */
  applyPack(pack: AssetPack): Promise<void>;
  /**
   * The material of kit modules made of `key` (KitDressing): the building material with UVs
   * and weathering taken per instance, and the same photo detail.
   */
  kit(key: MatKey): THREE.MeshStandardMaterial;
  ghost: THREE.Material;
  highlight: THREE.MeshStandardMaterial;
}

export function createMaterials(tex: TextureSet): MaterialLibrary {
  const facadeMats: THREE.MeshStandardMaterial[] = [];
  const facade = (k: keyof TextureSet['facades'], opts: THREE.MeshStandardMaterialParameters = {}) => {
    const f = tex.facades[k];
    const map = f.map.clone();
    const em = f.emissive.clone();
    for (const t of [map, em]) {
      t.repeat.set(1 / f.size[0], 1 / f.size[1]);
      t.needsUpdate = true;
    }
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map,
      emissiveMap: em,
      emissive: new THREE.Color(1, 0.86, 0.62),
      emissiveIntensity: 0,
      roughness: 0.88,
      metalness: 0,
      ...opts,
    });
    facadeMats.push(m);
    return m;
  };
  const tiled = (t: THREE.Texture, metres: number, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const map = t.clone();
    map.repeat.set(1 / metres, 1 / metres);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.9, ...opts });
  };

  const mats: Record<MatKey, THREE.Material> = {
    plaster: facade('plaster'),
    arched: facade('arched'),
    bauhaus: facade('bauhaus', { roughness: 0.82 }),
    shikun: facade('shikun'),
    concrete: facade('concrete', { roughness: 0.95 }),
    modern: facade('modern', { roughness: 0.6 }),
    glass: facade('glass', { roughness: 0.12, metalness: 0.75 }),
    roof: tiled(tex.roofTile, 4, { roughness: 0.75 }),
    stone: tiled(tex.stone, 4),
    trim: tiled(tex.plaster, 4, { roughness: 0.85, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.4 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.7 }),
    rail: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.05,
      metalness: 0.3,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
    canvas: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.2 }),
    wood: tiled(tex.plaster, 2, { roughness: 0.8 }),
  };

  const ghost = new THREE.MeshBasicMaterial({
    color: 0x7fc8ff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    depthTest: false,
  });
  const highlight = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84a, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, depthWrite: false });

  // every building material ages with its phase; the pack later adds photo detail
  const shaders = new Map<MatKey, BuildingShader>();
  for (const [k, m] of Object.entries(mats) as [MatKey, THREE.Material][]) {
    if (m instanceof THREE.MeshStandardMaterial && !['glass', 'rail', 'water', 'dark'].includes(k)) shaders.set(k, buildingShader(m));
  }
  // which photo set goes on which material, how strongly, and whether it replaces the canvas
  const photo: [MatKey, string, number, boolean][] = [
    ['plaster', 'plaster', 0.75, false],
    ['arched', 'plaster', 0.75, false],
    ['bauhaus', 'plaster', 0.5, false],
    ['shikun', 'plaster', 0.65, false],
    ['concrete', 'plaster', 0.6, false],
    ['modern', 'plaster', 0.3, false],
    ['trim', 'plaster', 0.6, false],
    ['roof', 'roof', 1, true],
    ['stone', 'stone', 1, true],
  ];

  const applied = new Map<MatKey, [PhotoSet, number, boolean]>();
  const kits = new Map<MatKey, [THREE.MeshStandardMaterial, BuildingShader]>();

  return {
    get: (k) => mats[k],
    async applyPack(pack) {
      const used = photo.filter(([, set]) => pack.has(set));
      const sets = await Promise.all(used.map(([, set]) => pack.material(set)));
      used.forEach(([k, , strength, replace], i) => {
        applied.set(k, [sets[i], strength, replace]);
        photoDetail(mats[k] as THREE.MeshStandardMaterial, shaders.get(k)!, sets[i], strength, replace);
        const kit = kits.get(k);
        if (kit) photoDetail(kit[0], kit[1], sets[i], strength, replace);
      });
    },
    kit(k) {
      let kit = kits.get(k);
      if (!kit) {
        const m = (mats[k] as THREE.MeshStandardMaterial).clone();
        m.defines = { STANDARD: '' };
        m.side = THREE.FrontSide;
        kit = [m, buildingShader(m, true)];
        kits.set(k, kit);
        const a = applied.get(k);
        if (a) photoDetail(m, kit[1], ...a);
      }
      return kit[0];
    },
    setNight(n) {
      for (const m of facadeMats) m.emissiveIntensity = n * 1.6;
    },
    ghost,
    highlight,
  };
}
