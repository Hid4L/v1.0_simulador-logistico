// src/simulation/Simulator.js
import { gaussianRandom, mean } from '../utils/math.js';

/**
 * Parsea un string de horas pico con formato "HH:MM-HH:MMxFactor, ..."
 * Ejemplo: "08:00-10:00x2, 13:00-15:00x1.5"
 * @param {string} str
 * @returns {Array<{inicio: number, fin: number, factor: number}>}
 */
function parsearHorasPico(str) {
    if (!str || !str.trim()) return [];
    return str.split(',').map(parte => {
        const [rango, factorStr] = parte.trim().split('x');
        const [inicioStr, finStr] = rango.split('-');
        const inicio = timeToMinutes(inicioStr.trim());
        const fin = timeToMinutes(finStr.trim());
        const factor = parseFloat(factorStr) || 1;
        return { inicio, fin, factor };
    }).filter(h => h.inicio < h.fin && h.factor > 0);
}

/**
 * Convierte "HH:MM" a minutos.
 */
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Obtiene el factor de hora pico para un minuto dado.
 * @param {number} minuto
 * @param {Array} horasPico
 * @returns {number} Factor (1 si no hay pico)
 */
function factorHoraPico(minuto, horasPico) {
    for (const pico of horasPico) {
        if (minuto >= pico.inicio && minuto < pico.fin) {
            return pico.factor;
        }
    }
    return 1;
}

