/** Tarjetas KPI vinculadas a los filtros activos. */
import { escapeHtml as esc } from '../utils/dom.js';
import { fmtNumber, fmtMoney } from '../utils/format.js';

export function renderKpis(el, summary, { variant = 'full' } = {}) {
  const s = summary.data;
  const loading = summary.loading && !s;
  const v = (fn) => (s ? fn(s) : '—');
  const items = [
    { label: 'Registros', icon: 'fa-list-check', tone: 'primary', value: v((x) => fmtNumber(x.count)), sub: v((x) => `${fmtNumber(x.viajesCobrados)} con viático cobrado`) },
    { label: 'Km recorridos', icon: 'fa-road', tone: 'accent', value: v((x) => `${fmtNumber(x.totalKm)} km`), sub: v((x) => `Promedio ${fmtNumber(x.avgKm, 1)} km por viaje`) },
    { label: 'Viáticos cobrados', icon: 'fa-hand-holding-dollar', tone: 'success', value: v((x) => fmtMoney(x.cobrado)), sub: v((x) => `${fmtNumber(x.pctCobrado, 1)}% del monto registrado`) },
    { label: 'Monto no cobrado', icon: 'fa-hourglass-half', tone: 'warning', value: v((x) => fmtMoney(x.pendiente)), sub: 'Registros con viático = No' },
  ];
  if (variant === 'full') {
    items.push(
      { label: 'Viaje más largo', icon: 'fa-gauge-high', tone: 'secondary', value: v((x) => `${fmtNumber(x.maxKm)} km`), sub: v((x) => `Mediana ${fmtNumber(x.medianKm, 1)} km`) },
      { label: 'Monto promedio', icon: 'fa-coins', tone: 'primary', value: v((x) => fmtMoney(x.avgMonto)), sub: v((x) => `Total registrado ${fmtMoney(x.montoTotal)}`) },
    );
  }
  el.innerHTML = `
    <div class="kpi-grid kpi-${variant}${summary.loading && s ? ' is-refreshing' : ''}">
      ${items.map((i) => `
        <div class="kpi tone-${i.tone}">
          <div class="kpi-icon"><i class="fa-solid ${i.icon}" aria-hidden="true"></i></div>
          <div class="kpi-body">
            <span class="kpi-label">${esc(i.label)}</span>
            <span class="kpi-value">${loading ? '<span class="skeleton-bar w-60"></span>' : esc(i.value)}</span>
            <span class="kpi-sub">${loading ? '<span class="skeleton-bar w-80 sm"></span>' : esc(i.sub)}</span>
          </div>
        </div>`).join('')}
    </div>
    ${summary.error ? `<p class="inline-error"><i class="fa-solid fa-triangle-exclamation"></i> No se pudieron calcular los indicadores: ${esc(summary.error)}</p>` : ''}`;
}
