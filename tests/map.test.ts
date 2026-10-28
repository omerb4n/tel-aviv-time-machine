import { describe, expect, it } from 'vitest';
import { frameAt, streetById } from '../src/data/streets';
import { DISCOVERIES, HERZL_PHOTO } from '../src/game/content';
import { distToPolyline, hintArea, streetAt, yearLayer } from '../src/game/mapData';
import { alignment, MATCH, NEAR } from '../src/game/rephoto';
import { allSites } from '../src/world/fabric';

describe('map of a year', () => {
  const sites = allSites();

  it('grows with the city: more streets and buildings over time', () => {
    const y1910 = yearLayer(1910, sites);
    const y2025 = yearLayer(2025, sites);
    expect(y1910.streets.length).toBeLessThan(y2025.streets.length);
    expect(y1910.footprints.length).toBeLessThan(y2025.footprints.length);
    expect(y1910.streets.every((s) => s.street.opened <= 1910)).toBe(true);
    // Allenby was laid out in 1918
    expect(y1910.streets.some((s) => s.street.id === 'allenby')).toBe(false);
  });

  it('draws sand tracks before paving and a hand-inked style before 1948', () => {
    const y = yearLayer(1912, sites);
    expect(y.style).toBe('survey');
    expect(y.streets.find((s) => s.street.id === 'herzl')?.unpaved).toBe(true);
    expect(yearLayer(1960, sites).style).toBe('modern');
    expect(yearLayer(1960, sites).streets.every((s) => !s.unpaved)).toBe(true);
  });

  it('shows the Gymnasium in 1910 and the tower in 2025, not both', () => {
    const has = (year: number, id: string) => yearLayer(year, sites).footprints.some((f) => f.landmark === id);
    expect(has(1910, 'herzliya-gymnasium')).toBe(true);
    expect(has(1910, 'shalom-meir-tower')).toBe(false);
    expect(has(2025, 'herzliya-gymnasium')).toBe(false);
    expect(has(2025, 'shalom-meir-tower')).toBe(true);
  });

  it('names the street you stand on', () => {
    const f = frameAt(streetById('herzl'), 300);
    expect(streetAt(f.x, f.z, 2025)?.id).toBe('herzl');
    expect(streetAt(f.x + 400, f.z + 400, 2025)).toBeUndefined();
    // streets that do not exist yet have no sign
    const a = frameAt(streetById('allenby'), 300);
    expect(streetAt(a.x, a.z, 1910)).toBeUndefined();
  });

  it('measures distance to a polyline', () => {
    expect(distToPolyline(5, 3, [[0, 0], [10, 0]])).toBeCloseTo(3);
    expect(distToPolyline(-4, 3, [[0, 0], [10, 0]])).toBeCloseTo(5);
  });

  it('circles a nudge’s search area around the spot without centring on it', () => {
    for (const d of DISCOVERIES) {
      if (!d.area) continue;
      const a = hintArea(d.area, d.id, d.area.r);
      const dist = Math.hypot(a.x - d.area.x, a.z - d.area.z);
      expect(dist).toBeLessThan(a.r);
      expect(dist).toBeGreaterThan(a.r * 0.2);
      expect(hintArea(d.area, d.id, d.area.r)).toEqual(a); // stable between frames
    }
  });
});

describe('rephotography feedback', () => {
  const pose = HERZL_PHOTO.pose;

  it('is "near" before it is "matched", and both at the exact spot', () => {
    expect(alignment(pose, pose)).toMatchObject({ matched: true, near: true });
    const roughly = alignment(pose, { ...pose, x: pose.x + MATCH.dist + 2 });
    expect(roughly).toMatchObject({ matched: false, near: true });
    const far = alignment(pose, { ...pose, x: pose.x + NEAR.dist + 2 });
    expect(far).toMatchObject({ matched: false, near: false });
  });

  it('needs the photographer’s height: the Herzl Street print was taken from a rooftop', () => {
    expect(pose.height).toBeGreaterThan(6);
    // from the street the brackets show, but it only matches once you rise
    expect(alignment(pose, { ...pose, height: 1.7 })).toMatchObject({ matched: false, near: true });
    expect(alignment(pose, { ...pose, height: (pose.height ?? 0) + MATCH.height - 0.5 })).toMatchObject({ matched: true });
    expect(alignment(pose, { ...pose, height: 40 })).toMatchObject({ near: false });
  });
});
