import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { TimeWipePass } from './TimeWipePass';

/**
 * "Period film" grading: sepia toning, desaturation, grain and vignette, driven by
 * the era. Applied after tone mapping so it behaves like a print, not like light.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSepia: { value: 0 },
    uSaturation: { value: 1 },
    uGrain: { value: 0 },
    uVignette: { value: 0.35 },
    uTime: { value: 0 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSepia, uSaturation, uGrain, uVignette, uTime, uFade;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 col = mix(vec3(l), c.rgb, uSaturation);
      vec3 sepia = vec3(l * 1.07 + 0.03, l * 0.93 + 0.01, l * 0.72);
      col = mix(col, sepia, uSepia);
      // faded print: lifted blacks, softened highlights
      col = mix(col, col * 0.9 + 0.05, uFade);
      col = (col - 0.5) * 1.06 + 0.5;
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      col += g * uGrain * 0.12;
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVignette * dot(d, d) * 1.6;
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export class PostFX {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  readonly wipe: TimeWipePass;
  readonly renderPass: RenderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.18, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.wipe = new TimeWipePass(size.x, size.y);
    this.composer.addPass(this.wipe);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  setMood(m: { sepia: number; grain: number; saturation: number }, filmOn: boolean, night: number, t: number) {
    const u = this.grade.uniforms;
    u.uSepia.value = filmOn ? m.sepia * 0.85 : 0;
    u.uSaturation.value = filmOn ? m.saturation : 1;
    u.uGrain.value = filmOn ? m.grain : 0.02;
    u.uFade.value = filmOn ? m.sepia * 0.35 : 0;
    u.uTime.value = t;
    this.bloom.strength = 0.15 + night * 0.65;
    this.bloom.threshold = 0.92 - night * 0.3;
  }

  render() {
    this.composer.render();
  }
}
