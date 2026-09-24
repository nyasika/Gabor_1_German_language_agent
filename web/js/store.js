// Local persistence. Every mutation goes through save(), which writes immediately.
import { defaultState } from './progress.js';

const KEY = 'wortweg.state.v1';

export function createStore(storage, key = KEY) {
  let state = load();
  let savedAt = null;
  let error = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } };
      }
    } catch (e) {
      error = e;
    }
    return defaultState();
  }

  function persist() {
    try {
      storage.setItem(key, JSON.stringify(state));
      savedAt = Date.now();
      error = null;
    } catch (e) {
      error = e;
    }
    for (const fn of listeners) fn();
  }

  return {
    get: () => state,
    save(mutator) {
      if (mutator) mutator(state);
      state.updatedAt = Date.now();
      persist();
    },
    replace(next) {
      state = { ...defaultState(), ...next, settings: { ...defaultState().settings, ...(next.settings || {}) } };
      persist();
    },
    status: () => ({ savedAt, error }),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    exportJson: () => JSON.stringify(state, null, 2),
    importJson(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.log || !parsed.cards) {
        throw new Error('Not a Wortweg backup file');
      }
      this.replace(parsed);
    },
  };
}
