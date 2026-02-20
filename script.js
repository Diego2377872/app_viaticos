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
  if (!val || isNaN(val)) return '-';
  return new Intl.NumberFormat('es-PY').format(val);
};

// ================= DOM =================

const formulario = document.getElementById("formulario");
const tbody = document.getElementById("tbodyActividades");
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

let editandoId = null;
let registrosCache = [];

// ================= LOADER =================

function showLoader() { loader.classList.add("active"); }
function hideLoader() { loader.classList.remove("active"); }

// ================= KM =================

function calcularKmRecorrido() {
  const ini = parseFloat(kmInicialInput.value) || 0;
  const fin = parseFloat(kmFinalInput.value) || 0;
  kmRecorridoInput.value = (fin >= ini) ? (fin - ini) : "";
}

kmInicialInput.addEventListener("input", calcularKmRecorrido);
kmFinalInput.addEventListener("input", calcularKmRecorrido);

// ================= SUBMIT =================

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoader();

  try {
    const datos = {
      fecha_desde: buildAndAdjustDateFromString(startDateInput.value),
      fecha_hasta: buildAndAdjustDateFromString(endDateInput.value),
      actividad: actividadInput.value.trim(),
      lugar: lugarInput.value.trim(),
      permiso: permisoInput.value.trim(),

      // 🔥 AHORA USAMOS LA COLUMNA CORRECTA
      viatico_cobrado: viaticoCobradoSelect.value || "No",

      numero_cuaderno: numeroCuadernoInput.value.trim() || null,
      km_inicial: kmInicialInput.value !== "" ? parseFloat(kmInicialInput.value) : null,
      km_final: kmFinalInput.value !== "" ? parseFloat(kmFinalInput.value) : null,
      km_recorrido: kmRecorridoInput.value !== "" ? parseFloat(kmRecorridoInput.value) : null,
      monto: montoInput.value !== "" ? parseFloat(montoInput.value) : null,
      observaciones: observacionInput.value.trim() || null,
      imagenes: []
    };

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
    formulario.reset();
    cargarTabla();

  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    hideLoader();
  }
});

// ================= CARGAR =================

async function cargarTabla() {
  showLoader();

  const { data, error } = await supabaseClient
    .from('actividades1')
    .select('*')
    .order('fecha_desde', { ascending: false });

  hideLoader();

  if (error) return console.error(error);

  registrosCache = data;
  renderizarTabla();
}

// ================= RENDER =================

function renderizarTabla() {
  tbody.innerHTML = "";

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
      <td>${row.viatico_cobrado || 'No'}</td>
      <td>${formatMoney(row.monto)}</td>
    `;

    tbody.appendChild(tr);
  });
}

cargarTabla();