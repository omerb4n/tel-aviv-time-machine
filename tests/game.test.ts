import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/data/landmarks';
import { CASES } from '../src/game/cases';
import { HOUSE_PLOT_43 } from '../src/game/cases/housePlot43';
import { SEASHELL_LOTTERY } from '../src/game/cases/seashellLottery';
import type { Poi } from '../src/game/types';
import { VANISHING_SCHOOL as CASE } from '../src/game/cases/vanishingSchool';
import { GameState } from '../src/game/GameState';
import { alignment, wrapAngle } from '../src/game/rephoto';
import { allSites, phaseAt } from '../src/world/fabric';

/** Is (x, z) inside a room point of interest? (Room-local frame, as in Game.roomLocal.) */
function inRoom(p: Poi, x: number, z: number) {
  const r = p.prop?.rot ?? 0;
  const dx = x - p.x;
  const dz = z - p.z;
  const lx = dx * Math.cos(r) - dz * Math.sin(r);
  const lz = dx * Math.sin(r) + dz * Math.cos(r);
  return !!p.room && Math.abs(lx) < p.room.w / 2 && Math.abs(lz) < p.room.d / 2;
}

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

for (const CASE of CASES)
  describe(`case ${CASE.number}: ${CASE.title.en}`, () => {
    it('references leads, sites and points of interest that exist', () => {
      const ids = new Set(CASE.leads.map((l) => l.id));
      expect(ids.size).toBe(CASE.leads.length);
      for (const l of CASE.leads) {
        for (const r of l.requires) expect(ids.has(r), `${l.id} requires ${r}`).toBe(true);
        if (l.trigger.kind === 'site') expect(LANDMARKS.some((s) => s.id === (l.trigger as { siteId: string }).siteId)).toBe(true);
        if (l.trigger.kind === 'poi') expect(CASE.pois.some((p) => p.id === (l.trigger as { poiId: string }).poiId)).toBe(true);
        expect(l.hints.length).toBeGreaterThanOrEqual(2);
        expect(l.short.en.length, `${l.id}: the HUD line should be short`).toBeLessThanOrEqual(48);
        if (l.clue.anchors !== undefined) expect(CASE.years).toContain(l.clue.anchors);
      }
      for (const n of CASE.notes) if (n.trigger.kind === 'site') expect(LANDMARKS.some((s) => s.id === (n.trigger as { siteId: string }).siteId)).toBe(true);
      expect(new Set(CASE.notes.map((n) => n.id)).size).toBe(CASE.notes.length);
    });

    it('can be finished: every lead has an anchored year to be completed in', () => {
      const st = new GameState(CASE);
      let guard = 0;
      while (st.current && guard++ < 20) {
        const lead = st.current;
        const year = [...st.anchors].find((y) => st.canComplete(lead, y));
        expect(year, `no anchored year lets you complete "${lead.id}"`).toBeDefined();
        // a point of interest must exist in that year
        if (lead.trigger.kind === 'poi') {
          const poi = CASE.pois.find((p) => p.id === (lead.trigger as { poiId: string }).poiId)!;
          expect(year! >= poi.from && (poi.to === undefined || year! <= poi.to), `${poi.id} is not there in ${year}`).toBe(true);
        }
        // a building must stand in that year
        if (lead.trigger.kind === 'site') {
          const site = LANDMARKS.find((s) => s.id === (lead.trigger as { siteId: string }).siteId)!;
          expect(phaseAt(site, year!), `${site.id} does not stand in ${year}`).toBeDefined();
        }
        st.complete(lead.id);
      }
      expect(st.readyToSolve).toBe(true);
      expect([...st.anchors].sort()).toEqual([...CASE.years].sort());
      expect(CASE.deduction.options.filter((o) => o.correct)).toHaveLength(1);
    });

    it('puts the start and the photographers on open ground, not inside buildings', () => {
      expect(blocked(CASE.start.pose.x, CASE.start.pose.z, CASE.start.year)).toBe(false);
      for (const l of CASE.leads) {
        if (l.trigger.kind !== 'rephoto') continue;
        const { pose, year } = l.trigger.photo;
        // an indoor photo (taken inside a room) must be inside that room instead
        const room = CASE.pois.find((p) => p.room && year >= p.from && (p.to === undefined || year <= p.to) && inRoom(p, pose.x, pose.z));
        if (room) continue;
        const years = l.years ? [year] : [year, CASE.start.year];
        for (const y of years) expect(blocked(pose.x, pose.z, y), `${l.id} in ${y}`).toBe(false);
      }
    });

    it('has photo match points in front of the camera and visible on a portrait phone', () => {
      for (const l of CASE.leads) {
        if (l.trigger.kind !== 'rephoto') continue;
        const { pose, marks } = l.trigger.photo;
        expect(marks.length).toBeGreaterThanOrEqual(2);
        const fx = -Math.sin(pose.yaw);
        const fz = -Math.cos(pose.yaw);
        const angles = marks.map((m) => {
          const ahead = (m.x - pose.x) * fx + (m.z - pose.z) * fz;
          const side = (m.x - pose.x) * -fz + (m.z - pose.z) * fx;
          expect(ahead).toBeGreaterThan(4);
          return Math.abs(Math.atan2(side, ahead)) * (180 / Math.PI);
        });
        // all inside a 4:3 view (vertical fov 50° → ±31°); the screen is cropped to the print,
        // so every orientation sees all of them
        for (const a of angles) expect(a).toBeLessThan(30);
      }
    });

    it('pairs each real photograph with its match points', () => {
      for (const l of CASE.leads) {
        if (l.trigger.kind !== 'rephoto' || !l.trigger.photo.archive) continue;
        const { marks, archive, reference } = l.trigger.photo;
        expect(archive.marks.length).toBe(marks.length);
        for (const [u, v] of archive.marks) for (const x of [u, v]) expect(x >= 0 && x <= 1).toBe(true);
        expect(archive.src).toBeTruthy();
        expect(archive.credit.en).toMatch(/public domain/i);
        expect(reference.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
    });
  });

describe('all cases', () => {
  it('have unique ids, numbers, props and photos', () => {
    const uniq = (xs: string[]) => expect(new Set(xs).size).toBe(xs.length);
    uniq(CASES.map((c) => c.id));
    uniq(CASES.map((c) => String(c.number)));
    uniq(CASES.flatMap((c) => c.pois.map((p) => p.id)));
    uniq(CASES.flatMap((c) => c.leads.flatMap((l) => (l.trigger.kind === 'rephoto' ? [l.trigger.photo.id] : []))));
  });

  it('keep a separate save per case', () => {
    const [a, b] = CASES;
    const st = new GameState(b, { ...new GameState(a).toJSON(), done: [a.leads[0].id] });
    expect(st.done.size).toBe(0);
  });
});

describe('case 3 specifics', () => {
  it('enters the museum hall after the invitation, and photographs inside it', () => {
    const inv = HOUSE_PLOT_43.leads.find((l) => l.id === 'invitation')!;
    const hall = HOUSE_PLOT_43.pois.find((p) => p.id === inv.enter)!;
    expect(hall.room).toBeDefined();
    const photo = HOUSE_PLOT_43.leads.find((l) => l.id === 'declaration')!.trigger;
    if (photo.kind !== 'rephoto') throw new Error('expected a photo');
    expect(inRoom(hall, photo.photo.pose.x, photo.photo.pose.z)).toBe(true);
    for (const m of photo.photo.marks) expect(inRoom(hall, m.x, m.z), 'marks inside the hall').toBe(true);
    // the hall fits inside the museum building
    const museum = LANDMARKS.find((l) => l.id === 'dizengoff-house')!;
    const phase = phaseAt(museum, 1948)!;
    expect(hall.room!.w).toBeLessThan(phase.width ?? museum.width);
    expect(hall.room!.d).toBeLessThan(phase.depth ?? museum.depth);
  });
});

describe('case 2 specifics', () => {
  it('draws a family and a plot before the clue', () => {
    const shells = SEASHELL_LOTTERY.leads.find((l) => l.id === 'shells')!;
    expect(shells.clue.reveal?.draws.map((d) => d.value.en)).toEqual(['Meir & Zina Dizengoff', 'Plot 43']);
  });
  it('can only line up Soskin’s photo in 1909', () => {
    const st = new GameState(SEASHELL_LOTTERY);
    const lead = SEASHELL_LOTTERY.leads.find((l) => l.id === 'soskin')!;
    st.complete('monument');
    st.complete('crowd');
    expect(st.canComplete(lead, 1909)).toBe(true);
    expect(st.canComplete(lead, 2025)).toBe(false);
  });
});

describe('case 1 specifics', () => {
  it('places the gymnasium in the postcard, a little right of centre as in the photograph', () => {
    const photo = CASE.leads[0].trigger;
    if (photo.kind !== 'rephoto') throw new Error('first lead should be a photo');
    const gym = LANDMARKS.find((s) => s.id === 'herzliya-gymnasium')!;
    const { x, z, yaw } = photo.photo.pose;
    const toGym = Math.atan2(-(gym.x - x), -(gym.z - z));
    const off = wrapAngle(toGym - yaw);
    expect(off).toBeLessThan(0);
    expect(off).toBeGreaterThan(-0.3);
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
