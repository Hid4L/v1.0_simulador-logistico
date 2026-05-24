// src/ui/ui.js
import { parsearCSV, calcularEstadisticas, validarConflictosPorMuelle } from '../data/Parser.js';
import { ejecutarSimulacionDetallada, calcularKPIs } from '../simulation/Simulator.js';
import { dibujarGantt, dibujarCola, dibujarEsperaMedia } from '../charts/charts.js';
import { timeToMinutes, mean, percentil } from '../utils/math.js';
import { store, updateStore } from '../state/store.js';

// Variables para iteraciones y límites globales
let todasIteraciones = { A: [], B: [] };
let serieAgregadaCache = { colaA: null, colaB: null, esperaA: null, esperaB: null };
let limitesGlobales = { apertura: 480, cierre: 1080 }; // valor inicial de respaldo

// ========== Funciones auxiliares ==========
function sincronizarUIconStore() {
    const { A, B } = store.params;
    document.getElementById('paramMuellesA').value = A.muelles;
    document.getElementById('paramServicioMediaA').value = A.mediaServicio;
    document.getElementById('paramServicioDesvA').value = A.desvServicio;
    document.getElementById('paramAperturaA').value = minutesToTime(A.aperturaMin);
    document.getElementById('paramCierreA').value = minutesToTime(A.cierreMin);
    document.getElementById('paramLlegadasA').value = A.mediaLlegadas;
    document.getElementById('paramFactorA').value = A.factor;
    document.getElementById('paramModoLlegadaA').value = A.modoLlegada;
    document.getElementById('paramCantidadMinA').value = A.cantidadMin;
    document.getElementById('paramCantidadMaxA').value = A.cantidadMax;

    document.getElementById('paramMuellesB').value = B.muelles;
    document.getElementById('paramServicioMediaB').value = B.mediaServicio;
    document.getElementById('paramServicioDesvB').value = B.desvServicio;
    document.getElementById('paramAperturaB').value = minutesToTime(B.aperturaMin);
    document.getElementById('paramCierreB').value = minutesToTime(B.cierreMin);
    document.getElementById('paramLlegadasB').value = B.mediaLlegadas;
    document.getElementById('paramFactorB').value = B.factor;
    document.getElementById('paramModoLlegadaB').value = B.modoLlegada;
    document.getElementById('paramCantidadMinB').value = B.cantidadMin;
    document.getElementById('paramCantidadMaxB').value = B.cantidadMax;

    document.getElementById('paramModoLlegadaA').dispatchEvent(new Event('change'));
    document.getElementById('paramModoLlegadaB').dispatchEvent(new Event('change'));
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = Math.floor(minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function actualizarParamsDesdeStats() {
    const sA = store.stats.apro;
    const sE = store.stats.expe;
    if (!sA || !sE) return;

    const mediaLlegadas = (sA.mediaLlegadas && sE.mediaLlegadas)
        ? (sA.mediaLlegadas + sE.mediaLlegadas) / 2
        : (sA.mediaLlegadas || sE.mediaLlegadas || 20);
    const mediaServicio = (sA.mediaServicio && sE.mediaServicio)
        ? (sA.mediaServicio + sE.mediaServicio) / 2
        : (sA.mediaServicio || sE.mediaServicio || 30);
    const desvServicio = (sA.desvServicio && sE.desvServicio)
        ? (sA.desvServicio + sE.desvServicio) / 2
        : (sA.desvServicio || sE.desvServicio || 10);

    store.params.A.mediaServicio = Math.round(mediaServicio);
    store.params.A.desvServicio = Math.round(desvServicio);
    store.params.A.mediaLlegadas = Math.round(mediaLlegadas);
    store.params.B.mediaServicio = Math.round(mediaServicio);
    store.params.B.desvServicio = Math.round(desvServicio);
    store.params.B.mediaLlegadas = Math.round(mediaLlegadas);

    sincronizarUIconStore();
}

// ----- Cálculo de series agregadas (siempre usando límites globales) -----
function calcularSerieAgregadaCola(eventosPorIteracion, aperturaMin, cierreMin) {
    const paso = 5;
    const serie = [];
    for (let t = aperturaMin; t <= cierreMin; t += paso) {
        let suma = 0, count = 0;
        for (const eventos of eventosPorIteracion) {
            let valor = 0;
            for (let i = eventos.length - 1; i >= 0; i--) {
                if (eventos[i].tiempo <= t) {
                    valor = eventos[i].cola;
                    break;
                }
            }
            suma += valor;
            count++;
        }
        if (count > 0) serie.push({ x: t, y: suma / count });
    }
    return serie;
}

function calcularSerieAgregadaEspera(eventosPorIteracion, aperturaMin, cierreMin) {
    const paso = 5, ventana = 30;
    const serie = [];
    for (let t = aperturaMin; t <= cierreMin; t += paso) {
        let suma = 0, count = 0;
        for (const eventos of eventosPorIteracion) {
            const valores = eventos
                .filter(e => e.tiempo >= t - ventana && e.tiempo <= t)
                .map(e => e.espera);
            if (valores.length > 0) {
                suma += mean(valores);
                count++;
            }
        }
        if (count > 0) serie.push({ x: t, y: suma / count });
    }
    return serie;
}

function calcularOcupacionMuelles(todasIteraciones, numMuelles, aperturaMin, cierreMin) {
    const paso = 1;
    const ocupacionPorMuelle = Array.from({ length: numMuelles }, () => []);

    for (let t = aperturaMin; t <= cierreMin; t += paso) {
        for (let m = 0; m < numMuelles; m++) {
            let ocupadoCount = 0;
            for (const iter of todasIteraciones) {
                const regs = iter.registros.filter(r => r.muelle === m &&
                    r.inicioServicio <= t && r.finServicio > t);
                if (regs.length > 0) ocupadoCount++;
            }
            const porcentaje = (ocupadoCount / todasIteraciones.length) * 100;
            ocupacionPorMuelle[m].push({ x: t, y: porcentaje });
        }
    }
    return ocupacionPorMuelle;
}

function calcularAgregado(acum) {
    if (acum.leadTime.length === 0) return null;
    return {
        leadTime: {
            media: mean(acum.leadTime),
            p50: percentil(acum.leadTime, 0.5),
            p95: percentil(acum.leadTime, 0.95)
        },
        espera: {
            media: mean(acum.espera),
            p50: percentil(acum.espera, 0.5),
            p95: percentil(acum.espera, 0.95)
        },
        estancia: {
            media: mean(acum.estancia),
            p50: percentil(acum.estancia, 0.5),
            p95: percentil(acum.estancia, 0.95)
        },
        ocupacion: {
            media: mean(acum.ocupacion),
            p50: percentil(acum.ocupacion, 0.5),
            p95: percentil(acum.ocupacion, 0.95)
        },
        numCamiones: {
            media: mean(acum.numCamiones),
            p50: percentil(acum.numCamiones, 0.5),
            p95: percentil(acum.numCamiones, 0.95)
        }
    };
}

function mostrarKPIsAgregados(agregadoA, agregadoB, iteraciones) {
    const f = (val) => val !== undefined ? val.toFixed(2) : 'N/A';
    document.getElementById('kpiA').innerHTML = formatearAgregado(agregadoA, f);
    document.getElementById('kpiB').innerHTML = formatearAgregado(agregadoB, f);
    document.getElementById('kpisGrid').style.display = 'grid';
    const tituloDiv = document.getElementById('tituloKPIs');
    tituloDiv.style.display = 'block';
    tituloDiv.innerHTML = `<h3>Resultados agregados (${iteraciones} iteraciones)</h3>`;
}

function formatearAgregado(agregado, f) {
    if (!agregado) return '<p style="color:red">Sin datos</p>';
    return `
        <p><strong>Lead time (min):</strong> Media: ${f(agregado.leadTime.media)} | P50: ${f(agregado.leadTime.p50)} | P95: ${f(agregado.leadTime.p95)}</p>
        <p><strong>Espera en cola (min):</strong> Media: ${f(agregado.espera.media)} | P50: ${f(agregado.espera.p50)} | P95: ${f(agregado.espera.p95)}</p>
        <p><strong>Estancia total (min):</strong> Media: ${f(agregado.estancia.media)} | P50: ${f(agregado.estancia.p50)} | P95: ${f(agregado.estancia.p95)}</p>
        <p><strong>Ocupación (%):</strong> Media: ${f(agregado.ocupacion.media)} | P50: ${f(agregado.ocupacion.p50)} | P95: ${f(agregado.ocupacion.p95)}</p>
        <p><strong>Camiones atendidos:</strong> Media: ${f(agregado.numCamiones.media)} | P50: ${f(agregado.numCamiones.p50)} | P95: ${f(agregado.numCamiones.p95)}</p>
    `;
}

// Ahora recibe los límites para pasarlos a los gráficos
function actualizarGraficosLineas(idx, apertura, cierre) {
    if (todasIteraciones.A.length === 0 || todasIteraciones.B.length === 0) return;
    const iterA = todasIteraciones.A[idx];
    const iterB = todasIteraciones.B[idx];
    if (!iterA || !iterB) return;

    dibujarCola(
        iterA.eventosCola, serieAgregadaCache.colaA,
        iterB.eventosCola, serieAgregadaCache.colaB,
        apertura, cierre
    );
    dibujarEsperaMedia(
        iterA.eventosEspera, serieAgregadaCache.esperaA,
        iterB.eventosEspera, serieAgregadaCache.esperaB,
        apertura, cierre
    );
}

// ========== INICIALIZACIÓN ==========
export function initUI() {
    document.getElementById('simulacion').style.display = 'block';
    sincronizarUIconStore();

    const numIteracionesInput = document.getElementById('numIteraciones');
    const iteracionGraficoInput = document.getElementById('iteracionGrafico');

    numIteracionesInput.addEventListener('input', () => {
        const n = parseInt(numIteracionesInput.value) || 1;
        iteracionGraficoInput.disabled = n <= 1;
        iteracionGraficoInput.max = n;
        if (iteracionGraficoInput.value > n) iteracionGraficoInput.value = n;
    });

    // --- Procesar CSV (mantén el código que ya tienes) ---
    document.getElementById('btnProcesar').addEventListener('click', async () => {
        // ... (código de carga de CSV sin cambios)
    });

    // --- Limpiar conflictos (mantén el código) ---
    // --- Filtrar outliers (mantén el código) ---
    // --- Modos de llegada (setupModo) sin cambios ---

    // --- Ejecutar comparativa con iteraciones y límites globales ---
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

        // ====== Límites globales (mínima apertura, máximo cierre) ======
        const aperturaGlobal = Math.min(paramsA.aperturaMin, paramsB.aperturaMin);
        const cierreGlobal = Math.max(paramsA.cierreMin, paramsB.cierreMin);
        limitesGlobales = { apertura: aperturaGlobal, cierre: cierreGlobal };

        const numIteraciones = parseInt(numIteracionesInput.value) || 1;
        const acumA = { leadTime: [], espera: [], estancia: [], ocupacion: [], numCamiones: [] };
        const acumB = { leadTime: [], espera: [], estancia: [], ocupacion: [], numCamiones: [] };
        todasIteraciones = { A: [], B: [] };

        const btn = document.getElementById('btnSimular');
        btn.disabled = true;
        btn.textContent = 'Calculando...';

        setTimeout(() => {
            for (let i = 0; i < numIteraciones; i++) {
                const resA = ejecutarSimulacionDetallada(paramsA);
                const resB = ejecutarSimulacionDetallada(paramsB);
                const kpiA = calcularKPIs(resA.registros, paramsA.muelles);
                const kpiB = calcularKPIs(resB.registros, paramsB.muelles);

                if (kpiA.error || kpiB.error) continue;

                acumA.leadTime.push(kpiA.leadTimeMedio);
                acumA.espera.push(kpiA.esperaMedia);
                acumA.estancia.push(kpiA.estanciaMedia);
                acumA.ocupacion.push(parseFloat(kpiA.ocupacionMuelles));
                acumA.numCamiones.push(kpiA.numCamiones);

                acumB.leadTime.push(kpiB.leadTimeMedio);
                acumB.espera.push(kpiB.esperaMedia);
                acumB.estancia.push(kpiB.estanciaMedia);
                acumB.ocupacion.push(parseFloat(kpiB.ocupacionMuelles));
                acumB.numCamiones.push(kpiB.numCamiones);

                todasIteraciones.A.push(resA);
                todasIteraciones.B.push(resB);
            }

            // Calcular series agregadas con los límites globales
            serieAgregadaCache.colaA = calcularSerieAgregadaCola(
                todasIteraciones.A.map(r => r.eventosCola), aperturaGlobal, cierreGlobal
            );
            serieAgregadaCache.colaB = calcularSerieAgregadaCola(
                todasIteraciones.B.map(r => r.eventosCola), aperturaGlobal, cierreGlobal
            );
            serieAgregadaCache.esperaA = calcularSerieAgregadaEspera(
                todasIteraciones.A.map(r => r.eventosEspera), aperturaGlobal, cierreGlobal
            );
            serieAgregadaCache.esperaB = calcularSerieAgregadaEspera(
                todasIteraciones.B.map(r => r.eventosEspera), aperturaGlobal, cierreGlobal
            );

            // Ocupación por muelle
            const ocupacionA = calcularOcupacionMuelles(todasIteraciones.A, paramsA.muelles, aperturaGlobal, cierreGlobal);
            const ocupacionB = calcularOcupacionMuelles(todasIteraciones.B, paramsB.muelles, aperturaGlobal, cierreGlobal);

            // Datos para la animación
            window.seriesAgregadas = {
                colaA: serieAgregadaCache.colaA,
                colaB: serieAgregadaCache.colaB,
                esperaA: serieAgregadaCache.esperaA,
                esperaB: serieAgregadaCache.esperaB,
                ocupacionMuellesA: ocupacionA,
                ocupacionMuellesB: ocupacionB,
                params: {
                    aperturaMin: aperturaGlobal,
                    cierreMin: cierreGlobal,
                    muellesA: paramsA.muelles,
                    muellesB: paramsB.muelles
                }
            };

            const agregadoA = calcularAgregado(acumA);
            const agregadoB = calcularAgregado(acumB);
            mostrarKPIsAgregados(agregadoA, agregadoB, numIteraciones);

            iteracionGraficoInput.max = numIteraciones;
            iteracionGraficoInput.value = 1;
            iteracionGraficoInput.disabled = numIteraciones <= 1;

            if (todasIteraciones.A.length > 0) {
                dibujarGantt(
                    todasIteraciones.A[0].registros,
                    todasIteraciones.B[0].registros,
                    aperturaGlobal, cierreGlobal        // <-- límites globales
                );
                actualizarGraficosLineas(0, aperturaGlobal, cierreGlobal);  // <-- con límites globales
            }

            document.getElementById('graficos').style.display = 'block';
            document.getElementById('accionesAnimacion').style.display = 'block';
            updateStore({ params: { A: paramsA, B: paramsB } });

            btn.disabled = false;
            btn.textContent = 'Ejecutar comparativa';
        }, 10);
    });

    // --- Selector de iteración para gráficos ---
    iteracionGraficoInput.addEventListener('input', () => {
        const idx = parseInt(iteracionGraficoInput.value) - 1;
        if (idx < 0 || !todasIteraciones.A[idx]) return;
        dibujarGantt(
            todasIteraciones.A[idx].registros,
            todasIteraciones.B[idx].registros,
            limitesGlobales.apertura, limitesGlobales.cierre   // <-- usa los globales guardados
        );
        actualizarGraficosLineas(idx, limitesGlobales.apertura, limitesGlobales.cierre);
    });

    // --- Exportar CSV (adaptado a iteraciones) ---
    document.getElementById('btnExportar').addEventListener('click', () => {
        const numIteraciones = parseInt(numIteracionesInput.value) || 1;
        let kpiA, kpiB;
        if (numIteraciones > 1 && todasIteraciones.A.length > 0) {
            const acumA = { leadTime: [], espera: [], estancia: [], ocupacion: [], numCamiones: [] };
            const acumB = { leadTime: [], espera: [], estancia: [], ocupacion: [], numCamiones: [] };
            for (let i = 0; i < todasIteraciones.A.length; i++) {
                const kA = calcularKPIs(todasIteraciones.A[i].registros, store.params.A.muelles);
                const kB = calcularKPIs(todasIteraciones.B[i].registros, store.params.B.muelles);
                if (!kA.error) {
                    acumA.leadTime.push(kA.leadTimeMedio);
                    acumA.espera.push(kA.esperaMedia);
                    acumA.estancia.push(kA.estanciaMedia);
                    acumA.ocupacion.push(parseFloat(kA.ocupacionMuelles));
                    acumA.numCamiones.push(kA.numCamiones);
                }
                if (!kB.error) {
                    acumB.leadTime.push(kB.leadTimeMedio);
                    acumB.espera.push(kB.esperaMedia);
                    acumB.estancia.push(kB.estanciaMedia);
                    acumB.ocupacion.push(parseFloat(kB.ocupacionMuelles));
                    acumB.numCamiones.push(kB.numCamiones);
                }
            }
            kpiA = calcularAgregado(acumA);
            kpiB = calcularAgregado(acumB);
        } else if (todasIteraciones.A.length === 1) {
            const resA = todasIteraciones.A[0];
            const resB = todasIteraciones.B[0];
            kpiA = calcularKPIs(resA.registros, store.params.A.muelles);
            kpiB = calcularKPIs(resB.registros, store.params.B.muelles);
        } else {
            alert('Primero ejecuta la simulación.');
            return;
        }

        const csv = [
            'Indicador,Escenario A,Escenario B',
            `Muelles,${store.params.A.muelles},${store.params.B.muelles}`,
            `Servicio medio (min),${store.params.A.mediaServicio},${store.params.B.mediaServicio}`,
            `Modo llegadas,${store.params.A.modoLlegada},${store.params.B.modoLlegada}`,
            `Camiones atendidos (media),${kpiA?.numCamiones?.media || kpiA?.numCamiones || 'N/A'},${kpiB?.numCamiones?.media || kpiB?.numCamiones || 'N/A'}`,
            `Lead time medio,${kpiA?.leadTime?.media?.toFixed(2) || kpiA?.leadTimeMedio?.toFixed(2) || 'N/A'},${kpiB?.leadTime?.media?.toFixed(2) || kpiB?.leadTimeMedio?.toFixed(2) || 'N/A'}`,
            `Espera media,${kpiA?.espera?.media?.toFixed(2) || kpiA?.esperaMedia?.toFixed(2) || 'N/A'},${kpiB?.espera?.media?.toFixed(2) || kpiB?.esperaMedia?.toFixed(2) || 'N/A'}`,
            `Estancia media,${kpiA?.estancia?.media?.toFixed(2) || kpiA?.estanciaMedia?.toFixed(2) || 'N/A'},${kpiB?.estancia?.media?.toFixed(2) || kpiB?.estanciaMedia?.toFixed(2) || 'N/A'}`,
            `Ocupación (%),${kpiA?.ocupacion?.media?.toFixed(1) || kpiA?.ocupacionMuelles || 'N/A'},${kpiB?.ocupacion?.media?.toFixed(1) || kpiB?.ocupacionMuelles || 'N/A'}`
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'resultados_simulacion.csv'; a.click();
        URL.revokeObjectURL(url);
    });
}

