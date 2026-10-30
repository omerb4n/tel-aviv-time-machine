import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Temporal anti-aliasing with upsampling (TAAU), in place of MSAA.
 *
 * The scene is drawn at `scale` × the output size with a sub-pixel (Halton) jitter. A resolve
 * pass at full output size reprojects last frame's history through the depth buffer and the
 * previous camera, clamps it to the current frame's neighbourhood (so moving people and cars
 * don't smear), and blends. A light contrast-adaptive sharpen then writes the result on.
 *
 * Only the camera's motion is reprojected; the world itself is a function of the year and
 * stands still, which is what makes this cheap.
 */
export class TAAPass extends Pass {
  /** Render scale of the scene, 0.5–1 of the output size. */
  scale = 1;
  /** 0–1: how much the final sharpen pass bites. */
  sharpness = 0.35;
  private w = 1;
  private h = 1;
  private sceneRT: THREE.WebGLRenderTarget;
  private hist: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private cur = 0;
  private valid = false;
  private index = 0;
  private resolveMat: THREE.ShaderMaterial;
  private sharpenMat: THREE.ShaderMaterial;
  private resolve: FullScreenQuad;
  private sharpen: FullScreenQuad;
  private proj = new THREE.Matrix4();
  private prevViewProj = new THREE.Matrix4();
  private prevPos = new THREE.Vector3();
  private prevProj = new THREE.Matrix4();

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    super();
    const depthTexture = new THREE.DepthTexture(1, 1);
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture });
    const hist = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.hist = [hist(), hist()];
    this.resolveMat = new THREE.ShaderMaterial({
      uniforms: {
        tCur: { value: this.sceneRT.texture },
        tDepth: { value: depthTexture },
        tHist: { value: null },
        uCurSize: { value: new THREE.Vector2(1, 1) },
        uJitter: { value: new THREE.Vector2() },
        uProj: { value: new THREE.Vector4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uPrevViewProj: { value: new THREE.Matrix4() },
        uLogFar: { value: 1 },
        uValid: { value: 0 },
        uAlpha: { value: 0.1 },
      },
      vertexShader: VERT,
      fragmentShader: RESOLVE,
      depthTest: false,
      depthWrite: false,
    });
    this.sharpenMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uSharp: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: SHARPEN,
      depthTest: false,
      depthWrite: false,
    });
    this.resolve = new FullScreenQuad(this.resolveMat);
    this.sharpen = new FullScreenQuad(this.sharpenMat);
  }

  /** Size of the scene buffer for the current scale. */
  get renderSize(): [number, number] {
    return [Math.max(1, Math.round(this.w * this.scale)), Math.max(1, Math.round(this.h * this.scale))];
  }

  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (const t of this.hist) t.setSize(w, h);
    this.applyScale();
    this.reset();
  }

  setScale(s: number) {
    if (s === this.scale) return;
    this.scale = s;
    this.applyScale();
  }

  private applyScale() {
    const [rw, rh] = this.renderSize;
    if (this.sceneRT.width !== rw || this.sceneRT.height !== rh) this.sceneRT.setSize(rw, rh);
  }

  /** Forget the history: the next frame is drawn unjittered and taken as it is. */
  reset() {
    this.valid = false;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    const cam = this.camera;
    const [rw, rh] = this.renderSize;
    cam.updateMatrixWorld();
    this.proj.copy(cam.projectionMatrix);
    // a cut (teleport, a new projection) leaves nothing worth reprojecting
    if (this.valid && (cam.position.distanceToSquared(this.prevPos) > 100 || !sameProjection(this.proj, this.prevProj))) this.valid = false;

    const jx = this.valid ? halton(this.index + 1, 2) - 0.5 : 0;
    const jy = this.valid ? halton(this.index + 1, 3) - 0.5 : 0;
    this.index = (this.index + 1) % 16;
    const P = cam.projectionMatrix.elements;
    P[8] += (jx * 2) / rw;
    P[9] += (jy * 2) / rh;
    renderer.setRenderTarget(this.sceneRT);
    renderer.clear();
    renderer.render(this.scene, cam);
    cam.projectionMatrix.copy(this.proj);

    const u = this.resolveMat.uniforms;
    const out = this.hist[this.cur];
    const prev = this.hist[1 - this.cur];
    const e = this.proj.elements;
    u.tHist.value = prev.texture;
    u.uCurSize.value.set(rw, rh);
    // the jitter moved everything by -jitter render pixels; sample back the other way
    u.uJitter.value.set(-jx / rw, -jy / rh);
    u.uProj.value.set(e[0], e[5], e[8], e[9]);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uPrevViewProj.value.copy(this.prevViewProj);
    u.uLogFar.value = Math.log2(cam.far + 1);
    u.uValid.value = this.valid ? 1 : 0;
    // fewer real samples per output pixel when upsampling: lean on history a little more
    u.uAlpha.value = 0.08 + 0.06 * this.scale;
    renderer.setRenderTarget(out);
    this.resolve.render(renderer);

    const s = this.sharpenMat.uniforms;
    s.tDiffuse.value = out.texture;
    s.uTexel.value.set(1 / this.w, 1 / this.h);
    s.uSharp.value = Math.min(1, this.sharpness + (1 - this.scale) * 0.6);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.sharpen.render(renderer);

    this.prevViewProj.multiplyMatrices(this.proj, cam.matrixWorldInverse);
    this.prevPos.copy(cam.position);
    this.prevProj.copy(this.proj);
    this.cur = 1 - this.cur;
    this.valid = true;
  }

  dispose() {
    this.sceneRT.depthTexture?.dispose();
    this.sceneRT.dispose();
    for (const t of this.hist) t.dispose();
    this.resolve.dispose();
    this.sharpen.dispose();
  }
}

