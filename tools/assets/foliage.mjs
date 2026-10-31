/**
 * The leaf atlas for the tree kit (tools/blender/kits/trees.py), made of photographed leaves:
 * ambientCG's CC0 leaf sets (assets/materials.json `leaves`) are cut into single leaves by their
 * opacity maps, and the leaves are laid along twigs the way each species carries them
 * (docs/REFERENCE_BOARD.md). Four cells, each a card's worth of foliage on a transparent ground:
 *
 *   top left: ficus (LeafSet022, elliptic, dark)     top right: royal poinciana (LeafSet002 sprigs
 *                                                    as the pinnae of fern-like leaves)
 *   bottom left: a palm frond's surface (a leaf of   bottom right: Italian cypress (LeafSet019
 *   LeafSet022 filling the cell; the frond's         scale-leaf sprays)
 *   geometry gives it its shape)
 *
 * The cards' UVs in the kit address these quarters; keep the two in step.
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The single leaves of a leaf set: RGBA PNGs cropped round each opaque blob of the opacity map,
 * largest first, and the direction each one points (its long axis, as an angle).
 */
async function sprites(sharp, color, opacity, look) {
  const W = 256;
  const { data: small, info } = await sharp(opacity).greyscale().resize(W, W, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const full = await sharp(opacity).metadata();
  const k = full.width / info.width;
  const seen = new Uint8Array(W * W);
  const boxes = [];
  for (let i = 0; i < W * W; i++) {
    if (seen[i] || small[i] < 128) continue;
    let [x0, y0, x1, y1, n] = [W, W, 0, 0, 0];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % W;
      const y = (j / W) | 0;
      n++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      for (const d of [-1, 1, -W, W]) {
        const q = j + d;
        if (q < 0 || q >= W * W || seen[q] || small[q] < 128 || (d === -1 && x === 0) || (d === 1 && x === W - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (n > 40) boxes.push({ x0, y0, x1, y1, n });
  }
  boxes.sort((a, b) => b.n - a.n);
  // colour from the colour map, alpha from the opacity map (joinChannel drops it on some PNGs)
  const rgb = await sharp(color).removeAlpha().modulate(look).raw().toBuffer();
  const a = await sharp(opacity).greyscale().extractChannel(0).raw().toBuffer();
  const px = Buffer.alloc(full.width * full.height * 4);
  for (let i = 0; i < full.width * full.height; i++) {
    px[i * 4] = rgb[i * 3];
    px[i * 4 + 1] = rgb[i * 3 + 1];
    px[i * 4 + 2] = rgb[i * 3 + 2];
    px[i * 4 + 3] = a[i];
  }
  const rgba = await sharp(px, { raw: { width: full.width, height: full.height, channels: 4 } }).png().toBuffer();
  const out = [];
  for (const b of boxes) {
    const left = Math.max(0, Math.floor((b.x0 - 1) * k));
    const top = Math.max(0, Math.floor((b.y0 - 1) * k));
    const width = Math.min(full.width - left, Math.ceil((b.x1 - b.x0 + 3) * k));
    const height = Math.min(full.height - top, Math.ceil((b.y1 - b.y0 + 3) * k));
    out.push({ png: await sharp(rgba).extract({ left, top, width, height }).png().toBuffer(), w: width, h: height });
  }
  return out;
}

/** A leaf scaled to `size` px along its long side and turned `deg` (0: pointing up, as photographed). */
async function place(sharp, s, size, deg) {
  const scale = size / Math.max(s.w, s.h);
  const img = await sharp(s.png)
    .resize(Math.max(2, Math.round(s.w * scale)), Math.max(2, Math.round(s.h * scale)))
    .rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const m = await sharp(img).metadata();
  return { img, w: m.width, h: m.height };
}

/** Twigs as thin dark strokes; returns the SVG and the points leaves sit at, with their outward angle. */
function twigs(C, r, n, spread, reach, perTwig, colour, width) {
  let svg = '';
  const spots = [];
  for (let b = 0; b < n; b++) {
    const a = -Math.PI / 2 + (r() - 0.5) * spread;
    const len = C * reach * (0.75 + r() * 0.3);
    const x0 = C / 2 + (r() - 0.5) * C * 0.25;
    const y0 = C * 0.98;
    const bend = (r() - 0.5) * 0.5;
    let [x, y, d] = [x0, y0, a];
    let path = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let i = 1; i <= perTwig; i++) {
      d += bend / perTwig;
      x += (Math.cos(d) * len) / perTwig;
      y += (Math.sin(d) * len) / perTwig;
      path += `L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (i > perTwig * 0.15) spots.push([x, y, d]);
    }
    svg += `<path d="${path}" stroke="${colour}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
  }
  return { svg, spots };
}

async function cell(sharp, C, base, layers) {
  return sharp(base).composite(layers.map((l) => ({ input: l.img, left: Math.round(l.x - l.w / 2), top: Math.round(l.y - l.h / 2) })).filter((l) => l.left > -C && l.top > -C)).png().toBuffer();
}

const blank = (sharp, C, svg = '') => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}">${svg}</svg>`)).png().toBuffer();

/** Ficus: alternate leaves crowding short twigs, 5–8 cm leaves on a 2 m card. */
async function ficus(sharp, C, leaves) {
  const r = rng(11);
  const { svg, spots } = twigs(C, r, 20, 2.9, 0.88, 13, '#4f463b', C * 0.005);
  const layers = [];
  for (const [x, y, d] of spots)
    for (const side of [-1, 1]) {
      const s = leaves[Math.floor(r() * Math.min(leaves.length, 12))];
      const deg = ((d + side * (0.6 + r() * 0.5)) * 180) / Math.PI + 90;
      const l = await place(sharp, s, C * (0.05 + r() * 0.025), deg);
      layers.push({ ...l, x: x + Math.cos(d + side * 1.2) * C * 0.02, y: y + Math.sin(d + side * 1.2) * C * 0.02 });
    }
  return cell(sharp, C, await blank(sharp, C, svg), layers);
}

/** Royal poinciana: bipinnate leaves, each pinna a photographed sprig of small leaflets. */
async function poinciana(sharp, C, sprigs) {
  const r = rng(12);
  let svg = '';
  const layers = [];
  for (let b = 0; b < 18; b++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.8;
    const len = C * (0.55 + r() * 0.3);
    const x0 = C / 2 + (r() - 0.5) * C * 0.3;
    const y0 = C * (0.8 + r() * 0.17);
    svg += `<path d="M${x0} ${y0} L${x0 + Math.cos(a) * len} ${y0 + Math.sin(a) * len}" stroke="#5a5a3c" stroke-width="${C * 0.0025}"/>`;
    for (let i = 2; i < 16; i++) {
      const t = (i / 16) * len;
      for (const side of [-1, 1]) {
        const s = sprigs[Math.floor(r() * Math.min(sprigs.length, 10))];
        const d = a + side * (1.1 + r() * 0.2);
        const size = C * (0.08 - i * 0.002);
        const l = await place(sharp, s, size, (d * 180) / Math.PI + 90);
        layers.push({ ...l, x: x0 + Math.cos(a) * t + Math.cos(d) * size * 0.45, y: y0 + Math.sin(a) * t + Math.sin(d) * size * 0.45 });
      }
    }
  }
  return cell(sharp, C, await blank(sharp, C, svg), layers);
}

/** Italian cypress: dense overlapping sprays, pointing up and out. */
async function cypress(sharp, C, sprays) {
  const r = rng(14);
  const layers = [];
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const s = sprays[Math.floor(r() * Math.min(sprays.length, 6))];
    // photographed lying down; on the tree the sprays point up
    const l = await place(sharp, s, C * (0.16 + r() * 0.1), 90 + (r() - 0.5) * 60);
    layers.push({ ...l, x: C / 2 + Math.cos(a) * d * C * 0.36, y: C / 2 + Math.sin(a) * d * C * 0.4 });
  }
  return cell(sharp, C, await blank(sharp, C), layers);
}

/** A palm frond's surface: the middle of the largest photographed leaf, filling the cell. */
async function frond(sharp, C, color) {
  const m = await sharp(color).metadata();
  return sharp(color)
    .extract({ left: Math.round(m.width * 0.455), top: Math.round(m.height * 0.14), width: Math.round(m.width * 0.07), height: Math.round(m.height * 0.22) })
    .resize(C, C, { fit: 'fill' })
    .modulate({ brightness: 0.85, saturation: 0.65 })
    .ensureAlpha(1)
    .png()
    .toBuffer();
}

/**
 * The atlas as a PNG of `size` × `size`. `sets` maps a leaf set's id to its unzipped files.
 * Transparent texels take the colour of their cell's leaves, so mipmaps don't fringe the cards.
 */
export async function leafAtlas(sharp, size, sets) {
  const C = size / 2;
  const map = (id, suffix) => [...sets[id].entries()].find(([n]) => n.endsWith(`_${suffix}.png`))[1];
  // leaves photographed on a light box are pale: darken them to how they look on a tree in sun
  const ficusLeaves = await sprites(sharp, map('LeafSet022', 'Color'), map('LeafSet022', 'Opacity'), { brightness: 0.62, saturation: 1.05 });
  const sprigs = await sprites(sharp, map('LeafSet002', 'Color'), map('LeafSet002', 'Opacity'), { brightness: 0.7, saturation: 1.1 });
  const sprays = await sprites(sharp, map('LeafSet019', 'Color'), map('LeafSet019', 'Opacity'), { brightness: 0.45, saturation: 0.75 });
  const cells = [
    await ficus(sharp, C, ficusLeaves),
    await poinciana(sharp, C, sprigs),
    await frond(sharp, C, map('LeafSet022', 'Color')),
    await cypress(sharp, C, sprays),
  ];
  const atlas = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells.map((input, i) => ({ input, left: (i % 2) * C, top: Math.floor(i / 2) * C })))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = atlas;
  const w = info.width;
  for (const [cx, cy] of [
    [0, 0],
    [C, 0],
    [0, C],
    [C, C],
  ]) {
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = cy; y < cy + C; y++)
      for (let x = cx; x < cx + C; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 200) {
          for (let c = 0; c < 3; c++) sum[c] += data[i + c];
          n++;
        }
      }
    const mean = sum.map((v) => Math.round(v / Math.max(1, n)));
    for (let y = cy; y < cy + C; y++)
      for (let x = cx; x < cx + C; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 16) for (let c = 0; c < 3; c++) data[i + c] = mean[c];
      }
  }
  return sharp(data, { raw: { width: w, height: info.height, channels: 4 } }).png().toBuffer();
}

