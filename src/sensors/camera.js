// Фронтальная камера на долю секунды. Кадры никуда не сохраняются,
// поток выключается сразу после показа.
import { h, sleep, until } from '../core/dom.js';

export async function cameraFlash(container, { ms = 420, overlay, signal } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 } },
      audio: false,
    });
  } catch {
    return false;
  }
  try {
    const video = h('video', { class: 'cam-video', playsinline: true, autoplay: true });
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const wrap = h('div', { class: 'cam-wrap' }, video, overlay || null);
    container.append(wrap);
    await video.play().catch(() => {});
    await until(() => video.readyState >= 2 && video.videoWidth > 0, { timeout: 2500, signal });
    // даём камере подстроить экспозицию, пока кадр скрыт
    await sleep(700, signal);
    wrap.classList.add('show');
    await sleep(ms, signal);
    wrap.remove();
    return true;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
