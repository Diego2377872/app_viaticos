/** Selector de ámbito: año activo vs. archivo histórico (compartido por Registros y Dashboard). */
import { getState, subscribe, setQuery } from '../core/store.js';
import { ANIO_ACTUAL } from '../config.js';
import { createTabs } from './tabs.js';
import { fmtNumber } from '../utils/format.js';

export function mountScopeBar(el) {
  el.classList.add('scope-bar');
  el.innerHTML = `
    <div data-tabs></div>
    <label class="scope-extra" data-archivo hidden>
      <span><i class="fa-solid fa-box-archive"></i> Año archivado</span>
      <select data-year aria-label="Año archivado"><option value="">Todos los años</option></select>
    </label>`;
  const tabs = createTabs(el.querySelector('[data-tabs]'), [
    { id: 'actual', label: `Año activo ${ANIO_ACTUAL}`, icon: 'fa-calendar-check', badge: '…' },
    { id: 'archivo', label: 'Archivo histórico', icon: 'fa-box-archive', badge: '…' },
  ], { active: getState().query.scope, onChange: (id) => setQuery({ scope: id }) });

  const wrap = el.querySelector('[data-archivo]');
  const yearSel = el.querySelector('[data-year]');
  yearSel.addEventListener('change', () => setQuery({ archivoAnio: yearSel.value }));

  const sync = (s, p = {}) => {
    if (s.query.scope !== p.query?.scope) {
      tabs.setActive(s.query.scope);
      wrap.hidden = s.query.scope !== 'archivo';
    }
    if (s.scopeCounts !== p.scopeCounts) {
      const c = s.scopeCounts || {};
      tabs.setBadge('actual', c.actual == null ? '…' : fmtNumber(c.actual));
      tabs.setBadge('archivo', c.archivo == null ? '…' : fmtNumber(c.archivo));
    }
    if (s.distinct !== p.distinct) {
      yearSel.innerHTML = `<option value="">Todos los años</option>${(s.distinct.years || []).map((y) => `<option value="${y}">${y}</option>`).join('')}`;
    }
    const want = String(s.query.archivoAnio || '');
    if (yearSel.value !== want) yearSel.value = want;
  };
  sync(getState());
  subscribe(sync);
}