function halton(i: number, b: number) {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}

function sameProjection(a: THREE.Matrix4, b: THREE.Matrix4) {
  const x = a.elements;
  const y = b.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(x[i] - y[i]) > 1e-5) return false;
  return true;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const RESOLVE = /* glsl */ `
  uniform sampler2D tCur, tDepth, tHist;
  uniform vec2 uCurSize, uJitter;
  uniform vec4 uProj; // P00, P11, P20, P21 of the unjittered projection
  uniform mat4 uCamWorld, uPrevViewProj;
  uniform float uLogFar, uValid, uAlpha;
  varying vec2 vUv;

  // work in a tone-mapped space so bright sun glints don't flicker
  vec3 toLDR(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
  vec3 toHDR(vec3 c) { return c / max(1e-4, 1.0 - max(c.r, max(c.g, c.b))); }
  vec3 toYCoCg(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
  vec3 fromYCoCg(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }

  // 9-tap Catmull-Rom in 5 bilinear fetches: sharp upsampling of the scene buffer
  vec3 catmull(sampler2D t, vec2 uv, vec2 size) {
    vec2 p = uv * size;
    vec2 tc = floor(p - 0.5) + 0.5;
    vec2 f = p - tc;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 o12 = w2 / w12;
    vec2 t0 = (tc - 1.0) / size, t3 = (tc + 2.0) / size, t12 = (tc + o12) / size;
    vec3 c = texture2D(t, vec2(t12.x, t0.y)).rgb * w12.x * w0.y
           + texture2D(t, vec2(t0.x, t12.y)).rgb * w0.x * w12.y
           + texture2D(t, t12).rgb * w12.x * w12.y
           + texture2D(t, vec2(t3.x, t12.y)).rgb * w3.x * w12.y
           + texture2D(t, vec2(t12.x, t3.y)).rgb * w12.x * w3.y;
    float wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return max(c / wsum, 0.0);
  }

  void main() {
    vec2 uv = vUv + uJitter;
    vec2 texel = 1.0 / uCurSize;
    vec3 cur = toLDR(catmull(tCur, uv, uCurSize));

    // neighbourhood statistics (3x3) and the nearest depth (for crisp edges)
    vec3 m1 = vec3(0.0), m2 = vec3(0.0);
    float d = 1.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * texel;
      vec3 c = toYCoCg(toLDR(texture2D(tCur, uv + o).rgb));
      m1 += c; m2 += c * c;
      if (x == 0 || y == 0) d = min(d, texture2D(tDepth, uv + o).r);
    }
    m1 /= 9.0; m2 /= 9.0;
    vec3 sigma = sqrt(max(m2 - m1 * m1, 0.0));
    vec3 lo = m1 - sigma * 1.25, hi = m1 + sigma * 1.25;

    // logarithmic depth back to view space, then into last frame's screen
    float w = exp2(d * uLogFar) - 1.0;
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 view = vec3(w * (ndc.x + uProj.z) / uProj.x, w * (ndc.y + uProj.w) / uProj.y, -w);
    vec4 prev = uPrevViewProj * (uCamWorld * vec4(view, 1.0));
    vec2 puv = prev.xy / prev.w * 0.5 + 0.5;

    float alpha = uAlpha;
    if (uValid < 0.5 || prev.w <= 0.0 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0)))) alpha = 1.0;
    vec3 hist = toYCoCg(texture2D(tHist, puv).rgb);
    // clip the history towards the neighbourhood's centre
    vec3 c = m1, e = (hi - lo) * 0.5 + 1e-4;
    vec3 v = hist - c;
    vec3 a = abs(v / e);
    float k = max(a.x, max(a.y, a.z));
    if (k > 1.0) hist = c + v / k;
    vec3 col = mix(fromYCoCg(hist), cur, alpha);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Contrast-adaptive sharpen (after AMD CAS), back to linear HDR on the way out.
const SHARPEN = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uSharp;
  varying vec2 vUv;
  vec3 toHDR(vec3 c) { return c / max(1e-4, 1.0 - max(c.r, max(c.g, c.b))); }
  void main() {
    vec3 b = texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb;
    vec3 d = texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb;
    vec3 e = texture2D(tDiffuse, vUv).rgb;
    vec3 f = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
    vec3 h = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
    vec3 mn = min(e, min(min(b, d), min(f, h)));
    vec3 mx = max(e, max(max(b, d), max(f, h)));
    vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
    vec3 wgt = -amp * mix(0.125, 0.2, uSharp);
    vec3 col = (e + (b + d + f + h) * wgt) / (1.0 + 4.0 * wgt);
    gl_FragColor = vec4(toHDR(clamp(col, 0.0, 0.999)), 1.0);
  }
`;
