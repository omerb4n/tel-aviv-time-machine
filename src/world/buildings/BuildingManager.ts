import * as THREE from 'three';
import { easeOutBack, hashString, mulberry32 } from '../../core/math';
import { baseHeight } from '../../data/geography';
import type { BuildingPhase, BuildingSite, BuildingStyle } from '../../data/types';
import type { MaterialLibrary } from '../materials';
import { PartBuilder } from './PartBuilder';
import { buildPhase } from './styles';

interface PhaseEntry {
  phase: BuildingPhase;
  index: number;
  mesh?: THREE.Mesh;
  ghost?: THREE.Mesh;
  presence: number;
  target: number;
}

interface SiteEntry {
  site: BuildingSite;
  group: THREE.Group;
  phases: PhaseEntry[];
}

export interface PickResult {
  site: BuildingSite;
  phase: BuildingPhase;
  object: THREE.Object3D;
  /** Where the ray hit, and how far from its origin. */
  point: THREE.Vector3;
  distance: number;
}

/** Owns every building in the scene and animates them in and out as time moves. */
export class BuildingManager {
  readonly root = new THREE.Group();
  private entries: SiteEntry[] = [];
  private byId = new Map<string, SiteEntry>();
  private queue: PhaseEntry[] = [];
  private pending = new Map<PhaseEntry, SiteEntry>();
  private year = -1;
  private ghosts = false;
  private highlightBox = new THREE.Box3Helper(new THREE.Box3(), 0xffc860);
  private selected?: SiteEntry;

  constructor(
    sites: BuildingSite[],
    private mats: MaterialLibrary,
  ) {
    this.root.name = 'buildings';
    for (const site of sites) {
      const group = new THREE.Group();
      group.position.set(site.x, baseHeight(site.x, site.z), site.z);
      group.rotation.y = site.rot;
      group.userData.siteId = site.id;
      this.root.add(group);
      const entry: SiteEntry = {
        site,
        group,
        phases: site.phases.map((phase, index) => ({ phase, index, presence: 0, target: 0 })),
      };
      this.entries.push(entry);
      this.byId.set(site.id, entry);
    }
    this.highlightBox.visible = false;
    (this.highlightBox.material as THREE.LineBasicMaterial).depthTest = false;
    this.highlightBox.renderOrder = 10;
    this.root.add(this.highlightBox);
  }

  get sites(): BuildingSite[] {
    return this.entries.map((e) => e.site);
  }

  site(id: string) {
    return this.byId.get(id)?.site;
  }

  private ensureMesh(entry: SiteEntry, pe: PhaseEntry): THREE.Mesh {
    if (pe.mesh) return pe.mesh;
    const pb = new PartBuilder();
    buildPhase(pb, entry.site, pe.phase, mulberry32(hashString(`${entry.site.id}#${pe.phase.style}#${pe.phase.from}`)));
    const { geometry, materials } = pb.build();
    const mesh = new THREE.Mesh(
      geometry,
      materials.map((k) => this.mats.get(k)),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.userData = { siteId: entry.site.id, phaseIndex: pe.index };
    entry.group.add(mesh);
    pe.mesh = mesh;
    return mesh;
  }

  private ensureGhost(entry: SiteEntry, pe: PhaseEntry): THREE.Mesh {
    if (pe.ghost) return pe.ghost;
    const mesh = this.ensureMesh(entry, pe);
    const ghost = new THREE.Mesh(mesh.geometry, this.mats.ghost);
    ghost.userData = { ...mesh.userData, ghost: true };
    ghost.renderOrder = 5;
    entry.group.add(ghost);
    pe.ghost = ghost;
    return ghost;
  }

  setGhosts(on: boolean) {
    this.ghosts = on;
    this.applyYear(this.year, true);
  }

  setYear(year: number) {
    const y = Math.floor(year);
    if (y !== this.year) this.applyYear(y);
  }

  private applyYear(y: number, force = false) {
    if (y === this.year && !force) return;
    this.year = y;
    for (const entry of this.entries) {
      let anyActive = false;
      let lastPast: PhaseEntry | undefined;
      for (const pe of entry.phases) {
        const active = y >= pe.phase.from && (pe.phase.to === undefined || y <= pe.phase.to);
        pe.target = active ? 1 : 0;
        if (active) {
          anyActive = true;
          if (!pe.mesh && !this.pending.has(pe)) {
            this.pending.set(pe, entry);
            this.queue.push(pe);
          }
        }
        if (pe.phase.to !== undefined && pe.phase.to < y) lastPast = pe;
      }
      for (const pe of entry.phases) {
        const showGhost = this.ghosts && !anyActive && pe === lastPast && entry.site.phases.length > 0;
        if (showGhost) this.ensureGhost(entry, pe).visible = true;
        else if (pe.ghost) pe.ghost.visible = false;
      }
    }
    // Build what is near the camera's focus first: landmarks, then the rest in order.
    this.queue.sort((a, b) => Number(!!this.pending.get(b)?.site.landmark) - Number(!!this.pending.get(a)?.site.landmark));
  }

  /** Builds queued meshes within a time budget, then animates presence. */
  update(dt: number, budgetMs = 10) {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const pe = this.queue.shift()!;
      const entry = this.pending.get(pe)!;
      this.pending.delete(pe);
      this.ensureMesh(entry, pe);
    }
    const k = 1 - Math.exp(-dt * 5);
    for (const entry of this.entries) {
      for (const pe of entry.phases) {
        if (!pe.mesh) continue;
        if (pe.presence === pe.target && !pe.mesh.visible === !pe.target) continue;
        pe.presence += (pe.target - pe.presence) * k;
        if (Math.abs(pe.presence - pe.target) < 0.004) pe.presence = pe.target;
        const s = pe.target > 0 ? easeOutBack(Math.min(1, pe.presence)) : pe.presence * pe.presence;
        pe.mesh.visible = pe.presence > 0.002;
        pe.mesh.scale.set(1, Math.max(0.001, s), 1);
      }
    }
  }

