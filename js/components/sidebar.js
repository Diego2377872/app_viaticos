/** Menú lateral: expandible/contraíble en escritorio, panel deslizante (off-canvas) en móvil. */
import { getState, subscribe, setPrefs, setUi } from '../core/store.js';
import { CONFIG } from '../config.js';
import { connectionInfo } from '../utils/status.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'registros', label: 'Registros', icon: 'fa-table-list' },
  { id: 'nuevo', label: 'Nuevo registro', icon: 'fa-circle-plus', action: true },
  { id: 'configuracion', label: 'Configuración', icon: 'fa-sliders' },
];

export function mountSidebar(el, { onNew }) {
  el.innerHTML = `
    <div class="sb-brand">
      <div class="sb-logo" aria-hidden="true"><i class="fa-solid fa-route"></i></div>
      <div class="sb-brand-text"><strong>${CONFIG.APP_NAME}</strong><span>UGR-MAG · v${CONFIG.APP_VERSION}</span></div>
    </div>
    <nav class="sb-nav" aria-label="Navegación principal">
      <div class="sb-section">Módulos</div>
      ${NAV.map((n) => `<a class="sb-item" href="${n.action ? '#' : `#/${n.id}`}" data-id="${n.id}" ${n.action ? 'data-action="new" role="button"' : ''} title="${n.label}">
          <i class="fa-solid ${n.icon} fa-fw" aria-hidden="true"></i><span class="sb-label">${n.label}</span></a>`).join('')}
    </nav>
    <div class="sb-footer">
      <div class="sb-status" data-sbstatus title=""><span class="dot"></span><span class="sb-label" data-sbtext></span></div>
      <button type="button" class="sb-collapse" data-collapse aria-label="Contraer menú lateral">
        <i class="fa-solid fa-angles-left fa-fw" aria-hidden="true"></i><span class="sb-label">Contraer menú</span>
      </button>
    </div>`;

  el.addEventListener('click', (e) => {
    const nw = e.target.closest('[data-action="new"]');
    if (nw) { e.preventDefault(); setUi({ sidebarOpen: false }); onNew(); return; }
    if (e.target.closest('[data-collapse]')) setPrefs({ sidebarCollapsed: !getState().prefs.sidebarCollapsed });
  });
  document.getElementById('sbOverlay')?.addEventListener('click', () => setUi({ sidebarOpen: false }));

  const sync = (s, p = {}) => {
    if (s.route !== p.route) {
      el.querySelectorAll('.sb-item').forEach((a) => {
        const on = a.dataset.id === s.route;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    if (s.connection !== p.connection || s.online !== p.online || s.dataMode !== p.dataMode) {
      const info = connectionInfo(s.connection, s.online, s.dataMode);
      const st = el.querySelector('[data-sbstatus]');
      st.className = `sb-status ${info.cls}`;
      st.title = info.title;
      el.querySelector('[data-sbtext]').textContent = `${s.dataMode === 'demo' ? 'DEMO' : 'SUPABASE'} · ${info.label}`;
    }
    if (s.prefs.sidebarCollapsed !== p.prefs?.sidebarCollapsed) {
      el.querySelector('[data-collapse]').setAttribute('aria-label', s.prefs.sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral');
      el.querySelector('[data-collapse] .sb-label').textContent = s.prefs.sidebarCollapsed ? 'Expandir menú' : 'Contraer menú';
    }
    if (s.ui.sidebarOpen !== p.ui?.sidebarOpen) document.getElementById('app').classList.toggle('sb-open', !!s.ui.sidebarOpen);
  };
  sync(getState());
  subscribe(sync);
}
