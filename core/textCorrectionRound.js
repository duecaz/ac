// Shared text-correction round — the single, touch-first mechanic for Tildes
// and Comas (and any future "mark the text" template). One passage per screen,
// big tap targets, tap-to-toggle (no drag): works the same on mouse, touch and
// IR pen, and reflows into a narrow VS panel.
//
//   kind 'tilde' → tap the VOWELS that take an accent.
//   kind 'coma'  → tap the GAP between two words where a comma is missing.
//
// value is number[]: for tildes, the char positions marked; for comas, the
// index of the char AFTER which the comma goes (matches the answer-key `pos`).
import { html, escapeHtml, mount } from './html.js';
import { isVowel, applyTilde, scoreMarksPerHit, wordAtPos } from './textMarks.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { runFreeformPlayer } from './soloPlayer.js';
import { mountTcDraw } from './textCorrectionDraw.js';
import { observeResize } from './observeResize.js';
import { fullscreenButtonHtml, attachFullscreenButton } from './fullscreen.js';
import { heatClass } from './itemStats.js';
import { hudHtml } from './playerHud.js';
import { corrigeAlFinal } from './constants.js';
import { montarReloj, relojDe } from './reloj.js';
import { serverNow } from './serverNow.js';

// ICONOS LUCIDE, EN LÍNEA (dueño, 2026-08-15: «usa iconos lucide»). Se pegan
// aquí como SVG en vez de cargar la librería: la app no depende de la red —la
// misma lección que la CDN de Bootstrap y las webfonts—, y con la clase delante
// un icono que no llega es un mando invisible. `stroke:currentColor` deja que el
// color lo ponga el token del skin (§3), igual que hacía el icono de fuente.
// Fuente: lucide.dev · iconos `pencil` y `eraser` · licencia ISC.
const svgLucide = (d) => `<svg class="tc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
  + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LUCIDE = {
  pencil: svgLucide('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'),
  eraser: svgLucide('<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>'),
};

const HINTS = {
  tilde: 'Toca las vocales que llevan tilde.',
  coma: 'Toca el hueco donde falta una coma.'
};

// Preview de tarjeta (miniatura del home) para Tildes/Comas. Reutiliza el MISMO
// `passageHtml` del juego → la miniatura no puede desincronizarse del player.
// La comparten templates/tildes/template.js y templates/comas/template.js.
export function textCorrectionPreviewHtml(act, kind) {
  const passages = (act.content?.passages || []).filter(p => p && p.text);
  if (!passages.length) {
    return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
      <h2 class="text-center">${escapeHtml(act.title || 'Actividad')}</h2></div>`;
  }
  return `<div class="tc-solo">
    <div class="d-flex align-items-center mb-2">
      <span class="badge bg-secondary">Frase 1 / ${passages.length}</span></div>
    <h4 class="text-center mb-1">${escapeHtml(act.title || '')}</h4>
    <div class="tc-round">
      <div class="tc-passage">${passageHtml(passages[0].text, kind)}</div>
      <div class="text-center mt-3"><button type="button" class="btn btn-success btn-lg">
        <i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="tc-hint text-muted text-center mt-2">${HINTS[kind]}</p>
    </div>
  </div>`;
}
// Build the inline passage. `reveal` (optional) bakes correct/wrong/missed
// classes for a read-only answer review; otherwise targets are interactive.
// Exportada: el preview de tarjeta (core/homePreview.js) reutiliza ESTE mismo
// markup para que la miniatura sea fiel al juego y no se desfase (los targets
// son spans limpios; solo el canvas los vuelve interactivos).
function passageHtml(text, kind, reveal) {
  const chars = [...text];
  // ESPACIOS como texto crudo y rompible (antes era \u00a0 = no-rompible, por eso
  // no cortaba la linea): las palabras quedan enteras y el texto envuelve al marco.
  const ch = (c) => c === ' ' ? ' ' : `<span class="tc-ch">${escapeHtml(c)}</span>`;
  const stateCls = (pos, isTargetMarkable) => {
    if (!reveal) return '';
    const got = reveal.got.has(pos), want = reveal.want.has(pos);
    if (got && want) return ' ok';
    if (got && !want) return ' bad';
    if (!got && want) return ' miss';
    return '';
  };

  if (kind === 'tilde') {
    return chars.map((c, i) => {
      if (!isVowel(c)) return ch(c);
      if (reveal) {
        const cls = stateCls(i);
        const show = (reveal.got.has(i) || reveal.want.has(i)) ? applyTilde(c) : c;
        return `<span class="tc-tap tc-vowel is-revealed${cls}">${escapeHtml(show)}</span>`;
      }
      // Modo DIBUJO: el target es un span de solo lectura; el canvas captura el
      // trazo y la zona de este span decide la marca (data-pos).
      return `<span class="tc-target tc-vowel" data-pos="${i}">${escapeHtml(c)}</span>`;
    }).join('');
  }
  // coma: el hueco existe SOLO en el límite fin-de-palabra (un carácter que no es
  // espacio y va seguido de un espacio), nunca entre letras de una palabra.
  const isGap = (i) => i < chars.length - 1 && chars[i] !== ' ' && chars[i + 1] === ' ';
  return chars.map((c, i) => {
    // CORRECCIÓN: el texto tal cual (espacios normales) + la coma solo donde
    // participa (puesta o esperada). Deriva del MISMO texto+marcas: no se guarda
    // una segunda copia "con espacios/comas" que podría desincronizarse.
    if (reveal) {
      if (!isGap(i)) return ch(c);
      if (!reveal.got.has(i) && !reveal.want.has(i)) return ch(c);
      return ch(c) + `<span class="tc-tap tc-gap is-revealed${stateCls(i)}">,</span>`;
    }
    // JUEGO (dibujo): el DETECTOR es el ÚNICO separador entre palabras — se OMITE
    // el espacio literal (antes: detector + espacio = doble hueco, muy separado).
    // El detector es angosto (styles) y <wbr> conserva el corte de línea.
    if (c === ' ') return '';                          // el hueco lo aporta el detector
    if (!isGap(i)) return ch(c);                       // letra dentro de la palabra
    return ch(c) + `<span class="tc-target tc-gap" data-pos="${i}" aria-label="hueco"></span><wbr>`;
  }).join('');
}

