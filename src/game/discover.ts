import { halfWidth, streetById } from '../data/streets';
import type { BuildingPhase, BuildingSite } from '../data/types';
import { phaseAt } from '../world/fabric';
import { distToPolyline } from './mapData';
import type { SiteMatch, Trigger, Years } from './types';

/**
 * Pure tests for how discoveries are made (no three.js, no DOM), so they can be unit-tested
 * against the same world data the game builds.
 */

export function inYears(year: number, [a, b]: Years) {
  return year >= a && year <= b;
}

/** The site's phase in `year` if it matches, else undefined. */
export function matchSite(m: SiteMatch, site: BuildingSite, year: number): BuildingPhase | undefined {
  const p = phaseAt(site, year);
  if (!p) return undefined;
  if ('site' in m) return site.id === m.site ? p : undefined;
  if (p.style !== m.style || (m.test && !m.test(p, site))) return undefined;
  return p;
}

/** A world point in a site's own axes (as fabric.ts siteRect: local +z is the street front). */
export function siteLocal(site: Pick<BuildingSite, 'x' | 'z' | 'rot'>, x: number, z: number) {
  const c = Math.cos(site.rot);
  const s = Math.sin(site.rot);
  const dx = x - site.x;
  const dz = z - site.z;
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

/** Distance from (x, z) to the edge of a site's footprint (0 inside). */
export function footprintDist(site: Pick<BuildingSite, 'x' | 'z' | 'rot' | 'width' | 'depth'>, x: number, z: number) {
  const { lx, lz } = siteLocal(site, x, z);
  return Math.hypot(Math.max(0, Math.abs(lx) - site.width / 2), Math.max(0, Math.abs(lz) - site.depth / 2));
}

/**
 * Did a look land on a side wall (not the front with its balconies, not the back)? Matches the
 * International Style model in styles.ts, whose stair window is on a side wall.
 */
export function onSideWall(site: Pick<BuildingSite, 'x' | 'z' | 'rot' | 'width' | 'depth'>, hx: number, hz: number) {
  const { lx, lz } = siteLocal(site, hx, hz);
  return Math.abs(lx) > site.width / 2 - 1.6 && lz < site.depth / 2 - 2.9 && lz > -site.depth / 2 + 0.5;
}

/** Did a look land on the street front (the façade and its balconies)? */
export function onFront(site: Pick<BuildingSite, 'x' | 'z' | 'rot' | 'width' | 'depth'>, hx: number, hz: number) {
  return siteLocal(site, hx, hz).lz > site.depth / 2 - 3.2;
}

export interface LookHit {
  site: BuildingSite;
  /** Where the look landed. */
  point: { x: number; z: number };
}

/** Does looking at this building (from (x, z), in `year`) make the discovery? */
export function lookFinds(t: Extract<Trigger, { kind: 'look' }>, hit: LookHit, x: number, z: number, year: number) {
  if (!inYears(year, t.years) || !matchSite(t.match, hit.site, year)) return false;
  if (footprintDist(hit.site, x, z) > t.maxDist) return false;
  if (t.wall === 'side') return onSideWall(hit.site, hit.point.x, hit.point.z);
  if (t.wall === 'front') return onFront(hit.site, hit.point.x, hit.point.z);
  return true;
}

/**
 * Does comparing two years here make the discovery? `base` is the year the player stands in,
 * `other` the year they peeked or slipped into; either may be the earlier one.
 */
export function compareFinds(t: Extract<Trigger, { kind: 'compare' }>, x: number, z: number, base: number, other: number, sites: () => BuildingSite[]) {
  const forward = inYears(base, t.from) && inYears(other, t.to);
  const back = inYears(base, t.to) && inYears(other, t.from);
  if (!forward && !back) return false;
  const [then, now] = forward ? [base, other] : [other, base];
  const w = t.where;
  if ('spot' in w) return Math.hypot(x - w.spot.x, z - w.spot.z) <= w.spot.r;
  if ('street' in w) {
    const st = streetById(w.street);
    return distToPolyline(x, z, st.points) <= halfWidth(st) + w.margin;
  }
  return sites().some((s) => Math.hypot(s.x - x, s.z - z) < w.r + 30 && footprintDist(s, x, z) <= w.r && !!matchSite(w.near, s, then) && !!matchSite(w.then, s, now));
}
