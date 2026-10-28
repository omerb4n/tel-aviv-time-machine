import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/data/landmarks';
import { streetById } from '../src/data/streets';
import type { BuildingSite } from '../src/data/types';
import { COLLECTIONS, DISCOVERIES, HERZL_PHOTO, POIS, SECTIONS, SOSKIN_PHOTO, START, YEARS } from '../src/game/content';
import { compareFinds, footprintDist, inYears, lookFinds, matchSite, onFront, onSideWall, siteLocal } from '../src/game/discover';
import { NotebookState, TRAIL_MAX, TRAIL_STEP } from '../src/game/NotebookState';
import { wrapAngle } from '../src/game/rephoto';
import type { Discovery, Trigger } from '../src/game/types';
import { allSites, phaseAt } from '../src/world/fabric';

const sites = allSites();

/** Is (x, z) inside any building standing in `year`? Mirrors BuildingManager.blockedAt. */
function blocked(x: number, z: number, year: number) {
  return sites.some((s) => {
    const p = phaseAt(s, year);
    if (!p || p.style === 'tent') return false;
    const { lx, lz } = siteLocal(s, x, z);
    return Math.abs(lx) < (p.width ?? s.width) / 2 + 0.35 && Math.abs(lz) < (p.depth ?? s.depth) / 2 + 0.35;
  });
}

/** A world point on a site's wall, in its own axes (local x, local z) → world. */
function onSite(s: BuildingSite, lx: number, lz: number) {
  const c = Math.cos(s.rot);
  const sn = Math.sin(s.rot);
  return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c };
}

/** Standing `d` metres in front of a site (local +z is its street front). */
const inFront = (s: BuildingSite, d: number) => onSite(s, 0, s.depth / 2 + d);

