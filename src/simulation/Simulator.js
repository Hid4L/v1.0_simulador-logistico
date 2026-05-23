// src/simulation/Simulator.js
import { gaussianRandom, mean } from '../utils/math.js';

/**
 * Ejecuta una simulación detallada de 1 día (1440 minutos).
 * Devuelve { registros, eventosCola, eventosEspera }.
 */
export function ejecutarSimulacionDetallada(params) {
    const { muelles, mediaServicio, desvServicio, aperturaMin, cierreMin, mediaLlegadas, factor, modoLlegada, cantidadMin, cantidadMax } = params;
    const minPorDia = 24 * 60;
    let llegadasProgramadas = [];

    if (modoLlegada === 'frecuencia') {
        let t = aperturaMin;
        while (t < cierreMin) {
            const intervalo = -Math.log(Math.random()) * mediaLlegadas;
            t += intervalo;
            if (t >= cierreMin) break;
            llegadasProgramadas.push(t);
        }
    } else {
        const numCamiones = Math.floor(Math.random() * (cantidadMax - cantidadMin + 1)) + cantidadMin;
        const duracion = cierreMin - aperturaMin;
        for (let i = 0; i < numCamiones; i++) {
            llegadasProgramadas.push(aperturaMin + Math.random() * duracion);
        }
        llegadasProgramadas.sort((a, b) => a - b);
    }

    const cola = [];
    const muellesArr = new Array(muelles).fill(null);
    let tiempoActual = 0;
    const registros = [];
    const eventosCola = [];
    const eventosEspera = [];
    let idxLlegada = 0;

    const registrarCola = () => {
        eventosCola.push({ tiempo: tiempoActual, cola: cola.length });
    };

    while (idxLlegada < llegadasProgramadas.length || muellesArr.some(m => m !== null)) {
        let proxLlegada = idxLlegada < llegadasProgramadas.length ? llegadasProgramadas[idxLlegada] : Infinity;
        let proxFinServicio = Infinity;
        let muelleElegido = -1;
        for (let i = 0; i < muellesArr.length; i++) {
            if (muellesArr[i] && muellesArr[i].finServicio < proxFinServicio) {
                proxFinServicio = muellesArr[i].finServicio;
                muelleElegido = i;
            }
        }

        if (proxLlegada <= proxFinServicio) {
            tiempoActual = proxLlegada;
            const minutoDelDia = tiempoActual % minPorDia;
            let muelleLibre = -1;
            for (let i = 0; i < muellesArr.length; i++) {
                if (muellesArr[i] === null) { muelleLibre = i; break; }
            }
            if (muelleLibre !== -1 && minutoDelDia >= aperturaMin && minutoDelDia < cierreMin) {
                const tiempoServicio = Math.max(1, gaussianRandom(mediaServicio / factor, desvServicio / factor));
                const inicio = tiempoActual;
                const fin = inicio + tiempoServicio;
                muellesArr[muelleLibre] = { finServicio: fin, inicio, muelle: muelleLibre };
                registros.push({ llegada: tiempoActual, inicioServicio: inicio, finServicio: fin, espera: 0, muelle: muelleLibre });
            } else {
                cola.push({ llegada: tiempoActual });
            }
            idxLlegada++;
        } else {
            tiempoActual = proxFinServicio;
            muellesArr[muelleElegido] = null;
            const minutoDelDia = tiempoActual % minPorDia;
            while (cola.length > 0 && minutoDelDia >= aperturaMin && minutoDelDia < cierreMin) {
                let libre = -1;
                for (let i = 0; i < muellesArr.length; i++) {
                    if (muellesArr[i] === null) { libre = i; break; }
                }
                if (libre === -1) break;
                const siguiente = cola.shift();
                const espera = tiempoActual - siguiente.llegada;
                const tiempoServicio = Math.max(1, gaussianRandom(mediaServicio / factor, desvServicio / factor));
                const inicio = tiempoActual;
                const fin = inicio + tiempoServicio;
                muellesArr[libre] = { finServicio: fin, inicio, muelle: libre };
                registros.push({ llegada: siguiente.llegada, inicioServicio: inicio, finServicio: fin, espera, muelle: libre });
                eventosEspera.push({ tiempo: tiempoActual, espera });
            }
        }
        registrarCola();
    }

    return { registros, eventosCola, eventosEspera };
}

/**
 * Calcula KPIs a partir de los registros de simulación.
 */
export function calcularKPIs(registros, muelles) {
    if (registros.length === 0) return { error: "No se atendió ningún camión." };
    const leadTime = registros.map(r => r.finServicio - r.inicioServicio);
    const esperas = registros.map(r => r.espera);
    const totales = registros.map(r => r.finServicio - r.llegada);
    const tiempoTotalServicio = registros.reduce((acc, r) => acc + (r.finServicio - r.inicioServicio), 0);
    const tiempoSimulado = 24 * 60;
    const ocupMedia = (tiempoTotalServicio / (muelles * tiempoSimulado)) * 100;
    return {
        leadTimeMedio: mean(leadTime),
        esperaMedia: mean(esperas),
        estanciaMedia: mean(totales),
        ocupacionMuelles: ocupMedia.toFixed(1),
        numCamiones: registros.length
    };
}
