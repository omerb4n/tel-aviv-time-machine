import * as THREE from 'three';
import { baseHeight } from '../data/geography';
import { frameAt, streetById, streetLength } from '../data/streets';
import type { BuildingSite } from '../data/types';
import type { KitMat, Placement } from './buildings/facadeGrammar';
import type { DressSlot, KitDressing } from './buildings/KitDressing';
import { KERB } from './Streets';
import type { TreeGuard } from './Vegetation';

/** A piece of street furniture and the years it stands. */
export interface Prop extends Placement {
  from: number;
  to: number;
}

// today's city bench: dark brown slats on black cast iron; the 1920s ones plain weathered wood
const BENCH: Partial<Record<KitMat, string>> = { wood: '#5a3f2c', metal: '#1f2321' };
const OLD_BENCH: Partial<Record<KitMat, string>> = { wood: '#9a8466', metal: '#3a3a36' };
const GUARD: Partial<Record<KitMat, string>> = { wood: '#8a7356' };

/**
 * Where the street furniture goes, by year (pure, tests/streetprops.test.ts):
 *
 * - benches on Rothschild facing the paths: until 1949 along the two sand paths either side of
 *   the planted bed (the 1920s prints), from 1950 along the paved middle path (today's photos);
 * - what protects each young street tree (Vegetation.guards): ladder guards on Herzl in the
 *   1910s, a single stake elsewhere;
 * - café tables round the boulevard kiosks, from 1990.
 */
export function planProps(sites: BuildingSite[], guards: TreeGuard[]): Prop[] {
  const out: Prop[] = [];
  const roth = streetById('rothschild');
  const len = streetLength(roth);
  const top = KERB + 0.05;
  for (const [offset, from, to, step] of [
    [4.2, 1914, 1949, 30],
    [2.4, 1950, 9999, 24],
  ]) {
    for (let s = 20; s < len - 10; s += step) {
      const f = frameAt(roth, s);
      for (const side of [-1, 1]) {
        const o = side * offset;
        const x = f.x + f.dz * o;
        const z = f.z - f.dx * o;
        // the bench's front (+z) turns to the middle: towards smaller offsets on the + side
        const rotY = side > 0 ? Math.atan2(-f.dz, f.dx) : Math.atan2(f.dz, -f.dx);
        out.push({ module: 'bench', x, y: baseHeight(x, z) + top, z, rotY, sx: 1, colors: from < 1950 ? OLD_BENCH : BENCH, from, to });
      }
    }
  }
  for (const g of guards) {
    const module = g.kind === 'ladder' ? 'ladder_guard' : 'tree_stake';
    out.push({ module, x: g.x, y: baseHeight(g.x, g.z) + top, z: g.z, rotY: g.kind === 'ladder' ? 0 : (g.x * 7.3) % 6.28, sx: 1, colors: GUARD, from: g.from, to: g.to });
  }
  for (const site of sites) {
    const kiosk = site.phases.find((p) => p.style === 'kiosk');
    if (!kiosk) continue;
    const from = Math.max(1990, kiosk.from);
    if (kiosk.to !== undefined && kiosk.to < from) continue;
    for (let i = 0; i < 4; i++) {
      const a = site.rot + 0.6 + i * 1.3;
      const x = site.x + Math.cos(a) * 4.6;
      const z = site.z + Math.sin(a) * 4.6;
      out.push({ module: 'cafe_set', x, y: baseHeight(x, z) + top, z, rotY: a, sx: 1, colors: { wood: '#a0784f', metal: '#3b3f3c' }, from, to: kiosk.to ?? 9999 });
    }
  }
  return out;
}

const IDENTITY = new THREE.Matrix4();

/** Draws the planned furniture near the camera through the kit dressing, for the current year. */
export class StreetProps {
  private props: Prop[];
  private slots: DressSlot[] = [];
  private year = -1;
  private at = new THREE.Vector3(Infinity, 0, 0);

  constructor(
    private dressing: KitDressing,
    sites: BuildingSite[],
    guards: TreeGuard[],
  ) {
    this.props = planProps(sites, guards).filter((p) => dressing.has(p.module));
  }

  /** Lays out the props within `radius` of `at` again when the year changes or the camera has moved a few metres; true if it did. */
  update(year: number, at: THREE.Vector3, radius: number): boolean {
    const y = Math.floor(year);
    if (y === this.year && at.distanceToSquared(this.at) < 36) return false;
    this.year = y;
    this.at.copy(at);
    this.dressing.remove(this.slots);
    const r2 = radius * radius;
    const near = this.props.filter((p) => y >= p.from && y <= p.to && (p.x - at.x) ** 2 + (p.z - at.z) ** 2 + (p.y - at.y) ** 2 < r2);
    this.slots = this.dressing.add(near, 0);
    this.dressing.sync(this.slots, IDENTITY, true);
    return true;
  }
}
