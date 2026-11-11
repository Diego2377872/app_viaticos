/**
 * Formulario de alta/edición en panel lateral.
 * Corrige el defecto de la versión anterior: al editar, las evidencias existentes se CONSERVAN
 * (antes se sobrescribían con un arreglo vacío si no se subían fotos nuevas).
 */
import { openDrawer } from './drawer.js';
import { confirmDialog } from './modal.js';
import { toast } from './toast.js';
import { getState } from '../core/store.js';
import * as actions from '../core/actions.js';
import { CONFIG } from '../config.js';
import { escapeHtml as esc, el, safeUrl } from '../utils/dom.js';
import { todayISO, fmtNumber } from '../utils/format.js';
import { validateRecord } from '../utils/validation.js';

const F = (name, label, { type = 'text', value = '', required = false, full = false, attrs = '', list = '' } = {}) => `
  <div class="ffield ${full ? 'full' : ''}">
    <label for="f-${name}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    <input id="f-${name}" name="${name}" type="${type}" value="${esc(value ?? '')}" ${required ? 'required aria-required="true"' : ''} ${list ? `list="${list}"` : ''} ${attrs}>
    <small class="ferr" data-err="${name}" role="alert"></small>
  </div>`;

export function openRecordForm({ record = null } = {}) {
  const isEdit = !!record;
  const r = record || {};
  const { permisos = [], lugares = [] } = getState().distinct || {};
  const existing = Array.isArray(r.imagenes) ? [...r.imagenes] : [];
  const newFiles = [];
  let dirty = false;
  let saving = false;

  const form = el(`<form class="rform" novalidate autocomplete="off">
    <section class="fsec"><h4><span class="step-num">01</span> Período del viaje</h4><div class="fgrid">
      ${F('fecha_desde', 'Fecha desde', { type: 'date', value: r.fecha_desde || todayISO(), required: true })}
      ${F('fecha_hasta', 'Fecha hasta', { type: 'date', value: r.fecha_hasta || r.fecha_desde || todayISO(), required: true })}
    </div></section>

    <section class="fsec"><h4><span class="step-num">02</span> Actividad</h4><div class="fgrid">
      <div class="ffield full">
        <label for="f-actividad">Descripción de la actividad <span class="req" aria-hidden="true">*</span></label>
        <textarea id="f-actividad" name="actividad" rows="3" maxlength="2000" required aria-required="true" placeholder="Describa detalladamente las tareas realizadas…">${esc(r.actividad || '')}</textarea>
        <small class="ferr" data-err="actividad" role="alert"></small>
      </div>
      ${F('lugar', 'Lugar / Institución', { value: r.lugar, required: true, full: true, list: 'dl-form-lugares', attrs: 'maxlength="200" placeholder="Ej. Oficina DEAG"' })}
    </div></section>

    <section class="fsec"><h4><span class="step-num">03</span> Expediente</h4><div class="fgrid">
      ${F('numero_cuaderno', 'N° Cuaderno', { value: r.numero_cuaderno, attrs: 'maxlength="60" placeholder="Ej. CU-2026-01"' })}
      ${F('numero_expediente', 'N° Expediente', { value: r.numero_expediente, attrs: 'maxlength="60" placeholder="Ej. EXP-2026-001"' })}
      ${F('permiso', 'Estado del expediente', { value: r.permiso, full: true, list: 'dl-form-estados', attrs: 'maxlength="120" placeholder="Seleccione o escriba el estado…"' })}
    </div></section>

    <section class="fsec"><h4><span class="step-num">04</span> Kilometraje</h4><div class="fgrid fgrid-3">
      ${F('km_inicial', 'Km inicial', { type: 'number', value: r.km_inicial ?? '', attrs: 'min="0" step="1" inputmode="numeric" placeholder="0"' })}
      ${F('km_final', 'Km final', { type: 'number', value: r.km_final ?? '', attrs: 'min="0" step="1" inputmode="numeric" placeholder="0"' })}
      <div class="ffield"><label for="f-km_total">Total recorrido</label>
        <output id="f-km_total" class="readonly mono" data-kmtotal>${fmtNumber(r.km_recorrido || 0)} km</output></div>
    </div></section>

    <section class="fsec"><h4><span class="step-num">05</span> Viático</h4><div class="fgrid">
      <div class="ffield"><label for="f-viatico">Viático cobrado</label>
        <select id="f-viatico" name="viatico"><option value="No" ${r.viatico !== 'Sí' ? 'selected' : ''}>No</option><option value="Sí" ${r.viatico === 'Sí' ? 'selected' : ''}>Sí</option></select></div>
      ${F('monto', 'Monto (Gs)', { type: 'number', value: r.monto ?? '', attrs: 'min="0" step="1" inputmode="numeric" placeholder="0"' })}
    </div></section>

    <section class="fsec"><h4><span class="step-num">06</span> Observaciones</h4>
      <div class="ffield full"><textarea id="f-observaciones" name="observaciones" rows="2" maxlength="2000" placeholder="Notas internas…" aria-label="Observaciones">${esc(r.observaciones || '')}</textarea></div>
    </section>

    <section class="fsec"><h4><span class="step-num">07</span> Evidencias fotográficas</h4>
      <label class="dropzone" data-drop>
        <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
        <strong>Arrastre imágenes aquí o haga clic para seleccionar</strong>
        <small>Máximo ${CONFIG.MAX_IMAGES} imágenes por registro · ${CONFIG.MAX_IMAGE_MB} MB cada una</small>
        <input type="file" accept="image/*" multiple data-file>
      </label>
      <small class="ferr" data-err="imagenes" role="alert"></small>
      <div class="previews" data-previews></div>
      ${isEdit ? '<p class="hint"><i class="fa-solid fa-circle-info"></i> Quitar una imagen la desvincula del registro; el archivo no se borra del almacenamiento.</p>' : ''}
    </section>

    <datalist id="dl-form-lugares">${lugares.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
    <datalist id="dl-form-estados">${permisos.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
  </form>`);

  const footer = el(`<div class="drawer-actions">
    <span class="hint"><span class="req">*</span> obligatorio</span>
    <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
    <button type="button" class="btn btn-primary" data-save><i class="fa-solid fa-floppy-disk"></i><span>${isEdit ? 'Guardar cambios' : 'Guardar registro'}</span></button>
  </div>`);

  const drawer = openDrawer({
    title: isEdit ? 'Editar registro' : 'Nuevo registro',
    subtitle: isEdit ? `ID ${r.id}` : 'Complete los datos del viaje',
    body: form,
    footer,
    width: 640,
    beforeClose: async () => {
      if (saving) return false;
      if (!dirty) return true;
      return confirmDialog({ title: 'Descartar cambios', message: 'Hay cambios sin guardar. ¿Desea cerrar el formulario y descartarlos?', confirmLabel: 'Descartar', danger: true });
    },
    onClose: () => newFiles.forEach((f) => URL.revokeObjectURL(f.url)),
  });

  const prevEl = form.querySelector('[data-previews]');
  const drop = form.querySelector('[data-drop]');
  const fileInput = form.querySelector('[data-file]');
  const val = (n) => (form.elements[n]?.value ?? '').trim();
  const int = (n) => { const x = parseInt(val(n), 10); return Number.isFinite(x) ? x : 0; };

  function updateKm() {
    const ini = int('km_inicial');
    const fin = int('km_final');
    form.querySelector('[data-kmtotal]').textContent = `${fmtNumber(fin >= ini ? fin - ini : 0)} km`;
  }

  function renderPreviews() {
    prevEl.innerHTML = existing.map((u, i) => `
      <div class="preview"><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener"><img src="${esc(safeUrl(u))}" alt="Evidencia ${i + 1}" loading="lazy"></a>
        <button type="button" data-rm-existing="${i}" aria-label="Quitar imagen ${i + 1}"><i class="fa-solid fa-xmark"></i></button></div>`).join('')
      + newFiles.map((f, i) => `
      <div class="preview"><img src="${f.url}" alt="${esc(f.file.name)}"><span class="tagnew">NUEVA</span>
        <button type="button" data-rm-new="${i}" aria-label="Quitar ${esc(f.file.name)}"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
    drop.classList.toggle('disabled', existing.length + newFiles.length >= CONFIG.MAX_IMAGES);
  }

  function addFiles(list) {
    const errEl = form.querySelector('[data-err="imagenes"]');
    errEl.textContent = '';
    for (const file of list) {
      if (existing.length + newFiles.length >= CONFIG.MAX_IMAGES) { errEl.textContent = `Máximo ${CONFIG.MAX_IMAGES} imágenes por registro`; break; }
      if (!file.type.startsWith('image/')) { errEl.textContent = `“${file.name}” no es una imagen`; continue; }
      if (file.size > CONFIG.MAX_IMAGE_MB * 1024 * 1024) { errEl.textContent = `“${file.name}” supera ${CONFIG.MAX_IMAGE_MB} MB`; continue; }
      newFiles.push({ file, url: URL.createObjectURL(file) });
      dirty = true;
    }
    renderPreviews();
  }

  function showErrors(errors) {
    form.querySelectorAll('.ffield.has-error').forEach((f) => f.classList.remove('has-error'));
    form.querySelectorAll('[data-err]').forEach((e) => { e.textContent = ''; });
    Object.entries(errors).forEach(([k, msg]) => {
      const e = form.querySelector(`[data-err="${k}"]`);
      if (e) { e.textContent = msg; e.closest('.ffield')?.classList.add('has-error'); }
    });
    const first = form.querySelector('.has-error input, .has-error textarea, .has-error select');
    first?.focus();
  }

  form.addEventListener('input', (e) => {
    dirty = true;
    const f = e.target.closest('.ffield');
    if (f?.classList.contains('has-error')) { f.classList.remove('has-error'); f.querySelector('.ferr').textContent = ''; }
    if (e.target.name === 'km_inicial' || e.target.name === 'km_final') updateKm();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'fecha_desde') {
      const hasta = form.elements.fecha_hasta;
      hasta.min = e.target.value;
      if (hasta.value && hasta.value < e.target.value) hasta.value = e.target.value;
    }
  });
  form.elements.fecha_hasta.min = form.elements.fecha_desde.value;
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => addFiles([...(e.dataTransfer?.files || [])]));
  prevEl.addEventListener('click', (e) => {
    const ex = e.target.closest('[data-rm-existing]');
    const nw = e.target.closest('[data-rm-new]');
    if (ex) { existing.splice(Number(ex.dataset.rmExisting), 1); dirty = true; renderPreviews(); }
    if (nw) { const [f] = newFiles.splice(Number(nw.dataset.rmNew), 1); URL.revokeObjectURL(f.url); renderPreviews(); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });
  footer.querySelector('[data-cancel]').addEventListener('click', () => drawer.close());
  footer.querySelector('[data-save]').addEventListener('click', () => submit());

  async function submit() {
    if (saving) return;
    const ini = int('km_inicial');
    const fin = int('km_final');
    const montoRaw = parseFloat(val('monto')) || 0;
    const payload = {
      fecha_desde: val('fecha_desde'), fecha_hasta: val('fecha_hasta'),
      actividad: val('actividad'), lugar: val('lugar'), permiso: val('permiso'),
      numero_cuaderno: val('numero_cuaderno'), numero_expediente: val('numero_expediente'),
      km_inicial: ini, km_final: fin, km_recorrido: fin >= ini ? fin - ini : 0,
      viatico: val('viatico') || 'No', monto: Math.max(0, Math.round(montoRaw)),
      observaciones: val('observaciones'),
    };
    const errors = validateRecord(payload, { existingImages: existing.length, newFiles: newFiles.map((f) => f.file), montoRaw });
    if (Object.keys(errors).length) { showErrors(errors); toast('Revise los campos marcados', 'warning'); return; }

    const btn = footer.querySelector('[data-save]');
    saving = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Guardando…</span>';
    try {
      let urls = [];
      if (newFiles.length) {
        if (!navigator.onLine) throw new Error('Sin conexión: no es posible subir imágenes en este momento.');
        const res = await actions.uploadImages(newFiles.map((f) => f.file));
        urls = res.urls;
        if (res.failed.length) toast(`No se pudieron subir: ${res.failed.join(', ')}`, 'warning');
      }
      payload.imagenes = [...existing, ...urls];
      const result = await actions.saveRecord(isEdit ? r.id : null, payload);
      if (result?.queued) toast('Sin conexión: el registro se guardó en este dispositivo y se sincronizará al reconectar', 'warning', { timeout: 7000 });
      else toast(isEdit ? 'Registro actualizado' : 'Registro creado', 'success');
      dirty = false;
      saving = false;
      drawer.close(true);
    } catch (err) {
      saving = false;
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>${isEdit ? 'Guardar cambios' : 'Guardar registro'}</span>`;
      toast(err.message, 'error');
    }
  }

  renderPreviews();
  updateKm();
}
