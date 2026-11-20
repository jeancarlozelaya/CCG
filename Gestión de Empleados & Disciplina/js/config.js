// ==================== URLS Y CONSTANTES ====================
const SCRIPT_URL_OBTENER = "https://script.google.com/macros/s/AKfycbzzc0oprrMXsDIAOIkdHZaVj3gwI2u0uliSLtIKWRueTfHn8jJWAbYXkWOz0uPNwDDK/exec";
const SCRIPT_URL_ENVIAR = "https://script.google.com/macros/s/AKfycbzNhz3UQhdFwL5fOYYJ8nHaQaBCsysAC6O3jiu-zMym4PT20JyQf8YkMcChaSz3PyRnZA/exec";
const BUZON_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyrOFyYZzu8EFCox-en4loOdb0bG3w0zm3MxgxrbSAb7aeu46DLT6mS_KO2z-ngwyeI/exec";
const CARNETS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwjoSBUgnB4ZtRv9-6ijNzFo9HufIhEZnsPxRCsmXQvYI25mllyloUo3qSRUaR54KojEQ/exec";
const PERMISOS_GESTION_URL = "https://script.google.com/macros/s/AKfycbzyW8BXlcFBrVl2Ju_OsIifEfXGz4i7uskZzyd7iUxtozqijjDJBdN00MBcoM-CDAn3-A/exec";
const SCRIPT_URL_EXAMENES = "https://script.google.com/macros/s/AKfycbwvIb0RKAP5ACSKHbYOTh0GkXt91YraOpwooKL2GvE8KJidAJIqTZo7swzwRARFityS3Q/exec";
const ENCUESTAS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsP6rcB5bJ646BTfwA8fiJgSxn3cBVy4NrDQyuZnNYvWuni2-Wq-bNJ4r3TsX2YNYv1A/exec";

const ADMIN_PASSWORD = "pisos2026";
const META_ASISTENCIA = 87;

function isAdminMode() {
    return sessionStorage.getItem('pb_modoAdmin') === 'true';
}

const CRITERIOS_EVALUACION = {
    productividad: [
        "Capacidad del empleado para completar las tareas de limpieza asignadas en el tiempo estipulado.",
        "Medición de la eficiencia en la realización de las labores diarias.",
        "Revisión de la calidad de la limpieza realizada en las áreas asignadas.",
        "Observación de la atención al detalle y la capacidad para mantener los estándares de limpieza requeridos.",
        "Evaluación del uso adecuado de productos de limpieza y equipos.",
        "Minimización del desperdicio y cuidado de los recursos proporcionados.",
        "Tiene la capacidad y autonomía para realizar las tareas asignadas de forma independiente sin necesidad de supervisión constante."
    ],
    iniciativa: [
        "Se muestra asequible al cambio.",
        "Se anticipa a las dificultades.",
        "Tiene gran capacidad para resolver problemas.",
        "Muestra aptitud para integrarse al equipo.",
        "Se identifica fácilmente con los objetivos del equipo.",
        "Planifica sus actividades.",
        "Se preocupa por alcanzar las metas.",
        "Mantiene un seguimiento efectivo y preciso de los registros proporcionados para documentar sus actividades diarias en el trabajo."
    ],
    conducta: [
        "Registro de la puntualidad y asistencia del empleado.",
        "Manejo de ausencias y justificaciones en caso de retrasos.",
        "Observación de la actitud del empleado hacia el trabajo y sus compañeros.",
        "Colaboración con el equipo y disposición para realizar tareas adicionales cuando sea necesario.",
        "Respeto y seguimiento de las normas de seguridad, higiene y procedimientos establecidos.",
        "Adherencia a las políticas internas del proyecto.",
        "Evita los conflictos dentro del trabajo."
    ]
};

// ==================== UTILIDADES COMPARTIDAS ====================
function getHoyStr() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function corregirFecha(item) {
    const propiedadesFecha = [
        'fechaInicio', 'fechaNacimiento', 'fechaEgreso', 'fecha',
        'fechaFin', 'fechaFalta', 'fechaLlamadoAtencion', 'fechaEvaluacion', 'fechaIncidente'
    ];
    propiedadesFecha.forEach(prop => {
        if (item[prop] && typeof item[prop] === 'string' && item[prop].includes('T')) {
            const fecha = new Date(item[prop]);
            item[prop] = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
        }
    });
    return item;
}

function parsearFechaUTC(fechaStr) {
    if (!fechaStr) return null;
    try {
        const fecha = new Date(fechaStr + 'T00:00:00Z');
        return isNaN(fecha.getTime()) ? null : fecha;
    } catch (error) {
        return null;
    }
}

