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
}

/** Tolerances for a successful rephotograph. */
export const MATCH = { dist: 6, yaw: 9, pitch: 9 };

/** How well the current view lines up with where a photo was taken. */
export function alignment(photo: Pose, view: Pose): Alignment {
  const dist = Math.hypot(view.x - photo.x, view.z - photo.z);
  const yawErr = Math.abs(wrapAngle(view.yaw - photo.yaw)) * (180 / Math.PI);
  const pitchErr = Math.abs(view.pitch - photo.pitch) * (180 / Math.PI);
  const f = (v: number, range: number) => Math.max(0, 1 - v / range);
  const score = f(dist, 60) ** 1.4 * f(yawErr, 60) * f(pitchErr, 45);
  return { score, dist, yawErr, pitchErr, matched: dist <= MATCH.dist && yawErr <= MATCH.yaw && pitchErr <= MATCH.pitch };
}
