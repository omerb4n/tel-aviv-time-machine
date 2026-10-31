import { describe, expect, it } from 'vitest';
import { frameAt, streetById, streetLength } from '../src/data/streets';
import { allSites } from '../src/world/fabric';
import { planProps } from '../src/world/StreetProps';

const guards = [
  { x: 10, z: 20, kind: 'ladder' as const, from: 1910, to: 1919 },
  { x: 30, z: 20, kind: 'stake' as const, from: 1925, to: 1933 },
];
const props = planProps(allSites(), guards);

/** Offset of (x, z) from Rothschild's centreline, and the frame there. */
function onRothschild(x: number, z: number) {
  const st = streetById('rothschild');
  let best = { d: Infinity, o: 0, f: frameAt(st, 0) };
  for (let s = 0; s < streetLength(st); s += 1) {
    const f = frameAt(st, s);
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < best.d) best = { d, o: (x - f.x) * f.dz - (z - f.z) * f.dx, f };
  }
  return best;
}

describe('street furniture', () => {
  it('lines the paths with benches that face them, by period', () => {
    const benches = props.filter((p) => p.module === 'bench');
    expect(benches.length).toBeGreaterThan(20);
    const prom = (streetById('rothschild').promenade ?? 0) / 2;
    for (const b of benches) {
      const { o, f } = onRothschild(b.x, b.z);
      expect(Math.abs(o)).toBeGreaterThan(1.6);
      expect(Math.abs(o)).toBeLessThan(prom);
      // the bench's front, +z turned by rotY, points back across the centreline
      const fx = Math.sin(b.rotY);
      const fz = Math.cos(b.rotY);
      expect(Math.sign(fx * f.dz - fz * f.dx)).toBe(-Math.sign(o));
      // the 1920s benches by the two sand paths, today's by the paved middle path
      expect(Math.abs(o)).toBeCloseTo(b.from < 1950 ? 4.2 : 2.4, 1);
    }
    expect(benches.some((b) => b.from === 1914 && b.to === 1949)).toBe(true);
    expect(benches.some((b) => b.from === 1950)).toBe(true);
  });

  it('guards young trees the way the prints show, for their first years only', () => {
    const ladder = props.filter((p) => p.module === 'ladder_guard');
    const stake = props.filter((p) => p.module === 'tree_stake');
    expect(ladder.map((p) => [p.from, p.to])).toEqual([[1910, 1919]]);
    expect(stake.map((p) => [p.from, p.to])).toEqual([[1925, 1933]]);
  });

  it('sets café tables by the kiosks of today', () => {
    const cafes = props.filter((p) => p.module === 'cafe_set');
    expect(cafes.length).toBeGreaterThan(0);
    for (const c of cafes) expect(c.from).toBeGreaterThanOrEqual(1990);
  });
});
