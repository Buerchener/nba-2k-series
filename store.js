(() => {
  "use strict";

  const engine = globalThis.SeriesEngine;
  const listeners = new Set();
  let state;
  let mode;
  let lastDiskText = null;
  let unsavedChanges = false;

  // A reference returned by get() also identifies the revision an editor opened.
  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
    return value;
  }

  function notify(reason) {
    for (const listener of listeners) {
      try { listener(reason); } catch (error) { console.error(error); }
    }
  }

  function readDisk() {
    return globalThis.localStorage.getItem(engine.KEY);
  }

  function load(text) {
    lastDiskText = text;
    unsavedChanges = false;
    try {
      state = freeze(text === null ? engine.create() : engine.decode(text));
      mode = "saved";
    } catch {
      // Keep the original bytes available to export until a confirmed import.
      state = freeze(engine.create());
      mode = "corrupt";
    }
  }

  function loadExternal(text) {
    load(text);
    notify("external");
    if (mode === "corrupt") notify("warning");
  }

  function stale() {
    return new Error("比赛记录已有更新，请核对最新比分后重新操作。");
  }

  function write(transform, expectedState, replacing) {
    if (state !== expectedState) throw stale();

    let readable = true;
    let diskText;
    try {
      diskText = readDisk();
    } catch {
      readable = false;
    }

    if (readable && diskText !== lastDiskText && !unsavedChanges) {
      loadExternal(diskText);
      throw stale();
    }
    if (mode === "corrupt" && !replacing) {
      throw new Error("本机存档无法读取。可以先导出原文件，再导入有效备份以恢复记分。");
    }

    const text = engine.encode(transform(state));
    const candidate = freeze(JSON.parse(text));
    // A quota error can leave this tab with a newer unsaved game. If another
    // tab edits the disk copy meanwhile, retain both until an explicit import.
    let saved = false;
    if (readable && (diskText === lastDiskText || replacing)) {
      try {
        globalThis.localStorage.setItem(engine.KEY, text);
        lastDiskText = text;
        saved = true;
      } catch { /* Private browsing and exhausted storage can reject a write. */ }
    }
    state = candidate;
    mode = saved ? "saved" : "memory";
    unsavedChanges = !saved;
    notify("change");
    if (!saved) notify("warning");
    return state;
  }

  async function serialized(action) {
    let entered = false;
    try {
      const locks = globalThis.navigator?.locks;
      if (locks) {
        return await locks.request(engine.KEY, () => {
          entered = true;
          return action();
        });
      }
    } catch (error) {
      if (entered) throw error;
      // Some file URLs expose Web Locks but deny access to them.
    }
    return action();
  }

  try {
    load(readDisk());
  } catch {
    state = freeze(engine.create());
    mode = "memory";
  }

  globalThis.addEventListener("storage", event => {
    if (event.key !== engine.KEY && event.key !== null) return;
    // Read the latest value in case several browser events arrived together.
    let text;
    try {
      if (event.storageArea && event.storageArea !== globalThis.localStorage) return;
      text = readDisk();
    } catch {
      if (mode !== "corrupt") mode = "memory";
      notify("warning");
      return;
    }
    if (text === lastDiskText) return;
    if (unsavedChanges) {
      notify("warning");
      return;
    }
    loadExternal(text);
  });

  globalThis.ScoreStore = Object.freeze({
    get: () => state,
    status: () => mode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(transform, expectedState = state) {
      return serialized(() => write(transform, expectedState, false));
    },
    replace(incoming, expectedState = state) {
      return serialized(() => write(() => incoming, expectedState, true));
    },
    rawBackup() {
      return mode === "corrupt" ? lastDiskText : engine.encode(state);
    }
  });
})();
