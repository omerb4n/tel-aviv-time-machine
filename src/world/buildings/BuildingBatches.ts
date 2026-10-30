import * as THREE from 'three';
import type { MatKey, MaterialLibrary } from '../materials';

/** One building phase's share of one batch: the part drawn with one material. */
export interface BatchSlot {
  batch: THREE.BatchedMesh;
  id: number;
}

interface Chunk {
  mesh: THREE.BatchedMesh;
  vertices: number;
  instances: number;
}

const MAX_VERTICES = 1 << 18;
const MAX_INSTANCES = 2048;

/**
 * Draws every building with a handful of draw calls: one `BatchedMesh` per material (more
 * once one fills up), each building phase an instance in it. With WEBGL_multi_draw a batch
 * is a single call however many buildings are in view, which is what keeps phones cool.
 *
 * The per-building meshes in BuildingManager stay as they were (picking, labels, collision
 * and the rise/sink animation read them) but are no longer drawn; `sync` copies their
 * matrix and visibility into the batches.
 */
export class BuildingBatches {
  readonly root = new THREE.Group();
  private chunks = new Map<MatKey, Chunk[]>();

  constructor(private mats: MaterialLibrary) {
    this.root.name = 'building-batches';
  }

  /** Adds a phase's merged geometry (one group per material), hidden until synced. */
  add(geometry: THREE.BufferGeometry, materials: MatKey[]): BatchSlot[] {
    const slots: BatchSlot[] = [];
    for (const g of geometry.groups) {
      const part = slice(geometry, g.start, g.count);
      const chunk = this.chunkFor(materials[g.materialIndex ?? 0], g.count);
      const geo = chunk.mesh.addGeometry(part);
      const id = chunk.mesh.addInstance(geo);
      chunk.mesh.setVisibleAt(id, false);
      chunk.vertices += g.count;
      chunk.instances++;
      part.dispose();
      slots.push({ batch: chunk.mesh, id });
    }
    return slots;
  }

  sync(slots: BatchSlot[], matrix: THREE.Matrix4, visible: boolean) {
    for (const s of slots) {
      s.batch.setVisibleAt(s.id, visible);
      if (visible) s.batch.setMatrixAt(s.id, matrix);
    }
  }

  /** Draw calls this needs at most (one per batch), for the record. */
  get batchCount() {
    let n = 0;
    for (const list of this.chunks.values()) n += list.length;
    return n;
  }

  private chunkFor(key: MatKey, vertices: number): Chunk {
    let list = this.chunks.get(key);
    if (!list) this.chunks.set(key, (list = []));
    const last = list[list.length - 1];
    if (last && last.vertices + vertices <= MAX_VERTICES && last.instances < MAX_INSTANCES) return last;
    const material = this.mats.get(key);
    const mesh = new THREE.BatchedMesh(MAX_INSTANCES, Math.max(MAX_VERTICES, vertices), 0, material);
    mesh.name = `buildings:${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // the batch spans the city: cull per building instead of as a whole
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = true;
    // opaque batches gain nothing from depth sorting but its CPU cost
    mesh.sortObjects = material.transparent;
    this.root.add(mesh);
    const chunk = { mesh, vertices: 0, instances: 0 };
    list.push(chunk);
    return chunk;
  }
}

/** Vertices [start, start + count) of a non-indexed geometry, as a geometry of its own. */
function slice(src: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const a = src.getAttribute(name) as THREE.BufferAttribute;
    const n = a.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(start * n, (start + count) * n), n));
  }
  return out;
}
