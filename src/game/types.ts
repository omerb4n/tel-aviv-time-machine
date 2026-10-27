import type { Confidence, Localized, SourceRef } from '../data/types';

/** A street-level camera pose. yaw follows CameraRig: forward = (-sin yaw, 0, -cos yaw). */
export interface Pose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** What the player learns when a lead is completed. Shown as a card and kept in the journal. */
export interface Clue {
  title: Localized;
  /** One sentence: what the card says before "More". */
  gist: Localized;
  /** The full story, shown under "More" and in the case file. */
  text: Localized;
  sources?: SourceRef[];
  confidence: Confidence;
  /** A year this clue lets the player travel to ("anchors" it on the time compass). */
  anchors?: number;
  /**
   * A small hands-on moment before the clue card: the player draws items one by one
   * (e.g. a white shell and a grey shell in the seashell lottery) and each reveals a value.
   */
  reveal?: { prompt: Localized; look: 'shells' | 'cards'; draws: { label: Localized; value: Localized; tone: 'light' | 'dark' }[] };
}

/** How a lead is completed. */
export type Trigger =
  /** Stand where an archival photo was taken and line the view up with it. */
  | { kind: 'rephoto'; photo: PhotoDef }
  /** Examine a building (tap it) from within `maxDist` metres, in a year it stands. */
  | { kind: 'site'; siteId: string; maxDist: number }
  /** Examine a point of interest. */
  | { kind: 'poi'; poiId: string };

/** One step of a case: a question the player is following. */
export interface Lead {
  id: string;
  title: Localized;
  /** The objective in one short line (the HUD tag). */
  short: Localized;
  /** The objective, phrased as what the player wants to find out (case file). */
  text: Localized;
  /** What the Examine button names, e.g. "the school". */
  examine?: Localized;
  /** Leads that must be completed first. */
  requires: string[];
  trigger: Trigger;
  clue: Clue;
  /** Tiered hints: the first is a nudge, the last shows the target on screen. */
  hints: Localized[];
  /** Where the answer is (for the last hint's on-screen marker). */
  target: { x: number; z: number; y?: number };
  /** If set, the lead can only be completed in these years (inclusive). */
  years?: [number, number];
  /** Travel to the anchored year as soon as the clue is found (used for the first one). */
  autoTravel?: boolean;
  /** After the clue, step into this room (the id of a point of interest with a `room`). */
  enter?: string;
}

/** Procedural props (see Interactables.ts). */
export type PropKind = 'mosaic' | 'hoarding' | 'crowd' | 'crowd48' | 'shells' | 'camera' | 'sign' | 'hall';

/** A small examinable thing placed in the world for some years. */
export interface Poi {
  id: string;
  label: Localized;
  x: number;
  z: number;
  /** Height of the sparkle marker above the ground. */
  y: number;
  from: number;
  to?: number;
  /** Optional prop model that stands here in those years. */
  prop?: { kind: PropKind; rot: number };
  /**
   * An interior the player can step into (a room inside a building), centred on (x, z) and
   * turned by `prop.rot`; local +z is the door side. Width and depth in metres.
   */
  room?: { w: number; d: number };
}

/** An archival-style photograph to stand inside (rephotography). */
export interface PhotoDef {
  id: string;
  year: number;
  pose: Pose;
  title: Localized;
  caption: Localized;
  /** Link to the real archival material this reconstruction is based on. */
  reference: SourceRef;
  /**
   * Match points: world positions (y = metres above ground) that are easy to recognise in
   * the photo. Shown only as an alignment aid, as dots on the photo and rings in the view.
   */
  marks: { x: number; y: number; z: number }[];
  /**
   * The real photograph, when a free one exists. It is shown in place of the reconstruction:
   * on the postcard, when held up and on the clue card. `marks` gives each match point's
   * position in it (0 … 1, from the top left); they also fit the print to the view.
   */
  archive?: { src: string; marks: [number, number][]; credit: Localized };
}

export interface Deduction {
  question: Localized;
  options: { text: Localized; correct?: boolean; feedback: Localized }[];
}

/** Optional discoveries that are not needed to close the case. */
export interface FieldNote {
  id: string;
  title: Localized;
  text: Localized;
  /** What earns the note. */
  trigger: NoteTrigger;
}

export type NoteTrigger =
  /** Line up the case's photo without any aids. */
  | { kind: 'eye' }
  /** Examine a landmark. */
  | { kind: 'site'; siteId: string }
  /** Peek into a year in `to` while standing within `r` of (x, z) in a year in `from`. */
  | { kind: 'peek'; x: number; z: number; r: number; from: [number, number]; to: [number, number] }
  /** Stand within `r` metres of (x, z) in one of these years. */
  | { kind: 'area'; x: number; z: number; r: number; years: [number, number] }
  /** Reach the shoreline in one of these years. */
  | { kind: 'coast'; years: [number, number] };

export interface CaseDef {
  id: string;
  number: number;
  title: Localized;
  tagline: Localized;
  /** The question the whole case answers (top of the case file). */
  question: Localized;
  /** Opening text: short, ends with the first question. */
  intro: Localized;
  start: { year: number; pose: Pose };
  /** Every year this case can anchor, including the start (drives the "????" slots). */
  years: number[];
  leads: Lead[];
  pois: Poi[];
  deduction: Deduction;
  resolution: { title: Localized; text: Localized; facts: Localized[]; sources: SourceRef[] };
  notes: FieldNote[];
  /** Titles of the next cases, shown locked to make players want more. */
  teasers: Localized[];
}
