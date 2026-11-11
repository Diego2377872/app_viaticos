/**
 * Menú contextual / desplegable posicionado.
 * Ítems: { label, icon, onClick, danger, disabled, hint, keepOpen } | { divider:true } | { header:'texto' }
 * keepOpen: no cierra el menú al hacer clic (p. ej., casillas de columnas visibles).
 */
import { escapeHtml as esc } from '../utils/dom.js';

let menu = null;

const iconClass = (icon) => (/^fa-(solid|regular|brands)\b/.test(icon || '') ? icon : `fa-solid ${icon || 'fa-circle'}`);

function onDocDown(e) { if (menu && !menu.contains(e.target)) closeContextMenu(); }
function onScroll(e) { if (menu && !menu.contains(e.target)) closeContextMenu(); }
function onKey(e) {
  if (!menu) return;
  const items = [...menu.querySelectorAll('.ctx-item:not([disabled])')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  if (e.key === 'Tab') closeContextMenu();
}

export function openContextMenu(x, y, items) {
  closeContextMenu();
  const m = document.createElement('div');
  m.className = 'ctx-menu';
  m.setAttribute('role', 'menu');
  for (const it of items) {
    if (it.divider) { m.insertAdjacentHTML('beforeend', '<div class="ctx-divider" role="separator"></div>'); continue; }
    if (it.header) { m.insertAdjacentHTML('beforeend', `<div class="ctx-header">${esc(it.header)}</div>`); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ctx-item${it.danger ? ' danger' : ''}`;
    b.setAttribute('role', it.keepOpen ? 'menuitemcheckbox' : 'menuitem');
    b.disabled = !!it.disabled;
    b.innerHTML = `<i class="${iconClass(it.icon)} fa-fw" aria-hidden="true"></i><span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!it.keepOpen) closeContextMenu();
      it.onClick?.(b);
    });
    m.appendChild(b);
  }
  document.getElementById('menu-root').appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
  m.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
  menu = m;
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closeContextMenu);
  }, 0);
  m.querySelector('.ctx-item:not([disabled])')?.focus({ preventScroll: true });
  return m;
}

export function openMenuAt(anchor, items, { align = 'left' } = {}) {
  const r = anchor.getBoundingClientRect();
  const m = openContextMenu(r.left, r.bottom + 6, items);
  if (align === 'right') {
    const w = m.getBoundingClientRect().width;
    m.style.left = `${Math.max(8, r.right - w)}px`;
  }
  return m;
}

export function closeContextMenu() {
  if (!menu) return false;
  menu.remove();
  menu = null;
  document.removeEventListener('mousedown', onDocDown, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', closeContextMenu);
  return true;
}
