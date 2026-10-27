import { frameAt, sideNormal, streetById } from '../../data/streets';
import type { CaseDef, Pose } from '../types';

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

/** Facing from (x, z) towards (tx, tz), in CameraRig yaw convention. */
function facing(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(-(tx - x), -(tz - z));
}

// The Gymnasium / Shalom Meir Tower site at the head of Herzl Street.
const SITE = { x: -14, z: -176 };

// Where the postcard photographer stood: in the middle of Herzl St, just north of Rothschild Blvd.
const herzl = streetById('herzl');
const shot = frameAt(herzl, 520);
const POSTCARD: Pose = { x: shot.x, z: shot.z, yaw: facing(shot.x, shot.z, SITE.x, SITE.z), pitch: 0.03 };

// Match points for the photo aid: the school's entrance at the end of the street and both kerbs ahead.
const kerb = (s: number, side: 'L' | 'R') => {
  const f = frameAt(herzl, s);
  const [nx, nz] = sideNormal(f, side);
  return { x: f.x + nx * (herzl.width / 2), y: 0, z: f.z + nz * (herzl.width / 2) };
};
const MARKS = [{ x: SITE.x, y: 8, z: SITE.z + 12 }, kerb(575, 'L'), kerb(585, 'R')];

// The player starts further down Herzl, south of the boulevard, glancing up the street.
const startF = frameAt(herzl, 420);
const START: Pose = { x: startF.x + 3, z: startF.z, yaw: facing(startF.x + 3, startF.z, 60, -200), pitch: 0.05 };

