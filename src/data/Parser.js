// src/data/Parser.js
import { mean } from '../utils/math.js';

// Palabras clave para identificar columnas (en minúsculas)
const MAPEO_COLUMNAS = {
    fechaPlanificacion: ['inicio planif', 'fecha planif', 'fecha', 'inicio'],
    horaLlegada: ['hora actual registro', 'hora llegada', 'llegada'],
    horaInicioCarga: ['hora act.inic.carga', 'hora inicio carga', 'inicio carga'],
    horaFinCarga: ['hora fin carga', 'fin carga', 'hora fin'],
    muelle: ['muelle de carga', 'muelle']
};

/**
 * Normaliza las claves de una fila CSV a nombres estándar.
 * @param {Object} fila - Objeto con las claves originales del CSV.
 * @returns {Object} Objeto con claves normalizadas.
 */
function normalizarFila(fila) {
    const filaNormalizada = {};
    for (const [clave, valor] of Object.entries(fila)) {
        const claveLower = clave.toLowerCase().trim();
        for (const [claveStd, palabras] of Object.entries(MAPEO_COLUMNAS)) {
            if (palabras.some(p => claveLower.includes(p))) {
                filaNormalizada[claveStd] = valor;
                break; // primera coincidencia
            }
        }
    }
    return filaNormalizada;
}

// ---------- Funciones de parseo de fechas ----------
export function combinarFechaHora(fechaStr, horaStr) {
    if (!fechaStr || !horaStr) return null;
    const fechaPartes = fechaStr.trim().split('/');
    if (fechaPartes.length !== 3) return null;
    const dia = parseInt(fechaPartes[0], 10);
    const mes = parseInt(fechaPartes[1], 10) - 1;
    const anio = parseInt(fechaPartes[2], 10);
    const horaPartes = horaStr.trim().split(':');
    if (horaPartes.length < 2) return null;
    const hora = parseInt(horaPartes[0], 10);
    const minuto = parseInt(horaPartes[1], 10);
    const segundo = horaPartes.length >= 3 ? parseInt(horaPartes[2], 10) : 0;
    return new Date(anio, mes, dia, hora, minuto, segundo);
}

// ---------- Funciones de procesamiento de CSV ----------
export function parsearCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (resultados) => resolve(resultados.data),
            error: (error) => reject(error)
        });
    });
}

/**
 * Calcula estadísticas de un área, incluyendo muelles promedio y detección de horas pico.
 */
export function calcularEstadisticas(datos, nombreArea, umbralOutlier = 0) {
    if (!datos || datos.length === 0) {
        return { html: `<p><strong>${nombreArea}:</strong> sin datos.</p>`, tiemposServicio: [], outliers: [] };
    }

    const llegadas = [];
    const tiemposServicio = [];
    const outliers = [];
    const muellesPorDia = new Map(); // key: fecha (YYYY-MM-DD), value: Set de muelles

    for (let filaCruda of datos) {
        const fila = normalizarFila(filaCruda);
        const fechaStr = fila.fechaPlanificacion || '';
        const horaLlegadaStr = fila.horaLlegada || '';
        const horaInicioStr = fila.horaInicioCarga || '';
        const horaFinStr = fila.horaFinCarga || '';
        const muelle = fila.muelle || '';

        if (!fechaStr || !horaLlegadaStr || !horaInicioStr || !horaFinStr) continue;
        const llegada = combinarFechaHora(fechaStr, horaLlegadaStr);
        const inicio = combinarFechaHora(fechaStr, horaInicioStr);
        const fin = combinarFechaHora(fechaStr, horaFinStr);
        if (!llegada || !inicio || !fin) continue;
        const servicio = (fin - inicio) / 60000;
        if (servicio < 0) continue;

        // Agrupar muelles por día para el promedio
        const fechaSolo = llegada.toISOString().split('T')[0];
        if (!muellesPorDia.has(fechaSolo)) muellesPorDia.set(fechaSolo, new Set());
        if (muelle) muellesPorDia.get(fechaSolo).add(muelle);

        if (umbralOutlier > 0 && servicio > umbralOutlier) {
            outliers.push({ llegada, inicioCarga: inicio, finCarga: fin, tiempoServicio: servicio, muelle });
        } else {
            llegadas.push(llegada);
            tiemposServicio.push(servicio);
        }
    }

    // Cálculo de muelles promedio
    const numDias = muellesPorDia.size;
    const sumaMuelles = [...muellesPorDia.values()].reduce((acc, set) => acc + set.size, 0);
    const muellesPromedio = numDias > 0 ? (sumaMuelles / numDias) : 0;

    // Detección automática de horas pico (basada en llegadas válidas)
    const horasPicoDetectadas = detectarHorasPico(llegadas);

    if (llegadas.length === 0 && outliers.length === 0) {
        return { html: `<p><strong>${nombreArea}:</strong> sin registros parseables.</p>`, tiemposServicio: [], outliers: [] };
    }
    if (llegadas.length === 0) {
        let html = `<h3>${nombreArea}</h3><p>0 registros válidos (todos outliers).</p><p>Outliers: ${outliers.length}</p>`;
        return { html, tiemposServicio: [], outliers };
    }

    llegadas.sort((a, b) => a - b);
    const ints = [];
    for (let i = 1; i < llegadas.length; i++) ints.push((llegadas[i] - llegadas[i-1]) / 60000);
    const mediaLleg = ints.length ? mean(ints) : 0;
    const mediaServ = mean(tiemposServicio);
    const desvServ = tiemposServicio.length > 1
        ? Math.sqrt(tiemposServicio.map(t => (t-mediaServ)**2).reduce((a,b)=>a+b) / (tiemposServicio.length-1))
        : 0;

    let html = `<h3>${nombreArea}</h3>`;
    html += `<p>Registros válidos: ${llegadas.length}</p>`;
    if (umbralOutlier > 0) html += `<p>Outliers excluidos: ${outliers.length}</p>`;
    html += `<p>Tiempo medio entre llegadas: ${mediaLleg.toFixed(2)} min</p>`;
    html += `<p>Servicio medio: ${mediaServ.toFixed(2)} min · Desv: ${desvServ.toFixed(2)} min</p>`;
    html += `<p><strong>Muelles promedio utilizados:</strong> ${muellesPromedio.toFixed(1)} (${numDias} días)</p>`;

    if (horasPicoDetectadas) {
        html += `<p><strong>Horas pico detectadas:</strong> <code>${horasPicoDetectadas}</code></p>`;
        html += `<p style="font-size:0.8rem; color:#666;">Puedes copiar este valor al campo "Horas pico" del modo avanzado.</p>`;
    } else {
        html += `<p>No se detectaron horas pico significativas.</p>`;
    }

    return {
        html,
        tiemposServicio,
        outliers,
        mediaLlegadas: mediaLleg,
        mediaServicio: mediaServ,
        desvServicio: desvServ,
        muellesPromedio,
        horasPicoStr: horasPicoDetectadas
    };
}

