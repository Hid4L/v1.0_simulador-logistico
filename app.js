// =======================================================
// app.js - Simulador Logístico Fase 2 (con espera media, animación y correcciones)
// =======================================================

// ---------- Funciones de parseo ----------
function combinarFechaHora(fechaStr, horaStr) {
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

// ---------- Utilidades ----------
function gaussianRandom(media, desv) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return media + desv * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function timeToMinutes(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
function formatMinutos(minutos) {
    const h = Math.floor(minutos / 60);
    const m = Math.floor(minutos % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ---------- Motor de simulación detallada (1 día) ----------
function ejecutarSimulacionDetallada(params) {
    const { muelles, mediaServicio, desvServicio, aperturaMin, cierreMin, mediaLlegadas, factor, modoLlegada, cantidadMin, cantidadMax } = params;
    const minPorDia = 24 * 60;
    let llegadasProgramadas = [];

    if (modoLlegada === 'frecuencia') {
        let t = aperturaMin; // Empieza en horario de apertura
        while (t < cierreMin) {
            const intervalo = -Math.log(Math.random()) * mediaLlegadas;
            t += intervalo;
            if (t >= cierreMin) break;
            llegadasProgramadas.push(t);
        }
    } else {
        const numCamiones = Math.floor(Math.random() * (cantidadMax - cantidadMin + 1)) + cantidadMin;
        const duracion = cierreMin - aperturaMin;
        for (let i = 0; i < numCamiones; i++) {
            llegadasProgramadas.push(aperturaMin + Math.random() * duracion);
        }
        llegadasProgramadas.sort((a, b) => a - b);
    }

    const cola = [];
    const muellesArr = new Array(muelles).fill(null);
    let tiempoActual = 0;
    const registros = [];
    const eventosCola = [];
    const eventosEspera = []; // { tiempo, espera }
    let idxLlegada = 0;

    const registrarCola = () => {
        eventosCola.push({ tiempo: tiempoActual, cola: cola.length });
    };

    while (idxLlegada < llegadasProgramadas.length || muellesArr.some(m => m !== null)) {
        let proxLlegada = idxLlegada < llegadasProgramadas.length ? llegadasProgramadas[idxLlegada] : Infinity;
        let proxFinServicio = Infinity;
        let muelleElegido = -1;
        for (let i = 0; i < muellesArr.length; i++) {
            if (muellesArr[i] && muellesArr[i].finServicio < proxFinServicio) {
                proxFinServicio = muellesArr[i].finServicio;
                muelleElegido = i;
            }
        }

        if (proxLlegada <= proxFinServicio) {
            tiempoActual = proxLlegada;
            const minutoDelDia = tiempoActual % minPorDia;
            let muelleLibre = -1;
            for (let i = 0; i < muellesArr.length; i++) {
                if (muellesArr[i] === null) { muelleLibre = i; break; }
            }
            if (muelleLibre !== -1 && minutoDelDia >= aperturaMin && minutoDelDia < cierreMin) {
                const tiempoServicio = Math.max(1, gaussianRandom(mediaServicio / factor, desvServicio / factor));
                const inicio = tiempoActual;
                const fin = inicio + tiempoServicio;
                muellesArr[muelleLibre] = { finServicio: fin, inicio, muelle: muelleLibre };
                registros.push({ llegada: tiempoActual, inicioServicio: inicio, finServicio: fin, espera: 0, muelle: muelleLibre });
            } else {
                cola.push({ llegada: tiempoActual });
            }
            idxLlegada++;
        } else {
            tiempoActual = proxFinServicio;
            muellesArr[muelleElegido] = null;
            const minutoDelDia = tiempoActual % minPorDia;
            while (cola.length > 0 && minutoDelDia >= aperturaMin && minutoDelDia < cierreMin) {
                let libre = -1;
                for (let i = 0; i < muellesArr.length; i++) {
                    if (muellesArr[i] === null) { libre = i; break; }
                }
                if (libre === -1) break;
                const siguiente = cola.shift();
                const espera = tiempoActual - siguiente.llegada;
                const tiempoServicio = Math.max(1, gaussianRandom(mediaServicio / factor, desvServicio / factor));
                const inicio = tiempoActual;
                const fin = inicio + tiempoServicio;
                muellesArr[libre] = { finServicio: fin, inicio, muelle: libre };
                registros.push({ llegada: siguiente.llegada, inicioServicio: inicio, finServicio: fin, espera, muelle: libre });
                eventosEspera.push({ tiempo: tiempoActual, espera }); // registrar fin de espera
            }
        }
        registrarCola();
    }

    return { registros, eventosCola, eventosEspera };
}

function calcularKPIs(registros, muelles) {
    if (registros.length === 0) return { error: "No se atendió ningún camión." };
    const leadTime = registros.map(r => r.finServicio - r.inicioServicio);
    const esperas = registros.map(r => r.espera);
    const totales = registros.map(r => r.finServicio - r.llegada);
    const tiempoTotalServicio = registros.reduce((acc, r) => acc + (r.finServicio - r.inicioServicio), 0);
    const tiempoSimulado = 24 * 60;
    const ocupMedia = (tiempoTotalServicio / (muelles * tiempoSimulado)) * 100;
    return {
        leadTimeMedio: mean(leadTime),
        esperaMedia: mean(esperas),
        estanciaMedia: mean(totales),
        ocupacionMuelles: ocupMedia.toFixed(1),
        numCamiones: registros.length
    };
}

// ---------- Gráficos ----------
let ganttChart = null, colaChart = null, esperaChart = null;

function dibujarGantt(registrosA, registrosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('ganttCanvas').getContext('2d');
    if (ganttChart) ganttChart.destroy();

    const datasets = [];
    const maxMuelles = Math.max(...[...registrosA, ...registrosB].map(r => r.muelle), 0) + 1;

    for (let m = 0; m < maxMuelles; m++) {
        const datosA = registrosA.filter(r => r.muelle === m).map(r => ({ x: [r.inicioServicio, r.finServicio], y: `A-M${m+1}` }));
        if (datosA.length) datasets.push({
            label: `A Muelle ${m+1}`,
            data: datosA,
            backgroundColor: 'rgba(0,112,192,0.6)',
            borderColor: '#0070C0',
            borderWidth: 1,
            borderSkipped: false,
            barThickness: 20,
            maxBarThickness: 20
        });
    }
    for (let m = 0; m < maxMuelles; m++) {
        const datosB = registrosB.filter(r => r.muelle === m).map(r => ({ x: [r.inicioServicio, r.finServicio], y: `B-M${m+1}` }));
        if (datosB.length) datasets.push({
            label: `B Muelle ${m+1}`,
            data: datosB,
            backgroundColor: 'rgba(255,184,28,0.6)',
            borderColor: '#FFB81C',
            borderWidth: 1,
            borderSkipped: false,
            barThickness: 20,
            maxBarThickness: 20
        });
    }

    // Calcular altura necesaria
    const filasTotales = datasets.length; // cada dataset es una fila (muelle + escenario)
    const alturaMinima = Math.max(300, filasTotales * 35 + 60); // 35px por fila + márgenes

    // Ajustar el contenedor del canvas
    const contenedor = document.getElementById('ganttCanvas').parentElement;
    contenedor.style.height = alturaMinima + 'px';

    ganttChart = new Chart(ctx, {
        type: 'bar',
        data: { datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: {
                    type: 'linear',
                    min: aperturaMin,
                    max: cierreMin,
                    title: { display: true, text: 'Hora del día' },
                    ticks: { callback: val => formatMinutos(val) }
                }
            }
        }
    });
}


function dibujarCola(eventosA, eventosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('colaCanvas').getContext('2d');
    if (colaChart) colaChart.destroy();

    const datosA = eventosA.map(e => ({ x: e.tiempo, y: e.cola }));
    const datosB = eventosB.map(e => ({ x: e.tiempo, y: e.cola }));

    colaChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Cola A',
                    data: datosA,
                    borderColor: '#0070C0',
                    backgroundColor: 'rgba(0,112,192,0.1)',
                    fill: true,
                    stepped: true
                },
                {
                    label: 'Cola B',
                    data: datosB,
                    borderColor: '#FFB81C',
                    backgroundColor: 'rgba(255,184,28,0.1)',
                    fill: true,
                    stepped: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: {
                    type: 'linear',
                    min: aperturaMin,
                    max: cierreMin,
                    title: { display: true, text: 'Hora del día' },
                    ticks: { callback: val => formatMinutos(val) }
                },
                y: { title: { display: true, text: 'Camiones en cola' }, beginAtZero: true }
            }
        }
    });
}

