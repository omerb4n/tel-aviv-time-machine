import herzl1913 from '../../assets/archive/herzl-1913.jpg';
import soskin1909 from '../../assets/archive/soskin-1909.jpg';
import { LANDMARKS } from '../../data/landmarks';
import { frameAt, sideNormal, streetById } from '../../data/streets';
import type { PhotoDef, Pose } from '../types';

const COMMONS = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;

/** Facing from (x, z) towards (tx, tz), in CameraRig yaw convention. */
export function facing(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(-(tx - x), -(tz - z));
}

// ---------------------------------------------------------------- Herzl Street, 1913

// The Gymnasium in its own axes (local +z faces down Herzl Street) → world. Matches siteRect.
const GYM = LANDMARKS.find((l) => l.id === 'herzliya-gymnasium')!;
const gym = (lx: number, y: number, lz: number) => {
  const c = Math.cos(GYM.rot);
  const s = Math.sin(GYM.rot);
  return { x: GYM.x + lx * c + lz * s, y, z: GYM.z - lx * s + lz * c };
};

// Where the photographer stood: on a rooftop over Herzl St north of Rothschild Blvd, about 9 m up,
// looking up the street with the school right of centre and looking down a little, as in the 1913
// photograph. (The Gymnasium's towers, 17.6 m, span a quarter of the print above its base, which
// puts the camera at roughly 8–10 m.)
const shot = frameAt(streetById('herzl'), 550);

export const HERZL_PHOTO: PhotoDef = {
  id: 'herzl-1910',
  year: 1910,
  pose: { x: shot.x, z: shot.z, yaw: facing(shot.x, shot.z, GYM.x, GYM.z) + 0.22, pitch: -0.1, height: 9 },
  title: { en: 'Herzl Street, 1913' },
  caption: { en: 'Tel-Aviv · Herzl Street' },
  reference: { label: 'The photograph – Wikimedia Commons', url: COMMONS('THE_HERZL_"GYMNASIA"_(SECONDARY_SCHOOL)_AT_THE_ENDOF_HERZL_STRREET_IN_TEL_AVIV._רחוב_הרצל_בתל_אביב..jpg') },
  // the tops of the two towers and the arch
  marks: [gym(-7, 17.6, 8.2), gym(7, 17.6, 8.2), gym(0, 9, 10.1)],
  archive: {
    src: herzl1913,
    marks: [[0.694, 0.203], [0.781, 0.197], [0.737, 0.374]],
    credit: { en: 'Herzl Street, 1913. Photographer unknown. National Photo Collection of Israel; public domain.' },
  },
};

// ---------------------------------------------------------------- the lottery, 1909

// The lottery crowd stands on the dune where the boulevard will be. The exact spot is not
// documented; this placement is illustrative.
const roth = streetById('rothschild');
const C = frameAt(roth, 140);
const [nx, nz] = sideNormal(C, 'L');
// The photographer stands a few steps up the dune, close to the crowd and looking down on it
// a little, as in Soskin's photograph; his camera is beside him.
const P = frameAt(roth, 150);
const PHOTO: Pose = { x: P.x + nx * 3, z: P.z + nz * 3, yaw: facing(P.x + nx * 3, P.z + nz * 3, C.x, C.z), pitch: -0.075 };
// direction from the crowd towards the photographer
const toP = (() => {
  const dx = PHOTO.x - C.x;
  const dz = PHOTO.z - C.z;
  const l = Math.hypot(dx, dz);
  return { x: dx / l, z: dz / l };
})();
/** The crowd's own axes (local +z towards the photographer, +x to his right) → world. */
const crowd = (lx: number, y: number, lz: number) => ({ x: C.x + lx * toP.z + lz * toP.x, y, z: C.z - lx * toP.x + lz * toP.z });

export const LOTTERY = {
  crowd: { x: C.x, z: C.z },
  // the table with the shells stands in front of the crowd, to the photographer's right
  shells: crowd(4.5, 0, 2.5),
  camera: { x: PHOTO.x - nx * 2.4, z: PHOTO.z - nz * 2.4 },
  /** Yaw of a prop whose local +z faces the photographer. */
  faceP: Math.atan2(toP.x, toP.z),
};

export const SOSKIN_PHOTO: PhotoDef = {
  id: 'soskin-1909',
  year: 1909,
  pose: PHOTO,
  title: { en: 'The lottery, 1909' },
  caption: { en: 'Ahuzat Bayit · 11 April 1909' },
  reference: { label: 'The photograph – Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:TelAviv-Founding.jpg' },
  // the middle of the crowd and its two ends
  marks: [crowd(0, 1, -1), crowd(-6.2, 1, -0.8), crowd(6.2, 1, -0.8)],
  archive: {
    src: soskin1909,
    marks: [[0.48, 0.52], [0.02, 0.536], [0.98, 0.49]],
    credit: { en: 'The lottery, 11 April 1909. Photograph by Avraham Soskin; public domain.' },
  },
};
