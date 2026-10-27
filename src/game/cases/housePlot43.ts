import { LANDMARKS } from '../../data/landmarks';
import type { CaseDef, Pose } from '../types';
import weissenstein1948 from '../../assets/archive/weissenstein-1948.jpg';

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

/** Facing from (x, z) towards (tx, tz), in CameraRig yaw convention. */
function facing(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(-(tx - x), -(tz - z));
}

const HOUSE = LANDMARKS.find((l) => l.id === 'dizengoff-house')!;
/** House-local coordinates (local +z faces Rothschild Blvd) → world. Matches siteRect's axes. */
const at = (lx: number, lz: number) => {
  const c = Math.cos(HOUSE.rot);
  const s = Math.sin(HOUSE.rot);
  return { x: HOUSE.x + lx * c + lz * s, z: HOUSE.z - lx * s + lz * c };
};
/** Yaw for looking along house-local +z (out of the door, towards the boulevard). */
const OUT = facing(at(0, 0).x, at(0, 0).z, at(0, 10).x, at(0, 10).z);
const IN = OUT + Math.PI;

// The museum hall fills the ground floor of the 1932 building (22 × 16 m).
const ROOM = { w: 20.6, d: 14.6 };
const tableZ = -ROOM.d / 2 + 2.2;
// Weissenstein's spot: in the centre aisle, facing the table under Herzl's portrait. Hall and
// spot are laid out so the model lines up with his photograph.
const shot = at(0, -ROOM.d / 2 + 8.2);
const PHOTO: Pose = { x: shot.x, z: shot.z, yaw: IN, pitch: 0 };
const portrait = at(0, -ROOM.d / 2 + 0.12);
const speaker = at(0, tableZ - 0.7);
const leftmost = at(-3.6, tableZ - 0.75);

const START_AT = at(0, 8 + 24);
const START: Pose = { x: START_AT.x, z: START_AT.z, yaw: IN, pitch: 0.08 };
const DOOR = at(0, 8 + 1.2);
const SIGN = at(4.5, 8 + 3);
const CROWD = at(0, 8 + 14);