export const VANISHING_SCHOOL: CaseDef = {
  id: 'vanishing-school',
  number: 1,
  title: { en: 'The Vanishing School', he: 'בית הספר שנעלם' },
  tagline: { en: 'A postcard, a tower, and a building that is no longer there.' },
  question: { en: 'What happened to the building on the postcard?' },
  intro: {
    en: 'An old postcard of the street you stand on — but at its end is a building that isn’t there today. Where was it taken?',
  },
  start: { year: 2025, pose: START },
  years: [2025, 1910, 1962, 1965],
  leads: [
    {
      id: 'postcard',
      title: { en: 'The postcard' },
      short: { en: 'Find where the postcard was taken' },
      text: { en: 'Somewhere on this street, someone took this photo over a century ago. Find their spot, hold up the postcard and line it up by eye.' },
      requires: [],
      trigger: {
        kind: 'rephoto',
        photo: {
          id: 'herzl-1910',
          year: 1910,
          pose: POSTCARD,
          title: { en: 'Herzl Street, c. 1910' },
          caption: { en: 'Tel-Aviv · Herzl Street' },
          reference: { label: 'Herzliya Hebrew Gymnasium – photos on Wikipedia', url: W('Herzliya_Hebrew_Gymnasium') },
          marks: MARKS,
        },
      },
      clue: {
        title: { en: 'Herzl Street, 1910' },
        gist: { en: 'You stepped into the postcard: Herzl Street was built to lead to one grand building.' },
        text: {
          en: 'The postcard comes alive. A year after the seashell lottery, Herzl Street is a sandy track between new garden houses — and it was laid out to lead straight to one building: a school with a temple-like façade.',
        },
        sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
        confidence: 'documented',
        anchors: 1910,
      },
      hints: [
        { en: 'The photo looks up a long street to a grand building.' },
        { en: 'Herzl St, just past the boulevard. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: POSTCARD.x, z: POSTCARD.z, y: 1.7 },
      autoTravel: true,
    },
    {
      id: 'gymnasium',
      title: { en: 'The building at the end of the street' },
      short: { en: 'Examine the building at the end of the street' },
      examine: { en: 'the school' },
      text: { en: 'Walk up Herzl Street to the grand building at its end and take a close look.' },
      requires: ['postcard'],
      years: [1910, 1961],
      trigger: { kind: 'site', siteId: 'herzliya-gymnasium', maxDist: 95 },
      clue: {
        title: { en: 'The Herzliya Hebrew Gymnasium' },
        gist: { en: 'The first Hebrew high school in the world — yet in 2025 a tower stands here.' },
        text: {
          en: 'The first Hebrew high school in the world moved into this building in 1910. Joseph Barsky modelled its façade on reconstructions of Solomon’s Temple, and the new town was planned around it. Yet in 2025 there is a tower on this spot. What happened to it?',
        },
        sources: [
          { label: 'Herzliya Hebrew Gymnasium – Wikipedia', url: W('Herzliya_Hebrew_Gymnasium') },
          { label: 'Joseph Barsky – Wikipedia', url: W('Joseph_Barsky') },
        ],
        confidence: 'documented',
      },
      hints: [
        { en: 'Follow Herzl Street to its end.' },
        { en: 'The building with twin towers. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: SITE.x - 7, z: SITE.z + 10, y: 5 },
    },
    {
      id: 'mosaic',
      title: { en: 'A trace in the present' },
      short: { en: 'Back in 2025: is anything left of the school?' },
      examine: { en: 'the mosaic' },
      text: { en: 'Travel back to 2025. Is anything left of the school at the foot of the tower? Things worth examining glimmer when you are near.' },
      requires: ['gymnasium'],
      years: [1966, 2025],
      trigger: { kind: 'poi', poiId: 'gutman-mosaic' },
      clue: {
        title: { en: 'Nachum Gutman’s mosaic' },
        gist: { en: 'A mosaic remembers the school — and dates its end: 1962.' },
        text: {
          en: 'A long mosaic wall by the painter Nachum Gutman (1966) tells the story of Tel Aviv: old Jaffa, the founding of Ahuzat Bayit, and the young city — with the Gymnasium among its buildings. The school was razed in 1962, and the tower rose in its place.',
        },
        sources: [
          { label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') },
          { label: 'Nachum Gutman – Wikipedia', url: W('Nachum_Gutman') },
        ],
        confidence: 'approximate',
        anchors: 1962,
      },
      hints: [
        { en: 'Back to 2025, then to the foot of the tower.' },
        { en: 'A colourful wall facing Herzl St. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: -2, z: -150, y: 2 },
    },
    {
      id: 'hoarding',
      title: { en: 'The empty lot' },
      short: { en: '1962: what became of the site?' },
      examine: { en: 'the fence' },
      text: { en: 'Travel to 1962 and walk to where the school stood.' },
      requires: ['mosaic'],
      years: [1962, 1964],
      trigger: { kind: 'poi', poiId: 'site-hoarding' },
      clue: {
        title: { en: 'A building site' },
        gist: { en: 'The school moved away. A tower is coming — finished in 1965.' },
        text: {
          en: 'The Gymnasium is gone. Behind a site fence a new building is planned: an office tower, the tallest in the Middle East, finished in 1965. The school itself was not destroyed — it moved to a new campus.',
        },
        sources: [
          { label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') },
          { label: 'Herzliya Hebrew Gymnasium – Wikipedia', url: W('Herzliya_Hebrew_Gymnasium') },
        ],
        confidence: 'approximate',
        anchors: 1965,
      },
      hints: [
        { en: 'Travel to 1962. Go where the school stood.' },
        { en: 'A fence with a poster. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: -6, z: -158, y: 2 },
    },
    {
      id: 'tower',
      title: { en: 'What replaced it' },
      short: { en: '1965: examine what replaced the school' },
      examine: { en: 'the tower' },
      text: { en: 'Travel to 1965 and examine what stands on the site now.' },
      requires: ['hoarding'],
      years: [1965, 2025],
      trigger: { kind: 'site', siteId: 'shalom-meir-tower', maxDist: 140 },
      clue: {
        title: { en: 'The Shalom Meir Tower' },
        gist: { en: 'The tallest building in the Middle East rose where the school had stood.' },
        text: {
          en: 'Completed in 1965 and about 129 m tall, the Shalom Meir Tower was the tallest building in the Middle East — a statement of the young state’s modern ambition, built where the symbol of the first Hebrew city had stood.',
        },
        sources: [{ label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') }],
        confidence: 'documented',
      },
      hints: [
        { en: 'Travel to 1965.' },
        { en: 'The tower at the head of Herzl St. Circled on your map.' },
        { en: 'Marked on your screen and map.' },
      ],
      target: { x: SITE.x, z: SITE.z + 20, y: 40 },
    },
  ],
  pois: [
    {
      id: 'gutman-mosaic',
      label: { en: 'Mosaic wall' },
      x: -2,
      z: -150,
      y: 2.2,
      from: 1966,
      prop: { kind: 'mosaic', rot: 0.087 },
    },
    {
      id: 'site-hoarding',
      label: { en: 'Site fence' },
      x: -6,
      z: -158,
      y: 2.4,
      from: 1962,
      to: 1964,
      prop: { kind: 'hoarding', rot: 0.087 },
    },
  ],
  deduction: {
    question: { en: 'Why did the Herzliya Gymnasium vanish from the head of Herzl Street?' },
    options: [
      {
        text: { en: 'It was destroyed in the fighting of 1948.' },
        feedback: { en: 'Not quite — the school still stood here in 1961, long after 1948.' },
      },
      {
        text: { en: 'The school moved away and its building was razed to make room for a modern tower.' },
        correct: true,
        feedback: { en: 'Exactly.' },
      },
      {
        text: { en: 'The school closed and the old building collapsed.' },
        feedback: { en: 'The school never closed — the site fence told you it moved to a new campus.' },
      },
    ],
  },
  resolution: {
    title: { en: 'Case closed: The Vanishing School' },
    text: {
      en: 'In 1962 the Herzliya Gymnasium was razed so the Shalom Meir Tower could rise in its place. The loss shocked the city. It is remembered as a turning point that awakened Israel’s movement to preserve historic buildings.',
    },
    facts: [
      { en: 'The outline of the Gymnasium became the emblem of the Council for Conservation of Heritage Sites in Israel.' },
      { en: 'The school still runs today on Jabotinsky Street, behind a gate that recreates the old façade.' },
    ],
    sources: [
      { label: 'Herzliya Hebrew Gymnasium – Wikipedia', url: W('Herzliya_Hebrew_Gymnasium') },
      { label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') },
    ],
  },
  notes: [
    {
      id: 'photographers-eye',
      title: { en: 'Photographer’s eye' },
      text: { en: 'You lined up the postcard by eye alone, without any aids.' },
      trigger: { kind: 'eye' },
    },
    {
      id: 'double-exposure',
      title: { en: 'Double exposure' },
      text: { en: 'You peeked into the past from the foot of the tower and saw the Gymnasium where the tower stands.' },
      trigger: { kind: 'peek', x: SITE.x, z: SITE.z, r: 170, from: [1965, 2025], to: [1910, 1961] },
    },
    {
      id: 'first-kiosk',
      title: { en: 'Soda water and newspapers' },
      text: { en: 'You found the first kiosk on Rothschild Boulevard, beside the water tower.' },
      trigger: { kind: 'site', siteId: 'first-kiosk' },
    },
    {
      id: 'independence-hall',
      title: { en: 'The house on plot 43' },
      text: { en: 'You found Dizengoff House on Rothschild Boulevard. Remember it — it has a story of its own.' },
      trigger: { kind: 'site', siteId: 'dizengoff-house' },
    },
  ],
  teasers: [{ en: 'The Seashell Lottery' }, { en: 'The House on Plot 43' }, { en: 'The White City' }],
};