/**
 * Detecta horas pico analizando la densidad de llegadas por hora.
 * @param {Date[]} llegadas - Array de objetos Date con las horas de llegada.
 * @returns {string|null} String con las horas pico (ej. "08:00-09:00x1.8, 13:00-14:00x2.1") o null si no hay.
 */
function detectarHorasPico(llegadas) {
    if (llegadas.length < 10) return null; // pocos datos

    const conteoPorHora = new Array(24).fill(0);
    for (const llegada of llegadas) {
        const hora = llegada.getHours();
        conteoPorHora[hora]++;
    }

    const mediaPorHora = mean(conteoPorHora);
    if (mediaPorHora === 0) return null;

    const picos = [];
    for (let h = 0; h < 24; h++) {
        const factor = conteoPorHora[h] / mediaPorHora;
        if (factor > 1.5 && conteoPorHora[h] >= 3) { // al menos 3 llegadas en esa hora y 50% más que la media
            picos.push(`${h.toString().padStart(2, '0')}:00-${h.toString().padStart(2, '0')}:59x${factor.toFixed(1)}`);
        }
    }

    return picos.length > 0 ? picos.join(', ') : null;
}

// ---------- Validación de conflictos (sin cambios) ----------
export function validarConflictosPorMuelle(datos) {
    const porMuelle = {};
    for (let filaCruda of datos) {
        const fila = normalizarFila(filaCruda);
        const fechaStr = fila.fechaPlanificacion || '';
        const horaInicioStr = fila.horaInicioCarga || '';
        const horaFinStr = fila.horaFinCarga || '';
        const muelle = fila.muelle || '';
        if (!fechaStr || !horaInicioStr || !horaFinStr || !muelle) continue;
        const inicio = combinarFechaHora(fechaStr, horaInicioStr);
        const fin = combinarFechaHora(fechaStr, horaFinStr);
        if (!inicio || !fin) continue;
        if (!porMuelle[muelle]) porMuelle[muelle] = [];
        porMuelle[muelle].push({ inicio, fin, fila: filaCruda });
    }
    const conflictos = [];
    for (const muelle in porMuelle) {
        const registros = porMuelle[muelle].sort((a, b) => a.inicio - b.inicio);
        for (let i = 0; i < registros.length - 1; i++) {
            if (registros[i].fin > registros[i+1].inicio) {
                conflictos.push({
                    muelle,
                    anterior: registros[i],
                    siguiente: registros[i+1],
                    solapamiento: (registros[i].fin - registros[i+1].inicio) / 60000
                });
            }
        }
    }
    return conflictos;
}
