// Синтез речи браузера (Web Speech API). Голос Системы, Сони и человеческий голос.
// Если русского голоса в системе нет, реплики показываются только текстом.
import { speakable } from '../core/text.js';

export class TTS {
  constructor(params) {
    this.synth = window.speechSynthesis || null;
    this.enabled = true;
    this.voice = null;
    this.params = params;
    this.pickVoice();
    try {
      this.synth?.addEventListener?.('voiceschanged', () => this.pickVoice());
    } catch {
      // старые движки без событий
    }
  }

  pickVoice() {
    const all = this.synth?.getVoices?.() || [];
    const ru = all.filter((v) => /^ru/i.test(v.lang));
    this.voice = ru.find((v) => /milena|google|yandex|irina|katya/i.test(v.name)) || ru[0] || null;
  }

  get available() {
    if (!this.synth) return false;
    if (!this.voice) this.pickVoice();
    return !!this.voice;
  }

  // Вызывать из обработчика нажатия: iOS разрешает речь только после жеста.
  unlock() {
    if (!this.synth) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch {
      // не страшно
    }
  }

  speak(text, { who = 'system', signal, volume = 1, interrupt = false } = {}) {
    return new Promise((resolve) => {
      if (!this.enabled || !this.available) return resolve(false);
      const clean = speakable(text);
      if (!clean) return resolve(false);
      if (interrupt && this.synth.speaking) this.cancel();
      const p = this.params[who] || this.params.system;
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'ru-RU';
      u.voice = this.voice;
      u.rate = p.rate;
      u.pitch = p.pitch;
      u.volume = volume;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        clearInterval(keepAlive);
        resolve(true);
      };
      u.onend = finish;
      u.onerror = finish;
      const guard = setTimeout(finish, 2500 + (clean.length * 95) / p.rate);
      // Chrome иногда «засыпает» на длинных фразах
      const keepAlive = setInterval(() => { if (this.synth.paused) this.synth.resume(); }, 4000);
      signal?.addEventListener('abort', () => { this.cancel(); finish(); }, { once: true });
      this.synth.speak(u);
    });
  }

  cancel() {
    try {
      this.synth?.cancel();
    } catch {
      // ignore
    }
  }
}
