import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, easeInOutCubic } from './math';

export type GroundFn = (x: number, z: number) => number;

/** Eye height when walking, and the highest the walker can rise (above the ground). */
export const EYE = 1.7;
export const MAX_LIFT = 120;

/**
 * Observer camera: orbit / pan / zoom from above, cinematic fly-to for tours,
 * and a street-level walking mode (drag to look, WASD to walk). With a mouse, one click
 * captures it and looking follows the mouse with no button held (Esc frees it). At street
 * level the walker can also rise above the roofs and come down again (R / F).
 */
export class CameraRig {
  readonly controls: OrbitControls;
  mode: 'orbit' | 'street' = 'orbit';
  private fly?: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number; done?: () => void };
  private keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  private dragId = -1;
  private last = { x: 0, y: 0 };
  /** Analogue input from touch controls: x = strafe, y = forward, up = rise, each in [-1, 1]. */
  readonly moveInput = { x: 0, y: 0, up: 0 };
  /** Eye height above the ground at street level: EYE when walking, more when risen. */
  lift = EYE;
  /** Stay at street level (Esc does not fly up). Used by the exploration game. */
  lockStreet = false;
  /** When false, walking and looking are ignored (dialogs, peeking). */
  inputEnabled = true;
  /** Optional collision test for walking, at an eye height above the ground. */
  collide?: (x: number, z: number, eye: number) => boolean;
  onModeChange?: (mode: 'orbit' | 'street') => void;
  /** Click to capture the mouse for looking (a computer with a mouse, not touch). */
  mouseLook = matchMedia('(pointer: fine)').matches;
  /** Called when the mouse is captured for looking or freed. */
  onLookChange?: (looking: boolean) => void;
  private freedAt = -1e9;
  private capturedAt = -1e9;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
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
      if (e.code === 'Escape' && this.mode === 'street' && !this.lockStreet && !this.escFreedMouse) this.setMode('orbit');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'street' || this.dragId !== -1 || this.looking) return;
      this.dragId = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.dragId) this.dragId = -1;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    document.addEventListener('pointerlockchange', () => {
      if (!this.looking) this.freedAt = performance.now();
      this.capturedAt = performance.now();
      this.onLookChange?.(this.looking);
    });
    window.addEventListener('pointermove', (e) => {
      if (this.looking) {
        // browsers can report one wild jump just after capturing the mouse
        if (!this.inputEnabled || performance.now() - this.capturedAt < 120 || Math.abs(e.movementX) + Math.abs(e.movementY) > 400) return;
        this.yaw -= e.movementX * 0.0022;
        this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.2, 1.2);
        return;
      }
      if (this.mode !== 'street' || e.pointerId !== this.dragId) return;
      if (!this.inputEnabled) {
        this.last = { x: e.clientX, y: e.clientY };
        return;
      }
      const k = e.pointerType === 'touch' ? 0.0055 : 0.0032;
      this.yaw -= (e.clientX - this.last.x) * k;
      this.pitch = clamp(this.pitch - (e.clientY - this.last.y) * k, -1.2, 1.2);
      this.last = { x: e.clientX, y: e.clientY };
    });
  }

  /** The mouse is captured: moving it looks around. */
  get looking() {
    return !!this.dom && document.pointerLockElement === this.dom;
  }

  /**
   * True right after Esc freed a captured mouse. Browsers use that Esc to free it, so it should
   * not also open a menu or leave the street.
   */
  get escFreedMouse() {
    // browsers differ on whether that Esc arrives before or after the mouse is freed
    return this.looking || performance.now() - this.freedAt < 250;
  }

  /** A click with the mouse at street level should capture it rather than act. */
  wantsCapture(e: PointerEvent) {
    return e.pointerType === 'mouse' && this.mouseLook && this.inputEnabled && this.mode === 'street' && !this.fly && !this.looking;
  }

  captureMouse() {
    if (this.looking || !this.dom.requestPointerLock) return;
    try {
      const r = this.dom.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => undefined);
    } catch {
      // not allowed here (no user gesture, or an embedded frame): drag to look instead
    }
  }

  freeMouse() {
    if (this.looking) document.exitPointerLock();
  }

  /** Jump straight to a street-level pose (`lift`: eye height above the ground). */
  teleport(x: number, z: number, yaw: number, pitch = 0.04, lift = EYE) {
    this.fly = undefined;
    this.controls.enabled = false;
    this.lift = lift;
    this.camera.position.set(x, this.ground(x, z) + lift, z);
    this.yaw = yaw;
    this.pitch = pitch;
    if (this.mode !== 'street') {
      this.mode = 'street';
      this.onModeChange?.('street');
    }
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
      this.lift = EYE;
      const eye = new THREE.Vector3(t.x, this.ground(t.x, t.z) + EYE, t.z);
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
    // dialogs, peeks and flying up give the mouse back
    if (this.looking && (!this.inputEnabled || this.mode !== 'street' || this.fly)) this.freeMouse();
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
      if (this.inputEnabled) {
        const k = this.keys;
        let f = this.moveInput.y + (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        let r = this.moveInput.x + (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        const len = Math.hypot(f, r);
        if (len > 1) {
          f /= len;
          r /= len;
        }
        const mx = (fwd.x * f + right.x * r) * speed;
        const mz = (fwd.z * f + right.z * r) * speed;
        const hit = (x: number, z: number, eye = this.lift) => !!this.collide?.(x, z, eye);
        // slide along walls: try each axis separately (and never trap someone already inside)
        const free = hit(p.x, p.z);
        if (free || !hit(p.x + mx, p.z)) p.x += mx;
        if (free || !hit(p.x, p.z + mz)) p.z += mz;
        // rise and come down; land on a roof rather than sink into the building
        const u = clamp(this.moveInput.up + (k.has('KeyR') || k.has('PageUp') ? 1 : 0) - (k.has('KeyF') || k.has('PageDown') ? 1 : 0), -1, 1);
        if (u) {
          const next = clamp(this.lift + u * (k.has('ShiftLeft') || k.has('ShiftRight') ? 24 : 7) * dt, EYE, MAX_LIFT);
          if (u > 0 || free || !hit(p.x, p.z, next)) this.lift = next;
        }
      }
      p.y = this.ground(p.x, p.z) + this.lift;
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
