/**
 * Store centralizado (publish/subscribe con inmutabilidad superficial).
 * Es la única fuente de verdad del estado de la aplicación. Los componentes se
 * suscriben y comparan referencias (s.x !== prev.x) para decidir si re-renderizar.
 */
let state = null;
const listeners = new Set();

export function initStore(initial) { state = initial; }
export function getState() { return state; }

export function setState(updater) {
  const prev = state;
  const patch = typeof updater === 'function' ? updater(prev) : updater;
  if (!patch) return;
  state = { ...prev, ...patch };
  for (const fn of listeners) {
    try { fn(state, prev); } catch (err) { console.error('[store] error en suscriptor', err); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Helpers de actualización (evitan mutaciones accidentales) ---------- */

export function setQuery(patch, { resetPage = true } = {}) {
  setState((s) => ({ query: { ...s.query, ...patch, ...(resetPage ? { page: 1 } : {}) } }));
}

export function setFilters(patch) {
  setState((s) => ({ query: { ...s.query, filters: { ...s.query.filters, ...patch }, page: 1 } }));
}

export function setColumnFilter(key, value) {
  setState((s) => ({
    query: { ...s.query, columnFilters: { ...s.query.columnFilters, [key]: value }, page: 1 },
  }));
}

export function setPrefs(patch) { setState((s) => ({ prefs: { ...s.prefs, ...patch } })); }
export function setUi(patch) { setState((s) => ({ ui: { ...s.ui, ...patch } })); }
