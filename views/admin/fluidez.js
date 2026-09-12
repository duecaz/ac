// SECCIÓN «Fluidez» del panel admin — la Fase 0 del plan de rendimiento
// (`docs/handoff-rendimiento-animaciones.md`) puesta donde se puede usar.
//
// Por qué está aquí y no solo en un MD: la medida hay que tomarla EN LA PIZARRA
// del aula (1280x720 CSS a DPR 3, GPU modesta), y quien la va a tomar tiene el
// panel abierto y el dedo en la pantalla, no el repositorio delante. Esta
// sección enciende el medidor en la propia página y dice QUÉ escenas medir y
// qué número es aceptable, para que la tabla «antes» se pueda rellenar sin
// tener que acordarse de nada.
//
// No mide nada por su cuenta: quien mide es la pastilla (`core/fluidezHud.js`)
// sobre la aritmética de `core/fluidez.js`. Aquí solo se explica y se enciende.
import { on } from '../../core/events.js';
import { UMBRAL_LARGO } from '../../core/fluidez.js';

/** La URL de esta misma página con (o sin) el medidor encendido.
 *  @param {boolean} encendido @returns {string} */
function urlConMedidor(encendido) {
  const q = new URLSearchParams(location.search);
  if (encendido) q.set('perf', '1'); else q.delete('perf');
  const cola = q.toString();
  return location.pathname + (cola ? '?' + cola : '') + (location.hash || '');
}

/** @returns {boolean} */
function medidorEncendido() {
  try { return new URLSearchParams(location.search).get('perf') === '1'; } catch { return false; }
}

// Las escenas de la Fase 0, en el orden en que conviene medirlas: de lo que
// debería costar CERO (una pantalla quieta) a lo que más pinta. La última
// columna es lo que se espera; si una escena no llega, esa es la que se rehace.
const ESCENAS = [
  ['VS en reposo (con la cuerda)', 'Abre un duelo y NO toques nada: la cuerda se balancea sola.', 'p50 ≤ 17 ms · 0 largos'],
  ['VS respondiendo', 'Contesta varias preguntas seguidas en el duelo.', 'p50 ≤ 25 ms'],
  ['Podio con confeti', 'Termina el duelo y mide mientras cae el confeti.', 'p50 ≤ 33 ms'],
  ['Quiz (Individual)', 'Una pregunta tras otra, a pantalla completa.', 'p50 ≤ 17 ms'],
  ['Colorear', 'Pinta arrastrando el dedo por la pizarra.', 'p50 ≤ 25 ms · p95 ≤ 50 ms'],
];

/** @returns {{html: () => string, wire: (rootSel: string) => void}} */
export function createFluidezSection() {
  return {
    html: () => `
      <h5 class="mt-4">Fluidez <small class="text-muted">(medir en la pizarra ANTES de tocar una animación)</small></h5>
      <p class="small text-muted mb-2">
        Añade <code>?perf=1</code> a la dirección de cualquier página y aparece una pastilla abajo a la izquierda con
        <b>fps</b>, <b>p50</b> (el cuadro típico), <b>p95</b> (el peor de cada veinte) y <b>largos</b>
        (cuadros de más de ${UMBRAL_LARGO} ms) de los últimos 5 segundos. Se ve también a pantalla completa.
        Verde = va fino · amarillo = justo · rojo = la clase lo nota.
      </p>
      <div class="d-flex gap-2 align-items-center flex-wrap mb-2">
        <button id="admin-perf-on" class="btn btn-sm btn-outline-primary"><i class="bi bi-speedometer2"></i> ${medidorEncendido() ? 'Recargar con el medidor' : 'Encender el medidor aquí'}</button>
        ${medidorEncendido() ? '<button id="admin-perf-off" class="btn btn-sm btn-outline-secondary">Apagarlo</button><span class="badge bg-success">medidor encendido</span>' : ''}
        <span class="small text-muted">Recarga la página: el medidor se monta al arrancar.</span>
      </div>
      <table class="table table-sm w-auto align-middle">
        <thead><tr><th>Escena</th><th>Cómo</th><th>Lo que se espera</th></tr></thead>
        <tbody>
          ${ESCENAS.map(([n, c, e]) => `<tr><td><b>${n}</b></td><td class="small text-muted">${c}</td><td class="small"><code>${e}</code></td></tr>`).join('')}
        </tbody>
      </table>
      <p class="small text-muted mb-0">
        Mide en la pizarra del aula, no en un portátil: ahí la pantalla es pequeña en CSS pero enorme en píxeles
        reales (DPR 3), y lo que se repinta cuesta nueve veces más. Apunta los cinco números antes de cambiar nada
        — la tabla «antes» es lo que dice qué animación hay que rehacer y qué arreglo sirvió.
      </p>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-perf-on', () => { location.href = urlConMedidor(true); location.reload(); });
      on(rootSel, 'click', '#admin-perf-off', () => { location.href = urlConMedidor(false); location.reload(); });
    },
  };
}
