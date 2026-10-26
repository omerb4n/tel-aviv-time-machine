import * as THREE from 'three';
import type { BuildingSite } from '../data/types';
import type { BuildingManager } from '../world/buildings/BuildingManager';
import { h } from './dom';

/** Floating HTML labels over landmarks that exist in the current year. */
export class Labels {
  private items: { site: BuildingSite; el: HTMLElement }[] = [];
  private v = new THREE.Vector3();
  enabled = true;
  onClick?: (siteId: string) => void;

  constructor(
    private root: HTMLElement,
    sites: BuildingSite[],
    private buildings: BuildingManager,
  ) {
    for (const site of sites) {
      if (!site.landmark || !site.name) continue;
      const el = h('div', { class: 'label' }, site.name.en.split(' · ')[0]);
      el.onclick = () => this.onClick?.(site.id);
      root.append(el);
      this.items.push({ site, el });
    }
  }

  update(camera: THREE.PerspectiveCamera, year: number) {
    const w = this.root.clientWidth;
    const hgt = this.root.clientHeight;
    const y = Math.floor(year);
    const occupied: { x: number; y: number }[] = [];
    // nearer labels first so they win collisions
    const sorted = this.items
      .map((it) => {
        const ok = this.enabled && this.buildings.anchor(it.site.id, this.v);
        return { it, ok, d: ok ? this.v.distanceTo(camera.position) : Infinity, pos: this.v.clone() };
      })
      .sort((a, b) => a.d - b.d);
    for (const { it, ok, d, pos } of sorted) {
      const phase = it.site.phases.find((p) => y >= p.from && (p.to === undefined || y <= p.to));
      const tall = (phase?.height ?? 0) > 100;
      if (!ok || !phase || d > (tall ? 5000 : 1400)) {
        it.el.style.display = 'none';
        continue;
      }
      pos.project(camera);
      if (pos.z > 1 || Math.abs(pos.x) > 1.1 || Math.abs(pos.y) > 1.1) {
        it.el.style.display = 'none';
        continue;
      }
      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * hgt;
      if (occupied.some((o) => Math.abs(o.x - sx) < 110 && Math.abs(o.y - sy) < 26)) {
        it.el.style.display = 'none';
        continue;
      }
      occupied.push({ x: sx, y: sy });
      it.el.style.display = '';
      it.el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${(sy - 14).toFixed(1)}px)`;
      it.el.style.opacity = String(Math.max(0.35, Math.min(1, 1.6 - d / 1000)));
    }
  }
}
