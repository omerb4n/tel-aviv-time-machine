import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build tool, no types
import { unzip } from '../tools/assets/zip.mjs';

const json = (f: string) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));

/** A minimal zip writer for the test: each entry stored or deflated. */
function zip(entries: { name: string; data: Buffer; deflate: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe('asset pack', () => {
  it('reads stored and deflated zip entries', () => {
    const text = Buffer.from('lime plaster '.repeat(200));
    const files = unzip(
      zip([
        { name: 'Plaster007_2K-JPG/', data: Buffer.alloc(0), deflate: false },
        { name: 'Plaster007_2K-JPG/Plaster007_2K-JPG_Color.jpg', data: text, deflate: true },
        { name: 'Plaster007.usda', data: Buffer.from('#usda 1.0'), deflate: false },
      ]),
    );
    expect([...files.keys()]).toEqual(['Plaster007_2K-JPG/Plaster007_2K-JPG_Color.jpg', 'Plaster007.usda']);
    expect(files.get('Plaster007_2K-JPG/Plaster007_2K-JPG_Color.jpg')!.equals(text)).toBe(true);
  });

  it('lists CC0 materials with a real-world tile size', () => {
    const spec = json('assets/materials.json');
    expect(spec.licence).toBe('CC0 1.0');
    const names = new Set<string>();
    for (const m of spec.materials) {
      expect(m.name).toMatch(/^[a-z]+$/);
      expect(m.id).toMatch(/^[A-Za-z]+\d+[A-Z]?$/);
      expect(m.tile).toBeGreaterThan(0.5);
      expect(m.tile).toBeLessThan(10);
      names.add(m.name);
    }
    expect(names.size).toBe(spec.materials.length);
  });

  it('pins the pack by version and SHA-256 per file', () => {
    const lock = json('assets.lock.json');
    expect(lock.version === null || /^[\w.-]+$/.test(lock.version)).toBe(true);
    expect(lock.url).toContain('{version}');
    for (const [name, hash] of Object.entries(lock.files)) {
      // flat names: release assets cannot hold folders
      expect(name).toMatch(/^[\w.-]+$/);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
