import * as THREE from 'three';
import type { PhotoSet } from './AssetPack';
import { canonical } from './buildings/KitDressing';

/** The tree kit's models (tools/blender/kits/trees.py). */
export type TreeModel = 'ficus' | 'poinciana' | 'palm_trunk' | 'palm_crown' | 'cypress' | 'shrub' | 'agave' | 'sapling';
const MODELS: TreeModel[] = ['ficus', 'poinciana', 'palm_trunk', 'palm_crown', 'cypress', 'shrub', 'agave', 'sapling'];
const MAX_INSTANCES = 4096;

/**
 * Near trees from the asset pack: bark and leaf cards, one `BatchedMesh` each (two draw calls
 * for every tree in reach), every tree an instance of its model. The leaf cards cut out the
 * leaf atlas (alpha test, so they cast leafy shadows too); their colour is the AO baked into
 * the kit times the instance's tint.
 */
export class TreeKit {
  readonly root = new THREE.Group();
  private bark: THREE.BatchedMesh;
  private leaves: THREE.BatchedMesh;
  private ids = new Map<TreeModel, { bark?: number; leaves?: number }>();
  private used: [THREE.BatchedMesh, number][] = [];

  /** `bark`: the photographed bark set (UVs on the trunks are metres round and along). */
  constructor(scene: THREE.Object3D, atlas: THREE.Texture, bark?: PhotoSet) {
    this.root.name = 'tree-kit';
    scene.updateMatrixWorld(true);
    const parts: { model: TreeModel; mat: 'bark' | 'leaves'; geometry: THREE.BufferGeometry }[] = [];
    for (const node of scene.children) {
      if (!MODELS.includes(node.name as TreeModel)) continue;
      node.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
        if (mat === 'bark' || mat === 'leaves') parts.push({ model: node.name as TreeModel, mat, geometry: canonical(mesh.geometry, mesh.matrixWorld) });
      });
    }
    const batch = (mat: 'bark' | 'leaves', material: THREE.Material) => {
      const list = parts.filter((p) => p.mat === mat);
      const b = new THREE.BatchedMesh(
        MAX_INSTANCES,
        list.reduce((n, p) => n + p.geometry.attributes.position.count, 0),
        list.reduce((n, p) => n + p.geometry.index!.count, 0),
        material,
      );
      b.name = `trees:${mat}`;
      b.castShadow = b.receiveShadow = true;
      b.frustumCulled = false;
      b.perObjectFrustumCulled = true;
      b.sortObjects = false;
      for (const p of list) {
        const e = this.ids.get(p.model) ?? {};
        e[mat] = b.addGeometry(p.geometry);
        this.ids.set(p.model, e);
        p.geometry.dispose();
      }
      this.root.add(b);
      return b;
    };
    atlas.colorSpace = THREE.SRGBColorSpace;
    const tiled = (t: THREE.Texture) => {
      const c = t.clone();
      c.repeat.set(1 / bark!.tile, 1 / bark!.tile);
      return c;
    };
    this.bark = batch(
      'bark',
      new THREE.MeshStandardMaterial(
        bark
          ? { map: tiled(bark.map), normalMap: tiled(bark.normalMap), roughnessMap: tiled(bark.orm), aoMap: tiled(bark.orm), color: '#fbf8f2', roughness: 1, vertexColors: true }
          : { color: '#8f8a80', roughness: 0.95, vertexColors: true },
      ),
    );
    this.leaves = batch(
      'leaves',
      new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, vertexColors: true }),
    );
  }

  /** Drops every tree, before the near ones are laid out again. */
  clear() {
    for (const [b, id] of this.used) b.deleteInstance(id);
    this.used.length = 0;
  }

  /** Adds one tree (or one part of a palm), at `matrix`, its leaves tinted `tint`. */
  add(model: TreeModel, matrix: THREE.Matrix4, tint: THREE.Color): boolean {
    const e = this.ids.get(model);
    if (!e) return false;
    for (const [b, geo] of [
      [this.bark, e.bark],
      [this.leaves, e.leaves],
    ] as [THREE.BatchedMesh, number | undefined][]) {
      if (geo === undefined) continue;
      let id: number;
      try {
        id = b.addInstance(geo);
      } catch {
        return false;
      }
      b.setMatrixAt(id, matrix);
      if (b === this.leaves) b.setColorAt(id, tint);
      this.used.push([b, id]);
    }
    return true;
  }
}
