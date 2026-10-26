import { describe, expect, it } from 'vitest';
import { END_YEAR, generateFabric, lifeStory, phaseAt, rectsOverlap, siteRect } from '../src/world/fabric';
import { mulberry32 } from '../src/core/math';

describe('procedural fabric', () => {
  const sites = generateFabric();

  it('is deterministic', () => {
    const again = generateFabric();
    expect(again.length).toBe(sites.length);
    expect(JSON.stringify(again.slice(0, 20))).toBe(JSON.stringify(sites.slice(0, 20)));
  });

  it('produces a reasonably sized city', () => {
    expect(sites.length).toBeGreaterThan(300);
  });

  it('has ordered, non-overlapping phases that end by the present', () => {
    for (const s of sites) {
      for (let i = 0; i < s.phases.length; i++) {
        const p = s.phases[i];
        expect(p.from).toBeLessThanOrEqual(END_YEAR);
        if (p.to !== undefined) expect(p.to).toBeGreaterThanOrEqual(p.from);
        if (i) expect(p.from).toBeGreaterThan(s.phases[i - 1].to!);
      }
    }
  });

  it('never stacks two buildings on the same ground', () => {
    const solid = sites.filter((s) => s.phases[0].style !== 'tent');
    let overlaps = 0;
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++) if (rectsOverlap(siteRect(solid[i]), siteRect(solid[j]))) overlaps++;
    expect(overlaps).toBe(0);
  });

  it('starts the Ahuzat Bayit core in 1910–1911 with Ottoman-era houses', () => {
    const herzl = sites.filter((s) => (s.id.startsWith('herzl-') || s.id.startsWith('rothschild-')) && Math.hypot(s.x - 60, s.z) < 200);
    expect(herzl.length).toBeGreaterThan(4);
    for (const s of herzl) {
      expect(s.phases[0].from).toBeLessThanOrEqual(1913);
      expect(s.phases[0].style).toBe('ottoman-house');
    }
  });

  it('shows the White City: International Style dominates new 1930s construction', () => {
    const built1930s = sites.flatMap((s) => s.phases).filter((p) => p.from >= 1931 && p.from <= 1948 && p.style !== 'tent');
    const bauhaus = built1930s.filter((p) => p.style === 'bauhaus').length;
    expect(bauhaus / built1930s.length).toBeGreaterThan(0.9);
  });

  it('weathers and restores buildings', () => {
    const story = lifeStory(1935, mulberry32(4), { commercial: false, boulevard: false }, 18, 15);
    const at1975 = story.find((p) => p.from <= 1975 && (p.to ?? 9999) >= 1975);
    expect(at1975).toBeDefined();
  });

  it('phaseAt picks the phase for a year', () => {
    const s = sites.find((x) => x.phases.length > 2)!;
    const p = s.phases[1];
    expect(phaseAt(s, p.from)).toBe(p);
  });
});
