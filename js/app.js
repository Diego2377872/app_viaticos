/**
 * Punto de entrada. Arquitectura:
 *   views/       → módulos de pantalla (carga diferida por el router)
 *   components/  → componentes de UI reutilizables (presentación)
 *   core/        → store (estado), actions (lógica de negocio), router
 *   services/    → acceso a datos (Supabase o simulador) + modelo de consultas
 *   utils/       → formato, validación, exportación, seguridad
 */
import { CONFIG, STORAGE_KEYS } from './config.js';
import { initStore, getState, setState, subscribe, setUi } from './core/store.js';
import { normalizeQuery } from './services/queryModel.js';
import { createDataSource } from './services/dataSource.js';
import * as actions from './core/actions.js';
import { startRouter } from './core/router.js';
import { openNew } from './core/recordFlows.js';
import { mountSidebar } from './components/sidebar.js';
import { mountTopbar } from './components/topbar.js';
import { closeTopModal } from './components/modal.js';
import { closeDrawer, isDrawerOpen } from './components/drawer.js';
import { closeContextMenu } from './components/contextMenu.js';
import { toast } from './components/toast.js';
import { escapeHtml as esc, isTypingTarget } from './utils/dom.js';
import { fmtNumber } from './utils/format.js';

const loadJSON = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };

function initialPrefs() {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const legacyTheme = localStorage.getItem(STORAGE_KEYS.LEGACY_THEME);
  const saved = loadJSON(STORAGE_KEYS.PREFS, {});
  const prefs = {
    theme: legacyTheme || (prefersDark ? 'dark' : 'light'),
    density: 'comfortable', sidebarCollapsed: false, pageSize: CONFIG.DEFAULT_PAGE_SIZE,
    hiddenColumns: null, columnWidths: {}, savedFilters: [],
    ...saved,
  };
  if (!['light', 'dark'].includes(prefs.theme)) prefs.theme = 'light';
  if (!CONFIG.PAGE_SIZES.includes(prefs.pageSize)) prefs.pageSize = CONFIG.DEFAULT_PAGE_SIZE;
  if (!Array.isArray(prefs.savedFilters)) prefs.savedFilters = [];
  return prefs;
}

function applyPrefsToDom(p) {
  const d = document.documentElement;
  d.dataset.theme = p.theme;
  d.dataset.density = p.density;
  d.dataset.sidebar = p.sidebarCollapsed ? 'collapsed' : 'expanded';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.theme === 'dark' ? '#070b12' : '#0f172a');
}

function renderBanners(s, svc) {
  const parts = [];
  if (s.dataMode === 'demo') {
    parts.push(`<div class="banner banner-demo"><i class="fa-solid fa-flask"></i><span><strong>Modo demostración:</strong> ${fmtNumber(svc?.size || 0)} registros sintéticos en memoria para pruebas de volumen. Los cambios no afectan la base de datos real.</span><a href="${esc(location.pathname)}">Salir del modo demo</a></div>`);
  }
  if (!s.online) parts.push('<div class="banner banner-warn"><i class="fa-solid fa-wifi"></i><span><strong>Sin conexión.</strong> Los registros nuevos se guardarán en este dispositivo y se sincronizarán al reconectar.</span></div>');
  if (s.online && s.pendingCount > 0) parts.push(`<div class="banner banner-warn"><i class="fa-solid fa-cloud-arrow-up"></i><span>${fmtNumber(s.pendingCount)} registro(s) pendiente(s) de sincronizar.</span></div>`);
  document.getElementById('banners').innerHTML = parts.join('');
}

function renderFatal(err) {
  document.getElementById('boot')?.remove();
  const c = document.getElementById('content');
  c.insertAdjacentHTML('afterbegin', `<div class="card state-box error fatal"><i class="fa-solid fa-plug-circle-xmark"></i>
    <h4>No se pudo iniciar la conexión con la base de datos</h4><p>${esc(err.message)}</p>
    <button type="button" class="btn btn-primary btn-sm" id="retryBoot"><i class="fa-solid fa-rotate"></i> Reintentar</button></div>`);
  document.getElementById('retryBoot').addEventListener('click', () => location.reload());
}

async function boot() {
  const prefs = initialPrefs();
  initStore({
    prefs,
    query: normalizeQuery(loadJSON(STORAGE_KEYS.QUERY, null), prefs.pageSize),
    route: 'registros',
    ui: { sidebarOpen: false },
    table: { rows: [], total: 0, loading: true, error: null, lastMs: null, loadedAt: null },
    summary: { data: null, loading: true, error: null },
    selection: new Map(),
    connection: 'connecting',
    distinct: { permisos: [], lugares: [], years: [] },
    scopeCounts: { actual: null, archivo: null },
    online: navigator.onLine,
    pendingCount: 0,
    dataMode: null,
  });
  applyPrefsToDom(prefs);

  // Persistencia de preferencias y de los últimos criterios de búsqueda
  subscribe((s, p) => {
    if (s.prefs !== p.prefs) {
      localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(s.prefs));
      if (s.prefs.theme !== p.prefs.theme) localStorage.setItem(STORAGE_KEYS.LEGACY_THEME, s.prefs.theme);
      applyPrefsToDom(s.prefs);
    }
    if (s.query !== p.query) localStorage.setItem(STORAGE_KEYS.QUERY, JSON.stringify({ ...s.query, page: 1 }));
  });

  mountSidebar(document.getElementById('sidebar'), { onNew: () => openNew() });
  mountTopbar(document.getElementById('topbar'), { onNew: () => openNew(), onRefresh: () => actions.refreshAll() });

  let service;
  try {
    service = await createDataSource();
  } catch (err) {
    setState({ connection: 'CHANNEL_ERROR' });
    renderFatal(err);
    return;
  }
  setState({ dataMode: service.mode, pendingCount: actions.pendingCount() });
  subscribe((s, p) => {
    if (s.dataMode !== p.dataMode || s.online !== p.online || s.pendingCount !== p.pendingCount) renderBanners(s, service);
  });
  renderBanners(getState(), service);

  actions.initActions(service);
  actions.refreshAll();
  actions.startRealtime();
  await startRouter();
  document.getElementById('boot')?.remove();
  actions.syncPending();

  window.addEventListener('online', () => { setState({ online: true }); toast('Conexión restablecida', 'success'); actions.syncPending(); actions.refreshAll(); });
  window.addEventListener('offline', () => { setState({ online: false }); toast('Sin conexión a internet', 'warning'); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (closeContextMenu()) return;
      if (closeTopModal()) return;
      if (isDrawerOpen()) { closeDrawer(); return; }
      if (getState().ui.sidebarOpen) setUi({ sidebarOpen: false });
      return;
    }
    if (e.key === '/' && !isTypingTarget(document.activeElement) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      document.getElementById('globalSearch')?.focus();
    }
  });

  // Exposición mínima para diagnóstico desde la consola del navegador
  window.__viajesUGR = { getState, version: CONFIG.APP_VERSION };
}

boot().catch((err) => { console.error(err); renderFatal(err); });
