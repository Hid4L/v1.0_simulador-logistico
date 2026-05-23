// src/simulation/Muelle.js

/**
 * Representa un muelle de carga/descarga.
 * Puede estar libre u ocupado por un camión.
 */
export class Muelle {
    /**
     * @param {number} id - Identificador único del muelle (0, 1, 2...)
     */
    constructor(id) {
        this.id = id;
        this.ocupado = false;
        this.finServicio = null;   // minuto en que terminará el servicio actual
        this.inicioServicio = null; // minuto en que comenzó el servicio actual
        this.camion = null;        // referencia al camión que ocupa el muelle
    }

    /**
     * Asigna un camión al muelle.
     * @param {Object} camion - { llegada, ... }
     * @param {number} inicio - Minuto de inicio del servicio
     * @param {number} fin - Minuto de finalización del servicio
     */
    iniciarServicio(camion, inicio, fin) {
        this.ocupado = true;
        this.inicioServicio = inicio;
        this.finServicio = fin;
        this.camion = camion;
    }

    /**
     * Libera el muelle tras finalizar el servicio.
     */
    finalizarServicio() {
        this.ocupado = false;
        this.inicioServicio = null;
        this.finServicio = null;
        this.camion = null;
    }

    /**
     * Indica si el muelle está libre.
     * @returns {boolean}
     */
    estaLibre() {
        return !this.ocupado;
    }
}