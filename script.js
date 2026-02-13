// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_URL = 'https://jmyioejtexnzvdrimepp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteWlvZWp0ZXhuenZkcmltZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDI2NTUsImV4cCI6MjA4NjMxODY1NX0.ylaKDxa2bBqASroFO5JefLDVIDKhfX-hkBOAc1zYWBU';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const viaticoSelect = document.getElementById("viatico");
const numeroCuadernoInput = document.getElementById("numeroCuaderno");
const kmInicialInput = document.getElementById("kmInicial");
const kmFinalInput = document.getElementById("kmFinal");
const kmRecorridoInput = document.getElementById("kmRecorrido");
const viaticoCobradoSelect = document.getElementById("viaticoCobrado");
const montoContainer = document.getElementById("montoContainer");
const montoInput = document.getElementById("monto");
const observacionInput = document.getElementById("observacion");
const imagenInput = document.getElementById("imagen");

const filtroAnio = document.getElementById("filtroAnio");
const filtroMes = document.getElementById("filtroMes");
const btnExportar = document.getElementById("btnExportar");

let editandoId = null;
let registrosCache = [];

function showLoader() { loader.classList.add("active"); }
function hideLoader() { loader.classList.remove("active"); }

document.addEventListener("DOMContentLoaded", () => {
  flatpickr("#startDateInput", { dateFormat: "d/m/Y", locale: "es", defaultDate: new Date() });
  flatpickr("#endDateInput", { dateFormat: "d/m/Y", locale: "es", defaultDate: new Date() });
  poblarAnios();
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

function calcularKmRecorrido() {
  const ini = parseInt(kmInicialInput.value) || 0;
  const fin = parseInt(kmFinalInput.value) || 0;
  kmRecorridoInput.value = (fin >= ini) ? (fin - ini) : "";
}

kmInicialInput.addEventListener("input", calcularKmRecorrido);
kmFinalInput.addEventListener("input", calcularKmRecorrido);

viaticoCobradoSelect.addEventListener("change", () => {
});

async function subirImagen(file) {
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from('actividades-images').upload(fileName, file);
  if (error) return null;
  const { data: urlData } = supabaseClient.storage.from('actividades-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

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
      viatico: viaticoSelect.value,
      numero_cuaderno: numeroCuadernoInput.value.trim() || null,
      km_inicial: parseInt(kmInicialInput.value) || null,
      km_final: parseInt(kmFinalInput.value) || null,
      km_recorrido: parseInt(kmRecorridoInput.value) || null,
      viatico_cobrado: viaticoCobradoSelect.value || "No",
      monto: montoInput.value !== "" ? parseFloat(montoInput.value) : null,
      observaciones: observacionInput.value.trim() || null,
      imagenes: imageUrls.length ? imageUrls : undefined 
    };

    let result = editandoId ? 
      await supabaseClient.from('actividades1').update(datos).eq('id', editandoId) : 
      await supabaseClient.from('actividades1').insert([datos]);

    if (result.error) throw result.error;
    alert("Operación exitosa");
    resetFormulario();
    cargarTabla();
  } catch (error) {
    alert("Error: " + error.message);
  } finally { hideLoader(); }
});

function resetFormulario() {
  formulario.reset();
  editandoId = null;
  btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
  btnCancelar.style.display = "none";
  kmRecorridoInput.value = "";
}

async function cargarTabla() {
  showLoader();
  try {
    const { data, error } = await supabaseClient.from('actividades1').select('*').order('fecha_desde', { ascending: false });
    if (error) throw error;
    registrosCache = data;
    renderizarTabla();
  } catch (error) { console.error(error); } finally { hideLoader(); }
}