function dibujarEsperaMedia(eventosA, eventosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('esperaCanvas').getContext('2d');
    if (esperaChart) esperaChart.destroy();

    const ventana = 30; // minutos
    const paso = 5;
    const datosA = [];
    const datosB = [];

    function calcularMediaMovil(eventos, inicio, fin, paso, ventana) {
        const puntos = [];
        for (let t = inicio; t <= fin; t += paso) {
            const inicioVentana = t - ventana;
            const finVentana = t;
            const valores = eventos
                .filter(e => e.tiempo >= inicioVentana && e.tiempo <= finVentana)
                .map(e => e.espera);
            if (valores.length > 0) {
                puntos.push({ x: t, y: mean(valores) });
            }
        }
        return puntos;
    }

    if (eventosA && eventosA.length > 0) {
        datosA.push(...calcularMediaMovil(eventosA, aperturaMin, cierreMin, paso, ventana));
    }
    if (eventosB && eventosB.length > 0) {
        datosB.push(...calcularMediaMovil(eventosB, aperturaMin, cierreMin, paso, ventana));
    }

    esperaChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Espera media A (min)',
                    data: datosA,
                    borderColor: '#0070C0',
                    backgroundColor: 'rgba(0,112,192,0.1)',
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Espera media B (min)',
                    data: datosB,
                    borderColor: '#FFB81C',
                    backgroundColor: 'rgba(255,184,28,0.1)',
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: {
                    type: 'linear',
                    min: aperturaMin,
                    max: cierreMin,
                    title: { display: true, text: 'Hora del día' },
                    ticks: { callback: val => formatMinutos(val) }
                },
                y: { title: { display: true, text: 'Minutos de espera' }, beginAtZero: true }
            }
        }
    });
}

