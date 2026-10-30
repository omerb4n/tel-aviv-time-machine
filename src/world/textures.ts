import * as THREE from 'three';
import { mulberry32 } from '../core/math';

/**
 * All textures are painted procedurally on canvases at startup: no binary assets,
 * tiny download, and easy to tweak. Each facade texture is a 4×4 atlas of
 * "window tiles" with its own emissive twin (randomly lit windows for night).
 */

export interface FacadeTexture {
  map: THREE.Texture;
  emissive: THREE.Texture;
  /** World size of the full atlas in metres (repeat = 1 / size). */
  size: [number, number];
  /**
   * What each window tile shows, where the painter says (`tiles[column][row]`, rows counted
   * down from the top of the canvas): the facade grammar matches 3D shutters to it.
   */
  tiles: (TileInfo | undefined)[][];
}

/** A painted window tile's state: shutters open or closed, and their colour. */
export interface TileInfo {
  open: boolean;
  shutter: string;
}

const PPM = 40; // pixels per metre
const ATLAS = 4;

type TilePainter = (
  g: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rng: () => number,
  lit: boolean,
) => TileInfo | void;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const img = g.getImageData(0, 0, w, h);
  const rng = mulberry32(seed);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facade(tileW: number, tileH: number, wall: string, paint: TilePainter, seed: number, noise = 14): FacadeTexture {
  const tw = tileW * PPM;
  const th = tileH * PPM;
  const c = canvas(tw * ATLAS, th * ATLAS);
  const ce = canvas(tw * ATLAS, th * ATLAS);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const e = ce.getContext('2d')!;
  g.fillStyle = wall;
  g.fillRect(0, 0, c.width, c.height);
  e.fillStyle = '#000';
  e.fillRect(0, 0, ce.width, ce.height);
  const rng = mulberry32(seed);
  const tiles: (TileInfo | undefined)[][] = [];
  for (let i = 0; i < ATLAS; i++) {
    tiles.push([]);
    for (let j = 0; j < ATLAS; j++) tiles[i].push(paint(g, e, i * tw, j * th, tw, th, rng, rng() < 0.38) ?? undefined);
  }
  speckle(g, c.width, c.height, noise, seed + 1);
  return { map: toTexture(c), emissive: toTexture(ce), size: [tileW * ATLAS, tileH * ATLAS], tiles };
}

function glassPane(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: () => number, tint = [40, 52, 60]) {
  const grad = g.createLinearGradient(x, y, x + w * 0.4, y + h);
  const k = 0.8 + rng() * 0.4;
  grad.addColorStop(0, `rgb(${tint[0] * k + 50},${tint[1] * k + 55},${tint[2] * k + 60})`);
  grad.addColorStop(1, `rgb(${tint[0] * k},${tint[1] * k},${tint[2] * k})`);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
}

function litPane(e: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: () => number, lit: boolean) {
  if (!lit) return;
  const warm = rng();
  e.fillStyle = warm < 0.75 ? `rgb(255,${190 + rng() * 40},${120 + rng() * 50})` : 'rgb(200,220,255)';
  e.fillRect(x, y, w, h);
}

const P = PPM;

/** Late-Ottoman / early houses: tall window with green wooden shutters. */
const ottoman: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const ww = 0.95 * P;
  const wh = 1.75 * P;
  const wx = x + (w - ww) / 2;
  const wy = y + h - wh - 0.85 * P;
  const shutterOpen = rng() < 0.6;
  const shutter = ['#4d7766', '#5b7f8f', '#6f8a55', '#4a6a7a'][Math.floor(rng() * 4)];
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(wx - 6, wy - 6, ww + 12, wh + 14);
  if (shutterOpen) {
    glassPane(g, wx, wy, ww, wh, rng);
    g.fillStyle = shutter;
    g.fillRect(wx - ww / 2 - 2, wy, ww / 2, wh);
    g.fillRect(wx + ww + 2, wy, ww / 2, wh);
    litPane(e, wx, wy, ww, wh, rng, lit);
  } else {
    g.fillStyle = shutter;
    g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < wh; k += 6) g.fillRect(wx, wy + k, ww, 2);
    g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(wx - 8, wy + wh, ww + 16, 6); // sill
  return { open: shutterOpen, shutter };
};

