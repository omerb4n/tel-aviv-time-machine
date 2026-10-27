import { frameAt, streetById } from '../../data/streets';
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

// The player starts further down Herzl, south of the boulevard, glancing up the street.
const startF = frameAt(herzl, 420);
const START: Pose = { x: startF.x + 3, z: startF.z, yaw: facing(startF.x + 3, startF.z, 60, -200), pitch: 0.05 };

export const VANISHING_SCHOOL: CaseDef = {
  id: 'vanishing-school',
  number: 1,
  title: { en: 'The Vanishing School', he: 'בית הספר שנעלם' },
  tagline: { en: 'A postcard, a tower, and a building that is no longer there.' },
  intro: {
    en: 'Herzl Street, 2025. A tower of glass and concrete closes the end of the street. In your pocket is an old postcard of this very street — but at its end stands something else entirely. Where was the postcard taken?',
  },
  start: { year: 2025, pose: START },
  years: [2025, 1910, 1962, 1965],
  leads: [
    {
      id: 'postcard',
      title: { en: 'The postcard' },
      text: { en: 'Find the spot where the postcard was taken. Hold it up and line it up with the street.' },
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
        },
      },
      clue: {
        title: { en: 'Herzl Street, 1910' },
        text: {
          en: 'The postcard comes alive. A year after the seashell lottery, Herzl Street is a sandy track between new garden houses — and it was laid out to lead straight to one building: a school with a temple-like façade.',
        },
        sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
        confidence: 'documented',
        anchors: 1910,
      },
      hints: [
        { en: 'The postcard looks straight up a long street towards a large building at its end. You are on that street.' },
        { en: 'Walk up the middle of Herzl Street, just past the boulevard crossing, and face the tower.' },
        { en: 'The spot is marked on your screen.' },
      ],
      target: { x: POSTCARD.x, z: POSTCARD.z, y: 1.7 },
      autoTravel: true,
    },
    {
      id: 'gymnasium',
      title: { en: 'The building at the end of the street' },
      text: { en: 'Walk up Herzl Street to the grand building at its end. When you are close, press Examine (or tap the building).' },
      requires: ['postcard'],
      years: [1910, 1961],
      trigger: { kind: 'site', siteId: 'herzliya-gymnasium', maxDist: 95 },
      clue: {
        title: { en: 'The Herzliya Hebrew Gymnasium' },
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
        { en: 'Follow Herzl Street north to its end.' },
        { en: 'Walk towards the building with the twin towers until an Examine button appears.' },
        { en: 'The building is marked on your screen.' },
      ],
      target: { x: SITE.x - 7, z: SITE.z + 10, y: 5 },
    },
    {
      id: 'mosaic',
      title: { en: 'A trace in the present' },
      text: { en: 'Go back to 2025 (tap it on the time compass). Is anything left of the school at the foot of the tower? Look for a glimmer.' },
      requires: ['gymnasium'],
      years: [1966, 2025],
      trigger: { kind: 'poi', poiId: 'gutman-mosaic' },
      clue: {
        title: { en: 'Nachum Gutman’s mosaic' },
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
        { en: 'Use your time compass to return to 2025, then walk to the foot of the tower.' },
        { en: 'Look for a colourful wall facing Herzl Street, right in front of the tower.' },
        { en: 'The mosaic is marked on your screen.' },
      ],
      target: { x: -2, z: -150, y: 2 },
    },
    {
      id: 'hoarding',
      title: { en: 'The empty lot' },
      text: { en: 'Travel to 1962 on the time compass and walk to where the school stood. Look for a glimmer.' },
      requires: ['mosaic'],
      years: [1962, 1964],
      trigger: { kind: 'poi', poiId: 'site-hoarding' },
      clue: {
        title: { en: 'A building site' },
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
        { en: 'Tap 1962 on your time compass and walk to where the Gymnasium stood.' },
        { en: 'There is a fence with a poster where the school used to be.' },
        { en: 'The poster is marked on your screen.' },
      ],
      target: { x: -6, z: -158, y: 2 },
    },
    {
      id: 'tower',
      title: { en: 'What replaced it' },
      text: { en: 'Travel to 1965 and examine what stands on the site now.' },
      requires: ['hoarding'],
      years: [1965, 2025],
      trigger: { kind: 'site', siteId: 'shalom-meir-tower', maxDist: 140 },
      clue: {
        title: { en: 'The Shalom Meir Tower' },
        text: {
          en: 'Completed in 1965 and about 129 m tall, the Shalom Meir Tower was the tallest building in the Middle East — a statement of the young state’s modern ambition, built where the symbol of the first Hebrew city had stood.',
        },
        sources: [{ label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') }],
        confidence: 'documented',
      },
      hints: [
        { en: 'Tap 1965 on your time compass.' },
        { en: 'Tap the tower at the head of Herzl Street.' },
        { en: 'The tower is marked on your screen.' },
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
      id: 'double-exposure',
      title: { en: 'Double exposure' },
      text: { en: 'You peeked into the past from the foot of the tower and saw the Gymnasium where the tower stands.' },
    },
    {
      id: 'first-kiosk',
      title: { en: 'Soda water and newspapers' },
      text: { en: 'You found the first kiosk on Rothschild Boulevard, beside the water tower.' },
    },
    {
      id: 'independence-hall',
      title: { en: 'The house on plot 43' },
      text: { en: 'You found Dizengoff House on Rothschild Boulevard. Remember it — it has a story of its own.' },
    },
  ],
  teasers: [{ en: 'The Seashell Lottery' }, { en: 'The House on Plot 43' }, { en: 'The White City' }],
};
