export interface Localized {
  en: string;
  he?: string;
}

export interface SourceRef {
  label: string;
  url: string;
}

/** How sure we are about a date or placement. Shown in the UI so the sim never over-claims. */
export type Confidence = 'documented' | 'approximate' | 'illustrative';

/**
 * Visual archetypes. Each maps to a generator in world/buildings/styles.ts.
 * Generic styles are used by the procedural fabric; landmark styles are bespoke models.
 */
export type BuildingStyle =
  // generic fabric, roughly chronological
  | 'ottoman-house' // 1887–1914: 1–2 floors, Marseille tile hip roof, shutters
  | 'eclectic' // 1920s: flat roof, ornate parapet, arched windows, ceramic bands
  | 'bauhaus' // 1931–1948: International Style, ribbon balconies, rounded corners
  | 'shikun' // 1950s–60s: plain plaster slab on pilotis
  | 'brutalist' // 1965–1985: exposed concrete offices
  | 'modern-residential' // 1990s–2020s: white/grey, glass balcony rails
  | 'glass-tower' // 2000s+: curtain wall towers
  // landmarks
  | 'gymnasium'
  | 'shalom-tower'
  | 'kiosk'
  | 'water-tower'
  | 'founders-monument'
  | 'museum-cube'
  | 'synagogue-dome'
  | 'synagogue-arches'
  | 'pagoda-house'
  | 'clock-tower'
  | 'church'
  | 'cylinder-tower'
  | 'triangle-tower'
  | 'tent'
  | 'jaffa-stone'; // Old Jaffa: stone, flat roofs, small domes

/** One period of a site's life. A site's phases must not overlap. */
export interface BuildingPhase {
  from: number;
  /** Last year standing (inclusive). Omit if still standing. */
  to?: number;
  style: BuildingStyle;
  floors?: number;
  /** Override total height in metres (towers). */
  height?: number;
  width?: number;
  depth?: number;
  /** Base wall tint (CSS colour). */
  color?: string;
  /** 0 = freshly built, 1 = heavily weathered/grimy. */
  weathering?: number;
  /** Optional per-phase story shown in the info panel. */
  note?: Localized;
}

export interface BuildingInfo {
  architect?: string;
  address?: string;
  summary: Localized;
  facts?: Localized[];
  sources?: SourceRef[];
  confidence: Confidence;
}

export interface BuildingSite {
  id: string;
  name?: Localized;
  x: number;
  z: number;
  /** Rotation about Y (radians); local +z is the street-facing front. */
  rot: number;
  width: number;
  depth: number;
  phases: BuildingPhase[];
  landmark?: boolean;
  info?: BuildingInfo;
}

export interface Street {
  id: string;
  name: Localized;
  /** Polyline in local metres. */
  points: [number, number][];
  /** Carriageway + sidewalks, kerb to kerb (excluding promenade). */
  width: number;
  sidewalk: number;
  /** Central tree-lined promenade (Rothschild). */
  promenade?: number;
  opened: number;
  paved: number;
  /** Fabric generation along this street (procedural parcels). */
  fabric?: { from: number; to: number; firstBuild: number; frontage?: number };
}

export interface TimelineEvent {
  id: string;
  year: number;
  /** Optional precise date for display. */
  date?: string;
  title: Localized;
  text: Localized;
  /** Camera framing used by tours and when clicking the event. */
  view?: { pos: [number, number, number]; target: [number, number, number] };
  sources?: SourceRef[];
  confidence: Confidence;
  /** Major events get a tour stop and a bigger tick on the timeline. */
  major?: boolean;
}

export interface Era {
  id: string;
  from: number;
  to: number;
  title: Localized;
  subtitle: Localized;
  /** Visual mood for the period. */
  mood: {
    /** 0 = full colour, 1 = full archival sepia (only applied when "period film" is on). */
    sepia: number;
    grain: number;
    saturation: number;
    haze: number;
  };
}
