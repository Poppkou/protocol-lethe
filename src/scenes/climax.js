// 13:30–18:00 · Согласие пациента, агрессивная очистка, камера, мёртвая тишина.
import { h, clamp, todayRu, once } from '../core/dom.js';
import { figureSVG } from '../fx/figure.js';
import { crackLayer } from '../fx/overlays.js';
import { homeScreen } from '../fx/screens.js';
import { cameraFlash } from '../sensors/camera.js';
import { LOGO } from '../ui/ui.js';
import { fileRow, replaySignature } from './parts.js';

export const consent = {
  id: 'consent',
  title: 'Согласие пациента',
  away: true,
  env: { mode: 'system', status: true, session: true, ink: 0.45, temp: true, ticker: true, drain: 5000 },
  async run(ctx) {
    const { ui, T, C, state, rt, audio, haptics } = ctx;
    await ctx.say('consent.found', { hold: 300 });
    const { row, btn } = fileRow('согласие_пациента.pdf', '48 КБ', T('consent.open'));
    row.classList.add('focus');
    ui.stage.append(row);
    await once(btn, 'click', ctx.signal);
    row.remove();
    ui.sysHide();

    const sig = h('canvas', { class: 'sig-canvas' });
    const doc = h('article', { class: 'doc' },
      h('header', { class: 'doc-head' }, ...T('consent.head').split('\n').map((l) => h('div', {}, l))),
      h('dl', { class: 'doc-fields' },
        h('dt', {}, T('consent.patient')), h('dd', {}, state.name || 'Пользователь'),
        h('dt', {}, T('consent.date')), h('dd', {}, todayRu()),
        h('dt', {}, T('consent.sessionLabel')), h('dd', {}, T('consent.sessionVal'))),
      h('div', { class: 'doc-body' }, ...T('consent.body').split('\n\n').map((p) => h('p', {}, p))),
      h('div', { class: 'doc-sig' }, sig, h('div', { class: 'sig-label' }, T('consent.sigLabel'))));
    ui.stage.append(doc);
    await ctx.wait(1400);
    await replaySignature(ctx, sig, state.signature);
    await ctx.wait(1600);

    if (rt.voice) {
      await ctx.say('consent.you', { hold: 400 });
      await audio.playBuffer(rt.voice, { mode: 'raw' });
      await ctx.wait(600);
      await audio.playBuffer(rt.voice, { mode: 'machine' });
      await ctx.wait(500);
    } else {
      await ctx.say('consent.noVoice');
    }
    await ctx.say('consent.only', { hold: 900 });

    doc.classList.add('dim');
    await ctx.say('consent.deps', { hold: 0 });
    const ul = h('ul', { class: 'deps' });
    ui.stage.append(ul);
    for (const d of C.dependencies) {
      const li = h('li', {}, d);
      ul.append(li);
      li.scrollIntoView({ block: 'end', behavior: 'smooth' });
      haptics.tick();
      audio.uiTick();
      await ctx.wait(950);
    }
    await ctx.wait(2200);
  },
};

