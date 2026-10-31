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

  if (saved === null) return { state: emptyState(), error: null };

  try {
    const state = JSON.parse(saved);
    validateState(state);
    return { state, error: null };
  } catch (error) {
    // Never delete or replace the original value. The app must ask the user
    // to explicitly start fresh before it enables saving after this error.
    return {
      state: emptyState(),
      error: `Saved attendance could not be loaded. Your original saved data has been kept. Choose to start fresh before saving again: ${detail(error)}`
    };
  }
}

export function saveState(state, storage) {
  try {
    validateState(state);
    const serialized = JSON.stringify(state);
    resolveStorage(storage).setItem(STORAGE_KEY, serialized);
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: `Attendance was not saved. Keep this page open to retain your current changes: ${detail(error)}`
    };
  }
}
