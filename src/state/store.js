// src/state/store.js
export const store = {
    rawData: { apro: null, expe: null },
    stats: { apro: null, expe: null },
    params: {
        A: {
            muelles: 3,
            mediaServicio: 30,
            desvServicio: 10,
            aperturaMin: 480,
            cierreMin: 1080,
            mediaLlegadas: 20,
            factor: 1,
            modoLlegada: 'frecuencia',
            cantidadMin: 10,
            cantidadMax: 15
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
            cantidadMax: 15
        }
    },
    results: { A: null, B: null }
};

export function updateStore(newState) {
    Object.assign(store, newState);
}