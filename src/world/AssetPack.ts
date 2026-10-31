import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Texture set of a pack: 1K for phones, 2K otherwise. */
export type PackRes = '1k' | '2k';

export interface PackManifest {
  materials: Record<
    string,
    {
      /** Real-world size of one repeat, metres. */
      tile: number;
      /** Mean linear colour of the photo, so it can be used as detail on top of a painted colour. */
      mean: [number, number, number];
      /** Mean roughness. */
      roughness: number;
      maps: Record<PackRes, { color: string; normal: string; orm: string }>;
    }
  >;
  /** Single textures by name (the tree kit's leaf atlas), per size. */
  textures?: Record<string, Record<PackRes, string>>;
  kits: Record<string, string>;
}

/** A photo-sourced PBR set: colour (sRGB), normal, and ambient occlusion + roughness (R, G). */
export interface PhotoSet {
  name: string;
  tile: number;
  mean: THREE.Vector3;
  roughness: number;
  map: THREE.Texture;
  normalMap: THREE.Texture;
  orm: THREE.Texture;
}

/**
 * The optional asset pack in `public/pack/` (built by `npm run assets:build`, see
 * tools/assets/pack.mjs): KTX2 photo materials and meshopt glTF kits. Without it the game keeps
 * its procedural canvas textures, so a missing pack only costs looks.
 */
export class AssetPack {
  private ktx2: KTX2Loader;
  private gltf: GLTFLoader;
  private sets = new Map<string, Promise<PhotoSet>>();

  private constructor(
    readonly manifest: PackManifest,
    readonly res: PackRes,
    private base: string,
    renderer: THREE.WebGLRenderer,
    private anisotropy: number,
  ) {
    this.ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
    this.gltf = new GLTFLoader().setKTX2Loader(this.ktx2).setMeshoptDecoder(MeshoptDecoder);
  }

  /** The pack, or null when there is none (nothing built or fetched). */
  static async load(renderer: THREE.WebGLRenderer, res: PackRes, base = `${import.meta.env.BASE_URL}pack/`): Promise<AssetPack | null> {
    try {
      const r = await fetch(`${base}manifest.json`);
      if (!r.ok) return null;
      const manifest = (await r.json()) as PackManifest;
      const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), res === '1k' ? 4 : 8);
      return new AssetPack(manifest, res, base, renderer, anisotropy);
    } catch {
      return null;
    }
  }

  has(name: string) {
    return name in this.manifest.materials;
  }

  /** A photo set's textures, loaded once (repeat wrapping, mipmapped). */
  material(name: string): Promise<PhotoSet> {
    let p = this.sets.get(name);
    if (!p) this.sets.set(name, (p = this.loadSet(name)));
    return p;
  }

  /** A single texture of the pack (sRGB colour, mipmapped), or null if the pack has none by that name. */
  async texture(name: string): Promise<THREE.Texture | null> {
    const file = this.manifest.textures?.[name]?.[this.res];
    if (!file) return null;
    const t = await this.ktx2.loadAsync(this.base + file);
    t.anisotropy = this.anisotropy;
    return t;
  }

  /** A kit (glTF scene of modules), for the kits of step 3. */
  kit(name: string): Promise<GLTF> {
    const file = this.manifest.kits[name];
    if (!file) return Promise.reject(new Error(`no kit ${name} in the pack`));
    return this.gltf.loadAsync(this.base + file);
  }

  private async loadSet(name: string): Promise<PhotoSet> {
    const m = this.manifest.materials[name];
    if (!m) throw new Error(`no material ${name} in the pack`);
    const files = m.maps[this.res];
    const [map, normalMap, orm] = await Promise.all(
      [files.color, files.normal, files.orm].map((f) => this.ktx2.loadAsync(this.base + f)),
    );
    for (const t of [map, normalMap, orm]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = this.anisotropy;
    }
    // the colour map is tagged sRGB in the file; the data maps are linear
    normalMap.colorSpace = orm.colorSpace = THREE.NoColorSpace;
    return { name, tile: m.tile, mean: new THREE.Vector3(...m.mean), roughness: m.roughness, map, normalMap, orm };
  }
}
