/** Gráficos dinámicos (Chart.js, carga diferida) sincronizados con los filtros activos. */
import { CONFIG } from '../config.js';
import { loadScript } from '../utils/loadScript.js';
import { colorFor, alpha } from '../utils/palette.js';
import { fmtNumber, fmtCompact, fmtMoney, monthLabel } from '../utils/format.js';
import { escapeHtml as esc } from '../utils/dom.js';

const card = (key, icon, title, cls = '') => `
  <div class="card chart-card ${cls}">
    <div class="card-head"><h3><i class="fa-solid ${icon}"></i> ${esc(title)}</h3><span class="card-sub" data-sub="${key}"></span></div>
    <div class="chart-box"><canvas data-chart="${key}" role="img" aria-label="${esc(title)}"></canvas><div class="chart-empty" data-empty="${key}" hidden>Sin datos para los filtros aplicados</div></div>
  </div>`;

function palette() {
  const st = getComputedStyle(document.documentElement);
  const v = (n) => st.getPropertyValue(n).trim();
  return { muted: v('--muted'), border: v('--border'), surface: v('--surface'), text: v('--text'),
    primary: v('--primary'), accent: v('--accent'), success: v('--success'), warning: v('--warning') };
}

export async function mountCharts(el) {
  el.innerHTML = `<div class="chart-grid">
    ${card('km', 'fa-chart-column', 'Kilómetros recorridos por mes', 'span-2')}
    ${card('viat', 'fa-sack-dollar', 'Viáticos por mes (Gs)')}
    ${card('estado', 'fa-chart-pie', 'Registros por estado del expediente')}
    ${card('lugares', 'fa-location-dot', 'Lugares más frecuentes', 'span-2')}
  </div>`;
  try {
    await loadScript(CONFIG.CHART_JS_URL);
  } catch (err) {
    el.innerHTML = `<div class="card state-box error"><i class="fa-solid fa-chart-simple"></i><h4>No se pudo cargar el módulo de gráficos</h4><p>${esc(err.message)}</p></div>`;
    return { update() {}, theme() {} };
  }
  const { Chart } = window;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 11.5;
  const c = palette();
  const ctx = (k) => el.querySelector(`[data-chart="${k}"]`);
  const tooltip = { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8, titleFont: { weight: '600' }, boxPadding: 4 };
  const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, interaction: { mode: 'index', intersect: false } };
  const axes = (stacked = false) => ({
    x: { stacked, grid: { display: false }, ticks: { color: c.muted }, border: { color: c.border } },
    y: { stacked, beginAtZero: true, grid: { color: c.border }, ticks: { color: c.muted, callback: (v) => fmtCompact(v) }, border: { display: false } },
  });

  const charts = {
    km: new Chart(ctx('km'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Km recorridos', data: [], backgroundColor: alpha(c.primary, 0.85), hoverBackgroundColor: c.primary, borderRadius: 6, maxBarThickness: 42 }] },
      options: { ...base, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (i) => ` ${fmtNumber(i.raw)} km` } } }, scales: axes() },
    }),
    viat: new Chart(ctx('viat'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Cobrado', data: [], backgroundColor: alpha(c.success, 0.85), borderRadius: 4, stack: 's' },
        { label: 'No cobrado', data: [], backgroundColor: alpha(c.warning, 0.75), borderRadius: 4, stack: 's' },
      ] },
      options: { ...base, plugins: { legend: { labels: { color: c.muted, usePointStyle: true, boxWidth: 8 } }, tooltip: { ...tooltip, callbacks: { label: (i) => ` ${i.dataset.label}: ${fmtMoney(i.raw)}` } } }, scales: axes(true) },
    }),
    estado: new Chart(ctx('estado'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: { ...base, interaction: { mode: 'nearest' }, cutout: '64%', plugins: { legend: { position: 'right', labels: { color: c.muted, usePointStyle: true, boxWidth: 8, padding: 12 } }, tooltip: { ...tooltip, callbacks: { label: (i) => ` ${i.label}: ${fmtNumber(i.raw)}` } } } },
    }),
    lugares: new Chart(ctx('lugares'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Registros', data: [], backgroundColor: alpha(c.accent, 0.85), borderRadius: 6, maxBarThickness: 22 }] },
      options: { ...base, indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (i) => ` ${fmtNumber(i.raw)} registros` } } },
        scales: { x: { beginAtZero: true, grid: { color: c.border }, ticks: { color: c.muted, precision: 0 }, border: { display: false } }, y: { grid: { display: false }, ticks: { color: c.muted } } } },
    }),
  };

  const setEmpty = (k, empty) => { el.querySelector(`[data-empty="${k}"]`).hidden = !empty; };
  const sub = (k, t) => { el.querySelector(`[data-sub="${k}"]`).textContent = t; };
  const trunc = (s, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return {
    update(s) {
      if (!s) return;
      const labels = s.months.map((m) => monthLabel(m.key, s.multiYear));
      charts.km.data.labels = labels;
      charts.km.data.datasets[0].data = s.months.map((m) => m.km);
      charts.viat.data.labels = labels;
      charts.viat.data.datasets[0].data = s.months.map((m) => m.cobrado);
      charts.viat.data.datasets[1].data = s.months.map((m) => m.pendiente);
      charts.estado.data.labels = s.byEstado.map(([k]) => k);
      charts.estado.data.datasets[0].data = s.byEstado.map(([, v]) => v);
      charts.estado.data.datasets[0].backgroundColor = s.byEstado.map(([k]) => colorFor(k));
      charts.lugares.data.labels = s.topLugares.map(([k]) => trunc(k));
      charts.lugares.data.datasets[0].data = s.topLugares.map(([, v]) => v);
      Object.values(charts).forEach((ch) => ch.update());
      sub('km', `${fmtNumber(s.totalKm)} km en total`);
      sub('viat', fmtMoney(s.cobrado + s.pendiente));
      sub('estado', `${fmtNumber(s.byEstado.length)} estados`);
      sub('lugares', `top ${s.topLugares.length}`);
      ['km', 'viat', 'estado', 'lugares'].forEach((k) => setEmpty(k, !s.count));
    },
    theme() {
      const p = palette();
      Object.values(charts).forEach((ch) => {
        Object.values(ch.options.scales || {}).forEach((ax) => {
          if (ax.ticks) ax.ticks.color = p.muted;
          if (ax.grid && ax.grid.display !== false) ax.grid.color = p.border;
          if (ax.border && ax.border.display !== false) ax.border.color = p.border;
        });
        if (ch.options.plugins?.legend?.labels) ch.options.plugins.legend.labels.color = p.muted;
      });
      charts.estado.data.datasets[0].borderColor = p.surface;
      Object.values(charts).forEach((ch) => ch.update('none'));
    },
  };
}
