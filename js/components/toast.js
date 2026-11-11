/** Notificaciones no bloqueantes. */
const ICONS = {
  success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation',
};

export function toast(message, type = 'info', { timeout = 4500 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.info}" aria-hidden="true"></i><span></span>
    <button type="button" class="toast-close" aria-label="Cerrar notificación"><i class="fa-solid fa-xmark"></i></button>`;
  t.querySelector('span').textContent = message;
  const close = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); };
  t.querySelector('.toast-close').addEventListener('click', close);
  root.appendChild(t);
  while (root.children.length > 4) root.firstElementChild.remove();
  requestAnimationFrame(() => t.classList.add('show'));
  if (timeout) setTimeout(close, type === 'error' ? timeout + 2500 : timeout);
}
