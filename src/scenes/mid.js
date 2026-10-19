// 08:00–13:30 · «Не дыши» (микрофон), тёплый рисунок, «Стук снизу» (телефон экраном вниз).
import { h } from '../core/dom.js';
import { figureSVG } from '../fx/figure.js';
import { drawingSVG } from '../fx/drawing.js';
import { wipeLayer, printsLayer } from '../fx/overlays.js';

export const quiet = {
  id: 'quiet',
  title: 'Механика «Не дыши»',
  away: true,
  env: { mode: 'void', ticker: true },
  async run(ctx) {
    const { ui, T, C, mic, motion, audio, haptics, fx, rt, state, director } = ctx;
    const fig = h('div', { class: 'apparition', html: figureSVG({ face: 'pixel' }) });
    const hear = h('div', { class: 'hear', hidden: true }, T('quiet.hear'));
    const field = h('div', { class: 'quiet' }, fig, hear);
    ui.stage.append(field);

    audio.binaural(true);
    haptics.heartStart(62, { strength: 0.5 });
    const useMic = rt.micOK && (await mic.start());
    ctx.cleanup(() => mic.stop());
    await ctx.say(useMic ? 'quiet.intro' : 'quiet.introTouch', { hold: 600 });
    if (useMic) await mic.calibrate(1500, ctx.signal);

    let dist = 1; // 1 — далеко, 0 — вплотную
    let blackout = false;
    let scanY = -0.2;
    const place = () => {
      fig.style.setProperty('--s', (0.45 + 0.75 * (1 - dist)).toFixed(3));
    };
    place();
    ctx.cleanup(fx.add((g, w, hgt, t) => {
      if (blackout) return;
      scanY = ((t / 3400) % 1.3) - 0.15;
      g.fillStyle = 'rgba(150,185,172,0.22)';
      g.fillRect(0, scanY * hgt, w, 2);
    }));
    ctx.every(50, () => {
      const near = Math.abs(scanY - 0.5) < 0.14;
      fig.style.opacity = near && !blackout ? (0.2 + 0.7 * (1 - dist)).toFixed(2) : '0';
    });

    let touched = false;
    if (!useMic) ctx.on(ui.root, 'pointerdown', () => { touched = true; });

    const showHear = async () => {
      hear.hidden = false;
      fx.glitch(220, 0.9);
      audio.glitchSound(0.22, 0.12);
      await ctx.wait(1300);
      hear.hidden = true;
    };
    const doBlackout = async () => {
      blackout = true;
      field.classList.add('blackout');
      ui.sysHide();
      haptics.heartStop(); // сердце замолкает
      audio.whisper({ pos: [-0.3, 0, 0.3], dur: 2.6, level: 0.75 });
      await ctx.wait(4200);
      blackout = false;
      field.classList.remove('blackout');
      haptics.heartStart(74, { strength: 0.7 });
    };

    const phaseMs = C.timing.micPhaseMs;
    const t0 = performance.now();
    const elapsed = () => (performance.now() - t0) * director.speed;
    let strikes = 0;
    let lastStrike = 0;
    let quietSince = performance.now();
    let saidGood = false;
    let forced = false;
    let mirror = false;
    while (elapsed() < phaseMs * 3) {
      const phase = Math.floor(elapsed() / phaseMs);
      if (phase >= 2 && !mirror && useMic) {
        mirror = true;
        audio.mirrorBreath(true); // кто-то дышит в такт с тобой
      }
      if (phase >= 2 && strikes < 3 && !forced) {
        forced = true; // большой испуг случается даже у тех, кто молчит
        await showHear();
        await doBlackout();
        continue;
      }
      let loud;
      if (useMic) {
        const over = mic.over();
        if (mirror) audio.setMirror(mic.env());
        loud = over > C.timing.micStrikeDb;
      } else {
        loud = touched || (motion.live && motion.energy > 1.4);
        touched = false;
      }
      const now = performance.now();
      if (loud) {
        quietSince = now;
        if (now - lastStrike > 2500 / director.speed) {
          lastStrike = now;
          strikes++;
          dist = Math.max(0, dist - 0.28);
          place();
          await showHear();
          if (strikes === 3) await doBlackout();
        }
      } else if (!saidGood && now - quietSince > C.timing.goodSilenceMs / director.speed) {
        saidGood = true;
        await ctx.say('quiet.good', { hold: 800 });
        quietSince = performance.now();
      }
      await ctx.wait(100);
    }
    state.strikes = strikes;
    audio.mirrorBreath(false);
    audio.binaural(false);
    mic.stop();
    fig.style.opacity = '0';
    await ctx.say('quiet.end', { hold: 1400 });
  },
};