// Interactive round (VS / Equipos-auto / LIVE / Solo) — modo DIBUJO: el alumno
// dibuja la marca con lápiz/táctil sobre el texto. onSubmit(value:number[]) al
/** La palabra que contiene una marca, ESCRITA YA COMO DEBE QUEDAR («América»,
 *  no «America»): es lo que el alumno tiene que aprender a ver. `wordAtPos` da
 *  la palabra cruda del texto sin tildes; aquí se le aplica la marca en su sitio.
 *  Para la coma se muestra la palabra con la coma detrás. */
function palabraMarcada(text, pos, kind) {
  const cruda = wordAtPos(text, pos);
  if (!cruda) return '';
  const s = String(text);
  let ini = pos;
  while (ini > 0 && !/\s/.test(s[ini - 1])) ini--;
  const rel = pos - ini;
  if (kind === 'coma') return `${cruda.slice(0, rel + 1)},${cruda.slice(rel + 1)}`;
  return cruda.slice(0, rel) + applyTilde(cruda[rel] ?? '') + cruda.slice(rel + 1);
}

/** LA REVISIÓN, PALABRA POR PALABRA (rescatada de la app anterior; dueño
 *  2026-08-27 con capturas). La corrección se pintaba SOLO dentro del texto, en
 *  rojo: para saber qué había fallado había que releer la frase entera buscando
 *  letras de color, y desde el fondo del aula eso no se hace.
 *
 *  Lleva TRES clases de fila, no dos, y la tercera es la importante:
 *    · acertada  — la marca estaba y el alumno la puso;
 *    · sin marcar — estaba y no la puso;
 *    · DE MÁS    — la puso donde no tocaba.
 *  Las de más no salían en la app anterior, y aquí no se pueden callar: el
 *  puntaje es NETO (aciertos − de más), así que una lista que dijera «2 / 2
 *  correctas» junto a un 0 de puntos sería un número imposible de explicar con
 *  la clase delante.
 *
 *  @returns {Array<{pos:number, palabra:string, estado:'ok'|'falta'|'demas'}>} */
export function filasRevision(p, kind, got) {
  const want = (p.marks || []).filter(m => m.kind === kind).map(m => m.pos);
  const filas = want.map(pos => ({
    pos, palabra: palabraMarcada(p.text, pos, kind),
    estado: got.has(pos) ? 'ok' : 'falta',
  }));
  for (const pos of got) {
    if (want.includes(pos)) continue;
    filas.push({ pos, palabra: palabraMarcada(p.text, pos, kind), estado: 'demas' });
  }
  return filas.sort((a, b) => a.pos - b.pos);
}

const ICONO = { ok: '✓', falta: '✗', demas: '+', perdon: '–' };
const TITULO = { ok: 'Bien puesta', falta: 'Faltaba', demas: 'Marca de más', perdon: 'Marca de más, perdonada' };

/** El veredicto EFECTIVO de una fila tras las anulaciones del docente.
 *  PERDONAR UNA MARCA DE MÁS NO LA CONVIERTE EN ACIERTO. La primera versión
 *  volteaba las tres clases con el mismo `ok ↔ falta`, así que perdonar una de
 *  más la pintaba de verde y el pie decía «1 / 8 correctas» mientras el veredicto
 *  de al lado seguía en «0/8 aciertos». Dos números que no cuadran, en la pantalla
 *  cuyo trabajo es que cuadren. Perdonar significa «esto ya no resta», que es
 *  exactamente lo que hace el scorer al quitar esa posición. */
export const efectivoDe = (fila, anulada) => {
  if (!anulada) return fila.estado;
  if (fila.estado === 'demas') return 'perdon';
  return fila.estado === 'ok' ? 'falta' : 'ok';
};

/** EL CONTADOR DEL PIE, con dueño. Cuenta SOLO las marcas que la frase pedía:
 *  las de más no suman ni restan aquí (restan en el puntaje, que es donde se
 *  ven). Vive fuera del panel para que `tests/tcRevision.test.mjs` pueda fijar el
 *  invariante que de verdad importa: este «N / M» y los aciertos que reporta el
 *  scorer son SIEMPRE el mismo número, con y sin anulaciones. */
