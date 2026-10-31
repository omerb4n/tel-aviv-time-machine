import { describe, expect, it } from 'vitest';
import { allSites } from '../src/world/fabric';
import { Vegetation } from '../src/world/Vegetation';

// the street trees' timeline follows the photographs (docs/REFERENCE_BOARD.md)
const guards = new Vegetation(allSites()).guards();

describe('street trees', () => {
  it('guards Herzl saplings with ladders in the 1910s', () => {
    const ladders = guards.filter((g) => g.kind === 'ladder');
    expect(ladders.length).toBeGreaterThan(20);
    for (const g of ladders) {
      expect(g.from).toBe(1910);
      expect(g.to).toBeLessThan(1920);
    }
  });

  it('stakes the boulevard trees, poinciana from the 1920s and ficus from the 1930s', () => {
    const stakes = guards.filter((g) => g.kind === 'stake');
    expect(stakes.length).toBeGreaterThan(50);
    expect(Math.min(...stakes.map((g) => g.from))).toBeGreaterThanOrEqual(1925);
    for (const g of stakes) expect(g.to - g.from).toBeLessThanOrEqual(8);
  });
});
