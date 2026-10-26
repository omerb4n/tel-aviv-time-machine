import { clamp, easeInOutCubic } from './math';

type Listener = (year: number) => void;

/** The single source of truth for "when" we are. Years are continuous floats. */
export class TimeController {
  private _year: number;
  private listeners = new Set<Listener>();
  private tween?: { from: number; to: number; t: number; dur: number };
  playing = false;
  /** Years per second while playing. */
  speed = 2;

  constructor(
    readonly min: number,
    readonly max: number,
    start: number,
  ) {
    this._year = start;
  }

  get year() {
    return this._year;
  }

  set(year: number) {
    this.tween = undefined;
    this.apply(year);
  }

  private apply(year: number) {
    const y = clamp(year, this.min, this.max);
    if (y === this._year) return;
    this._year = y;
    for (const l of this.listeners) l(y);
  }

  step(delta: number) {
    this.set(Math.round(this._year) + delta);
  }

  tweenTo(year: number, seconds = 2) {
    this.tween = { from: this._year, to: clamp(year, this.min, this.max), t: 0, dur: Math.max(0.01, seconds) };
  }

  togglePlay() {
    this.playing = !this.playing;
    if (this.playing && this._year >= this.max) this.set(this.min);
  }

  onChange(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  update(dt: number) {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = easeInOutCubic(Math.min(1, tw.t / tw.dur));
      this.apply(tw.from + (tw.to - tw.from) * k);
      if (tw.t >= tw.dur) this.tween = undefined;
    } else if (this.playing) {
      this.apply(this._year + dt * this.speed);
      if (this._year >= this.max) this.playing = false;
    }
  }
}