export function resumenRevision(filas, anulados = new Set()) {
  const pedidas = filas.filter(f => f.estado !== 'demas');
  return {
    buenas: pedidas.filter(f => efectivoDe(f, anulados.has(f.pos)) === 'ok').length,
    total: pedidas.length,
  };
}

/** ANULAR = CAMBIAR LAS POSICIONES MARCADAS, y volver a preguntar al MISMO
 *  scorer. Es la única forma de que la anulación no abra una segunda aritmética:
 *  la ley del repo es un solo scorer por plantilla, y aquí se cumple sola porque
 *  el veredicto anulado se EXPRESA como lo que el alumno habría marcado.
 *    · dar por buena una que faltaba  → se añade su posición;
 *    · dar por mala una acertada, o perdonar una de más → se quita.
 *  Recalcular a mano «hits+1, points+ppc» habría sido más corto y habría dejado
 *  el puntaje del docente y el del scorer pudiendo divergir. */
export function valorAnulado(value, anulados, p, kind) {
  const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
  const v = new Set((value || []).map(Number));
  for (const pos of anulados) {
    if (want.has(pos)) { if (v.has(pos)) v.delete(pos); else v.add(pos); }
    else v.delete(pos);       // una marca de MÁS solo se puede perdonar
  }
  return [...v];
}

/** El panel. `anulable` lo decide el CALLER (§0): anular es cosa del docente con
 *  el aparato en la mano, no del alumno haciendo una tarea desde casa. */
function panelRevisionHtml(filas, anulados, { anulable }) {
  // El pie cuenta SOLO las marcas que la frase pedía: las de más no suman ni
  // restan aquí (restan en el puntaje, que es donde se ven). Así este «N / M» y
  // el «N/M aciertos» del veredicto son el mismo número siempre.
  const { buenas, total } = resumenRevision(filas, anulados);
  return `<aside class="tc-review-side" aria-label="Revisión">
    <h6 class="tc-review-side__t">Revisión</h6>
    <ul class="tc-review-list">
      ${filas.map(f => {
        const anulada = anulados.has(f.pos);
        // Anular una fila la repinta con lo que el docente acaba de decidir:
        // verlo aplicado es la mitad del sentido del botón.
        const efectivo = efectivoDe(f, anulada);
        return `<li class="tc-rev tc-rev--${efectivo}${anulada ? ' is-anulada' : ''}">
          <span class="tc-rev__ico" title="${TITULO[efectivo] || ''}">${ICONO[efectivo]}</span>
          <span class="tc-rev__w">${escapeHtml(f.palabra)}</span>
          ${anulable ? `<button type="button" class="tc-rev__btn" data-anular="${f.pos}"
            aria-pressed="${anulada}"
            title="${anulada ? 'Deshacer el cambio' : 'Cambiar el veredicto de esta palabra'}"
            aria-label="Cambiar el veredicto de ${escapeHtml(f.palabra)}">${anulada ? '↺' : (f.estado === 'ok' ? '✗' : '✓')}</button>` : ''}
        </li>`;
      }).join('')}
    </ul>
    <div class="tc-review-side__pie">${buenas} / ${total} correctas</div>
  </aside>`;
}

/** EL RELOJ GRANDE, en la barra que ya existe (dueño 2026-08-27, comparando con
 *  la app anterior: «un reloj grande que indica claramente que tenemos un tiempo
 *  límite»). Va AQUÍ y no como chip del HUD por una razón: el HUD son
 *  indicadores de esquina, pequeños y discretos, y este número la clase entera
 *  tiene que poder leerlo desde el fondo del aula. No crea franja nueva — la
 *  barra ya está puesta por el lápiz/borrador, que es lo que la justifica.
 *  Sin tiempo declarado no se pinta NADA: un reloj parado enseña que el tiempo
 *  no importa aquí, y el hueco vacío desplaza el resto de la barra. */
const relojHtml = (texto) =>
  texto == null ? '' : `<span class="tc-clock" data-reloj>${escapeHtml(String(texto))}</span>`;

