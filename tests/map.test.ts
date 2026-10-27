import { describe, expect, it } from 'vitest';
import { frameAt, streetById } from '../src/data/streets';
import { VANISHING_SCHOOL as CASE } from '../src/game/cases/vanishingSchool';
import { GameState, TRAIL_MAX, TRAIL_STEP } from '../src/game/GameState';
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

  it('circles the hint area around the target without centring on it', () => {
    for (const l of CASE.leads) {
      const a = hintArea(l.target, l.id);
      const d = Math.hypot(a.x - l.target.x, a.z - l.target.z);
      expect(d).toBeLessThan(a.r);
      expect(d).toBeGreaterThan(a.r * 0.2);
      expect(hintArea(l.target, l.id)).toEqual(a); // stable between frames
    }
  });
});

describe('walked trail', () => {
  it('records a point every few metres and survives a save', () => {
    const st = new GameState(CASE);
    expect(st.walk(0, 0)).toBe(true);
    expect(st.walk(1, 1)).toBe(false);
    expect(st.walk(TRAIL_STEP + 0.5, 0)).toBe(true);
    st.seen.add('travel');
    const back = new GameState(CASE, JSON.parse(JSON.stringify(st.toJSON())));
    expect(back.trail).toEqual(st.trail);
    expect(back.seen.has('travel')).toBe(true);
  });

  it('keeps only the most recent points', () => {
    const st = new GameState(CASE);
    for (let i = 0; i < TRAIL_MAX + 50; i++) st.walk(i * TRAIL_STEP, 0);
    expect(st.trail.length).toBe(TRAIL_MAX);
    expect(st.trail[0][0]).toBe(50 * TRAIL_STEP);
  });

  it('loads older saves without a trail', () => {
    const st = new GameState(CASE, { v: 1, caseId: CASE.id, done: [], anchors: [], landmarks: [], stamps: [], notes: [], solved: false, hints: {} });
    expect(st.trail).toEqual([]);
  });
});

describe('rephotography feedback', () => {
  const photo = CASE.leads[0].trigger;
  if (photo.kind !== 'rephoto') throw new Error('first lead should be a photo');
  const pose = photo.photo.pose;

  it('is "near" before it is "matched", and both at the exact spot', () => {
    expect(alignment(pose, pose)).toMatchObject({ matched: true, near: true });
    const roughly = alignment(pose, { ...pose, x: pose.x + MATCH.dist + 2 });
    expect(roughly).toMatchObject({ matched: false, near: true });
    const far = alignment(pose, { ...pose, x: pose.x + NEAR.dist + 2 });
    expect(far).toMatchObject({ matched: false, near: false });
  });

  it('has match points in front of the photographer', () => {
    expect(photo.photo.marks.length).toBeGreaterThanOrEqual(2);
    for (const m of photo.photo.marks) {
      const fx = -Math.sin(pose.yaw);
      const fz = -Math.cos(pose.yaw);
      const ahead = (m.x - pose.x) * fx + (m.z - pose.z) * fz;
      const side = (m.x - pose.x) * -fz + (m.z - pose.z) * fx;
      expect(ahead).toBeGreaterThan(10);
      // visible on a portrait phone too (vertical fov 50°, aspect ~0.46 → about ±12°)
      expect(Math.abs(Math.atan2(side, ahead)) * (180 / Math.PI)).toBeLessThan(10);
    }
  });
});
