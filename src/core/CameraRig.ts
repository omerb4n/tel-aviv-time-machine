import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, easeInOutCubic } from './math';

export type GroundFn = (x: number, z: number) => number;

/**
 * Observer camera: orbit / pan / zoom from above, cinematic fly-to for tours,
 * and a street-level walking mode (drag to look, WASD to walk).
 */
export class CameraRig {
  readonly controls: OrbitControls;
  mode: 'orbit' | 'street' = 'orbit';
  private fly?: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number; done?: () => void };
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private last = { x: 0, y: 0 };
  onModeChange?: (mode: 'orbit' | 'street') => void;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private ground: GroundFn,
  ) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.47;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 3200;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = false;
    this.controls.keys = { LEFT: '', UP: '', RIGHT: '', BOTTOM: '' };

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'Escape' && this.mode === 'street') this.setMode('orbit');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'street') return;
      this.dragging = true;
      this.last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('pointermove', (e) => {
      if (this.mode !== 'street' || !this.dragging) return;
      this.yaw -= (e.clientX - this.last.x) * 0.0032;
      this.pitch = clamp(this.pitch - (e.clientY - this.last.y) * 0.0032, -1.2, 1.2);
      this.last = { x: e.clientX, y: e.clientY };
    });
  }

  get busy() {
    return !!this.fly;
  }

  flyTo(pos: THREE.Vector3Like, target: THREE.Vector3Like, seconds = 2.5, done?: () => void) {
    if (this.mode === 'street') this.setMode('orbit', false);
    this.controls.enabled = false;
    this.fly = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: new THREE.Vector3(pos.x, pos.y, pos.z),
      t1: new THREE.Vector3(target.x, target.y, target.z),
      t: 0,
      dur: seconds,
      done,
    };
  }

  setMode(mode: 'orbit' | 'street', animate = true) {
    if (mode === this.mode) return;
    this.fly = undefined;
    if (mode === 'street') {
      const t = this.controls.target;
      const dir = new THREE.Vector3().subVectors(t, this.camera.position).setY(0).normalize();
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = 0.05;
      const eye = new THREE.Vector3(t.x, this.ground(t.x, t.z) + 1.7, t.z);
      const look = eye.clone().addScaledVector(dir, 10);
      this.controls.enabled = false;
      const enter = () => (this.mode = 'street');
      if (animate) this.fly = { p0: this.camera.position.clone(), t0: t.clone(), p1: eye, t1: look, t: 0, dur: 1.8, done: enter };
      else {
        this.camera.position.copy(eye);
        enter();
      }
      this.onModeChange?.('street');
      return;
    }
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.setY(0).normalize();
    const target = this.camera.position.clone().addScaledVector(fwd, 40);
    target.y = 0;
    this.controls.target.copy(target);
    this.camera.position.addScaledVector(fwd, -30).y += 35;
    this.mode = 'orbit';
    this.controls.enabled = true;
    this.onModeChange?.('orbit');
  }

  update(dt: number) {
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = easeInOutCubic(Math.min(1, f.t / f.dur));
      // Arc upward mid-flight for a more cinematic move.
      const lift = Math.sin(Math.PI * k) * Math.min(220, f.p0.distanceTo(f.p1) * 0.25);
      this.camera.position.lerpVectors(f.p0, f.p1, k).y += lift;
      this.controls.target.lerpVectors(f.t0, f.t1, k);
      this.camera.lookAt(this.controls.target);
      if (f.t >= f.dur) {
        this.fly = undefined;
        f.done?.();
        if (this.mode === 'orbit') this.controls.enabled = true;
      }
      return;
    }
    if (this.mode === 'street') {
      const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 16 : 5) * dt;
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const p = this.camera.position;
      if (this.keys.has('KeyW')) p.addScaledVector(fwd, speed);
      if (this.keys.has('KeyS')) p.addScaledVector(fwd, -speed);
      if (this.keys.has('KeyA')) p.addScaledVector(right, -speed);
      if (this.keys.has('KeyD')) p.addScaledVector(right, speed);
      p.y = this.ground(p.x, p.z) + 1.7;
      const look = new THREE.Vector3(
        p.x - Math.sin(this.yaw) * Math.cos(this.pitch),
        p.y + Math.sin(this.pitch),
        p.z - Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.camera.lookAt(look);
      return;
    }
    this.controls.update();
    // keep the focus point inside the modelled area and the camera above ground
    const t = this.controls.target;
    t.x = clamp(t.x, -2200, 3200);
    t.z = clamp(t.z, -3200, 1600);
    const c = this.camera.position;
    const minY = this.ground(c.x, c.z) + 2;
    if (c.y < minY) c.y = minY;
  }

  /** Approximate viewing distance (for shadow frustum, LOD of labels). */
  get distance() {
    return this.mode === 'street' ? 60 : this.camera.position.distanceTo(this.controls.target);
  }

  get focus(): THREE.Vector3 {
    return this.mode === 'street' ? this.camera.position : this.controls.target;
  }
}
