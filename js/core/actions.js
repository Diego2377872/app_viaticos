/**
 * Capa de lógica de negocio / orquestación.
 * Conecta el estado (store) con la fuente de datos (service). La UI solo llama a estas
 * funciones: no accede directamente a Supabase.
 */
import { getState, setState, subscribe } from './store.js';
import { ANIO_ACTUAL, STORAGE_KEYS } from '../config.js';
import { EMPTY_FILTERS, savableQuery, normalizeQuery } from '../services/queryModel.js';
import { exportCSV, exportXLSX } from '../utils/exporters.js';
import { todayISO } from '../utils/format.js';
import { toast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

let service = null;
let tableReq = 0;
let summaryReq = 0;
let countReq = 0;
let lastLocalWrite = 0;
let tTimer, sTimer, rtTimer;

const summaryKey = (q) => JSON.stringify({
  scope: q.scope, archivoAnio: q.archivoAnio, search: q.search, filters: q.filters, columnFilters: q.columnFilters,
});

export const getService = () => service;

export function initActions(svc) {
  service = svc;
  // Reacciona a cambios de consulta: la tabla siempre; KPIs/gráficos solo si cambian los criterios.
  subscribe((s, p) => {
    if (s.query === p.query || JSON.stringify(s.query) === JSON.stringify(p.query)) return;
    clearTimeout(tTimer);
    tTimer = setTimeout(loadTable, 80);
    if (summaryKey(s.query) !== summaryKey(p.query)) {
      clearTimeout(sTimer);
      sTimer = setTimeout(loadSummary, 150);
      if (s.selection.size) setState({ selection: new Map() });
    }
  });
}

/* ------------------------------ Cargas ------------------------------ */

export async function loadTable() {
  const id = ++tableReq;
  const q = getState().query;
  const t0 = performance.now();
  setState((s) => ({ table: { ...s.table, loading: true, error: null } }));
  try {
    const { rows, total } = await service.list(q);
    if (id !== tableReq) return; // respuesta obsoleta: hubo una consulta más reciente
    const maxPage = Math.max(1, Math.ceil(total / q.pageSize));
    if (q.page > maxPage && total > 0) { setState((s) => ({ query: { ...s.query, page: maxPage } })); return; }
    setState({ table: { rows, total, loading: false, error: null, lastMs: Math.round(performance.now() - t0), loadedAt: new Date() } });
  } catch (e) {
    if (id !== tableReq) return;
    setState((s) => ({ table: { ...s.table, loading: false, error: e.message } }));
  }
}

export async function loadSummary() {
  const id = ++summaryReq;
  const q = getState().query;
  setState((s) => ({ summary: { ...s.summary, loading: true, error: null } }));
  try {
    const data = await service.summary(q);
    if (id !== summaryReq) return;
    setState({ summary: { data, loading: false, error: null } });
  } catch (e) {
    if (id !== summaryReq) return;
    setState((s) => ({ summary: { ...s.summary, loading: false, error: e.message } }));
  }
}

export async function loadScopeCounts() {
  const id = ++countReq;
  const base = { ...getState().query, archivoAnio: '', search: '', filters: { ...EMPTY_FILTERS }, columnFilters: {} };
  try {
    const [actual, archivo] = await Promise.all([
      service.count({ ...base, scope: 'actual' }),
      service.count({ ...base, scope: 'archivo' }),
    ]);
    if (id === countReq) setState({ scopeCounts: { actual, archivo } });
  } catch (e) { console.warn('[conteos]', e); }
}

export async function loadDistinct() {
  try { setState({ distinct: await service.distinct() }); } catch (e) { console.warn('[valores distintos]', e); }
}

export function refreshAll() {
  service.invalidate();
  loadTable(); loadSummary(); loadScopeCounts(); loadDistinct();
}

export function startRealtime() {
  return service.subscribe((payload) => {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(refreshAll, 350);
    if (Date.now() - lastLocalWrite > 4000) {
      const map = { INSERT: 'Se agregó un registro', UPDATE: 'Se actualizó un registro', DELETE: 'Se eliminó un registro' };
      toast(`${map[payload.eventType] || 'Datos actualizados'} desde otro dispositivo`, 'info');
    }
  }, (status) => setState({ connection: status }));
}

/* ------------------------------ Escrituras ------------------------------ */

const readPending = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING) || '[]'); } catch { return []; } };
export const pendingCount = () => readPending().length;