// ---------- DOMContentLoaded ----------
document.addEventListener('DOMContentLoaded', () => {
    // Elementos generales
    const btnProcesar = document.getElementById('btnProcesar');
    const inputApro = document.getElementById('csvApro');
    const inputExpe = document.getElementById('csvExpe');
    const resultadosDiv = document.getElementById('resultados');
    const statsAproDiv = document.getElementById('statsApro');
    const statsExpeDiv = document.getElementById('statsExpe');
    const validacionDiv = document.getElementById('validacionConflictos');
    const conflictosInfoDiv = document.getElementById('conflictosInfo');
    const btnLimpiar = document.getElementById('btnLimpiarConflictos');
    const filtroDiv = document.getElementById('filtroOutliers');
    const btnFiltrar = document.getElementById('btnFiltrar');
    const outliersInfoDiv = document.getElementById('outliersInfo');
    const simulacionDiv = document.getElementById('simulacion');
    const btnSimular = document.getElementById('btnSimular');
    const btnExportar = document.getElementById('btnExportar');
    const kpisGrid = document.getElementById('kpisGrid');
    const graficosDiv = document.getElementById('graficos');
    const accionesAnimacionDiv = document.getElementById('accionesAnimacion');

    // Mostrar simulación desde el inicio
    simulacionDiv.style.display = 'block';

    let datosCompletosApro = null, datosCompletosExpe = null;
    let statsGlobal = {
        mediaLlegadasApro: 20, mediaServicioApro: 30, desvServicioApro: 10,
        mediaLlegadasExpe: 20, mediaServicioExpe: 30, desvServicioExpe: 10
    };

    function parsearCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, { header: true, skipEmptyLines: true, dynamicTyping: false, complete: r => resolve(r.data), error: reject });
        });
    }

    function calcularEstadisticas(datos, nombreArea, umbralOutlier = 0) {
        if (datos.length === 0) return { html: `<p><strong>${nombreArea}:</strong> sin datos.</p>`, tiemposServicio: [], outliers: [] };
        const llegadas = [], tiemposServicio = [], outliers = [];
        for (let fila of datos) {
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

    function validarConflictosPorMuelle(datos) {
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

    // Procesar CSV
    btnProcesar.addEventListener('click', async () => {
        const archivoApro = inputApro.files[0], archivoExpe = inputExpe.files[0];
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
                btnLimpiar.style.display = 'inline-block';
                validacionDiv.style.display = 'block';
            } else {
                validacionDiv.style.display = 'none';
                btnLimpiar.style.display = 'none';
            }

            const statsApro = calcularEstadisticas(datosCompletosApro, 'Aprovisionamiento', 0);
            const statsExpe = calcularEstadisticas(datosCompletosExpe, 'Expediciones', 0);
            statsAproDiv.innerHTML = statsApro.html || '';
            statsExpeDiv.innerHTML = statsExpe.html || '';
            resultadosDiv.style.display = 'block';
            filtroDiv.style.display = 'block';
            actualizarStatsGlobalYCampos(statsApro, statsExpe);
        } catch (error) { console.error(error); alert('Error al procesar archivos.'); }
    });

    // Limpiar conflictos
    btnLimpiar.addEventListener('click', () => {
        if (!datosCompletosApro && !datosCompletosExpe) return;
        const idsApro = new Set(), idsExpe = new Set();
        if (datosCompletosApro) {
            const conflictos = validarConflictosPorMuelle(datosCompletosApro);
            conflictos.forEach(c => { idsApro.add(c.anterior.fila); idsApro.add(c.siguiente.fila); });
            datosCompletosApro = datosCompletosApro.filter(f => !idsApro.has(f));
        }
        if (datosCompletosExpe) {
            const conflictos = validarConflictosPorMuelle(datosCompletosExpe);
            conflictos.forEach(c => { idsExpe.add(c.anterior.fila); idsExpe.add(c.siguiente.fila); });
            datosCompletosExpe = datosCompletosExpe.filter(f => !idsExpe.has(f));
        }
        validacionDiv.style.display = 'none';
        btnLimpiar.style.display = 'none';
        const sA = calcularEstadisticas(datosCompletosApro || [], 'Aprovisionamiento', 0);
        const sE = calcularEstadisticas(datosCompletosExpe || [], 'Expediciones', 0);
        statsAproDiv.innerHTML = sA.html || '';
        statsExpeDiv.innerHTML = sE.html || '';
        actualizarStatsGlobalYCampos(sA, sE);
    });

    // Aplicar filtro outliers
    btnFiltrar.addEventListener('click', () => {
        if (!datosCompletosApro && !datosCompletosExpe) { alert('Primero procesa los CSV.'); return; }
        const umbral = parseInt(document.getElementById('umbralOutlier').value) || 0;
        const sA = calcularEstadisticas(datosCompletosApro || [], 'Aprovisionamiento', umbral);
        const sE = calcularEstadisticas(datosCompletosExpe || [], 'Expediciones', umbral);
        statsAproDiv.innerHTML = sA.html || '';
        statsExpeDiv.innerHTML = sE.html || '';
        let htmlOut = '';
        const todosOutliers = [...(sA.outliers || []).map(o => ({ area: 'Aprovisionamiento', ...o })), ...(sE.outliers || []).map(o => ({ area: 'Expediciones', ...o }))];
        if (todosOutliers.length > 0) {
            htmlOut = `<p><strong>Casos atípicos (${todosOutliers.length}):</strong></p><table><tr><th>Área</th><th>Llegada</th><th>Servicio (min)</th><th>Muelle</th></tr>`;
            todosOutliers.forEach(o => { htmlOut += `<tr><td>${o.area}</td><td>${o.llegada.toLocaleString('es-ES', { hour12: false })}</td><td>${o.tiempoServicio.toFixed(2)}</td><td>${o.muelle || '-'}</td></tr>`; });
            htmlOut += '</table>';
        } else htmlOut = '<p>No se encontraron casos atípicos con ese umbral.</p>';
        outliersInfoDiv.innerHTML = htmlOut;
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

    // Ejecutar comparativa
    btnSimular.addEventListener('click', () => {
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
        kpisGrid.style.display = 'grid';
        dibujarGantt(resA.registros, resB.registros, paramsA.aperturaMin, paramsA.cierreMin);
        dibujarCola(resA.eventosCola, resB.eventosCola, paramsA.aperturaMin, paramsA.cierreMin);
        dibujarEsperaMedia(resA.eventosEspera, resB.eventosEspera, paramsA.aperturaMin, paramsA.cierreMin);
        graficosDiv.style.display = 'block';

        // Mostrar botón de animación y guardar datos
        accionesAnimacionDiv.style.display = 'block';
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

    // Exportar CSV
    btnExportar.addEventListener('click', () => {
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
});
