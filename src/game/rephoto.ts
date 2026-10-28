import type { Pose } from './types';

/** Wrap an angle to [-π, π]. */
export function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export interface Alignment {
  /** 0 … 1, how close the view is to the photo (for the meter). */
  score: number;
  dist: number;
  /** Degrees. */
  yawErr: number;
  pitchErr: number;
  /** Metres between the eye heights. */
  heightErr: number;
  matched: boolean;
  /** Roughly right (the photo's corner brackets show): within NEAR tolerances. */
  near: boolean;
}

/** Tolerances for a successful rephotograph. */
export const MATCH = { dist: 6, yaw: 9, pitch: 9, height: 3 };
/** Tolerances for "nearly there": coarse feedback, so the player still has to look. */
export const NEAR = { dist: 14, yaw: 20, pitch: 18, height: 8 };
/** Eye height when a pose doesn't say. */
const STANDING = 1.7;

/** How well the current view lines up with where a photo was taken. */
export function alignment(photo: Pose, view: Pose): Alignment {
  const dist = Math.hypot(view.x - photo.x, view.z - photo.z);
  const yawErr = Math.abs(wrapAngle(view.yaw - photo.yaw)) * (180 / Math.PI);
  const pitchErr = Math.abs(view.pitch - photo.pitch) * (180 / Math.PI);
  const heightErr = Math.abs((view.height ?? STANDING) - (photo.height ?? STANDING));
  const f = (v: number, range: number) => Math.max(0, 1 - v / range);
  const score = f(dist, 60) ** 1.4 * f(yawErr, 60) * f(pitchErr, 45) * f(heightErr, 40);
  return {
    score,
    dist,
    yawErr,
    pitchErr,
    heightErr,
    matched: dist <= MATCH.dist && yawErr <= MATCH.yaw && pitchErr <= MATCH.pitch && heightErr <= MATCH.height,
    near: dist <= NEAR.dist && yawErr <= NEAR.yaw && pitchErr <= NEAR.pitch && heightErr <= NEAR.height,
  };
}

/** A rectangle in the reference view: 0 … 1 across its width and height, may run past them. */
export interface Frame {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Where a whole real photograph sits in the game's reference view of the same scene.
 *
 * `inPhoto` are the match points in the photo (0 … 1) and `inView` the same points as the
 * reference camera sees them (0 … 1 of a view of aspect `ratio`). Solves, by least squares,
 * for the unrotated scale and offset that carry one onto the other, then returns the print's
 * edges in view coordinates. The game shows exactly that part of the world inside the print.
 */
export function printFrame(inPhoto: [number, number][], inView: { u: number; v: number }[], width: number, height: number, ratio: number): Frame {
  // photo pixel = offset + size * view position, with size = (w, w / ratio)
  // normal equations for the unknowns (x, y, w)
  let n = 0, su = 0, sv = 0, sa = 0, sb = 0, suu = 0, svv = 0, sua = 0, svb = 0;
  inView.forEach((p, i) => {
    const a = inPhoto[i][0] * width;
    const b = inPhoto[i][1] * height;
    const v = p.v / ratio;
    n++;
    su += p.u;
    sv += v;
    sa += a;
    sb += b;
    suu += p.u * p.u;
    svv += v * v;
    sua += p.u * a;
    svb += v * b;
  });
  // eliminate x and y: x = (sa - w su) / n, y = (sb - w sv) / n
  const den = suu - (su * su) / n + svv - (sv * sv) / n;
  const fill = Math.min(width, height * ratio);
  let w = den > 1e-9 ? (sua - (su * sa) / n + svb - (sv * sb) / n) / den : fill;
  // a bad fit should not turn the print into a keyhole or the view into a fisheye
  w = Math.min(Math.max(w, fill * 0.4), fill * 2.5);
  const h = w / ratio;
  const x = (sa - w * su) / n;
  const y = (sb - w * sv) / n;
  return { u0: -x / w, v0: -y / h, u1: (width - x) / w, v1: (height - y) / h };
}

/** The largest rectangle of aspect `ratio` that fits, centred, in a `width` × `height` screen. */
export function containRect(width: number, height: number, ratio: number) {
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

/**
 * How strongly to show each pixel of a held print (0 … 1). The subjects (people, faces,
 * windows: busy detail) stay strong and the empty sky, sand and walls fade, so the world
 * shows through where there is nothing to line up. `lum` is the print's luminance, row by row.
 */
export function subjectAlpha(lum: Float32Array, width: number, height: number, lo = 0.1, hi = 0.7): Float32Array {
  // detail: edge strength (Sobel), spread over about 4% of the print's height
  let a = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = lum[i - width + 1] + 2 * lum[i + 1] + lum[i + width + 1] - lum[i - width - 1] - 2 * lum[i - 1] - lum[i + width - 1];
      const gy = lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1] - lum[i - width - 1] - 2 * lum[i - width] - lum[i - width + 1];
      a[i] = Math.hypot(gx, gy);
    }
  const r = Math.max(1, Math.round(height * 0.04));
  for (let pass = 0; pass < 2; pass++) a = boxBlur(a, width, height, r);
  // scale by the busiest parts of this print, so a soft photo is treated like a sharp one
  const sorted = Float32Array.from(a).sort();
  const top = sorted[Math.floor(sorted.length * 0.92)] || 1;
  for (let i = 0; i < a.length; i++) {
    const t = Math.min(1, Math.max(0, (a[i] / top - 0.15) / 0.7));
    a[i] = lo + (hi - lo) * t * t * (3 - 2 * t);
  }
  return a;
}

/** A box blur of radius `r`, horizontal then vertical, by running sums. */
function boxBlur(src: Float32Array, width: number, height: number, r: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, n: number, lines: number, step: number, stride: number) => {
    for (let l = 0; l < lines; l++) {
      const base = l * stride;
      let sum = 0;
      let count = 0;
      for (let k = 0; k < Math.min(r, n); k++) {
        sum += from[base + k * step];
        count++;
      }
      for (let k = 0; k < n; k++) {
        if (k + r < n) {
          sum += from[base + (k + r) * step];
          count++;
        }
        if (k - r - 1 >= 0) {
          sum -= from[base + (k - r - 1) * step];
          count--;
        }
        to[base + k * step] = sum / count;
      }
    }
  };
  pass(src, tmp, width, height, 1, width);
  pass(tmp, out, height, width, width, 1);
  return out;
}