function parsearFechaFlexible(fechaStr) {
    if (!fechaStr) return null;
    const str = String(fechaStr).trim();
    if (!str) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = new Date(str + 'T00:00:00');
        return isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
        const d = new Date(str.replace(/\s+/, 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    const limpio = str.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const d = new Date(limpio);
    return isNaN(d.getTime()) ? null : d;
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
        const str = String(fechaStr).trim();
        if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str;
        const fecha = parsearFechaFlexible(str);
        if (!fecha) return str;
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const anio = fecha.getFullYear();
        return `${dia}/${mes}/${anio}`;
    } catch (e) {
        return fechaStr;
    }
}

function formatearHoraDesdeFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
        const str = String(fechaStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return '';
        const fecha = parsearFechaFlexible(str);
        if (!fecha) return '';
        let horas = fecha.getHours();
        const minutos = fecha.getMinutes();
        const ampm = horas >= 12 ? 'PM' : 'AM';
        horas = horas % 12 || 12;
        return `${horas}:${String(minutos).padStart(2, '0')} ${ampm}`;
    } catch (e) {
        return '';
    }
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    try {
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
        if (isNaN(nacimiento.getTime())) return null;
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    } catch (e) {
        return null;
    }
}

function formatearIdentidad(input) {
    let valor = input.value.replace(/\D/g, '').substring(0, 13);
    if (valor.length > 8) valor = `${valor.substring(0, 4)}-${valor.substring(4, 8)}-${valor.substring(8)}`;
    else if (valor.length > 4) valor = `${valor.substring(0, 4)}-${valor.substring(4)}`;
    input.value = valor;
    validarCampo(input);
}

function formatearTelefono(input) {
    let valor = input.value.replace(/\D/g, '').substring(0, 8);
    if (valor.length > 4) valor = valor.substring(0, 4) + '-' + valor.substring(4, 8);
    input.value = valor;
    validarCampoTelefono(input);
}

function validarCampoTelefono(input) {
    const $campo = $(input);
    $campo.removeClass('is-valid is-invalid');
    $campo.next('.invalid-feedback').remove();
    if (!$campo.val() || $campo.val().trim() === '') return;
    const esValido = /^\d{4}-\d{4}$/.test($campo.val());
    if (esValido) $campo.addClass('is-valid');
    else {
        $campo.addClass('is-invalid');
        $campo.after($('<div>', { class: 'invalid-feedback', text: 'Formato de teléfono inválido. Use: 0000-0000' }));
    }
}

function validarCampo(campo) {
    if (!campo) return;
    const $campo = $(campo);
    if ($campo.hasClass('movil') || $campo.hasClass('movil-emergencia')) {
        validarCampoTelefono(campo);
        return;
    }
    $campo.removeClass('is-valid is-invalid');
    $campo.next('.invalid-feedback').remove();

    const valor = $campo.val();
    if (!$campo.prop('required') && (!valor || valor.trim() === '')) return;

    let esValido = false;
    if ($campo.hasClass('identidad')) {
        esValido = /^\d{4}-\d{4}-\d{5}$/.test($campo.val());
    } else if ($campo.attr('type') === 'date') {
        const fecha = new Date($campo.val());
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if ($campo.hasClass('fecha-nacimiento') || $campo.hasClass('fecha-ausencia') || $campo.hasClass('fecha-incidente')) {
            esValido = !isNaN(fecha.getTime()) && fecha <= hoy;
        } else {
            esValido = !isNaN(fecha.getTime());
        }
    } else if ($campo.attr('type') === 'number') {
        const num = parseFloat($campo.val());
        const min = parseFloat($campo.attr('min')) || -Infinity;
        const max = parseFloat($campo.attr('max')) || Infinity;
        esValido = !isNaN(num) && num >= min && num <= max;
    } else if ($campo.is('select')) {
        esValido = $campo.val() !== "" && $campo.val() !== null;
    } else {
        const txt = ($campo.val() || '').trim();
        esValido = txt !== "";
        if ($campo.hasClass('nombre-completo') && esValido) {
            esValido = txt.split(/\s+/).filter(Boolean).length >= 2;
        }
    }

    if (esValido) {
        $campo.addClass('is-valid');
    } else {
        $campo.addClass('is-invalid');
        const msg = $campo.hasClass('identidad') ? 'Formato: 0000-0000-00000'
                  : $campo.hasClass('nombre-completo') ? 'Ingrese nombre y apellido'
                  : 'Este campo es obligatorio o inválido';
        $campo.after($('<div>', { class: 'invalid-feedback', text: msg }));
    }
}

function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        if (file.size > 5 * 1024 * 1024) return reject(new Error('El archivo excede 5MB.'));
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Error al leer archivo.'));
        reader.readAsDataURL(file);
    });
}