export function ejecutarSimulacionDetallada(params) {
    const {
        muelles, mediaServicio, desvServicio,
        aperturaMin, cierreMin,
        mediaLlegadas, factor,
        modoLlegada, cantidadMin, cantidadMax,
        // nuevos parámetros
        porcentajeFurgo = 0,
        llegadaInicioMin = aperturaMin,
        llegadaFinMin = cierreMin,
        horasPicoStr = '',
        refuerzoInicio = null,
        refuerzoFin = null,
        muellesExtra = 0,
        riesgoAveria = 0,
        duracionReparacion = 60
    } = params;

    // Parsear horas pico
    const horasPico = parsearHorasPico(horasPicoStr);

    // Construir tabla de turnos (muelles + refuerzo)
    const turnos = [];
    // Turno base (sin refuerzo): solo se aplica si no estamos dentro del refuerzo
    // Para simplificar, dividimos el día en tramos según el refuerzo
    if (refuerzoInicio !== null && refuerzoFin !== null && muellesExtra > 0 && refuerzoInicio < refuerzoFin) {
        // Antes del refuerzo
        if (aperturaMin < refuerzoInicio) {
            turnos.push({ inicio: aperturaMin, fin: refuerzoInicio, muelles });
        }
        // Durante el refuerzo
        turnos.push({ inicio: refuerzoInicio, fin: refuerzoFin, muelles: muelles + muellesExtra });
        // Después del refuerzo
        if (refuerzoFin < cierreMin) {
            turnos.push({ inicio: refuerzoFin, fin: cierreMin, muelles });
        }
    } else {
        // Sin refuerzo
        turnos.push({ inicio: aperturaMin, fin: cierreMin, muelles });
    }

    const minPorDia = 24 * 60;
    const cola = [];        // { llegada, tipo: 'normal'|'prioritario' }
    const muellesArr = new Array(muelles + muellesExtra).fill(null); // tamaño máximo
    let tiempoActual = 0;
    const registros = [];
    const eventosCola = [];
    const eventosEspera = [];
    let idxLlegada = 0;

    // Generar llegadas según el horario de llegadas y horas pico
    let llegadasProgramadas = [];
    if (modoLlegada === 'frecuencia') {
        let t = llegadaInicioMin;
        while (t < llegadaFinMin) {
            // Calcular factor de hora pico en el minuto actual
            const factorPico = factorHoraPico(t, horasPico);
            const intervalo = -Math.log(Math.random()) * (mediaLlegadas / factorPico);
            t += intervalo;
            if (t >= llegadaFinMin) break;
            // Asignar tipo según porcentaje de furgonetas
            const tipo = Math.random() * 100 < porcentajeFurgo ? 'prioritario' : 'normal';
            llegadasProgramadas.push({ tiempo: t, tipo });
        }
    } else {
        const numCamiones = Math.floor(Math.random() * (cantidadMax - cantidadMin + 1)) + cantidadMin;
        const duracionLlegadas = llegadaFinMin - llegadaInicioMin;
        // Repartir según horas pico (sesgar probabilidad)
        for (let i = 0; i < numCamiones; i++) {
            // Elegir minuto dentro del horario de llegadas con probabilidad sesgada por horas pico
            const minutoAleatorio = llegadaInicioMin + Math.random() * duracionLlegadas;
            // Si cae en una hora pico, puede mantenerse o rechazarse según factor (simplificación)
            const factorAqui = factorHoraPico(minutoAleatorio, horasPico);
            // Aceptar con probabilidad proporcional al factor (más factor = más probable)
            if (factorAqui === 1 || Math.random() < (factorAqui - 1) / factorAqui) {
                const tipo = Math.random() * 100 < porcentajeFurgo ? 'prioritario' : 'normal';
                llegadasProgramadas.push({ tiempo: minutoAleatorio, tipo });
            } else {
                // Reintentar: volvemos a meter el intento (para no perder camiones)
                i--;
            }
        }
        llegadasProgramadas.sort((a, b) => a.tiempo - b.tiempo);
    }

    // Función para obtener muelles activos en un minuto dado según turnos
    function muellesActivos(minuto) {
        for (const turno of turnos) {
            if (minuto >= turno.inicio && minuto < turno.fin) {
                return turno.muelles;
            }
        }
        return 0;
    }

    // Función para encolar respetando prioridad (furgonetas delante)
    function encolarConPrioridad(camion) {
        if (camion.tipo === 'prioritario') {
            // Insertar justo después del último prioritario
            let pos = 0;
            while (pos < cola.length && cola[pos].tipo === 'prioritario') {
                pos++;
            }
            cola.splice(pos, 0, camion);
        } else {
            cola.push(camion);
        }
    }

    // Estado de averías de cada muelle
    const averiado = new Array(muelles + muellesExtra).fill(false);
    const finReparacion = new Array(muelles + muellesExtra).fill(0);

    // Evaluar averías al inicio del día
    for (let i = 0; i < muelles + muellesExtra; i++) {
        if (Math.random() < riesgoAveria) {
            averiado[i] = true;
            const duracion = Math.max(1, gaussianRandom(duracionReparacion, duracionReparacion * 0.3));
            finReparacion[i] = aperturaMin + duracion;
        }
    }

    // Bucle principal de simulación (similar al actual pero con encolado prioritario y averías)
    while (idxLlegada < llegadasProgramadas.length || cola.length > 0 || muellesArr.some(m => m !== null)) {
        let proxLlegada = idxLlegada < llegadasProgramadas.length ? llegadasProgramadas[idxLlegada].tiempo : Infinity;
        let proxFinServicio = Infinity;
        let muelleElegido = -1;
        for (let i = 0; i < muellesArr.length; i++) {
            if (muellesArr[i] && muellesArr[i].finServicio < proxFinServicio) {
                proxFinServicio = muellesArr[i].finServicio;
                muelleElegido = i;
            }
        }
        // También considerar fin de reparación como evento
        for (let i = 0; i < averiado.length; i++) {
            if (averiado[i] && finReparacion[i] < proxFinServicio && finReparacion[i] > tiempoActual) {
                proxFinServicio = finReparacion[i];
                muelleElegido = i;
                // tipo especial: fin reparación
            }
        }

        if (proxLlegada <= proxFinServicio) {
            tiempoActual = proxLlegada;
            const camion = llegadasProgramadas[idxLlegada];
            encolarConPrioridad(camion);
            idxLlegada++;

            // Intentar asignar camiones en cola a muelles libres y no averiados
            asignarCamiones();
        } else if (proxFinServicio !== Infinity) {
            tiempoActual = proxFinServicio;
            if (muelleElegido >= 0 && muellesArr[muelleElegido]) {
                muellesArr[muelleElegido] = null;
            }
            // Si el evento era una reparación
            if (averiado[muelleElegido]) {
                averiado[muelleElegido] = false;
            }
            asignarCamiones();
        } else {
            break;
        }

        eventosCola.push({ tiempo: tiempoActual, cola: cola.length });
    }

    // Función interna para asignar camiones a muelles libres
    function asignarCamiones() {
        const activos = muellesActivos(tiempoActual % minPorDia);
        while (cola.length > 0 && activos > 0) {
            let libre = -1;
            for (let i = 0; i < activos && i < muellesArr.length; i++) {
                if (muellesArr[i] === null && !averiado[i]) {
                    libre = i;
                    break;
                }
            }
            if (libre === -1) break;

            const siguiente = cola.shift();
            const espera = Math.max(0, tiempoActual - siguiente.tiempo);
            const tiempoServicio = Math.max(1, gaussianRandom(mediaServicio / factor, desvServicio / factor));
            const inicio = tiempoActual;
            const fin = inicio + tiempoServicio;
            muellesArr[libre] = { finServicio: fin, inicio, muelle: libre };
            registros.push({
                llegada: siguiente.tiempo,
                inicioServicio: inicio,
                finServicio: fin,
                espera,
                muelle: libre,
                tipo: siguiente.tipo
            });
            eventosEspera.push({ tiempo: tiempoActual, espera });
        }
    }

    if (registros.length === 0) return { error: "No se atendió ningún camión.", registros: [], eventosCola: [], eventosEspera: [] };

    // Calcular KPIs igual que antes
    // ...
    return { registros, eventosCola, eventosEspera };
}
