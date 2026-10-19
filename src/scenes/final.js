// 18:00–20:00 · Финальный выбор и три концовки. Плюс экраны после финала.
import { h, clamp, once } from '../core/dom.js';
import { figureSVG } from '../fx/figure.js';
import { drawingSVG } from '../fx/drawing.js';
import { poolPhoto } from '../fx/photo.js';
import { crackLayer } from '../fx/overlays.js';
import { LOGO } from '../ui/ui.js';
import { listenedAll, scheduleNext, ringChart } from './parts.js';

function lastMessage(ctx, v) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const play = h('button', {
    class: 'last-play',
    type: 'button',
    'aria-label': ctx.T('final.hold'),
    html: `<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${R}" class="lr-bg"/><circle cx="36" cy="36" r="${R}" class="lr-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}"/><path d="M30 24v24l19-12z" class="lr-ico"/></svg>`,
  });
  const fg = play.querySelector('.lr-fg');
  const unread = h('span', { class: 'unread' }, `● ${ctx.T('final.unread')}`);
  const el = h('div', { class: 'lastmsg' }, play,
    h('div', { class: 'last-meta' },
      h('b', {}, ctx.C.meta.sister),
      h('span', {}, `${ctx.T('final.day')}, ${v.time} · ${v.dur}`),
      unread));
  return {
    el,
    play,
    unread,
    set(p) { fg.style.strokeDashoffset = String(C * (1 - p)); },
  };
}

// Проигрывает последнее сообщение Сони с субтитрами.
async function playLast(ctx, v, container) {
  const { audio, tts, C, state } = ctx;
  const sub = h('p', { class: 'last-sub' });
  container.append(sub);
  audio.rain(true, { level: 0.35 });
  audio.ticker(true, { level: 0.2 });
  const typing = ctx.ui.type(sub, v.text, { signal: ctx.signal, ms: 60 });
  let spoke = false;
  if (state.settings.tts) {
    if (C.audio.voiceFiles) spoke = await audio.playFile(v.id, { bus: 'mem', wet: 0.25 });
    if (!spoke) spoke = await tts.speak(v.text, { who: 'sonya', signal: ctx.signal });
  }
  await typing;
  if (!spoke) await ctx.wait(4000);
  await ctx.wait(600);
  audio.ticker(false);
  audio.rain(false);
}

