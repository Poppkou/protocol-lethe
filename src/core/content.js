import { storage } from './dom.js';

const DRAFT_KEY = 'lethe.content.draft';

// Порядок: черновик автора (localStorage) → опубликованный script.ru.json рядом со страницей → встроенный.
export async function loadContent(defaults, { remote = false } = {}) {
  let base = defaults;
  if (remote && /^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch('script.ru.json', { cache: 'no-store' });
      if (r.ok) base = await r.json();
    } catch {
      // файла рядом нет — играем со встроенным сценарием
    }
  }
  const draft = storage(DRAFT_KEY);
  return { base, draft: draft && typeof draft === 'object' ? draft : null };
}

export function saveDraft(data) {
  storage(DRAFT_KEY, data);
}

export function clearDraft() {
  storage(DRAFT_KEY, null);
}

// Дополняет content ключами из defaults, которых в нём нет (если сценарий старее кода).
export function fillMissing(content, defaults) {
  if (Array.isArray(defaults) || typeof defaults !== 'object' || defaults === null) return content ?? defaults;
  const out = { ...defaults, ...(content || {}) };
  for (const k of Object.keys(defaults)) {
    if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
      out[k] = fillMissing(content?.[k], defaults[k]);
    }
  }
  return out;
}