function getDiasSinIncidentes(incidentesList) {
    if (!incidentesList || incidentesList.length === 0) {
        const fechaBase = new Date('2025-10-01T00:00:00');
        return Math.max(0, Math.floor((new Date() - fechaBase) / (1000 * 60 * 60 * 24)));
    }
    const fechas = incidentesList.map(i => new Date(i.fechaIncidente + 'T00:00:00')).filter(d => !isNaN(d.getTime()));
    if (fechas.length === 0) return 0;
    const ultimo = new Date(Math.max(...fechas.map(d => d.getTime())));
    const hoy = new Date();
    if (hoy < ultimo) return 0;
    return Math.floor((hoy - ultimo) / (1000 * 60 * 60 * 24));
}

function calcularRotacionUnificada(colaboradoresActivos, colaboradoresEgresos, fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    const activosInicio = colaboradoresActivos.filter(c => new Date(c.fechaInicio + 'T00:00:00') < inicio).length;
    const activosFin = colaboradoresActivos.filter(c => new Date(c.fechaInicio + 'T00:00:00') <= fin).length;
    const egresosPeriodo = colaboradoresEgresos.filter(e => {
        const f = new Date(e.fechaEgreso + 'T00:00:00');
        return f >= inicio && f <= fin;
    }).length;

    const promedio = (activosInicio + activosFin) / 2;
    const porcentaje = promedio > 0 ? (egresosPeriodo / promedio) * 100 : 0;

    return {
        porcentaje: porcentaje.toFixed(2),
        egresos: egresosPeriodo,
        activosInicio,
        activosFin,
        promedio: promedio.toFixed(2)
    };
}

// ==================== CÁLCULO UNIFICADO DE AUSENTISMO Y RECTIFICACIÓN ====================
function calcularAusentismoUnificado(activos, egresos, ausencias, fechaInicio, fechaFin) {
    const ini = new Date(fechaInicio);
    ini.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime()) || fin < ini) return '0.00';

    const mapaCols = new Map();
    (egresos || []).forEach(e => {
        if (e.identidad) mapaCols.set(e.identidad, e);
    });
    (activos || []).forEach(a => {
        if (a.identidad) mapaCols.set(a.identidad, a);
    });

    let diasAusente = 0;
    (ausencias || []).forEach(a => {
        const aIni = new Date(a.fecha + 'T00:00:00');
        const aFin = new Date((a.fechaFin || a.fecha) + 'T00:00:00');
        if (isNaN(aIni.getTime()) || isNaN(aFin.getTime())) return;
        const interIni = aIni < ini ? ini : aIni;
        const interFin = aFin > fin ? fin : aFin;
        if (interIni <= interFin) {
            diasAusente += Math.round((interFin - interIni) / 86400000) + 1;
        }
    });

    let diasLaborablesPosibles = 0;
    mapaCols.forEach(col => {
        if (!col.fechaInicio) return;
        const colIni = new Date(col.fechaInicio + 'T00:00:00');
        if (isNaN(colIni.getTime())) return;
        const colFin = col.fechaEgreso ? new Date(col.fechaEgreso + 'T00:00:00') : fin;
        const efIni = colIni > ini ? colIni : ini;
        const efFin = colFin < fin ? colFin : fin;
        if (efIni <= efFin) {
            for (let d = new Date(efIni); d <= efFin; d.setDate(d.getDate() + 1)) {
                const diaSem = d.getDay();
                if (diaSem >= 1 && diaSem <= 5) diasLaborablesPosibles++;
            }
        }
    });

    return diasLaborablesPosibles > 0
        ? ((diasAusente / diasLaborablesPosibles) * 100).toFixed(2)
        : '0.00';
}

function obtenerRangoFechasStr(fechaIniStr, fechaFinStr) {
    const fechas = [];
    if (!fechaIniStr) return fechas;
    const ini = new Date(fechaIniStr + 'T00:00:00');
    const fin = new Date((fechaFinStr || fechaIniStr) + 'T00:00:00');
    if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return fechas;
    for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        fechas.push(`${yyyy}-${mm}-${dd}`);
    }
    return fechas;
}

