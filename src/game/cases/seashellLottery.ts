import { NEVE_TZEDEK } from '../../data/geography';
import { LANDMARKS } from '../../data/landmarks';
import { frameAt, sideNormal, streetById } from '../../data/streets';
import type { CaseDef, Pose } from '../types';

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

/** Facing from (x, z) towards (tx, tz), in CameraRig yaw convention. */
function facing(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(-(tx - x), -(tz - z));
}

const roth = streetById('rothschild');
const site = (id: string) => LANDMARKS.find((l) => l.id === id)!;
const MONUMENT = site('founders-monument');
const PLOT43 = site('dizengoff-house');

// The lottery crowd stands on the dune where the boulevard will be. The exact spot is not
// documented; this placement is illustrative.
const C = frameAt(roth, 140);
const [nx, nz] = sideNormal(C, 'L');
// The photographer stands 30 m up the dune, facing the crowd; his camera is beside him.
const P = frameAt(roth, 170);
const PHOTO: Pose = { x: P.x + nx * 3, z: P.z + nz * 3, yaw: facing(P.x + nx * 3, P.z + nz * 3, C.x, C.z), pitch: -0.02 };
// direction from the crowd towards the photographer
const toP = (() => {
  const dx = PHOTO.x - C.x;
  const dz = PHOTO.z - C.z;
  const l = Math.hypot(dx, dz);
  return { x: dx / l, z: dz / l };
})();
const SHELLS = { x: C.x + toP.x * 4, z: C.z + toP.z * 4 };
const CAMERA = { x: PHOTO.x - nx * 2.4, z: PHOTO.z - nz * 2.4 };
/** Yaw of a prop whose local +z faces the photographer. */
const faceP = Math.atan2(toP.x, toP.z);

// The player starts in 2025 on the boulevard promenade, looking towards the fountain.
const S = frameAt(roth, 238);
const START: Pose = { x: S.x, z: S.z, yaw: facing(S.x, S.z, MONUMENT.x, MONUMENT.z), pitch: 0.02 };