export async function saveRecord(id, payload) {
  if (!id && !navigator.onLine && service.mode === 'supabase') {
    const pend = readPending();
    pend.push({ datos: payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(pend));
    setState({ pendingCount: pend.length });
    return { queued: true };
  }
  lastLocalWrite = Date.now();
  const rec = id ? await service.update(id, payload) : await service.create(payload);
  lastLocalWrite = Date.now();
  refreshAll();
  return rec;
}

export async function syncPending() {
  if (service.mode !== 'supabase' || !navigator.onLine) return;
  const pend = readPending();
  if (!pend.length) return;
  const rest = [];
  let ok = 0;
  for (const item of pend) {
    try { lastLocalWrite = Date.now(); await service.create(item.datos); ok += 1; } catch { rest.push(item); }
  }
  if (rest.length) localStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(rest));
  else localStorage.removeItem(STORAGE_KEYS.PENDING);
  setState({ pendingCount: rest.length });
  if (ok) { toast(`${ok} registro(s) guardado(s) sin conexión se sincronizaron`, 'success'); refreshAll(); }
  if (rest.length) toast(`${rest.length} registro(s) pendiente(s) no se pudieron sincronizar; se reintentará`, 'warning');
}

export const uploadImages = (files) => service.uploadImages(files);

export async function deleteRecords(ids) {
  if (!ids.length) return false;
  const many = ids.length > 1;
  const ok = await confirmDialog({
    title: many ? `Eliminar ${ids.length} registros` : 'Eliminar registro',
    message: many
      ? `Se eliminarán definitivamente ${ids.length} registros seleccionados. Esta acción no se puede deshacer.`
      : 'El registro se eliminará definitivamente. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar', danger: true,
  });
  if (!ok) return false;
  try {
    lastLocalWrite = Date.now();
    if (many) {
      const n = await service.removeMany(ids);
      if (n < ids.length) toast(`Se eliminaron ${n} de ${ids.length} registros (revise permisos)`, 'warning');
      else toast(`${n} registros eliminados`, 'success');
    } else {
      await service.remove(ids[0]);
      toast('Registro eliminado', 'success');
    }
    lastLocalWrite = Date.now();
    const sel = new Map(getState().selection);
    ids.forEach((i) => sel.delete(i));
    setState({ selection: sel });
    refreshAll();
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
}

/* ------------------------------ Exportación ------------------------------ */

export async function exportData(format, { selectedOnly = false } = {}) {
  const s = getState();
  try {
    let rows;
    if (selectedOnly) rows = [...s.selection.values()];
    else {
      toast('Preparando exportación de los resultados filtrados…', 'info', { timeout: 2500 });
      rows = await service.fetchAll(s.query);
    }
    if (!rows.length) { toast('No hay datos para exportar con los criterios actuales', 'warning'); return; }
    const q = s.query;
    const scope = q.scope === 'actual' ? `Anio_${ANIO_ACTUAL}` : `Archivo_${q.archivoAnio || 'todos'}`;
    const name = `Viajes_UGR_${scope}${selectedOnly ? '_seleccion' : ''}_${todayISO()}`;
    if (format === 'csv') exportCSV(rows, `${name}.csv`);
    else await exportXLSX(rows, `${name}.xlsx`);
    toast(`${rows.length} registro(s) exportado(s) a ${format === 'csv' ? 'CSV' : 'Excel'}`, 'success');
  } catch (e) {
    toast(`Error al exportar: ${e.message}`, 'error');
  }
}

/* ------------------------------ Filtros ------------------------------ */

export function clearAllFilters() {
  setState((s) => ({ query: { ...s.query, search: '', filters: { ...EMPTY_FILTERS }, columnFilters: {}, page: 1 } }));
}

export function saveCurrentFilter(name) {
  const s = getState();
  const list = (s.prefs.savedFilters || []).filter((f) => f.name !== name);
  list.unshift({ name, query: savableQuery(s.query), createdAt: new Date().toISOString() });
  setState({ prefs: { ...s.prefs, savedFilters: list.slice(0, 30) } });
  toast(`Filtro “${name}” guardado`, 'success');
}

export function applySavedFilter(f) {
  setState((s) => ({ query: normalizeQuery({ ...f.query, pageSize: s.query.pageSize }, s.query.pageSize) }));
  toast(`Filtro “${f.name}” aplicado`, 'info', { timeout: 2500 });
}

export function deleteSavedFilter(name) {
  setState((s) => ({ prefs: { ...s.prefs, savedFilters: (s.prefs.savedFilters || []).filter((f) => f.name !== name) } }));
}
