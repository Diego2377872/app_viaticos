/** Ventana modal de detalle con pestañas: General · Kilometraje y viático · Evidencias · Metadatos. */
import { openModal } from './modal.js';
import { createTabs } from './tabs.js';
import { toast } from './toast.js';
import { ANIO_ACTUAL } from '../config.js';
import { escapeHtml as esc, el, safeUrl, copyText } from '../utils/dom.js';
import { fmtNumber, fmtMoney, fmtPeriod, fmtDateTime } from '../utils/format.js';
import { estadoBadge } from '../utils/palette.js';

const dash = (v) => (v == null || v === '' ? '<span class="muted">—</span>' : esc(v));

export function openRecordDetail(r, { initialTab = 'general', onEdit, onDelete } = {}) {
  const imgs = Array.isArray(r.imagenes) ? r.imagenes : [];
  const year = Number(String(r.fecha_desde || '').slice(0, 4));
  const body = el(`<div class="rdetail">
    <div class="rd-hero">
      <div class="rd-period mono"><i class="fa-regular fa-calendar"></i> ${esc(fmtPeriod(r.fecha_desde, r.fecha_hasta))}</div>
      <h3>${esc(r.actividad || 'Sin descripción')}</h3>
      <div class="rd-tags">
        ${estadoBadge(r.permiso, esc)}
        <span class="pill ${r.viatico === 'Sí' ? 'pill-ok' : 'pill-muted'}"><i class="fa-solid ${r.viatico === 'Sí' ? 'fa-check' : 'fa-minus'}"></i> Viático ${esc(r.viatico || '—')}</span>
        <span class="tag"><i class="fa-solid fa-location-dot"></i> ${esc(r.lugar || '—')}</span>
        <span class="tag"><i class="fa-solid ${year === ANIO_ACTUAL ? 'fa-calendar-check' : 'fa-box-archive'}"></i> ${year === ANIO_ACTUAL ? 'Año activo' : 'Archivo histórico'}</span>
      </div>
    </div>
    <div data-tabs></div>
    <div class="rd-panels">
      <div data-panel="general">
        <dl class="kv">
          <div><dt>Lugar / Institución</dt><dd>${dash(r.lugar)}</dd></div>
          <div><dt>N° Cuaderno</dt><dd class="mono">${dash(r.numero_cuaderno)}</dd></div>
          <div><dt>N° Expediente</dt><dd class="mono">${dash(r.numero_expediente)}</dd></div>
          <div><dt>Estado del expediente</dt><dd>${estadoBadge(r.permiso, esc)}</dd></div>
          <div class="full"><dt>Descripción de la actividad</dt><dd class="prewrap">${dash(r.actividad)}</dd></div>
          <div class="full"><dt>Observaciones</dt><dd class="prewrap">${dash(r.observaciones)}</dd></div>
        </dl>
      </div>
      <div data-panel="km" hidden>
        <div class="metric-grid">
          <div class="metric"><span>Km inicial</span><strong>${fmtNumber(r.km_inicial)}</strong></div>
          <div class="metric"><span>Km final</span><strong>${fmtNumber(r.km_final)}</strong></div>
          <div class="metric accent"><span>Km recorridos</span><strong>${fmtNumber(r.km_recorrido)} km</strong></div>
          <div class="metric"><span>Viático cobrado</span><strong>${esc(r.viatico || '—')}</strong></div>
          <div class="metric"><span>Monto</span><strong>${fmtMoney(r.monto)}</strong></div>
        </div>
      </div>
      <div data-panel="evid" hidden>
        ${imgs.length ? `<div class="gallery">${imgs.map((u, i) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" title="Abrir evidencia ${i + 1} en una pestaña nueva"><img src="${esc(safeUrl(u))}" alt="Evidencia ${i + 1}" loading="lazy"></a>`).join('')}</div>`
          : '<div class="state-box"><i class="fa-regular fa-image"></i><h4>Sin evidencias</h4><p>Este registro no tiene imágenes adjuntas.</p></div>'}
      </div>
      <div data-panel="meta" hidden>
        <dl class="kv">
          <div class="full"><dt>Identificador (UUID)</dt><dd class="mono id-row"><span>${esc(r.id)}</span><button type="button" class="icon-btn sm" data-copy-id title="Copiar ID" aria-label="Copiar ID"><i class="fa-regular fa-copy"></i></button></dd></div>
          <div><dt>Creado</dt><dd class="mono">${esc(fmtDateTime(r.created_at))}</dd></div>
          <div><dt>Fecha desde (ISO)</dt><dd class="mono">${dash(r.fecha_desde)}</dd></div>
          <div><dt>Fecha hasta (ISO)</dt><dd class="mono">${dash(r.fecha_hasta)}</dd></div>
          <div><dt>Evidencias</dt><dd class="mono">${imgs.length}</dd></div>
        </dl>
        <details class="raw"><summary>Ver registro completo (JSON)</summary><pre class="json">${esc(JSON.stringify(r, null, 2))}</pre></details>
      </div>
    </div>
  </div>`);

  const show = (id) => body.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id; });
  createTabs(body.querySelector('[data-tabs]'), [
    { id: 'general', label: 'General', icon: 'fa-circle-info' },
    { id: 'km', label: 'Kilometraje y viático', icon: 'fa-gauge' },
    { id: 'evid', label: 'Evidencias', icon: 'fa-images', badge: String(imgs.length) },
    { id: 'meta', label: 'Metadatos', icon: 'fa-code' },
  ], { active: initialTab, onChange: show, variant: 'line' });
  show(initialTab);
  body.querySelector('[data-copy-id]').addEventListener('click', async () => toast((await copyText(r.id)) ? 'ID copiado' : 'No se pudo copiar', 'info', { timeout: 2000 }));

  openModal({
    title: 'Detalle del registro',
    size: 'lg',
    body,
    footer: [
      { label: 'Eliminar', variant: 'btn-danger-ghost', icon: 'fa-trash', align: 'left', onClick: async (m) => { if (await onDelete?.(r)) m.close(); } },
      { label: 'Cerrar', variant: 'btn-ghost', onClick: (m) => m.close() },
      { label: 'Editar', variant: 'btn-primary', icon: 'fa-pen', onClick: (m) => { m.close(); onEdit?.(r); } },
    ],
  });
}
