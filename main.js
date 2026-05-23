// main.js - Punto de entrada de la aplicación
import { initUI } from './src/ui/ui.js';
import { initAnimacion } from './src/ui/animacion.js';

// Cuando el DOM esté listo, inicializa todo
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initAnimacion();
});
