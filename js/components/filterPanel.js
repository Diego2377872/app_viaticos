/**
 * Barra de filtros: chips de filtros activos, panel desplegable de filtros avanzados
 * combinables y filtros guardados. Todos los cambios actualizan el store → tabla, KPIs y gráficos.
 */
import { getState, setState, subscribe, setFilters } from '../core/store.js';
import { MESES } from '../config.js';
import { describeFilters, monthYearFor, savableQuery } from '../services/queryModel.js';
import { escapeHtml as esc, debounce } from '../utils/dom.js';
import * as actions from '../core/actions.js';
import { openMenuAt } from './contextMenu.js';
import { promptDialog } from './modal.js';

const ADV_HTML = `
  <div class="collapsible" data-adv>
    <div class="collapsible-inner">
      <div class="fadv-grid">
        <label class="ff"><span>Mes</span>
          <select data-f="mes"><option value="">Todos los meses</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
          <small class="ff-hint" data-mes-hint hidden>Elija un año archivado para filtrar por mes</small>
        </label>
        <label class="ff"><span>Fecha desde</span><input type="date" data-f="fechaDesde"></label>
        <label class="ff"><span>Fecha hasta</span><input type="date" data-f="fechaHasta"></label>
        <label class="ff"><span>Viático cobrado</span>
          <select data-f="viatico"><option value="">Todos</option><option value="Sí">Sí</option><option value="No">No</option></select>
        </label>
        <label class="ff"><span>Estado del expediente</span><select data-f="permiso"><option value="">Todos</option></select></label>
        <label class="ff"><span>Lugar / institución</span>
          <input type="search" data-f="lugar" list="dl-filter-lugares" placeholder="Escriba para ver sugerencias…" autocomplete="off">
          <datalist id="dl-filter-lugares"></datalist>
        </label>
        <div class="ff"><span>Km recorridos</span>
          <div class="ff-range"><input type="number" min="0" inputmode="numeric" data-f="kmMin" placeholder="Mín." aria-label="Km mínimo"><span>—</span><input type="number" min="0" inputmode="numeric" data-f="kmMax" placeholder="Máx." aria-label="Km máximo"></div>
        </div>
        <div class="ff"><span>Monto (Gs)</span>
          <div class="ff-range"><input type="number" min="0" inputmode="numeric" data-f="montoMin" placeholder="Mín." aria-label="Monto mínimo"><span>—</span><input type="number" min="0" inputmode="numeric" data-f="montoMax" placeholder="Máx." aria-label="Monto máximo"></div>
        </div>
      </div>
    </div>
  </div>`;

