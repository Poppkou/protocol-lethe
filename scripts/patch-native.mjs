// Добавляет нативным проектам разрешения и описания, без которых игра не получит
// микрофон, камеру, уведомления и вибрацию. Запускается после `cap add android|ios`
// (это делают команды npm run android:init / ios:init). Повторный запуск безопасен.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

function patchAndroid() {
  const file = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(file)) throw new Error('Нет android/. Сначала выполните: npx cap add android');
  let xml = fs.readFileSync(file, 'utf8');
  const lines = [
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  ];
  const missing = lines.filter((l) => !xml.includes(l.match(/android:name="([^"]+)"/)[1]));
  if (missing.length) xml = xml.replace('</manifest>', `    ${missing.join('\n    ')}\n</manifest>`);
  // только портретная ориентация
  if (!xml.includes('android:screenOrientation')) {
    xml = xml.replace(/<activity\b/, '<activity android:screenOrientation="portrait"');
  }
  fs.writeFileSync(file, xml);
  console.log(`Android: добавлено разрешений — ${missing.length}.`);
}

function patchIOS() {
  const file = path.join(root, 'ios/App/App/Info.plist');
  if (!fs.existsSync(file)) throw new Error('Нет ios/. Сначала выполните: npx cap add ios');
  let plist = fs.readFileSync(file, 'utf8');
  const keys = {
    NSMicrophoneUsageDescription: 'Игра слушает ваше дыхание и тишину. Звук не записывается и никуда не отправляется.',
    NSCameraUsageDescription: 'На долю секунды игра покажет вам ваше отражение. Кадры не сохраняются.',
    NSPhotoLibraryAddUsageDescription: 'В одной из концовок игра оставит в галерее одну фотографию.',
    NSPhotoLibraryUsageDescription: 'В одной из концовок игра оставит в галерее одну фотографию. Чужие фото игра не читает.',
    NSMotionUsageDescription: 'Игра реагирует на наклон телефона.',
  };
  let added = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (plist.includes(`<key>${k}</key>`)) continue;
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t<string>${v}</string>\n</dict>\n</plist>\n`);
    added++;
  }
  if (!plist.includes('<key>UIStatusBarHidden</key>')) {
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>UIStatusBarHidden</key>\n\t<true/>\n</dict>\n</plist>\n');
  }
  fs.writeFileSync(file, plist);
  console.log(`iOS: добавлено описаний разрешений — ${added}.`);
}

try {
  if (target === 'android') patchAndroid();
  else if (target === 'ios') patchIOS();
  else throw new Error('Укажите платформу: node scripts/patch-native.mjs android|ios');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
