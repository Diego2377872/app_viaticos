/**
 * Formateadores. Las fechas ISO (YYYY-MM-DD) se tratan como texto, nunca con new Date(),
 * para evitar el desplazamiento de zona horaria (UTC-3) que movía registros del 1° de enero
 * al año anterior en la versión previa.
 */
const nf0 = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 });
const nfc = new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtNumber = (v, decimals = 0) => (decimals ? nf1 : nf0).format(Number(v) || 0);
export const fmtMoney = (v) => `Gs ${nf0.format(Number(v) || 0)}`;
export const fmtCompact = (v) => nfc.format(Number(v) || 0);

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const fmtPeriod = (a, b) => (!b || a === b ? fmtDate(a) : `${fmtDate(a)} → ${fmtDate(b)}`);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function monthLabel(key, withYear = false) {
  const [y, m] = String(key).split('-');
  const name = MES_CORTO[Number(m) - 1] || key;
  return withYear ? `${name} ${String(y).slice(2)}` : name;
}

export const plural = (n, one, many) => `${fmtNumber(n)} ${n === 1 ? one : many}`;
