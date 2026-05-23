// src/utils/math.js

/**
 * Genera un número aleatorio con distribución normal (Gaussiana)
 * usando el método de Box-Muller.
 */
export function gaussianRandom(media, desv) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return media + desv * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calcula la media aritmética de un array.
 */
export function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Convierte una cadena "HH:MM" a minutos totales.
 */
export function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Formatea un número de minutos a cadena "HH:MM".
 */
export function formatMinutos(minutos) {
    const h = Math.floor(minutos / 60);
    const m = Math.floor(minutos % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calcula un percentil específico de un array ordenado.
 */
export function percentil(arr, q) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const resto = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + resto * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
}

