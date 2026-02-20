// ================= SUPABASE =================

const SUPABASE_URL = 'https://jmyioejtexnzvdrimepp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteWlvZWp0ZXhuenZkcmltZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDI2NTUsImV4cCI6MjA4NjMxODY1NX0.ylaKDxa2bBqASroFO5JefLDVIDKhfX-hkBOAc1zYWBU';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================= UTILIDADES =================

function buildAndAdjustDateFromString(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const date = new Date(year, month - 1, day);
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));

  return adjustedDate.toISOString().split('T')[0];
}

const formatMoney = (val) => {
  if (val === null || val === undefined || val === "" || isNaN(val)) return '-';
  return new Intl.NumberFormat('es-PY').format(val);
};

// ================= ELEMENTOS DOM =================

const formulario = document.getElementById("formulario");
const tbody = document.getElementById("tbodyActividades");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const mensajeVacio = document.getElementById("mensajeVacio");
const loader = document.getElementById("loaderOverlay");

const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const actividadInput = document.getElementById("actividad");
const lugarInput = document.getElementById("lugar");
const permisoInput = document.getElementById("permiso");
const numeroCuadernoInput = document.getElementById("numeroCuaderno");
const kmInicialInput = document.getElementById("kmInicial");
const kmFinalInput = document.getElementById("kmFinal");
const kmRecorridoInput = document.getElementById("kmRecorrido");
const viaticoCobradoSelect = document.getElementById("viaticoCobrado");
const montoInput = document.getElementById("monto");
const observacionInput = document.getElementById("observacion");
const imagenInput = document.getElementById("imagen");

const filtroAnio = document.getElementById("filtroAnio");
const filtroMes = document.getElementById("filtroMes");
const btnExportar = document.getElementById("btnExportar");

let editandoId = null;
let registrosCache = [];

// ================= LOADER =================

function showLoader() { loader.classList.add("active"); }
function hideLoader() { loader.classList.remove("active"); }

// ================= INICIO =================

document.addEventListener("DOMContentLoaded", () => {
  flatpickr("#startDateInput", { dateFormat: "d/m/Y", locale: "es", defaultDate: new Date() });
  flatpickr("#endDateInput", { dateFormat: "d/m/Y", locale: "es", defaultDate: new Date() });
  poblarAnios();
  cargarTabla();
});

function poblarAnios() {
  const anioActual = new Date().getFullYear();
  for (let i = anioActual; i >= 2020; i--) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    filtroAnio.appendChild(opt);
  }
  filtroAnio.value = anioActual;
}

// ================= KM =================

function calcularKmRecorrido() {
  const ini = parseFloat(kmInicialInput.value) || 0;
  const fin = parseFloat(kmFinalInput.value) || 0;
  kmRecorridoInput.value = (fin >= ini) ? (fin - ini) : "";
}

kmInicialInput.addEventListener("input", calcularKmRecorrido);
kmFinalInput.addEventListener("input", calcularKmRecorrido);

// ================= SUBIR IMAGEN =================

