/** Tiny procedural sound effects for game feedback (no audio files). */
export class Sfx {
  private ctx?: AudioContext;
  enabled = true;

  private get audio() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return undefined;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Must be called from a user gesture once, so later sounds are allowed. */
  unlock() {
    void this.audio;
  }

  /** A breathy sweep for time slips. */
  whoosh(up = true, dur = 1.3) {
    const ctx = this.enabled && this.audio;
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(up ? 300 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    // a soft shimmering tone underneath
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(up ? 220 : 440, t);
    o.frequency.exponentialRampToValueAtTime(up ? 660 : 220, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.06, t + dur * 0.4);
    og.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(og).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  /** A bright arpeggio for discoveries. `big` adds a fourth note. */
  chime(big = false) {
    const ctx = this.enabled && this.audio;
    if (!ctx) return;
    const notes = big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.11;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.2);
    });
  }

  /** A soft click for UI. */
  tick() {
    const ctx = this.enabled && this.audio;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.07);
  }
}
