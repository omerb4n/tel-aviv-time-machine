import { clamp } from '../core/math';
import { halfWidth } from '../data/streets';
import { h } from '../ui/dom';
import { MAP_BOUNDS, RAILWAY, type YearLayer } from './mapData';

/** Everything the map draws on top of the year layer. */
export interface MapOverlay {
  player: { x: number; z: number; yaw: number };
  /** Walked trail, oldest first. */
  trail: [number, number][];
  /** Discovered landmarks (named pins). */
  pins: { x: number; z: number; label: string }[];
  /** Where clues were found (numbered stamps). */
  stamps: { x: number; z: number; n: number }[];
  /** Hint search area (dashed circle) or exact spot (pin). */
  hint?: { x: number; z: number; r: number; exact: boolean };
}

interface View {
  cx: number;
  cz: number;
  /** CSS pixels per metre. */
  ppm: number;
  /** Rotation (radians): the player's yaw for a heading-up map, 0 for north-up. */
  rot: number;
  w: number;
  h: number;
  labels: boolean;
}

const INK = {
  survey: { land: '#ecdfc1', sea: '#a8bcb2', seaLine: 'rgba(60,80,76,0.25)', ink: '#4b3a28', street: '#f7efdc', sand: '#e6d29f', casing: '#8a7354', bldg: 'rgba(92,70,46,0.55)', lm: '#1c3a78', trail: 'rgba(60,45,30,0.7)' },
  modern: { land: '#efebe2', sea: '#9cbfd4', seaLine: 'rgba(40,70,100,0.18)', ink: '#24262b', street: '#ffffff', sand: '#e6d29f', casing: '#b8b0a0', bldg: 'rgba(58,61,66,0.32)', lm: '#1c3a78', trail: 'rgba(40,40,46,0.6)' },
};
const CLAY = '#b4442f';
const FONT = (px: number, weight = 600) => `${weight} ${px}px Assistant, Heebo, system-ui, sans-serif`;

