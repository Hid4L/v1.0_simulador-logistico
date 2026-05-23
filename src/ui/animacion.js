
import { formatMinutos } from '../utils/math.js';

let animacionInterval = null;
let tiempoSimulacion = 0;
let reproduciendo = false;
let duracionTotal = 1440;
let datosAnimacion = null;
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
    if (!window.ultimosResultados) {
        alert('Primero ejecuta una simulación.');
        return;
    }
    document.getElementById('animacion').style.display = 'block';
    datosAnimacion = window.ultimosResultados;
    duracionTotal = 1440;
    tiempoSimulacion = 0;
    construirUI();
    actualizarSlider();
    actualizarAnimacion(tiempoSimulacion);
}

function construirUI() {
    const grid = document.getElementById('animacionGrid');
    grid.innerHTML = '';
    ['A', 'B'].forEach(esc => {
        const params = esc === 'A' ? datosAnimacion.paramsA : datosAnimacion.paramsB;
        const muelles = params.muelles;
        const carril = document.createElement('div');
        carril.className = 'carril-animacion';
        carril.id = `carril${esc}`;
        carril.innerHTML = `
            <div class="zona-llegada">
                <span>🕒 Llegadas</span>
                <div class="cola-container" id="cola${esc}"></div>
            </div>
            <div class="zona-muelles" id="muelles${esc}">
                ${Array.from({ length: muelles }, (_, i) => `
                    <div class="muelle-columna" id="muelle${esc}-${i}">
                        <div class="muelle-numero">M${i+1}</div>
                        <div class="camion-emergente" id="camion${esc}-${i}"></div>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(carril);
    });
}

function actualizarAnimacion(minuto) {
    ['A', 'B'].forEach(esc => {
        const registros = esc === 'A' ? datosAnimacion.registrosA : datosAnimacion.registrosB;
        const muelles = esc === 'A' ? datosAnimacion.paramsA.muelles : datosAnimacion.paramsB.muelles;

        for (let i = 0; i < muelles; i++) {
            document.getElementById(`camion${esc}-${i}`).textContent = '';
        }
        const colaDiv = document.getElementById(`cola${esc}`);
        colaDiv.innerHTML = '';
        const enCola = [];
        registros.forEach(r => {
            if (r.llegada <= minuto && r.inicioServicio > minuto) {
                enCola.push({ llegada: r.llegada, espera: minuto - r.llegada });
            } else if (r.inicioServicio <= minuto && r.finServicio > minuto) {
                const el = document.getElementById(`camion${esc}-${r.muelle}`);
                if (el) el.textContent = ICONO_CAMION;
            }
        });
        enCola.sort((a, b) => a.llegada - b.llegada);
        enCola.forEach(c => {
            const item = document.createElement('div');
            item.className = 'camion-en-cola';
            item.innerHTML = `${ICONO_CAMION} <span class="reloj-espera">${formatMinutos(c.espera)}</span>`;
            colaDiv.appendChild(item);
        });
    });
    document.getElementById('tiempoActual').textContent = formatMinutos(minuto);
}

function actualizarSlider() {
    document.getElementById('sliderTiempo').max = duracionTotal;
    document.getElementById('sliderTiempo').value = tiempoSimulacion;
}

function togglePlay() {
    if (reproduciendo) {
        clearInterval(animacionInterval);
        document.getElementById('btnPlayPause').textContent = '▶️';
    } else {
        animacionInterval = setInterval(() => {
            if (tiempoSimulacion >= duracionTotal) {
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
    tiempoSimulacion = 0;
    actualizarSlider();
    actualizarAnimacion(tiempoSimulacion);
}