  /** Builds everything queued and snaps every building to its final state (for instant time travel). */
  settle() {
    while (this.queue.length) {
      const pe = this.queue.shift()!;
      const entry = this.pending.get(pe)!;
      this.pending.delete(pe);
      this.ensureMesh(entry, pe);
    }
    for (const entry of this.entries)
      for (const pe of entry.phases) {
        if (!pe.mesh) continue;
        pe.presence = pe.target;
        pe.mesh.visible = pe.target > 0;
        pe.mesh.scale.set(1, 1, 1);
      }
  }

  /**
   * True if a walker at (x, z) would be inside a building standing in the current year.
   * `pad` grows every footprint (a body radius).
   */
  blockedAt(x: number, z: number, pad = 0.35): boolean {
    for (const e of this.nearby(x, z)) {
      const pe = e.phases.find((p) => p.target > 0);
      if (!pe || pe.phase.style === 'tent') continue;
      const w = (pe.phase.width ?? e.site.width) / 2 + pad;
      const d = (pe.phase.depth ?? e.site.depth) / 2 + pad;
      const dx = x - e.site.x;
      const dz = z - e.site.z;
      const c = Math.cos(e.site.rot);
      const s = Math.sin(e.site.rot);
      // world → local (inverse of rotation about Y)
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < w && Math.abs(lz) < d) return true;
    }
    return false;
  }

  private grid?: Map<string, SiteEntry[]>;
  private nearby(x: number, z: number): SiteEntry[] {
    const cell = 40;
    if (!this.grid) {
      this.grid = new Map();
      for (const e of this.entries) {
        let r = Math.hypot(e.site.width, e.site.depth) / 2;
        for (const p of e.site.phases) r = Math.max(r, Math.hypot(p.width ?? 0, p.depth ?? 0) / 2);
        for (let gx = Math.floor((e.site.x - r) / cell); gx <= Math.floor((e.site.x + r) / cell); gx++)
          for (let gz = Math.floor((e.site.z - r) / cell); gz <= Math.floor((e.site.z + r) / cell); gz++) {
            const k = `${gx},${gz}`;
            const list = this.grid.get(k);
            if (list) list.push(e);
            else this.grid.set(k, [e]);
          }
      }
    }
    return this.grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
  }

  /** True while meshes are still being generated for the current year. */
  get busy() {
    return this.queue.length > 0;
  }

  pick(raycaster: THREE.Raycaster): PickResult | undefined {
    const candidates: THREE.Object3D[] = [];
    for (const e of this.entries)
      for (const pe of e.phases) {
        if (pe.mesh?.visible && pe.target > 0) candidates.push(pe.mesh);
        else if (pe.ghost?.visible) candidates.push(pe.ghost);
      }
    const hit = raycaster.intersectObjects(candidates, false)[0];
    if (!hit) return undefined;
    const entry = this.byId.get(hit.object.userData.siteId as string)!;
    return { site: entry.site, phase: entry.site.phases[hit.object.userData.phaseIndex as number], object: hit.object, point: hit.point, distance: hit.distance };
  }

  select(siteId: string | undefined) {
    this.selected = siteId ? this.byId.get(siteId) : undefined;
    this.refreshHighlight();
  }

  refreshHighlight() {
    const sel = this.selected;
    const pe = sel?.phases.find((p) => p.target > 0 && p.mesh) ?? sel?.phases.find((p) => p.ghost?.visible);
    const obj = pe?.mesh;
    if (!sel || !obj) {
      this.highlightBox.visible = false;
      return;
    }
    obj.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(obj, true);
    if (box.min.y < sel.group.position.y) box.min.y = sel.group.position.y;
    this.highlightBox.box.copy(box);
    this.highlightBox.visible = true;
  }

  /** Statistics for the HUD. */
  stats(): { total: number; byStyle: Map<BuildingStyle, number> } {
    const byStyle = new Map<BuildingStyle, number>();
    let total = 0;
    for (const e of this.entries) {
      const pe = e.phases.find((p) => p.target > 0);
      if (!pe || pe.phase.style === 'tent' || /^(jaffa|neve-tzedek)-/.test(e.site.id) || Math.hypot(e.site.x, e.site.z) > 2000) continue;
      total++;
      byStyle.set(pe.phase.style, (byStyle.get(pe.phase.style) ?? 0) + 1);
    }
    return { total, byStyle };
  }

  /** World-space anchor (top centre) of a site's current building, for labels. */
  anchor(siteId: string, out: THREE.Vector3): boolean {
    const e = this.byId.get(siteId);
    const pe = e?.phases.find((p) => p.target > 0 && p.mesh);
    if (!e || !pe?.mesh?.geometry.boundingBox) return false;
    const h = pe.mesh.geometry.boundingBox.max.y * pe.mesh.scale.y;
    out.set(e.group.position.x, e.group.position.y + h + 4, e.group.position.z);
    return pe.presence > 0.5;
  }
}