/** Eclectic: arched windows with a decorative keystone band. */
const arched: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const ww = 1.0 * P;
  const wh = 1.9 * P;
  const wx = x + (w - ww) / 2;
  const wy = y + h - wh - 0.8 * P;
  g.fillStyle = 'rgba(120,90,60,0.18)';
  g.beginPath();
  g.arc(wx + ww / 2, wy + ww / 2, ww / 2 + 8, Math.PI, 0);
  g.rect(wx - 8, wy + ww / 2, ww + 16, wh - ww / 2 + 4);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
  g.rect(wx, wy + ww / 2, ww, wh - ww / 2);
  g.clip();
  glassPane(g, wx, wy, ww, wh, rng);
  g.fillStyle = 'rgba(230,230,220,0.6)';
  g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
  g.fillRect(wx, wy + ww / 2, ww, 3);
  g.restore();
  e.save();
  e.beginPath();
  e.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
  e.rect(wx, wy + ww / 2, ww, wh - ww / 2);
  e.clip();
  litPane(e, wx, wy, ww, wh, rng, lit);
  e.restore();
  g.fillStyle = 'rgba(70,110,150,0.35)';
  g.fillRect(x, y + 0.25 * P, w, 0.12 * P);
};

/** International Style: long horizontal ribbon window. */
const ribbon: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const wh = 1.2 * P;
  const wy = y + h - wh - 0.95 * P;
  glassPane(g, x, wy, w, wh, rng, [45, 55, 62]);
  litPane(e, x + 4, wy, w - 8, wh, rng, lit);
  g.fillStyle = 'rgba(240,240,235,0.85)';
  for (let k = 0; k <= w; k += 0.8 * P) g.fillRect(x + k - 1.5, wy, 3, wh);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(x, wy + wh, w, 5);
  if (rng() < 0.3) {
    g.fillStyle = 'rgba(230,225,210,0.95)'; // a closed roller shutter
    g.fillRect(x + w * 0.1, wy, w * 0.35, wh * (0.4 + rng() * 0.6));
  }
};

/** Austerity blocks: small windows, often with half-lowered roller shutters. */
const small: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const ww = 1.25 * P;
  const wh = 1.25 * P;
  const wx = x + (w - ww) / 2;
  const wy = y + h - wh - 0.95 * P;
  glassPane(g, wx, wy, ww, wh, rng);
  litPane(e, wx, wy, ww, wh, rng, lit);
  g.fillStyle = 'rgba(215,205,185,0.95)';
  g.fillRect(wx, wy, ww, wh * rng() * 0.8);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(wx - 3, wy + wh, ww + 6, 4);
};

/** Concrete: full-width dark glazing band under a deep sunshade. */
const band: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const wh = 1.4 * P;
  const wy = y + h - wh - 0.6 * P;
  glassPane(g, x, wy, w, wh, rng, [35, 40, 42]);
  litPane(e, x + 2, wy + 2, w - 4, wh - 4, rng, lit);
  g.fillStyle = 'rgba(40,40,40,0.5)';
  for (let k = 0; k <= w; k += 1.2 * P) g.fillRect(x + k, wy, 3, wh);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x, wy - 0.25 * P, w, 0.25 * P);
};

/** Contemporary: floor-to-ceiling glazing between plaster piers. */
const modern: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const wh = h - 0.7 * P;
  const ww = w - 0.8 * P;
  const wx = x + 0.4 * P;
  const wy = y + 0.35 * P;
  glassPane(g, wx, wy, ww, wh, rng, [55, 70, 82]);
  litPane(e, wx, wy, ww, wh, rng, lit);
  g.fillStyle = 'rgba(220,225,228,0.8)';
  g.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
};