export const final = {
  id: 'final',
  title: 'Финальный выбор',
  env: { mode: 'void', hum: false, ticker: false },
  async run(ctx) {
    const { ui, T, C, state, rt, audio, haptics, director } = ctx;
    const v7 = C.voices.find((v) => v.locked) || C.voices[C.voices.length - 1];
    ui.stage.classList.add('final-stage');
    const lines = h('div', { class: 'final-lines' });
    const msg = lastMessage(ctx, v7);
    const hint = h('div', { class: 'hold-hint', hidden: true }, T(state.settings.tapHold ? 'final.tap' : 'final.hold'));
    const clearBtn = ui.button(T('final.clear'), { cls: 'clear-btn' });
    clearBtn.hidden = true;
    const replyBtn = listenedAll(ctx) ? ui.button(T('final.reply'), { cls: 'ghost reply-btn' }) : null;
    if (replyBtn) replyBtn.hidden = true;
    const wrap = h('section', { class: 'final' }, lines, h('div', { class: 'final-msg' }, msg.el, hint, replyBtn), clearBtn);
    ui.stage.append(wrap);
    haptics.heartStart(64, { strength: 0.6 });

    for (const k of ['final.f1', 'final.f2', 'final.f3', 'final.f4', 'final.f5', 'final.f6']) {
      const p = h('p');
      lines.append(p);
      await ctx.say(k, { el: p, hold: 800 });
    }
    hint.hidden = false;
    clearBtn.hidden = false;
    if (replyBtn) replyBtn.hidden = false;
    ui.sys.dataset.pos = 'top';
    ctx.cleanup(() => { delete ui.sys.dataset.pos; });

    const r = msg.play.getBoundingClientRect();
    const cracks = crackLayer(ui.over, { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight, seed: 3 });
    const memories = h('div', { class: 'memflash' },
      h('div', { class: 'mf', html: drawingSVG() }),
      h('div', { class: 'mf' }, poolPhoto({ child: true }).el));
    ui.over.prepend(memories);

    let holding = false;
    let choice = null;
    ctx.on(msg.play, 'contextmenu', (e) => e.preventDefault());
    if (state.settings.tapHold) {
      ctx.on(msg.play, 'click', () => { holding = !holding; });
    } else {
      ctx.on(msg.play, 'pointerdown', (e) => {
        holding = true;
        msg.play.setPointerCapture?.(e.pointerId);
      });
      ['pointerup', 'pointercancel'].forEach((ev) => ctx.on(msg.play, ev, () => { holding = false; }));
    }
    ctx.on(clearBtn, 'click', () => { choice = 'endA'; });
    if (replyBtn) ctx.on(replyBtn, 'click', () => { choice = 'endC'; });

    let queue = Promise.resolve();
    const speak = (fn) => { queue = queue.then(fn).catch(() => {}); };
    const said = new Set();
    let progress = 0;
    let last = performance.now();
    let idle = performance.now();
    let wasHolding = false;
    let flashT = 0;
    const holdMs = C.timing.holdToListenMs / director.speed;
    while (!choice) {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (holding) {
        progress += dt / holdMs;
        idle = now;
      } else {
        progress -= (dt / holdMs) * C.timing.holdDecay; // горе не сбрасывается — оно медленно утекает
      }
      progress = clamp(progress, 0, 1);
      msg.set(progress);
      cracks.grow(progress * 1.05);
      clearBtn.style.transform = `translateY(${(-progress * 22).toFixed(2)}vh) scale(${(1 + progress * 0.5).toFixed(3)})`;
      haptics.heartBpm(64 + 56 * progress);
      if (progress > 0.25 && !said.has('h1')) {
        said.add('h1');
        speak(() => ctx.say('final.h1', { hold: 300 }));
      }
      if (progress > 0.5 && !said.has('h2')) {
        said.add('h2');
        speak(async () => {
          await ctx.say('final.h2', { hold: 100 });
          if (rt.voice) await audio.playBuffer(rt.voice, { mode: 'machine' });
        });
      }
      if (progress > 0.75 && !said.has('h3')) {
        said.add('h3');
        speak(async () => {
          audio.breath({ pos: [0, 0, -0.4], level: 0.3 });
          await ctx.wait(900);
          await ctx.say('final.h3', { who: 'human', hold: 200 });
        });
      }
      // вспышки воспоминаний — не чаще трёх в секунду
      if (progress > 0.78 && holding && !state.settings.lowFlash && now - flashT > 420) {
        flashT = now;
        memories.dataset.f = memories.dataset.f === '1' ? '2' : '1';
      } else if (progress <= 0.78) {
        memories.dataset.f = '';
      }
      if (wasHolding && !holding && progress > 0.3 && !said.has('rel')) {
        said.add('rel');
        speak(() => ctx.say('final.release', { hold: 200 }));
      }
      if (!holding && progress === 0 && now - idle > C.timing.finalIdleMs / director.speed && !said.has('wait')) {
        said.add('wait');
        speak(() => ctx.say('final.wait'));
      }
      wasHolding = holding;
      if (progress >= 1) choice = 'endB';
      else await ctx.wait(40);
    }
    return choice;
  },
};

function finishSession(ctx, ending) {
  const settings = ctx.state.settings;
  ctx.resetState();
  ctx.state.settings = settings;
  ctx.state.ending = ending;
  ctx.save();
}

export const endA = {
  id: 'endA',
  title: 'Концовка «Лета»',
  manual: true,
  env: { mode: 'void', hum: false, ticker: false },
  async run(ctx) {
    const { ui, audio, haptics, platform } = ctx;
    haptics.stop();
    const white = h('div', { class: 'whiteout' });
    ui.over.append(white);
    requestAnimationFrame(() => white.classList.add('on'));
    platform.setBrightness(1);
    audio.song('muzak', { level: 0.6 });
    await ctx.wait(3200);
    ui.setMode('white');
    ui.over.replaceChildren();
    ui.stage.classList.add('center');
    const box = h('div', { class: 'endtext' });
    ui.stage.append(box);
    for (const k of ['endA.1', 'endA.2', 'endA.3']) {
      const p = h('p');
      box.append(p);
      await ctx.say(k, { el: p, hold: 1600 });
    }
    // фото пустой дорожки — в галерею (только в приложении)
    await platform.saveImage(poolPhoto({ child: false }).flatten(), 'IMG_0412.jpg');
    scheduleNext(ctx, 'nextA');
    await ctx.wait(5000);
    finishSession(ctx, 'A');
    return 'credits';
  },
};