/** Draws a year layer and overlay into a 2D context (CSS-pixel coordinates). */
export function drawMap(g: CanvasRenderingContext2D, layer: YearLayer, ov: MapOverlay, v: View) {
  const C = INK[layer.style];
  const k = v.ppm;
  const cos = Math.cos(v.rot);
  const sin = Math.sin(v.rot);
  /** world → screen */
  const S = (x: number, z: number): [number, number] => {
    const dx = (x - v.cx) * k;
    const dz = (z - v.cz) * k;
    return [v.w / 2 + dx * cos - dz * sin, v.h / 2 + dx * sin + dz * cos];
  };
  const reach = Math.hypot(v.w, v.h) / 2 / k + 40; // visible radius in metres
  const near = (x: number, z: number, r = 0) => Math.abs(x - v.cx) < reach + r && Math.abs(z - v.cz) < reach + r;

  g.save();
  g.fillStyle = C.land;
  g.fillRect(0, 0, v.w, v.h);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // sea: everything west of the coast, with engraved water lines
  g.beginPath();
  layer.coast.forEach(([x, z], i) => (i ? g.lineTo(...S(x, z)) : g.moveTo(...S(x, z))));
  g.lineTo(...S(MAP_BOUNDS.minX - 3000, MAP_BOUNDS.maxZ));
  g.lineTo(...S(MAP_BOUNDS.minX - 3000, MAP_BOUNDS.minZ));
  g.closePath();
  g.fillStyle = C.sea;
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = C.seaLine;
  g.lineWidth = 1;
  for (let i = -40; i <= 40; i++) {
    const off = i * Math.max(6, 18 * k);
    if (Math.abs(off) > v.w + v.h) continue;
    g.beginPath();
    // lines parallel to the screen's horizontal for an engraved look
    g.moveTo(-v.w, v.h / 2 + off);
    g.lineTo(v.w * 2, v.h / 2 + off);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.5;
  g.lineWidth = 1.2;
  g.beginPath();
  layer.coast.forEach(([x, z], i) => (i ? g.lineTo(...S(x, z)) : g.moveTo(...S(x, z))));
  g.stroke();
  g.globalAlpha = 1;

  // old settlements: stippled discs
  for (const p of layer.places) {
    if (!near(p.x, p.z, 400)) continue;
    const [sx, sy] = S(p.x, p.z);
    const r = (p.label === 'Jaffa' ? 300 : 170) * k;
    g.fillStyle = layer.style === 'survey' ? 'rgba(120,90,55,0.18)' : 'rgba(80,80,90,0.12)';
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
  }

  // railway
  if (layer.railway) {
    g.strokeStyle = C.ink;
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.beginPath();
    RAILWAY.forEach(([x, z], i) => (i ? g.lineTo(...S(x, z)) : g.moveTo(...S(x, z))));
    g.stroke();
    g.setLineDash([]);
  }

  // buildings
  for (const f of layer.footprints) {
    if (!near(f.x, f.z, 60)) continue;
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    // local (lx, lz) → world: x = cx + lx*c + lz*s, z = cz - lx*s + lz*c  (matches siteRect axes)
    const P = (lx: number, lz: number) => S(f.x + lx * c + lz * s, f.z - lx * s + lz * c);
    g.beginPath();
    g.moveTo(...P(-f.hw, -f.hd));
    g.lineTo(...P(f.hw, -f.hd));
    g.lineTo(...P(f.hw, f.hd));
    g.lineTo(...P(-f.hw, f.hd));
    g.closePath();
    g.fillStyle = C.bldg;
    g.fill();
  }

  // streets: casing, then fill (sand tracks before paving)
  for (const pass of [0, 1]) {
    for (const ms of layer.streets) {
      const st = ms.street;
      const w = (halfWidth(st) * 2 + st.sidewalk * 2) * k;
      g.beginPath();
      st.points.forEach(([x, z], i) => (i ? g.lineTo(...S(x, z)) : g.moveTo(...S(x, z))));
      g.strokeStyle = pass === 0 ? C.casing : ms.unpaved ? C.sand : C.street;
      g.lineWidth = pass === 0 ? w + 2 : Math.max(1.5, w);
      if (pass === 0 && ms.unpaved) g.setLineDash([3, 3]);
      g.stroke();
      g.setLineDash([]);
    }
  }

  // trail: a pencil line (gaps where the player jumped)
  if (ov.trail.length > 1) {
    g.strokeStyle = C.trail;
    g.lineWidth = 1.6;
    g.setLineDash([2, 3]);
    g.beginPath();
    for (let i = 0; i < ov.trail.length; i++) {
      const [x, z] = ov.trail[i];
      const prev = ov.trail[i - 1];
      if (!prev || Math.hypot(x - prev[0], z - prev[1]) > 30) g.moveTo(...S(x, z));
      else g.lineTo(...S(x, z));
    }
    g.stroke();
    g.setLineDash([]);
  }

  // labels (full map only; north-up so text stays upright)
  if (v.labels) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const ms of layer.streets) {
      const pts = ms.street.points;
      // label the segment nearest the view centre, at the nearest point (so long streets keep a label)
      let best = 1;
      let bestD = Infinity;
      let tBest = 0.5;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const dx = pts[i][0] - ax;
        const dz = pts[i][1] - az;
        const t = clamp(((v.cx - ax) * dx + (v.cz - az) * dz) / (dx * dx + dz * dz), 0.15, 0.85);
        const d = Math.hypot(v.cx - (ax + dx * t), v.cz - (az + dz * t));
        if (d < bestD) [best, bestD, tBest] = [i, d, t];
      }
      const [a, b] = [S(...pts[best - 1]), S(...pts[best])];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 90) continue;
      const mid: [number, number] = [a[0] + (b[0] - a[0]) * tBest, a[1] + (b[1] - a[1]) * tBest];
      if (mid[0] < 30 || mid[0] > v.w - 30 || mid[1] < 30 || mid[1] > v.h - 30) continue;
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      g.save();
      g.translate(mid[0], mid[1]);
      g.rotate(ang);
      g.font = FONT(clamp(11 * Math.sqrt(k), 10, 15), 700);
      g.lineWidth = 3;
      g.strokeStyle = C.land;
      g.strokeText(ms.street.name.en, 0, 0);
      g.fillStyle = C.ink;
      g.fillText(ms.street.name.en, 0, 0);
      g.restore();
    }
    g.font = `italic ${FONT(13, 600)}`;
    g.fillStyle = C.ink;
    for (const p of layer.places) {
      if (!near(p.x, p.z, 300)) continue;
      g.fillText(p.label, ...S(p.x, p.z));
    }
    const sea = S(-1400, -300);
    g.fillStyle = 'rgba(30,50,60,0.55)';
    g.fillText('Mediterranean Sea', sea[0], sea[1]);
  }

  // discovered landmarks
  for (const p of ov.pins) {
    if (!near(p.x, p.z)) continue;
    const [sx, sy] = S(p.x, p.z);
    g.fillStyle = C.lm;
    g.strokeStyle = '#fff8e8';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(sx, sy - 6);
    g.lineTo(sx + 5, sy);
    g.lineTo(sx, sy + 6);
    g.lineTo(sx - 5, sy);
    g.closePath();
    g.fill();
    g.stroke();
    if (v.labels) {
      g.font = FONT(12, 700);
      g.textAlign = 'left';
      g.lineWidth = 3;
      g.strokeStyle = C.land;
      g.strokeText(p.label, sx + 8, sy);
      g.fillStyle = C.lm;
      g.fillText(p.label, sx + 8, sy);
      g.textAlign = 'center';
    }
  }

  // clue stamps
  const placed: [number, number][] = [];
  for (const s of ov.stamps) {
    if (!near(s.x, s.z)) continue;
    let [sx, sy] = S(s.x, s.z);
    // clues found at the same place fan out around it instead of piling up
    const [ox, oy] = [sx, sy];
    for (let k2 = 0; placed.some(([px2, py2]) => Math.hypot(px2 - sx, py2 - sy) < 15) && k2 < 12; k2++) {
      const ang = (k2 / 6) * Math.PI * 2;
      const rr = 16 * (1 + Math.floor(k2 / 6));
      [sx, sy] = [ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr];
    }
    placed.push([sx, sy]);
    g.fillStyle = CLAY;
    g.beginPath();
    g.arc(sx, sy, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff8e8';
    g.font = FONT(10, 700);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(s.n), sx, sy + 0.5);
  }

  // hint
  if (ov.hint) {
    const hp = ov.hint;
    let [sx, sy] = S(hp.x, hp.z);
    const r = hp.exact ? 9 : hp.r * k;
    // keep the hint visible at the edge when it is off the map
    const R = Math.min(v.w, v.h) / 2 - 10;
    const dx = sx - v.w / 2;
    const dy = sy - v.h / 2;
    const off = Math.hypot(dx, dy) > R + (hp.exact ? 0 : r);
    if (off) {
      const d = Math.hypot(dx, dy);
      sx = v.w / 2 + (dx / d) * R;
      sy = v.h / 2 + (dy / d) * R;
      g.fillStyle = CLAY;
      g.beginPath();
      g.arc(sx, sy, 5, 0, Math.PI * 2);
      g.fill();
    } else if (hp.exact) {
      g.fillStyle = CLAY;
      g.strokeStyle = '#fff8e8';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy - 12, 8, Math.PI * 0.85, Math.PI * 0.15);
      g.lineTo(sx, sy);
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      g.strokeStyle = CLAY;
      g.fillStyle = 'rgba(180,68,47,0.12)';
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    }
  }

  // player: view cone + arrow
  const pl = ov.player;
  const [px, py] = S(pl.x, pl.z);
  const fwd = Math.atan2(-Math.cos(pl.yaw), -Math.sin(pl.yaw)); // world forward angle in (x, z)
  const a = fwd + v.rot; // rotate into screen space
  const cone = g.createRadialGradient(px, py, 0, px, py, 46);
  cone.addColorStop(0, 'rgba(28,58,120,0.38)');
  cone.addColorStop(1, 'rgba(28,58,120,0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(px, py);
  g.arc(px, py, 46, a - 0.55, a + 0.55);
  g.closePath();
  g.fill();
  g.save();
  g.translate(px, py);
  g.rotate(a + Math.PI / 2);
  g.fillStyle = C.lm;
  g.strokeStyle = '#fff8e8';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(6.5, 7);
  g.lineTo(0, 3.5);
  g.lineTo(-6.5, 7);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // full map: a scale bar and a north arrow, bottom left
  if (v.labels) {
    const len = [50, 100, 200, 500, 1000, 2000].find((m) => m * k >= 70) ?? 2000;
    const x0 = 18;
    const y0 = v.h - 26 - 10;
    g.fillStyle = C.ink;
    g.strokeStyle = C.ink;
    g.lineWidth = 1.5;
    g.fillRect(x0, y0, (len * k) / 2, 5);
    g.strokeRect(x0, y0, len * k, 5);
    g.font = FONT(11, 700);
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText(len >= 1000 ? `${len / 1000} km` : `${len} m`, x0, y0 - 3);
    const nx = x0 + len * k + 26;
    g.beginPath();
    g.moveTo(nx, y0 - 16);
    g.lineTo(nx + 7, y0 + 6);
    g.lineTo(nx, y0 + 1);
    g.lineTo(nx - 7, y0 + 6);
    g.closePath();
    g.fill();
    g.textAlign = 'center';
    g.fillText('N', nx, y0 - 18);
  }
  g.restore();
}