async function subirImagen(file) {
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) return null;

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabaseClient.storage
    .from('actividades-images')
    .upload(fileName, file);

  if (error) return null;

  const { data: urlData } = supabaseClient.storage
    .from('actividades-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ================= SUBMIT =================

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoader();

  try {
    let imageUrls = [];
    const files = Array.from(imagenInput.files).slice(0, 3);

    for (const file of files) {
      const url = await subirImagen(file);
      if (url) imageUrls.push(url);
    }

    const datos = {
      fecha_desde: buildAndAdjustDateFromString(startDateInput.value),
      fecha_hasta: buildAndAdjustDateFromString(endDateInput.value),
      actividad: actividadInput.value.trim(),
      lugar: lugarInput.value.trim(),
      permiso: permisoInput.value.trim(),

      // 🔥 COLUMNA NOT NULL
      viatico: viaticoCobradoSelect.value && viaticoCobradoSelect.value.trim() !== ""
        ? viaticoCobradoSelect.value
        : "No",

      numero_cuaderno: numeroCuadernoInput.value.trim() || null,
      km_inicial: kmInicialInput.value !== "" ? parseFloat(kmInicialInput.value) : null,
      km_final: kmFinalInput.value !== "" ? parseFloat(kmFinalInput.value) : null,
      km_recorrido: kmRecorridoInput.value !== "" ? parseFloat(kmRecorridoInput.value) : null,
      monto: montoInput.value !== "" ? parseFloat(montoInput.value) : null,
      observaciones: observacionInput.value.trim() || null,
      imagenes: imageUrls.length > 0 ? imageUrls : []
    };

    if (!datos.viatico) {
      datos.viatico = "No";
    }

    let result;

    if (editandoId) {
      result = await supabaseClient
        .from('actividades1')
        .update(datos)
        .eq('id', editandoId);
    } else {
      result = await supabaseClient
        .from('actividades1')
        .insert([datos]);
    }

    if (result.error) throw result.error;

    alert("Operación exitosa");
    resetFormulario();
    cargarTabla();

  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    hideLoader();
  }
});

// ================= RESET =================

function resetFormulario() {
  formulario.reset();
  editandoId = null;
  btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Registro';
  btnCancelar.style.display = "none";
  kmRecorridoInput.value = "";
}

// ================= CARGAR TABLA =================

async function cargarTabla() {
  showLoader();
  try {
    const { data, error } = await supabaseClient
      .from('actividades1')
      .select('*')
      .order('fecha_desde', { ascending: false });

    if (error) throw error;

    registrosCache = data;
    renderizarTabla();

  } catch (error) {
    console.error(error);
  } finally {
    hideLoader();
  }
}

// ================= RENDER =================

function renderizarTabla() {
  tbody.innerHTML = "";

  if (registrosCache.length === 0) {
    mensajeVacio.style.display = "block";
    return;
  }

  mensajeVacio.style.display = "none";

  registrosCache.forEach(row => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.fecha_desde || '-'}</td>
      <td>${row.actividad || '-'}</td>
      <td>${row.lugar || '-'}</td>
      <td>${row.numero_cuaderno || '-'}</td>
      <td>${row.permiso || '-'}</td>
      <td>${row.km_inicial ?? '-'}</td>
      <td>${row.km_final ?? '-'}</td>
      <td>${row.km_recorrido ?? '-'}</td>
      <td>${row.observaciones || '-'}</td>
      <td>${row.viatico || 'No'}</td>
      <td>${formatMoney(row.monto)}</td>
      <td>
        <button onclick="editarActividad('${row.id}')">Editar</button>
        <button onclick="borrarActividad('${row.id}')">Eliminar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= EDITAR =================

async function editarActividad(id) {
  const { data, error } = await supabaseClient
    .from('actividades1')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return alert("Error al cargar");

  startDateInput.value = data.fecha_desde || '';
  endDateInput.value = data.fecha_hasta || '';
  actividadInput.value = data.actividad || '';
  lugarInput.value = data.lugar || '';
  permisoInput.value = data.permiso || '';
  numeroCuadernoInput.value = data.numero_cuaderno || '';
  kmInicialInput.value = data.km_inicial ?? '';
  kmFinalInput.value = data.km_final ?? '';
  kmRecorridoInput.value = data.km_recorrido ?? '';
  viaticoCobradoSelect.value = data.viatico || 'No';
  montoInput.value = data.monto ?? '';
  observacionInput.value = data.observaciones || '';

  editandoId = id;
  btnGuardar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
  btnCancelar.style.display = "inline-flex";
}

// ================= BORRAR =================

async function borrarActividad(id) {
  if (!confirm("¿Eliminar registro?")) return;

  await supabaseClient
    .from('actividades1')
    .delete()
    .eq('id', id);

  cargarTabla();
}

btnCancelar.addEventListener("click", resetFormulario);