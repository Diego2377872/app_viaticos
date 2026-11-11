/** Colores consistentes por estado del expediente (badges, gráficos). */
const KNOWN = {
  'pagado': '#10b981',
  'tesoreria': '#0ea5e9',
  'contabilidad': '#8b5cf6',
  'presupuesto': '#f59e0b',
  'control y seguimiento': '#ef4444',
  'obligado': '#14b8a6',
  'direccion administrativa': '#6366f1',
  'sin estado': '#94a3b8',
};
const PALETTE = ['#4361ee', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16', '#f97316'];

const normalize = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function colorFor(name) {
  const k = normalize(name);
  if (KNOWN[k]) return KNOWN[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function estadoBadge(name, esc) {
  if (!name || !String(name).trim()) return '<span class="muted">—</span>';
  return `<span class="badge" style="--b:${colorFor(name)}">${esc(name)}</span>`;
}

export function alpha(hex, a) {
  const h = String(hex).trim().replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
