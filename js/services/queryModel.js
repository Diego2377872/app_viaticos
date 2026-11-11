/**
 * Modelo de consulta: traduce el estado de filtros a
 *  (a) filtros PostgREST del lado del servidor (applyFilters) y
 *  (b) un predicado equivalente en memoria (compileMatcher, usado por el modo demo).
 * Mantener ambas implementaciones con la misma semántica.
 */
import { ANIO_ACTUAL, MESES, COLUMNS, CONFIG } from '../config.js';
import { fmtDate, fmtNumber } from '../utils/format.js';

export const EMPTY_FILTERS = Object.freeze({
  mes: '', fechaDesde: '', fechaHasta: '', viatico: '', permiso: '', lugar: '',
  kmMin: '', kmMax: '', montoMin: '', montoMax: '',
});

export const SEARCH_FIELDS = ['actividad', 'lugar', 'numero_cuaderno', 'numero_expediente', 'permiso', 'observaciones'];
const TEXT_COLS = new Set(COLUMNS.filter((c) => c.filter === 'text').map((c) => c.key));
const EXACT_COLS = new Set(COLUMNS.filter((c) => c.filter === 'select').map((c) => c.key));
const SORTABLE = new Set(COLUMNS.filter((c) => c.sortable !== false).map((c) => c.sortField || c.key));

export function defaultQuery(pageSize = CONFIG.DEFAULT_PAGE_SIZE) {
  return {
    scope: 'actual', archivoAnio: '', search: '',
    filters: { ...EMPTY_FILTERS }, columnFilters: {},
    sort: { field: 'fecha_desde', dir: 'desc' },
    page: 1, pageSize,
  };
}

/** Sanea una consulta recuperada de localStorage (versiones viejas, valores inválidos). */
export function normalizeQuery(raw, pageSize = CONFIG.DEFAULT_PAGE_SIZE) {
  const base = defaultQuery(pageSize);
  if (!raw || typeof raw !== 'object') return base;
  const q = {
    ...base, ...raw,
    filters: { ...EMPTY_FILTERS, ...(raw.filters || {}) },
    columnFilters: { ...(raw.columnFilters || {}) },
    page: 1,
  };
  if (!['actual', 'archivo'].includes(q.scope)) q.scope = 'actual';
  if (!q.sort || !SORTABLE.has(q.sort.field)) q.sort = { ...base.sort };
  if (!['asc', 'desc'].includes(q.sort.dir)) q.sort = { ...q.sort, dir: 'desc' };
  q.pageSize = CONFIG.PAGE_SIZES.includes(Number(q.pageSize)) ? Number(q.pageSize) : base.pageSize;
  for (const k of Object.keys(q.columnFilters)) if (!TEXT_COLS.has(k) && !EXACT_COLS.has(k)) delete q.columnFilters[k];
  for (const k of Object.keys(q.filters)) if (!(k in EMPTY_FILTERS)) delete q.filters[k];
  q.search = String(q.search || '');
  q.archivoAnio = q.archivoAnio ? String(q.archivoAnio) : '';
  return q;
}

export const savableQuery = (q) => ({
  scope: q.scope, archivoAnio: q.archivoAnio, search: q.search,
  filters: { ...q.filters }, columnFilters: { ...q.columnFilters }, sort: { ...q.sort },
});

/* ---------------------------- Rango de fechas ---------------------------- */

const pad = (n) => String(n).padStart(2, '0');
function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const maxStr = (a) => (a.length ? a.reduce((x, y) => (x > y ? x : y)) : null);
const minStr = (a) => (a.length ? a.reduce((x, y) => (x < y ? x : y)) : null);

/** Año al que aplica el filtro de mes (null si el ámbito abarca varios años). */
export function monthYearFor(q) {
  if (q.scope === 'actual') return ANIO_ACTUAL;
  if (q.scope === 'archivo' && q.archivoAnio) return Number(q.archivoAnio);
  return null;
}

