// Словарь вибраций: тик, сердце, стук, скрежет, дождь, обрыв.
// Приложение → Capacitor Haptics; Android-браузер → navigator.vibrate;
// без вибрации (iPhone в браузере) → низкий «ощущаемый» звук и микротряска экрана.

export class Haptics {
  constructor(platform, audio) {
    this.p = platform;
    this.audio = audio;
    this.web = false;
    this.timers = new Set();
    this.heartT = null;
    this.rainT = null;
    this.bpm = 60;
    this.shakeEl = null;
  }

  // Вызывать из обработчика нажатия: проверяет, разрешена ли вибрация.
  probe() {
    if (this.p.isNative) return true;
    try {
      this.web = typeof navigator.vibrate === 'function' && navigator.vibrate(1) === true;
    } catch {
      this.web = false;
    }
    return this.web;
  }

  get can() {
    return this.p.isNative || this.web;
  }

  later(ms, fn) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  impact(kind = 'light') {
    if (this.p.isNative) this.p.impact(kind);
    else if (this.web) navigator.vibrate(kind === 'heavy' ? 45 : kind === 'medium' ? 25 : 10);
  }

  tick() {
    this.impact('light');
  }

  // «Лаб-дап»: два удара, второй слабее.
  lubdub(strength = 1, { sound = true } = {}) {
    if (this.p.isNative) {
      this.p.impact('heavy');
      this.later(130, () => this.p.impact('medium'));
    } else if (this.web) {
      navigator.vibrate([45, 100, 28]);
    } else {
      this.shake(2 * strength);
    }
    if (sound) this.audio.heartSound(strength);
  }

  heartStart(bpm = 60, opts = {}) {
    this.heartStop();
    this.bpm = bpm;
    const beat = () => {
      this.lubdub(opts.strength ?? 0.8, opts);
      this.heartT = setTimeout(beat, 60000 / this.bpm);
    };
    beat();
  }

  heartBpm(bpm) {
    this.bpm = bpm;
  }

  heartStop() {
    clearTimeout(this.heartT);
    this.heartT = null;
  }

  get heartOn() {
    return this.heartT !== null;
  }

  // Три жёстких удара. На деревянном столе вибромотор даёт настоящий звук в комнате.
  knock(n = 3, gap = 400, { sound = true, pos } = {}) {
    for (let i = 0; i < n; i++) {
      this.later(i * gap, () => {
        if (this.p.isNative) this.p.impact('heavy');
        else if (this.web) navigator.vibrate(60);
        else this.shake(4);
        if (sound) this.audio.knock(pos);
      });
    }
  }

  // Скрежет когтей по стеклу: частая шершавая вибрация.
  scrape(ms = 1200, { sound = true } = {}) {
    if (this.p.isNative) {
      this.p.vibrate(ms);
      for (let t = 0; t < ms; t += 45) this.later(t, () => this.p.impact('light'));
    } else if (this.web) {
      const pattern = [];
      for (let t = 0; t < ms; t += 18) pattern.push(8 + Math.round(Math.random() * 6), 6 + Math.round(Math.random() * 8));
      navigator.vibrate(pattern);
    } else {
      this.shake(3, ms);
    }
    if (sound) this.audio.scrapeSound(ms / 1000);
  }

  rain(on) {
    clearInterval(this.rainT);
    this.rainT = null;
    if (on && this.can) this.rainT = setInterval(() => { if (Math.random() < 0.35) this.impact('light'); }, 140);
  }

  // Обрыв: всё замолкает.
  stop() {
    this.heartStop();
    this.rain(false);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    try {
      if (this.web) navigator.vibrate(0);
    } catch {
      // ignore
    }
  }

  // Визуальная замена вибрации.
  shake(px = 3, ms = 160) {
    const el = this.shakeEl;
    if (!el) return;
    el.style.setProperty('--shake', `${px}px`);
    el.classList.remove('shaking');
    void el.offsetWidth;
    el.classList.add('shaking');
    this.later(ms, () => el.classList.remove('shaking'));
  }
}
