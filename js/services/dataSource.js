/** Selecciona la fuente de datos: Supabase (producción) o simulador (?demo=N). Carga diferida. */
import { CONFIG } from '../config.js';

export async function createDataSource() {
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  if (demo !== null) {
    const n = Math.min(Math.max(parseInt(demo, 10) || 5000, 10), CONFIG.DEMO_MAX_ROWS);
    const { createMockService } = await import('./mockService.js');
    return createMockService(n);
  }
  let createClient;
  try {
    ({ createClient } = await import(CONFIG.SUPABASE_JS_URL));
  } catch (err) {
    throw new Error('No se pudo descargar el cliente de base de datos (CDN no disponible o sin conexión).');
  }
  const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { createSupabaseService } = await import('./actividadesService.js');
  return createSupabaseService(client);
}
