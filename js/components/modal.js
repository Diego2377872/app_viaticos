/** Ventanas modales apilables + diálogos de confirmación y de texto. */
import { escapeHtml as esc } from '../utils/dom.js';

const stack = [];

function syncScrollLock() {
  document.body.classList.toggle('no-scroll', stack.length > 0 || !!document.querySelector('.drawer-layer.open'));
}

export function openModal({ title, body, size = 'md', footer = [], onClose, className = '' }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button type="button" class="icon-btn ghost" data-close aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="modal-body"></div>
      <footer class="modal-footer"></footer>
    </div>`;
  const bodyEl = wrap.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);

  const prevFocus = document.activeElement;
  let closed = false;
  const api = {
    el: wrap,
    body: bodyEl,
    close(result) {
      if (closed) return;
      closed = true;
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 180);
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      syncScrollLock();
      onClose?.(result);
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus?.();
    },
  };

  const footEl = wrap.querySelector('.modal-footer');
  if (!footer.length) footEl.remove();
  footer.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${b.variant || 'btn-ghost'}`;
    btn.innerHTML = `${b.icon ? `<i class="fa-solid ${b.icon}"></i>` : ''}<span>${esc(b.label)}</span>`;
    if (b.align === 'left') btn.classList.add('mr-auto');
    btn.addEventListener('click', () => b.onClick?.(api));
    footEl.appendChild(btn);
  });

  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) api.close(); });
  wrap.querySelector('[data-close]').addEventListener('click', () => api.close());
  root.appendChild(wrap);
  stack.push(api);
  syncScrollLock();
  requestAnimationFrame(() => wrap.classList.add('open'));
  setTimeout(() => {
    const f = wrap.querySelector('[autofocus]') || wrap.querySelector('.modal-footer .btn-primary, .modal-footer .btn-danger') || wrap.querySelector('[data-close]');
    f?.focus();
  }, 40);
  return api;
}

export function closeTopModal() {
  const m = stack[stack.length - 1];
  if (!m) return false;
  m.close();
  return true;
}

export function confirmDialog({ title = 'Confirmar', message = '', confirmLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    openModal({
      title, size: 'sm',
      body: `<div class="confirm"><i class="fa-solid ${danger ? 'fa-triangle-exclamation ic-danger' : 'fa-circle-question ic-primary'}"></i><p>${esc(message)}</p></div>`,
      footer: [
        { label: 'Cancelar', variant: 'btn-ghost', onClick: (m) => { done = true; m.close(); resolve(false); } },
        { label: confirmLabel, variant: danger ? 'btn-danger' : 'btn-primary', icon: danger ? 'fa-trash' : 'fa-check', onClick: (m) => { done = true; m.close(); resolve(true); } },
      ],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

export function promptDialog({ title, label, value = '', placeholder = '', confirmLabel = 'Guardar' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const body = document.createElement('div');
    body.className = 'ffield';
    body.innerHTML = `<label for="prompt-input">${esc(label)}</label>
      <input id="prompt-input" type="text" maxlength="60" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus>`;
    const submit = (m) => {
      const v = body.querySelector('input').value.trim();
      if (!v) { body.querySelector('input').focus(); return; }
      done = true; m.close(); resolve(v);
    };
    const modal = openModal({
      title, size: 'sm', body,
      footer: [
        { label: 'Cancelar', variant: 'btn-ghost', onClick: (m) => { done = true; m.close(); resolve(null); } },
        { label: confirmLabel, variant: 'btn-primary', icon: 'fa-floppy-disk', onClick: submit },
      ],
      onClose: () => { if (!done) resolve(null); },
    });
    body.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(modal); } });
  });
}
