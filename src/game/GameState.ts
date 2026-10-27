import type { CaseDef, Lead } from './types';

export interface SaveData {
  v: 1;
  caseId: string;
  done: string[];
  anchors: number[];
  landmarks: string[];
  stamps: string[];
  notes: string[];
  solved: boolean;
  hints: Record<string, number>;
  /** Where the player was when last saved. */
  where?: { year: number; x: number; z: number; yaw: number };
}

/**
 * Pure progress state of a case: which leads are done, which years are anchored,
 * what the player has collected. No three.js / DOM, so it is unit-testable.
 */
export class GameState {
  readonly done = new Set<string>();
  readonly anchors = new Set<number>();
  readonly landmarks = new Set<string>();
  readonly stamps = new Set<string>();
  readonly notes = new Set<string>();
  readonly hints = new Map<string, number>();
  solved = false;
  where?: SaveData['where'];

  constructor(
    readonly def: CaseDef,
    save?: SaveData,
  ) {
    this.anchors.add(def.start.year);
    if (save && save.v === 1 && save.caseId === def.id) {
      for (const id of save.done) if (def.leads.some((l) => l.id === id)) this.done.add(id);
      for (const y of save.anchors) this.anchors.add(y);
      save.landmarks.forEach((x) => this.landmarks.add(x));
      save.stamps.forEach((x) => this.stamps.add(x));
      save.notes.forEach((x) => this.notes.add(x));
      for (const [k, v] of Object.entries(save.hints ?? {})) this.hints.set(k, v);
      this.solved = !!save.solved;
      if (save.where && this.anchors.has(save.where.year)) this.where = save.where;
    }
  }

  /** Leads that can be worked on now (all requirements met, not yet done). */
  get open(): Lead[] {
    return this.def.leads.filter((l) => !this.done.has(l.id) && l.requires.every((r) => this.done.has(r)));
  }

  /** The lead shown as the current objective. */
  get current(): Lead | undefined {
    return this.open[0];
  }

  /** All leads done: the deduction is next. */
  get readyToSolve() {
    return !this.solved && this.def.leads.every((l) => this.done.has(l.id));
  }

  /** Can this lead be completed in this year? */
  canComplete(lead: Lead, year: number) {
    if (this.done.has(lead.id) || !lead.requires.every((r) => this.done.has(r))) return false;
    return !lead.years || (year >= lead.years[0] && year <= lead.years[1]);
  }

  /** Marks a lead done. Returns the newly anchored year, if any. */
  complete(leadId: string): number | undefined {
    const lead = this.def.leads.find((l) => l.id === leadId);
    if (!lead || this.done.has(leadId)) return undefined;
    this.done.add(leadId);
    const y = lead.clue.anchors;
    if (y !== undefined && !this.anchors.has(y)) {
      this.anchors.add(y);
      return y;
    }
    return undefined;
  }

  /** The year of the time compass slots: anchored years and locked "????" slots, in case order. */
  get compass(): { year: number; locked: boolean }[] {
    const all = [...new Set([...this.def.years, ...this.anchors])];
    return all.map((year) => ({ year, locked: !this.anchors.has(year) })).sort((a, b) => a.year - b.year);
  }

  /** Next hint for the current lead (cycles up to the last tier). Returns the tier index. */
  nextHint(leadId: string): number {
    const lead = this.def.leads.find((l) => l.id === leadId);
    if (!lead) return -1;
    const n = Math.min((this.hints.get(leadId) ?? -1) + 1, lead.hints.length - 1);
    this.hints.set(leadId, n);
    return n;
  }

  hintTier(leadId: string): number {
    return this.hints.get(leadId) ?? -1;
  }

  /** Adds to a collection; true if it was new. */
  collect(set: 'landmarks' | 'stamps' | 'notes', id: string): boolean {
    const s = this[set];
    if (s.has(id)) return false;
    s.add(id);
    return true;
  }

  toJSON(): SaveData {
    return {
      v: 1,
      caseId: this.def.id,
      done: [...this.done],
      anchors: [...this.anchors],
      landmarks: [...this.landmarks],
      stamps: [...this.stamps],
      notes: [...this.notes],
      solved: this.solved,
      hints: Object.fromEntries(this.hints),
      where: this.where,
    };
  }
}
