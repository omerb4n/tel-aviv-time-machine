import type { Poi } from '../types';
import { LOTTERY } from './photos';

/** Props that stand in the world in their years. */
export const POIS: Poi[] = [
  { id: 'lottery-crowd', label: { en: 'The lottery crowd' }, ...LOTTERY.crowd, y: 3.4, from: 1909, to: 1909, prop: { kind: 'crowd', rot: LOTTERY.faceP } },
  { id: 'lottery-shells', label: { en: 'Two baskets of shells' }, x: LOTTERY.shells.x, z: LOTTERY.shells.z, y: 1.8, from: 1909, to: 1909, prop: { kind: 'shells', rot: LOTTERY.faceP } },
  { id: 'soskin-camera', label: { en: 'A plate camera on a tripod' }, ...LOTTERY.camera, y: 2.2, from: 1909, to: 1909, prop: { kind: 'camera', rot: LOTTERY.faceP + Math.PI } },
  // at the foot of the Shalom Meir Tower
  { id: 'gutman-mosaic', label: { en: 'Mosaic wall' }, x: -2, z: -150, y: 2.2, from: 1966, prop: { kind: 'mosaic', rot: 0.087 } },
  { id: 'site-hoarding', label: { en: 'Site fence' }, x: -6, z: -158, y: 2.4, from: 1962, to: 1964, prop: { kind: 'hoarding', rot: 0.087 } },
];
