/** Validación de registros en el frontend (complementa las restricciones CHECK sugeridas para la base). */
import { CONFIG } from '../config.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validateRecord(d, { existingImages = 0, newFiles = [], montoRaw = 0 } = {}) {
  const e = {};
  if (!d.fecha_desde || !ISO.test(d.fecha_desde)) e.fecha_desde = 'Fecha obligatoria';
  if (!d.fecha_hasta || !ISO.test(d.fecha_hasta)) e.fecha_hasta = 'Fecha obligatoria';
  if (!e.fecha_desde && !e.fecha_hasta && d.fecha_hasta < d.fecha_desde) {
    e.fecha_hasta = 'No puede ser anterior a la fecha desde';
  }
  if (!d.actividad || d.actividad.length < 3) e.actividad = 'Describa la actividad (mínimo 3 caracteres)';
  if (!d.lugar) e.lugar = 'Campo obligatorio';
  if (d.km_inicial < 0) e.km_inicial = 'No puede ser negativo';
  if (d.km_final < 0) e.km_final = 'No puede ser negativo';
  if (d.km_inicial > 0 && d.km_final > 0 && d.km_final < d.km_inicial) {
    e.km_final = 'Debe ser mayor o igual al km inicial';
  }
  if (montoRaw < 0) e.monto = 'No puede ser negativo';

  const total = existingImages + newFiles.length;
  if (total > CONFIG.MAX_IMAGES) e.imagenes = `Máximo ${CONFIG.MAX_IMAGES} imágenes por registro`;
  const tooBig = newFiles.filter((f) => f.size > CONFIG.MAX_IMAGE_MB * 1024 * 1024);
  if (tooBig.length) e.imagenes = `Supera ${CONFIG.MAX_IMAGE_MB} MB: ${tooBig.map((f) => f.name).join(', ')}`;
  if (newFiles.some((f) => !String(f.type).startsWith('image/'))) e.imagenes = 'Solo se permiten archivos de imagen';
  return e;
}
