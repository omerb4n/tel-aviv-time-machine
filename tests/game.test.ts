import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/data/landmarks';
import { VANISHING_SCHOOL as CASE } from '../src/game/cases/vanishingSchool';
import { GameState } from '../src/game/GameState';
import { alignment, wrapAngle } from '../src/game/rephoto';
import { allSites, phaseAt } from '../src/world/fabric';

/** Is (x, z) inside any building standing in `year`? Mirrors BuildingManager.blockedAt. */
function blocked(x: number, z: number, year: number) {
  return allSites().some((s) => {
    const p = phaseAt(s, year);
    if (!p || p.style === 'tent') return false;
    const c = Math.cos(s.rot);
    const sn = Math.sin(s.rot);
    const dx = x - s.x;
    const dz = z - s.z;
    return Math.abs(dx * c - dz * sn) < (p.width ?? s.width) / 2 + 0.35 && Math.abs(dx * sn + dz * c) < (p.depth ?? s.depth) / 2 + 0.35;
  });
}

describe('case: The Vanishing School', () => {
  it('references leads, sites and points of interest that exist', () => {
    const ids = new Set(CASE.leads.map((l) => l.id));
    expect(ids.size).toBe(CASE.leads.length);
    for (const l of CASE.leads) {
      for (const r of l.requires) expect(ids.has(r), `${l.id} requires ${r}`).toBe(true);
      if (l.trigger.kind === 'site') expect(LANDMARKS.some((s) => s.id === (l.trigger as { siteId: string }).siteId)).toBe(true);
      if (l.trigger.kind === 'poi') expect(CASE.pois.some((p) => p.id === (l.trigger as { poiId: string }).poiId)).toBe(true);
      expect(l.hints.length).toBeGreaterThanOrEqual(2);
      if (l.clue.anchors !== undefined) expect(CASE.years).toContain(l.clue.anchors);
    }
  });

  it('can be finished: every lead has an anchored year to be completed in', () => {
    const st = new GameState(CASE);
    let guard = 0;
    while (st.current && guard++ < 20) {
      const lead = st.current;
      const year = [...st.anchors].find((y) => st.canComplete(lead, y));
      expect(year, `no anchored year lets you complete "${lead.id}"`).toBeDefined();
      st.complete(lead.id);
    }
    expect(st.readyToSolve).toBe(true);
    expect([...st.anchors].sort()).toEqual([...CASE.years].sort());
    expect(CASE.deduction.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it('puts the start and the photographer on open ground, not inside buildings', () => {
    const photo = CASE.leads[0].trigger;
    expect(photo.kind).toBe('rephoto');
    if (photo.kind !== 'rephoto') return;
    expect(blocked(CASE.start.pose.x, CASE.start.pose.z, CASE.start.year)).toBe(false);
    for (const y of [photo.photo.year, CASE.start.year]) expect(blocked(photo.photo.pose.x, photo.photo.pose.z, y)).toBe(false);
  });

  it('places the gymnasium where the postcard is looking', () => {
    const photo = CASE.leads[0].trigger;
    if (photo.kind !== 'rephoto') throw new Error('first lead should be a photo');
    const gym = LANDMARKS.find((s) => s.id === 'herzliya-gymnasium')!;
    const { x, z, yaw } = photo.photo.pose;
    const toGym = Math.atan2(-(gym.x - x), -(gym.z - z));
    expect(Math.abs(wrapAngle(toGym - yaw))).toBeLessThan(0.05);
  });
});

describe('game state', () => {
  it('starts with only the start year anchored and locked slots for the rest', () => {
    const st = new GameState(CASE);
    expect([...st.anchors]).toEqual([CASE.start.year]);
    expect(st.compass.filter((s) => s.locked)).toHaveLength(CASE.years.length - 1);
    expect(st.current?.id).toBe('postcard');
  });

  it('respects lead years and requirements', () => {
    const st = new GameState(CASE);
    const gym = CASE.leads.find((l) => l.id === 'gymnasium')!;
    expect(st.canComplete(gym, 1910)).toBe(false); // postcard not found yet
    expect(st.complete('postcard')).toBe(1910);
    expect(st.canComplete(gym, 2025)).toBe(false); // the school is not there in 2025
    expect(st.canComplete(gym, 1910)).toBe(true);
  });

  it('cycles hints up to the last tier', () => {
    const st = new GameState(CASE);
    const n = CASE.leads[0].hints.length;
    for (let i = 0; i < n + 2; i++) st.nextHint('postcard');
    expect(st.hintTier('postcard')).toBe(n - 1);
  });

  it('round-trips through a save', () => {
    const st = new GameState(CASE);
    st.complete('postcard');
    st.collect('stamps', 'bauhaus');
    st.where = { year: 1910, x: 1, z: 2, yaw: 0.5 };
    const back = new GameState(CASE, JSON.parse(JSON.stringify(st.toJSON())));
    expect(back.done.has('postcard')).toBe(true);
    expect(back.anchors.has(1910)).toBe(true);
    expect(back.stamps.has('bauhaus')).toBe(true);
    expect(back.where?.year).toBe(1910);
    expect(back.collect('stamps', 'bauhaus')).toBe(false);
  });

  it('ignores saves from another case or with unknown leads', () => {
    const st = new GameState(CASE, { ...new GameState(CASE).toJSON(), caseId: 'other', done: ['postcard'] });
    expect(st.done.size).toBe(0);
    const st2 = new GameState(CASE, { ...new GameState(CASE).toJSON(), done: ['nope'] });
    expect(st2.done.size).toBe(0);
  });
});

describe('rephotography alignment', () => {
  const photo = { x: 0, z: 0, yaw: 0.2, pitch: 0.03 };
  it('matches when standing on the spot and facing the same way', () => {
    const a = alignment(photo, { x: 2, z: -3, yaw: 0.25, pitch: 0.05 });
    expect(a.matched).toBe(true);
    expect(a.score).toBeGreaterThan(0.75);
  });
  it('does not match when facing the wrong way or standing far off', () => {
    expect(alignment(photo, { x: 0, z: 0, yaw: 0.2 + Math.PI, pitch: 0.03 }).matched).toBe(false);
    expect(alignment(photo, { x: 30, z: 0, yaw: 0.2, pitch: 0.03 }).matched).toBe(false);
  });
  it('handles yaw wrap-around', () => {
    const p = { ...photo, yaw: Math.PI - 0.02 };
    expect(alignment(p, { x: 0, z: 0, yaw: -Math.PI + 0.02, pitch: 0.03 }).matched).toBe(true);
  });
  it('the score grows as you get closer', () => {
    const far = alignment(photo, { x: 40, z: 0, yaw: 0.2, pitch: 0.03 }).score;
    const near = alignment(photo, { x: 10, z: 0, yaw: 0.2, pitch: 0.03 }).score;
    expect(near).toBeGreaterThan(far);
  });
});
