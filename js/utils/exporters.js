/** Exportación de resultados filtrados o seleccionados a CSV (UTF-8 + BOM, separador ;) y Excel. */
import { CONFIG } from '../config.js';
import { loadScript } from './loadScript.js';

export function toExportRows(rows) {
  return rows.map((r) => ({
    'Fecha Desde': r.fecha_desde,
    'Fecha Hasta': r.fecha_hasta,
    'Actividad': r.actividad,
    'Lugar': r.lugar,
    'N° Cuaderno': r.numero_cuaderno,
    'Nº Expediente': r.numero_expediente,
    'Estado del Exp.': r.permiso,
    'Km Inicial': r.km_inicial,
    'Km Final': r.km_final,
    'Km Total': r.km_recorrido,
    'Viático Cobrado': r.viatico,
    'Monto': r.monto,
    'Observaciones': r.observaciones,
    'Evidencias': (r.imagenes || []).join(' | '),
  }));
}

/** Neutraliza fórmulas (=, +, -, @) en celdas de texto para evitar inyección en hojas de cálculo. */
const neutralize = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function exportCSV(rows, filename) {
  const data = toExportRows(rows);
  const headers = Object.keys(data[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(neutralize(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(';'), ...data.map((o) => headers.map((h) => esc(o[h])).join(';'))].join('\r\n');
  download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function exportXLSX(rows, filename) {
  await loadScript(CONFIG.XLSX_URL);
  const data = toExportRows(rows).map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, neutralize(v)])));
  const ws = window.XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0]).map((k) => ({ wch: Math.min(48, Math.max(10, k.length + 2)) }));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  window.XLSX.writeFile(wb, filename);
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
