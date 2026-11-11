/** Pestañas accesibles (role=tablist, navegación con flechas). */
import { escapeHtml as esc } from '../utils/dom.js';

export function createTabs(container, tabs, { active, onChange, variant = 'pill' } = {}) {
  container.classList.add('tabs', `tabs-${variant}`);
  container.setAttribute('role', 'tablist');
  container.innerHTML = tabs.map((t) => `
    <button type="button" class="tab" role="tab" data-id="${esc(t.id)}" aria-selected="false" tabindex="-1">
      ${t.icon ? `<i class="fa-solid ${t.icon}" aria-hidden="true"></i>` : ''}
      <span>${esc(t.label)}</span>
      <span class="tab-badge" data-badge="${esc(t.id)}" ${t.badge == null ? 'hidden' : ''}>${esc(t.badge ?? '')}</span>
    </button>`).join('');

  const buttons = () => [...container.querySelectorAll('.tab')];
  const set = (id, emit = false) => {
    buttons().forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (emit) onChange?.(id);
  };
  container.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b && !b.classList.contains('active')) set(b.dataset.id, true);
  });
  container.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const bs = buttons();
    const i = bs.findIndex((b) => b.classList.contains('active'));
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length;
    bs[n].focus();
    set(bs[n].dataset.id, true);
  });
  set(active);
  return {
    setActive: (id) => set(id, false),
    setBadge: (id, val) => {
      const b = container.querySelector(`[data-badge="${CSS.escape(id)}"]`);
      if (!b) return;
      b.hidden = val == null;
      b.textContent = val ?? '';
    },
  };
}