function calcularDatosAsistenciaDia(activos, egresos, ausencias, fechaStr) {
    const ingresosDespues = (activos || []).filter(c => c.fechaInicio && c.fechaInicio > fechaStr).length;
    const egresosDespues = (egresos || []).filter(e => e.fechaEgreso && e.fechaEgreso > fechaStr).length;
    const activosDia = (activos || []).length - ingresosDespues + egresosDespues;

    const egresosDia = (egresos || []).filter(e => e.fechaEgreso === fechaStr).length;
    const ingresosUnicos = new Set();
    (activos || []).forEach(c => { if (c.fechaInicio === fechaStr && c.identidad) ingresosUnicos.add(c.identidad); });
    (egresos || []).forEach(e => { if (e.fechaInicio === fechaStr && e.identidad) ingresosUnicos.add(e.identidad); });
    const ingresosDia = ingresosUnicos.size;

    const identidadesActivas = new Set();
    (activos || []).forEach(c => {
        if (c.identidad && c.fechaInicio && c.fechaInicio <= fechaStr) {
            identidadesActivas.add(c.identidad);
        }
    });
    (egresos || []).forEach(e => {
        if (e.identidad && e.fechaInicio && e.fechaInicio <= fechaStr && e.fechaEgreso && e.fechaEgreso > fechaStr) {
            identidadesActivas.add(e.identidad);
        }
    });

    const ausentesUnicos = new Set();
    (ausencias || []).forEach(a => {
        const fin = a.fechaFin || a.fecha;
        if (fechaStr >= a.fecha && fechaStr <= fin && identidadesActivas.has(a.identidad)) {
            ausentesUnicos.add(a.identidad);
        }
    });

    const ausentesDia = ausentesUnicos.size;
    return {
        fecha: fechaStr,
        activos: activosDia,
        ausentes: ausentesDia,
        egresos: egresosDia,
        ingresos: ingresosDia,
        presentes: activosDia - ausentesDia
    };
}

function calcularRectificacionDiaAsistencia(regActual, activos, egresos, ingresos, ausencias) {
    const fechaStr = regActual.fecha;
    const activosGuardados = Number(regActual.activos || 0);

    const egresosDia = (egresos || []).filter(e => e.fechaEgreso === fechaStr).length;

    const ingresosUnicos = new Set();
    const fuenteIngresos = (ingresos && ingresos.length > 0) ? ingresos : [...(activos || []), ...(egresos || [])];
    fuenteIngresos.forEach(c => {
        if (c.fechaInicio === fechaStr && c.identidad) ingresosUnicos.add(c.identidad);
    });
    const ingresosDia = ingresosUnicos.size;

    const activosSet = new Set((activos || []).map(c => c.identidad).filter(Boolean));
    const egresadosAntesSet = new Set();
    (egresos || []).forEach(e => {
        if (e.identidad && !activosSet.has(e.identidad) && e.fechaEgreso && e.fechaEgreso <= fechaStr) {
            egresadosAntesSet.add(e.identidad);
        }
    });

    const ausentesUnicos = new Set();
    (ausencias || []).forEach(a => {
        const fin = a.fechaFin || a.fecha;
        if (a.identidad && fechaStr >= a.fecha && fechaStr <= fin && !egresadosAntesSet.has(a.identidad)) {
            ausentesUnicos.add(a.identidad);
        }
    });

    const ausentesDia = ausentesUnicos.size;
    return {
        fecha: fechaStr,
        activos: activosGuardados,
        ausentes: ausentesDia,
        egresos: egresosDia,
        ingresos: ingresosDia,
        presentes: Math.max(0, activosGuardados - ausentesDia)
    };
}

function rectificarAsistenciaEnCache(cache, fechasAfectadas) {
    const fechasSet = new Set(fechasAfectadas || []);
    if (!cache.asistencia || cache.asistencia.length === 0 || fechasSet.size === 0) return 0;

    let rectificados = 0;
    cache.asistencia = cache.asistencia.map(reg => {
        if (!fechasSet.has(reg.fecha)) return reg;
        const nuevo = calcularRectificacionDiaAsistencia(reg, cache.activos, cache.egresos, cache.ingresos, cache.ausencias);
        if (Number(reg.ausentes) !== nuevo.ausentes ||
            Number(reg.presentes) !== nuevo.presentes ||
            Number(reg.egresos || 0) !== nuevo.egresos ||
            Number(reg.ingresos || 0) !== nuevo.ingresos) {
            rectificados++;
            return { ...reg, ...nuevo, _pendienteSync: true };
        }
        return reg;
    });
    return rectificados;
}

// ==================== DURACIÓN Y VENCIMIENTO DE CONTRATOS ====================
function normalizarDuracionContrato(duracion) {
    const d = String(duracion || '').trim().toLowerCase();
    if (d === '1 año' || d === '1 ano' || d === '12 meses' || d === '12') return '1 año';
    return '6 meses';
}

function obtenerMesesContrato(duracion) {
    return normalizarDuracionContrato(duracion) === '1 año' ? 12 : 6;
}

function calcularFechaVencimientoContrato(fechaInicioStr, duracion) {
    if (!fechaInicioStr) return null;
    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00');
    if (isNaN(fechaInicio.getTime())) return null;
    const meses = obtenerMesesContrato(duracion);
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + meses);
    fechaVencimiento.setDate(fechaVencimiento.getDate() - 1);
    return fechaVencimiento;
}