export const endB = {
  id: 'endB',
  title: 'Концовка «Мнемозина»',
  manual: true,
  env: { mode: 'void', hum: false, ticker: false },
  async run(ctx) {
    const { ui, T, C, audio, haptics, tts, fx, state } = ctx;
    haptics.stop();
    const v7 = C.voices.find((v) => v.locked) || C.voices[C.voices.length - 1];
    const cracks = crackLayer(ui.over, { x: 0.5, y: 0.55, seed: 5 });
    cracks.burst();
    audio.glass();
    haptics.scrape(700, { sound: false });
    const scream = h('div', { class: 'scream-text' }, T('endB.scream'));
    ui.over.append(scream);
    audio.scream({ level: 0.42 });
    fx.glitch(600, 1);
    await ctx.wait(1500);
    scream.remove();
    // вспышки воспоминаний: не чаще трёх в секунду
    const frames = [drawingSVG(), figureSVG({ face: 'pixel' }), ''];
    const flash = h('div', { class: 'memflash solo' });
    ui.over.append(flash);
    for (const f of frames) {
      flash.innerHTML = f;
      await ctx.wait(state.settings.lowFlash ? 800 : 380);
    }
    ui.over.replaceChildren();
    ui.stage.replaceChildren();
    await ctx.wait(700);
    const sorry = h('p', { class: 'small-line' });
    ui.stage.classList.add('center');
    ui.stage.append(sorry);
    await Promise.all([ui.type(sorry, T('endB.sorry'), { signal: ctx.signal, ms: 90 }), tts.speak(T('endB.sorry'), { who: 'human', signal: ctx.signal })]);
    await ctx.wait(3000);
    sorry.remove();

    const msg = lastMessage(ctx, v7);
    msg.unread.remove();
    msg.set(1);
    msg.el.classList.add('playing');
    const box = h('div', { class: 'final-msg' }, msg.el);
    ui.stage.append(box);
    await playLast(ctx, v7, box);
    await ctx.wait(2200);
    ui.stage.replaceChildren();

    const turn = h('div', { class: 'turn' },
      h('div', { class: 'fig-back', html: figureSVG({ back: true }) }),
      h('div', { class: 'fig-front', html: figureSVG({ face: 'crayon' }) }));
    ui.stage.append(turn);
    await ctx.wait(400);
    turn.classList.add('in');
    await ctx.wait(2600);
    turn.classList.add('turned');
    await ctx.wait(2400);
    const thanks = h('p', { class: 'whisper-line' });
    ui.stage.append(thanks);
    await Promise.all([ui.type(thanks, T('endB.thanks'), { signal: ctx.signal, ms: 70 }), tts.speak(T('endB.thanks'), { who: 'sonya', volume: 0.55, signal: ctx.signal })]);
    await ctx.wait(3000);
    ui.stage.replaceChildren(h('p', { class: 'endcard' }, T('endB.card')));
    scheduleNext(ctx, 'nextB');
    await ctx.wait(7000);
    finishSession(ctx, 'B');
    return 'credits';
  },
};

export const endC = {
  id: 'endC',
  title: 'Секретная концовка «Скорбь»',
  manual: true,
  env: { mode: 'void', hum: false, ticker: false },
  async run(ctx) {
    const { ui, T, C, mic, rt, audio, haptics } = ctx;
    haptics.stop();
    const v7 = C.voices.find((v) => v.locked) || C.voices[C.voices.length - 1];
    ui.stage.classList.add('center');
    const chat = h('div', { class: 'chat end-chat' });
    const msg = lastMessage(ctx, v7);
    chat.append(msg.el);
    ui.stage.append(chat);
    await ctx.say('endC.rec', { hold: 0 });

    const recBtn = ui.button(T('endC.recBtn'), { cls: 'rec-btn' });
    const timer = h('span', { class: 'rec-time mono' }, '0:00');
    ui.stage.append(h('div', { class: 'rec' }, recBtn, timer));
    const micOn = rt.micOK && (await mic.start());
    ctx.cleanup(() => mic.stop());
    let rec = false;
    let t0 = 0;
    let secs = 0;
    ctx.on(recBtn, 'contextmenu', (e) => e.preventDefault());
    ctx.on(recBtn, 'pointerdown', () => { rec = true; t0 = performance.now(); recBtn.classList.add('on'); });
    const stop = () => {
      if (!rec) return;
      rec = false;
      secs = Math.max(1, Math.round((performance.now() - t0) / 1000));
      recBtn.classList.remove('on');
    };
    ctx.on(recBtn, 'pointerup', stop);
    ctx.on(recBtn, 'pointercancel', stop);
    ctx.every(200, () => {
      if (rec) {
        const s = Math.floor((performance.now() - t0) / 1000);
        timer.textContent = `0:${String(s).padStart(2, '0')}`;
        if (micOn) recBtn.style.setProperty('--lvl', String(mic.env()));
        if (s >= 59) stop();
      }
    });
    await ctx.until(() => secs > 0, { every: 100 });
    mic.stop(); // запись нигде не сохраняется
    recBtn.parentElement.remove();
    ui.sysHide();

    const status = h('span', { class: 'out-status' }, `${T('endC.sent')} ✓`);
    chat.append(h('div', { class: 'outmsg' }, h('span', {}, `🎤 0:${String(secs).padStart(2, '0')}`), status));
    audio.uiTick();
    await ctx.wait(1600);
    status.textContent = `${T('endC.delivered')} ✓✓`;
    audio.uiTick();
    await ctx.wait(6000); // «Прочитано» не наступает никогда

    msg.unread.remove();
    msg.el.classList.add('playing');
    msg.set(1);
    await playLast(ctx, v7, chat);
    await ctx.wait(1500);
    audio.birds(true);
    for (const k of ['endC.1', 'endC.2', 'endC.3', 'endC.4']) await ctx.say(k, { hold: 1500 });
    await ctx.wait(3000);
    finishSession(ctx, 'C');
    return 'credits';
  },
};

