// src/charts/charts.js
import { mean, formatMinutos } from '../utils/math.js';

let colaChart = null, esperaChart = null;

// Parámetros visuales del Gantt (HTML+CSS)
const ALTURA_FILA = 18;
const TAMANIO_FUENTE = 11;
const GROSOR_BARRA = 14;

// ==================== GANTT (HTML+CSS, sin canvas) ====================
export function dibujarGantt(registrosA, registrosB, aperturaMin, cierreMin) {
    const contenedor = document.getElementById('contenedorGantt');
    if (!contenedor) {
        console.error('No se encontró #contenedorGantt');
        return;
    }
    contenedor.innerHTML = '';

    const ganttHTML = document.createElement('div');
    ganttHTML.className = 'gantt-html';
    ganttHTML.style.cssText = `
        display: flex; flex-direction: column; gap: 2px;
        font-family: Arial, sans-serif; font-size: 11px; width: 100%;
        overflow-y: auto; max-height: 500px;
    `;

    const duracionTotal = cierreMin - aperturaMin;

    function crearFila(label, registros, color) {
        const fila = document.createElement('div');
        fila.style.cssText = 'display: flex; align-items: center; min-height: 20px;';
        const etiqueta = document.createElement('div');
        etiqueta.style.cssText = 'width: 100px; text-align: right; padding-right: 8px; font-weight: 600; font-size: 11px; flex-shrink: 0;';
        etiqueta.textContent = label;
        fila.appendChild(etiqueta);
        const barraContainer = document.createElement('div');
        barraContainer.style.cssText = 'flex: 1; height: 14px; background: #f0f0f0; border-radius: 3px; position: relative; overflow: visible;';
        registros.forEach(r => {
            const left = ((r.inicioServicio - aperturaMin) / duracionTotal) * 100;
            const width = ((r.finServicio - r.inicioServicio) / duracionTotal) * 100;
            const barra = document.createElement('div');
            barra.style.cssText = `position: absolute; left: ${left}%; width: ${Math.max(width, 0.5)}%; height: 100%; background: ${color}; border-radius: 2px; opacity: 0.8; min-width: 2px;`;
            barra.title = `Inicio: ${formatMinutos(r.inicioServicio)} - Fin: ${formatMinutos(r.finServicio)} (${Math.round(r.finServicio - r.inicioServicio)} min)`;
            barraContainer.appendChild(barra);
        });
        fila.appendChild(barraContainer);
        return fila;
    }

    const maxMuelles = Math.max(...[...registrosA, ...registrosB].map(r => r.muelle), 0) + 1;

    const tituloA = document.createElement('div');
    tituloA.style.cssText = 'font-weight: bold; color: #0070C0; margin-top: 8px; margin-bottom: 4px;';
    tituloA.textContent = 'Escenario A';
    ganttHTML.appendChild(tituloA);
    for (let m = 0; m < maxMuelles; m++) {
        const regs = registrosA.filter(r => r.muelle === m);
        if (regs.length) ganttHTML.appendChild(crearFila(`A Muelle ${m + 1}`, regs, '#0070C0'));
    }

    const tituloB = document.createElement('div');
    tituloB.style.cssText = 'font-weight: bold; color: #FFB81C; margin-top: 12px; margin-bottom: 4px;';
    tituloB.textContent = 'Escenario B';
    ganttHTML.appendChild(tituloB);
    for (let m = 0; m < maxMuelles; m++) {
        const regs = registrosB.filter(r => r.muelle === m);
        if (regs.length) ganttHTML.appendChild(crearFila(`B Muelle ${m + 1}`, regs, '#FFB81C'));
    }

    contenedor.appendChild(ganttHTML);
}

// ==================== COLA (4 series con Chart.js) ====================
export function dibujarCola(eventosActualA, eventosAgregadoA, eventosActualB, eventosAgregadoB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('colaCanvas').getContext('2d');
    if (colaChart) colaChart.destroy();

    const datasets = [];
    if (eventosActualA) datasets.push({ label: 'Cola A (actual)', data: eventosActualA.map(e => ({ x: e.tiempo, y: e.cola })), borderColor: '#0070C0', backgroundColor: 'transparent', borderWidth: 2, stepped: true });
    if (eventosAgregadoA && eventosAgregadoA.length) datasets.push({ label: 'Cola A (agregada)', data: eventosAgregadoA, borderColor: '#0070C0', borderDash: [5, 3], backgroundColor: 'transparent', borderWidth: 2, stepped: false, tension: 0.2 });
    if (eventosActualB) datasets.push({ label: 'Cola B (actual)', data: eventosActualB.map(e => ({ x: e.tiempo, y: e.cola })), borderColor: '#FFB81C', backgroundColor: 'transparent', borderWidth: 2, stepped: true });
    if (eventosAgregadoB && eventosAgregadoB.length) datasets.push({ label: 'Cola B (agregada)', data: eventosAgregadoB, borderColor: '#FFB81C', borderDash: [5, 3], backgroundColor: 'transparent', borderWidth: 2, stepped: false, tension: 0.2 });

    colaChart = new Chart(ctx, {
        type: 'line', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: { type: 'linear', min: aperturaMin, max: cierreMin, title: { display: true, text: 'Hora del día' }, ticks: { callback: val => formatMinutos(val) } },
                y: { title: { display: true, text: 'Camiones en cola' }, beginAtZero: true }
            }
        }
    });
}

// ==================== ESPERA MEDIA (4 series con Chart.js) ====================
export function dibujarEsperaMedia(eventosActualA, eventosAgregadoA, eventosActualB, eventosAgregadoB, aperturaMin, cierreMin) {
    const ctx = document.getElementById('esperaCanvas').getContext('2d');
    if (esperaChart) esperaChart.destroy();

    const datasets = [];
    if (eventosActualA) datasets.push({ label: 'Espera media A (actual)', data: calcularPuntosEspera(eventosActualA, aperturaMin, cierreMin), borderColor: '#0070C0', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
    if (eventosAgregadoA && eventosAgregadoA.length) datasets.push({ label: 'Espera media A (agregada)', data: eventosAgregadoA, borderColor: '#0070C0', borderDash: [5, 3], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
    if (eventosActualB) datasets.push({ label: 'Espera media B (actual)', data: calcularPuntosEspera(eventosActualB, aperturaMin, cierreMin), borderColor: '#FFB81C', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
    if (eventosAgregadoB && eventosAgregadoB.length) datasets.push({ label: 'Espera media B (agregada)', data: eventosAgregadoB, borderColor: '#FFB81C', borderDash: [5, 3], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });

    esperaChart = new Chart(ctx, {
        type: 'line', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: { type: 'linear', min: aperturaMin, max: cierreMin, title: { display: true, text: 'Hora del día' }, ticks: { callback: val => formatMinutos(val) } },
                y: { title: { display: true, text: 'Minutos de espera' }, beginAtZero: true }
            }
        }
    });
}

function calcularPuntosEspera(eventos, inicio, fin) {
    const ventana = 30, paso = 5;
    const puntos = [];
    for (let t = inicio; t <= fin; t += paso) {
        const inicioV = t - ventana;
        const finV = t;
        const valores = eventos.filter(e => e.tiempo >= inicioV && e.tiempo <= finV).map(e => e.espera);
        if (valores.length > 0) puntos.push({ x: t, y: mean(valores) });
    }
    return puntos;
}

