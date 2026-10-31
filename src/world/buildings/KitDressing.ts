import * as THREE from 'three';
import type { MaterialLibrary } from '../materials';
import type { KitMat, Placement } from './facadeGrammar';

/** One module instance's share of one material batch. */
export interface DressSlot {
  batch: THREE.BatchedMesh;
  id: number;
  /** The placement in building-local space. */
  local: THREE.Matrix4;
}

const KIT_MATS: KitMat[] = ['trim', 'stone', 'wood', 'metal'];
const FALLBACK: Record<KitMat, string> = { trim: '#f4ecdc', stone: '#d6c9ad', wood: '#5b7f8f', metal: '#3a3f3c' };
const MAX_INSTANCES = 16384;

const color = new THREE.Color();
const matrix = new THREE.Matrix4();
const turn = new THREE.Matrix4();

/**
 * Draws the facade kit (the slice kit's modules, placed by facadeGrammar.ts) near the player:
 * one `BatchedMesh` per kit material holding each module's geometry once, every placed module
 * an instance of it. So the kit costs four draw calls however many windows are in view, and
 * instances only, no new geometry, as buildings come near.
 *
 * An instance's colour is its paint (shutters, frames) and the colour's alpha its building's
 * weathering, which the building shader reads (`kit` mode).
 */
export class KitDressing {
  readonly root = new THREE.Group();
  private batches = new Map<KitMat, THREE.BatchedMesh>();
  /** Module name → material → geometry id in that material's batch. */
  private geometry = new Map<string, Map<KitMat, number>>();

  private constructor() {
    this.root.name = 'kit-dressing';
  }

  /** The kit from glTF scenes (the slice and street kits): each top-level node a module, its meshes named by material. */
  static fromScenes(scenes: THREE.Object3D[], mats: MaterialLibrary): KitDressing {
    const kit = new KitDressing();
    for (const s of scenes) s.updateMatrixWorld(true);
    const parts = new Map<KitMat, { module: string; geometry: THREE.BufferGeometry }[]>();
    for (const node of scenes.flatMap((s) => s.children)) {
      node.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name as KitMat;
        if (!KIT_MATS.includes(name)) return;
        const list = parts.get(name) ?? [];
        list.push({ module: node.name, geometry: canonical(mesh.geometry, mesh.matrixWorld) });
        parts.set(name, list);
      });
    }
    for (const [mat, list] of parts) {
      const vertices = list.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
      const indices = list.reduce((n, p) => n + p.geometry.index!.count, 0);
      const batch = new THREE.BatchedMesh(MAX_INSTANCES, vertices, indices, mats.kit(mat));
      batch.name = `kit:${mat}`;
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.frustumCulled = false;
      batch.perObjectFrustumCulled = true;
      batch.sortObjects = false;
      for (const p of list) {
        const id = batch.addGeometry(p.geometry);
        if (!kit.geometry.has(p.module)) kit.geometry.set(p.module, new Map());
        kit.geometry.get(p.module)!.set(mat, id);
        p.geometry.dispose();
      }
      kit.batches.set(mat, batch);
      kit.root.add(batch);
    }
    return kit;
  }

  has(module: string) {
    return this.geometry.has(module);
  }

  /** Instances for one building phase's placements, hidden until synced. `aging` is its weathering. */
  add(placements: Placement[], aging: number): DressSlot[] {
    const slots: DressSlot[] = [];
    for (const p of placements) {
      const parts = this.geometry.get(p.module);
      if (!parts) continue;
      const local = new THREE.Matrix4()
        .makeTranslation(p.x, p.y, p.z)
        .multiply(turn.makeRotationY(p.rotY))
        .multiply(matrix.makeScale(p.sx, 1, 1));
      for (const [mat, geometryId] of parts) {
        const batch = this.batches.get(mat)!;
        let id: number;
        try {
          id = batch.addInstance(geometryId);
        } catch {
          // full: the rest of this building goes without (far ones are dropped as the player moves)
          return slots;
        }
        batch.setColorAt(id, color.set(p.colors[mat] ?? FALLBACK[mat]));
        colorData(batch)[id * 4 + 3] = aging;
        batch.setVisibleAt(id, false);
        slots.push({ batch, id, local });
      }
    }
    return slots;
  }

  /** Moves a building's instances with it (`world` is its matrix) and shows or hides them. */
  sync(slots: DressSlot[], world: THREE.Matrix4, visible: boolean) {
    for (const s of slots) {
      s.batch.setVisibleAt(s.id, visible);
      if (visible) s.batch.setMatrixAt(s.id, matrix.multiplyMatrices(world, s.local));
    }
  }

  remove(slots: DressSlot[]) {
    for (const s of slots) s.batch.deleteInstance(s.id);
  }

  /** Instances in use, for the record. */
  get instances() {
    let n = 0;
    for (const b of this.batches.values()) n += (b as unknown as { _drawInfo: { active: boolean }[] })._drawInfo.filter((d) => d.active).length;
    return n;
  }
}

/** The per-instance colours (RGBA floats): three has no setter for alpha, which carries weathering. */
function colorData(batch: THREE.BatchedMesh): Float32Array {
  return (batch as unknown as { _colorsTexture: { image: { data: Float32Array } } })._colorsTexture.image.data;
}

/**
 * The same layout for every geometry of a batch: float position, normal, uv and colour (the
 * baked AO), 32-bit indices, with the node's transform baked in (meshopt quantization keeps
 * the scale and offset on the node).
 */
export function canonical(src: THREE.BufferGeometry, world: THREE.Matrix4): THREE.BufferGeometry {
  const n = src.attributes.position.count;
  const out = new THREE.BufferGeometry();
  const read = (name: string, size: number, fill: number) => {
    const a = src.getAttribute(name);
    const arr = new Float32Array(n * size).fill(fill);
    if (a) for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) arr[i * size + c] = a.getComponent(i, c);
    return new THREE.BufferAttribute(arr, size);
  };
  out.setAttribute('position', read('position', 3, 0));
  out.setAttribute('normal', read('normal', 3, 0));
  out.setAttribute('uv', read('uv', 2, 0));
  out.setAttribute('color', read('color', 3, 1));
  const index = src.index ? Array.from({ length: src.index.count }, (_, i) => src.index!.getX(i)) : Array.from({ length: n }, (_, i) => i);
  out.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
  out.applyMatrix4(world);
  return out;
}
