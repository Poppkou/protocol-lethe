// 02:00–08:00 · Сканирование, фото, голосовые 1–3, заражение интерфейса, голосовые 4–7.
import { h, once } from '../core/dom.js';
import { poolPhoto } from '../fx/photo.js';
import { wipeLayer, printsLayer } from '../fx/overlays.js';
import { fileRow, clickOne, ringChart, voiceBubble, playVoice } from './parts.js';

export const scan = {
  id: 'scan',
  title: 'Сканирование',
  env: { mode: 'system', status: true, session: true },
  async run(ctx) {
    const { ui, T, C, audio, haptics } = ctx;
    const ring = ringChart(0);
    const freedEl = h('div', { class: 'mem-sub' }, ' ');
    const head = h('section', { class: 'mem' }, ring.el,
      h('div', { class: 'mem-meta' }, h('div', { class: 'mem-title' }, T('scan.title')), freedEl));
    ui.stage.append(head);
    ring.spin(true);
    await ctx.say('scan.start', { hold: 300 });
    for (let v = 0; v <= 97; v += 4) {
      ring.set(v / 100);
      await ctx.wait(45);
    }
    ring.set(0.97);
    ring.spin(false);
    freedEl.textContent = `97% ${T('scan.full')}`;
    await ctx.say('scan.found');

    const list = h('div', { class: 'files' });
    ui.stage.append(list);
    const rows = [];
    for (const j of C.junk) {
      const r = fileRow(j.name, j.size, T('scan.delete'));
      r.j = j;
      list.append(r.row);
      rows.push(r);
      audio.uiTick();
      await ctx.wait(140);
    }
    await ctx.say('scan.hint', { hold: 0 });

    const busy = rows.find((r) => r.j.busy) || rows[0];
    let freed = 0;
    let busyDone = false;
    const busyBeat = async () => {
      busyDone = true;
      busy.row.classList.remove('nope');
      void busy.row.offsetWidth;
      busy.row.classList.add('nope');
      audio.error();
      haptics.lubdub(1.1); // первый удар сердца в ладонь. Только один.
      await ctx.say('scan.busy', { hold: 500 });
      await ctx.say('scan.later', { hold: 300 });
    };
    let left = rows.filter((r) => r !== busy);
    while (left.length) {
      const live = [busy, ...left];
      const i = await clickOne(live.map((r) => r.btn), ctx.signal);
      const r = live[i];
      if (r === busy) {
        if (!busyDone) await busyBeat();
        else {
          audio.error();
          r.row.classList.remove('nope');
          void r.row.offsetWidth;
          r.row.classList.add('nope');
        }
        continue;
      }
      audio.whoosh();
      haptics.tick();
      r.row.classList.add('dissolve');
      freed += parseFloat(String(r.j.size).replace(',', '.')) || 1;
      freedEl.textContent = T('scan.freed', { mb: freed.toFixed(1).replace('.', ',') });
      ring.set(0.97 - freed / 300);
      left = left.filter((x) => x !== r);
      setTimeout(() => r.row.remove(), 650);
    }
    if (!busyDone) {
      await ctx.wait(700);
      await busyBeat();
    }
    await ctx.say('scan.open', { hold: 0 });
    busy.btn.textContent = T('scan.openBtn');
    busy.row.classList.add('focus');
    await once(busy.btn, 'click', ctx.signal);
    audio.uiTick();
  },
};

