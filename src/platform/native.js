// Нативные возможности через Capacitor (только в собранном приложении Android/iOS).
// В версии для телефона (один HTML-файл) этот модуль заменяется на native-stub.js.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { StatusBar } from '@capacitor/status-bar';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';
import { Media } from '@capacitor-community/media';

let savedBrightness = null;
const quiet = (p) => Promise.resolve(p).catch(() => {});

export const native = {
  available: () => Capacitor.isNativePlatform(),
  platform: () => Capacitor.getPlatform(),

  async init() {
    await quiet(StatusBar.hide());
    await quiet(KeepAwake.keepAwake());
  },

  impact(kind) {
    const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
    quiet(Haptics.impact({ style }));
  },

  vibrate(ms) {
    quiet(Haptics.vibrate({ duration: ms }));
  },

  async battery() {
    try {
      const b = await Device.getBatteryInfo();
      return typeof b.batteryLevel === 'number' ? b.batteryLevel : null;
    } catch {
      return null;
    }
  },

  async notifyPermission() {
    try {
      const r = await LocalNotifications.requestPermissions();
      return r.display === 'granted';
    } catch {
      return false;
    }
  },

  // list: [{ id, title, body, at: Date }]
  async schedule(list) {
    await quiet(LocalNotifications.schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
      })),
    }));
  },

  async cancel(ids) {
    await quiet(LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }));
  },

  async setBrightness(v) {
    try {
      if (savedBrightness == null) savedBrightness = (await ScreenBrightness.getBrightness()).brightness;
      await ScreenBrightness.setBrightness({ brightness: v });
    } catch {
      // не поддерживается
    }
  },

  async restoreBrightness() {
    if (savedBrightness == null) return;
    await quiet(ScreenBrightness.setBrightness({ brightness: savedBrightness }));
    savedBrightness = null;
  },

  onState(cb) {
    App.addListener('appStateChange', ({ isActive }) => cb(isActive));
  },

  onBack(cb) {
    App.addListener('backButton', cb);
  },

  // Фото добавляется в галерею (только запись — читать галерею игре не нужно).
  // На Android плагину нужен альбом, на iOS — нет.
  async saveImage(dataUrl, fileName) {
    try {
      let albumIdentifier;
      if (Capacitor.getPlatform() === 'android') {
        const name = 'Лета';
        let album = (await Media.getAlbums()).albums.find((a) => a.name === name);
        if (!album) {
          await Media.createAlbum({ name });
          album = (await Media.getAlbums()).albums.find((a) => a.name === name);
        }
        albumIdentifier = album?.identifier;
      }
      await Media.savePhoto({ path: dataUrl, fileName: fileName.replace(/\.\w+$/, ''), albumIdentifier });
    } catch {
      // нет разрешения — молча пропускаем
    }
  },
};
