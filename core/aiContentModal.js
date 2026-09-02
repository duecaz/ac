// EL DIÁLOGO DE «ESCRIBIR CON IA» — la mitad con pantalla.
//
// El núcleo (qué se pide, y sobre todo cómo se revisa lo que vuelve) vive en
// core/aiContent.js, sin DOM y probado sin red. Aquí solo está el trato con el
// profe, con la misma forma que el buscador de imágenes: se abre, se pide, se
// VE lo propuesto, y se acepta o se descarta. Devuelve el contenido elegido o
// `null` — nada entra en la actividad por la puerta de atrás.
//
// LA PREVISUALIZACIÓN NO ES UN ADORNO. §24 dice que el contenido es del usuario,
// y una IA que escribe en la actividad del profe es exactamente lo que esa ley
// vigila: se propone, se enseña, él acepta. Sin esto, esta función no se hace.
import { escapeHtml } from './html.js';
import { rid } from './ids.js';
import { PB_URL } from '../pocketbase.config.js';
import { getAuthToken } from './auth.js';
import { MODELOS_IA, iaSabeEscribir, pedirContenido, piezasDe, diagnosticarFalloDeRed, TEMA_VACIO } from './aiContent.js';
import { abrirDialogoConFallback } from './modalFallback.js';

const EXTREMO = () => `${PB_URL}/api/ia/contenido`;

/** Cómo se enseña UNA pieza propuesta, según su modelo. Solo lectura. */
function piezaHtml(modelo, x) {
  const cuerpo = (izq, der = '') =>
    `<span class="ia-pieza__a">${escapeHtml(izq)}</span>`
    + (der ? `<span class="ia-pieza__b">${escapeHtml(der)}</span>` : '');
  if (modelo === 'qa') {
    return `<span class="ia-pieza__a">${escapeHtml(x.question)}</span>
      <span class="ia-pieza__b">${(x.options || []).map(o =>
        `<span class="ia-opt${o === x.answer ? ' is-ok' : ''}">${escapeHtml(o)}</span>`).join('')}</span>`;
  }
  if (modelo === 'pairs') return cuerpo(x.left, `↔ ${x.right}`);
  if (modelo === 'items') return cuerpo(x.question);
  if (modelo === 'words') return typeof x === 'string' ? cuerpo(x) : cuerpo(x.word, x.clue);
  // Se enseña la frase YA CORREGIDA (que es lo que el profe reconoce), no el
  // texto pelado que se guarda: leer «El pajaro canto» y creer que la IA escribe
  // sin tildes sería el malentendido garantizado.
  if (modelo === 'textCorrection') return cuerpo(conMarcas(x));
  return '';
}

/**
 * La lista de lo propuesto, CON su botón de quitar.
 *
 * Aceptar en bloque obligaba a lo de siempre: añadir las ocho y borrar a mano
 * las dos que no valen, ya dentro de la actividad. Quitarlas aquí es un toque, y
 * mantiene la promesa del diálogo — se ve ANTES de que entre nada (§24).
 */
function vistaPrevia(modelo, content) {
  const donde = piezasDe(content);
  if (!donde) return '';
  return donde.lista.map((x, i) =>
    `<li class="ia-pieza" data-i="${i}">
      <div class="ia-pieza__txt">${piezaHtml(modelo, x)}</div>
      <button type="button" class="btn btn-sm btn-link text-danger ia-quitar p-0 ms-2"
              data-i="${i}" title="Quitar esta">
        <i class="bi bi-x-lg"></i><span class="visually-hidden">Quitar</span>
      </button>
    </li>`).join('');
}

// Reconstruye la frase con sus tildes y comas, solo para enseñarla.
function conMarcas(p) {
  const marcas = new Map((p.marks || []).map(m => [m.pos, m.kind]));
  const TILDE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' };
  let out = '';
  [...(p.text || '')].forEach((c, i) => {
    const k = marcas.get(i);
    out += k === 'tilde' ? (TILDE[c] ?? c) : c;
    if (k === 'coma') out += ',';
  });
  return out;
}

