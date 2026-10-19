// Единый фасад платформы: в приложении — Capacitor, в браузере — веб-API или ничего.
import { native } from './native.js';

let wakeLock = null;

export const platform = {
  isNative: false,

  async init() {
    this.isNative = !!(native && window.Capacitor?.isNativePlatform?.() && native.available());
    if (this.isNative) await native.init();
  },

  impact(kind) {
    if (this.isNative) native.impact(kind);
  },

  vibrate(ms) {
    if (this.isNative) native.vibrate(ms);
  },

  async battery() {
    if (this.isNative) return native.battery();
    try {
      if (navigator.getBattery) return (await navigator.getBattery()).level;
    } catch {
      // нет доступа
    }
    return null;
  },

  async keepAwake() {
    if (this.isNative) return;
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) || null;
      wakeLock?.addEventListener?.('release', () => { wakeLock = null; });
    } catch {
      wakeLock = null;
    }
  },

  // Работают ли настоящие уведомления (только в приложении).
  get canNotify() {
    return this.isNative;
  },

  async notifyPermission() {
    return this.isNative ? native.notifyPermission() : false;
  },

  async schedule(list) {
    if (this.isNative) await native.schedule(list);
  },

  async cancelNotifications(ids) {
    if (this.isNative) await native.cancel(ids);
  },

  async setBrightness(v) {
    if (this.isNative) await native.setBrightness(v);
  },

  async restoreBrightness() {
    if (this.isNative) await native.restoreBrightness();
  },

  // cb(true) — вернулись в игру, cb(false) — свернули.
  onState(cb) {
    if (this.isNative) {
      native.onState(cb);
      return;
    }
    document.addEventListener('visibilitychange', () => {
      const visible = document.visibilityState === 'visible';
      if (visible && wakeLock === null) this.keepAwake();
      cb(visible);
    });
  },

  onBack(cb) {
    if (this.isNative) native.onBack(cb);
  },

  async saveImage(dataUrl, fileName) {
    if (this.isNative) await native.saveImage(dataUrl, fileName);
  },
};
