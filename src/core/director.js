// Режиссёр: запускает сцены по порядку. Каждая сцена — async-функция run(ctx).
// Сцена может вернуть id следующей сцены; иначе идёт следующая по списку.
// jump(id) прерывает текущую сцену (через AbortSignal) и начинает с нужной.

export class Director {
  constructor(scenes, makeCtx) {
    this.scenes = scenes;
    this.makeCtx = makeCtx;
    this.speed = 1;
    this.current = null;
    this.running = false;
    this.jumpTo = null;
    this.ac = null;
    this.listeners = new Set();
  }

  onScene(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  find(id) {
    return this.scenes.find((s) => s.id === id);
  }

  async start(id) {
    this.running = true;
    let next = id;
    while (next) {
      const scene = this.find(next);
      if (!scene) break;
      this.ac = new AbortController();
      const ctx = this.makeCtx(this.ac.signal, scene);
      this.current = scene;
      for (const fn of this.listeners) fn(scene);
      let result;
      try {
        await ctx._enter();
        result = await scene.run(ctx);
      } catch (e) {
        await ctx._cleanup(true);
        if (e?.name === 'AbortError') {
          if (this.jumpTo) {
            next = this.jumpTo;
            this.jumpTo = null;
            continue;
          }
          break;
        }
        console.error(`[Лета] Ошибка в сцене ${scene.id}:`, e);
        next = this.after(scene.id);
        continue;
      }
      this.ac.abort(); // всё, что сцена оставила «висеть» (очередь реплик, печать), останавливается
      await ctx._cleanup(false);
      next = result || this.after(scene.id);
    }
    this.running = false;
  }

  after(id) {
    const i = this.scenes.findIndex((s) => s.id === id);
    const nxt = this.scenes[i + 1];
    return nxt && !nxt.manual ? nxt.id : null;
  }

  jump(id) {
    if (!this.find(id)) return;
    if (this.running) {
      this.jumpTo = id;
      this.ac?.abort();
    } else {
      this.start(id);
    }
  }
}
