// Наклон телефона (гироскоп) и положение «экраном вниз».
// Если датчиков нет (компьютер, артефакт Claude), наклон заменяется движением пальца.
import { clamp } from '../core/dom.js';

export class Motion {
  constructor() {
    this.beta = null;
    this.gamma = null;
    this.t = 0;
    this.b0 = 45;
    this.g0 = 0;
    this.energy = 0;
    this.prevA = null;
    this.virtual = { x: 0, y: 0 };
    this.listening = false;
  }

  // На iOS разрешение на датчики можно спросить только по нажатию.
  async permission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        await DeviceOrientationEvent.requestPermission();
      }
      if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
        await DeviceMotionEvent.requestPermission();
      }
    } catch {
      // отказ — работаем с пальцем
    }
    this.listen();
  }

  listen() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null) return;
      this.beta = e.beta;
      this.gamma = e.gamma;
      this.t = performance.now();
    });
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      if (this.prevA) {
        const d = Math.abs(a.x - this.prevA.x) + Math.abs(a.y - this.prevA.y) + Math.abs(a.z - this.prevA.z);
        this.energy = this.energy * 0.85 + d * 0.15;
      }
      this.prevA = { x: a.x, y: a.y, z: a.z };
    });
  }

  get live() {
    return this.beta != null && performance.now() - this.t < 1200;
  }

  calibrate() {
    if (this.live) {
      this.b0 = this.beta;
      this.g0 = this.gamma;
    }
    this.virtual = { x: 0, y: 0 };
  }

  // Наклон относительно исходного положения: x, y в диапазоне -1..1.
  tilt() {
    if (this.live) {
      return {
        x: clamp((this.gamma - this.g0) / 25, -1, 1),
        y: clamp((this.beta - this.b0) / 25, -1, 1),
      };
    }
    return this.virtual;
  }

  get faceDown() {
    return this.live && Math.abs(this.beta) > 140 && Math.abs(this.gamma) < 40;
  }

  // Палец как замена наклону: ведите по элементу, позиция становится наклоном.
  attachVirtual(el) {
    let active = false;
    let start = null;
    let base = null;
    const down = (e) => {
      active = true;
      start = { x: e.clientX, y: e.clientY };
      base = { ...this.virtual };
    };
    const move = (e) => {
      if (!active) return;
      const r = el.getBoundingClientRect();
      this.virtual = {
        x: clamp(base.x + ((e.clientX - start.x) / r.width) * 2.2, -1, 1),
        y: clamp(base.y + ((e.clientY - start.y) / r.height) * 2.2, -1, 1),
      };
    };
    const up = () => { active = false; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }
}
