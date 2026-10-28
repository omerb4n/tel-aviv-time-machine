import type { Discovery } from './types';

/** Where and when something was noticed. */
export interface Found {
  year: number;
  x: number;
  z: number;
  /** A photograph lined up with no aids. */
  eye?: boolean;
}

export interface SaveData {
  v: 1;
  found: Record<string, Found>;
  /** Discoveries the player asked a nudge for. */
  nudged: string[];
  stamps: string[];
  landmarks: string[];
  /** Where the player was when last saved. */
  where?: { year: number; x: number; z: number; yaw: number };
  /** The walked trail, flattened [x0, z0, x1, z1, …] in whole metres. */
  trail?: number[];
  /** One-time things the player has already done or been taught (e.g. 'travel', 'peek'). */
  seen?: string[];
  /** The photograph in the pocket (a discovery id). */
  photo?: string;
}

/** Trail points are recorded every TRAIL_STEP metres and capped at TRAIL_MAX points. */
export const TRAIL_STEP = 6;
export const TRAIL_MAX = 3000;

/**
 * The field notebook's progress: what was noticed, where and when, plus the walked trail and
 * the style and landmark collections. No three.js / DOM, so it is unit-testable.
 */
export class NotebookState {
  readonly found = new Map<string, Found>();
  readonly nudged = new Set<string>();
  readonly stamps = new Set<string>();
  readonly landmarks = new Set<string>();
  readonly seen = new Set<string>();
  /** Walked trail as [x, z] pairs, oldest first. */
  trail: [number, number][] = [];
  where?: SaveData['where'];
  photo?: string;

  constructor(
    readonly discoveries: Discovery[],
    save?: SaveData,
  ) {
    if (save?.v !== 1) return;
    for (const [id, f] of Object.entries(save.found ?? {})) if (this.byId(id)) this.found.set(id, f);
    save.nudged?.forEach((x) => this.byId(x) && this.nudged.add(x));
    save.stamps?.forEach((x) => this.stamps.add(x));
    save.landmarks?.forEach((x) => this.landmarks.add(x));
    save.seen?.forEach((x) => this.seen.add(x));
    this.where = save.where;
    if (save.photo && this.byId(save.photo)) this.photo = save.photo;
    const t = save.trail ?? [];
    for (let i = 0; i + 1 < t.length; i += 2) this.trail.push([t[i], t[i + 1]]);
  }

  byId(id: string) {
    return this.discoveries.find((d) => d.id === id);
  }

  has(id: string) {
    return this.found.has(id);
  }

  /** Records a discovery. Returns false if it was already in the notebook. */
  discover(id: string, f: Found): boolean {
    if (this.found.has(id) || !this.byId(id)) return false;
    this.found.set(id, f);
    if (this.photo === id) this.photo = undefined;
    return true;
  }

  /** Discoveries not yet made. */
  get missing(): Discovery[] {
    return this.discoveries.filter((d) => !this.found.has(d.id));
  }

  /** Is this the first find in its collection? */
  firstIn(collection: string): boolean {
    return this.discoveries.filter((d) => d.collection === collection && this.found.has(d.id)).length === 1;
  }

  /** Found / total in a collection. */
  count(collection?: string): [number, number] {
    const list = collection ? this.discoveries.filter((d) => d.collection === collection) : this.discoveries;
    return [list.filter((d) => this.found.has(d.id)).length, list.length];
  }

  /** The most recent find (by insertion order). */
  get latest(): Discovery | undefined {
    const ids = [...this.found.keys()];
    return ids.length ? this.byId(ids[ids.length - 1]) : undefined;
  }

  /** The photographs still to place, in notebook order. */
  get photosLeft(): Discovery[] {
    return this.missing.filter((d) => d.trigger.kind === 'photo');
  }

  /** The photograph in the pocket: the chosen one if still unplaced, else the first left. */
  get pocket(): Discovery | undefined {
    const left = this.photosLeft;
    return left.find((d) => d.id === this.photo) ?? left[0];
  }

  /**
   * Records the player's position on the trail. A new point is added once the player is
   * TRAIL_STEP metres from the last one. Returns true if a point was added.
   */
  walk(x: number, z: number): boolean {
    const last = this.trail[this.trail.length - 1];
    if (last && Math.hypot(x - last[0], z - last[1]) < TRAIL_STEP) return false;
    this.trail.push([Math.round(x), Math.round(z)]);
    if (this.trail.length > TRAIL_MAX) this.trail.splice(0, this.trail.length - TRAIL_MAX);
    return true;
  }

  /** Adds to a collection; true if it was new. */
  collect(set: 'landmarks' | 'stamps', id: string): boolean {
    const s = this[set];
    if (s.has(id)) return false;
    s.add(id);
    return true;
  }

  toJSON(): SaveData {
    return {
      v: 1,
      found: Object.fromEntries(this.found),
      nudged: [...this.nudged],
      stamps: [...this.stamps],
      landmarks: [...this.landmarks],
      where: this.where,
      trail: this.trail.flat(),
      seen: [...this.seen],
      photo: this.photo,
    };
  }
}
