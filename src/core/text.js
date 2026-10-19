// Подстановки в тексты сценария:
//   {name}          — имя игрока
//   {муж|жен}       — форма по выбранному роду, например «сказал{|а}», «решил{ся|ась}»
//   {любой_ключ}    — значение из vars
export function fmt(str, state, vars = {}) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (state.gender === 'f' ? f : m))
    .replace(/\{(\w+)\}/g, (all, key) => {
      if (key in vars) return vars[key];
      if (key === 'name') return state.name || 'Пользователь';
      return all;
    });
}

// Текст для синтеза речи: без ремарок в квадратных скобках и эмодзи.
export function speakable(text) {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
