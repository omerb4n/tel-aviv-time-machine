import { describe, expect, it } from 'vitest';
import { fitCrop } from '../src/game/rephoto';

describe('fitting a real photograph over the view', () => {
  const view = [
    { u: 0.3, v: 0.4 },
    { u: 0.7, v: 0.45 },
    { u: 0.5, v: 0.8 },
  ];

  it('finds the crop that carries the photo’s points onto the view’s', () => {
    // a 1500 × 1000 photo whose 4:3 crop at (200, 100), 1000 wide, is exactly the view
    const crop = { x: 200, y: 100, w: 1000, h: 750 };
    const inPhoto = view.map((p): [number, number] => [(crop.x + p.u * crop.w) / 1500, (crop.y + p.v * crop.h) / 1000]);
    const fit = fitCrop(inPhoto, view, 1500, 1000, 4 / 3);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(fit[k]).toBeCloseTo(crop[k], 6);
  });

  it('keeps the crop inside the photo and at a sensible zoom', () => {
    const shifted = view.map((p): [number, number] => [p.u * 0.5 + 0.6, p.v * 0.5]);
    const fit = fitCrop(shifted, view, 1500, 1000, 4 / 3);
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.y).toBeGreaterThanOrEqual(0);
    expect(fit.x + fit.w).toBeLessThanOrEqual(1500 + 1e-6);
    expect(fit.y + fit.h).toBeLessThanOrEqual(1000 + 1e-6);
    expect(fit.w).toBeGreaterThanOrEqual(1000 * (4 / 3) * 0.5 - 1e-6);
    expect(fit.w / fit.h).toBeCloseTo(4 / 3, 6);
  });

  it('falls back to the widest crop from a single point', () => {
    const fit = fitCrop([[0.5, 0.5]], [{ u: 0.5, v: 0.5 }], 1500, 1000, 4 / 3);
    expect(fit.w).toBeCloseTo(1000 * (4 / 3), 6);
    expect(fit.x).toBeCloseTo((1500 - fit.w) / 2, 6);
  });
});
