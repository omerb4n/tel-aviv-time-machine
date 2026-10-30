/**
 * Quality tiers: what a phone, a laptop and a desktop are each asked to render.
 * Picked once from the GPU name and screen, overridable from the menu (`tlvtm.quality`)
 * or the URL (`#quality=phone`). Pure: no three.js, so it can be tested.
 */

export type Tier = 'phone' | 'laptop' | 'desktop';
export const TIERS: Tier[] = ['phone', 'laptop', 'desktop'];

export interface QualitySettings {
  tier: Tier;
  /** Cap on devicePixelRatio for the output (post chain, UI-sized buffers). */
  maxDpr: number;
  /** Range of the scene's render scale under the output resolution (TAA upsamples it). */
  minScale: number;
  maxScale: number;
  startScale: number;
  /** Frame-time budget the dynamic resolution aims for. */
  targetMs: number;
  shadowSize: number;
  /** Half-width of the sun's shadow frustum at street level, metres. */
  shadowExtent: number;
  /**
   * Redraw the shadow map only when the sun, the world or the player's spot changes.
   * Moving people and cars then cast no shadow; the desktop keeps every-frame shadows.
   */
  shadowCache: boolean;
}

export const QUALITY: Record<Tier, QualitySettings> = {
  // Aims for 60 fps by giving up resolution, so a strong phone (Galaxy S24+) runs smooth and
  // cooler instead of flat out at full size; a mid-range one bottoms out at half scale (~30 fps).
  phone: {
    tier: 'phone',
    maxDpr: 1.5,
    minScale: 0.5,
    maxScale: 1,
    startScale: 0.8,
    targetMs: 1000 / 60,
    shadowSize: 1024,
    shadowExtent: 60,
    shadowCache: true,
  },
  laptop: {
    tier: 'laptop',
    maxDpr: 1.5,
    minScale: 0.67,
    maxScale: 1,
    startScale: 0.85,
    targetMs: 1000 / 60,
    shadowSize: 2048,
    shadowExtent: 100,
    shadowCache: true,
  },
  desktop: {
    tier: 'desktop',
    maxDpr: 2,
    minScale: 0.85,
    maxScale: 1,
    startScale: 1,
    targetMs: 1000 / 60,
    shadowSize: 4096,
    shadowExtent: 160,
    shadowCache: false,
  },
};

export interface DeviceInfo {
  /** Unmasked GPU name (WEBGL_debug_renderer_info), or '' when hidden. */
  gpu: string;
  userAgent: string;
  touch: boolean;
  /** Shorter side of the screen in CSS pixels. */
  screenMin: number;
  /** navigator.deviceMemory in GB, when the browser tells. */
  memory?: number;
}

/** A first guess from what the browser tells us about the device. */
export function detectTier(d: DeviceInfo): Tier {
  const gpu = d.gpu.toLowerCase();
  const mobileUA = /android|iphone|ipad|ipod|mobile/i.test(d.userAgent);
  if (mobileUA || (d.touch && d.screenMin < 600)) return 'phone';
  if (/adreno|mali|xclipse|powervr|apple gpu/.test(gpu)) return 'phone';
  if (d.memory !== undefined && d.memory <= 4) return 'laptop';
  // discrete cards: GeForce / Quadro / RTX, Radeon RX / Pro, Arc
  if (/geforce|quadro|rtx|radeon rx|radeon pro|arc\(tm\)|arc a\d/.test(gpu)) return 'desktop';
  // Apple silicon Max / Ultra chips can take the desktop tier
  if (/apple m\d (max|ultra)/.test(gpu)) return 'desktop';
  return 'laptop';
}

export function parseTier(s: string | null | undefined): Tier | undefined {
  return TIERS.find((t) => t === s);
}

type ScaleLimits = Pick<QualitySettings, 'minScale' | 'maxScale' | 'startScale' | 'targetMs'>;

/**
 * Dynamic resolution: lowers the render scale as soon as frames run late and raises it
 * again by careful probing (a display at its refresh rate can't show how much headroom is
 * left, so the controller tries a step up and backs off when that misses frames).
 */
export class ResolutionController {
  scale: number;
  private acc = 0;
  private n = 0;
  private late = 0;
  private stableFor = 0;
  /** Seconds of good frames before probing a step up; doubles after a failed probe. */
  private probeAfter = 2;
  private probing = false;

  constructor(
    private q: ScaleLimits,
    private step = 0.08,
  ) {
    this.scale = q.startScale;
  }

  /** Start over under another tier's limits. */
  reset(q: ScaleLimits) {
    this.q = q;
    this.scale = q.startScale;
    this.acc = this.n = this.late = this.stableFor = 0;
    this.probeAfter = 2;
    this.probing = false;
  }

  /** Feed one frame's duration; returns true when the scale changed. */
  frame(dtMs: number): boolean {
    // ignore stalls (tab switches, loading): they say nothing about rendering cost
    if (dtMs > 250) return false;
    this.acc += dtMs;
    this.n++;
    if (dtMs > this.q.targetMs * 1.35) this.late++;
    if (this.acc < 500) return false;
    const avg = this.acc / this.n;
    const lateShare = this.late / this.n;
    const seconds = this.acc / 1000;
    this.acc = this.n = this.late = 0;
    const before = this.scale;
    if (avg > this.q.targetMs * 1.15 || lateShare > 0.25) {
      this.scale = Math.max(this.q.minScale, this.scale - this.step * (avg > this.q.targetMs * 1.6 ? 2 : 1));
      this.stableFor = 0;
      if (this.probing) this.probeAfter = Math.min(30, this.probeAfter * 2);
      this.probing = false;
    } else {
      this.stableFor += seconds;
      if (this.probing) {
        this.probing = false;
        this.probeAfter = Math.max(2, this.probeAfter * 0.75);
      }
      if (this.stableFor >= this.probeAfter && this.scale < this.q.maxScale) {
        this.scale = Math.min(this.q.maxScale, this.scale + this.step / 2);
        this.stableFor = 0;
        this.probing = true;
      }
    }
    return this.scale !== before;
  }
}

/**
 * Optional frame-rate cap. On a 120 Hz phone it draws every other refresh, so the game runs
 * at an even 60 fps and the phone stays cooler. Frames are skipped, never delayed: a frame is
 * drawn once waiting for the next refresh would overshoot the target by more than half a refresh.
 */
export class FrameCap {
  on = false;
  private last = -Infinity;
  private tick = 0;
  private refresh = 1000 / 60;

  constructor(private fps = 60) {}

  /** Call at every animation frame with its timestamp; false means skip this one. */
  shouldDraw(now: number): boolean {
    if (this.tick) this.refresh += (Math.min(now - this.tick, 50) - this.refresh) * 0.1;
    this.tick = now;
    if (this.on && now - this.last < 1000 / this.fps - this.refresh / 2) return false;
    this.last = now;
    return true;
  }
}