export const credits = {
  id: 'credits',
  title: 'Титры',
  manual: true,
  noSave: true,
  env: (ctx) => ({ mode: ctx.state.ending === 'A' ? 'white' : 'void', hum: false, ticker: false }),
  async run(ctx) {
    const { ui, T, state, audio, platform } = ctx;
    ui.stage.classList.add('center');
    const box = h('section', { class: 'credits' },
      h('div', { class: 'splash-logo small', html: LOGO }),
      h('h1', { class: 'credits-title' }, T('credits.title')),
      h('p', { class: 'credits-support' }, T('credits.support')));
    ui.stage.append(box);
    await ctx.wait(6000);
    audio.song(null);
    audio.birds(false);
    await platform.restoreBrightness();
    if (state.ending === 'A') {
      await ctx.wait(4000);
      return 'idleA';
    }
    const i = await ui.choice([T('credits.again'), T('credits.listen')], { signal: ctx.signal, container: box });
    if (i === 0) {
      ctx.resetState();
      return 'warning';
    }
    return 'after';
  },
};

// После концовки «Лета» приложение — скучный клинер навсегда (пока не стереть данные).
export const idleA = {
  id: 'idleA',
  title: 'После «Леты»: пустой клинер',
  manual: true,
  noSave: true,
  env: { mode: 'system', status: true, hum: false },
  async run(ctx) {
    const { ui, T, audio, platform } = ctx;
    ui.setBattery(100);
    platform.battery().then((b) => { if (b != null) ui.setBattery(b * 100); });
    ui.stage.classList.add('center');
    const ring = ringChart(0.12);
    const label = h('p', { class: 'idle-text' }, T('endA.idle'));
    const scanBtn = ui.button(T('idle.scan'), { cls: 'primary' });
    const logo = h('div', { class: 'splash-logo small', html: LOGO });
    ui.stage.append(h('section', { class: 'idle' }, logo, ring.el, label, scanBtn));
    // скрытый сброс: удерживать логотип 5 секунд
    let pressT = null;
    ctx.on(logo, 'pointerdown', () => { pressT = setTimeout(() => askReset(), 5000); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => ctx.on(logo, ev, () => clearTimeout(pressT)));
    let reset = false;
    const askReset = async () => {
      const card = h('div', { class: 'card form' }, h('p', {}, T('idle.reset')));
      ui.stage.append(card);
      const i = await ui.choice([T('idle.resetYes'), T('idle.resetNo')], { signal: ctx.signal, container: card });
      card.remove();
      if (i === 0) reset = true;
    };
    ctx.on(scanBtn, 'click', async () => {
      scanBtn.disabled = true;
      label.textContent = T('idle.scanning');
      ring.spin(true);
      audio.uiTick();
      await new Promise((r) => setTimeout(r, 1800));
      ring.spin(false);
      label.textContent = T('endA.idle');
      scanBtn.disabled = false;
    });
    await ctx.until(() => reset, { every: 200 });
    ctx.resetState();
    ctx.save();
    return 'warning';
  },
};

// После «Мнемозины» и «Скорби»: её сообщение можно переслушать.
export const after = {
  id: 'after',
  title: 'После финала: её сообщение',
  manual: true,
  noSave: true,
  env: { mode: 'void', hum: false },
  async run(ctx) {
    const { ui, T, C } = ctx;
    const v7 = C.voices.find((v) => v.locked) || C.voices[C.voices.length - 1];
    ui.stage.classList.add('center');
    const msg = lastMessage(ctx, v7);
    msg.unread.remove();
    msg.set(1);
    const box = h('div', { class: 'final-msg' }, msg.el);
    const again = ui.button(T('credits.again'), { cls: 'ghost' });
    ui.stage.append(box, again);
    ctx.on(msg.play, 'click', () => ctx.unlock());
    for (;;) {
      const which = await Promise.race([
        once(msg.play, 'click', ctx.signal).then(() => 'play'),
        once(again, 'click', ctx.signal).then(() => 'again'),
      ]);
      if (which === 'again') break;
      box.querySelector('.last-sub')?.remove();
      msg.el.classList.add('playing');
      await playLast(ctx, v7, box);
      msg.el.classList.remove('playing');
    }
    ctx.resetState();
    ctx.save();
    return 'warning';
  },
};

