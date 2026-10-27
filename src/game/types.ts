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
  text: Localized;
  sources?: SourceRef[];
  confidence: Confidence;
  /** A year this clue lets the player travel to ("anchors" it on the time compass). */
  anchors?: number;
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
  /** The objective, phrased as what the player wants to find out. */
  text: Localized;
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
}

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
  prop?: { kind: 'mosaic' | 'hoarding'; rot: number };
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
}

export interface CaseDef {
  id: string;
  number: number;
  title: Localized;
  tagline: Localized;
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