export const photo = {
  id: 'photo',
  title: 'Фото из бассейна',
  env: { mode: 'system', status: true, session: true },
  async run(ctx) {
    const { ui, T, motion, audio, state } = ctx;
    const ph = poolPhoto({ child: true });
    let blur = 14;
    ph.setBlur(blur);
    const card = h('figure', { class: 'card photo-card' }, ph.el, h('figcaption', { class: 'mono' }, 'IMG_0412.jpg · 18:00 · бассейн «Дельфин»'));
    ui.stage.append(card);
    await ctx.say('photo.hold', { hold: 0 });

    let holding = false;
    let held = 0;
    ctx.on(ph.el, 'pointerdown', () => { holding = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => ctx.on(ph.el, ev, () => { holding = false; }));
    let restored = false;
    ctx.every(40, () => {
      if (holding) held += 40;
      if (held > 2200) restored = true;
      const target = restored ? 1.5 : holding ? 1.2 : 14;
      blur += (target - blur) * 0.12;
      ph.setBlur(blur.toFixed(2));
    });
    await ctx.until(() => restored, { every: 100 });

    motion.calibrate();
    const live = await ctx.until(() => motion.live, { timeout: 1200 });
    if (!live) ctx.cleanup(motion.attachVirtual(ph.el));
    ctx.every(40, () => {
      const t = motion.tilt();
      ph.setTilt(t.x, t.y);
    });
    await ctx.say(live ? 'photo.tilt' : 'photo.drag', { hold: 6000 });

    await ctx.say('photo.ask', { hold: 0 });
    const yes = (await ui.choice([T('photo.yesBtn'), T('photo.noBtn')], { signal: ctx.signal })) === 0;
    state.recognized = yes;
    await ctx.say(yes ? 'photo.yes' : 'photo.no');
    await ctx.say('photo.del', { hold: 0 });
    const keep = (await ui.choice([T('scan.delete'), T('photo.keepBtn')], { signal: ctx.signal })) === 1;
    if (keep) await ctx.say('photo.keep');
    audio.whoosh();
    card.classList.add('dissolve');
    await ctx.wait(800);
  },
};

// Рисует чат с голосовыми. from..to — какие сообщения можно слушать сейчас.
function renderChat(ctx, from, to) {
  const { C, state } = ctx;
  const chat = h('div', { class: 'chat' });
  const bubbles = C.voices.map((v, i) => {
    let st = 'pending';
    if (state.deleted[v.id]) st = 'deleted';
    else if (state.listened[v.id]) st = 'done';
    else if (v.locked) st = 'locked unread';
    else if (i >= from && i <= to) st = 'ready';
    const b = voiceBubble(v, { state: st });
    if (st === 'deleted') b.el.hidden = true;
    chat.append(b.el);
    return b;
  });
  ctx.ui.stage.append(chat);
  return bubbles;
}

async function listenRange(ctx, bubbles, from, to, comments) {
  const { C, state, audio } = ctx;
  for (let i = from; i <= to; i++) {
    const v = C.voices[i];
    if (state.listened[v.id] || state.deleted[v.id]) continue;
    const b = bubbles[i];
    b.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    b.setState('ready focus');
    const act = await b.action(ctx.signal);
    if (act === 'play') {
      await playVoice(ctx, v, b);
      state.listened[v.id] = true;
      if (comments?.[i]) await ctx.say(comments[i]);
    } else {
      state.deleted[v.id] = true;
      audio.whoosh();
      b.el.classList.add('dissolve');
      await ctx.wait(500);
      b.el.hidden = true;
      await ctx.say('voice.deleted', { hold: 500 });
    }
    ctx.save();
  }
}

export const voices1 = {
  id: 'voices1',
  title: 'Голосовые 1–3',
  env: { mode: 'system', status: true, session: true },
  async run(ctx) {
    await ctx.say('voice.intro', { hold: 300 });
    const bubbles = renderChat(ctx, 0, 2);
    await listenRange(ctx, bubbles, 0, 2, ['voice.after1', 'voice.after2', 'voice.after3']);
  },
};

export const dirt = {
  id: 'dirt',
  title: 'Заражение интерфейса',
  env: { mode: 'system', status: true, session: true, ink: 0.18, temp: true, drain: 7000 },
  async run(ctx) {
    const { ui, fx, audio, haptics, motion } = ctx;
    fx.setInk(0.28);
    ui.stage.classList.add('center');
    ui.stage.append(h('div', { class: 'dirt-hint mono' }, ctx.T('dirt.temp')));
    await ctx.say('dirt.found', { hold: 300 });
    await ctx.say('dirt.wipe', { hold: 0 });
    const w = wipeLayer(ui.over, { kind: 'smear', threshold: 0.5, onWipe: () => audio.squeak() });
    const prints = printsLayer(ui.over);
    let shown = 0;
    ctx.every(250, () => {
      const want = Math.min(5, Math.floor(w.progress / 0.1));
      while (shown < want) {
        prints.next();
        shown++;
        haptics.tick();
      }
    });
    await Promise.race([w.done, ctx.wait(25000)]);
    prints.all();
    await ctx.say('dirt.inside', { hold: 1200 });
    w.destroy();
    prints.destroy();

    // то же фото — но теперь за колонной кто-то стоит
    const ph = poolPhoto({ child: true, figure: 1 });
    ph.setBlur(1.5);
    const card = h('figure', { class: 'card photo-card' }, ph.el, h('figcaption', { class: 'mono' }, 'IMG_0412.jpg · изменён 1 мин назад'));
    ui.stage.replaceChildren(card);
    if (!motion.live) ctx.cleanup(motion.attachVirtual(ph.el));
    ctx.every(40, () => {
      const t = motion.tilt();
      ph.setTilt(t.x, t.y);
    });
    await ctx.wait(1500);
    fx.glitch(220, 0.7);
    audio.glitchSound(0.2, 0.08);
    await ctx.say('dirt.closer', { hold: 3500 });
  },
};

export const voices2 = {
  id: 'voices2',
  title: 'Голосовые 4–7',
  env: { mode: 'system', status: true, session: true, ink: 0.3, temp: true, drain: 6000 },
  async run(ctx) {
    const { ui, audio } = ctx;
    const bubbles = renderChat(ctx, 3, 5);
    await listenRange(ctx, bubbles, 3, 5);
    const last = bubbles[6];
    last.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    last.setState('locked unread focus');
    await ctx.say('voice.unheard', { hold: 300 });
    const tapped = await Promise.race([last.action(ctx.signal).then(() => true), ctx.wait(5000).then(() => false)]);
    if (tapped) {
      audio.error();
      last.el.classList.remove('nope');
      void last.el.offsetWidth;
      last.el.classList.add('nope');
      await ctx.say('voice.locked', { hold: 400 });
    }
    audio.ticker(true);
    ui.sysHide();
    await ctx.wait(1500);
    await ctx.say('voice.1841', { hold: 2200 });
  },
};
