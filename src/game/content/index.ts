import { frameAt, streetById } from '../../data/streets';
import type { Pose } from '../types';
import { facing } from './photos';

export { COLLECTIONS, SECTIONS } from './collections';
export { DISCOVERIES } from './discoveries';
export { HERZL_PHOTO, SOSKIN_PHOTO } from './photos';
export { POIS } from './pois';

/**
 * The year tickets, all open from the start: the founding, the eclectic 1920s, the White City,
 * the austerity years, the grey decades, the 2011 protests and today.
 */
export const YEARS = [1909, 1922, 1936, 1960, 1985, 2011, 2025];

// The player starts today on Rothschild Boulevard's promenade, looking up the boulevard between
// International Style buildings.
const s = frameAt(streetById('rothschild'), 300);
export const START: { year: number; pose: Pose } = {
  year: 2025,
  pose: { x: s.x, z: s.z, yaw: facing(s.x, s.z, s.x + s.dx, s.z + s.dz), pitch: 0.04 },
};