describe('notebook content', () => {
  it('has unique ids, real collections, and every collection is used', () => {
    const ids = DISCOVERIES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DISCOVERIES) expect(COLLECTIONS.some((c) => c.id === d.collection), d.id).toBe(true);
    for (const c of COLLECTIONS) {
      expect(SECTIONS.some((s) => s.id === c.section)).toBe(true);
      expect(DISCOVERIES.some((d) => d.collection === c.id), `${c.id} is empty`).toBe(true);
    }
    for (const s of SECTIONS) expect(COLLECTIONS.some((c) => c.section === s.id)).toBe(true);
  });

  it('gives every discovery a riddle, a nudge, a story and sources', () => {
    for (const d of DISCOVERIES) {
      expect(d.riddle.en.length, d.id).toBeGreaterThan(10);
      expect(d.nudge.en.length, d.id).toBeGreaterThan(10);
      expect(d.gist.en.length, d.id).toBeLessThan(170);
      expect(d.text.en.length, d.id).toBeGreaterThan(80);
      expect(d.sources.length, d.id).toBeGreaterThan(0);
      for (const s of d.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('offers seven years, all of them open', () => {
    expect(YEARS).toEqual([...YEARS].sort((a, b) => a - b));
    expect(YEARS).toContain(START.year);
    expect(YEARS.length).toBeLessThanOrEqual(9);
  });

  it('starts on open ground', () => {
    expect(blocked(START.pose.x, START.pose.z, START.year)).toBe(false);
  });
});

/** The years on the tickets in which a trigger can work. */
const stops = (y: [number, number]) => YEARS.filter((x) => inYears(x, y));

function findable(d: Discovery): boolean {
  const t: Trigger = d.trigger;
  switch (t.kind) {
    case 'look':
      return stops(t.years).some((y) => sites.some((s) => matchSite(t.match, s, y)));
    case 'poi': {
      const p = POIS.find((x) => x.id === t.poi);
      return !!p && YEARS.some((y) => y >= p.from && (p.to === undefined || y <= p.to));
    }
    case 'photo':
      return stops(t.years).length > 0;
    case 'compare': {
      const pairs = stops(t.from).flatMap((a) => stops(t.to).map((b) => [a, b] as const));
      if (!pairs.length) return false;
      const w = t.where;
      if (!('near' in w)) return true;
      // some building that matches `near` in one ticket year and `then` in another
      return pairs.some(([a, b]) => sites.some((s) => matchSite(w.near, s, a) && matchSite(w.then, s, b)));
    }
  }
}

describe('every discovery can be made in one of the seven years', () => {
  for (const d of DISCOVERIES)
    it(d.id, () => {
      expect(findable(d)).toBe(true);
      const t = d.trigger;
      if (t.kind === 'look' && 'site' in t.match) {
        const id = t.match.site;
        expect(LANDMARKS.some((s) => s.id === id)).toBe(true);
      }
      if (t.kind === 'compare' && 'street' in t.where) expect(() => streetById((t.where as { street: string }).street)).not.toThrow();
    });
});

describe('noticing', () => {
  const engel = LANDMARKS.find((s) => s.id === 'engel-house')!;
  const pilotis = DISCOVERIES.find((d) => d.id === 'pilotis')!.trigger as Extract<Trigger, { kind: 'look' }>;

  it('needs the right building, year and distance', () => {
    const at = inFront(engel, 6);
    const hit = { site: engel, point: onSite(engel, 0, engel.depth / 2) };
    expect(lookFinds(pilotis, hit, at.x, at.z, 1936)).toBe(true);
    expect(lookFinds(pilotis, hit, at.x, at.z, 1922)).toBe(false); // not built yet
    const far = inFront(engel, 60);
    expect(lookFinds(pilotis, hit, far.x, far.z, 1936)).toBe(false);
  });

  it('measures distance to a footprint, zero inside it', () => {
    expect(footprintDist(engel, engel.x, engel.z)).toBe(0);
    const p = inFront(engel, 5);
    expect(footprintDist(engel, p.x, p.z)).toBeCloseTo(5);
  });

  it('tells a side wall from the front', () => {
    const s = { x: 10, z: 20, rot: 0.6, width: 18, depth: 15 };
    const side = onSite(s as BuildingSite, s.width / 2 - 0.5, -2);
    const front = onSite(s as BuildingSite, 0, s.depth / 2 - 2.7);
    expect(onSideWall(s, side.x, side.z)).toBe(true);
    expect(onSideWall(s, front.x, front.z)).toBe(false);
    expect(onFront(s, front.x, front.z)).toBe(true);
    expect(onFront(s, side.x, side.z)).toBe(false);
  });

  it('teaches ribbon balconies from the front and thermometer windows from the side', () => {
    const look = (id: string) => DISCOVERIES.find((d) => d.id === id)!.trigger as Extract<Trigger, { kind: 'look' }>;
    const s = sites.find((x) => matchSite(look('ribbon-balconies').match, x, 1936))!;
    const front = { site: s, point: onSite(s, 0, s.depth / 2 - 2.7) };
    const side = { site: s, point: onSite(s, s.width / 2 - 0.5, -1) };
    const at = inFront(s, 5);
    expect(lookFinds(look('ribbon-balconies'), front, at.x, at.z, 1936)).toBe(true);
    expect(lookFinds(look('ribbon-balconies'), side, at.x, at.z, 1936)).toBe(false);
    expect(lookFinds(look('thermometer-windows'), side, at.x, at.z, 1936)).toBe(true);
    expect(lookFinds(look('thermometer-windows'), front, at.x, at.z, 1936)).toBe(false);
  });
});

describe('comparing two years', () => {
  const tower = DISCOVERIES.find((d) => d.id === 'school-to-tower')!.trigger as Extract<Trigger, { kind: 'compare' }>;
  const gym = LANDMARKS.find((s) => s.id === 'herzliya-gymnasium')!;
  const all = () => sites;

  it('works either way round, at the place only', () => {
    expect(compareFinds(tower, gym.x, gym.z + 40, 1960, 1985, all)).toBe(true);
    expect(compareFinds(tower, gym.x, gym.z + 40, 2025, 1960, all)).toBe(true);
    expect(compareFinds(tower, gym.x, gym.z + 40, 1960, 1936, all)).toBe(false);
    expect(compareFinds(tower, gym.x + 400, gym.z, 1960, 1985, all)).toBe(false);
  });

  it('finds a grey building that is white again, standing in front of it', () => {
    const t = DISCOVERIES.find((d) => d.id === 'white-again')!.trigger as Extract<Trigger, { kind: 'compare' }>;
    const w = t.where as { near: Parameters<typeof matchSite>[0]; then: Parameters<typeof matchSite>[0] };
    const s = sites.find((x) => matchSite(w.near, x, 1985) && matchSite(w.then, x, 2025))!;
    expect(s).toBeDefined();
    const p = inFront(s, 4);
    expect(compareFinds(t, p.x, p.z, 1985, 2025, all)).toBe(true);
    expect(compareFinds(t, p.x, p.z, 1985, 1960, all)).toBe(false);
  });

  it('finds the boulevard only on the boulevard', () => {
    const t = DISCOVERIES.find((d) => d.id === 'tree-boulevard')!.trigger as Extract<Trigger, { kind: 'compare' }>;
    expect(compareFinds(t, START.pose.x, START.pose.z, 1909, 1936, all)).toBe(true);
    expect(compareFinds(t, START.pose.x + 300, START.pose.z + 300, 1909, 1936, all)).toBe(false);
  });
});

describe('photographs', () => {
  const photos = DISCOVERIES.flatMap((d) => (d.trigger.kind === 'photo' ? [d.trigger] : []));

  it('are taken from open ground in the years they line up in', () => {
    for (const t of photos) for (const y of stops(t.years)) expect(blocked(t.photo.pose.x, t.photo.pose.z, y), `${t.photo.id} in ${y}`).toBe(false);
  });

  it('have match points in front of the camera', () => {
    for (const { photo } of photos) {
      expect(photo.marks.length).toBeGreaterThanOrEqual(2);
      const fx = -Math.sin(photo.pose.yaw);
      const fz = -Math.cos(photo.pose.yaw);
      for (const m of photo.marks) {
        const ahead = (m.x - photo.pose.x) * fx + (m.z - photo.pose.z) * fz;
        const side = (m.x - photo.pose.x) * -fz + (m.z - photo.pose.z) * fx;
        expect(ahead).toBeGreaterThan(4);
        // inside a 4:3 view (vertical fov 50° → ±31°)
        expect(Math.abs(Math.atan2(side, ahead)) * (180 / Math.PI)).toBeLessThan(30);
      }
    }
  });

  it('pair each real photograph with its match points and credit', () => {
    for (const { photo } of photos) {
      const { marks, archive, reference } = photo;
      expect(archive).toBeDefined();
      expect(archive!.marks.length).toBe(marks.length);
      for (const [u, v] of archive!.marks) for (const x of [u, v]) expect(x >= 0 && x <= 1).toBe(true);
      expect(archive!.credit.en).toMatch(/public domain/i);
      expect(reference.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it('places the Gymnasium in the Herzl Street photo a little right of centre, as in the print', () => {
    const gym = LANDMARKS.find((s) => s.id === 'herzliya-gymnasium')!;
    const { x, z, yaw } = HERZL_PHOTO.pose;
    const off = wrapAngle(Math.atan2(-(gym.x - x), -(gym.z - z)) - yaw);
    expect(off).toBeLessThan(0);
    expect(off).toBeGreaterThan(-0.3);
  });

  it('only lines up the lottery in 1909, when the crowd is there', () => {
    const t = DISCOVERIES.find((d) => d.trigger.kind === 'photo' && d.trigger.photo === SOSKIN_PHOTO)!.trigger as Extract<Trigger, { kind: 'photo' }>;
    expect(stops(t.years)).toEqual([1909]);
    const crowd = POIS.find((p) => p.id === 'lottery-crowd')!;
    expect([crowd.from, crowd.to]).toEqual([1909, 1909]);
  });
});

describe('notebook state', () => {
  it('records a discovery once, with where and when', () => {
    const st = new NotebookState(DISCOVERIES);
    expect(st.discover('pilotis', { year: 1936, x: 1, z: 2 })).toBe(true);
    expect(st.discover('pilotis', { year: 1960, x: 1, z: 2 })).toBe(false);
    expect(st.discover('no-such-thing', { year: 1936, x: 0, z: 0 })).toBe(false);
    expect(st.found.get('pilotis')?.year).toBe(1936);
    expect(st.firstIn('white-city')).toBe(true);
    st.discover('ribbon-balconies', { year: 2025, x: 0, z: 0 });
    expect(st.firstIn('white-city')).toBe(false);
    expect(st.count('white-city')[0]).toBe(2);
    expect(st.latest?.id).toBe('ribbon-balconies');
  });

  it('keeps an unplaced photo in the pocket, and the chosen one first', () => {
    const st = new NotebookState(DISCOVERIES);
    const photos = st.photosLeft.map((d) => d.id);
    expect(photos.length).toBe(2);
    expect(st.pocket?.id).toBe(photos[0]);
    st.photo = photos[1];
    expect(st.pocket?.id).toBe(photos[1]);
    st.discover(photos[1], { year: 1922, x: 0, z: 0, eye: true });
    expect(st.pocket?.id).toBe(photos[0]);
    st.discover(photos[0], { year: 1909, x: 0, z: 0 });
    expect(st.pocket).toBeUndefined();
  });

  it('survives a save, and ignores unknown entries', () => {
    const st = new NotebookState(DISCOVERIES);
    st.discover('first-kiosk', { year: 2025, x: 3, z: 4 });
    st.nudged.add('pagoda-house');
    st.collect('stamps', 'bauhaus');
    st.seen.add('travel');
    const json = JSON.parse(JSON.stringify(st.toJSON()));
    json.found['retired-entry'] = { year: 1900, x: 0, z: 0 };
    const back = new NotebookState(DISCOVERIES, json);
    expect([...back.found.keys()]).toEqual(['first-kiosk']);
    expect(back.nudged.has('pagoda-house')).toBe(true);
    expect(back.stamps.has('bauhaus')).toBe(true);
    expect(back.seen.has('travel')).toBe(true);
  });
});

describe('walked trail', () => {
  it('records a point every few metres and survives a save', () => {
    const st = new NotebookState(DISCOVERIES);
    expect(st.walk(0, 0)).toBe(true);
    expect(st.walk(1, 1)).toBe(false);
    expect(st.walk(TRAIL_STEP + 0.5, 0)).toBe(true);
    const back = new NotebookState(DISCOVERIES, JSON.parse(JSON.stringify(st.toJSON())));
    expect(back.trail).toEqual(st.trail);
  });

  it('keeps only the most recent points', () => {
    const st = new NotebookState(DISCOVERIES);
    for (let i = 0; i < TRAIL_MAX + 50; i++) st.walk(i * TRAIL_STEP, 0);
    expect(st.trail.length).toBe(TRAIL_MAX);
    expect(st.trail[0][0]).toBe(50 * TRAIL_STEP);
  });
});