/** Curtain wall: reflective panels with thin mullions. */
const curtain: TilePainter = (g, e, x, y, w, h, rng, lit) => {
  const k = 0.85 + rng() * 0.3;
  g.fillStyle = `rgb(${120 * k},${150 * k},${170 * k})`;
  g.fillRect(x, y, w, h);
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(60,70,80,0.9)';
  g.fillRect(x, y, 3, h);
  g.fillRect(x, y + h - 0.35 * P, w, 0.35 * P);
  if (lit) {
    e.fillStyle = rng() < 0.5 ? 'rgb(235,240,255)' : 'rgb(255,220,170)';
    e.fillRect(x + 4, y + 4, w - 8, h - 0.4 * P - 6);
  }
};

function roofTiles(): THREE.Texture {
  const c = canvas(256, 256);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const rng = mulberry32(77);
  g.fillStyle = '#a9472a';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 32 + (row % 2) * 16;
      const k = 0.8 + rng() * 0.35;
      g.fillStyle = `rgb(${190 * k},${85 * k},${55 * k})`;
      g.beginPath();
      g.ellipse(x + 16, row * 16 + 10, 15, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, row * 16 + 14, 32, 2);
    }
  }
  speckle(g, 256, 256, 18, 3);
  return toTexture(c);
}

function stoneBlocks(): THREE.Texture {
  const c = canvas(256, 256);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const rng = mulberry32(91);
  g.fillStyle = '#b9a98a';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    let x = -(row % 2) * 24;
    while (x < 256) {
      const bw = 36 + rng() * 30;
      const k = 0.88 + rng() * 0.18;
      g.fillStyle = `rgb(${226 * k},${210 * k},${178 * k})`;
      g.fillRect(x + 2, row * 32 + 2, bw - 3, 28);
      x += bw;
    }
  }
  speckle(g, 256, 256, 26, 5);
  return toTexture(c);
}

function plain(base: string, amount: number, seed: number, size = 256): THREE.Texture {
  const c = canvas(size, size);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  speckle(g, size, size, amount, seed);
  return toTexture(c);
}

export interface TextureSet {
  facades: Record<'plaster' | 'arched' | 'bauhaus' | 'shikun' | 'concrete' | 'modern' | 'glass', FacadeTexture>;
  roofTile: THREE.Texture;
  stone: THREE.Texture;
  plaster: THREE.Texture;
  sand: THREE.Texture;
  asphalt: THREE.Texture;
  paving: THREE.Texture;
}

function sandTex(): THREE.Texture {
  const c = canvas(512, 512);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  const rng = mulberry32(12);
  // wind ripples
  for (let i = 0; i < 260; i++) {
    const y = rng() * 512;
    g.strokeStyle = `rgba(150,120,80,${0.04 + rng() * 0.05})`;
    g.lineWidth = 1 + rng() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
    g.stroke();
  }
  speckle(g, 512, 512, 30, 13);
  return toTexture(c);
}

function pavingTex(): THREE.Texture {
  const c = canvas(256, 256);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#c9c3b6';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(80,70,60,0.35)';
  g.lineWidth = 2;
  for (let k = 0; k <= 256; k += 32) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k, 256);
    g.moveTo(0, k);
    g.lineTo(256, k);
    g.stroke();
  }
  speckle(g, 256, 256, 22, 21);
  return toTexture(c);
}

export function createTextures(): TextureSet {
  return {
    facades: {
      plaster: facade(3.2, 3.6, '#f4efe4', ottoman, 1),
      arched: facade(3.0, 3.4, '#f4ede0', arched, 2),
      bauhaus: facade(4.0, 3.1, '#f7f6f2', ribbon, 3, 10),
      shikun: facade(3.0, 2.9, '#f2ece0', small, 4),
      concrete: facade(3.6, 3.4, '#e2e0dc', band, 5, 30),
      modern: facade(3.4, 3.2, '#f5f5f3', modern, 6, 6),
      glass: facade(1.6, 3.6, '#8aa0b0', curtain, 7, 4),
    },
    roofTile: roofTiles(),
    stone: stoneBlocks(),
    plaster: plain('#f2eee6', 16, 31),
    sand: sandTex(),
    asphalt: plain('#8a8986', 26, 41, 256),
    paving: pavingTex(),
  };
}
