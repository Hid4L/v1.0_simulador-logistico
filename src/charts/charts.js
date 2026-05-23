// src/charts/charts.js
import { mean, formatMinutos } from '../utils/math.js';

let ganttChart = null, colaChart = null, esperaChart = null;

export function dibujarGantt(registrosA, registrosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('ganttCanvas').getContext('2d');
    if (ganttChart) ganttChart.destroy();

    const datasets = [];
    const maxMuelles = Math.max(...[...registrosA, ...registrosB].map(r => r.muelle), 0) + 1;

    for (let m = 0; m < maxMuelles; m++) {
        const datosA = registrosA.filter(r => r.muelle === m).map(r => ({ x: [r.inicioServicio, r.finServicio], y: `A-M${m+1}` }));
        if (datosA.length) datasets.push({ label: `A Muelle ${m+1}`, data: datosA, backgroundColor: 'rgba(0,112,192,0.6)', borderColor: '#0070C0', borderWidth: 1, borderSkipped: false, barThickness: 20, maxBarThickness: 20 });
    }
    for (let m = 0; m < maxMuelles; m++) {
        const datosB = registrosB.filter(r => r.muelle === m).map(r => ({ x: [r.inicioServicio, r.finServicio], y: `B-M${m+1}` }));
        if (datosB.length) datasets.push({ label: `B Muelle ${m+1}`, data: datosB, backgroundColor: 'rgba(255,184,28,0.6)', borderColor: '#FFB81C', borderWidth: 1, borderSkipped: false, barThickness: 20, maxBarThickness: 20 });
    }

    const filas = datasets.length;
    const alturaPorFila = 35;
    const alturaExtra = 80;
    const alturaMinima = Math.max(300, filas * alturaPorFila + alturaExtra);
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
            layout: { padding: { left: 10, right: 10, top: 5, bottom: 5 } },
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

    setTimeout(() => { if (ganttChart) ganttChart.resize(); }, 100);
}

export function dibujarCola(eventosA, eventosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('colaCanvas').getContext('2d');
    if (colaChart) colaChart.destroy();

    const datosA = eventosA.map(e => ({ x: e.tiempo, y: e.cola }));
    const datosB = eventosB.map(e => ({ x: e.tiempo, y: e.cola }));

    colaChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Cola A', data: datosA, borderColor: '#0070C0', backgroundColor: 'rgba(0,112,192,0.1)', fill: true, stepped: true },
                { label: 'Cola B', data: datosB, borderColor: '#FFB81C', backgroundColor: 'rgba(255,184,28,0.1)', fill: true, stepped: true }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: { type: 'linear', min: aperturaMin, max: cierreMin, title: { display: true, text: 'Hora del día' }, ticks: { callback: val => formatMinutos(val) } },
                y: { title: { display: true, text: 'Camiones en cola' }, beginAtZero: true }
            }
        }
    });
}

export function dibujarEsperaMedia(eventosA, eventosB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('esperaCanvas').getContext('2d');
    if (esperaChart) esperaChart.destroy();

    const ventana = 30;
    const paso = 5;
    const datosA = [];
    const datosB = [];

    function calcularMediaMovil(eventos, inicio, fin, paso, ventana) {
        const puntos = [];
        for (let t = inicio; t <= fin; t += paso) {
            const inicioVentana = t - ventana;
            const finVentana = t;
            const valores = eventos.filter(e => e.tiempo >= inicioVentana && e.tiempo <= finVentana).map(e => e.espera);
            if (valores.length > 0) puntos.push({ x: t, y: mean(valores) });
        }
        return puntos;
    }

    if (eventosA && eventosA.length > 0) datosA.push(...calcularMediaMovil(eventosA, aperturaMin, cierreMin, paso, ventana));
    if (eventosB && eventosB.length > 0) datosB.push(...calcularMediaMovil(eventosB, aperturaMin, cierreMin, paso, ventana));

    esperaChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Espera media A (min)', data: datosA, borderColor: '#0070C0', backgroundColor: 'rgba(0,112,192,0.1)', fill: false, tension: 0.3 },
                { label: 'Espera media B (min)', data: datosB, borderColor: '#FFB81C', backgroundColor: 'rgba(255,184,28,0.1)', fill: false, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: { type: 'linear', min: aperturaMin, max: cierreMin, title: { display: true, text: 'Hora del día' }, ticks: { callback: val => formatMinutos(val) } },
                y: { title: { display: true, text: 'Minutos de espera' }, beginAtZero: true }
            }
        }
    });
}
