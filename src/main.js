// Точка сборки игры: создаёт движок, контекст сцен и запускает режиссёра.
import { Director } from './core/director.js';
import { fmt } from './core/text.js';
import { h, sleep, until } from './core/dom.js';
import { freshState, loadSave, writeSave, runtime } from './core/state.js';
import { loadContent, fillMissing } from './core/content.js';
import { AudioEngine } from './audio/audio.js';
import { TTS } from './audio/tts.js';
import { Mic } from './sensors/mic.js';
import { Motion } from './sensors/motion.js';
import { Haptics } from './fx/haptics.js';
import { FX } from './fx/overlays.js';
import { lockScreen } from './fx/screens.js';
import { UI } from './ui/ui.js';
import { Author } from './ui/author.js';
import { platform } from './platform/platform.js';
import { SCENES } from './scenes/index.js';

const ttsParams = (C) => ({
  system: C.audio.ttsSystem,
  sonya: C.audio.ttsSonya,
  sonyaLow: { rate: C.audio.ttsSonya.rate * 0.85, pitch: C.audio.ttsSonya.pitch * 0.7 },
  human: C.audio.ttsHuman,
});

const readTime = (text) => Math.min(5200, 600 + text.length * 42);

// Скачивание файла в обычном браузере (в артефакте Claude используется его собственный механизм).
async function webDownload(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Реплика: печатается в окне Системы (или в el) и звучит голосом.
async function say(ctx, key, { vars, voice = true, who = 'system', hold, tone, el } = {}) {
  const text = ctx.T(key, vars);
  const typing = el ? ctx.ui.type(el, text, { signal: ctx.signal }) : ctx.ui.sysSay(text, { signal: ctx.signal, tone });
  const speaking = (async () => {
    if (voice && ctx.state.settings.tts) {
      if (ctx.C.audio.voiceFiles && (await ctx.audio.playFile(key))) return;
      if (await ctx.tts.speak(text, { who, signal: ctx.signal, interrupt: true })) return;
    }
    await ctx.wait(readTime(text));
  })();
  await Promise.all([typing, speaking]);
  await ctx.wait(hold ?? ctx.C.timing.afterLineMs);
}

export async function boot({ defaults, remote = false, publish = null, download = null }) {
  const root = document.getElementById('app');
  const ui = new UI(root);
  const fx = new FX(ui.fxCanvas, ui.stage);
  const audio = new AudioEngine();
  const loaded = await loadContent(defaults, { remote });
  const game = {
    defaults,
    base: fillMissing(loaded.base, defaults),
    draft: loaded.draft,
    C: null,
    saved: null,
    publish,
    download: download || webDownload,
  };
  game.C = loaded.draft ? fillMissing(loaded.draft, defaults) : game.base;
  const tts = new TTS(ttsParams(game.C));
  const mic = new Mic(audio);
  const motion = new Motion();
  await platform.init();
  const haptics = new Haptics(platform, audio);
  haptics.shakeEl = root;

  const hot = window.claude?.hot;
  const save = loadSave() || hot?.data?.state || null;
  let state = freshState(save?.settings);

  const applySettings = () => {
    tts.enabled = !!state.settings.tts;
    fx.lowFlash = !!state.settings.lowFlash || matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  applySettings();
  ui.typeMs = game.C.timing.typeMsPerChar;

  game.setContent = (C) => {
    game.C = fillMissing(C, defaults);
    tts.params = ttsParams(game.C);
    ui.typeMs = game.C.timing.typeMsPerChar;
  };

  // Звук, речь, вибрация и датчики включаются только из обработчика нажатия.
  let fullscreenAsked = false;
  const unlock = () => {
    audio.init();
    tts.unlock();
    haptics.probe();
    motion.permission();
    platform.keepAwake();
    runtime.canVibrate = haptics.can;
    platform.battery().then((b) => { if (b != null) ui.setBattery(b * 100); });
    if (!fullscreenAsked && !platform.isNative && matchMedia('(pointer: coarse)').matches) {
      fullscreenAsked = true;
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    }
  };

  let director;
  const enter = (ctx, scene) => {
    const env = typeof scene.env === 'function' ? scene.env(ctx) : scene.env || {};
    ui.clear();
    ui.setMode(env.mode || 'system');
    ui.showStatus(!!env.status);
    ui.setSession(env.session ? game.C.meta.session : '');
    ui.setTemp(env.temp ? game.C.lines['dirt.tempShort'] : null);
    fx.setInk(env.ink ?? 0);
    fx.grain = env.grain ?? 0;
    if (audio.ready) {
      audio.hum(env.hum !== false);
      audio.ticker(!!env.ticker);
    }
    if (env.drain) ctx.every(env.drain, () => { if (ui.battery > 4) ui.setBattery(ui.battery - 1); });
    if (!scene.noSave) {
      state.scene = scene.id;
      writeSave(state);
    }
  };

  const makeCtx = (signal, scene) => {
    const cleanups = [];
    const ctx = {
      signal,
      scene,
      director,
      game,
      ui,
      fx,
      audio,
      tts,
      mic,
      motion,
      haptics,
      platform,
      rt: runtime,
      get C() { return game.C; },
      get state() { return state; },
      T: (key, vars) => fmt(game.C.lines[key] ?? key, state, vars),
      wait: (ms) => sleep(ms / director.speed, signal),
      until: (pred, o = {}) => until(pred, {
        every: o.every ?? 100,
        timeout: o.timeout != null ? o.timeout / director.speed : Infinity,
        signal,
      }),
      every: (ms, fn) => {
        const id = setInterval(fn, ms);
        cleanups.push(() => clearInterval(id));
        return id;
      },
      on: (el, ev, fn, opt) => {
        el.addEventListener(ev, fn, opt);
        cleanups.push(() => el.removeEventListener(ev, fn, opt));
      },
      cleanup: (fn) => { if (typeof fn === 'function') cleanups.push(fn); },
      say: (key, o) => say(ctx, key, o),
      save: () => writeSave(state),
      unlock,
      applySettings,
      resetState: () => { state = freshState(state.settings); },
      restore: (s) => { state = Object.assign(freshState(state.settings), s, { settings: state.settings }); },
      _enter: () => enter(ctx, scene),
      _cleanup: async (aborted) => {
        for (const fn of cleanups.reverse()) {
          try { await fn(aborted); } catch (e) { console.warn(e); }
        }
        cleanups.length = 0;
        tts.cancel();
        haptics.stop();
        audio.stopScope('scene', aborted ? 0.05 : 0.6);
        fx.clearPainters();
        if (aborted) mic.stop();
      },
    };
    return ctx;
  };
  director = new Director(SCENES, makeCtx);
  ui.speed = () => director.speed;

  // Реплика поверх любой сцены (уход из игры, кнопка «Назад»).
  const interject = (key) => {
    const text = fmt(game.C.lines[key] ?? key, state);
    const el = h('div', { class: 'interject' }, text);
    root.append(el);
    setTimeout(() => el.remove(), 3800);
    if (state.settings.tts) tts.speak(text, { who: 'system' });
  };

  let lastAwayLine = 0;
  platform.onState(async (active) => {
    const scene = director.current;
    const N = game.C.notifications;
    if (!active) {
      if (scene?.away) {
        runtime.away = Date.now();
        const at = Date.now() + game.C.timing.awayNoticeMs;
        platform.schedule([
          { id: 101, title: N.away1.title, body: N.away1.body, at: new Date(at) },
          { id: 102, title: N.away2.title, body: N.away2.body, at: new Date(at + 7000) },
        ]);
      }
      return;
    }
    audio.resume();
    if (!runtime.away) return;
    const gone = Date.now() - runtime.away;
    runtime.away = null;
    platform.cancelNotifications([101, 102]);
    if (gone < 2500 || Date.now() - lastAwayLine < 45000) return;
    lastAwayLine = Date.now();
    if (!platform.canNotify && gone > game.C.timing.awayNoticeMs) {
      // в браузере настоящих уведомлений нет — показываем, что «пришло», пока игрока не было
      const lock = lockScreen([
        { app: 'Соня', ...N.away1 },
        { app: 'ЛЕТА', ...N.away2 },
      ]);
      lock.classList.add('top');
      root.append(lock);
      await new Promise((r) => lock.addEventListener('click', r, { once: true }));
      lock.remove();
    }
    interject('away.resume');
  });
  platform.onBack(() => {
    if (director.current && director.current.id !== 'warning') {
      interject('away.back');
      fx.glitch(200, 0.6);
    }
  });

  new Author({ director, game, ui, mic, motion, haptics, tts, platform, getState: () => state, resetState: () => { state = freshState(state.settings); } });

  hot?.snapshot?.(() => ({ state }));

  // Для отладки в консоли браузера: откройте игру с #dev и используйте window.lethe.
  if (location.hash === '#dev') window.lethe = { director, game, getState: () => state, audio, mic, motion };

  if (save?.ending === 'A') director.start('idleA');
  else if (save?.ending === 'B' || save?.ending === 'C') director.start('after');
  else {
    if (save?.scene && save.scene !== 'warning' && SCENES.some((s) => s.id === save.scene && !s.manual)) game.saved = save;
    director.start('warning');
  }
}