// pulsar "Listo" (mismas posiciones que el modo tocar → scoring intacto).
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit, chips = {}, reloj = null, progreso = null } = {}) {
  const text = payload?.text || '';
  // El botón "Calibrar pizarra" NO va aquí (en el juego): vive en la pantalla de
  // inicio (views/startScreen.js), que es donde van los ajustes previos. En modo
  // tarea (alumno) no hay pizarra que calibrar, así que no debe aparecer nunca
  // durante el ejercicio.
  // LÁPIZ / BORRADOR: UN interruptor, no dos botones. La detección por tamaño de
  // contacto (core/penDetector.js) acierta casi siempre —punta dibuja, palma
  // borra—, pero "casi siempre" con 33 críos delante no basta: en una pizarra sin
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
  // MAQUETA (dueño, 2026-08-14): barra ARRIBA con el progreso y las
  // herramientas —como cualquier app de dibujo—, el texto arranca arriba con
  // aire a los costados, y el botón vive ABAJO. Antes las herramientas
  // flotaban en mitad de la pantalla, pegadas al texto, y todo quedaba
  // amontonado en la mitad superior. `chips` lo pasa el caller (HTML propio,
  // ya escapado): la ronda no sabe si corre en solo, carrera o duelo (§0).
  // El botón de PANTALLA COMPLETA va DENTRO de esta barra, no flotando en la
  // esquina del marco: cuando la ronda ya pinta una barra a todo el ancho, un
  // control suelto encima se lee como un segundo mando pegado al papel. La
  // esquina del marco sigue siendo del marco para todo lo demás — aquí la barra
  // la ocupa y por eso la ALOJA (CSS esconde la de la esquina si hay `.tc-bar`).
  // …pero SOLO cuando esta ronda es la pantalla entera (la que trae chips: solo,
  // carrera, tarea). En el duelo se montan DOS rondas, una por jugador: ahí un
  // botón de pantalla completa por panel serían dos mandos para el mismo marco,
  // y la esquina del marco —que es UNA— sigue siendo el sitio correcto.
  const propio = !!(chips.left || chips.right);
  root.innerHTML = `
    <div class="tc-round">
      <div class="edu-topbar tc-bar${propio ? ' tc-bar--fs' : ''}">
        ${/* LA PÁGINA VA DENTRO DE LA BARRA, no flotando en la esquina. El HUD
              pinta sus chips en las esquinas del marco y esta ronda YA tiene una
              barra a todo el ancho en esa misma franja: en un móvil de 390 el
              «1 / 2» se montaba encima del lápiz (medido: el chip acababa en 74 y
              el lápiz empezaba en 55). Dos dueños peleando por la misma tira.
              Con barra, el sitio del indicador es la barra. */''}
        ${chips.left ? `<span class="tc-pag">${escapeHtml(String(chips.left))}</span>` : ''}
        <button type="button" class="tc-switch" data-tool="pen" aria-pressed="false"
                title="Lápiz — toca para borrar" aria-label="Lápiz activo. Tocar para pasar al borrador">
          <span class="tc-switch__side tc-switch__side--pen" data-side="pen">
            ${LUCIDE.pencil}<span class="tc-switch__word">Lápiz</span>
          </span>
          <span class="tc-switch__side tc-switch__side--er" data-side="eraser">
            ${LUCIDE.eraser}<span class="tc-switch__word">Borrador</span>
          </span>
        </button>
        ${relojHtml(reloj)}
        ${propio ? fullscreenButtonHtml({ inline: true }) : ''}
      </div>
      ${/* La barra de agotamiento solo con CUENTA ATRÁS: el cronómetro
            ascendente no agota nada y una barra quieta a cero desinforma. */''}
      ${(progreso ?? reloj != null) ? '<div class="tc-progress" data-progreso><i></i></div>' : ''}
      <div class="edu-sec edu-sec--texto tc-passage-area"><div class="tc-passage">${passageHtml(text, kind)}</div></div>
      <div class="tc-done-wrap edu-send"><button type="button" class="btn btn-success btn-lg tc-done" data-ww-submit><i class="bi bi-check2-circle"></i> Listo</button></div>
    </div>`;

  const areaEl = root.querySelector('.tc-passage-area');
  const passageEl = root.querySelector('.tc-passage');
  // El texto LLENA el área disponible (grande en pantalla completa). Se monta el
  // canvas, se ajusta el tamaño de letra al hueco, y se recalculan las zonas.
  const draw = mountTcDraw(passageEl, { targets: passageEl.querySelectorAll('.tc-target') });
  const stopFit = fitPassage(areaEl, passageEl);

  // El botón de pantalla completa expande el MARCO del juego (el del profe o el
  // del alumno); si la ronda corre sin marco, la página entera.
  const marco = root.closest('.ww-player-frame') || document.documentElement;
  const soltarFs = propio
    ? attachFullscreenButton(root.querySelector('.tc-bar'), { target: marco })
    : () => {};

  let done = false;
  const submit = () => {
    if (done) return;
    done = true;
    stopFit();
    soltarFs();
    draw.freeze();
    onSubmit?.(draw.getMarked());
  };
  root.querySelector('.tc-done').addEventListener('click', submit);
  // EL MANDO: apagado = lápiz, encendido = borrador. Lo que diga se lo lleva el
  // canvas (`setEraser`).
  //
  // OJO con el gesto: al pasar de bolita a DOS PASTILLAS ETIQUETADAS, el mando
  // dejó de parecer un interruptor y pasó a parecer un selector — y con un
  // conmutador ciego, tocar la pastilla que YA estaba activa te cambiaba a la
  // otra. El alumno que está en «Lápiz» y toca «Lápiz» se llevaba el borrador, y
  // su siguiente trazo BORRABA una marca: en Tildes/Comas el puntaje es neto, así
  // que eso cuesta puntos sin decir nada. Manda el lado tocado; solo el hueco
  // entre pastillas conmuta.
  const sw = root.querySelector('.tc-switch');
  sw.addEventListener('click', (e) => {
    if (done) return;
    const lado = e.target.closest('.tc-switch__side')?.dataset.side;
    const borrar = lado ? lado === 'eraser' : !sw.classList.contains('is-on');
    if (borrar === sw.classList.contains('is-on')) return;   // ya estaba en ese
    sw.classList.toggle('is-on', borrar);
    sw.dataset.tool = borrar ? 'eraser' : 'pen';
    sw.setAttribute('aria-pressed', String(borrar));
    sw.title = borrar ? 'Borrador — toca para escribir' : 'Lápiz — toca para borrar';
    sw.setAttribute('aria-label', borrar
      ? 'Borrador activo. Tocar para volver al lápiz'
      : 'Lápiz activo. Tocar para pasar al borrador');
    draw.setEraser(borrar);
  });
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
    setReloj(texto, pct) {
      const el = root.querySelector('[data-reloj]');
      if (el) el.textContent = texto;
      const barra = root.querySelector('[data-progreso] i');
      // `scaleX`, no `width` (ver styles/textCorrection.css): animar el ancho
      // relayoutea la página entera en cada fotograma mientras corre el reloj.
      if (barra && pct != null) barra.style.transform = `scaleX(${Math.max(0, Math.min(100, pct)) / 100})`;
    },
  };
}

