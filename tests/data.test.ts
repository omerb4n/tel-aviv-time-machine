import { describe, expect, it } from 'vitest';
import { ERAS, TIME_MAX, TIME_MIN, eraAt, moodAt } from '../src/data/eras';
import { EVENTS } from '../src/data/events';
import { LANDMARKS } from '../src/data/landmarks';
import { POPULATION, populationAt } from '../src/data/population';
import { STREETS, frameAt, placeOnStreet, streetLength } from '../src/data/streets';
import { STYLE_INFO } from '../src/data/styleInfo';
import { toLatLon, toLocal } from '../src/core/geo';

describe('eras', () => {
  it('cover the whole timeline without gaps or overlaps', () => {
    expect(ERAS[0].from).toBe(TIME_MIN);
    expect(ERAS[ERAS.length - 1].to).toBe(TIME_MAX);
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].from).toBe(ERAS[i - 1].to + 1);
  });
  it('resolve every year', () => {
    for (let y = TIME_MIN; y <= TIME_MAX; y++) expect(eraAt(y).from).toBeLessThanOrEqual(y);
  });
  it('blend moods smoothly', () => {
    const a = moodAt(1930);
    const b = moodAt(1931);
    expect(Math.abs(a.sepia - b.sepia)).toBeLessThan(0.05);
  });
});

describe('landmarks', () => {
  it('have unique ids, info and ordered, non-overlapping phases', () => {
    const ids = new Set<string>();
    for (const l of LANDMARKS) {
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
      expect(l.info?.summary.en.length).toBeGreaterThan(10);
      for (let i = 1; i < l.phases.length; i++) {
        const prev = l.phases[i - 1];
        expect(prev.to).toBeDefined();
        expect(l.phases[i].from).toBeGreaterThan(prev.to!);
      }
      expect(Number.isFinite(l.x) && Number.isFinite(l.z) && Number.isFinite(l.rot)).toBe(true);
    }
  });
  it('the Gymnasium is gone before the Shalom Meir Tower rises on its site', () => {
    const gym = LANDMARKS.find((l) => l.id === 'herzliya-gymnasium')!;
    const tower = LANDMARKS.find((l) => l.id === 'shalom-meir-tower')!;
    expect(gym.phases.at(-1)!.to!).toBeLessThan(tower.phases[0].from);
  });
});

describe('events', () => {
  it('are in range, chronological and cite sources unless illustrative', () => {
    for (let i = 0; i < EVENTS.length; i++) {
      const e = EVENTS[i];
      expect(e.year).toBeGreaterThanOrEqual(TIME_MIN);
      expect(e.year).toBeLessThanOrEqual(TIME_MAX);
      if (i) expect(e.year).toBeGreaterThanOrEqual(EVENTS[i - 1].year);
      if (e.confidence === 'documented' && e.id !== 'centennial') expect(e.sources?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('population', () => {
  it('has census values at census years and interpolates in between', () => {
    expect(populationAt(1922).value).toBe(15_185);
    expect(populationAt(1922).estimated).toBe(false);
    const mid = populationAt(1926).value;
    expect(mid).toBeGreaterThan(15_185);
    expect(mid).toBeLessThan(46_101);
    for (let i = 1; i < POPULATION.length; i++) expect(POPULATION[i].year).toBeGreaterThan(POPULATION[i - 1].year);
  });
});

describe('streets & geo', () => {
  it('frames walk along the polyline', () => {
    for (const st of STREETS) {
      const len = streetLength(st);
      const end = frameAt(st, len);
      const last = st.points[st.points.length - 1];
      expect(Math.hypot(end.x - last[0], end.z - last[1])).toBeLessThan(0.01);
      expect(Math.hypot(end.dx, end.dz)).toBeCloseTo(1, 5);
    }
  });
  it('places buildings facing the street', () => {
    const p = placeOnStreet('herzl', 200, 'L', 14, 3);
    const f = frameAt(STREETS[0], 200);
    // front (+z local) rotated by rot should point back towards the street centreline
    const fx = Math.sin(p.rot);
    const fz = Math.cos(p.rot);
    expect(fx * (f.x - p.x) + fz * (f.z - p.z)).toBeGreaterThan(0);
  });
  it('round-trips lat/lon', () => {
    const l = toLocal(32.0745, 34.792);
    const b = toLatLon(l.x, l.z);
    expect(b.lat).toBeCloseTo(32.0745, 6);
    expect(b.lon).toBeCloseTo(34.792, 6);
  });
  it('has educational text for every generic style', () => {
    for (const s of ['ottoman-house', 'eclectic', 'bauhaus', 'shikun', 'brutalist', 'modern-residential', 'glass-tower'] as const)
      expect(STYLE_INFO[s]?.text.en.length).toBeGreaterThan(40);
  });
});
