// src/simulation/Evento.js

/**
 * Representa un evento discreto en la simulación.
 * Cada evento tiene un tipo, un tiempo absoluto (minutos) y datos asociados.
 */
export class Evento {
    /**
     * @param {string} tipo - Tipo de evento (llegada, inicioServicio, finServicio, cambioTurno)
     * @param {number} tiempo - Minuto del día en que ocurre el evento (0-1439)
     * @param {Object} [datos] - Información adicional (camión, muelle, etc.)
     */
    constructor(tipo, tiempo, datos = {}) {
        this.tipo = tipo;
        this.tiempo = tiempo;
        this.datos = datos;
    }
}

// Tipos de eventos como constantes
export const TipoEvento = {
    LLEGADA: 'llegada',
    INICIO_SERVICIO: 'inicioServicio',
    FIN_SERVICIO: 'finServicio',
    CAMBIO_TURNO: 'cambioTurno'
};