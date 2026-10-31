import { emptyState, validateState } from './data.js';

const STORAGE_KEY = 'can-i-bunk.v1';

function detail(error) {
  return error instanceof Error ? error.message : String(error);
}

// Resolve the browser default inside the caller's try block. Some browsers
// expose a localStorage getter that throws when persistence is blocked.
function resolveStorage(storage) {
  const target = storage === undefined ? globalThis.localStorage : storage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new Error('Browser storage is unavailable.');
  }
  return target;
}

export function loadState(storage) {
  let saved;
  try {
    saved = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch (error) {
    return {
      state: emptyState(),
      error: `Could not read saved attendance. Changes cannot be trusted to persist: ${detail(error)}`
    };
  }

  if (saved === null) return { state: emptyState(), error: null, raw: null };

  try {
    const state = JSON.parse(saved);
    validateState(state);
    return { state, error: null, raw: saved };
  } catch (error) {
    // Never delete or replace the original value. The app must ask the user
    // to explicitly start fresh before it enables saving after this error.
    return {
      state: emptyState(),
      error: `Saved attendance could not be loaded. Your original saved data has been kept. Choose to start fresh before saving again: ${detail(error)}`
    };
  }
}

export function saveState(state, storage, options = {}) {
  try {
    validateState(state);
    const serialized = JSON.stringify(state);
    const target = resolveStorage(storage);
    if (Object.hasOwn(options, 'expectedRaw') && target.getItem(STORAGE_KEY) !== options.expectedRaw) {
      return {ok:false, conflict:true, error:'Another tab changed this planner. Saving is paused. Reload to use the newer records.'};
    }
    target.setItem(STORAGE_KEY, serialized);
    return { ok: true, error: null, raw: serialized };
  } catch (error) {
    return {
      ok: false,
      error: `Attendance was not saved. Keep this page open to retain your current changes: ${detail(error)}`
    };
  }
}

/** Each open tab keeps its last-read snapshot and refuses stale writes. */
export function createPersistence(storage) {
  const loaded = loadState(storage);
  let expectedRaw = loaded.raw ?? null;
  let paused = Boolean(loaded.error);
  let reason = loaded.error;
  function save(state) {
    if (paused) return {ok:false, conflict:true, error:reason || 'Saving is paused. Reload before editing.'};
    const result = saveState(state, storage, {expectedRaw});
    if (result.ok) expectedRaw = result.raw;
    if (result.conflict) { paused = true; reason = result.error; }
    return result;
  }
  return {
    loaded,
    get paused() { return paused; },
    save,
    pause(message = 'Another tab changed this planner. Reload before editing.') { paused = true; reason = message; },
    // Called only after the user explicitly confirms replacing unreadable data.
    replace(state) {
      try { expectedRaw = resolveStorage(storage).getItem(STORAGE_KEY); }
      catch (error) { return {ok:false,error:`Could not replace saved data: ${detail(error)}`}; }
      paused = false;
      const result = save(state);
      if (!result.ok) { paused = true; reason = result.error; }
      return result;
    }
  };
}