export const SEASHELL_LOTTERY: CaseDef = {
  id: 'seashell-lottery',
  number: 2,
  title: { en: 'The Seashell Lottery', he: 'הגרלת הצדפים' },
  tagline: { en: 'An empty dune, sixty-six families and two baskets of shells.' },
  question: { en: 'How did the founders decide who got which plot?' },
  intro: {
    en: 'Rothschild Boulevard, 2025: a fountain, cafés, traffic. Under all of this was once a bare sand dune — and a lottery. Find out how the city began.',
  },
  start: { year: 2025, pose: START },
  years: [2025, 1909, 1910],
  leads: [
    {
      id: 'monument',
      title: { en: 'The fountain on the boulevard' },
      short: { en: 'Examine the monument on the boulevard' },
      examine: { en: 'the monument' },
      text: { en: 'A monument stands in the middle of the boulevard. Who is it for?' },
      requires: [],
      years: [1951, 2025],
      trigger: { kind: 'site', siteId: 'founders-monument', maxDist: 60 },
      clue: {
        title: { en: 'The Founders’ Monument' },
        gist: { en: 'It honours the 66 families who founded the city — on a sand dune, in 1909.' },
        text: {
          en: 'Put up after Israel’s independence, the monument and fountain honour the founders of Ahuzat Bayit, the garden suburb that became Tel Aviv. Its bronze relief begins with bare sand dunes being levelled. Their story starts in 1909.',
        },
        sources: [
          { label: 'Founders Monument – Israel Public Art', url: 'https://israelpublicart.com/collection/founders-monument/' },
          { label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') },
        ],
        confidence: 'approximate',
        anchors: 1909,
      },
      hints: [
        { en: 'Walk along the boulevard towards the fountain.' },
        { en: 'A stone monument in the middle of the boulevard. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: MONUMENT.x, z: MONUMENT.z, y: 3 },
      autoTravel: true,
    },
    {
      id: 'crowd',
      title: { en: 'People on the dune' },
      short: { en: '1909: who are all these people?' },
      examine: { en: 'the crowd' },
      text: { en: 'The boulevard is bare sand. People have gathered on the dune. Find out why.' },
      requires: ['monument'],
      years: [1909, 1909],
      trigger: { kind: 'poi', poiId: 'lottery-crowd' },
      clue: {
        title: { en: 'Sixty-six families' },
        gist: { en: 'They bought this dune together. Today they divide it into plots for their homes.' },
        text: {
          en: 'On 11 April 1909 the members of the Ahuzat Bayit society — families from crowded Jaffa — met on the dunes to the north. They had bought the land together; now each family would receive one plot to build a home on. But who would get which plot?',
        },
        sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
        confidence: 'documented',
      },
      hints: [
        { en: 'Look down the boulevard for a group of people.' },
        { en: 'On the dune, down the boulevard from where you arrived. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: C.x, z: C.z, y: 2 },
    },
    {
      id: 'soskin',
      title: { en: 'The photographer' },
      short: { en: 'Stand where the photographer stands' },
      text: { en: 'Someone is photographing the gathering. Find his spot, hold up his photograph and line it up.' },
      requires: ['crowd'],
      years: [1909, 1909],
      trigger: {
        kind: 'rephoto',
        photo: {
          id: 'soskin-1909',
          year: 1909,
          pose: PHOTO,
          title: { en: 'The lottery, 1909' },
          caption: { en: 'Ahuzat Bayit · 11 April 1909' },
          reference: { label: 'Ahuzat Bayit – Wikipedia (Soskin’s photograph)', url: W('Ahuzat_Bayit') },
          marks: [
            { x: C.x, y: 2.2, z: C.z },
            { x: SHELLS.x, y: 0.9, z: SHELLS.z },
            { x: C.x + nx * 4, y: 1.7, z: C.z + nz * 4 },
          ],
        },
      },
      clue: {
        title: { en: 'Avraham Soskin’s photograph' },
        gist: { en: 'His picture of this morning became the best-known image of Tel Aviv’s birth.' },
        text: {
          en: 'The photographer Avraham Soskin recorded the lottery. His photograph of people standing on bare sand is the image most often used to tell the story of the city’s founding. (Here it is reconstructed from the model.)',
        },
        sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
        confidence: 'documented',
      },
      hints: [
        { en: 'Look for a camera on a tripod.' },
        { en: 'Beside the camera, facing the crowd. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: PHOTO.x, z: PHOTO.z, y: 1.7 },
    },
    {
      id: 'shells',
      title: { en: 'Two baskets' },
      short: { en: 'Find out how the plots are shared out' },
      examine: { en: 'the shells' },
      text: { en: 'Something in front of the crowd will decide who gets which plot.' },
      requires: ['soskin'],
      years: [1909, 1909],
      trigger: { kind: 'poi', poiId: 'lottery-shells' },
      clue: {
        title: { en: 'The seashell lottery' },
        gist: { en: 'White shells carry the families’ names, grey shells the plot numbers. Every family has the same chance.' },
        text: {
          en: 'Akiva Aryeh Weiss, who led the society, gathered seashells on the beach. On white shells he wrote the families’ names, on grey shells the plot numbers. A child drew one shell from each basket, pairing a family with a plot — no money, no favours. One of the draws: Meir and Zina Dizengoff, plot 43.',
        },
        sources: [
          { label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') },
          { label: 'Akiva Aryeh Weiss – Wikipedia', url: W('Akiva_Aryeh_Weiss') },
        ],
        confidence: 'approximate',
        anchors: 1910,
        reveal: {
          prompt: { en: 'Draw one shell from each basket.' },
          look: 'shells',
          draws: [
            { label: { en: 'White shell · a family' }, value: { en: 'Meir & Zina Dizengoff' }, tone: 'light' },
            { label: { en: 'Grey shell · a plot' }, value: { en: 'Plot 43' }, tone: 'dark' },
          ],
        },
      },
      hints: [
        { en: 'Look in front of the crowd.' },
        { en: 'A small table between the crowd and the camera. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: SHELLS.x, z: SHELLS.z, y: 1.2 },
    },
    {
      id: 'plot43',
      title: { en: 'Plot 43' },
      short: { en: '1910: find the house on plot 43' },
      examine: { en: 'the house' },
      text: { en: 'A year later. What did the Dizengoffs build on plot 43?' },
      requires: ['shells'],
      years: [1910, 2025],
      trigger: { kind: 'site', siteId: 'dizengoff-house', maxDist: 60 },
      clue: {
        title: { en: 'The house on plot 43' },
        gist: { en: 'The Dizengoffs’ new home. One day it will be the most important room in Israel.' },
        text: {
          en: 'Meir Dizengoff became the first mayor of Tel Aviv. After his wife Zina died he gave the house to the city; it opened as the Tel Aviv Museum of Art in 1932, and on 14 May 1948 the State of Israel was declared in its hall.',
        },
        sources: [
          { label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') },
          { label: 'Meir Dizengoff – Wikipedia', url: W('Meir_Dizengoff') },
        ],
        confidence: 'documented',
      },
      hints: [
        { en: 'New houses line the boulevard. Look near where the crowd stood.' },
        { en: 'On the boulevard, a few steps from the lottery dune. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: PLOT43.x, z: PLOT43.z, y: 5 },
    },
  ],
  pois: [
    {
      id: 'lottery-crowd',
      label: { en: 'The lottery crowd' },
      x: C.x,
      z: C.z,
      y: 3.4,
      from: 1909,
      to: 1909,
      prop: { kind: 'crowd', rot: faceP },
    },
    {
      id: 'lottery-shells',
      label: { en: 'Two baskets of shells' },
      x: SHELLS.x,
      z: SHELLS.z,
      y: 1.8,
      from: 1909,
      to: 1909,
      prop: { kind: 'shells', rot: faceP },
    },
    {
      id: 'soskin-camera',
      label: { en: 'A plate camera on a tripod' },
      x: CAMERA.x,
      z: CAMERA.z,
      y: 2.2,
      from: 1909,
      to: 1909,
      prop: { kind: 'camera', rot: faceP + Math.PI },
    },
  ],
  deduction: {
    question: { en: 'How did the founders decide who got which plot?' },
    options: [
      {
        text: { en: 'The richest families bought the best plots at auction.' },
        feedback: { en: 'No — nothing was auctioned. Remember the two baskets.' },
      },
      {
        text: { en: 'They drew lots with seashells, so every family had the same chance.' },
        correct: true,
        feedback: { en: 'Exactly.' },
      },
      {
        text: { en: 'The Ottoman governor assigned the plots.' },
        feedback: { en: 'No — the founders organised it themselves, on the dune.' },
      },
    ],
  },
  resolution: {
    title: { en: 'Case closed: The Seashell Lottery' },
    text: {
      en: 'On 11 April 1909, 66 families drew lots for their plots with seashells on an empty dune. The day is remembered as the founding of Tel Aviv: a year later the new suburb took the name Tel Aviv, and within decades the dune had become a city.',
    },
    facts: [
      { en: 'Akiva Aryeh Weiss organised the lottery and gathered the shells on the beach.' },
      { en: 'Avraham Soskin’s photograph of the lottery is the best-known image of the founding.' },
      { en: 'Accounts differ on who drew the shells: one memoir names an eight-year-old boy, Moshe Fogel; others remember a boy and a girl.' },
    ],
    sources: [
      { label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') },
      { label: 'History of Tel Aviv – Wikipedia', url: W('History_of_Tel_Aviv') },
      { label: 'Akiva Aryeh Weiss – Wikipedia', url: W('Akiva_Aryeh_Weiss') },
    ],
  },
  notes: [
    {
      id: 'photographers-eye',
      title: { en: 'Photographer’s eye' },
      text: { en: 'You lined up Soskin’s photograph by eye alone, without any aids.' },
      trigger: { kind: 'eye' },
    },
    {
      id: 'the-shore',
      title: { en: 'Where the shells came from' },
      text: { en: 'You walked down to the beach in the early years. The lottery shells were gathered on this shore.' },
      trigger: { kind: 'coast', years: [1900, 1925] },
    },
    {
      id: 'water-tower',
      title: { en: 'Water for the suburb' },
      text: { en: 'You found the first water tower. Running water was one of the promises of the new garden suburb.' },
      trigger: { kind: 'site', siteId: 'water-tower' },
    },
    {
      id: 'neve-tzedek',
      title: { en: 'Out of the old town' },
      text: { en: 'You visited Neve Tzedek, one of the crowded neighbourhoods by Jaffa that the founders wanted to leave behind.' },
      trigger: { kind: 'area', x: NEVE_TZEDEK.x, z: NEVE_TZEDEK.z, r: NEVE_TZEDEK.r, years: [1900, 1914] },
    },
  ],
  teasers: [{ en: 'The House on Plot 43' }, { en: 'The White City' }, { en: 'Tents on the Boulevard' }],
};
