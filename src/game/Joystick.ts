/** On-screen thumb stick for touch devices. Writes into `out` ({x: strafe, y: forward}). */
export class Joystick {
  readonly el: HTMLElement;
  private knob: HTMLElement;
  private id = -1;
  private cx = 0;
  private cy = 0;

  constructor(
    parent: HTMLElement,
    private out: { x: number; y: number },
  ) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.el.append(this.knob);
    parent.append(this.el);
    const R = 46;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      let dx = e.clientX - this.cx;
      let dy = e.clientY - this.cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // small dead zone, then a gentle curve for fine control
      const k = (v: number) => Math.sign(v) * Math.max(0, Math.abs(v) / R - 0.12) / 0.88;
      this.out.x = k(dx);
      this.out.y = -k(dy);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      this.id = -1;
      this.out.x = 0;
      this.out.y = 0;
      this.knob.style.transform = '';
      this.el.classList.remove('on');
    };
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.id = e.pointerId;
      const r = this.el.getBoundingClientRect();
      this.cx = r.left + r.width / 2;
      this.cy = r.top + r.height / 2;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('on');
      move(e);
    });
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }
}
