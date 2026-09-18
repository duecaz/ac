// UNA FRASE PUESTA EN PANTALLA PARA JUGARLA: el alumno la marca con lápiz o
// borrador sobre el texto, y la clase la ve proyectada (con su solución al
// revelar).
//
// Es la pantalla, no el juego: paginar, puntuar y corregir son del runner
// (core/textCorrectionSolo.js); el veredicto, de core/textCorrectionRevision.js;
// el dibujo del texto, de core/textCorrectionPasaje.js. Esta ronda la usan los
// CINCO modos (Solo, VS, Equipos, Live y Tarea) a través de la fachada
// core/textCorrectionRound.js.
import { escapeHtml } from './html.js';
import { passageHtml, fitPassage } from './textCorrectionPasaje.js';
import { mountTcDraw } from './textCorrectionDraw.js';
import { lucide } from './lucide.js';
import { on } from './events.js';
import { cabeceraHtml, relojSet } from './playerHud.js';

/** @typedef {import('../kernel/contracts/activity.js').Passage} Passage */
/** @typedef {import('./textCorrectionPasaje.js').Marca} Marca */

/**
 * SUBIR DESDE LO TOCADO, con `dataset` a la vista. `Element.closest` devuelve
 * `Element` —que no tiene `dataset`—, y estrechar con `instanceof HTMLElement`
 * está prohibido: las suites corren con un DOM de mentira donde esa clase no
 * existe. Se estrecha por FORMA, en un solo sitio: lo comparte el runner Solo
 * (sus botones de anular), que es el otro que sube desde un toque.
 * @param {EventTarget|null} t
 * @returns {{closest: (sel: string) => HTMLElement|null}}
 */
export const desdeToque = (t) => {
  const el = /** @type {HTMLElement|null} */ (t);
  return { closest: (sel) => (typeof el?.closest === 'function'
    ? /** @type {HTMLElement|null} */ (el.closest(sel))
    : null) };
};

// LÁPIZ / BORRADOR: UN interruptor, no dos botones. Vive AQUÍ —con el que lo
// cablea (§21b)— porque hay dos sitios donde puede colgarse y solo una manera
// de que se vea y se comporte: dentro de la cabecera que pinta esta misma
// ronda (VS · Equipos · Live), o dentro de la cabecera ESTABLE que monta el
// runner Solo (v1.51.724). El markup y el cableado no se duplican: cambia el
// anfitrión, no la herramienta.
//
// Por qué es un interruptor y no dos pastillas: la detección por tamaño de
// contacto (core/penDetector.js) acierta casi siempre —punta dibuja, palma
// borra—, pero «casi siempre» con 33 críos delante no basta: en una pizarra sin
// calibrar, o con un lápiz que no reporta el área de contacto, borrar era
// imposible y el alumno se quedaba con una marca de más (que en Tildes/Comas
// RESTA: el puntaje es neto). Este mando es el manual — el detector sigue
// mandando mientras nadie lo toque.
// FORMA (dueño, 2026-08-15): «lápiz con el borrador es un botón al estilo de
// switch de apagar/prender luz». Dos pastillas separadas obligaban a leer cuál
// estaba rellena; un interruptor SE VE de un vistazo a 3 m y dice a la vez en
// qué está y qué pasa si lo tocas. Y es un solo blanco táctil en vez de dos.
// NO añade toques a responder (§29): arranca en LÁPIZ, que es lo que el alumno
// va a hacer; el borrador es para el que se equivoca.
/** @returns {string} */
export const herramientasTcHtml = () => `
        <button type="button" class="tc-switch" data-tool="pen" aria-pressed="false"
                title="Lápiz — toca para borrar" aria-label="Lápiz activo. Tocar para pasar al borrador">
          <span class="tc-switch__side tc-switch__side--pen" data-side="pen">
            ${lucide('pencil', { clase: 'tc-ico' })}<span class="tc-switch__word">Lápiz</span>
          </span>
          <span class="tc-switch__side tc-switch__side--er" data-side="eraser">
            ${lucide('eraser', { clase: 'tc-ico' })}<span class="tc-switch__word">Borrador</span>
          </span>
        </button>`;

/** Deja el interruptor en LÁPIZ y lo ata al lienzo de ESTA frase. Se llama en
 *  cada frase: cuando el mando es estable (Solo) hay que devolverlo a lápiz —el
 *  lienzo nuevo nace escribiendo— y reapuntarlo al lienzo nuevo. El cableado va
 *  por DELEGACIÓN idempotente (`on`, core/events.js), así que volver a llamarlo
 *  sustituye el handler anterior en vez de apilarlo.
 *
 *  OJO con el gesto: al pasar de bolita a DOS PASTILLAS ETIQUETADAS, el mando
 *  dejó de parecer un interruptor y pasó a parecer un selector — y con un
 *  conmutador ciego, tocar la pastilla que YA estaba activa te cambiaba a la
 *  otra. El alumno que está en «Lápiz» y toca «Lápiz» se llevaba el borrador, y
 *  su siguiente trazo BORRABA una marca: en Tildes/Comas el puntaje es neto, así
 *  que eso cuesta puntos sin decir nada. Manda el lado tocado; solo el hueco
 *  entre pastillas conmuta.
 *  @param {Element} mandos  quien aloja el interruptor (cabecera propia o estable)
 *  @param {{setEraser: (on: boolean) => void}} draw
 *  @param {() => boolean} entregada  ¿ya se entregó esta frase? (el mando se apaga)
 *  @returns {void} */
