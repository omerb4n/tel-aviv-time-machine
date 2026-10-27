import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * The "time lens": composites a frozen snapshot of one year (outside a circle) with the
 * live scene in another year (inside it). A growing circle is a time slip; a small,
 * held circle is a peek. The edge glows and refracts like a lens.
 */
export class TimeWipePass extends Pass {
  /** Circle radius in screen heights; 0 = effect off (plain pass-through). */
  radius = 0;
  /** Circle centre in UV space. */
  center = new THREE.Vector2(0.5, 0.5);
  private captureNext = false;
  private snapshot: THREE.WebGLRenderTarget;
  private copy: FullScreenQuad;
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  private copyMat: THREE.ShaderMaterial;

  constructor(w: number, h: number) {
    super();
    this.snapshot = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.copyMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`,
      depthTest: false,
      depthWrite: false,
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tSnap: { value: this.snapshot.texture },
        uRadius: { value: 0 },
        uCenter: { value: this.center },
        uAspect: { value: w / h },
        uTime: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new FullScreenQuad(this.copyMat);
    this.quad = new FullScreenQuad(this.mat);
  }

  /** Freeze the next rendered frame as the "old" year. */
  capture() {
    this.captureNext = true;
  }

  get capturing() {
    return this.captureNext;
  }

  setSize(w: number, h: number) {
    this.snapshot.setSize(w, h);
    this.mat.uniforms.uAspect.value = w / h;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (this.captureNext) {
      this.copyMat.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.snapshot);
      this.copy.render(renderer);
      this.captureNext = false;
    }
    const u = this.mat.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.uRadius.value = this.radius;
    u.uTime.value = performance.now() / 1000;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.radius <= 0 || this.radius >= 2) {
      this.copyMat.uniforms.tDiffuse.value = readBuffer.texture;
      this.copy.render(renderer);
    } else this.quad.render(renderer);
  }

  dispose() {
    this.snapshot.dispose();
    this.copy.dispose();
    this.quad.dispose();
  }
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse, tSnap;
  uniform float uRadius, uAspect, uTime;
  uniform vec2 uCenter;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
    float d = length(p);
    float r = uRadius;
    // wobbling rim
    float a = atan(p.y, p.x);
    r += 0.006 * sin(a * 7.0 + uTime * 3.0) + 0.004 * sin(a * 13.0 - uTime * 5.0);
    float inside = smoothstep(r + 0.004, r - 0.004, d);
    float rim = exp(-abs(d - r) * 90.0);
    // lens refraction close to the rim
    vec2 dir = d > 0.0 ? p / d : vec2(0.0);
    vec2 off = dir * rim * 0.035 / vec2(uAspect, 1.0);
    vec3 live = texture2D(tDiffuse, vUv - off).rgb;
    vec3 snap = texture2D(tSnap, vUv + off * 0.5).rgb;
    vec3 col = mix(snap, live, inside);
    // golden glow along the rim, plus a soft inner light
    col += vec3(1.0, 0.78, 0.45) * rim * 0.9;
    col += vec3(1.0, 0.85, 0.6) * inside * exp(-(r - d) * 22.0) * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;
