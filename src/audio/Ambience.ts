import { clamp } from '../core/math';

/**
 * Procedural soundscape (no audio files): wind over the dunes, the sea, the murmur
 * of crowds, traffic rumble, and occasional period sounds — camel bells in the
 * early years, car horns later, birds in the gardens.
 */
export class Ambience {
  private ctx?: AudioContext;
  private master?: GainNode;
  private layers: Record<'wind' | 'sea' | 'crowd' | 'traffic', GainNode> | undefined;
  private target = { wind: 0, sea: 0, crowd: 0, traffic: 0 };
  private nextEvent = 0;
  private year = 1909;
  private night = 0;
  enabled = false;

  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.enabled = true;
    this.master!.gain.setTargetAtTime(0.9, this.ctx!.currentTime, 0.5);
  }

  disable() {
    this.enabled = false;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  private noiseBuffer(ctx: AudioContext, brown = false) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const white = this.noiseBuffer(ctx);
    const brown = this.noiseBuffer(ctx, true);
    const src = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * 3);
      return s;
    };
    const lfo = (freq: number, depth: number, param: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(param);
      o.start();
    };
    const layer = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src(buf).connect(f).connect(g).connect(this.master!);
      return { f, g };
    };
    const wind = layer(white, 'bandpass', 500, 0.6);
    lfo(0.07, 260, wind.f.frequency);
    const sea = layer(brown, 'lowpass', 520, 0.5);
    const seaSwell = ctx.createGain();
    sea.g.disconnect();
    sea.g.connect(seaSwell).connect(this.master);
    lfo(0.11, 0.45, seaSwell.gain);
    const crowd = layer(white, 'bandpass', 900, 1.4);
    lfo(1.7, 220, crowd.f.frequency);
    const traffic = layer(brown, 'lowpass', 180, 0.7);
    this.layers = { wind: wind.g, sea: sea.g, crowd: crowd.g, traffic: traffic.g };
  }

  /** Called every frame with the state of the world. */
  update(p: { year: number; urban: number; people: number; vehicles: number; height: number; night: number }) {
    this.year = p.year;
    this.night = p.night;
    this.target.wind = 0.08 + 0.3 * (1 - p.urban) + clamp(p.height / 600, 0, 0.25);
    this.target.sea = 0.12 + clamp(p.height / 400, 0, 0.3);
    this.target.crowd = clamp(p.people / 900, 0, 1) * 0.22 * (1 - clamp(p.height / 500, 0, 0.85)) * (1 - p.night * 0.5);
    this.target.traffic = clamp(p.vehicles / 400, 0, 1) * 0.35 * (1 - clamp(p.height / 900, 0, 0.6));
    if (!this.ctx || !this.layers || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(this.layers) as (keyof typeof this.target)[]) this.layers[k].gain.setTargetAtTime(this.target[k], t, 0.8);
    if (t > this.nextEvent) {
      this.nextEvent = t + 2 + Math.random() * 6;
      this.oneShot();
    }
  }

  private oneShot() {
    const ctx = this.ctx!;
    const y = this.year;
    const r = Math.random();
    if (y < 1936 && r < 0.4) this.bell(ctx, 900 + Math.random() * 300);
    else if (y >= 1925 && r < 0.55 && this.target.traffic > 0.05) this.horn(ctx, y < 1960 ? 330 : 440);
    else if (this.night < 0.5) this.bird(ctx);
  }

  private envGain(ctx: AudioContext, peak: number, attack: number, decay: number) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master!);
    return g;
  }

  private bell(ctx: AudioContext, f: number) {
    for (const [mult, amp] of [
      [1, 0.05],
      [2.76, 0.02],
      [5.4, 0.01],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      o.connect(this.envGain(ctx, amp, 0.005, 1.2));
      o.start();
      o.stop(ctx.currentTime + 1.4);
    }
  }

  private horn(ctx: AudioContext, f: number) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    o.connect(lp).connect(this.envGain(ctx, 0.025, 0.02, 0.35));
    o.start();
    o.stop(ctx.currentTime + 0.45);
  }

  private bird(ctx: AudioContext) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    const t = ctx.currentTime;
    const base = 2800 + Math.random() * 1500;
    for (let i = 0; i < 4; i++) {
      o.frequency.setValueAtTime(base, t + i * 0.12);
      o.frequency.exponentialRampToValueAtTime(base * 1.4, t + i * 0.12 + 0.08);
    }
    o.connect(this.envGain(ctx, 0.012, 0.01, 0.6));
    o.start();
    o.stop(t + 0.7);
  }
}