/** Intersección de todos los criterios de fecha → [from, toExclusive) sobre fecha_desde. */
export function dateBounds(q) {
  const lowers = [];
  const uppers = [];
  if (q.scope === 'actual') {
    lowers.push(`${ANIO_ACTUAL}-01-01`); uppers.push(`${ANIO_ACTUAL + 1}-01-01`);
  } else if (q.scope === 'archivo') {
    uppers.push(`${ANIO_ACTUAL}-01-01`);
    if (q.archivoAnio) { lowers.push(`${q.archivoAnio}-01-01`); uppers.push(`${Number(q.archivoAnio) + 1}-01-01`); }
  }
  const f = q.filters || EMPTY_FILTERS;
  const y = monthYearFor(q);
  if (f.mes && y) {
    const m = Number(f.mes);
    lowers.push(`${y}-${pad(m)}-01`);
    uppers.push(m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`);
  }
  if (f.fechaDesde) lowers.push(f.fechaDesde);
  if (f.fechaHasta) uppers.push(addDaysISO(f.fechaHasta, 1));
  return { from: maxStr(lowers), toExclusive: minStr(uppers) };
}

/** Elimina caracteres reservados de la sintaxis de filtros de PostgREST y comodines. */
export const sanitizeTerm = (v) => String(v ?? '').replace(/[%*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/* ------------------------- Filtros del lado servidor ------------------------- */

export function applyFilters(b, q) {
  const { from, toExclusive } = dateBounds(q);
  if (from) b = b.gte('fecha_desde', from);
  if (toExclusive) b = b.lt('fecha_desde', toExclusive);

  const f = q.filters || EMPTY_FILTERS;
  if (f.viatico) b = b.eq('viatico', f.viatico);
  if (f.permiso) b = b.eq('permiso', f.permiso);
  const lugar = sanitizeTerm(f.lugar);
  if (lugar) b = b.ilike('lugar', `%${lugar}%`);

  const kmMin = num(f.kmMin), kmMax = num(f.kmMax), mMin = num(f.montoMin), mMax = num(f.montoMax);
  if (kmMin !== null) b = b.gte('km_recorrido', kmMin);
  if (kmMax !== null) b = b.lte('km_recorrido', kmMax);
  if (mMin !== null) b = b.gte('monto', mMin);
  if (mMax !== null) b = b.lte('monto', mMax);

  const s = sanitizeTerm(q.search);
  if (s) b = b.or(SEARCH_FIELDS.map((c) => `${c}.ilike."%${s}%"`).join(','));

  for (const [col, val] of Object.entries(q.columnFilters || {})) {
    if (!val) continue;
    if (EXACT_COLS.has(col)) b = b.eq(col, val);
    else if (TEXT_COLS.has(col)) {
      const t = sanitizeTerm(val);
      if (t) b = b.ilike(col, `%${t}%`);
    }
  }
  return b;
}

/* ------------------------- Predicado en memoria (demo) ------------------------- */

export function compileMatcher(q) {
  const { from, toExclusive } = dateBounds(q);
  const f = q.filters || EMPTY_FILTERS;
  const low = (v) => String(v ?? '').toLowerCase();
  const lugar = sanitizeTerm(f.lugar).toLowerCase();
  const s = sanitizeTerm(q.search).toLowerCase();
  const ranges = [['km_recorrido', num(f.kmMin), num(f.kmMax)], ['monto', num(f.montoMin), num(f.montoMax)]]
    .filter(([, a, b]) => a !== null || b !== null);
  const colText = Object.entries(q.columnFilters || {})
    .filter(([k, v]) => v && TEXT_COLS.has(k)).map(([k, v]) => [k, sanitizeTerm(v).toLowerCase()]).filter(([, v]) => v);
  const colExact = Object.entries(q.columnFilters || {}).filter(([k, v]) => v && EXACT_COLS.has(k));

  return (r) => {
    const d = r.fecha_desde || '';
    if (from && d < from) return false;
    if (toExclusive && d >= toExclusive) return false;
    if (f.viatico && r.viatico !== f.viatico) return false;
    if (f.permiso && r.permiso !== f.permiso) return false;
    if (lugar && !low(r.lugar).includes(lugar)) return false;
    for (const [k, min, max] of ranges) {
      const v = Number(r[k]) || 0;
      if (min !== null && v < min) return false;
      if (max !== null && v > max) return false;
    }
    if (s && !SEARCH_FIELDS.some((c) => low(r[c]).includes(s))) return false;
    for (const [k, v] of colText) if (!low(r[k]).includes(v)) return false;
    for (const [k, v] of colExact) if (r[k] !== v) return false;
    return true;
  };
}

/* ------------------------- Descripción de filtros activos ------------------------- */

const has = (v) => v !== '' && v != null;
const rangeLabel = (a, b) => (has(a) && has(b) ? `${fmtNumber(a)} – ${fmtNumber(b)}` : has(a) ? `≥ ${fmtNumber(a)}` : `≤ ${fmtNumber(b)}`);

/** Lista de "chips" de filtros activos, cada uno con su función para quitarlo. */
export function describeFilters(q) {
  const chips = [];
  const f = q.filters || EMPTY_FILTERS;
  const clearF = (keys) => (x) => ({ ...x, filters: { ...x.filters, ...Object.fromEntries(keys.map((k) => [k, ''])) } });

  if (q.search) chips.push({ id: 'search', label: `Búsqueda: “${q.search}”`, clear: (x) => ({ ...x, search: '' }) });
  if (f.mes && monthYearFor(q)) chips.push({ id: 'mes', label: `Mes: ${MESES[Number(f.mes) - 1]}`, clear: clearF(['mes']) });
  if (f.fechaDesde || f.fechaHasta) {
    chips.push({ id: 'fechas', label: `Fechas: ${f.fechaDesde ? fmtDate(f.fechaDesde) : '…'} – ${f.fechaHasta ? fmtDate(f.fechaHasta) : '…'}`, clear: clearF(['fechaDesde', 'fechaHasta']) });
  }
  if (f.viatico) chips.push({ id: 'viatico', label: `Viático: ${f.viatico}`, clear: clearF(['viatico']) });
  if (f.permiso) chips.push({ id: 'permiso', label: `Estado: ${f.permiso}`, clear: clearF(['permiso']) });
  if (f.lugar) chips.push({ id: 'lugar', label: `Lugar contiene: “${f.lugar}”`, clear: clearF(['lugar']) });
  if (has(f.kmMin) || has(f.kmMax)) chips.push({ id: 'km', label: `Km: ${rangeLabel(f.kmMin, f.kmMax)}`, clear: clearF(['kmMin', 'kmMax']) });
  if (has(f.montoMin) || has(f.montoMax)) chips.push({ id: 'monto', label: `Monto: ${rangeLabel(f.montoMin, f.montoMax)}`, clear: clearF(['montoMin', 'montoMax']) });

  for (const [k, v] of Object.entries(q.columnFilters || {})) {
    if (!v) continue;
    const col = COLUMNS.find((c) => c.key === k);
    chips.push({
      id: `col:${k}`,
      label: `${col ? col.label : k}: ${EXACT_COLS.has(k) ? v : `“${v}”`}`,
      clear: (x) => ({ ...x, columnFilters: { ...x.columnFilters, [k]: '' } }),
    });
  }
  return chips;
}

export const scopeLabel = (q) => (q.scope === 'actual'
  ? `Año activo ${ANIO_ACTUAL}`
  : `Archivo histórico${q.archivoAnio ? ` · ${q.archivoAnio}` : ' · todos los años'}`);
