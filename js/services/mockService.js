/**
 * Servicio simulado (modo demo: ?demo=100000).
 * Implementa la MISMA interfaz que actividadesService para probar la interfaz con
 * grandes volúmenes sin tocar la base de datos real. Simula latencia de red.
 */
import { ANIO_ACTUAL } from '../config.js';
import { compileMatcher } from './queryModel.js';
import { computeSummary } from '../utils/stats.js';

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LUGARES = ['Oficina DEAG', 'Sede Central MAG', 'Concepción', 'Caaguazú', 'Itapúa', 'San Pedro', 'Misiones',
  'Paraguarí', 'Cordillera', 'Guairá', 'Caazapá', 'Alto Paraná', 'Central', 'Ñeembucú', 'Amambay', 'Canindeyú',
  'Presidente Hayes', 'Boquerón', 'Alto Paraguay', 'Coronel Oviedo', 'Villarrica', 'Encarnación', 'Pilar', 'San Lorenzo'];
const ESTADOS = ['Pagado', 'Tesoreria', 'Contabilidad', 'Presupuesto', 'Control y Seguimiento'];
const ACT = ['Relevamiento de campo', 'Capacitación a productores', 'Monitoreo de parcelas demostrativas',
  'Reunión interinstitucional', 'Supervisión técnica', 'Entrega de insumos', 'Taller participativo',
  'Visita de seguimiento', 'Levantamiento de datos GPS', 'Inspección de obras de riego'];
const OBS = ['Sin novedades', 'Camino en mal estado', 'Pendiente de rendición', 'Reprogramado por lluvia', 'Con acompañamiento del gobierno local'];
const pad = (n) => String(n).padStart(2, '0');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockService(n) {
  const rand = mulberry32(20260101);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const data = [];
  const startYear = ANIO_ACTUAL - 3;
  for (let i = 0; i < n; i += 1) {
    const y = startYear + Math.floor(rand() * 4);
    const m = 1 + Math.floor(rand() * 12);
    const d = 1 + Math.floor(rand() * 28);
    const dur = Math.floor(rand() * 3);
    const desde = `${y}-${pad(m)}-${pad(d)}`;
    const hasta = new Date(Date.UTC(y, m - 1, d + dur)).toISOString().slice(0, 10);
    const ki = 10000 + Math.floor(rand() * 90000);
    const kr = 5 + Math.floor(rand() * 480);
    const viatico = rand() < 0.6 ? 'Sí' : 'No';
    const lugar = pick(LUGARES);
    data.push({
      id: `demo-${String(i + 1).padStart(7, '0')}`,
      created_at: new Date(Date.UTC(y, m - 1, d, 12)).toISOString(),
      fecha_desde: desde, fecha_hasta: hasta,
      actividad: `${pick(ACT)} en ${lugar}`, lugar,
      permiso: pick(ESTADOS),
      numero_cuaderno: `CU-${y}-${pad(1 + Math.floor(rand() * 40))}`,
      numero_expediente: `EXP-${y}-${String(1 + Math.floor(rand() * 999)).padStart(3, '0')}`,
      km_inicial: ki, km_final: ki + kr, km_recorrido: kr,
      viatico, monto: Math.round((80000 + rand() * 420000) / 1000) * 1000,
      observaciones: rand() < 0.35 ? pick(OBS) : '',
      imagenes: [],
    });
  }

  const listeners = new Set();
  const emit = (eventType) => listeners.forEach((fn) => fn({ eventType }));

  // Igual que el servidor: vacíos al final, desempate por id ascendente.
  const collator = new Intl.Collator('es');
  const ISO_FIELDS = new Set(['fecha_desde', 'fecha_hasta', 'created_at']);
  const compare = (field, dir) => (a, b) => {
    const va = a[field], vb = b[field];
    const ea = va == null || va === '', eb = vb == null || vb === '';
    if (ea || eb) {
      if (ea && eb) return a.id < b.id ? -1 : 1;
      return ea ? 1 : -1;
    }
    let r;
    if (typeof va === 'number' && typeof vb === 'number') r = va - vb;
    else if (ISO_FIELDS.has(field)) r = va < vb ? -1 : va > vb ? 1 : 0;
    else r = collator.compare(String(va), String(vb));
    if (dir === 'desc') r = -r;
    return r !== 0 ? r : (a.id < b.id ? -1 : 1);
  };

  function run(q) {
    const match = compileMatcher(q);
    const rows = data.filter(match);
    const s = q.sort || { field: 'fecha_desde', dir: 'desc' };
    rows.sort(compare(s.field, s.dir));
    return rows;
  }

  return {
    mode: 'demo',
    size: n,
    async list(q) {
      await delay(90);
      const rows = run(q);
      const from = (q.page - 1) * q.pageSize;
      return { rows: rows.slice(from, from + q.pageSize), total: rows.length };
    },
    async count(q) { await delay(40); return data.filter(compileMatcher(q)).length; },
    async fetchAll(q) { await delay(60); return run(q); },
    async summary(q) { await delay(70); return computeSummary(data.filter(compileMatcher(q)), q); },
    async distinct() {
      const uniq = (k) => [...new Set(data.map((r) => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      const years = [];
      for (let y = ANIO_ACTUAL - 1; y >= startYear; y -= 1) years.push(y);
      return { permisos: uniq('permiso'), lugares: uniq('lugar'), years };
    },
    async create(p) {
      await delay(120);
      const rec = { ...p, id: `demo-new-${Date.now()}`, created_at: new Date().toISOString() };
      data.unshift(rec); emit('INSERT'); return rec;
    },
    async update(id, p) {
      await delay(120);
      const i = data.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('El registro no existe.');
      data[i] = { ...data[i], ...p }; emit('UPDATE'); return data[i];
    },
    async remove(id) {
      await delay(100);
      const i = data.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('El registro no existe.');
      data.splice(i, 1); emit('DELETE');
    },
    async removeMany(ids) {
      await delay(140);
      const set = new Set(ids);
      let k = 0;
      for (let i = data.length - 1; i >= 0; i -= 1) if (set.has(data[i].id)) { data.splice(i, 1); k += 1; }
      emit('DELETE'); return k;
    },
    async uploadImages(files) { return { urls: files.map((f) => URL.createObjectURL(f)), failed: [] }; },
    subscribe(onChange, onStatus) {
      listeners.add(onChange);
      setTimeout(() => onStatus('DEMO'), 30);
      return () => listeners.delete(onChange);
    },
    invalidate() {},
  };
}
