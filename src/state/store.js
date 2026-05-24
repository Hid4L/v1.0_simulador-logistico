// src/state/store.js

export const store = {
    rawData: { apro: null, expe: null },
    stats: { apro: null, expe: null },
    params: {
        A: {
            muelles: 3,
            mediaServicio: 30,
            desvServicio: 10,
            aperturaMin: 480,         // 08:00
            cierreMin: 1080,          // 18:00
            mediaLlegadas: 20,
            factor: 1,
            modoLlegada: 'frecuencia',
            cantidadMin: 10,
            cantidadMax: 15,
            // --- nuevos parámetros avanzados ---
            porcentajeFurgo: 0,
            llegadaInicioMin: 480,    // 08:00
            llegadaFinMin: 1080,      // 18:00
            horasPicoStr: '',         // se guarda como string, el simulador lo parsea
            refuerzoInicio: 600,      // 10:00
            refuerzoFin: 840,         // 14:00
            muellesExtra: 0,
            riesgoAveria: 0,
            duracionReparacion: 60
        },
        B: {
            muelles: 5,
            mediaServicio: 30,
            desvServicio: 10,
            aperturaMin: 480,
            cierreMin: 1080,
            mediaLlegadas: 20,
            factor: 1,
            modoLlegada: 'frecuencia',
            cantidadMin: 10,
            cantidadMax: 15,
            // --- nuevos parámetros avanzados ---
            porcentajeFurgo: 0,
            llegadaInicioMin: 480,
            llegadaFinMin: 1080,
            horasPicoStr: '',
            refuerzoInicio: 600,
            refuerzoFin: 840,
            muellesExtra: 0,
            riesgoAveria: 0,
            duracionReparacion: 60
        }
    },
    results: { A: null, B: null }
};

export function updateStore(newState) {
    Object.assign(store, newState);
}
