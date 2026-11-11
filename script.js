// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_URL = 'https://jmyioejtexnzvdrimepp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteWlvZWp0ZXhuenZkcmltZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDI2NTUsImV4cCI6MjA4NjMxODY1NX0.ylaKDxa2bBqASroFO5JefLDVIDKhfX-hkBOAc1zYWBU';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================= UTILIDADES =================

function buildAndAdjustDateFromString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return date.toISOString().split('T')[0];
}

const formatMoney = (val) => {
    if (!val || isNaN(val)) return '0';
    return new Intl.NumberFormat('es-PY').format(val);
};

const formatDatePY = (dateIso) => {
    if (!dateIso) return '-';
    const [year, month, day] = dateIso.split('-');
    return `${day}/${month}/${year}`;
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
const numeroExpedienteInput = document.getElementById("numeroExpediente"); // NUEVO
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

// ================= FUNCIONES CORE =================

function showLoader() { loader.classList.add("active"); }
function hideLoader() { loader.classList.remove("active"); }

// ================= NOTIFICACIONES (TOAST) =================

function mostrarToast(mensaje, tipo = "info") {
    const cont = document.getElementById("toastContainer");
    if (!cont) { alert(mensaje); return; }
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    const icono = { success: "fa-check-circle", error: "fa-times-circle", info: "fa-info-circle" }[tipo] || "fa-info-circle";
    toast.innerHTML = `<i class="fas ${icono}"></i><span>${mensaje}</span>`;
    cont.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ================= TEMA CLARO/OSCURO =================

function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
    const btn = document.getElementById("btnTema");
    if (btn) btn.innerHTML = tema === "dark" ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

document.addEventListener("DOMContentLoaded", () => {
    const temaGuardado = localStorage.getItem("tema") || "light";
    aplicarTema(temaGuardado);
    const btnTema = document.getElementById("btnTema");
    if (btnTema) {
        btnTema.addEventListener("click", () => {
            const actual = document.documentElement.getAttribute("data-theme");
            aplicarTema(actual === "dark" ? "light" : "dark");
        });
    }
});

// ================= ESTADO DE CONEXIÓN EN TIEMPO REAL =================

function actualizarEstadoConexion(estado) {
    const badge = document.getElementById("realtimeStatus");
    if (!badge) return;
    const estados = {
        SUBSCRIBED: { texto: "En vivo", clase: "status-online" },
        TIMED_OUT: { texto: "Reconectando…", clase: "status-warning" },
        CLOSED: { texto: "Desconectado", clase: "status-offline" },
        CHANNEL_ERROR: { texto: "Error de conexión", clase: "status-offline" }
    };
    const info = estados[estado] || { texto: "Conectando…", clase: "status-warning" };
    badge.className = `status-badge ${info.clase}`;
    badge.innerHTML = `<span class="status-dot"></span> ${info.texto}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const fpStart = flatpickr("#startDateInput", { 
        dateFormat: "d/m/Y", 
        locale: "es", 
        defaultDate: "today",
        onChange: function(selectedDates) {
            if (selectedDates[0]) {
                fpEnd.set("minDate", selectedDates[0]);
            }
        }
    });

    const fpEnd = flatpickr("#endDateInput", { 
        dateFormat: "d/m/Y", 
        locale: "es", 
        defaultDate: "today"
    });

    poblarAnios();
    cargarTabla();
    suscribirRealtime();
    
    filtroAnio.addEventListener("change", renderizarTabla);
    filtroMes.addEventListener("change", renderizarTabla);
    btnExportar.addEventListener("click", exportarExcel);
});

// ================= ACTUALIZACIONES AUTOMÁTICAS (SUPABASE REALTIME) =================

function suscribirRealtime() {
    actualizarEstadoConexion("connecting");
    supabaseClient
        .channel("actividades1-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "actividades1" }, (payload) => {
            cargarTabla();
            const acciones = { INSERT: "Nuevo registro agregado", UPDATE: "Registro actualizado", DELETE: "Registro eliminado" };
            mostrarToast(`${acciones[payload.eventType] || "Datos actualizados"} (sincronizado automáticamente)`, "success");
        })
        .subscribe((estado) => actualizarEstadoConexion(estado));
}

function poblarAnios() {
    const anioActual = new Date().getFullYear();
    for (let i = anioActual; i >= 2023; i--) {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = i;
        filtroAnio.appendChild(opt);
    }
    filtroAnio.value = anioActual;
}

function calcularKmRecorrido() {
    const ini = parseInt(kmInicialInput.value) || 0;
    const fin = parseInt(kmFinalInput.value) || 0;
    kmRecorridoInput.value = (fin >= ini) ? (fin - ini) : 0;
}
kmInicialInput.addEventListener("input", calcularKmRecorrido);
kmFinalInput.addEventListener("input", calcularKmRecorrido);

// ================= STORAGE IMÁGENES =================

async function subirImagen(file) {
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { data, error } = await supabaseClient.storage
        .from('actividades-images')
        .upload(fileName, file);

    if (error) return null;
    const { data: urlData } = supabaseClient.storage
        .from('actividades-images')
        .getPublicUrl(fileName);
    return urlData.publicUrl;
}

// ================= GUARDAR / ACTUALIZAR =================

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const fDesde = new Date(buildAndAdjustDateFromString(startDateInput.value));
    const fHasta = new Date(buildAndAdjustDateFromString(endDateInput.value));
    
    if (fHasta < fDesde) {
        mostrarToast("La 'Fecha Hasta' no puede ser anterior a la 'Fecha Desde'", "error");
        return;
    }

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
            numero_cuaderno: numeroCuadernoInput.value.trim(),
            numero_expediente: numeroExpedienteInput.value.trim(), // NUEVO
            km_inicial: parseInt(kmInicialInput.value) || 0,
            km_final: parseInt(kmFinalInput.value) || 0,
            km_recorrido: parseInt(kmRecorridoInput.value) || 0,
            viatico: viaticoCobradoSelect.value,
            monto: parseFloat(montoInput.value) || 0,
            observaciones: observacionInput.value.trim(),
            imagenes: imageUrls
        };

        let res;
        if (editandoId) {
            res = await supabaseClient.from('actividades1').update(datos).eq('id', editandoId);
        } else {
            res = await supabaseClient.from('actividades1').insert([datos]);
        }

        if (res.error) throw res.error;

        mostrarToast("¡Registro guardado correctamente!", "success");
        resetFormulario();
        cargarTabla();
    } catch (err) {
        mostrarToast("Error: " + err.message, "error");
    } finally {
        hideLoader();
    }
});

// ================= RENDERIZADO Y FILTROS =================

async function cargarTabla() {
    showLoader();
    const { data, error } = await supabaseClient.from('actividades1').select('*').order('fecha_desde', { ascending: false });
    if (!error) registrosCache = data;
    renderizarTabla();
    hideLoader();
}

function obtenerBadgeEstado(estado) {
    if (!estado) return '-';
    const e = estado.toLowerCase();
    if (e.includes("obligado")) return `<span class="badge badge-obligado">Obligado</span>`;
    if (e.includes("direccion")) return `<span class="badge badge-direccion">Dirección Administrativa</span>`;
    if (e.includes("control")) return `<span class="badge badge-control">Control y Seguimiento</span>`;
    return `<span class="badge badge-default">${estado}</span>`;
}

function actualizarDashboard(datosFiltrados) {
    const totalKm = datosFiltrados.reduce((acc, r) => acc + (r.km_recorrido || 0), 0);
    const totalViaticos = datosFiltrados
        .filter(r => r.viatico === 'Sí')
        .reduce((acc, r) => acc + (r.monto || 0), 0);
    document.getElementById("stat-km").textContent = `${totalKm} km`;
    document.getElementById("stat-viaticos").textContent = `GS ${formatMoney(totalViaticos)}`;
    document.getElementById("stat-viajes").textContent = datosFiltrados.length;
}

function renderizarTabla() {
    tbody.innerHTML = "";
    const anioSel = filtroAnio.value;
    const mesSel = filtroMes.value;

    const filtrados = registrosCache.filter(r => {
        const fecha = new Date(r.fecha_desde);
        const coincideAnio = anioSel === "" || fecha.getFullYear().toString() === anioSel;
        const coincideMes = mesSel === "" || (fecha.getMonth() + 1).toString() === mesSel;
        return coincideAnio && coincideMes;
    });

    actualizarDashboard(filtrados);

    if (filtrados.length === 0) {
        mensajeVacio.style.display = "block";
        return;
    }

    mensajeVacio.style.display = "none";
    filtrados.forEach(row => {
        const tr = document.createElement("tr");
        const imgsHtml = (row.imagenes || []).map(url => `<img src="${url}" class="img-thumb" onclick="window.open('${url}')">`).join("");
        const rangoFechas = `${formatDatePY(row.fecha_desde)} al ${formatDatePY(row.fecha_hasta)}`;

        tr.innerHTML = `
            <td style="font-size: 0.85rem; font-weight: 600;">${rangoFechas}</td>
            <td>${row.actividad}</td>
            <td>${row.lugar}</td>
            <td>${row.numero_cuaderno || '-'}</td>
            <td>${row.numero_expediente || '-'}</td> <!-- NUEVO -->
            <td>${obtenerBadgeEstado(row.permiso)}</td>
            <td>${row.km_inicial}</td>
            <td>${row.km_final}</td>
            <td style="font-weight: bold; color: var(--primary);">${row.km_recorrido}</td>
            <td>${row.observaciones || '-'}</td>
            <td>${row.viatico}</td>
            <td>${formatMoney(row.monto)}</td>
            <td>${imgsHtml}</td>
            <td>
                <button class="btn-editar" onclick="editarActividad('${row.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-borrar" onclick="borrarActividad('${row.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= EXPORTAR EXCEL =================

function exportarExcel() {
    if (registrosCache.length === 0) return mostrarToast("No hay datos para exportar", "error");
    
    const dataExcel = registrosCache.map(r => ({
        "Fecha Desde": r.fecha_desde,
        "Fecha Hasta": r.fecha_hasta,
        "Actividad": r.actividad,
        "Lugar": r.lugar,
        "N° Cuaderno": r.numero_cuaderno,
        "Nº Expediente": r.numero_expediente, // NUEVO
        "Km Inicial": r.km_inicial,
        "Km Final": r.km_final,
        "Km Total": r.km_recorrido,
        "Viático Cobrado": r.viatico,
        "Monto": r.monto
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    XLSX.writeFile(wb, `Viajes_UGR_${filtroAnio.value}_${filtroMes.value}.xlsx`);
}

// ================= ACCIONES =================

window.editarActividad = async function(id) {
    const reg = registrosCache.find(r => r.id === id);
    if (!reg) return;

    startDateInput._flatpickr.setDate(formatDatePY(reg.fecha_desde));
    endDateInput._flatpickr.set("minDate", null);
    endDateInput._flatpickr.setDate(formatDatePY(reg.fecha_hasta));
    
    actividadInput.value = reg.actividad;
    lugarInput.value = reg.lugar;
    permisoInput.value = reg.permiso || '';
    numeroCuadernoInput.value = reg.numero_cuaderno || '';
    numeroExpedienteInput.value = reg.numero_expediente || ''; // NUEVO
    kmInicialInput.value = reg.km_inicial;
    kmFinalInput.value = reg.km_final;
    kmRecorridoInput.value = reg.km_recorrido;
    viaticoCobradoSelect.value = reg.viatico;
    montoInput.value = reg.monto;
    observacionInput.value = reg.observaciones || '';
    
    editandoId = id;
    btnGuardar.innerHTML = '<i class="fas fa-sync"></i> Actualizar Registro';
    btnCancelar.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.borrarActividad = async function(id) {
    if (!confirm("¿Seguro que deseas eliminar este registro?")) return;
    const { error } = await supabaseClient.from('actividades1').delete().eq('id', id);
    if (!error) {
        cargarTabla();
        mostrarToast("Registro eliminado", "success");
    } else {
        mostrarToast("No se pudo eliminar: " + error.message, "error");
    }
};

function resetFormulario() {
    formulario.reset();
    editandoId = null;
    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Registro';
    btnCancelar.style.display = "none";
    startDateInput._flatpickr.setDate(new Date());
    endDateInput._flatpickr.setDate(new Date());
    numeroExpedienteInput.value = ''; // Aseguramos limpieza
}

btnCancelar.addEventListener("click", resetFormulario);

// ================= SINCRONIZACIÓN OFFLINE =================

window.addEventListener('online', async () => {
    const pendientes = JSON.parse(localStorage.getItem("pendientes") || "[]");
    if (pendientes.length > 0) {
        showLoader();
        for (const item of pendientes) {
            await supabaseClient.from('actividades1').insert([item.datos]);
        }
        localStorage.removeItem("pendientes");
        await cargarTabla();
        hideLoader();
        mostrarToast("¡Sincronización completada exitosamente!", "success");
    }
});