// Ajusta el tamaño de letra para que el texto LLENE el área (sin desbordar): el
// texto se ve grande en pantalla completa y se reajusta al cambiar de tamaño
// (fullscreen, rotación). Búsqueda binaria del font-size que cabe en ancho y alto.
// Devuelve una función para detener el observador (al congelar / cambiar de frase).
function fitPassage(areaEl, passageEl) {
  const fit = () => {
    const availW = areaEl.clientWidth, availH = areaEl.clientHeight;
    if (!availW || !availH) return;
    // MEDIDA TIPOGRÁFICA, no relleno. Dos correcciones del dueño con captura:
    // el tope a secas (220px) partía el texto del móvil en líneas de dos
    // palabras gigantes, y availW/12 seguía siendo enorme en PANTALLA COMPLETA
    // (el marco a 1900px daba 158px: tres líneas de borde a borde). Con
    // availW/18 la línea conserva ~30 letras — la maqueta de referencia ronda
    // las 40 por línea — y el piso de 26px mantiene el móvil marcable a dedo.
    let lo = 16, hi = Math.max(26, Math.min(200, availW / 18)), best = 16;
    for (let i = 0; i < 13; i++) {
      const mid = (lo + hi) / 2;
      passageEl.style.fontSize = mid + 'px';
      // Cabe si el contenido no desborda el área en ninguna dirección.
      if (passageEl.scrollWidth <= availW + 1 && passageEl.scrollHeight <= availH + 1) {
        best = mid; lo = mid;
      } else {
        hi = mid;
      }
    }
    passageEl.style.fontSize = best + 'px';
    // El canvas de dibujo observa passageEl y recalcula sus zonas solo.
  };
  // ANTI-TEMBLOR (dueño, con captura): al entrar en pantalla completa el marco
  // se agranda durante varios frames y cada uno re-ajustaba la letra — las
  // palabras se reordenaban en cascada, «como si temblara». El re-ajuste espera
  // a que el tamaño se ASIENTE (dos medidas iguales con 150 ms entre ellas) y
  // reflowea UNA vez. El primer ajuste sigue siendo inmediato: al abrir la
  // ronda no hay transición que esperar.
  let esperando = null, ultimo = '';
  const asentado = () => {
    esperando = null;
    const ahora = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (ahora !== ultimo) { ultimo = ahora; esperando = setTimeout(asentado, 150); return; }
    fit();
  };
  const stopRo = observeResize(areaEl, () => {
    ultimo = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (esperando) clearTimeout(esperando);
    esperando = setTimeout(asentado, 150);
  });
  requestAnimationFrame(fit);
  return () => { if (esperando) clearTimeout(esperando); stopRo(); };
}

// Projector (host) view for LIVE: the passage big and read-only. In the reveal
// phase, show the solution with the correct marks highlighted (green).
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

