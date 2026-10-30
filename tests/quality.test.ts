import { describe, expect, it } from 'vitest';
import { QUALITY, ResolutionController, TIERS, detectTier, parseTier } from '../src/world/Quality';

const desk = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', touch: false, screenMin: 1080 };

describe('quality tiers', () => {
  it('guesses the tier from the GPU and device', () => {
    expect(detectTier({ ...desk, gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' })).toBe('desktop');
    expect(detectTier({ ...desk, gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' })).toBe('laptop');
    expect(detectTier({ ...desk, gpu: 'Apple M2' })).toBe('laptop');
    expect(detectTier({ ...desk, gpu: '' })).toBe('laptop');
    // Galaxy S24+ (Exynos 2400 in Israel and Europe, Snapdragon elsewhere) and older Mali phones
    const phone = { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S926B) Mobile Safari/537.36', touch: true, screenMin: 384 };
    expect(detectTier({ ...phone, gpu: 'Samsung Xclipse 940' })).toBe('phone');
    expect(detectTier({ ...phone, gpu: 'Mali-G78' })).toBe('phone');
    // the GPU alone is enough when the browser asks for the desktop site
    expect(detectTier({ ...desk, gpu: 'Samsung Xclipse 940' })).toBe('phone');
    expect(detectTier({ ...phone, gpu: 'Adreno (TM) 660' })).toBe('phone');
    // an iPad asking for the desktop site still has a touch screen and a mobile GPU
    expect(detectTier({ ...desk, touch: true, screenMin: 820, gpu: 'Apple GPU' })).toBe('phone');
  });

  it('parses only known tiers', () => {
    for (const t of TIERS) expect(parseTier(t)).toBe(t);
    expect(parseTier('ultra')).toBeUndefined();
    expect(parseTier(null)).toBeUndefined();
  });

  it('keeps every tier inside sane limits', () => {
    for (const t of TIERS) {
      const q = QUALITY[t];
      expect(q.minScale).toBeGreaterThanOrEqual(0.5);
      expect(q.maxScale).toBeLessThanOrEqual(1);
      expect(q.startScale).toBeGreaterThanOrEqual(q.minScale);
      expect(q.startScale).toBeLessThanOrEqual(q.maxScale);
    }
  });
});

describe('dynamic resolution', () => {
  const run = (c: ResolutionController, ms: number, seconds: number) => {
    for (let t = 0; t < seconds * 1000; t += ms) c.frame(ms);
  };

  it('drops the scale when frames run late, down to the floor', () => {
    const c = new ResolutionController(QUALITY.phone);
    run(c, 50, 10);
    expect(c.scale).toBe(QUALITY.phone.minScale);
  });

  it('climbs back to full scale when frames are on time', () => {
    const c = new ResolutionController(QUALITY.laptop);
    run(c, 16.7, 30);
    expect(c.scale).toBe(QUALITY.laptop.maxScale);
  });

  it('settles under a load it cannot quite meet, without oscillating wildly', () => {
    const c = new ResolutionController(QUALITY.phone);
    // frame time proportional to pixel count: 60 fps is met at scale ≈ 0.7
    const scales: number[] = [];
    for (let i = 0; i < 4000; i++) {
      c.frame(16.7 * (c.scale / 0.7) ** 2);
      if (i > 2000) scales.push(c.scale);
    }
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...scales)).toBeLessThanOrEqual(0.8);
  });

  it('ignores stalls such as a hidden tab', () => {
    const c = new ResolutionController(QUALITY.desktop);
    for (let i = 0; i < 20; i++) c.frame(2000);
    expect(c.scale).toBe(QUALITY.desktop.startScale);
  });
});
