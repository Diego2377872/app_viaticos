/** Traduce el estado de conexión (Realtime + red + modo) a etiqueta y estilo de UI. */
export function connectionInfo(conn, online = true, mode = 'supabase') {
  if (!online) return { cls: 'err', label: 'Sin conexión', title: 'El dispositivo no tiene conexión a internet' };
  if (mode === 'demo') return { cls: 'demo', label: 'Modo demo', title: 'Datos sintéticos en memoria: no se escribe en la base real' };
  switch (conn) {
    case 'SUBSCRIBED': return { cls: 'ok', label: 'En vivo', title: 'Sincronización en tiempo real activa (Supabase Realtime)' };
    case 'TIMED_OUT': return { cls: 'warn', label: 'Reconectando…', title: 'Intentando restablecer el canal de tiempo real' };
    case 'CLOSED':
    case 'CHANNEL_ERROR': return { cls: 'err', label: 'Sin tiempo real', title: 'Los datos se actualizan con el botón Actualizar o al recargar' };
    default: return { cls: 'warn', label: 'Conectando…', title: 'Estableciendo conexión' };
  }
}
