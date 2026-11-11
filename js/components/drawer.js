/** Panel lateral deslizante (formularios, detalles). Un solo panel activo a la vez. */
import { escapeHtml as esc } from '../utils/dom.js';

let current = null;

export function openDrawer({ title, subtitle = '', body, footer, width = 600, beforeClose, onClose }) {
  if (current) current.close(true);
  const root = document.getElementById('drawer-root');
  const layer = document.createElement('div');
  layer.className = 'drawer-layer';
  layer.innerHTML = `
    <div class="drawer-backdrop"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="--drawer-w:${width}px">
      <header class="drawer-header">
        <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button type="button" class="icon-btn ghost" data-close aria-label="Cerrar panel"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="drawer-body"></div>
      <footer class="drawer-footer"></footer>
    </aside>`;
  const bodyEl = layer.querySelector('.drawer-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const footEl = layer.querySelector('.drawer-footer');
  if (footer) footEl.appendChild(footer); else footEl.remove();

  let closed = false;
  const prevFocus = document.activeElement;
  const api = {
    el: layer,
    body: bodyEl,
    async close(force = false) {
      if (closed) return;
      if (!force && beforeClose && !(await beforeClose())) return;
      closed = true;
      layer.classList.remove('open');
      setTimeout(() => layer.remove(), 260);
      if (current === api) current = null;
      document.body.classList.toggle('no-scroll', !!document.querySelector('.modal-backdrop'));
      onClose?.();
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus?.();
    },
  };
  layer.querySelector('.drawer-backdrop').addEventListener('click', () => api.close());
  layer.querySelector('[data-close]').addEventListener('click', () => api.close());
  root.appendChild(layer);
  current = api;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => layer.classList.add('open'));
  setTimeout(() => layer.querySelector('input:not([type=hidden]):not([readonly]), textarea, select')?.focus(), 280);
  return api;
}

export const isDrawerOpen = () => !!current;
export function closeDrawer(force = false) { if (current) current.close(force); }
