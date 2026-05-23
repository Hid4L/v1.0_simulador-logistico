import { parsearCSV, calcularEstadisticas, validarConflictosPorMuelle } from '../data/Parser.js';
import { ejecutarSimulacionDetallada, calcularKPIs } from '../simulation/Simulator.js';
import { dibujarGantt, dibujarCola, dibujarEsperaMedia } from '../charts/charts.js';
import { timeToMinutes } from '../utils/math.js';

let datosCompletosApro = null, datosCompletosExpe = null;
let statsGlobal = {
    mediaLlegadasApro: 20, mediaServicioApro: 30, desvServicioApro: 10,
    mediaLlegadasExpe: 20, mediaServicioExpe: 30, desvServicioExpe: 10
};

function actualizarStatsGlobalYCampos(sA, sE) {
    const mediasLleg = (sA.mediaLlegadas && sE.mediaLlegadas) ? (sA.mediaLlegadas + sE.mediaLlegadas) / 2 : (sA.mediaLlegadas || sE.mediaLlegadas || 20);
    const mediasServ = (sA.mediaServicio && sE.mediaServicio) ? (sA.mediaServicio + sE.mediaServicio) / 2 : (sA.mediaServicio || sE.mediaServicio || 30);
    const desvServ = (sA.desvServicio && sE.desvServicio) ? (sA.desvServicio + sE.desvServicio) / 2 : (sA.desvServicio || sE.desvServicio || 10);
    statsGlobal = {
        mediaLlegadasApro: sA.mediaLlegadas || mediasLleg,
        mediaServicioApro: sA.mediaServicio || mediasServ,
        desvServicioApro: sA.desvServicio || desvServ,
        mediaLlegadasExpe: sE.mediaLlegadas || mediasLleg,
        mediaServicioExpe: sE.mediaServicio || mediasServ,
        desvServicioExpe: sE.desvServicio || desvServ
    };
    document.getElementById('paramServicioMediaA').value = Math.round(mediasServ);
    document.getElementById('paramServicioDesvA').value = Math.round(desvServ);
    document.getElementById('paramLlegadasA').value = Math.round(mediasLleg);
    document.getElementById('paramServicioMediaB').value = Math.round(mediasServ);
    document.getElementById('paramServicioDesvB').value = Math.round(desvServ);
    document.getElementById('paramLlegadasB').value = Math.round(mediasLleg);
}