function sizeCanvas(c: HTMLCanvasElement, w: number, hgt: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hgt * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
  }
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

/** The round, heading-up minimap in the corner. Tap opens the full map. */
export class MiniMap {
  readonly el: HTMLButtonElement;
  private canvas = h('canvas') as HTMLCanvasElement;
  private north = h('i', { class: 'n' }, 'N');
  private last = '';
  /** Metres from the centre to the rim. */
  radius = 110;

  constructor() {
    this.el = h('button', { class: 'g-minimap', title: 'Map (M)', 'aria-label': 'Open the map' }, this.canvas, this.north) as HTMLButtonElement;
  }

  draw(layer: YearLayer, ov: MapOverlay) {
    const size = this.el.clientWidth || 104;
    const p = ov.player;
    // redraw only when something visible changed (position to 0.5 m, yaw to ~1°)
    const key = `${layer.year}|${Math.round(p.x * 2)}|${Math.round(p.z * 2)}|${Math.round(p.yaw * 60)}|${ov.trail.length}|${ov.pins.length}|${ov.stamps.length}|${ov.hint ? `${Math.round(ov.hint.x)},${ov.hint.exact}` : ''}|${size}`;
    if (key === this.last) return;
    this.last = key;
    const g = sizeCanvas(this.canvas, size, size);
    drawMap(g, layer, ov, { cx: p.x, cz: p.z, ppm: size / 2 / this.radius, rot: p.yaw, w: size, h: size, labels: false });
    // N on the rim: world north (0, -1) rotated into screen space
    const r = size / 2 - 9;
    this.north.style.transform = `translate(${size / 2 + Math.sin(p.yaw) * r}px, ${size / 2 - Math.cos(p.yaw) * r}px) translate(-50%, -50%)`;
  }

