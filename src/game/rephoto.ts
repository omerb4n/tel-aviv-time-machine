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
  matched: boolean;
  /** Roughly right (the photo's corner brackets show): within NEAR tolerances. */
  near: boolean;
}

/** Tolerances for a successful rephotograph. */
export const MATCH = { dist: 6, yaw: 9, pitch: 9 };
/** Tolerances for "nearly there": coarse feedback, so the player still has to look. */
export const NEAR = { dist: 14, yaw: 20, pitch: 18 };

/** How well the current view lines up with where a photo was taken. */
export function alignment(photo: Pose, view: Pose): Alignment {
  const dist = Math.hypot(view.x - photo.x, view.z - photo.z);
  const yawErr = Math.abs(wrapAngle(view.yaw - photo.yaw)) * (180 / Math.PI);
  const pitchErr = Math.abs(view.pitch - photo.pitch) * (180 / Math.PI);
  const f = (v: number, range: number) => Math.max(0, 1 - v / range);
  const score = f(dist, 60) ** 1.4 * f(yawErr, 60) * f(pitchErr, 45);
  return { score, dist, yawErr, pitchErr, matched: dist <= MATCH.dist && yawErr <= MATCH.yaw && pitchErr <= MATCH.pitch,
    near: dist <= NEAR.dist && yawErr <= NEAR.yaw && pitchErr <= NEAR.pitch,
  };
}

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of a real photograph that best overlays the game's view of the same scene.
 *
 * `inPhoto` are the match points in the photo and `inView` the same points as the game's
 * camera sees them (both 0 … 1). Solves, by least squares, for an unrotated crop of aspect
 * `ratio` that carries one onto the other, then keeps it inside the photo, so a photo taken
 * from a little further away or a little to one side still overlays as well as it can.
 */
export function fitCrop(inPhoto: [number, number][], inView: { u: number; v: number }[], width: number, height: number, ratio: number): Crop {
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
  // never zoom in so far that the print turns to mush, never past the photo's edges
  w = Math.min(Math.max(w, fill * 0.5), fill);
  const h = w / ratio;
  const x = Math.min(Math.max((sa - w * su) / n, 0), width - w);
  const y = Math.min(Math.max((sb - w * sv) / n, 0), height - h);
  return { x, y, w, h };
}