function renderizarTabla() {
    const anio = filtroAnio.value;
    const mes = filtroMes.value;

    const filtrados = registrosCache.filter(row => {
        if (!row.fecha_desde) return true;
        const d = new Date(row.fecha_desde + 'T00:00:00');
        const matchAnio = anio ? d.getFullYear() == anio : true;
        const matchMes = mes ? (d.getMonth() + 1) == mes : true;
        return matchAnio && matchMes;
    });

    tbody.innerHTML = "";
    if (filtrados.length === 0) { 
        mensajeVacio.style.display = "block"; 
        return; 
    }
    mensajeVacio.style.display = "none";

    filtrados.forEach(row => {
      let imagenHtml = "<em>-</em>";
      const imgs = Array.isArray(row.imagenes) ? row.imagenes : (typeof row.imagenes === 'string' ? JSON.parse(row.imagenes) : []);
      if (imgs.length > 0) {
        imagenHtml = imgs.map(url => `<img src="${url}" class="img-thumb" onclick="window.open('${url}','_blank')">`).join("");
      }

      const fDesde = row.fecha_desde ? new Date(row.fecha_desde + 'T00:00:00').toLocaleDateString("es-ES") : '-';
      const fHasta = row.fecha_hasta ? new Date(row.fecha_hasta + 'T00:00:00').toLocaleDateString("es-ES") : '-';

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-size:0.85rem">
            <strong>D:</strong> ${fDesde}<br>
            <strong>H:</strong> ${fHasta}
        </td>
        <td style="text-align:left; max-width:250px"><strong>${row.actividad || '-'}</strong></td>
        <td>${row.lugar || '-'}</td>
        <td><span class="badge-info">${row.numero_cuaderno || '-'}</span></td>
        <td><small>${row.permiso || '-'}</small></td>
        <td>${row.km_inicial ?? '-'}</td>
        <td>${row.km_final ?? '-'}</td>
        <td>${row.km_recorrido ?? '-'}</td>
        <td><small>${row.observaciones || '-'}</small></td>
        <td>${row.viatico_cobrado || 'No'}</td>
        <td><strong>${formatMoney(row.monto)}</strong></td>
        <td><div style="display:flex; gap:5px; justify-content:center">${imagenHtml}</div></td>
        <td>
          <button class="btn-editar" title="Editar" onclick="editarActividad('${row.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-borrar" title="Eliminar" onclick="borrarActividad('${row.id}')"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

async function editarActividad(id) {
  showLoader();
  try {
    const { data, error } = await supabaseClient.from('actividades1').select('*').eq('id', id).single();
    if (error) throw error;
    
    if (data.fecha_desde) {
        const d = new Date(data.fecha_desde + 'T00:00:00');
        startDateInput.value = flatpickr.formatDate(d, "d/m/Y");
    }
    if (data.fecha_hasta) {
        const h = new Date(data.fecha_hasta + 'T00:00:00');
        endDateInput.value = flatpickr.formatDate(h, "d/m/Y");
    }

    actividadInput.value = data.actividad || '';
    lugarInput.value = data.lugar || '';
    permisoInput.value = data.permiso || '';
    viaticoSelect.value = data.viatico || '';
    numeroCuadernoInput.value = data.numero_cuaderno || '';
    kmInicialInput.value = data.km_inicial ?? '';
    kmFinalInput.value = data.km_final ?? '';
    kmRecorridoInput.value = data.km_recorrido ?? '';
    viaticoCobradoSelect.value = data.viatico_cobrado || 'No';
    montoInput.value = data.monto ?? ''; 
    observacionInput.value = data.observaciones || '';
    
    editandoId = id;
    btnGuardar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
    btnCancelar.style.display = "inline-flex";
    formulario.scrollIntoView({ behavior: "smooth" });
  } catch (error) { alert("Error al cargar"); } finally { hideLoader(); }
}

async function borrarActividad(id) {
  if (!confirm("¿Eliminar?")) return;
  showLoader();
  try {
    await supabaseClient.from('actividades1').delete().eq('id', id);
    cargarTabla();
  } catch (error) { alert("Error"); } finally { hideLoader(); }
}

btnExportar.addEventListener("click", () => {
    const table = document.getElementById("tablaActividades");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Actividades" });
    XLSX.writeFile(wb, "Agenda_Actividades.xlsx");
});

filtroAnio.addEventListener("change", renderizarTabla);
filtroMes.addEventListener("change", renderizarTabla);
btnCancelar.addEventListener("click", resetFormulario);
cargarTabla();