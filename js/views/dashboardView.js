/** Módulo Dashboard: KPIs, gráficos dinámicos, resumen estadístico y estado de las consultas. */
import { getState, subscribe } from '../core/store.js';
import { CONFIG } from '../config.js';
import { mountScopeBar } from '../components/scopeBar.js';
import { mountFilterBar } from '../components/filterPanel.js';
import { renderKpis } from '../components/kpis.js';
import { mountCharts } from '../components/charts.js';
import { scopeLabel } from '../services/queryModel.js';
import { connectionInfo } from '../utils/status.js';
import { escapeHtml as esc } from '../utils/dom.js';
import { fmtNumber, fmtMoney, fmtTime } from '../utils/format.js';

export async function mount(section) {
  section.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">Dashboard analítico</h1>
        <p class="view-sub" data-scope-label></p>
      </div>
      <div class="view-head-actions"><a class="btn btn-ghost" href="#/registros"><i class="fa-solid fa-table-list"></i><span>Ir a registros</span></a></div>
    </div>
    <div data-scope></div>
    <div class="card card-pad mb-16" data-filters></div>
    <div data-kpis></div>
    <div data-charts></div>
    <div class="dash-bottom">
      <div class="card"><div class="card-head"><h3><i class="fa-solid fa-calculator"></i> Resumen estadístico</h3><span class="card-sub">según filtros activos</span></div><div class="card-pad" data-stats></div></div>
      <div class="card"><div class="card-head"><h3><i class="fa-solid fa-server"></i> Estado de las consultas</h3><span class="card-sub" data-status-sub></span></div><div class="card-pad" data-status></div></div>
    </div>`;

  mountScopeBar(section.querySelector('[data-scope]'));
  mountFilterBar(section.querySelector('[data-filters]'));
  const kpiEl = section.querySelector('[data-kpis]');
  const statsEl = section.querySelector('[data-stats]');
  const statusEl = section.querySelector('[data-status]');
  const labelEl = section.querySelector('[data-scope-label]');
  const charts = await mountCharts(section.querySelector('[data-charts]'));

  const row = (k, v) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`;
  function renderStats(sum) {
    const s = sum.data;
    if (!s) { statsEl.innerHTML = '<span class="skeleton-bar w-80"></span><span class="skeleton-bar w-60"></span>'; return; }
    statsEl.innerHTML = `<table class="stats-table"><tbody>
      ${row('Registros (n)', fmtNumber(s.count))}
      ${row('Km totales', `${fmtNumber(s.totalKm)} km`)}
      ${row('Km por viaje · media', `${fmtNumber(s.avgKm, 1)} km`)}
      ${row('Km por viaje · mediana', `${fmtNumber(s.medianKm, 1)} km`)}
      ${row('Km por viaje · mínimo / máximo', `${fmtNumber(s.minKm)} / ${fmtNumber(s.maxKm)} km`)}
      ${row('Monto total registrado', fmtMoney(s.montoTotal))}
      ${row('Monto cobrado', `${fmtMoney(s.cobrado)} (${fmtNumber(s.pctCobrado, 1)}%)`)}
      ${row('Monto promedio por registro', fmtMoney(s.avgMonto))}
      ${row('Estados distintos', fmtNumber(s.byEstado.length))}
    </tbody></table>`;
  }

  function renderStatus(st) {
    const info = connectionInfo(st.connection, st.online, st.dataMode);
    const t = st.table;
    const c = st.scopeCounts || {};
    const total = c.actual != null && c.archivo != null ? fmtNumber(c.actual + c.archivo) : '…';
    section.querySelector('[data-status-sub]').textContent = t.loadedAt ? `actualizado ${fmtTime(t.loadedAt)}` : '';
    statusEl.innerHTML = `<table class="stats-table"><tbody>
      ${row('Fuente de datos', st.dataMode === 'demo' ? 'Simulador en memoria (demo)' : 'Supabase · PostgreSQL')}
      ${row('Tabla', `<span class="mono">${esc(CONFIG.TABLE)}</span>`)}
      ${row('Tiempo real', `<span class="status-pill sm ${info.cls}"><span class="dot"></span><span class="label">${esc(info.label)}</span></span>`)}
      ${row('Última consulta de tabla', t.lastMs != null ? `${fmtNumber(t.lastMs)} ms` : '—')}
      ${row('Registros en el ámbito actual', fmtNumber(t.total))}
      ${row('Registros totales en la base', total)}
      ${row('Caché de consultas', `${CONFIG.CACHE_TTL_MS / 1000} s (se invalida con cada cambio)`)}
      ${row('Pendientes sin conexión', fmtNumber(st.pendingCount || 0))}
    </tbody></table>`;
  }

  const sync = (s, p = {}) => {
    if (s.summary !== p.summary) {
      renderKpis(kpiEl, s.summary, { variant: 'full' });
      renderStats(s.summary);
      if (s.summary.data) charts.update(s.summary.data);
    }
    if (s.query !== p.query) labelEl.textContent = `${scopeLabel(s.query)} · indicadores sincronizados con los filtros del módulo Registros`;
    if (s.table !== p.table || s.connection !== p.connection || s.online !== p.online || s.scopeCounts !== p.scopeCounts || s.pendingCount !== p.pendingCount) renderStatus(s);
    if (s.prefs?.theme !== p.prefs?.theme && p.prefs) charts.theme();
  };
  sync(getState());
  subscribe(sync);
}