function cablearSwitch(mandos, draw, entregada) {
  const sw = /** @type {HTMLElement|null} */ (mandos.querySelector('.tc-switch'));
  if (!sw) return;
  pintarSwitch(sw, false);
  draw.setEraser(false);
  on(mandos, 'click', '.tc-switch', (e) => {
    if (entregada()) return;
    const lado = desdeToque(e.target).closest('.tc-switch__side')?.dataset.side;
    const borrar = lado ? lado === 'eraser' : !sw.classList.contains('is-on');
    if (borrar === sw.classList.contains('is-on')) return;   // ya estaba en ese
    pintarSwitch(sw, borrar);
    draw.setEraser(borrar);
  });
}

/** El aspecto del interruptor según en qué está. @param {HTMLElement} sw @param {boolean} borrar */
function pintarSwitch(sw, borrar) {
  sw.classList.toggle('is-on', borrar);
  sw.dataset.tool = borrar ? 'eraser' : 'pen';
  sw.setAttribute('aria-pressed', String(borrar));
  sw.title = borrar ? 'Borrador — toca para escribir' : 'Lápiz — toca para borrar';
  sw.setAttribute('aria-label', borrar
    ? 'Borrador activo. Tocar para volver al lápiz'
    : 'Lápiz activo. Tocar para pasar al borrador');
}

/** @type {Record<string, string>} */
const HINTS = {
  tilde: 'Toca las vocales que llevan tilde.',
  coma: 'Toca el hueco donde falta una coma.'
};

