/**
 * Capa de acceso a datos (Supabase / PostgREST).
 * - Paginación, ordenamiento y filtrado del lado del servidor.
 * - Lectura por lotes para superar el límite de 1000 filas por solicitud.
 * - Caché en memoria con TTL, invalidada por escrituras y eventos Realtime.
 * - Errores normalizados a mensajes comprensibles.
 */
import { CONFIG, ANIO_ACTUAL } from '../config.js';
import { applyFilters, defaultQuery } from './queryModel.js';
import { computeSummary } from '../utils/stats.js';

const SUMMARY_COLUMNS = 'fecha_desde,km_recorrido,monto,viatico,permiso,lugar';

export function normalizeError(err) {
  const raw = (err && (err.message || err.error_description || err.details)) || String(err || 'Error desconocido');
  const m = raw.toLowerCase();
  let message = raw;
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request failed') || m.includes('load failed')) {
    message = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
  } else if (m.includes('invalid api key') || m.includes('jwt') || err?.status === 401) {
    message = 'Credenciales de acceso inválidas o expiradas.';
  } else if (m.includes('row-level security') || m.includes('permission denied') || err?.code === '42501') {
    message = 'Operación rechazada por la política de seguridad de la base de datos.';
  } else if (err?.code === 'PGRST116') {
    message = 'El registro no existe o no tiene permisos para modificarlo.';
  } else if (err?.code === '57014' || m.includes('timeout')) {
    message = 'La consulta tardó demasiado. Pruebe con filtros más específicos.';
  } else if (err?.code === '23514') {
    message = 'Los datos no cumplen una validación de la base de datos.';
  }
  const e = new Error(message);
  e.cause = err;
  return e;
}

export function createSupabaseService(client) {
  const T = CONFIG.TABLE;
  const cache = new Map();

  async function cached(key, ttl, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < ttl) return hit.v;
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
  }

  const ordered = (b, q) => {
    const s = q.sort || { field: 'fecha_desde', dir: 'desc' };
    return b.order(s.field, { ascending: s.dir === 'asc', nullsFirst: false }).order('id', { ascending: true });
  };

  async function fetchAll(q, columns = '*', maxRows = Infinity) {
    const out = [];
    const size = CONFIG.BATCH_SIZE;
    for (let from = 0; from < maxRows; from += size) {
      const to = Math.min(from + size, maxRows) - 1;
      let b = client.from(T).select(columns);
      b = ordered(applyFilters(b, q), q).range(from, to);
      const { data, error } = await b;
      if (error) throw normalizeError(error);
      out.push(...(data || []));
      if (!data || data.length < to - from + 1) break;
    }
    return out;
  }

  const uniqSorted = (arr) => [...new Set(arr.map((v) => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  return {
    mode: 'supabase',

    async list(q) {
      return cached(`list:${JSON.stringify(q)}`, CONFIG.CACHE_TTL_MS, async () => {
        const from = (q.page - 1) * q.pageSize;
        let b = client.from(T).select('*', { count: CONFIG.COUNT_MODE });
        b = ordered(applyFilters(b, q), q).range(from, from + q.pageSize - 1);
        const { data, error, count } = await b;
        if (error) throw normalizeError(error);
        return { rows: data || [], total: count ?? (data || []).length };
      });
    },

    async count(q) {
      return cached(`count:${JSON.stringify(q)}`, CONFIG.CACHE_TTL_MS, async () => {
        const b = applyFilters(client.from(T).select('id', { count: CONFIG.COUNT_MODE, head: true }), q);
        const { count, error } = await b;
        if (error) throw normalizeError(error);
        return count || 0;
      });
    },

    fetchAll: (q) => fetchAll(q),

    async summary(q) {
      const key = `sum:${JSON.stringify({ ...q, page: 0, pageSize: 0, sort: null })}`;
      return cached(key, CONFIG.CACHE_TTL_MS, async () => {
        const rows = await fetchAll({ ...q, sort: { field: 'fecha_desde', dir: 'asc' } }, SUMMARY_COLUMNS);
        return computeSummary(rows, q);
      });
    },

    async distinct() {
      return cached('distinct', CONFIG.DISTINCT_TTL_MS, async () => {
        const all = { ...defaultQuery(1), scope: 'todos' };
        const rows = await fetchAll(all, 'permiso,lugar', CONFIG.DISTINCT_MAX_ROWS);
        const { data, error } = await client.from(T).select('fecha_desde')
          .not('fecha_desde', 'is', null).order('fecha_desde', { ascending: true }).limit(1);
        if (error) throw normalizeError(error);
        const minYear = data?.[0]?.fecha_desde ? Number(String(data[0].fecha_desde).slice(0, 4)) : ANIO_ACTUAL - 1;
        const years = [];
        for (let y = ANIO_ACTUAL - 1; y >= Math.min(minYear, ANIO_ACTUAL - 1); y -= 1) years.push(y);
        return { permisos: uniqSorted(rows.map((r) => r.permiso)), lugares: uniqSorted(rows.map((r) => r.lugar)), years };
      });
    },

    async create(payload) {
      const { data, error } = await client.from(T).insert([payload]).select().single();
      if (error) throw normalizeError(error);
      cache.clear();
      return data;
    },

    async update(id, payload) {
      const { data, error } = await client.from(T).update(payload).eq('id', id).select().single();
      if (error) throw normalizeError(error);
      cache.clear();
      return data;
    },

    async remove(id) {
      const { data, error } = await client.from(T).delete().eq('id', id).select('id');
      if (error) throw normalizeError(error);
      if (!data || !data.length) throw new Error('No se eliminó ningún registro (no existe o no hay permisos).');
      cache.clear();
    },

    async removeMany(ids) {
      const { data, error } = await client.from(T).delete().in('id', ids).select('id');
      if (error) throw normalizeError(error);
      cache.clear();
      return (data || []).length;
    },

    async uploadImages(files) {
      const urls = [];
      const failed = [];
      for (const file of files) {
        const safe = file.name.replace(/[^\w.-]/g, '_').slice(-80);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        const { error } = await client.storage.from(CONFIG.BUCKET).upload(name, file);
        if (error) { failed.push(file.name); continue; }
        const { data } = client.storage.from(CONFIG.BUCKET).getPublicUrl(name);
        urls.push(data.publicUrl);
      }
      return { urls, failed };
    },

    subscribe(onChange, onStatus) {
      const ch = client
        .channel(`actividades1-rt-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: T }, (payload) => {
          cache.clear();
          onChange(payload);
        })
        .subscribe((status) => onStatus(status));
      return () => client.removeChannel(ch);
    },

    invalidate() { cache.clear(); },
  };
}
