/** Barra superior: menú, ubicación, búsqueda global con sugerencias, estado, tema y acción principal. */
import { getState, subscribe, setQuery, setPrefs, setUi } from '../core/store.js';
import { CONFIG } from '../config.js';
import { ROUTE_TITLES } from '../core/router.js';
import { escapeHtml as esc, debounce } from '../utils/dom.js';
import { connectionInfo } from '../utils/status.js';

const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

export function mountTopbar(el, { onNew, onRefresh }) {
  el.innerHTML = `
    <button type="button" class="icon-btn ghost tb-menu" data-menu aria-label="Mostrar u ocultar menú"><i class="fa-solid fa-bars"></i></button>
    <div class="tb-title"><span class="tb-crumb">${CONFIG.APP_NAME}</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i><strong data-view-title>Registros</strong></div>
    <div class="tb-search" role="search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input id="globalSearch" type="search" list="dl-search" placeholder="Buscar en actividad, lugar, expediente, estado, observaciones…" autocomplete="off" aria-label="Búsqueda global">
      <datalist id="dl-search"></datalist>
      <kbd title="Atajo de teclado">/</kbd>
    </div>
    <div class="tb-actions">
      <span class="status-pill" data-status><span class="dot"></span><span class="label"></span></span>
      <button type="button" class="icon-btn" data-refresh title="Actualizar datos" aria-label="Actualizar datos"><i class="fa-solid fa-rotate"></i></button>
      <button type="button" class="icon-btn" data-theme-toggle title="Cambiar tema" aria-label="Cambiar tema"><i class="fa-solid fa-moon"></i></button>
      <button type="button" class="btn btn-primary" data-new><i class="fa-solid fa-plus"></i><span>Nuevo</span></button>
    </div>`;

  const input = el.querySelector('#globalSearch');
  const applySearch = debounce((v) => setQuery({ search: v.trim() }), CONFIG.SEARCH_DEBOUNCE_MS);
  input.addEventListener('input', () => applySearch(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { applySearch.cancel(); setQuery({ search: input.value.trim() }); if (getState().route !== 'registros' && getState().route !== 'dashboard') location.hash = '#/registros'; }
    if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; applySearch.cancel(); setQuery({ search: '' }); }
  });

  el.querySelector('[data-menu]').addEventListener('click', () => {
    if (isMobile()) setUi({ sidebarOpen: !getState().ui.sidebarOpen });
    else setPrefs({ sidebarCollapsed: !getState().prefs.sidebarCollapsed });
  });
  el.querySelector('[data-theme-toggle]').addEventListener('click', () => setPrefs({ theme: getState().prefs.theme === 'dark' ? 'light' : 'dark' }));
  el.querySelector('[data-new]').addEventListener('click', () => onNew());
  el.querySelector('[data-refresh]').addEventListener('click', (e) => {
    const icon = e.currentTarget.querySelector('i');
    icon.classList.add('fa-spin');
    setTimeout(() => icon.classList.remove('fa-spin'), 800);
    onRefresh();
  });

  const sync = (s, p = {}) => {
    if (s.route !== p.route) el.querySelector('[data-view-title]').textContent = ROUTE_TITLES[s.route] || '';
    if (s.query.search !== p.query?.search && document.activeElement !== input) input.value = s.query.search;
    if (s.prefs.theme !== p.prefs?.theme) el.querySelector('[data-theme-toggle] i').className = `fa-solid ${s.prefs.theme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
    if (s.connection !== p.connection || s.online !== p.online || s.dataMode !== p.dataMode) {
      const info = connectionInfo(s.connection, s.online, s.dataMode);
      const pill = el.querySelector('[data-status]');
      pill.className = `status-pill ${info.cls}`;
      pill.title = info.title;
      pill.querySelector('.label').textContent = info.label;
    }
    if (s.distinct !== p.distinct) {
      const sug = [...(s.distinct.lugares || []), ...(s.distinct.permisos || [])].slice(0, 300);
      el.querySelector('#dl-search').innerHTML = sug.map((v) => `<option value="${esc(v)}">`).join('');
    }
  };
  sync(getState());
  subscribe(sync);
}
