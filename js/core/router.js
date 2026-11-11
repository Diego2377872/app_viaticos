/**
 * Enrutador por hash (#/dashboard, #/registros, #/configuracion) con carga diferida:
 * cada módulo se descarga e inicializa solo la primera vez que se visita y luego se
 * conserva montado (mantiene scroll y estado al navegar).
 */
import { getState, setState } from './store.js';
import { escapeHtml as esc } from '../utils/dom.js';

const VIEWS = {
  dashboard: () => import('../views/dashboardView.js'),
  registros: () => import('../views/registrosView.js'),
  configuracion: () => import('../views/configView.js'),
};
export const ROUTE_TITLES = { dashboard: 'Dashboard', registros: 'Registros', configuracion: 'Configuración' };
const DEFAULT = 'registros';
const mounted = {};

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return VIEWS[id] ? id : DEFAULT;
}

async function go() {
  const id = currentRoute();
  document.querySelectorAll('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== id; });
  setState((s) => ({ route: id, ui: { ...s.ui, sidebarOpen: false } }));
  document.title = `${ROUTE_TITLES[id]} · Viajes UGR`;
  const section = document.querySelector(`[data-view="${id}"]`);
  if (!mounted[id]) {
    mounted[id] = (async () => {
      section.innerHTML = `<div class="view-loading"><span class="skeleton-bar w-40"></span><span class="skeleton-bar w-80"></span><span class="skeleton-bar w-60"></span></div>`;
      try {
        const mod = await VIEWS[id]();
        section.innerHTML = '';
        return (await mod.mount(section)) || {};
      } catch (err) {
        console.error(err);
        section.innerHTML = `<div class="card state-box error"><i class="fa-solid fa-triangle-exclamation"></i>
          <h4>No se pudo cargar el módulo</h4><p>${esc(err.message)}</p></div>`;
        delete mounted[id];
        return {};
      }
    })();
  }
  const api = await mounted[id];
  if (getState().route === id) api?.onShow?.();
}

export function startRouter() {
  window.addEventListener('hashchange', go);
  if (!location.hash) history.replaceState(null, '', `#/${DEFAULT}`);
  return go();
}
