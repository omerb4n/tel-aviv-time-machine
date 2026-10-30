import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatKey } from '../materials';

type UVMode = 'auto' | 'cyl' | 'keep';

const tmp = new THREE.Color();

/** A part's bounds in building-local metres; `box` when it is an unrotated box (its faces can be dressed). */
export interface PartBounds {
  mat: MatKey;
  min: [number, number, number];
  max: [number, number, number];
  box: boolean;
}

/**
 * Collects primitive parts (in building-local metres, y = 0 at ground) and merges
 * them into a single geometry with one draw group per material. UVs are generated
 * in metres so facade textures line up with floors on every building.
 */
export class PartBuilder {
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  /** Every part's bounds, for the facade grammar (facadeGrammar.ts). */
  readonly bounds: PartBounds[] = [];

  add(
    mat: MatKey,
    geo: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    uv: UVMode = 'auto',
    cyl?: { x: number; z: number; r: number },
    flat = false,
  ) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.normal || flat) g.computeVertexNormals();
    if (uv === 'auto') autoUV(g);
    else if (uv === 'cyl' && cyl) cylUV(g, cyl);
    else if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    tmp.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(g);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    this.bounds.push({ mat, min: b.min.toArray(), max: b.max.toArray(), box: false });
    if (g !== geo) geo.dispose();
  }

  /** Axis-aligned box; (x, y, z) is the centre of its bottom face. */
  box(mat: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.add(mat, g, color);
    if (!rotY) this.bounds[this.bounds.length - 1].box = true;
  }

  cylinder(
    mat: MatKey,
    rTop: number,
    rBottom: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    segments = 20,
    openEnded = false,
  ) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, openEnded);
    g.translate(x, y + h / 2, z);
    this.add(mat, g, color, segments >= 8 ? 'cyl' : 'auto', { x, z, r: Math.max(rTop, rBottom) }, segments < 8);
  }

  /** Square tapered block (pylon), rotated so faces align with axes. */
  pylon(mat: MatKey, wBottom: number, wTop: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation) {
    const g = new THREE.CylinderGeometry(wTop * Math.SQRT1_2, wBottom * Math.SQRT1_2, h, 4, 1);
    g.rotateY(Math.PI / 4);
    g.translate(x, y + h / 2, z);
    this.add(mat, g, color, 'auto', undefined, true);
  }

  /** Four-sided hip roof covering w × d, with apex height h above y. */
  hipRoof(mat: MatKey, w: number, d: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation) {
    const g = new THREE.ConeGeometry(1, h, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(w / Math.SQRT2, 1, d / Math.SQRT2);
    g.translate(x, y + h / 2, z);
    this.add(mat, g, color, 'auto', undefined, true);
  }

  /** Gabled prism: ridge along z. */
  gable(mat: MatKey, w: number, h: number, len: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0) {
    const g = new THREE.CylinderGeometry(1, 1, len, 3, 1);
    g.rotateX(-Math.PI / 2);
    g.scale(w / Math.sqrt(3), h / 1.5, 1);
    g.translate(0, (h / 1.5) * 0.5, 0);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.add(mat, g, color, 'auto', undefined, true);
  }

  dome(mat: MatKey, r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, squash = 1) {
    const g = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, squash, 1);
    g.translate(x, y, z);
    this.add(mat, g, color, 'keep');
  }

  /** Thin vertical disc facing +z (clock faces, arch heads). */
  disc(mat: MatKey, r: number, depth: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0) {
    const g = new THREE.CylinderGeometry(r, r, depth, 18);
    g.rotateX(Math.PI / 2);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.add(mat, g, color, 'keep');
  }

  get empty() {
    return this.parts.size === 0;
  }

  build(): { geometry: THREE.BufferGeometry; materials: MatKey[] } {
    const keys = [...this.parts.keys()];
    const merged = keys.map((k) => mergeGeometries(this.parts.get(k)!, false)!);
    const geometry = mergeGeometries(merged, true)!;
    for (const g of merged) g.dispose();
    for (const list of this.parts.values()) for (const g of list) g.dispose();
    this.parts.clear();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, materials: keys };
  }
}

function autoUV(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  let minX = Infinity;
  let minZ = Infinity;
  for (let i = 0; i < pos.count; i++) {
    minX = Math.min(minX, pos.getX(i));
    minZ = Math.min(minZ, pos.getZ(i));
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i) - minX;
    const z = pos.getZ(i) - minZ;
    if (ny > 0.6) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else if (nx > nz) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = pos.getY(i);
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = pos.getY(i);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function cylUV(g: THREE.BufferGeometry, c: { x: number; z: number; r: number }) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - c.x;
    const dz = pos.getZ(i) - c.z;
    if (Math.abs(nor.getY(i)) > 0.6) {
      uv[i * 2] = dx;
      uv[i * 2 + 1] = dz;
    } else {
      uv[i * 2] = (Math.atan2(dx, dz) + Math.PI) * c.r;
      uv[i * 2 + 1] = pos.getY(i);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
