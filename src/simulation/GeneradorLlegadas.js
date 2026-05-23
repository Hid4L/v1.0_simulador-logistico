// src/simulation/GeneradorLlegadas.js

/**
 * Genera los tiempos de llegada de camiones para un día de simulación,
 * según el modo configurado (frecuencia exponencial o cantidad diaria fija)
 * y respetando los turnos definidos.
 */
export class GeneradorLlegadas {
    /**
     * @param {string} modo - 'frecuencia' o 'cantidad'
     * @param {Object} params - Parámetros según modo
     * @param {Array<Turno>} turnos - Lista de turnos del día
     */
    constructor(modo, params, turnos) {
        this.modo = modo;
        this.params = params; // { mediaLlegadas } o { cantidadMin, cantidadMax }
        this.turnos = turnos;
    }

    /**
     * Genera el array de tiempos de llegada (en minutos) para un día.
     * @returns {number[]} Array ordenado de minutos de llegada.
     */
    generar() {
        if (this.modo === 'frecuencia') {
            return this._generarFrecuencia();
        } else {
            return this._generarCantidad();
        }
    }

    /**
     * Genera llegadas con distribución exponencial, dentro de los turnos.
     */
    _generarFrecuencia() {
        const llegadas = [];
        const media = this.params.mediaLlegadas || 20;

        // Recorremos todos los turnos y generamos llegadas dentro de cada uno
        for (const turno of this.turnos) {
            let t = turno.horaInicio;
            while (t < turno.horaFin) {
                const intervalo = -Math.log(Math.random()) * media;
                t += intervalo;
                if (t >= turno.horaFin) break;
                llegadas.push(t);
            }
        }

        return llegadas.sort((a, b) => a - b);
    }

    /**
     * Genera una cantidad fija (o rango) de llegadas, distribuidas uniformemente
     * dentro de los turnos.
     */
    _generarCantidad() {
        const llegadas = [];
        const min = this.params.cantidadMin || 10;
        const max = this.params.cantidadMax || 15;
        const cantidad = Math.floor(Math.random() * (max - min + 1)) + min;

        // Duración total de todos los turnos
        const duracionTotal = this.turnos.reduce((acc, t) => acc + t.duracion(), 0);

        for (let i = 0; i < cantidad; i++) {
            // Elegir un punto aleatorio dentro de la duración total
            const punto = Math.random() * duracionTotal;
            // Mapear ese punto a un minuto absoluto del día
            const minutoAbs = this._puntoAMinuto(punto);
            if (minutoAbs !== null) {
                llegadas.push(minutoAbs);
            }
        }

        return llegadas.sort((a, b) => a - b);
    }

    /**
     * Convierte un punto (0..duraciónTotal) a un minuto absoluto del día,
     * recorriendo los turnos.
     */
    _puntoAMinuto(punto) {
        let acumulado = 0;
        for (const turno of this.turnos) {
            const duracion = turno.duracion();
            if (punto <= acumulado + duracion) {
                return turno.horaInicio + (punto - acumulado);
            }
            acumulado += duracion;
        }
        return null; // no debería ocurrir si el punto está bien calculado
    }
}