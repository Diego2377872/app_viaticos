/**
 * Configuración central de la plataforma.
 *
 * La clave "anon" de Supabase es pública por diseño (se ejecuta en el navegador).
 * La protección real de los datos depende de las políticas RLS de la base de datos
 * (ver docs/supabase_recomendaciones.sql).
 */
export const CONFIG = Object.freeze({
  APP_NAME: 'Viajes UGR',
  APP_VERSION: '3.0.0',
  SUPABASE_URL: 'https://jmyioejtexnzvdrimepp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteWlvZWp0ZXhuenZkcmltZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDI2NTUsImV4cCI6MjA4NjMxODY1NX0.ylaKDxa2bBqASroFO5JefLDVIDKhfX-hkBOAc1zYWBU',
  SUPABASE_JS_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  CHART_JS_URL: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  XLSX_URL: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  TABLE: 'actividades1',
  BUCKET: 'actividades-images',
  COUNT_MODE: 'exact',          // 'exact' | 'planned' | 'estimated' (usar 'planned' con >500k filas)
  BATCH_SIZE: 1000,             // límite por solicitud de PostgREST (max-rows por defecto en Supabase)
  CACHE_TTL_MS: 60000,
  DISTINCT_TTL_MS: 300000,
  DISTINCT_MAX_ROWS: 5000,
  MAX_IMAGES: 3,
  MAX_IMAGE_MB: 2,
  PAGE_SIZES: [10, 25, 50, 100, 250],
  DEFAULT_PAGE_SIZE: 25,
  SEARCH_DEBOUNCE_MS: 300,
  DEMO_MAX_ROWS: 500000,
});

export const STORAGE_KEYS = Object.freeze({
  PREFS: 'viaticos.prefs.v3',
  QUERY: 'viaticos.lastQuery.v3',
  PENDING: 'pendientes',        // compatible con la versión anterior
  LEGACY_THEME: 'tema',
});

export const ANIO_ACTUAL = new Date().getFullYear();

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Definición declarativa de columnas de la tabla.
 * filter: 'text' (contiene) | 'select' (igual a) | undefined (sin filtro por columna)
 */
export const COLUMNS = Object.freeze([
  { key: 'fecha', label: 'Período', sortField: 'fecha_desde', width: 160, sticky: true, locked: true, type: 'period' },
  { key: 'actividad', label: 'Actividad', width: 300, filter: 'text', type: 'longtext' },
  { key: 'lugar', label: 'Lugar / Institución', width: 190, filter: 'text' },
  { key: 'numero_cuaderno', label: 'N° Cuaderno', width: 130, filter: 'text', type: 'code' },
  { key: 'numero_expediente', label: 'N° Expediente', width: 145, filter: 'text', type: 'code' },
  { key: 'permiso', label: 'Estado del exp.', width: 185, filter: 'select', optionsFrom: 'permisos', type: 'estado' },
  { key: 'km_inicial', label: 'Km inicial', width: 110, type: 'number' },
  { key: 'km_final', label: 'Km final', width: 110, type: 'number' },
  { key: 'km_recorrido', label: 'Km total', width: 110, type: 'number', emphasis: true },
  { key: 'viatico', label: 'Viático', width: 118, filter: 'select', options: ['Sí', 'No'], type: 'viatico' },
  { key: 'monto', label: 'Monto (Gs)', width: 140, type: 'money' },
  { key: 'observaciones', label: 'Observaciones', width: 230, filter: 'text', type: 'longtext' },
  { key: 'imagenes', label: 'Evidencia', width: 130, sortable: false, type: 'images' },
  { key: 'created_at', label: 'Creado', width: 150, type: 'datetime', hiddenByDefault: true },
]);
