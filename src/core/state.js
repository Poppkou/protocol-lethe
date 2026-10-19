import { storage } from './dom.js';

const SAVE_KEY = 'lethe.save.v1';

export function freshState(settings) {
  return {
    name: '',
    gender: 'm',
    scene: null, // последняя начатая сцена (для «Продолжить сеанс»)
    ending: null, // 'A' | 'B' | 'C' после финала
    readTos: false,
    recognized: null,
    listened: {}, // id голосового -> прослушано до конца
    deleted: {}, // id голосового -> удалено без прослушивания
    flippedEarly: false,
    strikes: 0,
    signature: null, // штрихи подписи [[x,y], ...] в долях 0..1
    settings: settings || { tts: true, lowFlash: false, tapHold: false },
  };
}

export function loadSave() {
  const s = storage(SAVE_KEY);
  return s && typeof s === 'object' ? s : null;
}

export function writeSave(state) {
  storage(SAVE_KEY, state);
}

export function clearSave() {
  storage(SAVE_KEY, null);
}

// Всё, что нельзя или не нужно сохранять (запись голоса, буферы), живёт здесь.
export const runtime = {
  voice: null, // AudioBuffer с фразой «Я хочу забыть» — только в памяти
  micOK: false,
  motionOK: false,
  canVibrate: false,
  battery: null,
  away: null,
};
