import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hashString, mulberry32 } from '../src/core/math';
import type { BuildingPhase, BuildingSite } from '../src/data/types';
import { roofHeight } from '../src/world/buildings/BuildingManager';
import { dressPhase, MODULES, type Placement } from '../src/world/buildings/facadeGrammar';
import { PartBuilder } from '../src/world/buildings/PartBuilder';
import { buildPhase, wallColor } from '../src/world/buildings/styles';
import { allSites } from '../src/world/fabric';

const closedEven = (_m: string, column: number) => ({ open: column % 2 === 1, shutter: '#4d7766' });

function build(site: BuildingSite, phase: BuildingPhase) {
  const pb = new PartBuilder();
  buildPhase(pb, site, phase, mulberry32(hashString(`${site.id}#${phase.style}#${phase.from}`)));
  return pb.bounds;
}

function dress(site: BuildingSite, phase: BuildingPhase, tiles = closedEven): Placement[] {
  return dressPhase(phase, build(site, phase), wallColor(phase), tiles);
}

const sites = allSites();
const dressed = sites.flatMap((site) => site.phases.map((phase) => ({ site, phase, placed: dress(site, phase) })));

describe('facade grammar', () => {
  it('dresses the slice styles', () => {
    for (const style of ['ottoman-house', 'eclectic', 'bauhaus', 'modern-residential', 'gymnasium']) {
      const n = dressed.filter((d) => d.phase.style === style).reduce((s, d) => s + d.placed.length, 0);
      expect(n, style).toBeGreaterThan(0);
    }
  });

  it('keeps every module on the building: on its walls, under the roof', () => {
    for (const { site, phase, placed } of dressed) {
      if (!placed.length) continue;
      // the building as modelled (a few small parcels' houses overhang their footprint already)
      const walls = build(site, phase).filter((b) => b.box);
      const w = Math.max(...walls.map((b) => Math.max(-b.min[0], b.max[0])));
      const d = Math.max(...walls.map((b) => Math.max(-b.min[2], b.max[2])));
      for (const p of placed) {
        const where = `${site.id} ${phase.style} ${p.module}`;
        expect(Math.abs(p.x), where).toBeLessThanOrEqual(w + 0.01);
        expect(Math.abs(p.z), where).toBeLessThanOrEqual(d + 0.01);
        expect(p.y, where).toBeGreaterThan(0);
        expect(p.y + 2.2, where).toBeLessThan(roofHeight(phase) + 4.5);
      }
    }
  });

  it('matches the painted shutters', () => {
    const ottoman = dressed.find((d) => d.phase.style === 'ottoman-house' && d.placed.length > 2)!;
    const kinds = new Set(ottoman.placed.map((p) => p.module));
    expect(kinds).toEqual(new Set(['ottoman_open', 'ottoman_closed']));
    const open = dress(ottoman.site, ottoman.phase, () => ({ open: true, shutter: '#4a6a7a' }));
    expect(open.every((p) => p.module === 'ottoman_open' && p.colors.wood === '#4a6a7a')).toBe(true);
  });

  it('leaves a window alone where something stands in front of it', () => {
    const site: BuildingSite = { id: 't', x: 0, z: 0, rot: 0, width: 12, depth: 12, phases: [] };
    const phase: BuildingPhase = { from: 1922, style: 'eclectic', floors: 2 };
    const pb = new PartBuilder();
    pb.box('arched', 9, 6.8, 8, 0, 0, 0, '#fff');
    const free = dressPhase(phase, pb.bounds, '#ffffff', closedEven).filter((p) => p.rotY === 0);
    // 9 m holds three 3 m tiles, two storeys each
    expect(free.length).toBe(6);
    pb.box('wood', 1.4, 2.4, 0.3, -3, 0.5, 4.1, '#633');
    const doored = dressPhase(phase, pb.bounds, '#ffffff', closedEven).filter((p) => p.rotY === 0);
    expect(doored.length).toBe(5);
    expect(site.width).toBe(12);
  });

  it('runs a ribbon ledge along each band of a Bauhaus wall', () => {
    const phase: BuildingPhase = { from: 1936, style: 'bauhaus', floors: 3 };
    const pb = new PartBuilder();
    pb.box('bauhaus', 10, 9.3, 8, 0, 0, 0, '#fff');
    const front = dressPhase(phase, pb.bounds, '#ffffff', closedEven).filter((p) => p.rotY === 0);
    const ledges = front.filter((p) => p.module === 'bauhaus_ledge');
    expect(ledges.length).toBe(3);
    for (const l of ledges) expect(l.sx).toBeCloseTo(10);
    // two whole 4 m tiles per band
    expect(front.filter((p) => p.module === 'bauhaus_mullions').length).toBe(6);
  });

  it('only places modules the kit has', () => {
    const script = readFileSync(new URL('../tools/blender/kits/slice.py', import.meta.url), 'utf8');
    for (const m of MODULES) expect(script, m).toContain(`'${m}'`);
    for (const { placed } of dressed) for (const p of placed) expect(MODULES).toContain(p.module);
  });
});
