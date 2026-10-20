// 00:00–02:00 · Предупреждение, онбординг, калибровка голоса.
import { h, once } from '../core/dom.js';
import { LOGO } from '../ui/ui.js';
import { signaturePad } from './parts.js';

export const warning = {
  id: 'warning',
  title: 'Предупреждение',
  noSave: true,
  env: { mode: 'void', hum: false },
  async run(ctx) {
    const { ui, T, state } = ctx;
    const saved = ctx.game.saved;
    const toggle = (key, label) => {
      const input = h('input', { type: 'checkbox', id: `opt-${key}` });
      input.checked = !!state.settings[key];
      input.addEventListener('change', () => { state.settings[key] = input.checked; ctx.applySettings(); });
      return h('label', { class: 'opt', for: `opt-${key}` }, input, h('span', {}, label));
    };
    const box = h('section', { class: 'warn' },
      h('h1', { class: 'warn-title' }, T('warn.title')),
      ...T('warn.body').split('\n\n').map((p) => h('p', { class: 'warn-body' }, p)),
      h('div', { class: 'opts' },
        toggle('tts', T('warn.optVoice')),
        toggle('lowFlash', T('warn.optFlash')),
        toggle('tapHold', T('warn.optHold'))));
    ui.stage.classList.add('center');
    ui.stage.append(box);

    // Звук, речь и датчики разрешаются только внутри нажатия — поэтому всё включаем прямо в обработчике.
    const labels = saved ? [T('warn.continue'), T('warn.restart')] : [T('warn.start')];
    const row = h('div', { class: 'choices' });
    const buttons = labels.map((l, i) => ui.button(l, { cls: i === 0 ? 'primary' : '' }));
    buttons.forEach((b) => b.addEventListener('click', () => ctx.unlock()));
    row.append(...buttons);
    box.append(row);
    const idx = await Promise.race(buttons.map((b, i) => once(b, 'click', ctx.signal).then(() => i)));
    await ctx.wait(300);
    if (saved && idx === 0) {
      ctx.restore(saved);
      return saved.scene || 'onboarding';
    }
    ctx.resetState();
    return 'onboarding';
  },
};

export const onboarding = {
  id: 'onboarding',
  title: 'Онбординг',
  env: { mode: 'system', status: true },
  async run(ctx) {
    const { ui, T, state, C, audio } = ctx;
    ui.stage.classList.add('center');
    const splash = h('div', { class: 'splash' },
      h('div', { class: 'splash-logo', html: LOGO }),
      h('div', { class: 'brand' }, C.meta.app),
      h('div', { class: 'tagline' }, T('onb.tagline')),
      // расшифровка аббревиатуры и номер сборки — тот же 0412, что у фото из бассейна
      h('div', { class: 'splash-foot mono' }, h('span', {}, C.meta.appFull), h('span', {}, 'сборка 4.2 · 0412')));
    ui.stage.append(splash);
    audio.uiTick();
    await ctx.wait(2800);
    splash.classList.add('small');
    await ctx.say('onb.hello', { hold: 300 });

    // имя
    const input = h('input', { id: 'name-in', class: 'input', autocomplete: 'off', maxlength: '24', placeholder: T('onb.namePh'), enterkeyhint: 'done' });
    const form = h('form', { class: 'card form' },
      h('label', { for: 'name-in', class: 'label' }, T('onb.name')),
      input,
      h('button', { class: 'btn primary', type: 'submit' }, T('onb.next')));
    ui.stage.append(form);
    ctx.say('onb.name', { hold: 0 }).catch(() => {});
    const submitted = once(form, 'submit', ctx.signal);
    form.addEventListener('submit', (e) => e.preventDefault());
    await submitted;
    input.blur();
    state.name = input.value.trim().slice(0, 24);
    audio.uiTick();
    form.remove();

    // род обращения
    const card = h('div', { class: 'card form' }, h('div', { class: 'label' }, T('onb.gender')));
    ui.stage.append(card);
    ctx.say('onb.gender', { hold: 0 }).catch(() => {});
    const g = await ui.choice([T('onb.male'), T('onb.female')], { signal: ctx.signal, container: card });
    state.gender = g === 1 ? 'f' : 'm';
    audio.uiTick();
    card.remove();
    ui.sysHide();

    // соглашение
    let clause = null;
    const list = h('div', { class: 'tos-list', tabindex: '0' }, C.tos.map((p) => {
      const el = h('p', { class: p.startsWith('14.3') ? 'clause' : '' }, p);
      if (p.startsWith('14.3')) clause = el;
      return el;
    }));
    const tos = h('div', { class: 'card tos' }, h('h2', { class: 'tos-title' }, T('onb.tos')), list);
    ui.stage.append(tos);
    let read = false;
    list.addEventListener('scroll', () => {
      if (clause && list.scrollTop + list.clientHeight > clause.offsetTop + clause.offsetHeight * 0.5) read = true;
    });
    await ui.choice([T('onb.accept')], { signal: ctx.signal, container: tos });
    tos.remove();
    state.readTos = read;
    if (read) await ctx.say('onb.tosRead');

    // подпись
    const pad = await signaturePad(ctx, { clearLabel: T('onb.signClear'), doneLabel: T('onb.signDone') });
    const sigCard = h('div', { class: 'card form' }, h('div', { class: 'label' }, T('onb.sign')), pad.box);
    ui.stage.append(sigCard);
    ctx.say('onb.sign', { hold: 0 }).catch(() => {});
    state.signature = await pad.run();
    audio.whoosh();
    sigCard.remove();
    ui.sysHide();
    ctx.save();
  },
};

export const calibration = {
  id: 'calibration',
  title: 'Калибровка голоса',
  env: { mode: 'system', status: true },
  async run(ctx) {
    const { ui, T, mic, rt, C, platform } = ctx;
    ui.stage.classList.add('center');
    const bar = h('i');
    const meter = h('div', { class: 'meter', 'aria-hidden': 'true' }, bar);
    const card = h('div', { class: 'card form calib' }, h('div', { class: 'splash-logo small', html: LOGO }), meter);
    ui.stage.append(card);
    await ctx.say('cal.mic', { hold: 200 });
    await ui.choice([T('cal.allow')], { signal: ctx.signal, container: card });
    const ok = await mic.start();
    rt.micOK = ok;
    if (ok) {
      const show = (over) => { bar.style.width = `${Math.max(2, Math.min(100, over * 4))}%`; };
      ctx.every(60, () => show(mic.over()));
      await ctx.say('cal.quiet', { hold: 0 });
      await mic.calibrate(C.timing.calibQuietMs, ctx.signal);
      await ctx.say('cal.say', { hold: 0 });
      let rec = await mic.record(C.timing.calibRecordMs, { signal: ctx.signal });
      if (rec.peakOver < 10) {
        await ctx.say('cal.retry', { hold: 0 });
        rec = await mic.record(C.timing.calibRecordMs, { signal: ctx.signal });
      }
      rt.voice = rec.peakOver >= 8 ? rec.buffer : null;
      mic.stop();
      await ctx.say('cal.ok');
    } else {
      await ctx.say('cal.noMic');
    }
    if (platform.canNotify) {
      await ctx.say('cal.notify', { hold: 200 });
      await platform.notifyPermission();
    }
    ui.setSession(C.meta.session);
    await ctx.say('cal.session', { hold: 1200 });
  },
};