export const purge = {
  id: 'purge',
  title: 'Агрессивная очистка',
  away: true,
  env: { mode: 'red', status: true, session: true, ink: 0.55, temp: true, ticker: true, drain: 2500 },
  async run(ctx) {
    const { ui, T, C, audio, haptics, motion, fx } = ctx;
    audio.shepard(true);
    haptics.heartStart(70, { strength: 0.8 });
    ctx.every(1000, () => haptics.heartBpm(Math.min(120, haptics.bpm + 0.6)));

    const warns = h('div', { class: 'warns' });
    ui.stage.append(warns);
    for (const k of ['purge.w1', 'purge.w2', 'purge.w3']) {
      warns.append(h('div', { class: 'warn-banner' }, T(k)));
      audio.alarm(0.6);
      await ctx.wait(800);
    }
    await ctx.say('purge.start', { hold: 600, tone: 'alarm' });

    // охота за фрагментами
    ui.setMode('void');
    fx.setInk(0);
    ui.stage.replaceChildren();
    const world = h('div', { class: 'hunt-world' });
    const reticle = h('div', { class: 'reticle' });
    const radar = h('div', { class: 'radar', hidden: true }, '↑');
    const hunt = h('div', { class: 'hunt' }, world, reticle, radar);
    ui.over.append(hunt);
    const frags = [[0.14, 0.2], [0.86, 0.32], [0.24, 0.84]].map(([x, y], i) => {
      const el = h('div', { class: 'frag', style: { left: `${x * 100}%`, top: `${y * 100}%` } }, `0x${(0x4c3a + i * 977).toString(16)}`);
      world.append(el);
      return { x, y, el, got: false, t: 0 };
    });
    const ghost = h('div', { class: 'hunt-ghost', html: figureSVG({ face: 'pixel' }) });
    world.append(ghost);
    motion.calibrate();
    const live = await ctx.until(() => motion.live, { timeout: 1000 });
    if (!live) ctx.cleanup(motion.attachVirtual(hunt));
    await ctx.say(live ? 'purge.hunt' : 'purge.huntDrag', { hold: 0 });

    const SIZE = 2.6;
    const history = [];
    let got = 0;
    ctx.every(40, () => {
      const t = motion.tilt();
      const cx = 0.5 + t.x * 0.42;
      const cy = 0.5 + t.y * 0.42;
      const vw = hunt.clientWidth;
      const vh = hunt.clientHeight;
      world.style.transform = `translate(${vw / 2 - cx * SIZE * vw}px, ${vh / 2 - cy * SIZE * vh}px)`;
      const now = performance.now();
      history.push([now, cx, cy]);
      while (history.length && now - history[0][0] > 1500) history.shift();
      // фигура стоит там, куда ты смотрел полторы секунды назад
      const [, gx, gy] = history[0] || [0, cx, cy];
      const d = Math.hypot(gx - cx, gy - cy);
      ghost.style.left = `${gx * 100}%`;
      ghost.style.top = `${gy * 100}%`;
      ghost.style.opacity = clamp((d - 0.12) * 4, 0, 0.85).toFixed(2);
      for (const f of frags) {
        if (f.got) continue;
        const centered = Math.hypot((f.x - cx) * SIZE, (f.y - cy) * SIZE) < 0.16;
        f.el.classList.toggle('lock', centered);
        f.t = centered ? f.t + 40 : 0;
        if (f.t > 800) {
          f.got = true;
          got++;
          f.el.classList.add('got');
          audio.whoosh();
          haptics.tick();
        }
      }
    });
    await Promise.race([ctx.until(() => got >= frags.length, { every: 100 }), ctx.wait(45000)]);
    radar.hidden = false;
    await ctx.say('purge.notHere', { hold: 300 });
    await ctx.say('purge.look', { hold: 0 });
    hunt.classList.add('gone');
    ui.sysHide();
    await ctx.wait(4000); // игрок смотрит в свою комнату
    const close = h('div', { class: 'apparition close', html: figureSVG({ face: 'void' }) });
    ui.over.append(close);
    close.style.opacity = '1';
    haptics.knock(1, 0, { sound: true });
    audio.whisper({ pos: [0.15, 0, -0.25], dur: 1.2, level: 0.5 });
    await ctx.wait(1300);
    fx.glitch(400, 1);
    audio.glitchSound(0.4, 0.15);
    close.remove();
    hunt.remove();

    // «краш» и фейковый рабочий стол
    audio.shepard(false);
    ui.showStatus(false);
    ui.stage.classList.add('center');
    ui.stage.replaceChildren(h('div', { class: 'crash mono' }, T('purge.crash')));
    await ctx.wait(1800);
    let tapped = false;
    const home = homeScreen(C.home, () => { tapped = true; });
    ui.over.append(home);
    await Promise.race([ctx.until(() => tapped, { every: 100 }), ctx.wait(12000)]);
    fx.glitch(300, 1);
    audio.glitchSound(0.3, 0.12);
    home.remove();
    ui.stage.replaceChildren(h('div', { class: 'splash' }, h('div', { class: 'splash-logo', html: LOGO }), h('div', { class: 'brand' }, C.meta.app)));
    await ctx.say('purge.cantQuit', { hold: 1200 });
  },
};

export const camera = {
  id: 'camera',
  title: 'Фронтальная камера',
  away: true,
  env: { mode: 'void', status: true, ticker: true },
  async run(ctx) {
    const { ui, C, haptics, audio, fx } = ctx;
    ui.setBattery(Math.min(ui.battery, 3));
    haptics.heartStart(118, { strength: 1 });
    await ctx.say('cam.show', { hold: 200 });
    ui.sysHide();
    const ghost = () => h('div', { class: 'cam-ghost', html: figureSVG({ face: 'void' }) });
    const ok = await cameraFlash(ui.over, { ms: C.timing.cameraFlashMs, overlay: ghost(), signal: ctx.signal });
    if (!ok) {
      // без камеры: чёрный OLED-экран отражает лицо игрока, а за плечом — силуэт
      const refl = h('div', { class: 'reflect' }, ghost());
      ui.over.append(refl);
      await ctx.wait(1700);
      refl.remove();
    }
    const cracks = crackLayer(ui.over, { x: 0.62, y: 0.38, seed: 11 });
    cracks.grow(1);
    audio.scream();
    haptics.scrape(900, { sound: false });
    fx.glitch(320, 1);
    ui.setBattery(1);
    await ctx.wait(1000);
    await ctx.say('cam.off', { hold: 500, voice: false });
    ui.showStatus(false);
  },
};

export const dead = {
  id: 'dead',
  title: 'Мёртвая тишина',
  env: { mode: 'void', hum: false, ticker: false },
  async run(ctx) {
    const { audio, tts, haptics, fx, C } = ctx;
    audio.silence();
    tts.cancel();
    haptics.stop();
    fx.ink = 0;
    fx.setInk(0);
    await ctx.wait(C.timing.deadSilenceMs);
    haptics.lubdub(1);
    await ctx.wait(1600);
  },
};
