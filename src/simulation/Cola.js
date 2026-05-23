// src/simulation/Cola.js

/**
 * Cola FIFO para camiones en espera.
 * Permite persistir entre días (el backlog se mantiene).
 */
export class Cola {
    constructor() {
        this.items = [];
    }

    /**
     * Añade un camión al final de la cola.
     * @param {Object} camion - { llegada: number (minuto), ... }
     */
    encolar(camion) {
        this.items.push(camion);
    }

    /**
     * Extrae el primer camión de la cola.
     * @returns {Object|null} El camión o null si la cola está vacía.
     */
    desencolar() {
        return this.items.shift() || null;
    }

    /**
     * Longitud actual de la cola.
     * @returns {number}
     */
    longitud() {
        return this.items.length;
    }

    /**
     * Vacía la cola (útil al reiniciar simulación).
     */
    vaciar() {
        this.items = [];
    }

    /**
     * Devuelve una copia de los elementos (para depuración).
     * @returns {Array}
     */
    obtenerItems() {
        return [...this.items];
    }
}