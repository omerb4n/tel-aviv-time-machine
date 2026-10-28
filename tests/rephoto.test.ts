import { describe, expect, it } from 'vitest';
import { alignment, containRect, MATCH, NEAR, printFrame, SETTLE, settles, subjectAlpha } from '../src/game/rephoto';

describe('fitting a real photograph over the view', () => {
  const view = [
    { u: 0.3, v: 0.4 },
    { u: 0.7, v: 0.45 },
    { u: 0.5, v: 0.8 },
  ];

  it('finds where the whole print sits in the view', () => {
    // a 1500 × 1000 photo whose 4:3 crop at (200, 100), 1000 wide, is exactly the view
    const crop = { x: 200, y: 100, w: 1000, h: 750 };
    const inPhoto = view.map((p): [number, number] => [(crop.x + p.u * crop.w) / 1500, (crop.y + p.v * crop.h) / 1000]);
    const f = printFrame(inPhoto, view, 1500, 1000, 4 / 3);
    expect(f.u0).toBeCloseTo(-0.2, 6);
    expect(f.u1).toBeCloseTo(1.3, 6);
    expect(f.v0).toBeCloseTo(-100 / 750, 6);
    expect(f.v1).toBeCloseTo(900 / 750, 6);
    // the frame keeps the print's own shape: (1.5 view widths) / (1.33 view heights) = 3:2
    expect(((f.u1 - f.u0) * 4) / 3 / (f.v1 - f.v0)).toBeCloseTo(1.5, 6);
  });

  it('keeps a bad fit at a sensible zoom', () => {
    const squashed = view.map((p): [number, number] => [0.5 + (p.u - 0.5) * 0.01, 0.5 + (p.v - 0.5) * 0.01]);
    const f = printFrame(squashed, view, 1500, 1000, 4 / 3);
    expect(f.u1 - f.u0).toBeLessThanOrEqual(1500 / (1000 * (4 / 3) * 0.4) + 1e-6);
  });

  it('falls back to filling the view from a single point', () => {
    const f = printFrame([[0.5, 0.5]], [{ u: 0.5, v: 0.5 }], 1500, 1000, 4 / 3);
    expect(f.v0).toBeCloseTo(0, 6);
    expect(f.v1).toBeCloseTo(1, 6);
    expect((f.u0 + f.u1) / 2).toBeCloseTo(0.5, 6);
  });

  it('fits the print inside portrait and landscape screens', () => {
    expect(containRect(390, 844, 1.5)).toEqual({ x: 0, y: 292, w: 390, h: 260 });
    expect(containRect(844, 390, 1.5)).toEqual({ x: 129.5, y: 0, w: 585, h: 390 });
  });
});

describe('the see-through print', () => {
  it('keeps busy detail strong and fades empty areas', () => {
    // a flat grey print with a noisy patch (a crowd, say) in the middle
    const [w, h] = [200, 120];
    const lum = new Float32Array(w * h).fill(0.6);
    for (let y = 30; y < 90; y++) for (let x = 60; x < 140; x++) lum[y * w + x] = ((x * 7919 + y * 104729) % 97) / 97;
    const a = subjectAlpha(lum, w, h);
    expect(a[60 * w + 100]).toBeCloseTo(0.7, 2);
    expect(a[10 * w + 10]).toBeCloseTo(0.1, 2);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0.1 - 1e-6);
      expect(v).toBeLessThanOrEqual(0.7 + 1e-6);
    }
  });
});

describe('settling into the photographer’s spot', () => {
  const photo = { x: 10, z: 20, yaw: 0.5, pitch: -0.1, height: 9 };
  const deg = Math.PI / 180;

  it('helps only between "nearly there" and a match', () => {
    for (const k of ['dist', 'yaw', 'pitch', 'height'] as const) {
      expect(SETTLE[k]).toBeGreaterThan(MATCH[k]);
      expect(SETTLE[k]).toBeLessThan(NEAR[k]);
    }
  });

  it('takes over a few steps and degrees off, not from across the street', () => {
    expect(settles(alignment(photo, { x: 15, z: 24, yaw: 0.5 + 10 * deg, pitch: 0, height: 6 }))).toBe(true);
    expect(settles(alignment(photo, { x: 25, z: 20, yaw: 0.5, pitch: -0.1, height: 9 }))).toBe(false);
    expect(settles(alignment(photo, { x: 10, z: 20, yaw: 0.5 + 25 * deg, pitch: -0.1, height: 9 }))).toBe(false);
    expect(settles(alignment(photo, { x: 10, z: 20, yaw: 0.5, pitch: -0.1, height: 1.7 }))).toBe(false);
  });
});
