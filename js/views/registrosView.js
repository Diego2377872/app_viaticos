/** Módulo Registros: ámbito (año activo / archivo), KPIs vinculados, filtros y tabla inteligente. */
import { getState, subscribe } from '../core/store.js';
import { COLUMNS } from '../config.js';
import * as actions from '../core/actions.js';
import { openNew, openEdit, openDetail } from '../core/recordFlows.js';
import { mountScopeBar } from '../components/scopeBar.js';
import { mountFilterBar } from '../components/filterPanel.js';
import { mountDataTable } from '../components/dataTable.js';
import { renderKpis } from '../components/kpis.js';
import { scopeLabel } from '../services/queryModel.js';

export function mount(section) {
  section.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">Registros de viajes</h1>
        <p class="view-sub" data-scope-label></p>
      </div>
      <div class="view-head-actions">
        <a class="btn btn-ghost" href="#/dashboard"><i class="fa-solid fa-chart-pie"></i><span>Ver dashboard</span></a>
        <button type="button" class="btn btn-primary" data-new><i class="fa-solid fa-plus"></i><span>Nuevo registro</span></button>
      </div>
    </div>
    <div data-scope></div>
    <div data-kpis></div>
    <div class="card card-flush">
      <div class="card-pad" data-filters></div>
      <div data-table></div>
    </div>`;

  mountScopeBar(section.querySelector('[data-scope]'));
  mountFilterBar(section.querySelector('[data-filters]'));
  mountDataTable(section.querySelector('[data-table]'), {
    columns: COLUMNS,
    onOpen: (r, tab) => openDetail(r, tab),
    onEdit: (r) => openEdit(r),
    onDelete: (r) => actions.deleteRecords([r.id]),
    onDeleteMany: (ids) => actions.deleteRecords(ids),
    onExport: (fmt, o) => actions.exportData(fmt, o),
    onRetry: () => actions.loadTable(),
    onClearAll: () => actions.clearAllFilters(),
  });
  section.querySelector('[data-new]').addEventListener('click', () => openNew());

  const kpiEl = section.querySelector('[data-kpis]');
  const labelEl = section.querySelector('[data-scope-label]');
  const sync = (s, p = {}) => {
    if (s.summary !== p.summary) renderKpis(kpiEl, s.summary, { variant: 'compact' });
    if (s.query !== p.query) labelEl.textContent = `${scopeLabel(s.query)} · consulta, filtrado y gestión con sincronización en tiempo real`;
  };
  sync(getState());
  subscribe(sync);
}