// Interactive round (VS / Equipos-auto / LIVE / Solo) — modo DIBUJO: el alumno
// dibuja la marca con lápiz/táctil sobre el texto. onSubmit(value:number[]) al
// pulsar "Listo" (mismas posiciones que el modo tocar → scoring intacto).
/**
 * @param {Element} root
 * @param {{id?: string, text?: string}|null} payload
 * @param {{kind?: Marca, onSubmit?: (value: number[]) => void,
 *   chips?: {left?: string, right?: string}, reloj?: boolean,
 *   progreso?: boolean|null, cabecera?: boolean, mandos?: Element|null}} [opts]
 * @returns {{flush: () => void, chromePropio: boolean,
 *   setReloj: (texto: string, pct: number|null) => void}}
 */
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit, chips = {}, reloj = false, progreso = null, cabecera = true, mandos = null } = {}) {
  const text = payload?.text || '';
  // El botón "Calibrar pizarra" NO va aquí (en el juego): vive en la pantalla de
  // inicio (views/antesala.js), que es donde van los ajustes previos. En modo
  // tarea (alumno) no hay pizarra que calibrar, así que no debe aparecer nunca
  // durante el ejercicio.
  // MAQUETA (dueño, 2026-08-14): las herramientas ARRIBA —como cualquier app de
  // dibujo—, el texto con aire a los costados y el botón ABAJO. Antes las
  // herramientas flotaban en mitad de la pantalla, pegadas al texto. `chips` lo
  // pasa el caller (HTML propio, ya escapado): la ronda no sabe si corre en
  // solo, carrera o duelo (§0).
  const propio = !!(chips.left || chips.right);
  // LA CABECERA ES LA DE TODOS (core/playerHud.js). Esta ronda tuvo la suya
  // —`.tc-bar`, con su página, su reloj y su botón— y era la única de las trece
  // que la dibujaba: las otras nueve flotaban los indicadores y dos más los
  // repartían entre su barra y la esquina. Tres tratamientos de la misma franja
  // («solo estás parchando, piensa mejor», dueño 2026-09-03). Aquí solo se
  // aporta lo PROPIO: la herramienta que se toca. El aspecto de banda de la
  // hoja se conserva apuntando `--cab-tinta`/`--cab-fondo` a los tokens del
  // PAPEL (styles/textCorrection.css) — una regla, dos superficies.
  //
  // El botón de pantalla completa lo aloja la cabecera SOLO cuando esta ronda es
  // la pantalla entera (la que trae chips: solo, carrera, tarea). En el duelo se
  // montan DOS rondas, una por jugador: ahí serían dos mandos para el mismo
  // marco, y la esquina —que es UNA— sigue siendo el sitio correcto.
  //
  // …SALVO QUE YA HAYA UNA, y entonces esta ronda NO la pinta (`cabecera:false`).
  // Es lo que hace el runner Solo desde v1.51.724: la hoja de papel y su banda
  // se montan UNA vez para toda la partida y aquí solo se repinta el área de
  // escritura, así que pasar de frase ya no destruye el reloj ni el mando de
  // pantalla completa. El interruptor vive entonces en esa cabecera (`mandos`)
  // y lo cablea la MISMA función: cambia el anfitrión, no la herramienta.
  const anfitrion = mandos || root;
  const hoja = `
      <div class="tc-hoja">
        <div class="edu-sec edu-sec--texto tc-passage-area"><div class="tc-passage">${passageHtml(text, kind)}</div></div>
        <div class="tc-done-wrap edu-send"><button type="button" class="btn btn-success btn-lg tc-done" data-ww-submit><i class="bi bi-check2-circle"></i> Listo</button></div>
      </div>`;
  root.innerHTML = cabecera
    ? `<div class="tc-round">
      ${cabeceraHtml({ herramientas: herramientasTcHtml(), pagina: chips.left || undefined,
                       tiempo: reloj ? '' : undefined,
                       fullscreen: propio, progreso: !!(progreso ?? reloj) })}${hoja}
    </div>`
    : hoja;

  const areaEl = /** @type {HTMLElement} */ (root.querySelector('.tc-passage-area'));
  const passageEl = /** @type {HTMLElement} */ (root.querySelector('.tc-passage'));
  // El texto LLENA el área disponible (grande en pantalla completa). Se monta el
  // canvas, se ajusta el tamaño de letra al hueco, y se recalculan las zonas.
  const draw = mountTcDraw(passageEl, { targets: passageEl.querySelectorAll('.tc-target') });
  const stopFit = fitPassage(areaEl, passageEl);

  // EL BOTÓN DE PANTALLA COMPLETA NO SE CABLEA AQUÍ. Lo hace el MARCO —una vez,
  // por delegación (`core/fullscreen.js`)—, así que un botón pintado después
  // funciona igual: esta ronda se vuelve a pintar en cada frase. Antes cada
  // montaje ataba el suyo y dejaba su listener por frase.

  let done = false;
  const submit = () => {
    if (done) return;
    done = true;
    stopFit();
    draw.freeze();
    onSubmit?.(draw.getMarked());
  };
  root.querySelector('.tc-done')?.addEventListener('click', submit);
  // EL MANDO: apagado = lápiz, encendido = borrador. Lo cablea la función
  // compartida, que también lo devuelve a LÁPIZ — importa cuando el mando es
  // estable (Solo): el lienzo de la frase nueva nace escribiendo, y un
  // interruptor que se quedara en «Borrador» borraría la primera marca.
  cablearSwitch(anfitrion, draw, () => done);

  // Contrato opcional de renderRound: `{ flush }` entrega lo dibujado hasta ahora
  // (mismo efecto que pulsar "Listo"). Lo usa studentLive para RESCATAR el trazo
  // en curso cuando el profe avanza antes de que el alumno termine — capacidad
  // declarada por la plantilla, no un querySelector a clases internas.
  // `chromePropio`: esta ronda YA pinta su barra (progreso + herramientas), así
  // que la vista que le pasó `chips` no debe apilar otra encima — dos barras
  // era la captura del dueño. Quien no pase chips no nota nada.
  return {
    flush: submit,
    chromePropio: !!(chips.left || chips.right),
    /** Repinta el reloj y la barra de progreso. La ronda NO cuenta el tiempo:
     *  solo lo PINTA. Quién lo cuenta —y con qué primitivo— es del caller (§0:
     *  una plantilla no sabe en qué modo corre). En Individual lo lleva
     *  `runTextCorrectionSolo` con `core/reloj.js`; en vivo, la sala. */
    setReloj(texto, pct) { relojSet(anfitrion, texto, pct); },
  };
}

// Projector (host) view for LIVE: the passage big and read-only. In the reveal
// phase, show the solution with the correct marks highlighted (green).
/**
 * @param {Element} root
 * @param {{phase?: string, item?: Passage|null, kind?: Marca}} [o]
 */
export function renderTextCorrectionHost(root, { phase, item, kind = 'tilde' } = {}) {
  const text = item?.text || '';
  if (phase === 'reveal') {
    const want = new Set((item?.marks || []).filter((m) => m.kind === kind).map((m) => m.pos));
    root.innerHTML = `
      <div class="tc-passage">${passageHtml(text, kind, { got: want, want })}</div>
      <p class="text-center text-success fw-bold mt-2"><i class="bi bi-check-circle-fill"></i> Solución</p>`;
    return;
  }
  root.innerHTML = `
    <div class="tc-passage">${escapeHtml(text)}</div>
    <p class="text-center text-muted mt-2">${HINTS[kind]}</p>`;
}
