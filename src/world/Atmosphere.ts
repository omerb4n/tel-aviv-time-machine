import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clamp, lerp, smoothstep } from '../core/math';

/**
 * Sun, sky, fog and ambient light for a given hour of the day.
 * Also produces the PMREM environment used for reflections on glass and sea.
 */
export class Atmosphere {
  readonly sky = new Sky();
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly hemi = new THREE.HemisphereLight(0xbcd6ff, 0x9c8a6a, 0.8);
  readonly fog = new THREE.FogExp2(0xcfd8e0, 0.00028);
  /** 0 = full day, 1 = full night. */
  night = 0;
  sunDir = new THREE.Vector3();
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envRT?: THREE.WebGLRenderTarget;
  private lastEnvHour = -99;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
  ) {
    this.sky.scale.setScalar(30000);
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const cam = this.sun.shadow.camera;
    cam.left = -420;
    cam.right = 420;
    cam.top = 420;
    cam.bottom = -420;
    cam.near = 10;
    cam.far = 2500;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sky, this.sun, this.sun.target, this.hemi);
    scene.fog = this.fog;
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** hour: 0–24 local solar time; haze: 0–1 era mood. */
  set(hour: number, haze: number) {
    // Simple solar path for Tel Aviv: sunrise ~6, noon elevation ~62°, sunset ~18.
    const dayT = (hour - 6) / 12;
    const elevation = Math.sin(Math.PI * dayT) * 62;
    const azimuth = lerp(75, 285, clamp(dayT, -0.2, 1.2));
    const e = THREE.MathUtils.degToRad(elevation);
    const a = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'] as const)
      this.envSky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    this.sky.material.uniforms.turbidity.value = 5 + haze * 8;

    const day = smoothstep(-6, 8, elevation);
    const golden = 1 - smoothstep(4, 30, elevation);
    this.night = 1 - smoothstep(-8, 2, elevation);
    const sunColor = new THREE.Color('#fff4e3').lerp(new THREE.Color('#ffae6b'), golden * day);
    this.sun.color.copy(sunColor);
    this.sun.intensity = 3.2 * day;
    this.hemi.intensity = lerp(0.12, 0.9, day);
    this.hemi.color.set('#bcd6ff').lerp(new THREE.Color('#2a3a5c'), this.night);
    this.hemi.groundColor.set('#a08c6a').lerp(new THREE.Color('#1a1814'), this.night);

    const horizon = new THREE.Color('#cdd9e3').lerp(new THREE.Color('#f0c39a'), golden * day * 0.7).lerp(new THREE.Color('#0d1424'), this.night);
    horizon.lerp(new THREE.Color('#d8c8a8'), haze * 0.35 * day);
    this.fog.color.copy(horizon);
    this.fog.density = 0.00018 + haze * 0.00028;
    this.renderer.toneMappingExposure = lerp(0.35, 0.62, day);

    if (Math.abs(hour - this.lastEnvHour) > 0.25) {
      this.lastEnvHour = hour;
      this.envRT?.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = lerp(0.08, 0.6, day);
    }
  }

  /** Keep the shadow frustum centred on what the viewer is looking at. */
  follow(target: THREE.Vector3, distance: number) {
    const ext = clamp(distance * 0.9, 160, 900);
    const cam = this.sun.shadow.camera;
    if (Math.abs(cam.right - ext) > 20) {
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.updateProjectionMatrix();
    }
    // Snap to shadow texels to avoid shimmering while moving.
    const texel = (2 * ext) / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    const dir = this.sunDir.y > 0.05 ? this.sunDir : new THREE.Vector3(0.3, 0.8, 0.2).normalize();
    this.sun.position.set(tx + dir.x * 1200, dir.y * 1200, tz + dir.z * 1200);
  }
}