// Full SOLO runner shared by Tildes and Comas: paginate passages one per
// screen, tap to mark, "Listo" reveals the correct/wrong/missed marks, then
// advance. Puntúa NETO por marca (scoreMarksPerHit, la fuente única).
//
// C2 de la consolidación: corre sobre el SHELL libre (core/soloPlayer.js) — el
// shell pone timeUsed, la pantalla estándar (+ apéndice de revisión), el guardado
// (trySaveResult según persistPolicy) y la REANUDACIÓN F5, que este runner no
// tenía cuando era el "3er shell" con su copia manual de todo eso.
export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = {}) {
  const passages = (activity.content?.passages || []).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }
  const ppc = activity.scoring?.pointsPerCorrect || 1;
  // maxScore = total de marcas de la actividad (nº de tildes/comas a colocar).
  const totalMarks = passages.reduce((n, p) => n + (p.marks || []).filter(m => m.kind === kind).length, 0);
  const maxScore = activity.scoring?.maxScore || totalMarks * ppc || passages.length * ppc;

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let idx = 0, score = 0, hits = 0, misses = 0, over = 0;
  const passageResults = [];

  // Reanudar (F5): el snapshot guarda contadores + el detalle por frase en forma
  // serializable; `got`/`want` (Sets para la corrección visual) se reconstruyen.
  const wantOf = (p) => new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
  const saved = ctx.loadProgress();
  if (saved && Number.isInteger(saved.idx) && saved.idx > 0 && saved.idx < passages.length
      && Array.isArray(saved.results)) {
    idx = saved.idx; score = saved.score || 0;
    hits = saved.hits || 0; misses = saved.misses || 0; over = saved.over || 0;
    for (const r of saved.results) {
      const p = passages[r.i];
      if (!p) continue;
      passageResults.push({ p, got: new Set(r.got), want: wantOf(p), hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points });
    }
  }
  const snapshot = () => ({
    idx, score, hits, misses, over,
    results: passageResults.map((r, i) => ({ i, got: [...r.got], hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points })),
  });

  // `conFrase`: el chip «N / M» absoluto solo en las pantallas SIN barra (la
  // corrección); en la ronda el progreso viaja en la barra y duplicarlo estorba.
  const shell = (bodyHtml, { conFrase = true } = {}) => mount(rootSel, html`
    <div class="tc-solo">
      ${conFrase ? `<span class="tc-frase">${idx + 1} / ${passages.length}</span>` : ''}
      <div id="tc-body" class="tc-body">${bodyHtml}</div>
    </div>`);

  // EL TIEMPO ES POR HOJA (decisión del dueño, 2026-08-27). El campo ya existía
  // y nadie lo leía en Individual: `rules.timer` son «segundos por ítem», y en
  // Tildes/Comas un ítem ES una frase. No se inventa un campo nuevo — hacerlo
  // habría dejado dos sitios donde poner tiempo y ninguno claramente el bueno.
  // (OJO: `item.seconds` es otra cosa, se llama «Tiempo en vivo» y solo lo lee
  // el panel del host para la ventana de la ronda.)
  // El reloj lo decide y lo lleva `core/reloj.js` —el mismo que usan las otras
  // doce— y esta ronda solo dice DÓNDE se pinta: su propia barra, no el chip del
  // HUD. Antes tenía aquí su cuenta atrás y su cronómetro, copiados: por eso el
  // ajuste del editor acabó existiendo en unas plantillas sí y en otras no.
  const segundos = Math.max(0, Number(activity.rules?.timer) || 0);
  const inicioCrono = serverNow();   // mismo reloj que mide el primitivo (§22-5)
  let reloj = null;
  const pararReloj = () => { if (reloj) { reloj.stop(); reloj = null; } };

  function ask() {
    shell('', { conFrase: false });
    const body = document.getElementById('tc-body');
    const ronda = renderTextCorrectionRound(body, passages[idx], {
      kind, onSubmit: grade,
      // SIN CHIP DE PUNTOS. Lo puse en v1.51.612 «para que el puntaje viaje de
      // hoja en hoja» y el dueño lo quitó a la primera, con razón: el puntaje ya
      // sale en la corrección de cada frase y en la pantalla final, así que el
      // chip era un tercer sitio para el mismo número — y encima se solapaba con
      // el botón de pantalla completa, que vive en esa misma esquina.
      chips: { left: `${idx + 1} / ${passages.length}` },
      // El hueco del reloj se reserva si va a haber reloj; lo llena el módulo.
      reloj: relojDe(activity).tipo === 'ninguno' ? null : '⏱ ',
      progreso: segundos > 0,
    });
    pararReloj();
    reloj = montarReloj({
      activity,
      desde: inicioCrono,
      alive: () => ctx.alive(),
      pintar: (texto, pct) => ronda.setReloj(texto, pct),
      // Se acabó el tiempo: se entrega LO QUE HAYA. Ni se pierde el trabajo ni se
      // deja al alumno bloqueado en una hoja que ya no puede terminar.
      onFin: () => ronda.flush(),
    });
  }

  // ANULAR ES DEL DOCENTE, NO DEL ALUMNO (§22). El botón solo existe en
  // Individual —el modo que se juega con el aparato en la mano, en la pizarra—;
  // en Tarea el alumno juega solo y desde casa, y un botón para darse por bueno
  // convertiría el informe en una encuesta. Se pregunta por el MODO, que es lo
  // que la plataforma declara, no por quién creemos que está delante.
  const anulable = (!opts.mode || opts.mode === 'solo') && activity.review?.allowOverride !== false;

  // CORREGIR AL FINAL, POR DEFECTO (dueño 2026-08-27). Enseñar la corrección
  // entre frase y frase parte el trabajo del alumno: el que va bien pierde el
  // hilo y el que va mal se desanima a mitad. Al final, la hoja se ha hecho
  // entera y la corrección es lo que el PROFE repasa con la clase — que es
  // cuando de verdad sirve. Se puede apagar desde el editor para practicar con
  // realimentación inmediata, pero el defecto es el que pidió el aula.
  const alFinal = corrigeAlFinal(activity);

  /** Aplica las anulaciones del docente a una frase YA cerrada y ajusta los
   *  totales. Puntúa el MISMO scorer (nunca una suma a mano) y vive en un solo
   *  sitio porque lo usan los dos caminos: la corrección entre frases y la del
   *  final. Tenerlo dos veces era pedir que divergieran. */
  function recalcular(i, anulados) {
    const prev = passageResults[i];
    const rr = scoreMarksPerHit(valorAnulado([...prev.got], anulados, prev.p, kind), prev.p, [kind], activity);
    score += rr.points - prev.points;
    hits += rr.hits - prev.hits;
    over += rr.over - prev.over;
    misses += (rr.total - rr.hits) - prev.misses;
    Object.assign(prev, { hits: rr.hits, over: rr.over, misses: rr.total - rr.hits,
                          correct: rr.perfect, points: rr.points, anuladas: [...anulados] });
    return rr;
  }

  /** Pasar de frase: al final de la última, a la corrección o al resultado. */
  function siguiente() {
    if (idx === passages.length - 1) { alFinal ? corregirTodo() : finish(); return; }
    idx++; ctx.saveProgress(snapshot()); ask();
  }

  function grade(value) {
    pararReloj();
    const p = passages[idx];
    // MISMO scorer que VS/Equipos/Live/Tarea (fuente única): no reimplementamos
    // el conteo aquí. `want/got` solo alimentan la corrección visual y la analítica.
    const want = wantOf(p);
    const got = new Set((value || []).map(Number));
    const r = scoreMarksPerHit(value, p, [kind], activity);
    const miss = r.total - r.hits;
    score += r.points; hits += r.hits; misses += miss; over += r.over;
    // Guarda el detalle por frase (aciertos/fallos/de-más + posiciones + puntos) —
    // materia prima de la analítica por palabra del docente (F3).
    passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: r.over, total: r.total, correct: r.perfect, points: r.points });
    if (r.perfect) emitGame(GameEvents.ANSWER_CORRECT, { points: r.points });
    else emitGame(GameEvents.ANSWER_WRONG, {});
    if (alFinal) { siguiente(); return; }
    reveal(value, { hits: r.hits, over: r.over, misses: miss, total: r.total, correct: r.perfect });
  }


  function reveal(value, r) {
    const p = passages[idx];
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    const got = new Set(value.map(Number));
    const last = idx === passages.length - 1;
    const anulados = new Set();
    const filas = filasRevision(p, kind, got);
    // LA BARRA SIGUE AHÍ EN LA CORRECCIÓN. Sin ella, esta pantalla no tenía
    // `.tc-bar--fs` y el botón de pantalla completa volvía a la esquina
    // flotante: saltaba de sitio en cada frase (barra → esquina → barra). El
    // sitio de un mando no puede depender de en qué mitad del ejercicio estás.
    // Sin herramientas: aquí no se dibuja.
    shell(`
      <div class="tc-round">
        ${hudHtml({ pagina: `${idx + 1} / ${passages.length}` })}
        <div class="edu-topbar tc-bar tc-bar--fs">
          ${fullscreenButtonHtml({ inline: true })}
        </div>
        <div class="edu-sec edu-sec--texto tc-corrige">
          <div class="tc-passage-area"><div class="tc-passage">${passageHtml(p.text, kind, { got, want })}</div></div>
          <div class="tc-review-slot">${panelRevisionHtml(filas, anulados, { anulable })}</div>
        </div>
        <div class="tc-done-wrap edu-send">
          <span class="tc-verdict ${r.correct ? 'ok' : 'bad'}" data-verdicto>
            <i class="bi ${r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            ${r.hits}/${r.total} aciertos${r.over ? ` · ${r.over} de más` : ''}
          </span>
          <div class="mt-2"><button type="button" class="btn btn-primary btn-lg tc-next">
            ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
          </button></div>
        </div>
      </div>`, { conFrase: false });
    // ANULAR: se repinta el panel y se recalcula con el MISMO scorer. El
    // resultado de la frase NO se cierra hasta pulsar «Siguiente» — mientras el
    // docente está mirando la revisión, todavía puede cambiar de idea.
    const slot = document.querySelector('.tc-review-slot');
    slot?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-anular]');
      if (!b) return;
      const pos = Number(b.dataset.anular);
      if (anulados.has(pos)) anulados.delete(pos); else anulados.add(pos);
      slot.innerHTML = panelRevisionHtml(filas, anulados, { anulable });
      const rr = scoreMarksPerHit(valorAnulado(value, anulados, p, kind), p, [kind], activity);
      const v = document.querySelector('[data-verdicto]');
      if (v) {
        v.className = `tc-verdict ${rr.perfect ? 'ok' : 'bad'}`;
        v.innerHTML = `<i class="bi ${rr.perfect ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i> `
          + `${rr.hits}/${rr.total} aciertos${rr.over ? ` · ${rr.over} de más` : ''}`;
      }
    });

    // El texto de la corrección también LLENA el área (mismo tamaño grande).
    const areaEl = document.querySelector('.tc-passage-area');
    const passageEl = areaEl.querySelector('.tc-passage');
    const stopFit = fitPassage(areaEl, passageEl);
    const marco = areaEl.closest('.ww-player-frame') || document.documentElement;
    const soltarFs = attachFullscreenButton(document.querySelector('.tc-bar'), { target: marco });
    document.querySelector('.tc-next').addEventListener('click', () => {
      stopFit();
      soltarFs();
      // AQUÍ se cierra la frase, con las anulaciones ya aplicadas. `grade` dejó
      // un resultado provisional; si el docente tocó algo, se sustituye por el
      // que sale del scorer con las posiciones ajustadas — nunca por una suma
      // hecha a mano en esta vista.
      if (anulados.size) recalcular(passageResults.length - 1, anulados);
      siguiente();
    });
  }

  /** LA CORRECCIÓN AL FINAL — todas las hojas de una vez, cada una con su lista
   *  de palabras. Es a la vez la corrección del alumno y el RESUMEN POR PÁGINA
   *  del docente: con la hoja entera hecha, el profe la repasa con la clase y
   *  puede anular lo que quiera antes de cerrar el resultado.
   *  Nada se guarda hasta pulsar «Finalizar»: mientras se repasa todavía se
   *  puede cambiar de idea, y un puntaje que se cierra a mitad de la revisión no
   *  es el que el profe acabó dando. */
  function corregirTodo() {
    const anuladosDe = new Map(passageResults.map((_, i) => [i, new Set()]));
    const pinta = () => {
      shell(`
        <div class="tc-final">
          <div class="tc-final__cab">
            <b>Corrección</b>
            <span class="tc-final__tot" data-total>${hits} de ${totalMarks} · ${score} pts</span>
            <button type="button" class="btn btn-primary tc-fin"><i class="bi bi-flag-fill"></i> Finalizar</button>
          </div>
          ${passageResults.map((r, i) => `
            <section class="tc-final__hoja">
              <h6 class="tc-final__n">Frase ${i + 1}</h6>
              <div class="tc-final__cuerpo">
                <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
                <div class="tc-review-slot" data-hoja="${i}">
                  ${panelRevisionHtml(filasRevision(r.p, kind, r.got), anuladosDe.get(i), { anulable })}
                </div>
              </div>
            </section>`).join('')}
        </div>`, { conFrase: false });

      document.querySelector('.tc-final')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-anular]');
        if (b) {
          const i = Number(b.closest('[data-hoja]').dataset.hoja);
          const pos = Number(b.dataset.anular);
          const set = anuladosDe.get(i);
          if (set.has(pos)) set.delete(pos); else set.add(pos);
          recalcular(i, set);
          pinta();                       // re-pinta con los totales ya ajustados
          return;
        }
        if (e.target.closest('.tc-fin')) finish();
      });
    };
    pinta();
  }

  function finish() {
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score }] });
    // Con la corrección al final ya se han visto TODAS las hojas una por una:
    // repetir aquí las falladas es enseñar dos veces lo mismo en dos pantallas
    // seguidas.
    const wrongResults = alFinal ? [] : passageResults.filter(r => !r.correct);
    const reviewHtml = wrongResults.length ? `
      <div class="tc-review mt-4 text-start" style="max-width:900px;margin:0 auto;padding:0 1rem">
        <h5 class="mb-3"><i class="bi bi-search"></i> Revisión de errores</h5>
        ${wrongResults.map((r) => `
          <div class="tc-review-item mb-4">
            <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
          </div>`).join('')}
      </div>` : '';
    // El shell pinta la pantalla estándar (+ la revisión como apéndice), guarda el
    // resultado según persistPolicy y entrega `answers` a onFinish (analítica F3).
    ctx.finish({
      score, maxScore,
      lead: `Aciertos: <b>${hits}</b> / ${totalMarks}`,
      stats: ({ timeUsed }) => `${hits} aciertos · ${misses} sin marcar · ${over} de más · ${timeUsed}s`,
      after: reviewHtml,
      answers: passageResults.map((r, i) => ({ i, v: [...r.got], c: r.correct, p: r.points || 0 })),
    });
  }

  ask();
}

// Heatmap de analítica (M5): pinta el pasaje con cada marca REQUERIDA coloreada
// por el % de la clase que la acertó (verde ≥80 · ámbar 50-79 · rojo <50), con el
// % en pequeño. `parts` = itemStat.parts de esa frase ({key:pos, pctMarked}).
// Reutiliza applyTilde para mostrar la vocal acentuada / la coma en su sitio.
export function textHeatmapHtml(text, kind, parts) {
  const byPos = new Map((parts || []).map(p => [Number(p.key), p]));
  const s = String(text || '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const p = byPos.get(i);
    if (!p) { out += escapeHtml(s[i]); continue; }
    const cls = heatClass(p.pctMarked);
    const pct = Math.round(p.pctMarked * 100);
    const glyph = kind === 'tilde' ? escapeHtml(applyTilde(s[i])) : escapeHtml(s[i]) + '<b class="tc-heat__coma">,</b>';
    out += `<span class="tc-heat tc-heat--${cls}" title="${pct}% de la clase acertó">${glyph}<sup class="tc-heat__pct">${pct}%</sup></span>`;
  }
  return out;
}
