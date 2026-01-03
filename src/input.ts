import { clamp } from './math';

export type InputState = {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  webPressed: boolean;
  webReleased: boolean;
  webHeld: boolean;
  reelDelta: number;
  pointerX: number;
  pointerY: number;
  usingTouch: boolean;
};

type TouchId = number | null;

export class Input {
  state: InputState;
  private keys = new Set<string>();

  private joyTouchId: TouchId = null;
  private joyCenterX = 0;
  private joyCenterY = 0;
  private joyVecX = 0;
  private joyVecY = 0;

  private webTouchId: TouchId = null;
  private webLastY = 0;

  private jumpQueued = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private joyBase: HTMLElement,
    private joyStick: HTMLElement,
    private rightZone: HTMLElement
  ) {
    this.state = {
      moveX: 0, moveY: 0,
      jumpPressed: false,
      webPressed: false, webReleased: false, webHeld: false,
      reelDelta: 0,
      pointerX: 0, pointerY: 0,
      usingTouch: false
    };

    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'Space') this.jumpQueued = true; });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });

    window.addEventListener('mousedown', (e) => { if (e.button === 0) { this.state.webPressed = true; this.state.webHeld = true; } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { this.state.webReleased = true; this.state.webHeld = false; } });
    window.addEventListener('wheel', (e) => { this.state.reelDelta += clamp(e.deltaY / 600, -0.6, 0.6); }, { passive: true });

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      this.state.pointerX = x * 2 - 1;
      this.state.pointerY = -(y * 2 - 1);
    };
    window.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => { if (e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

    const onTouchStart = (e: TouchEvent) => {
      this.state.usingTouch = true;

      for (const t of Array.from(e.changedTouches)) {
        const target = t.target as HTMLElement | null;

        if (this.joyTouchId === null && (target === this.joyBase || this.joyBase.contains(target))) {
          this.joyTouchId = t.identifier;
          const r = this.joyBase.getBoundingClientRect();
          this.joyCenterX = r.left + r.width * 0.5;
          this.joyCenterY = r.top + r.height * 0.5;
          this.joyVecX = 0; this.joyVecY = 0;
          continue;
        }

        if (this.webTouchId === null && (target === this.rightZone || this.rightZone.contains(target))) {
          this.webTouchId = t.identifier;
          this.webLastY = t.clientY;
          this.state.webPressed = true;
          this.state.webHeld = true;
          continue;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyTouchId) {
          const dx = t.clientX - this.joyCenterX;
          const dy = t.clientY - this.joyCenterY;
          const max = 52;
          const nx = clamp(dx / max, -1, 1);
          const ny = clamp(dy / max, -1, 1);
          this.joyVecX = nx;
          this.joyVecY = ny;
          this.joyStick.style.transform = `translate(${nx * 36 - 32}px, ${ny * 36 - 32}px)`;
        }
        if (t.identifier === this.webTouchId) {
          const dy = t.clientY - this.webLastY;
          this.webLastY = t.clientY;
          this.state.reelDelta += clamp(dy / 250, -0.25, 0.25);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyTouchId) {
          this.joyTouchId = null;
          this.joyVecX = 0; this.joyVecY = 0;
          this.joyStick.style.transform = `translate(-32px, -32px)`;
        }
        if (t.identifier === this.webTouchId) {
          this.webTouchId = null;
          // Keep attach until next tap for arcade clarity
          this.state.webReleased = true;
          this.state.webHeld = false;
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  beginFrame() {
    this.state.webPressed = false;
    this.state.webReleased = false;
    this.state.jumpPressed = false;
    this.state.reelDelta = 0;

    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');

    let mx = 0, my = 0;
    if (left) mx -= 1;
    if (right) mx += 1;
    if (up) my += 1;
    if (down) my -= 1;

    if (this.state.usingTouch) {
      mx = this.joyVecX;
      my = -this.joyVecY;
    }

    const len = Math.hypot(mx, my);
    if (len > 1e-5) { mx /= Math.max(1, len); my /= Math.max(1, len); }

    this.state.moveX = mx;
    this.state.moveY = my;

    if (this.jumpQueued) {
      this.state.jumpPressed = true;
      this.jumpQueued = false;
    }
  }
}
