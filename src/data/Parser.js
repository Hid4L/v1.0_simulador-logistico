// src/data/Parser.js
import { mean } from '../utils/math.js';

// Función de parseo de fecha (antes era global, ahora la exportamos)
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

/**
 * Procesa un archivo CSV usando PapaParse (Promise).
 */
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
 * Calcula estadísticas básicas de los datos de un área.
 * umbralOutlier: 0 = no filtrar; >0 = excluir servicios mayores a ese valor.
 */
export function calcularEstadisticas(datos, nombreArea, umbralOutlier = 0) {
    if (datos.length === 0) return { html: `<p><strong>${nombreArea}:</strong> sin datos.</p>`, tiemposServicio: [], outliers: [] };
    const llegadas = [], tiemposServicio = [], outliers = [];
    for (let fila of datos) {
        // Buscar columnas posibles
        const fechaStr = fila['Inicio planif.carga'] || fila['Inicio planif.carga '] || fila['inicio planif.carga'] || fila['INICIO PLANIF.CARGA'] || '';
        const horaLlegadaStr = fila['Hora actual registro'] || fila['Hora actual registro '] || fila['hora actual registro'] || fila['HORA ACTUAL REGISTRO'] || '';
        const horaInicioStr = fila['Hora act.inic.carga'] || fila['Hora act.inic.carga '] || fila['hora act.inic.carga'] || fila['HORA ACT.INIC.CARGA'] || '';
        const horaFinStr = fila['Hora Fin carga transporte no planificado'] || fila['Hora Fin carga transporte no planificado '] || fila['hora fin carga transporte no planificado'] || fila['HORA FIN CARGA TRANSPORTE NO PLANIFICADO'] || '';
        const muelle = fila['Muelle de carga'] || fila['Muelle de carga '] || fila['muelle de carga'] || fila['MUELLE DE CARGA'] || '';
        if (!fechaStr || !horaLlegadaStr || !horaInicioStr || !horaFinStr) continue;
        const llegada = combinarFechaHora(fechaStr, horaLlegadaStr);
        const inicio = combinarFechaHora(fechaStr, horaInicioStr);
        const fin = combinarFechaHora(fechaStr, horaFinStr);
        if (!llegada || !inicio || !fin) continue;
        const servicio = (fin - inicio) / 60000;
        if (servicio < 0) continue;
        if (umbralOutlier > 0 && servicio > umbralOutlier) {
            outliers.push({ llegada, inicioCarga: inicio, finCarga: fin, tiempoServicio: servicio, muelle });
        } else {
            llegadas.push(llegada);
            tiemposServicio.push(servicio);
        }
    }
    if (llegadas.length === 0 && outliers.length === 0) return { html: `<p><strong>${nombreArea}:</strong> sin registros parseables.</p>`, tiemposServicio: [], outliers: [] };
    if (llegadas.length === 0) {
        let html = `<h3>${nombreArea}</h3><p>0 registros válidos (todos outliers).</p><p>Outliers: ${outliers.length}</p>`;
        return { html, tiemposServicio: [], outliers };
    }
    llegadas.sort((a, b) => a - b);
    const ints = [];
    for (let i = 1; i < llegadas.length; i++) ints.push((llegadas[i] - llegadas[i-1]) / 60000);
    const mediaLleg = ints.length ? mean(ints) : 0;
    const mediaServ = mean(tiemposServicio);
    const desvServ = tiemposServicio.length > 1 ? Math.sqrt(tiemposServicio.map(t => (t-mediaServ)**2).reduce((a,b)=>a+b)/(tiemposServicio.length-1)) : 0;
    let html = `<h3>${nombreArea}</h3><p>Registros válidos: ${llegadas.length}</p>`;
    if (umbralOutlier > 0) html += `<p>Outliers excluidos: ${outliers.length}</p>`;
    html += `<p>Media entre llegadas: ${mediaLleg.toFixed(2)} min</p>`;
    html += `<p>Servicio medio: ${mediaServ.toFixed(2)} min · Desv: ${desvServ.toFixed(2)} min</p>`;
    return { html, tiemposServicio, outliers, mediaLlegadas: mediaLleg, mediaServicio: mediaServ, desvServicio: desvServ };
}

/**
 * Valida conflictos de solapamiento en un mismo muelle.
 */
export function validarConflictosPorMuelle(datos) {
    const porMuelle = {};
    for (let fila of datos) {
        const fechaStr = fila['Inicio planif.carga'] || fila['Inicio planif.carga '] || '';
        const horaInicioStr = fila['Hora act.inic.carga'] || fila['Hora act.inic.carga '] || '';
        const horaFinStr = fila['Hora Fin carga transporte no planificado'] || fila['Hora Fin carga transporte no planificado '] || '';
        const muelle = fila['Muelle de carga'] || fila['Muelle de carga '] || '';
        if (!fechaStr || !horaInicioStr || !horaFinStr || !muelle) continue;
        const inicio = combinarFechaHora(fechaStr, horaInicioStr);
        const fin = combinarFechaHora(fechaStr, horaFinStr);
        if (!inicio || !fin) continue;
        if (!porMuelle[muelle]) porMuelle[muelle] = [];
        porMuelle[muelle].push({ inicio, fin, fila });
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
