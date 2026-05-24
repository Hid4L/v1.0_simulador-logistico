// src/ui/animacion.js
import { formatMinutos } from '../utils/math.js';

let animacionInterval = null;
let tiempoSimulacion = 0;
let reproduciendo = false;
const ICONO_CAMION = '🚛';

export function initAnimacion() {
    document.getElementById('btnVerAnimacion').addEventListener('click', iniciarAnimacion);
    document.getElementById('btnPlayPause').addEventListener('click', togglePlay);
    document.getElementById('btnRebobinar').addEventListener('click', rebobinar);
    document.getElementById('sliderTiempo').addEventListener('input', (e) => {
        tiempoSimulacion = parseInt(e.target.value);
        actualizarAnimacion(tiempoSimulacion);
    });
}

function iniciarAnimacion() {
    if (!window.seriesAgregadas) {
        alert('Primero ejecuta una simulación.');
        return;
    }
    document.getElementById('animacion').style.display = 'block';
    tiempoSimulacion = window.seriesAgregadas.params.aperturaMin;
    construirUI();
    actualizarSlider();
    actualizarAnimacion(tiempoSimulacion);
}

function construirUI() {
    const grid = document.getElementById('animacionGrid');
    grid.innerHTML = '';
    const { params } = window.seriesAgregadas;

    ['A', 'B'].forEach(esc => {
        const numMuelles = esc === 'A' ? params.muellesA : params.muellesB;
        const carril = document.createElement('div');
        carril.className = 'carril-animacion';
        carril.id = `carril${esc}`;
        carril.innerHTML = `
            <div class="zona-llegada" style="width: 120px; flex-direction: column; align-items: center;">
                <span>🕒 Cola media</span>
                <div style="font-size: 1.5rem; font-weight: bold;" id="colaMedia${esc}">0</div>
                <span style="font-size: 0.7rem;">camiones</span>
                <div style="margin-top: 0.5rem;">
                    <span>⏱️ Espera media</span>
                    <div class="reloj-espera" style="font-size: 1rem; padding: 2px 6px;" id="esperaMedia${esc}">00:00</div>
                </div>
            </div>
            <div class="zona-muelles" id="muelles${esc}">
                ${Array.from({ length: numMuelles }, (_, i) => `
                    <div class="muelle-columna" style="width: 80px;">
                        <div class="muelle-numero">M${i+1}</div>
                        <div id="camion${esc}-${i}" style="font-size: 2rem; text-align: center; margin-top: 10px;"></div>
                        <div style="font-size: 0.7rem; text-align: center;" id="porcentaje${esc}-${i}">0%</div>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(carril);
    });
}

function actualizarAnimacion(minutoAbs) {
    const { colaA, colaB, esperaA, esperaB, ocupacionMuellesA, ocupacionMuellesB, params } = window.seriesAgregadas;
    document.getElementById('colaMediaA').textContent = obtenerValorEnMinuto(colaA, minutoAbs).toFixed(1);
    document.getElementById('colaMediaB').textContent = obtenerValorEnMinuto(colaB, minutoAbs).toFixed(1);
    document.getElementById('esperaMediaA').textContent = formatMinutos(obtenerValorEnMinuto(esperaA, minutoAbs));
    document.getElementById('esperaMediaB').textContent = formatMinutos(obtenerValorEnMinuto(esperaB, minutoAbs));

    actualizarMuelles('A', ocupacionMuellesA, minutoAbs, params.muellesA);
    actualizarMuelles('B', ocupacionMuellesB, minutoAbs, params.muellesB);

    document.getElementById('tiempoActual').textContent = formatMinutos(minutoAbs);
}

function actualizarMuelles(esc, ocupacionMuelles, minutoAbs, numMuelles) {
    for (let m = 0; m < numMuelles; m++) {
        const serie = ocupacionMuelles[m];
        const ocupacion = obtenerValorEnMinuto(serie, minutoAbs);
        const camionDiv = document.getElementById(`camion${esc}-${m}`);
        const porcentajeDiv = document.getElementById(`porcentaje${esc}-${m}`);
        if (camionDiv) camionDiv.textContent = ocupacion > 75 ? ICONO_CAMION : '';
        if (porcentajeDiv) porcentajeDiv.textContent = ocupacion.toFixed(0) + '%';
    }
}

function obtenerValorEnMinuto(serie, minuto) {
    if (!serie || serie.length === 0) return 0;
    let valor = 0;
    for (let i = serie.length - 1; i >= 0; i--) {
        if (serie[i].x <= minuto) {
            valor = serie[i].y;
            break;
        }
    }
    return valor;
}

function actualizarSlider() {
    const slider = document.getElementById('sliderTiempo');
    slider.min = window.seriesAgregadas.params.aperturaMin;
    slider.max = window.seriesAgregadas.params.cierreMin;
    slider.value = tiempoSimulacion;
}

function togglePlay() {
    if (reproduciendo) {
        clearInterval(animacionInterval);
        document.getElementById('btnPlayPause').textContent = '▶️';
    } else {
        animacionInterval = setInterval(() => {
            const { aperturaMin, cierreMin } = window.seriesAgregadas.params;
            if (tiempoSimulacion >= cierreMin) {
                clearInterval(animacionInterval);
                reproduciendo = false;
                document.getElementById('btnPlayPause').textContent = '▶️';
                return;
            }
            tiempoSimulacion++;
            actualizarSlider();
            actualizarAnimacion(tiempoSimulacion);
        }, 50);
        document.getElementById('btnPlayPause').textContent = '⏸️';
    }
    reproduciendo = !reproduciendo;
}

function rebobinar() {
    if (reproduciendo) togglePlay();
    tiempoSimulacion = window.seriesAgregadas.params.aperturaMin;
    actualizarSlider();
    actualizarAnimacion(tiempoSimulacion);
}
