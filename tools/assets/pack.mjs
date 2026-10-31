#!/usr/bin/env node
/**
 * The asset pack: photo materials (KTX2) and Blender kits (meshopt glTF), served from
 * public/pack/. None of it is in git (see docs/REALISM_PLAN.md §6): git holds this script,
 * assets/materials.json, tools/blender/ and assets.lock.json (the pack's version and a SHA-256
 * per file). The built pack is a GitHub Release asset.
 *
 *   npm run assets            make public/pack match the lock: keep it, or fetch and verify the
 *                             published version; without one, the game keeps its procedural look
 *   npm run assets:build      build the pack from sources (needs Blender and KTX-Software) and
 *                             record its hashes in the lock
 *   npm run assets:publish -- <version>
 *                             upload public/pack as release `assets-<version>` (gh CLI) and pin
 *                             it in the lock. Outward-facing: only when the owner says so.
 *
 * Tools: KTX-Software's toktx and Blender 4.5, found on PATH or at TOKTX / BLENDER.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leafAtlas } from './foliage.mjs';
import { unzip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/pack');
const CACHE = join(ROOT, '.cache/assets');
const LOCK = join(ROOT, 'assets.lock.json');
const SIZES = { '1k': 1024, '2k': 2048 };
const win = process.platform === 'win32';
const TOKTX = process.env.TOKTX ?? (win ? 'C:\\Program Files\\KTX-Software\\bin\\toktx.exe' : 'toktx');
const BLENDER = process.env.BLENDER ?? (win ? 'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe' : 'blender');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readLock = () => JSON.parse(readFileSync(LOCK, 'utf8'));
const writeLock = (lock) => writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
const log = (s) => console.log(`[assets] ${s}`);

/** Whether public/pack holds exactly the files the lock lists. */
function packMatches(lock) {
  const names = Object.keys(lock.files ?? {});
  if (!names.length) return false;
  return names.every((n) => existsSync(join(OUT, n)) && sha256(readFileSync(join(OUT, n))) === lock.files[n]);
}

/** The KTX2 loader's transcoder, from three's examples, next to the pack. */
function copyTranscoder() {
  const from = join(ROOT, 'node_modules/three/examples/jsm/libs/basis');
  mkdirSync(join(OUT, 'basis'), { recursive: true });
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) copyFileSync(join(from, f), join(OUT, 'basis', f));
}

async function ensure() {
  const lock = readLock();
  if (packMatches(lock)) {
    copyTranscoder();
    log(`public/pack matches the lock (${lock.version ?? 'unpublished local build'})`);
    return;
  }
  if (!lock.version) {
    log('no published pack in assets.lock.json: the game keeps its procedural textures (npm run assets:build makes one)');
    return;
  }
  const base = lock.url.replace('{version}', lock.version);
  mkdirSync(OUT, { recursive: true });
  for (const [name, hash] of Object.entries(lock.files)) {
    const res = await fetch(base + name);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} from ${base + name}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== hash) throw new Error(`${name}: SHA-256 does not match assets.lock.json`);
    writeFileSync(join(OUT, name), buf);
  }
  copyTranscoder();
  log(`fetched pack ${lock.version}: ${Object.keys(lock.files).length} files, hashes verified`);
}