export const HOUSE_PLOT_43: CaseDef = {
  id: 'house-plot-43',
  number: 3,
  title: { en: 'The House on Plot 43', he: 'הבית במגרש 43' },
  tagline: { en: 'A family home, an art museum, and the afternoon a state was born.' },
  question: { en: 'Why was the State of Israel declared in an art museum?' },
  intro: {
    en: '16 Rothschild Boulevard, 2025: Independence Hall. Israel was declared here in 1948 — in an art museum, in a house built for one family. How did it come to this room?',
  },
  start: { year: 2025, pose: START },
  years: [2025, 1910, 1936, 1948],
  leads: [
    {
      id: 'hall-today',
      title: { en: 'Independence Hall' },
      short: { en: 'Examine Independence Hall' },
      examine: { en: 'the building' },
      text: { en: 'A plain white building with a long story. Start with what it says about itself.' },
      requires: [],
      years: [1978, 2025],
      trigger: { kind: 'site', siteId: 'dizengoff-house', maxDist: 60 },
      clue: {
        title: { en: 'A house on plot 43' },
        gist: { en: 'Before it was a hall or a museum, this was a home, built in 1910.' },
        text: {
          en: 'Today the building is Independence Hall. But its story starts with the seashell lottery: the Dizengoffs drew plot 43 and built their house here in 1910.',
        },
        sources: [{ label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') }],
        confidence: 'documented',
        anchors: 1910,
      },
      hints: [
        { en: 'The white building on the boulevard in front of you.' },
        { en: '16 Rothschild Blvd. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: HOUSE.x, z: HOUSE.z, y: 5 },
      autoTravel: true,
    },
    {
      id: 'home',
      title: { en: 'The Dizengoffs’ home' },
      short: { en: '1910: who lives here?' },
      examine: { en: 'the house' },
      text: { en: 'A new two-storey house on a sandy boulevard. Who lives here, and what will become of it?' },
      requires: ['hall-today'],
      years: [1910, 1931],
      trigger: { kind: 'site', siteId: 'dizengoff-house', maxDist: 60 },
      clue: {
        title: { en: 'Meir and Zina Dizengoff' },
        gist: { en: 'He will be the first mayor of Tel Aviv. One day he will give this house to the city — for art.' },
        text: {
          en: 'Meir Dizengoff led Tel Aviv for most of its first decades. After Zina died in 1930, he gave the house to the city to become a museum of art. It opened as the Tel Aviv Museum of Art in 1932 and was rebuilt and enlarged in the new style within a few years.',
        },
        sources: [
          { label: 'Meir Dizengoff – Wikipedia', url: W('Meir_Dizengoff') },
          { label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') },
        ],
        confidence: 'documented',
        anchors: 1936,
      },
      hints: [
        { en: 'The house you were just looking at, a century younger.' },
        { en: 'On the boulevard, plot 43. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: HOUSE.x, z: HOUSE.z, y: 4 },
    },
    {
      id: 'museum',
      title: { en: 'The museum' },
      short: { en: '1936: what is this building now?' },
      examine: { en: 'the sign' },
      text: { en: 'The house has changed. Read what it says at the gate.' },
      requires: ['home'],
      years: [1932, 1947],
      trigger: { kind: 'poi', poiId: 'museum-sign' },
      clue: {
        title: { en: 'The Tel Aviv Museum of Art' },
        gist: { en: 'Paintings fill the hall. In 1948 it will hold something far bigger.' },
        text: {
          en: 'The young city’s art museum fills the old house: a white, modern building with a large hall on the ground floor. Twelve years from now, that hall will be chosen for the most important ceremony in the country’s history.',
        },
        sources: [{ label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') }],
        confidence: 'documented',
        anchors: 1948,
      },
      hints: [
        { en: 'Look at the front of the building.' },
        { en: 'A sign by the gate. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: SIGN.x, z: SIGN.z, y: 1.6 },
    },
    {
      id: 'invitation',
      title: { en: 'Friday, 14 May 1948' },
      short: { en: '1948: why is everyone waiting here?' },
      examine: { en: 'the door' },
      text: { en: 'People wait on the boulevard. Something is happening inside the museum this afternoon.' },
      requires: ['museum'],
      years: [1948, 1948],
      trigger: { kind: 'poi', poiId: 'museum-door' },
      enter: 'museum-hall',
      clue: {
        title: { en: 'A secret invitation' },
        gist: { en: 'About 250 guests were invited at the last minute and asked to keep it secret.' },
        text: {
          en: 'The British Mandate would end at midnight. Jerusalem was under siege, so the ceremony was held in Tel Aviv, in the museum hall, a place that could be kept quiet: the leaders feared the British might stop it or that the city might be bombed. Invitations went out only that morning.',
        },
        sources: [
          { label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') },
          { label: 'Jewish Virtual Library – Independence Hall', url: 'https://www.jewishvirtuallibrary.org/independence-hall' },
        ],
        confidence: 'approximate',
        reveal: {
          prompt: { en: 'Open the envelope.' },
          look: 'cards',
          draws: [
            { label: { en: 'The invitation' }, value: { en: 'Friday 14 May 1948 · 4 pm · Tel Aviv Museum' }, tone: 'light' },
            { label: { en: 'In small print' }, value: { en: 'Please keep this secret' }, tone: 'light' },
          ],
        },
      },
      hints: [
        { en: 'Go to the museum’s front door.' },
        { en: 'The door of 16 Rothschild. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: DOOR.x, z: DOOR.z, y: 1.8 },
    },
    {
      id: 'declaration',
      title: { en: 'Four o’clock' },
      short: { en: 'Stand where the photographer stood' },
      text: { en: 'Inside, the hall is full. One photographer is here. Find his spot, hold up his photograph and line it up.' },
      requires: ['invitation'],
      years: [1948, 1948],
      trigger: {
        kind: 'rephoto',
        photo: {
          id: 'weissenstein-1948',
          year: 1948,
          pose: PHOTO,
          title: { en: 'The declaration, 1948' },
          caption: { en: 'Tel Aviv Museum · 14 May 1948' },
          reference: { label: 'The photograph – Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Declaration_of_State_of_Israel_1948.jpg' },
          // Herzl's portrait, Ben-Gurion's head, the first man at the left end of the table
          marks: [
            { x: portrait.x, y: 4.1, z: portrait.z },
            { x: speaker.x, y: 1.6, z: speaker.z },
            { x: leftmost.x, y: 1.2, z: leftmost.z },
          ],
          archive: {
            src: weissenstein1948,
            marks: [[0.441, 0.17], [0.48, 0.515], [0.055, 0.604]],
            credit: { en: 'The declaration, 14 May 1948. Photograph by Rudi Weissenstein; public domain (National Photo Collection of Israel).' },
          },
        },
      },
      clue: {
        title: { en: 'Israel is declared' },
        gist: { en: 'Under Herzl’s portrait, David Ben-Gurion reads the Declaration of Independence.' },
        text: {
          en: 'At four in the afternoon David Ben-Gurion read the Declaration of Independence, and the State of Israel was born. The ceremony was broadcast on the radio and ended with Hatikvah. Rudi Weissenstein’s photograph — the one you just held up — is the best-known image of the moment.',
        },
        sources: [
          { label: 'Israeli Declaration of Independence – Wikipedia', url: W('Israeli_Declaration_of_Independence') },
          { label: 'Rudi Weissenstein – Wikipedia', url: W('Rudi_Weissenstein') },
        ],
        confidence: 'documented',
      },
      hints: [
        { en: 'Walk up the aisle towards the table.' },
        { en: 'In the centre aisle, facing the portrait. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: PHOTO.x, z: PHOTO.z, y: 1.7 },
    },
  ],
  pois: [
    {
      id: 'museum-sign',
      label: { en: 'The museum sign' },
      x: SIGN.x,
      z: SIGN.z,
      y: 2.6,
      from: 1932,
      to: 1947,
      prop: { kind: 'sign', rot: HOUSE.rot },
    },
    {
      id: 'museum-door',
      label: { en: 'The museum door' },
      x: DOOR.x,
      z: DOOR.z,
      y: 1.8,
      from: 1948,
      to: 1948,
    },
    {
      id: 'waiting-crowd',
      label: { en: 'People waiting on the boulevard' },
      x: CROWD.x,
      z: CROWD.z,
      y: 3,
      from: 1948,
      to: 1948,
      prop: { kind: 'crowd48', rot: HOUSE.rot + Math.PI },
    },
    {
      id: 'museum-hall',
      label: { en: 'The museum hall' },
      x: HOUSE.x,
      z: HOUSE.z,
      y: 3,
      from: 1948,
      to: 1948,
      prop: { kind: 'hall', rot: HOUSE.rot },
      room: ROOM,
    },
  ],
  deduction: {
    question: { en: 'Why was Israel declared in a Tel Aviv art museum?' },
    options: [
      {
        text: { en: 'It was the parliament building at the time.' },
        feedback: { en: 'No — it was an art museum, with paintings on its walls.' },
      },
      {
        text: { en: 'Jerusalem was under siege, and a museum hall in Tel Aviv could be kept secret.' },
        correct: true,
        feedback: { en: 'Exactly.' },
      },
      {
        text: { en: 'The Dizengoff family still lived there and invited everyone.' },
        feedback: { en: 'No — Dizengoff had given the house to the city long before.' },
      },
    ],
  },
  resolution: {
    title: { en: 'Case closed: The House on Plot 43' },
    text: {
      en: 'A shell drawn on a dune in 1909 became a family home, then the city’s art museum, and on 14 May 1948 the hall where the State of Israel was declared. Today the building is Independence Hall.',
    },
    facts: [
      { en: 'Jerusalem was cut off by the war, so the ceremony took place in Tel Aviv.' },
      { en: 'The museum stayed in the building until 1971; the hall was restored and opened as Independence Hall in 1978.' },
      { en: 'Why exactly this building was picked is told mostly in guides and memoirs: secrecy is the reason most often given.' },
    ],
    sources: [
      { label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') },
      { label: 'Israeli Declaration of Independence – Wikipedia', url: W('Israeli_Declaration_of_Independence') },
      { label: 'Jewish Virtual Library – Independence Hall', url: 'https://www.jewishvirtuallibrary.org/independence-hall' },
    ],
  },
  notes: [
    {
      id: 'photographers-eye',
      title: { en: 'Photographer’s eye' },
      text: { en: 'You lined up Weissenstein’s photograph by eye alone, without any aids.' },
      trigger: { kind: 'eye' },
    },
    {
      id: 'two-houses',
      title: { en: 'Two houses in one' },
      text: { en: 'You peeked from the museum back into 1910 and saw the Dizengoffs’ home inside its walls.' },
      trigger: { kind: 'peek', x: HOUSE.x, z: HOUSE.z, r: 45, from: [1932, 2025], to: [1910, 1931] },
    },
    {
      id: 'outside',
      title: { en: 'Waiting outside' },
      text: { en: 'You stood with the crowd on the boulevard on the afternoon of 14 May 1948.' },
      trigger: { kind: 'area', x: CROWD.x, z: CROWD.z, r: 10, years: [1948, 1948] },
    },
  ],
  teasers: [{ en: 'The White City' }, { en: 'Tents on the Boulevard' }, { en: 'The Lost Water Tower' }],
};