export function initUI() {
    document.getElementById('simulacion').style.display = 'block';
    
    // Procesar CSV
    document.getElementById('btnProcesar').addEventListener('click', async () => {
        const archivoApro = document.getElementById('csvApro').files[0];
        const archivoExpe = document.getElementById('csvExpe').files[0];
        if (!archivoApro && !archivoExpe) { alert('Selecciona al menos un archivo CSV'); return; }
        try {
            let datosApro = [], datosExpe = [];
            if (archivoApro) datosApro = await parsearCSV(archivoApro);
            if (archivoExpe) datosExpe = await parsearCSV(archivoExpe);
            datosCompletosApro = datosApro;
            datosCompletosExpe = datosExpe;

            const conflictosApro = datosApro.length ? validarConflictosPorMuelle(datosApro) : [];
            const conflictosExpe = datosExpe.length ? validarConflictosPorMuelle(datosExpe) : [];
            const totalConflictos = [...conflictosApro, ...conflictosExpe];
            const conflictosInfoDiv = document.getElementById('conflictosInfo');
            if (totalConflictos.length > 0) {
                let html = `<p>Se detectaron <strong>${totalConflictos.length} solapamiento(s)</strong>:</p><table><tr><th>Muelle</th><th>Inicio-Fin anterior</th><th>Inicio siguiente</th><th>Solape (min)</th></tr>`;
                totalConflictos.forEach(c => {
                    const ini1 = c.anterior.inicio.toLocaleTimeString('es-ES', { hour12: false });
                    const fin1 = c.anterior.fin.toLocaleTimeString('es-ES', { hour12: false });
                    const ini2 = c.siguiente.inicio.toLocaleTimeString('es-ES', { hour12: false });
                    html += `<tr><td>${c.muelle}</td><td>${ini1}-${fin1}</td><td>${ini2}</td><td>${c.solapamiento.toFixed(2)}</td></tr>`;
                });
                html += '</table>';
                conflictosInfoDiv.innerHTML = html;
                document.getElementById('btnLimpiarConflictos').style.display = 'inline-block';
                document.getElementById('validacionConflictos').style.display = 'block';
            } else {
                document.getElementById('validacionConflictos').style.display = 'none';
                document.getElementById('btnLimpiarConflictos').style.display = 'none';
            }

            const statsApro = calcularEstadisticas(datosCompletosApro, 'Aprovisionamiento', 0);
            const statsExpe = calcularEstadisticas(datosCompletosExpe, 'Expediciones', 0);
            document.getElementById('statsApro').innerHTML = statsApro.html || '';
            document.getElementById('statsExpe').innerHTML = statsExpe.html || '';
            document.getElementById('resultados').style.display = 'block';
            document.getElementById('filtroOutliers').style.display = 'block';
            actualizarStatsGlobalYCampos(statsApro, statsExpe);
        } catch (error) { console.error(error); alert('Error al procesar archivos.'); }
    });

    // Limpiar conflictos
    document.getElementById('btnLimpiarConflictos').addEventListener('click', () => {
        if (!datosCompletosApro && !datosCompletosExpe) return;
        const idsApro = new Set(), idsExpe = new Set();
        if (datosCompletosApro) {
            validarConflictosPorMuelle(datosCompletosApro).forEach(c => { idsApro.add(c.anterior.fila); idsApro.add(c.siguiente.fila); });
            datosCompletosApro = datosCompletosApro.filter(f => !idsApro.has(f));
        }
        if (datosCompletosExpe) {
            validarConflictosPorMuelle(datosCompletosExpe).forEach(c => { idsExpe.add(c.anterior.fila); idsExpe.add(c.siguiente.fila); });
            datosCompletosExpe = datosCompletosExpe.filter(f => !idsExpe.has(f));
        }
        document.getElementById('validacionConflictos').style.display = 'none';
        document.getElementById('btnLimpiarConflictos').style.display = 'none';
        const sA = calcularEstadisticas(datosCompletosApro || [], 'Aprovisionamiento', 0);
        const sE = calcularEstadisticas(datosCompletosExpe || [], 'Expediciones', 0);
        document.getElementById('statsApro').innerHTML = sA.html || '';
        document.getElementById('statsExpe').innerHTML = sE.html || '';
        actualizarStatsGlobalYCampos(sA, sE);
    });

    // Filtrar outliers
    document.getElementById('btnFiltrar').addEventListener('click', () => {
        if (!datosCompletosApro && !datosCompletosExpe) { alert('Primero procesa los CSV.'); return; }
        const umbral = parseInt(document.getElementById('umbralOutlier').value) || 0;
        const sA = calcularEstadisticas(datosCompletosApro || [], 'Aprovisionamiento', umbral);
        const sE = calcularEstadisticas(datosCompletosExpe || [], 'Expediciones', umbral);
        document.getElementById('statsApro').innerHTML = sA.html || '';
        document.getElementById('statsExpe').innerHTML = sE.html || '';
        let htmlOut = '';
        const todosOutliers = [...(sA.outliers || []).map(o => ({ area: 'Aprovisionamiento', ...o })), ...(sE.outliers || []).map(o => ({ area: 'Expediciones', ...o }))];
        if (todosOutliers.length > 0) {
            htmlOut = `<p><strong>Casos atípicos (${todosOutliers.length}):</strong></p><table><tr><th>Área</th><th>Llegada</th><th>Servicio (min)</th><th>Muelle</th></tr>`;
            todosOutliers.forEach(o => { htmlOut += `<tr><td>${o.area}</td><td>${o.llegada.toLocaleString('es-ES', { hour12: false })}</td><td>${o.tiempoServicio.toFixed(2)}</td><td>${o.muelle || '-'}</td></tr>`; });
            htmlOut += '</table>';
        } else htmlOut = '<p>No se encontraron casos atípicos con ese umbral.</p>';
        document.getElementById('outliersInfo').innerHTML = htmlOut;
        if (sA.mediaServicio !== undefined && sE.mediaServicio !== undefined) actualizarStatsGlobalYCampos(sA, sE);
    });

    // Modos de llegada A/B
    function setupModo(selectId, frecId, minId, maxId) {
        const select = document.getElementById(selectId);
        const frec = document.getElementById(frecId);
        const min = document.getElementById(minId);
        const max = document.getElementById(maxId);
        function toggle() {
            if (select.value === 'frecuencia') {
                frec.style.display = ''; min.style.display = 'none'; max.style.display = 'none';
            } else {
                frec.style.display = 'none'; min.style.display = ''; max.style.display = '';
            }
        }
        select.addEventListener('change', toggle);
        toggle();
    }
    setupModo('paramModoLlegadaA', 'labelFrecuenciaA', 'labelCantidadMinA', 'labelCantidadMaxA');
    setupModo('paramModoLlegadaB', 'labelFrecuenciaB', 'labelCantidadMinB', 'labelCantidadMaxB');

    // Simular
    document.getElementById('btnSimular').addEventListener('click', () => {
        const paramsA = {
            muelles: +document.getElementById('paramMuellesA').value,
            mediaServicio: +document.getElementById('paramServicioMediaA').value,
            desvServicio: +document.getElementById('paramServicioDesvA').value,
            aperturaMin: timeToMinutes(document.getElementById('paramAperturaA').value),
            cierreMin: timeToMinutes(document.getElementById('paramCierreA').value),
            mediaLlegadas: +document.getElementById('paramLlegadasA').value || 20,
            factor: +document.getElementById('paramFactorA').value,
            modoLlegada: document.getElementById('paramModoLlegadaA').value,
            cantidadMin: +document.getElementById('paramCantidadMinA').value || 10,
            cantidadMax: +document.getElementById('paramCantidadMaxA').value || 15
        };
        const paramsB = {
            muelles: +document.getElementById('paramMuellesB').value,
            mediaServicio: +document.getElementById('paramServicioMediaB').value,
            desvServicio: +document.getElementById('paramServicioDesvB').value,
            aperturaMin: timeToMinutes(document.getElementById('paramAperturaB').value),
            cierreMin: timeToMinutes(document.getElementById('paramCierreB').value),
            mediaLlegadas: +document.getElementById('paramLlegadasB').value || 20,
            factor: +document.getElementById('paramFactorB').value,
            modoLlegada: document.getElementById('paramModoLlegadaB').value,
            cantidadMin: +document.getElementById('paramCantidadMinB').value || 10,
            cantidadMax: +document.getElementById('paramCantidadMaxB').value || 15
        };

        const resA = ejecutarSimulacionDetallada(paramsA);
        const resB = ejecutarSimulacionDetallada(paramsB);
        const kpiA = calcularKPIs(resA.registros, paramsA.muelles);
        const kpiB = calcularKPIs(resB.registros, paramsB.muelles);

        document.getElementById('kpiA').innerHTML = kpiA.error ? `<p style="color:red">${kpiA.error}</p>` : `<p>Camiones: ${kpiA.numCamiones}</p><p>Lead time medio: ${kpiA.leadTimeMedio.toFixed(2)} min</p><p>Espera media: ${kpiA.esperaMedia.toFixed(2)} min</p><p>Estancia total: ${kpiA.estanciaMedia.toFixed(2)} min</p><p>Ocupación: ${kpiA.ocupacionMuelles}%</p>`;
        document.getElementById('kpiB').innerHTML = kpiB.error ? `<p style="color:red">${kpiB.error}</p>` : `<p>Camiones: ${kpiB.numCamiones}</p><p>Lead time medio: ${kpiB.leadTimeMedio.toFixed(2)} min</p><p>Espera media: ${kpiB.esperaMedia.toFixed(2)} min</p><p>Estancia total: ${kpiB.estanciaMedia.toFixed(2)} min</p><p>Ocupación: ${kpiB.ocupacionMuelles}%</p>`;
        document.getElementById('kpisGrid').style.display = 'grid';
        dibujarGantt(resA.registros, resB.registros, paramsA.aperturaMin, paramsA.cierreMin);
        dibujarCola(resA.eventosCola, resB.eventosCola, paramsA.aperturaMin, paramsA.cierreMin);
        dibujarEsperaMedia(resA.eventosEspera, resB.eventosEspera, paramsA.aperturaMin, paramsA.cierreMin);
        document.getElementById('graficos').style.display = 'block';
        document.getElementById('accionesAnimacion').style.display = 'block';
        window.ultimosResultados = {
            kpiA, kpiB, paramsA, paramsB,
            registrosA: resA.registros,
            eventosColaA: resA.eventosCola,
            eventosEsperaA: resA.eventosEspera,
            registrosB: resB.registros,
            eventosColaB: resB.eventosCola,
            eventosEsperaB: resB.eventosEspera
        };
    });

    // Exportar
    document.getElementById('btnExportar').addEventListener('click', () => {
        if (!window.ultimosResultados) return alert('Primero ejecuta la simulación.');
        const { kpiA, kpiB, paramsA, paramsB } = window.ultimosResultados;
        const csv = [
            'Indicador,Escenario A,Escenario B',
            `Muelles,${paramsA.muelles},${paramsB.muelles}`,
            `Servicio medio (min),${paramsA.mediaServicio},${paramsB.mediaServicio}`,
            `Modo llegadas,${paramsA.modoLlegada},${paramsB.modoLlegada}`,
            `Camiones atendidos,${kpiA.numCamiones},${kpiB.numCamiones}`,
            `Lead time medio,${kpiA.leadTimeMedio?.toFixed(2)||'N/A'},${kpiB.leadTimeMedio?.toFixed(2)||'N/A'}`,
            `Espera media,${kpiA.esperaMedia?.toFixed(2)||'N/A'},${kpiB.esperaMedia?.toFixed(2)||'N/A'}`,
            `Estancia media,${kpiA.estanciaMedia?.toFixed(2)||'N/A'},${kpiB.estanciaMedia?.toFixed(2)||'N/A'}`,
            `Ocupación (%),${kpiA.ocupacionMuelles||'N/A'},${kpiB.ocupacionMuelles||'N/A'}`
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'resultados_simulacion.csv'; a.click();
        URL.revokeObjectURL(url);
    });
}
