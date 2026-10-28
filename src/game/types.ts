import type { BuildingPhase, BuildingSite, BuildingStyle, Confidence, Localized, SourceRef } from '../data/types';

/** A street-level camera pose. yaw follows CameraRig: forward = (-sin yaw, 0, -cos yaw). */
export interface Pose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Procedural props (see Interactables.ts). */
export type PropKind = 'mosaic' | 'hoarding' | 'crowd' | 'shells' | 'camera';

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

/** The notebook's three sections. */
export type SectionId = 'architecture' | 'urbanism' | 'culture';

/** A page of the notebook: a theme with an introduction, holding discoveries. */
export interface Collection {
  id: string;
  section: SectionId;
  title: Localized;
  /** What the theme is about and what to look for (shown on its page and with its first find). */
  intro: Localized;
  /** A suggested place and year to begin (optional order, never required). */
  start?: Localized;
}

/** An inclusive range of years. */
export type Years = [number, number];

/** A place: within `r` metres of (x, z). */
export interface Spot {
  x: number;
  z: number;
  r: number;
}

/** Which buildings a trigger is about: one site by id, or any site whose phase passes a test. */
export type SiteMatch = { site: string } | { style: BuildingStyle; test?: (phase: BuildingPhase, site: BuildingSite) => boolean };

/** How a discovery is made. */
export type Trigger =
  /**
   * Look closely at a building (hold it in the centre of the view, or tap it), from within
   * `maxDist` metres of its footprint, in these years. `side`: only its side walls count.
   */
  | { kind: 'look'; match: SiteMatch; maxDist: number; years: Years; side?: boolean }
  /** Look closely at a prop (a point of interest) while it stands. */
  | { kind: 'poi'; poi: string; maxDist: number }
  /**
   * Stand somewhere in a year in `from`, then peek or slip into a year in `to` (either way
   * round). Where: at a spot, on a street, or by a building that matches in both years.
   */
  | {
      kind: 'compare';
      from: Years;
      to: Years;
      where: { spot: Spot } | { street: string; margin: number } | { near: SiteMatch; then: SiteMatch; r: number };
    }
  /** Line up an archive photograph, in these years. */
  | { kind: 'photo'; photo: PhotoDef; years: Years };

/** One thing to notice, and what the notebook says about it. */
export interface Discovery {
  id: string;
  collection: string;
  title: Localized;
  /** Shown before it is found: what to look for, never where. */
  riddle: Localized;
  /** One more line, on request. */
  nudge: Localized;
  /** For a discovery that is one place: the map's search circle after a nudge. */
  area?: Spot;
  trigger: Trigger;
  /** One sentence: what the card says up front. */
  gist: Localized;
  /** The story, under "More". */
  text: Localized;
  facts?: Localized[];
  sources: SourceRef[];
  confidence: Confidence;
}