/**
 * Abre el diálogo. Resuelve con el CONTENIDO propuesto (con la forma del modelo)
 * cuando el profe lo acepta, o con `null` si cierra sin aceptar.
 *
 * @param {object} opts
 * @param {string} opts.modelo      modelo de contenido de la actividad
 * @param {string} [opts.elemento]  cómo se llama una pieza aquí («pregunta», «par»…)
 * @param {string} [opts.tema]      sugerencia inicial (el título de la actividad)
 * @param {boolean} [opts.palabrasComoTexto]  Sopa de Letras (ver core/aiContent.js)
 * @param {Function} [opts.fetchFn] inyectable para las sondas
 * @returns {Promise<object|null>}
 */
// `opts.disparador`: a quién devolver el foco al cerrar. Por defecto es
// `document.activeElement` (core/modalFallback.js), pero editorShell.js
// deshabilita el botón «Escribir con IA» ANTES de llamar (para que no se
// pueda hacer doble clic mientras carga el módulo) — un botón `disabled`
// deja de ser el `activeElement` al instante, así que ese caller lo pasa
// explícito con la referencia que capturó antes de deshabilitarlo.
export function abrirEscribirConIA(opts = {}) {
  const { modelo, tema = '', palabrasComoTexto = false, fetchFn = fetch, disparador } = opts;
  const def = MODELOS_IA[modelo];
  if (!iaSabeEscribir(modelo)) return Promise.resolve(null);
  const elemento = opts.elemento || def.elemento;

  const suf = rid('ww-ia-');
  const $ = (s) => document.getElementById(`${suf}${s}`);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" id="${suf}" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-stars"></i> Escribir con IA</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted small">Se escriben ${escapeHtml(def.describe)}. Lo verás antes de añadirlo
              y podrás quitar las que no quieras.</p>
            <!-- SI EL TEXTO YA EXISTE, LA IA SOBRA. Pedirle frases de un poema
                 concreto devolvió versos AL ESTILO del autor, ninguno del poema:
                 imitar es lo que un modelo hace bien, y aquí es el resultado
                 equivocado. Se dice AQUÍ, antes de gastar una generación. -->
            ${modelo === 'textCorrection' ? `<div class="alert alert-info py-2 small">
              ¿Ya tienes el texto (un poema, una lectura)? Ciérra esto y usa
              <b>«Pegar un texto»</b>: se parte en frases tal cual, sin que nadie lo reescriba.
            </div>` : ''}
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-6">
                <label class="form-label small fw-semibold" for="${suf}tema">¿De qué va?</label>
                <input id="${suf}tema" class="form-control" placeholder="p. ej. los ríos de España"
                       value="${escapeHtml(tema)}" maxlength="300">
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label small fw-semibold" for="${suf}curso">¿Para quién?</label>
                <!-- ELEGIR, NO ESCRIBIR. Era un campo libre con «5.º de primaria»
                     de ejemplo: quien lo dejaba vacío recibía preguntas de nivel
                     indefinido, y el nivel es lo que decide si la actividad
                     sirve. Tres niveles bastan para que el modelo apunte, y
                     viene ya elegido (R2: nada que configurar para empezar). -->
                <select id="${suf}curso" class="form-select">
                  <option value="alumnos de primaria">Primaria</option>
                  <option value="alumnos de secundaria" selected>Secundaria</option>
                  <option value="estudiantes de nivel superior">Superior</option>
                </select>
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label small fw-semibold" for="${suf}n">¿Cuántas?</label>
                <input id="${suf}n" class="form-control" type="number" min="1" max="20" value="8">
              </div>
            </div>
            <button class="btn btn-primary mt-3" id="${suf}go"><i class="bi bi-stars"></i> Escribir</button>
            <div id="${suf}estado" class="mt-3"></div>
            <ul class="ia-lista mt-2" id="${suf}lista" hidden></ul>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Descartar</button>
            <button type="button" class="btn btn-success" id="${suf}ok" disabled>
              <i class="bi bi-plus-lg"></i> Añadir a la actividad
            </button>
          </div>
        </div>
      </div>
    </div>`;
  const el = wrap.firstElementChild;
  document.body.appendChild(el);
  const m = abrirDialogoConFallback(el, { disparador });

  let propuesto = null;
  let aceptado = null;
  let sobrante = '';        // lo que la revisión descartó, para no repetirlo al repintar

  const aviso = (texto, tipo = 'warning') => {
    $('estado').innerHTML = `<div class="alert alert-${tipo} py-2 mb-0 small">${escapeHtml(texto)}</div>`;
  };

  /** Repinta la lista y el recuento. Se llama al escribir y cada vez que el
   *  profe quita una: el número de arriba tiene que ser el de abajo. */
  function pintarPropuesta() {
    const donde = piezasDe(propuesto);
    const n = donde ? donde.lista.length : 0;
    $('lista').innerHTML = n ? vistaPrevia(modelo, propuesto) : '';
    $('lista').hidden = !n;
    $('ok').disabled = !n;
    if (!n) {
      aviso(`No queda ninguna ${elemento}. Escribe otra vez o cambia el tema.`, 'warning');
      return;
    }
    aviso(`${n} ${elemento}${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'}.${sobrante}`,
      sobrante ? 'warning' : 'success');
  }

  async function escribir() {
    const tema = $('tema').value.trim();
    if (!tema) { aviso(TEMA_VACIO); $('tema').focus(); return; }
    // La red se comprueba ANTES de gastar el intento: es la causa más frecuente
    // y la única que el profe puede resolver en el momento. Misma frase que
    // `diagnosticarFalloDeRed` da para "sin conexión" — un solo dueño del texto.
    if (navigator.onLine === false) { aviso(await diagnosticarFalloDeRed({ enLinea: false })); return; }

    const boton = $('go');
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Escribiendo…';
    $('lista').hidden = true;
    $('ok').disabled = true;
    aviso('Pensando… suele tardar unos segundos.', 'info');
    try {
      const r = await pedirContenido({
        modelo, tema, curso: $('curso').value, cantidad: $('n').value,
        url: EXTREMO(), token: getAuthToken(), fetchFn, palabrasComoTexto,
      });
      if (r.error) { aviso(r.error); propuesto = null; return; }
      propuesto = r.content;
      // Lo DESCARTADO se cuenta, no se esconde: si de 10 salen 6, el profe tiene
      // que saber por qué antes de darle a añadir (R6).
      sobrante = r.descartadas.length
        ? ` Se descartaron ${r.descartadas.length}: ${r.descartadas.slice(0, 2).join('; ')}${r.descartadas.length > 2 ? '…' : ''}`
        : '';
      pintarPropuesta();
    } catch (e) {
      propuesto = null;
      aviso(e.message);
    } finally {
      boton.disabled = false;
      boton.innerHTML = '<i class="bi bi-stars"></i> Escribir';
    }
  }

  return new Promise((resolve) => {
    $('go').addEventListener('click', escribir);
    $('tema').addEventListener('keydown', (e) => { if (e.key === 'Enter') escribir(); });
    $('ok').addEventListener('click', () => { aceptado = propuesto; m.hide(); });
    // Quitar una propuesta. Delegado en la lista: se repinta entera, así que un
    // handler por fila sobreviviría a su fila.
    $('lista').addEventListener('click', (ev) => {
      const b = ev.target.closest('.ia-quitar');
      if (!b) return;
      const donde = piezasDe(propuesto);
      if (!donde) return;
      donde.lista.splice(Number(b.dataset.i), 1);
      pintarPropuesta();
    });
    el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(aceptado); });
    m.show();
    setTimeout(() => $('tema')?.focus(), 150);
  });
}