export const warm = {
  id: 'warm',
  title: 'Тёплый фрагмент (рисунок)',
  env: { mode: 'system', status: true, session: true, ink: 0.3, temp: true, ticker: true },
  async run(ctx) {
    const { ui, audio } = ctx;
    ui.stage.classList.add('center');
    const card = h('figure', { class: 'card drawing-card', html: drawingSVG() });
    ui.stage.append(card);
    audio.song('hum', { level: 0.3, loop: true });
    await ctx.say('warm.found', { hold: 2000 });
    await ctx.say('warm.see', { hold: 2600 });
    await ctx.wait(3500);
    await ctx.say('warm.del', { hold: 700 });
    audio.song(null);
    audio.whoosh();
    card.classList.add('whiteout');
    await ctx.wait(1800);
  },
};

const FLIP = { flipped: true };

export const knock = {
  id: 'knock',
  title: 'Механика «Стук снизу»',
  away: true,
  env: { mode: 'void', ticker: true },
  async run(ctx) {
    const { ui, T, C, motion, audio, haptics, state, director } = ctx;
    ui.stage.classList.add('center');
    await ctx.say('knock.intro', { hold: 300 });
    const detect = await ctx.until(() => motion.live, { timeout: 1500 });
    if (detect) {
      const manual = ui.button(T('knock.manual'), { cls: 'ghost' });
      manual.hidden = true;
      ui.stage.append(manual);
      const showManual = setTimeout(() => { manual.hidden = false; }, 20000);
      let pressed = false;
      manual.addEventListener('click', () => { pressed = true; });
      await ctx.until(() => motion.faceDown || pressed, { every: 150 });
      clearTimeout(showManual);
      manual.remove();
    } else {
      await ui.choice([T('knock.manual')], { signal: ctx.signal });
      await ctx.wait(2500);
    }
    ui.sysHide();

    let flipped = false;
    let upSince = null;
    if (detect) {
      ctx.every(100, () => {
        if (motion.faceDown) upSince = null;
        else if (upSince == null) upSince = performance.now();
        else if (performance.now() - upSince > 700) flipped = true;
      });
    }
    const t0 = performance.now();
    const step = async (ms) => {
      const end = performance.now() + ms / director.speed;
      while (performance.now() < end) {
        if (flipped) throw FLIP;
        await ctx.wait(100);
      }
    };
    const soundKnock = !haptics.can; // без вибрации стук звучит в наушниках, снизу
    try {
      audio.rain(true, { level: 0.5 });
      await step(15000);
      haptics.knock(3, 400, { sound: soundKnock, pos: [0, -1, -0.4] });
      await step(6000);
      audio.muffledCall();
      await step(5000);
      haptics.knock(3, 380, { sound: soundKnock, pos: [0, -1, -0.4] });
      await step(4000);
      haptics.heartStart(92, { strength: 0.9, sound: soundKnock });
      await step(9000);
      haptics.heartStop();
      for (let k = 0; k < 3; k++) {
        haptics.scrape(1200);
        await step(2800);
      }
      const rest = C.timing.faceDownMs - (performance.now() - t0) * director.speed;
      if (rest > 0) await step(rest);
    } catch (e) {
      if (e !== FLIP) throw e;
    }
    haptics.stop();
    audio.rain(false);

    const fog = wipeLayer(ui.over, { kind: 'fog', threshold: 0.5, onWipe: () => audio.squeak() });
    const prints = printsLayer(ui.over, { color: 'rgba(8,10,12,0.6)' });
    prints.all();
    if (flipped) {
      state.flippedEarly = true;
      await ctx.say('knock.early', { hold: 900 });
    } else {
      await ctx.say('knock.done', { hold: 200 });
      if (detect) await ctx.until(() => !motion.faceDown, { timeout: 20000 });
    }
    await ctx.say('knock.wipe', { hold: 0 });
    await Promise.race([fog.done, ctx.wait(20000)]);
    await ctx.say('knock.prints', { hold: 1600 });
  },
};
