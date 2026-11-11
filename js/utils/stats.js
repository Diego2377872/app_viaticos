/** Estadísticas descriptivas sobre el conjunto filtrado (KPIs, gráficos, resumen). */
import { ANIO_ACTUAL } from '../config.js';

const pad = (n) => String(n).padStart(2, '0');

export function computeSummary(rows, q) {
  const count = rows.length;
  let totalKm = 0, cobrado = 0, pendiente = 0, montoTotal = 0;
  const kms = new Array(count);
  const byMonth = new Map();
  const byEstado = new Map();
  const byLugar = new Map();

  rows.forEach((r, i) => {
    const km = Number(r.km_recorrido) || 0;
    const monto = Number(r.monto) || 0;
    const ok = r.viatico === 'Sí';
    totalKm += km; kms[i] = km; montoTotal += monto;
    if (ok) cobrado += monto; else pendiente += monto;

    const key = String(r.fecha_desde || '').slice(0, 7);
    if (key) {
      const m = byMonth.get(key) || { km: 0, cobrado: 0, pendiente: 0, count: 0 };
      m.km += km; m.count += 1;
      if (ok) m.cobrado += monto; else m.pendiente += monto;
      byMonth.set(key, m);
    }
    const est = String(r.permiso || '').trim() || 'Sin estado';
    byEstado.set(est, (byEstado.get(est) || 0) + 1);
    const lug = String(r.lugar || '').trim() || 'Sin lugar';
    byLugar.set(lug, (byLugar.get(lug) || 0) + 1);
  });

  kms.sort((a, b) => a - b);
  const median = !count ? 0 : count % 2 ? kms[(count - 1) / 2] : (kms[count / 2 - 1] + kms[count / 2]) / 2;

  let monthKeys;
  const singleYear = q.scope === 'actual' ? ANIO_ACTUAL : (q.archivoAnio ? Number(q.archivoAnio) : null);
  if (singleYear) monthKeys = Array.from({ length: 12 }, (_, i) => `${singleYear}-${pad(i + 1)}`);
  else monthKeys = Array.from(byMonth.keys()).sort();

  return {
    count, totalKm, cobrado, pendiente, montoTotal,
    avgKm: count ? totalKm / count : 0,
    maxKm: count ? kms[count - 1] : 0,
    minKm: count ? kms[0] : 0,
    medianKm: median,
    avgMonto: count ? montoTotal / count : 0,
    pctCobrado: montoTotal ? (cobrado / montoTotal) * 100 : 0,
    viajesCobrados: rows.filter((r) => r.viatico === 'Sí').length,
    multiYear: !singleYear,
    months: monthKeys.map((k) => ({ key: k, ...(byMonth.get(k) || { km: 0, cobrado: 0, pendiente: 0, count: 0 }) })),
    byEstado: [...byEstado].sort((a, b) => b[1] - a[1]),
    topLugares: [...byLugar].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}