export function mountFilterBar(container, { advanced = true, saved = true } = {}) {
  container.innerHTML = `
    <div class="fbar">
      <div class="fbar-row">
        ${advanced ? `<button type="button" class="btn btn-ghost btn-sm" data-act="adv" aria-expanded="false">
            <i class="fa-solid fa-sliders"></i><span>Filtros avanzados</span><span class="count-badge" data-count hidden>0</span><i class="fa-solid fa-chevron-down chev"></i></button>` : ''}
        ${saved ? `<button type="button" class="btn btn-ghost btn-sm" data-act="saved" aria-haspopup="menu"><i class="fa-regular fa-bookmark"></i><span>Guardados</span></button>` : ''}
        <div class="chips" data-chips aria-live="polite"></div>
        <button type="button" class="btn btn-link btn-sm" data-act="clear" hidden><i class="fa-solid fa-xmark"></i> Limpiar todo</button>
      </div>
      ${advanced ? ADV_HTML : ''}
    </div>`;

  const adv = container.querySelector('[data-adv]');
  const advBtn = container.querySelector('[data-act="adv"]');
  let chips = [];

  const setAdvOpen = (open) => {
    if (!adv) return;
    adv.classList.toggle('open', open);
    advBtn.setAttribute('aria-expanded', String(open));
  };

  /* ---- Campos ---- */
  const debounced = debounce((k, v) => setFilters({ [k]: v }), 400);
  container.addEventListener('input', (e) => {
    const f = e.target.closest('input[data-f]');
    if (f && (f.type === 'number' || f.type === 'search')) debounced(f.dataset.f, f.value.trim());
  });
  container.addEventListener('change', (e) => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    if (f.tagName === 'SELECT' || f.type === 'date') {
      let v = f.value;
      const q = getState().query.filters;
      // Corrige rangos invertidos de fecha automáticamente
      if (f.dataset.f === 'fechaDesde' && v && q.fechaHasta && v > q.fechaHasta) setFilters({ fechaHasta: '' });
      if (f.dataset.f === 'fechaHasta' && v && q.fechaDesde && v < q.fechaDesde) v = q.fechaDesde;
      setFilters({ [f.dataset.f]: v });
    }
  });

  /* ---- Botones ---- */
  container.addEventListener('click', async (e) => {
    const chipBtn = e.target.closest('[data-chip]');
    if (chipBtn) {
      const chip = chips.find((c) => c.id === chipBtn.dataset.chip);
      if (chip) setState((s) => ({ query: { ...chip.clear(s.query), page: 1 } }));
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'adv') setAdvOpen(!adv.classList.contains('open'));
    if (b.dataset.act === 'clear') actions.clearAllFilters();
    if (b.dataset.act === 'saved') savedMenu(b);
  });

  function savedMenu(anchor) {
    const list = getState().prefs.savedFilters || [];
    const items = [];
    if (list.length) {
      items.push({ header: 'Aplicar filtro guardado' });
      list.slice(0, 12).forEach((f) => items.push({ label: f.name, icon: 'fa-bookmark', onClick: () => actions.applySavedFilter(f) }));
      items.push({ divider: true });
    } else items.push({ header: 'Aún no hay filtros guardados' });
    items.push({
      label: 'Guardar filtros actuales…', icon: 'fa-floppy-disk',
      disabled: !describeFilters(getState().query).length && getState().query.scope === 'actual',
      onClick: async () => {
        const name = await promptDialog({ title: 'Guardar filtro', label: 'Nombre del filtro', placeholder: 'Ej. Viáticos pendientes 2026' });
        if (name) actions.saveCurrentFilter(name);
      },
    });
    items.push({ label: 'Administrar filtros…', icon: 'fa-gear', onClick: () => { location.hash = '#/configuracion'; } });
    openMenuAt(anchor, items);
  }

  document.addEventListener('app:open-advanced', () => {
    if (!adv || container.offsetParent === null) return;
    setAdvOpen(true);
    adv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => container.querySelector('[data-f="fechaDesde"]')?.focus(), 300);
  });

  /* ---- Sincronización con el store ---- */
  function syncFields(s) {
    if (!adv) return;
    const f = s.query.filters;
    container.querySelectorAll('[data-f]').forEach((el) => {
      if (el !== document.activeElement) el.value = f[el.dataset.f] ?? '';
    });
    const mesOk = monthYearFor(s.query) !== null;
    const mes = container.querySelector('[data-f="mes"]');
    mes.disabled = !mesOk;
    container.querySelector('[data-mes-hint]').hidden = mesOk;
  }

  function syncOptions(s) {
    if (!adv) return;
    const sel = container.querySelector('[data-f="permiso"]');
    const cur = s.query.filters.permiso;
    const opts = [...(s.distinct.permisos || [])];
    if (cur && !opts.includes(cur)) opts.unshift(cur);
    sel.innerHTML = `<option value="">Todos</option>${opts.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}`;
    sel.value = cur || '';
    container.querySelector('#dl-filter-lugares').innerHTML = (s.distinct.lugares || []).map((l) => `<option value="${esc(l)}">`).join('');
  }

  function syncChips(s) {
    chips = describeFilters(s.query);
    container.querySelector('[data-chips]').innerHTML = chips.length
      ? chips.map((c) => `<span class="chip"><span title="${esc(c.label)}">${esc(c.label)}</span><button type="button" data-chip="${esc(c.id)}" aria-label="Quitar filtro ${esc(c.label)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
      : '<span class="chips-empty">Sin filtros activos</span>';
    container.querySelector('[data-act="clear"]').hidden = !chips.length;
    const count = container.querySelector('[data-count]');
    if (count) { count.hidden = !chips.length; count.textContent = String(chips.length); }
  }

  const sync = (s, p = {}) => {
    if (s.query !== p.query) { syncFields(s); syncChips(s); }
    if (s.distinct !== p.distinct) syncOptions(s);
  };
  sync(getState());
  subscribe(sync);
  return { open: () => setAdvOpen(true), savable: () => savableQuery(getState().query) };
}
