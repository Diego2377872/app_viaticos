/**
 * Tabla inteligente.
 *  - Encabezado fijo (2 filas: títulos + filtros) dentro de su propio contenedor de scroll.
 *  - Columnas fijas: selección + Período (izquierda) y Acciones (derecha).
 *  - Ordenamiento y filtros por columna ejecutados en el servidor.
 *  - Redimensionado de columnas (arrastrar / doble clic restablece), columnas visibles.
 *  - Paginación configurable, selección múltiple persistente entre páginas, menú contextual.
 * El DOM nunca contiene más filas que el tamaño de página (≤250), por eso no requiere virtualización.
 */
import { getState, setState, subscribe, setQuery, setPrefs, setColumnFilter } from '../core/store.js';
import { CONFIG } from '../config.js';
import { escapeHtml as esc, debounce, safeUrl, copyText } from '../utils/dom.js';
import { fmtNumber, fmtDate, fmtDateTime, fmtTime, plural } from '../utils/format.js';
import { estadoBadge } from '../utils/palette.js';
import { openContextMenu, openMenuAt } from './contextMenu.js';
import { toast } from './toast.js';

const CHECK_W = 44;
const ACT_W = 56;
const MIN_W = 72;
const isNumeric = (c) => c.type === 'number' || c.type === 'money';

