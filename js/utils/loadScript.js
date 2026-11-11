/** Carga diferida (lazy) de librerías pesadas: Chart.js y SheetJS solo se descargan cuando se usan. */
const cache = new Map();

export function loadScript(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { cache.delete(src); s.remove(); reject(new Error(`No se pudo cargar el recurso: ${src}`)); };
    document.head.appendChild(s);
  });
  cache.set(src, p);
  return p;
}
