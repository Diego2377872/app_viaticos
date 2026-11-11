/** Módulo Configuración: apariencia, tabla, filtros guardados, sistema y seguridad. */
import { getState, subscribe, setPrefs } from '../core/store.js';
import { CONFIG, COLUMNS, STORAGE_KEYS } from '../config.js';
import * as actions from '../core/actions.js';
import { describeFilters } from '../services/queryModel.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { connectionInfo } from '../utils/status.js';
import { escapeHtml as esc } from '../utils/dom.js';
import { fmtDateTime, fmtNumber } from '../utils/format.js';

const seg = (name, current, options) => `<div class="segmented" role="group" data-seg="${name}">
  ${options.map(([v, label, icon]) => `<button type="button" data-val="${v}" class="${current === v ? 'active' : ''}" aria-pressed="${current === v}">${icon ? `<i class="fa-solid ${icon}"></i> ` : ''}${label}</button>`).join('')}</div>`;

export function mount(section) {
  let stale = false;

  function render() {
    const s = getState();
    const p = s.prefs;
    const hidden = p.hiddenColumns ?? COLUMNS.filter((c) => c.hiddenByDefault).map((c) => c.key);
    const info = connectionInfo(s.connection, s.online, s.dataMode);
    const saved = p.savedFilters || [];
    const host = new URL(CONFIG.SUPABASE_URL).host;
    section.innerHTML = `
      <div class="view-head"><div><h1 class="view-title">Configuración</h1>
        <p class="view-sub">Preferencias de interfaz, tabla, filtros guardados y estado del sistema (se guardan en este dispositivo)</p></div></div>
      <div class="settings-grid">
        <div class="card"><div class="card-head"><h3><i class="fa-solid fa-palette"></i> Apariencia</h3></div><div class="card-pad">
          <div class="setting-row"><div class="lbl"><strong>Tema</strong><small>Claro u oscuro</small></div>${seg('theme', p.theme, [['light', 'Claro', 'fa-sun'], ['dark', 'Oscuro', 'fa-moon']])}</div>
          <div class="setting-row"><div class="lbl"><strong>Densidad de la tabla</strong><small>Altura de las filas</small></div>${seg('density', p.density, [['comfortable', 'Cómoda'], ['compact', 'Compacta']])}</div>
          <div class="setting-row"><div class="lbl"><strong>Menú lateral</strong><small>En pantallas de escritorio</small></div>${seg('sidebar', p.sidebarCollapsed ? 'collapsed' : 'expanded', [['expanded', 'Expandido'], ['collapsed', 'Contraído']])}</div>
        </div></div>

        <div class="card"><div class="card-head"><h3><i class="fa-solid fa-table"></i> Tabla de registros</h3></div><div class="card-pad">
          <div class="setting-row"><div class="lbl"><strong>Filas por página</strong><small>Valor predeterminado</small></div>
            <select data-pref="pageSize" class="w-auto" aria-label="Filas por página">${CONFIG.PAGE_SIZES.map((n) => `<option value="${n}" ${n === p.pageSize ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="setting-block"><strong class="block-title">Columnas visibles</strong>
            <div class="col-checks">${COLUMNS.filter((c) => !c.locked).map((c) => `<label class="check"><input type="checkbox" data-colvis="${c.key}" ${hidden.includes(c.key) ? '' : 'checked'}> ${esc(c.label)}</label>`).join('')}</div></div>
          <div class="setting-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-act="show-all"><i class="fa-solid fa-eye"></i> Mostrar todas</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="reset-cols"><i class="fa-solid fa-arrows-left-right"></i> Restablecer columnas y anchos</button>
          </div>
        </div></div>

        <div class="card"><div class="card-head"><h3><i class="fa-solid fa-bookmark"></i> Filtros guardados</h3><span class="card-sub">${saved.length}</span></div><div class="card-pad">
          ${saved.length ? `<div class="saved-list">${saved.map((f, i) => {
            const chips = describeFilters({ ...f.query, filters: f.query.filters || {}, columnFilters: f.query.columnFilters || {} }).map((c) => c.label);
            return `<div class="saved-item"><div class="meta"><strong>${esc(f.name)}</strong>
              <small>${esc(f.query.scope === 'archivo' ? `Archivo ${f.query.archivoAnio || 'todos'}` : 'Año activo')} · ${esc(chips.slice(0, 3).join(' · ') || 'sin criterios adicionales')}${chips.length > 3 ? ` · +${chips.length - 3}` : ''}</small>
              <small class="mono">${esc(fmtDateTime(f.createdAt))}</small></div>
              <button type="button" class="btn btn-ghost btn-sm" data-apply="${i}"><i class="fa-solid fa-play"></i> Aplicar</button>
              <button type="button" class="icon-btn sm" data-del="${i}" aria-label="Eliminar filtro ${esc(f.name)}" title="Eliminar"><i class="fa-solid fa-trash"></i></button></div>`;
          }).join('')}</div>`
            : '<div class="state-box sm"><i class="fa-regular fa-bookmark"></i><p>Guarde combinaciones de filtros desde el módulo Registros con el botón <strong>Guardados</strong>.</p></div>'}
        </div></div>

        <div class="card"><div class="card-head"><h3><i class="fa-solid fa-server"></i> Sistema y datos</h3></div><div class="card-pad">
          <table class="stats-table"><tbody>
            <tr><td>Versión</td><td class="mono">${esc(CONFIG.APP_VERSION)}</td></tr>
            <tr><td>Fuente de datos</td><td>${s.dataMode === 'demo' ? 'Simulador (demo)' : 'Supabase'}</td></tr>
            <tr><td>Proyecto</td><td class="mono">${esc(host)}</td></tr>
            <tr><td>Tabla / almacenamiento</td><td class="mono">${esc(CONFIG.TABLE)} · ${esc(CONFIG.BUCKET)}</td></tr>
            <tr><td>Tiempo real</td><td><span class="status-pill sm ${info.cls}"><span class="dot"></span><span class="label">${esc(info.label)}</span></span></td></tr>
            <tr><td>Registros en la base</td><td>${s.scopeCounts?.actual != null && s.scopeCounts?.archivo != null ? fmtNumber(s.scopeCounts.actual + s.scopeCounts.archivo) : '…'}</td></tr>
          </tbody></table>
          <div class="setting-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-act="refresh"><i class="fa-solid fa-rotate"></i> Limpiar caché y recargar datos</button>
            <button type="button" class="btn btn-danger-ghost btn-sm" data-act="reset-prefs"><i class="fa-solid fa-rotate-left"></i> Restablecer preferencias</button>
          </div>
        </div></div>

        <div class="card span-full"><div class="card-head"><h3><i class="fa-solid fa-shield-halved"></i> Seguridad e integridad</h3></div><div class="card-pad">
          <div class="note"><i class="fa-solid fa-circle-info"></i><div>
            La clave de Supabase incluida en la aplicación es la clave <strong>pública (anon)</strong>, diseñada para usarse en el navegador.
            La protección de los datos depende de las políticas <strong>Row Level Security (RLS)</strong> de la base de datos.
            Ver recomendaciones (índices, validaciones CHECK y verificación de RLS) en <code>docs/supabase_recomendaciones.sql</code> del repositorio.
          </div></div>
        </div></div>
      </div>`;
  }

  section.addEventListener('click', async (e) => {
    const segBtn = e.target.closest('[data-seg] button');
    if (segBtn) {
      const name = segBtn.closest('[data-seg]').dataset.seg;
      const v = segBtn.dataset.val;
      if (name === 'theme') setPrefs({ theme: v });
      if (name === 'density') setPrefs({ density: v });
      if (name === 'sidebar') setPrefs({ sidebarCollapsed: v === 'collapsed' });
      return;
    }
    const apply = e.target.closest('[data-apply]');
    if (apply) { actions.applySavedFilter(getState().prefs.savedFilters[Number(apply.dataset.apply)]); location.hash = '#/registros'; return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const f = getState().prefs.savedFilters[Number(del.dataset.del)];
      if (await confirmDialog({ title: 'Eliminar filtro guardado', message: `¿Eliminar el filtro “${f.name}”?`, confirmLabel: 'Eliminar', danger: true })) actions.deleteSavedFilter(f.name);
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'show-all') setPrefs({ hiddenColumns: [] });
    if (b.dataset.act === 'reset-cols') setPrefs({ hiddenColumns: null, columnWidths: {} });
    if (b.dataset.act === 'refresh') { actions.refreshAll(); toast('Caché limpiada; datos recargados', 'success'); }
    if (b.dataset.act === 'reset-prefs') {
      if (await confirmDialog({ title: 'Restablecer preferencias', message: 'Se borrarán tema, columnas, anchos, filtros guardados y la última búsqueda de este dispositivo. Los registros de la base de datos no se modifican.', confirmLabel: 'Restablecer', danger: true })) {
        localStorage.removeItem(STORAGE_KEYS.PREFS);
        localStorage.removeItem(STORAGE_KEYS.QUERY);
        location.reload();
      }
    }
  });
  section.addEventListener('change', (e) => {
    const pref = e.target.closest('[data-pref="pageSize"]');
    if (pref) setPrefs({ pageSize: Number(pref.value) });
    const cv = e.target.closest('[data-colvis]');
    if (cv) {
      const hidden = new Set(getState().prefs.hiddenColumns ?? COLUMNS.filter((c) => c.hiddenByDefault).map((c) => c.key));
      if (cv.checked) hidden.delete(cv.dataset.colvis); else hidden.add(cv.dataset.colvis);
      setPrefs({ hiddenColumns: [...hidden] });
    }
  });

  render();
  subscribe((s, p) => {
    if (s.prefs !== p.prefs || s.connection !== p.connection || s.dataMode !== p.dataMode || s.scopeCounts !== p.scopeCounts || s.online !== p.online) {
      if (section.hidden) stale = true; else render();
    }
  });
  return { onShow() { if (stale) { stale = false; render(); } } };
}
