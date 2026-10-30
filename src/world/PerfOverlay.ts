import type * as THREE from 'three';

interface PerfState {
  tier: string;
  scale: number;
  size: [number, number];
}

export interface PerfSample {
  fps: number;
  avgMs: number;
  p95Ms: number;
  calls: number;
  triangles: number;
  tier: string;
  scale: number;
  size: [number, number];
}

/**
 * Frame statistics for measuring on real devices: `#perf` in the URL (or Shift+P) shows
 * fps, frame time, draw calls and triangles per frame, the quality tier and the render scale.
 */
export class PerfOverlay {
  /** The last second's figures, also for headless measurement (`tlvtm.perf.last`). */
  last?: PerfSample;
  private el?: HTMLElement;
  private times: number[] = [];
  private calls = 0;
  private tris = 0;
  private since = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private state: () => PerfState,
  ) {
    if (/(^|[#&])perf\b/.test(location.hash)) this.show(true);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && e.shiftKey && (e.target as HTMLElement)?.tagName !== 'INPUT') this.show(!this.el);
    });
  }

  show(on: boolean) {
    if (on && !this.el) {
      this.el = document.createElement('pre');
      this.el.className = 'perf-overlay';
      this.el.style.cssText =
        'position:fixed;left:8px;top:38%;z-index:99;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;' +
        'color:#e8f0e0;background:rgba(10,12,14,.72);border-radius:4px;pointer-events:none;white-space:pre';
      document.body.append(this.el);
    } else if (!on && this.el) {
      this.el.remove();
      this.el = undefined;
    }
  }

  /** Called once per frame, before the renderer's counters are reset. */
  frame(dtMs: number) {
    const info = this.renderer.info.render;
    this.times.push(dtMs);
    this.calls += info.calls;
    this.tris += info.triangles;
    this.since += dtMs;
    if (this.since < 1000) return;
    const n = this.times.length;
    const sorted = [...this.times].sort((a, b) => a - b);
    const avg = this.since / n;
    const s = this.state();
    this.last = {
      fps: 1000 / avg,
      avgMs: avg,
      p95Ms: sorted[Math.min(n - 1, Math.floor(n * 0.95))],
      calls: Math.round(this.calls / n),
      triangles: Math.round(this.tris / n),
      tier: s.tier,
      scale: s.scale,
      size: s.size,
    };
    this.times.length = 0;
    this.calls = this.tris = this.since = 0;
    if (!this.el) return;
    const l = this.last;
    this.el.textContent =
      `${l.fps.toFixed(0)} fps  ${l.avgMs.toFixed(1)} ms (p95 ${l.p95Ms.toFixed(1)})\n` +
      `${l.calls} draws  ${(l.triangles / 1e6).toFixed(2)} M tris\n` +
      `${l.tier}  scale ${l.scale.toFixed(2)}  ${l.size[0]}×${l.size[1]}`;
  }
}