async function download(name, url) {
  const file = join(CACHE, name);
  if (existsSync(file)) return readFileSync(file);
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

function toktx(png, out, kind) {
  const common = ['--t2', '--genmipmap', '--threads', '8'];
  const opts =
    kind === 'normal'
      ? ['--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '3', '--zcmp', '18', '--assign_oetf', 'linear']
      : ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '160', '--assign_oetf', kind === 'color' ? 'srgb' : 'linear'];
  execFileSync(TOKTX, [...common, ...opts, out, png], { stdio: ['ignore', 'ignore', 'inherit'] });
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

async function buildMaterial(sharp, m, tmp) {
  const zip = unzip(await download(`${m.id}_2K-JPG.zip`, `https://ambientcg.com/get?file=${m.id}_2K-JPG.zip`));
  const map = (suffix) => [...zip.entries()].find(([n]) => n.endsWith(`_${suffix}.jpg`))?.[1];
  const color = map('Color');
  const normal = map('NormalGL');
  const rough = map('Roughness');
  const ao = map('AmbientOcclusion');
  if (!color || !normal || !rough) throw new Error(`${m.id}: missing Color, NormalGL or Roughness`);

  // means let the shader use the photo as detail on top of a painted colour
  const { data: small } = await sharp(color).resize(64, 64).raw().toBuffer({ resolveWithObject: true });
  const mean = [0, 0, 0];
  for (let i = 0; i < small.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += srgbToLinear(small[i + c] / 255);
  const px = small.length / 3;
  const { data: rSmall } = await sharp(rough).resize(64, 64).greyscale().raw().toBuffer({ resolveWithObject: true });
  const meanRough = rSmall.reduce((a, b) => a + b, 0) / rSmall.length / 255;

  const entry = { tile: m.tile, mean: mean.map((v) => +(v / px).toFixed(4)), roughness: +meanRough.toFixed(3), maps: {} };
  for (const [label, size] of Object.entries(SIZES)) {
    const files = {};
    const encode = async (kind, png) => {
      const src = join(tmp, `${m.name}_${label}_${kind}.png`);
      writeFileSync(src, png);
      const name = `${m.name}_${label}_${kind}.ktx2`;
      toktx(src, join(OUT, name), kind);
      files[kind] = name;
    };
    await encode('color', await sharp(color).resize(size, size).removeAlpha().png().toBuffer());
    // normals at half size: they are the heaviest maps and the least missed
    await encode('normal', await sharp(normal).resize(size / 2, size / 2).removeAlpha().png().toBuffer());
    // ORM: ambient occlusion in red, roughness in green (as three.js reads them)
    const grey = async (img) => (await sharp(img).resize(size, size).greyscale().raw().toBuffer());
    const r = ao ? await grey(ao) : Buffer.alloc(size * size, 255);
    const g = await grey(rough);
    const orm = Buffer.alloc(size * size * 3);
    for (let i = 0; i < size * size; i++) {
      orm[i * 3] = r[i];
      orm[i * 3 + 1] = g[i];
    }
    await encode('orm', await sharp(orm, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer());
    entry.maps[label] = files;
  }
  return entry;
}

function buildKit(name, tmp) {
  const raw = join(tmp, `${name}.raw.glb`);
  const out = `kit_${name}.glb`;
  execFileSync(
    BLENDER,
    ['-b', '--factory-startup', '-noaudio', '-P', join(ROOT, 'tools/blender/build_kit.py'), '--', join(ROOT, 'tools/blender/kits', `${name}.py`), raw],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const cli = join(ROOT, 'node_modules/@gltf-transform/cli/bin/cli.js');
  execFileSync(process.execPath, [cli, 'meshopt', raw, join(OUT, out), '--level', 'medium'], { stdio: ['ignore', 'ignore', 'inherit'] });
  return out;
}

async function build() {
  const sharp = (await import('sharp')).default;
  const spec = JSON.parse(readFileSync(join(ROOT, 'assets/materials.json'), 'utf8'));
  const tmp = join(CACHE, 'tmp');
  for (const d of [OUT, CACHE, tmp]) mkdirSync(d, { recursive: true });
  // emptied rather than removed: Windows keeps a folder that a shell or watcher has open
  for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });

  const manifest = { materials: {}, textures: {}, kits: {} };
  for (const m of spec.materials) {
    log(`material ${m.name} (${m.id})`);
    manifest.materials[m.name] = await buildMaterial(sharp, m, tmp);
  }
  // the tree kit's leaf cards: photographed leaves laid out by foliage.mjs, colour with alpha
  log('texture leaves');
  const sets = {};
  for (const { id } of spec.leafSets) sets[id] = unzip(await download(`${id}_2K-PNG.zip`, `https://ambientcg.com/get?file=${id}_2K-PNG.zip`));
  manifest.textures.leaves = {};
  for (const [label, size] of Object.entries(SIZES)) {
    const src = join(tmp, `leaves_${label}.png`);
    writeFileSync(src, await leafAtlas(sharp, size, sets));
    toktx(src, join(OUT, `leaves_${label}.ktx2`), 'color');
    manifest.textures.leaves[label] = `leaves_${label}.ktx2`;
  }
  for (const f of readdirSync(join(ROOT, 'tools/blender/kits')).filter((f) => f.endsWith('.py'))) {
    const name = basename(f, '.py');
    log(`kit ${name}`);
    manifest.kits[name] = buildKit(name, tmp);
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  rmSync(tmp, { recursive: true, force: true });

  const files = {};
  let bytes = 0;
  for (const f of readdirSync(OUT).filter((f) => f !== 'basis').sort()) {
    const buf = readFileSync(join(OUT, f));
    files[f] = sha256(buf);
    bytes += buf.length;
  }
  const lock = readLock();
  writeLock({ ...lock, version: null, files });
  copyTranscoder();
  log(`built ${Object.keys(files).length} files, ${(bytes / 1e6).toFixed(1)} MB; assets.lock.json updated (unpublished)`);
  for (const label of Object.keys(SIZES)) {
    const n = readdirSync(OUT).filter((f) => f.includes(`_${label}_`)).reduce((a, f) => a + readFileSync(join(OUT, f)).length, 0);
    log(`  ${label} materials: ${(n / 1e6).toFixed(1)} MB`);
  }
}

function publish(version) {
  if (!version || !/^[\w.-]+$/.test(version)) throw new Error('usage: npm run assets:publish -- <version>');
  const lock = readLock();
  if (!packMatches(lock)) throw new Error('public/pack does not match assets.lock.json: run npm run assets:build first');
  const tag = `assets-${version}`;
  const files = Object.keys(lock.files).map((f) => join(OUT, f));
  execFileSync('gh', ['release', 'create', tag, '--title', `Asset pack ${version}`, '--notes', 'Built by `npm run assets:build`. CC0 sources: assets/materials.json.', ...files], { stdio: 'inherit' });
  writeLock({ ...lock, version });
  log(`published ${tag}; assets.lock.json now pins it`);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'build') await build();
  else if (cmd === 'publish') publish(arg);
  else await ensure();
} catch (e) {
  console.error(`[assets] ${e.message}`);
  process.exit(1);
}