export function mountDataTable(container, opts) {
  const { columns } = opts;
  container.innerHTML = `
  <div class="dt">
    <div class="dt-progress" aria-hidden="true"></div>
    <div class="dt-toolbar">
      <div class="dt-info" aria-live="polite"><span class="dt-total" data-total>Cargando registros…</span><span class="dt-meta" data-meta></span></div>
      <div class="dt-selbar" data-selbar hidden>
        <span data-selcount></span>
        <button type="button" class="btn btn-ghost btn-sm" data-act="sel-export"><i class="fa-solid fa-download"></i><span>Exportar</span></button>
        <button type="button" class="btn btn-danger-ghost btn-sm" data-act="sel-delete"><i class="fa-solid fa-trash"></i><span>Eliminar</span></button>
        <button type="button" class="icon-btn sm ghost" data-act="sel-clear" title="Quitar selección" aria-label="Quitar selección"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="dt-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-act="density" title="Alternar densidad de filas"><i class="fa-solid fa-bars-staggered"></i><span>Densidad</span></button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="columns" aria-haspopup="menu"><i class="fa-solid fa-table-columns"></i><span>Columnas</span></button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="export" aria-haspopup="menu"><i class="fa-solid fa-file-export"></i><span>Exportar</span></button>
      </div>
    </div>
    <div class="dt-scroll" data-scroll>
      <table class="dt-table" aria-label="Registros de viajes">
        <colgroup data-cols></colgroup>
        <thead data-head></thead>
        <tbody data-body></tbody>
      </table>
      <div class="dt-state" data-state hidden></div>
    </div>
    <div class="dt-footer">
      <label class="dt-pagesize">Filas por página
        <select data-pagesize aria-label="Filas por página">${CONFIG.PAGE_SIZES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
      </label>
      <span class="dt-range" data-range></span>
      <nav class="dt-pager" data-pager aria-label="Paginación"></nav>
    </div>
  </div>`;

  const root = container.querySelector('.dt');
  const $ = (s) => root.querySelector(s);
  const scrollEl = $('[data-scroll]');
  const table = $('table');
  const colsEl = $('[data-cols]');
  const headEl = $('[data-head]');
  const bodyEl = $('[data-body]');
  const stateEl = $('[data-state]');

  const defaultHidden = columns.filter((c) => c.hiddenByDefault).map((c) => c.key);
  const hiddenCols = () => getState().prefs.hiddenColumns ?? defaultHidden;
  const visibleCols = () => columns.filter((c) => c.locked || !hiddenCols().includes(c.key));
  const widthOf = (c) => getState().prefs.columnWidths?.[c.key] || c.width;
  const sortFieldOf = (c) => c.sortField || c.key;
  let skipWidthRender = false;
  let lastPageKey = '';

  /* ------------------------------ Encabezado ------------------------------ */

  function filterControl(c, val) {
    if (c.filter === 'text') {
      return `<input type="search" class="col-filter" data-colfilter="${c.key}" value="${esc(val)}" placeholder="Filtrar…" aria-label="Filtrar ${esc(c.label)}">`;
    }
    if (c.filter === 'select') {
      const opts2 = [...(c.options || getState().distinct?.[c.optionsFrom] || [])];
      if (val && !opts2.includes(val)) opts2.unshift(val);
      return `<select class="col-filter" data-colfilter="${c.key}" aria-label="Filtrar ${esc(c.label)}"><option value="">Todos</option>${opts2.map((o) => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    if (c.type === 'period') {
      return '<button type="button" class="col-filter-link" data-act="open-adv" title="Filtrar por rango de fechas"><i class="fa-regular fa-calendar"></i> Rango</button>';
    }
    return '';
  }

  function updateTableWidth() {
    let total = 0;
    colsEl.querySelectorAll('col').forEach((col) => { total += parseInt(col.style.width, 10) || 0; });
    table.style.width = `${total}px`;
  }

  function measureHead() {
    const h = headEl.querySelector('.dt-hrow')?.getBoundingClientRect().height;
    if (h) root.style.setProperty('--dt-h1', `${h}px`);
  }

  function renderHead() {
    const focused = document.activeElement?.closest?.('[data-colfilter]');
    const focusKey = focused && headEl.contains(focused) ? focused.dataset.colfilter : null;
    const caret = focusKey && focused.selectionStart != null ? focused.selectionStart : null;

    const cols = visibleCols();
    const cf = getState().query.columnFilters || {};
    colsEl.innerHTML = `<col style="width:${CHECK_W}px">${cols.map((c) => `<col data-col="${c.key}" style="width:${widthOf(c)}px">`).join('')}<col style="width:${ACT_W}px">`;
    updateTableWidth();
    headEl.innerHTML = `
      <tr class="dt-hrow">
        <th class="dt-check sticky-l0" scope="col"><input type="checkbox" data-selall aria-label="Seleccionar registros de esta página"></th>
        ${cols.map((c) => `<th scope="col" data-key="${c.key}" class="${c.sticky ? 'sticky-l1' : ''} ${isNumeric(c) ? 'num' : ''}">
            <button type="button" class="th-sort" data-sort="${c.key}" ${c.sortable === false ? 'disabled' : ''} title="${c.sortable === false ? '' : 'Ordenar por ' + esc(c.label)}">
              <span class="th-label">${esc(c.label)}</span>${c.sortable === false ? '' : '<i class="fa-solid fa-sort sort-icon" aria-hidden="true"></i>'}
            </button>
            <span class="th-resize" data-resize="${c.key}" title="Arrastrar para ajustar · doble clic para restablecer"></span>
          </th>`).join('')}
        <th class="dt-act sticky-r0" scope="col"><span class="sr-only">Acciones</span><i class="fa-solid fa-gear" aria-hidden="true"></i></th>
      </tr>
      <tr class="dt-frow">
        <th class="dt-check sticky-l0"></th>
        ${cols.map((c) => `<th class="${c.sticky ? 'sticky-l1' : ''}">${filterControl(c, cf[c.key] || '')}</th>`).join('')}
        <th class="dt-act sticky-r0"><button type="button" class="icon-btn sm ghost" data-act="clear-colfilters" title="Limpiar filtros de columna" aria-label="Limpiar filtros de columna"><i class="fa-solid fa-filter-circle-xmark"></i></button></th>
      </tr>`;
    updateSortIndicators();
    measureHead();
    if (focusKey) {
      const f = headEl.querySelector(`[data-colfilter="${focusKey}"]`);
      f?.focus();
      if (caret != null && f?.setSelectionRange) f.setSelectionRange(caret, caret);
    }
  }

  function updateSortIndicators() {
    const { field, dir } = getState().query.sort;
    headEl.querySelectorAll('th[data-key]').forEach((th) => {
      const c = columns.find((x) => x.key === th.dataset.key);
      if (!c || c.sortable === false) return;
      const active = sortFieldOf(c) === field;
      th.classList.toggle('sorted', active);
      th.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.className = `fa-solid sort-icon ${active ? (dir === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short') : 'fa-sort'}`;
    });
  }

  function syncColFilters() {
    const cf = getState().query.columnFilters || {};
    headEl.querySelectorAll('[data-colfilter]').forEach((el) => {
      if (el !== document.activeElement) el.value = cf[el.dataset.colfilter] || '';
    });
  }

  /* ------------------------------ Cuerpo ------------------------------ */

  function cell(c, r) {
    const v = r[c.key];
    switch (c.type) {
      case 'period':
        return `<td class="sticky-l1 cell-period"><span class="mono">${fmtDate(r.fecha_desde)}</span>${r.fecha_hasta && r.fecha_hasta !== r.fecha_desde ? `<small class="mono">→ ${fmtDate(r.fecha_hasta)}</small>` : ''}</td>`;
      case 'longtext':
        return `<td class="cell-text" title="${esc(v || '')}">${v ? `<span class="clamp">${esc(v)}</span>` : '<span class="muted">—</span>'}</td>`;
      case 'code':
        return `<td class="mono">${v ? esc(v) : '<span class="muted">—</span>'}</td>`;
      case 'estado':
        return `<td>${estadoBadge(v, esc)}</td>`;
      case 'number':
      case 'money':
        return `<td class="num mono ${c.emphasis ? 'em' : ''}">${v == null || v === '' ? '<span class="muted">—</span>' : fmtNumber(v)}</td>`;
      case 'viatico':
        return `<td><span class="pill ${v === 'Sí' ? 'pill-ok' : 'pill-muted'}"><i class="fa-solid ${v === 'Sí' ? 'fa-check' : 'fa-minus'}" aria-hidden="true"></i>${esc(v || '—')}</span></td>`;
      case 'images': {
        const imgs = Array.isArray(v) ? v : [];
        if (!imgs.length) return '<td><span class="muted">—</span></td>';
        return `<td><div class="thumbs">${imgs.slice(0, 3).map((u) => `<img src="${esc(safeUrl(u))}" alt="Evidencia" loading="lazy" decoding="async" data-act="open-evid">`).join('')}${imgs.length > 3 ? `<span class="more">+${imgs.length - 3}</span>` : ''}</div></td>`;
      }
      case 'datetime':
        return `<td class="mono">${fmtDateTime(v)}</td>`;
      default:
        return `<td title="${esc(v || '')}">${v ? esc(v) : '<span class="muted">—</span>'}</td>`;
    }
  }

  function skeletonRows(cols, n = 8) {
    const tds = [`<td class="dt-check sticky-l0"><span class="skeleton-bar sk-box"></span></td>`,
      ...cols.map((c, i) => `<td class="${c.sticky ? 'sticky-l1' : ''}"><span class="skeleton-bar" style="width:${45 + ((i * 29) % 45)}%"></span></td>`),
      '<td class="dt-act sticky-r0"></td>'].join('');
    return Array.from({ length: n }, () => `<tr class="sk">${tds}</tr>`).join('');
  }

  function rowHtml(r, i, cols, sel) {
    return `
      <tr data-idx="${i}" tabindex="0" class="${sel.has(r.id) ? 'selected' : ''}" aria-selected="${sel.has(r.id)}">
        <td class="dt-check sticky-l0"><input type="checkbox" data-sel aria-label="Seleccionar registro" ${sel.has(r.id) ? 'checked' : ''}></td>
        ${cols.map((c) => cell(c, r)).join('')}
        <td class="dt-act sticky-r0"><button type="button" class="icon-btn sm ghost" data-act="row-menu" aria-label="Acciones del registro" aria-haspopup="menu"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
      </tr>`;
  }

  // Renderizado progresivo: primeras FIRST_BATCH filas de inmediato, el resto por cuadros de animación.
  // Un token cancela lotes pendientes si llega una nueva consulta antes de terminar.
  const FIRST_BATCH = 60;
  const NEXT_BATCH = 80;
  let renderToken = 0;

  function renderBody() {
    const token = ++renderToken;
    const s = getState();
    const { rows, loading, error } = s.table;
    const cols = visibleCols();
    root.classList.toggle('is-loading', !!loading);
    table.setAttribute('aria-busy', String(!!loading));
    stateEl.hidden = true;

    if (error && !loading) {
      bodyEl.innerHTML = '';
      stateEl.hidden = false;
      stateEl.innerHTML = `<div class="state-box error"><i class="fa-solid fa-triangle-exclamation"></i><h4>No se pudieron cargar los datos</h4><p>${esc(error)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-act="retry"><i class="fa-solid fa-rotate"></i> Reintentar</button></div>`;
      return;
    }
    if (loading && !rows.length) { bodyEl.innerHTML = skeletonRows(cols); return; }
    if (!rows.length) {
      bodyEl.innerHTML = '';
      stateEl.hidden = false;
      stateEl.innerHTML = `<div class="state-box"><i class="fa-regular fa-folder-open"></i><h4>Sin resultados</h4>
        <p>No hay registros que coincidan con los criterios aplicados.</p>
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear-all"><i class="fa-solid fa-filter-circle-xmark"></i> Limpiar filtros</button></div>`;
      return;
    }
    const sel = s.selection;
    bodyEl.innerHTML = rows.slice(0, FIRST_BATCH).map((r, i) => rowHtml(r, i, cols, sel)).join('');
    if (rows.length > FIRST_BATCH) {
      let next = FIRST_BATCH;
      const step = () => {
        if (token !== renderToken) return;
        const end = Math.min(rows.length, next + NEXT_BATCH);
        bodyEl.insertAdjacentHTML('beforeend', rows.slice(next, end).map((r, k) => rowHtml(r, next + k, cols, sel)).join(''));
        next = end;
        if (next < rows.length) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    const q = s.query;
    const pageKey = `${q.page}|${q.pageSize}|${q.sort.field}|${q.sort.dir}`;
    if (pageKey !== lastPageKey) { scrollEl.scrollTop = 0; lastPageKey = pageKey; }
    updateSelectAll();
  }

  function updateSelectAll() {
    const all = headEl.querySelector('[data-selall]');
    if (!all) return;
    const { rows } = getState().table;
    const sel = getState().selection;
    const n = rows.filter((r) => sel.has(r.id)).length;
    all.checked = rows.length > 0 && n === rows.length;
    all.indeterminate = n > 0 && n < rows.length;
  }

  /* ------------------------------ Barra y pie ------------------------------ */

  function renderToolbar() {
    const s = getState();
    const { total, loading, lastMs, loadedAt } = s.table;
    $('[data-total]').innerHTML = loading && !loadedAt
      ? 'Cargando registros…'
      : `<strong>${fmtNumber(total)}</strong> ${total === 1 ? 'registro encontrado' : 'registros encontrados'}`;
    $('[data-meta]').textContent = lastMs != null ? `consulta ${lastMs} ms · ${fmtTime(loadedAt)}` : '';
    const n = s.selection.size;
    $('[data-selbar]').hidden = !n;
    $('[data-selcount]').textContent = n ? `${plural(n, 'seleccionado', 'seleccionados')}` : '';
  }

  function pageList(page, pages) {
    const set = [...new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
    const out = [];
    set.forEach((p, i) => { if (i && p - set[i - 1] > 1) out.push('…'); out.push(p); });
    return out;
  }

  function renderFooter() {
    const { total } = getState().table;
    const { page, pageSize } = getState().query;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(total, page * pageSize);
    $('[data-range]').textContent = total ? `${fmtNumber(from)}–${fmtNumber(to)} de ${fmtNumber(total)} · pág. ${fmtNumber(page)}/${fmtNumber(pages)}` : 'Sin registros';
    $('[data-pagesize]').value = String(pageSize);
    const btn = (p, icon, label, disabled) => `<button type="button" class="pg-btn" data-page="${p}" ${disabled ? 'disabled' : ''} aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
    $('[data-pager]').innerHTML = [
      btn(1, 'fa-angles-left', 'Primera página', page <= 1),
      btn(page - 1, 'fa-angle-left', 'Página anterior', page <= 1),
      ...pageList(page, pages).map((p) => (p === '…'
        ? '<span class="pg-gap">…</span>'
        : `<button type="button" class="pg-btn pg-num ${p === page ? 'active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${fmtNumber(p)}</button>`)),
      btn(page + 1, 'fa-angle-right', 'Página siguiente', page >= pages),
      btn(pages, 'fa-angles-right', 'Última página', page >= pages),
    ].join('');
  }

  /* ------------------------------ Selección ------------------------------ */

  function toggleSel(row, force) {
    const sel = new Map(getState().selection);
    const on = force ?? !sel.has(row.id);
    if (on) sel.set(row.id, row); else sel.delete(row.id);
    setState({ selection: sel });
  }

  function toggleAllPage(on) {
    const sel = new Map(getState().selection);
    getState().table.rows.forEach((r) => { if (on) sel.set(r.id, r); else sel.delete(r.id); });
    setState({ selection: sel });
  }

  /* ------------------------------ Menús ------------------------------ */

  function rowMenu(row, x, y) {
    const selected = getState().selection.has(row.id);
    const imgs = (row.imagenes || []).length;
    openContextMenu(x, y, [
      { header: `${fmtDate(row.fecha_desde)} · ${String(row.lugar || '').slice(0, 28)}` },
      { label: 'Ver detalle', icon: 'fa-eye', onClick: () => opts.onOpen(row, 'general') },
      { label: 'Editar', icon: 'fa-pen', onClick: () => opts.onEdit(row) },
      { label: 'Ver evidencias', icon: 'fa-images', hint: String(imgs), disabled: !imgs, onClick: () => opts.onOpen(row, 'evid') },
      { label: 'Copiar N° expediente', icon: 'fa-copy', disabled: !row.numero_expediente, onClick: async () => toast((await copyText(row.numero_expediente)) ? 'N° de expediente copiado' : 'No se pudo copiar', 'info', { timeout: 2000 }) },
      { label: selected ? 'Quitar de la selección' : 'Agregar a la selección', icon: selected ? 'fa-regular fa-square-minus' : 'fa-regular fa-square-check', onClick: () => toggleSel(row) },
      { divider: true },
      { label: 'Eliminar', icon: 'fa-trash', danger: true, onClick: () => opts.onDelete(row) },
    ]);
  }

  function columnsMenu(anchor) {
    const items = [{ header: 'Columnas visibles' }];
    columns.filter((c) => !c.locked).forEach((c) => {
      const visible = () => !hiddenCols().includes(c.key);
      items.push({
        label: c.label,
        icon: visible() ? 'fa-solid fa-square-check' : 'fa-regular fa-square',
        keepOpen: true,
        onClick: (btnEl) => {
          const hidden = new Set(hiddenCols());
          if (hidden.has(c.key)) hidden.delete(c.key); else hidden.add(c.key);
          setPrefs({ hiddenColumns: [...hidden] });
          btnEl.querySelector('i').className = `${visible() ? 'fa-solid fa-square-check' : 'fa-regular fa-square'} fa-fw`;
        },
      });
    });
    items.push({ divider: true },
      { label: 'Mostrar todas', icon: 'fa-eye', onClick: () => setPrefs({ hiddenColumns: [] }) },
      { label: 'Restablecer columnas y anchos', icon: 'fa-arrows-left-right', onClick: () => setPrefs({ hiddenColumns: null, columnWidths: {} }) });
    openMenuAt(anchor, items, { align: 'right' });
  }

  function exportMenu(anchor, onlySelected = false) {
    const s = getState();
    const items = [];
    if (!onlySelected) {
      items.push({ header: `Resultados filtrados (${fmtNumber(s.table.total)})` },
        { label: 'CSV (separado por ;)', icon: 'fa-file-csv', onClick: () => opts.onExport('csv', { selectedOnly: false }) },
        { label: 'Excel (.xlsx)', icon: 'fa-file-excel', onClick: () => opts.onExport('xlsx', { selectedOnly: false }) });
    }
    if (s.selection.size) {
      if (items.length) items.push({ divider: true });
      items.push({ header: `Seleccionados (${fmtNumber(s.selection.size)})` },
        { label: 'CSV (separado por ;)', icon: 'fa-file-csv', onClick: () => opts.onExport('csv', { selectedOnly: true }) },
        { label: 'Excel (.xlsx)', icon: 'fa-file-excel', onClick: () => opts.onExport('xlsx', { selectedOnly: true }) });
    }
    openMenuAt(anchor, items, { align: 'right' });
  }

  /* ------------------------------ Eventos ------------------------------ */

  const colDebouncers = new Map();
  headEl.addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-colfilter]');
    if (!inp) return;
    const key = inp.dataset.colfilter;
    if (!colDebouncers.has(key)) colDebouncers.set(key, debounce((v) => setColumnFilter(key, v.trim()), 350));
    colDebouncers.get(key)(inp.value);
  });
  headEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-colfilter]');
    if (sel) setColumnFilter(sel.dataset.colfilter, sel.value);
    const all = e.target.closest('[data-selall]');
    if (all) toggleAllPage(all.checked);
  });
  headEl.addEventListener('click', (e) => {
    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn && !sortBtn.disabled) {
      const c = columns.find((x) => x.key === sortBtn.dataset.sort);
      const field = sortFieldOf(c);
      const cur = getState().query.sort;
      const dir = cur.field === field ? (cur.dir === 'asc' ? 'desc' : 'asc') : (isNumeric(c) || c.type === 'period' || c.type === 'datetime' ? 'desc' : 'asc');
      setQuery({ sort: { field, dir } });
      return;
    }
    if (e.target.closest('[data-act="clear-colfilters"]')) setQuery({ columnFilters: {} });
    if (e.target.closest('[data-act="open-adv"]')) document.dispatchEvent(new CustomEvent('app:open-advanced'));
  });

  // Redimensionado de columnas con Pointer Events (mouse, lápiz y táctil)
  headEl.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-resize]');
    if (!h) return;
    e.preventDefault();
    const key = h.dataset.resize;
    const col = colsEl.querySelector(`col[data-col="${key}"]`);
    const startX = e.clientX;
    const startW = h.closest('th').getBoundingClientRect().width;
    h.classList.add('active');
    h.setPointerCapture(e.pointerId);
    document.body.classList.add('is-resizing');
    const move = (ev) => { col.style.width = `${Math.max(MIN_W, Math.round(startW + ev.clientX - startX))}px`; updateTableWidth(); };
    const up = () => {
      h.classList.remove('active');
      document.body.classList.remove('is-resizing');
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', up);
      h.removeEventListener('pointercancel', up);
      skipWidthRender = true;
      setPrefs({ columnWidths: { ...getState().prefs.columnWidths, [key]: parseInt(col.style.width, 10) } });
      skipWidthRender = false;
      measureHead();
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
  headEl.addEventListener('dblclick', (e) => {
    const h = e.target.closest('[data-resize]');
    if (!h) return;
    const w = { ...getState().prefs.columnWidths };
    delete w[h.dataset.resize];
    setPrefs({ columnWidths: w });
  });

  const rowFromEvent = (e) => {
    const tr = e.target.closest('tr[data-idx]');
    return tr ? getState().table.rows[Number(tr.dataset.idx)] : null;
  };
  bodyEl.addEventListener('click', (e) => {
    const row = rowFromEvent(e);
    if (!row) return;
    const chk = e.target.closest('.dt-check');
    if (chk) {
      const input = chk.querySelector('input');
      toggleSel(row, e.target === input ? input.checked : !getState().selection.has(row.id));
      return;
    }
    const menuBtn = e.target.closest('[data-act="row-menu"]');
    if (menuBtn) { const r = menuBtn.getBoundingClientRect(); rowMenu(row, r.right - 240, r.bottom + 4); return; }
    if (e.target.closest('[data-act="open-evid"]')) { opts.onOpen(row, 'evid'); return; }
    if (String(window.getSelection?.() || '').length > 0) return; // permite seleccionar y copiar texto
    opts.onOpen(row, 'general');
  });
  bodyEl.addEventListener('contextmenu', (e) => {
    const row = rowFromEvent(e);
    if (!row) return;
    e.preventDefault();
    rowMenu(row, e.clientX, e.clientY);
  });
  bodyEl.addEventListener('keydown', (e) => {
    const row = rowFromEvent(e);
    if (!row || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.key === 'Enter') { e.preventDefault(); opts.onOpen(row, 'general'); }
    if (e.key === ' ') { e.preventDefault(); toggleSel(row); }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = e.target.getBoundingClientRect();
      rowMenu(row, r.left + 60, r.top + 20);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const tr = e.target.closest('tr');
      (e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling)?.focus();
    }
  });

  stateEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="retry"]')) opts.onRetry?.();
    if (e.target.closest('[data-act="clear-all"]')) opts.onClearAll?.();
  });

  root.querySelector('.dt-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'density') setPrefs({ density: getState().prefs.density === 'compact' ? 'comfortable' : 'compact' });
    if (act === 'columns') columnsMenu(b);
    if (act === 'export') exportMenu(b);
    if (act === 'sel-export') exportMenu(b, true);
    if (act === 'sel-delete') opts.onDeleteMany?.([...getState().selection.keys()]);
    if (act === 'sel-clear') setState({ selection: new Map() });
  });

  $('[data-pagesize]').addEventListener('change', (e) => {
    const n = Number(e.target.value);
    setQuery({ pageSize: n });
    setPrefs({ pageSize: n });
  });
  $('[data-pager]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    setQuery({ page: Number(b.dataset.page) }, { resetPage: false });
  });

  scrollEl.addEventListener('scroll', () => {
    root.classList.toggle('sx', scrollEl.scrollLeft > 0);
    root.classList.toggle('sy', scrollEl.scrollTop > 0);
  }, { passive: true });
  new ResizeObserver(measureHead).observe(headEl);

  /* ------------------------------ Reactividad ------------------------------ */

  /** Actualiza solo el estado visual de selección (sin redibujar filas). */
  function syncSelection() {
    const sel = getState().selection;
    const rows = getState().table.rows;
    bodyEl.querySelectorAll('tr[data-idx]').forEach((tr) => {
      const r = rows[Number(tr.dataset.idx)];
      if (!r) return;
      const on = sel.has(r.id);
      tr.classList.toggle('selected', on);
      tr.setAttribute('aria-selected', String(on));
      const cb = tr.querySelector('[data-sel]');
      if (cb && cb.checked !== on) cb.checked = on;
    });
    updateSelectAll();
  }

  renderHead(); renderBody(); renderToolbar(); renderFooter();
  const unsub = subscribe((s, p) => {
    const headChanged = s.prefs.hiddenColumns !== p.prefs.hiddenColumns || s.distinct !== p.distinct
      || (s.prefs.columnWidths !== p.prefs.columnWidths && !skipWidthRender);
    if (headChanged) { renderHead(); renderBody(); }
    if (s.query.sort !== p.query.sort) updateSortIndicators();
    if (s.query.columnFilters !== p.query.columnFilters) syncColFilters();
    if (!headChanged && s.table !== p.table) renderBody();
    else if (!headChanged && s.selection !== p.selection) syncSelection();
    if (s.table !== p.table || s.selection !== p.selection) renderToolbar();
    if (s.table !== p.table || s.query.page !== p.query.page || s.query.pageSize !== p.query.pageSize) renderFooter();
  });
  return { destroy: unsub };
}
