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
import { MODELOS_IA, iaSabeEscribir, pedirContenido } from './aiContent.js';

const EXTREMO = () => `${PB_URL}/api/ia/contenido`;

// Mismo respaldo que el buscador de imágenes, y por el mismo motivo: Bootstrap
// viene de una CDN, y este diálogo es de los que se abren cuando la red va mal.
// Sin el respaldo, `new bootstrap.Modal` revienta dentro del handler y el profe
// se queda con un botón MUERTO que no dice nada (R6).
function abrirDialogo(el) {
  if (typeof bootstrap !== 'undefined' && bootstrap?.Modal) return new bootstrap.Modal(el);
  let fondo = null;
  const cerrar = () => {
    el.classList.remove('show');
    el.style.display = 'none';
    fondo?.remove();
    el.dispatchEvent(new Event('hidden.bs.modal'));
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-bs-dismiss="modal"]')) cerrar(); });
  return {
    show() {
      fondo = document.createElement('div');
      fondo.className = 'modal-backdrop fade show';
      document.body.appendChild(fondo);
      el.style.display = 'block';
      el.classList.add('show');
    },
    hide: cerrar,
  };
}

/** Cómo se enseña una pieza propuesta, según su modelo. Solo lectura. */
function vistaPrevia(modelo, content) {
  const fila = (izq, der = '') =>
    `<li class="ia-pieza"><span class="ia-pieza__a">${escapeHtml(izq)}</span>`
    + (der ? `<span class="ia-pieza__b">${escapeHtml(der)}</span>` : '') + '</li>';
  if (modelo === 'qa') {
    return (content.items || []).map(it =>
      `<li class="ia-pieza"><span class="ia-pieza__a">${escapeHtml(it.question)}</span>
        <span class="ia-pieza__b">${(it.options || []).map(o =>
          `<span class="ia-opt${o === it.answer ? ' is-ok' : ''}">${escapeHtml(o)}</span>`).join('')}</span></li>`).join('');
  }
  if (modelo === 'pairs') return (content.pairs || []).map(p => fila(p.left, `↔ ${p.right}`)).join('');
  if (modelo === 'items') return (content.items || []).map(it => fila(it.question)).join('');
  if (modelo === 'words') {
    return (content.words || []).map(w => (typeof w === 'string' ? fila(w) : fila(w.word, w.clue))).join('');
  }
  if (modelo === 'textCorrection') {
    // Se enseña la frase YA CORREGIDA (que es lo que el profe reconoce), no el
    // texto pelado que se guarda: leer «El pajaro canto» y creer que la IA
    // escribe sin tildes sería el malentendido garantizado.
    return (content.passages || []).map(p => fila(conMarcas(p))).join('');
  }
  return '';
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
export function abrirEscribirConIA(opts = {}) {
  const { modelo, tema = '', palabrasComoTexto = false, fetchFn = fetch } = opts;
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
            <p class="text-muted small">Se escriben ${escapeHtml(def.describe)}. Lo verás antes de añadirlo.</p>
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-6">
                <label class="form-label small fw-semibold" for="${suf}tema">¿De qué va?</label>
                <input id="${suf}tema" class="form-control" placeholder="p. ej. los ríos de España"
                       value="${escapeHtml(tema)}" maxlength="300">
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label small fw-semibold" for="${suf}curso">¿Para quién?</label>
                <input id="${suf}curso" class="form-control" placeholder="5.º de primaria" maxlength="120">
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
  const m = abrirDialogo(el);

  let propuesto = null;
  let aceptado = null;

  const aviso = (texto, tipo = 'warning') => {
    $('estado').innerHTML = `<div class="alert alert-${tipo} py-2 mb-0 small">${escapeHtml(texto)}</div>`;
  };

  async function escribir() {
    const tema = $('tema').value.trim();
    if (!tema) { aviso('Escribe de qué va la actividad.'); $('tema').focus(); return; }
    // La red se comprueba ANTES de gastar el intento: es la causa más frecuente
    // y la única que el profe puede resolver en el momento.
    if (navigator.onLine === false) { aviso('Sin conexión a internet. La IA necesita red.'); return; }

    const boton = $('go');
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Escribiendo…';
    $('lista').hidden = true;
    $('ok').disabled = true;
    aviso('Pensando… suele tardar unos segundos.', 'info');
    try {
      const r = await pedirContenido({
        modelo, tema, curso: $('curso').value.trim(), cantidad: $('n').value,
        url: EXTREMO(), token: getAuthToken(), fetchFn, palabrasComoTexto,
      });
      if (r.error) { aviso(r.error); propuesto = null; return; }
      propuesto = r.content;
      $('lista').innerHTML = vistaPrevia(modelo, r.content);
      $('lista').hidden = false;
      $('ok').disabled = false;
      // Lo DESCARTADO se cuenta, no se esconde: si de 10 salen 6, el profe tiene
      // que saber por qué antes de darle a añadir (R6).
      const n = r.piezas;
      const sobra = r.descartadas.length
        ? ` Se descartaron ${r.descartadas.length}: ${r.descartadas.slice(0, 2).join('; ')}${r.descartadas.length > 2 ? '…' : ''}`
        : '';
      aviso(`${n} ${elemento}${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'}.${sobra}`, sobra ? 'warning' : 'success');
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
    el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(aceptado); });
    m.show();
    setTimeout(() => $('tema')?.focus(), 150);
  });
}
