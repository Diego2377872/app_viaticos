/** Utilidades de DOM y seguridad. Todo dato proveniente de la base se escapa antes de insertarse. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function debounce(fn, ms = 300) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/** Crea un elemento a partir de HTML (la plantilla debe escapar los datos variables). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Permite solo URLs http(s)/blob para imágenes y enlaces (evita javascript:, data:, etc.). */
export function safeUrl(u) {
  try {
    const url = new URL(u, location.href);
    return ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}

export function isTypingTarget(node) {
  if (!node) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || node.isContentEditable;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