  /** Forces the next draw (e.g. after fonts load). */
  invalidate() {
    this.last = '';
  }
}

/** The full-screen, north-up map: drag to pan, pinch or wheel to zoom. */
export class FullMap {
  readonly el: HTMLElement;
  private canvas = h('canvas') as HTMLCanvasElement;
  private title = h('div', { class: 'g-map-title' });
  private view = { cx: 0, cz: 0, ppm: 1.1 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch?: { d: number; ppm: number };
  private data?: { layer: YearLayer; ov: MapOverlay };
  private raf = 0;
  onClose?: () => void;

  constructor(parent: HTMLElement) {
    const close = h('button', { class: 'g-round close', 'aria-label': 'Close map' }, '×') as HTMLButtonElement;
    const center = h('button', { class: 'g-round', 'aria-label': 'Centre on me', title: 'Centre on me' }, '◎') as HTMLButtonElement;
    const zin = h('button', { class: 'g-round', 'aria-label': 'Zoom in' }, '+') as HTMLButtonElement;
    const zout = h('button', { class: 'g-round', 'aria-label': 'Zoom out' }, '−') as HTMLButtonElement;
    this.el = h('div', { class: 'g-map hidden', role: 'dialog', 'aria-label': 'Map' }, this.canvas, this.title, h('div', { class: 'g-map-tools' }, zin, zout, center, close));
    parent.append(this.el);
    close.onclick = () => this.onClose?.();
    center.onclick = () => {
      if (!this.data) return;
      this.view.cx = this.data.ov.player.x;
      this.view.cz = this.data.ov.player.z;
      this.redraw();
    };
    zin.onclick = () => this.zoom(1.5);
    zout.onclick = () => this.zoom(1 / 1.5);
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ppm: this.view.ppm };
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.view.cx -= (e.clientX - p.x) / this.view.ppm;
        this.view.cz -= (e.clientY - p.y) / this.view.ppm;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        this.view.ppm = clamp((this.pinch.ppm * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.d, 0.12, 6);
      }
      this.redraw();
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = undefined;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.exp(-e.deltaY * 0.0015));
    });
    window.addEventListener('resize', () => this.open && this.redraw());
  }

  get open() {
    return !this.el.classList.contains('hidden');
  }

  show(layer: YearLayer, ov: MapOverlay, place: string) {
    this.data = { layer, ov };
    this.view.cx = ov.player.x;
    this.view.cz = ov.player.z;
    this.title.replaceChildren(h('b', {}, `Tel Aviv · ${layer.year}`), h('small', {}, place));
    this.title.classList.toggle('survey', layer.style === 'survey');
    this.el.classList.remove('hidden');
    this.redraw();
  }

  hide() {
    this.el.classList.add('hidden');
    this.pointers.clear();
  }

  private zoom(f: number) {
    this.view.ppm = clamp(this.view.ppm * f, 0.12, 6);
    this.redraw();
  }

  private redraw() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      if (!this.data || !this.open) return;
      const w = this.el.clientWidth;
      const hh = this.el.clientHeight;
      this.view.cx = clamp(this.view.cx, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
      this.view.cz = clamp(this.view.cz, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
      const g = sizeCanvas(this.canvas, w, hh);
      drawMap(g, this.data.layer, this.data.ov, { ...this.view, rot: 0, w, h: hh, labels: true });
    });
  }
}
