// ¿ESTÁ LISTA PARA JUGAR? — qué le falta a una actividad, dicho para el PROFE.
//
// Nació de un hallazgo del dueño (2026-08-14): subió el dibujo de «Etiqueta el
// diagrama», dejó las etiquetas sin escribir y la app lo dejó JUGAR. En el
// juego no había nada que arrastrar. Su frase: «no debe dejar probar o
// continuar si no se escriben las etiquetas, en rojo lo que falte — es el
// comportamiento esperado en cualquier aplicación a la que le faltan datos».
//
// DÓNDE VIVE Y POR QUÉ. Aquí, y por MODELO DE CONTENIDO, no por plantilla:
// «una pareja necesita sus dos lados» es verdad para Emparejar y para Memory
// igual, y trece copias divergen (es exactamente lo que pasó con la tarjeta de
// actividad). Trece plantillas, siete modelos, un solo sitio.
//
// NO es `MODELS[x].validate()`, que ya existe y se queda: aquello comprueba la
// FORMA para el código («items must be an array») y su público es el
// programador. Esto comprueba si el contenido SIRVE PARA JUGAR y su público es
// quien va a dar la clase, así que habla en español y señala el elemento.
//
// Puro: sin DOM y sin red, para que la vista y el test vean lo mismo.
import { getTemplate } from './registry.js';
import { escapeHtml } from './html.js';
// Los predicados «¿esto se puede jugar?» los pone el DUEÑO de cada modelo, que
// es quien ya los usa al jugar: si el guardián y el player no comparten regla,
// el guardián aprueba lo que el player luego encoge en silencio.
import { pairComplete } from './contentModels/pairs.js';
import { pinUsable } from './contentModels/diagram.js';
import { hasCorrectAnswer } from './contentModels/qa.js';

const vacio = (s) => !String(s ?? '').trim();

/** ¿Este elemento está entero en blanco? Varios editores SIEMBRAN filas vacías
 *  al abrir (Emparejar pone 4) y los players ya las ignoran al jugar: son sitio
 *  libre para escribir, no un error que reprochar. Solo se reclama lo empezado
 *  A MEDIAS, que es lo que rompe la partida sin avisar. `id` no cuenta. */
function enBlanco(el) {
  if (el == null) return true;
  if (typeof el === 'string') return vacio(el);
  if (Array.isArray(el)) return el.every(enBlanco);
  if (typeof el === 'object') {
    return Object.entries(el).every(([k, v]) => k === 'id' || enBlanco(v));
  }
  // Números y booleanos NO son contenido: son ajustes sembrados por la
  // plantilla (`points: 1`, `random: true`). Contarlos hacía que un Quiz recién
  // creado —la plantilla más usada— naciera «no vacío» y recibiera la lista
  // roja de reproches en vez de la pista azul de por dónde empezar.
  return true;
}
/** Los elementos que el profe ha EMPEZADO (los del todo en blanco no cuentan). */
const empezados = (lista) => (lista || []).map((el, i) => ({ el, i })).filter(({ el }) => !enBlanco(el));

// Qué le falta al CONTENIDO, por modelo. Cada uno devuelve frases de humano.
// El índice se dice SIEMPRE (1-based): «la etiqueta 3» se encuentra; «hay una
// etiqueta vacía» obliga a buscarla a ojo, que es la mitad del problema.
const POR_MODELO = {
  qa: (c) => {
    const out = [];
    empezados(c.items).forEach(({ el: it, i }) => {
      if (vacio(it.question)) out.push(`La pregunta ${i + 1} está sin escribir.`);
      // La marca NO basta: si el profe borra el TEXTO de la opción marcada,
      // `answerIdx` sigue apuntando a ella y `answer` queda en blanco — el
      // scorer da 0 a todo. Se mira lo que de verdad hay escrito.
      const textos = Array.isArray(it.answerIdx) && it.answerIdx.length
        ? it.answerIdx.map(k => (it.options || [])[k])
        : [Array.isArray(it.answer) ? it.answer.join('') : it.answer];
      const marcada = textos.some(t => !vacio(t));
      // Sin respuesta correcta TODO se cuenta como fallo y nadie se entera hasta
      // el podio: es el mismo agujero que cazó tools/edit-audit.mjs.
      if (!marcada) out.push(`La pregunta ${i + 1} no tiene marcada la respuesta correcta.`);
      // Las dos opciones se piden SOLO a quien juega con opciones, y eso se
      // reconoce por lo ESCRITO, no por la forma: `newEmpty()` siembra cuatro
      // opciones vacías en TODO el modelo `qa`, Operaciones incluida, así que
      // «tiene array de opciones» dejaba injugable el teclado numérico. Con una
      // sola opción escrita sí falta la otra: elegir entre una cosa no es elegir.
      else if ((it.options || []).filter(o => !vacio(o)).length === 1) {
        out.push(`La pregunta ${i + 1} necesita al menos dos opciones.`);
      }
    });
    return out;
  },
  pairs: (c) => {
    const out = [];
    empezados(c.pairs).forEach(({ el: p, i }) => {
      if (!pairComplete(p)) out.push(`La pareja ${i + 1} está a medias: necesita sus dos lados.`);
    });
    return out;
  },
  items: (c) => {
    const out = [];
    empezados(c.items).forEach(({ el: it, i }) => {
      if (vacio(it.question) && !it.image) out.push(`El elemento ${i + 1} está sin escribir.`);
    });
    return out;
  },
  words: (c) => {
    const out = [];
    empezados(c.words).forEach(({ el: w, i }) => {
      const palabra = typeof w === 'string' ? w : w?.word;
      if (vacio(palabra)) out.push(`La palabra ${i + 1} está vacía.`);
      else if (typeof w === 'object' && w && 'clue' in w && vacio(w.clue)) out.push(`La palabra «${palabra}» no tiene pista.`);
    });
    return out;
  },
  textCorrection: (c) => {
    const out = [];
    empezados(c.passages).forEach(({ el: p, i }) => {
      if (vacio(p.text)) out.push(`El texto ${i + 1} está vacío.`);
      // Sin marcas no hay nada que encontrar: se juega y se gana sin hacer nada.
      else if (!(p.marks || []).length) out.push(`El texto ${i + 1} no tiene ninguna marca señalada: no habría nada que buscar.`);
    });
    return out;
  },
  diagram: (c) => {
    const out = [];
    if (!c.image) out.push('Falta el dibujo de fondo.');
    (c.pins || []).forEach((p, i) => {
      if (!pinUsable(p)) out.push(`La etiqueta ${i + 1} está sin escribir.`);
    });
    return out;
  },
  entries: (c) => {
    const out = [];
    empezados(c.entries).forEach(({ el: e, i }) => {
      if (vacio(e?.text ?? e)) out.push(`El elemento ${i + 1} está vacío.`);
    });
    return out;
  },
  // Nota: el contenido GENERADO (Pelotas) NO tiene entrada aquí a propósito.
  // Tenía una que devolvía [] solo para que pasara la prueba de cobertura, y eso
  // hacía que «sin revisor» significara dos cosas distintas: «generado, no hay
  // nada que escribir» y «modelo nuevo que se nos olvidó». Ahora se salta por
  // `meta.editor.generado`, que es donde la plantilla ya lo declara.
};

/** ¿No hay NADA escrito todavía? Es el estado que ve quien acaba de crear la
 *  actividad, y pide una pista (el primer paso), no una lista de reproches.
 *  Vive aquí, con `enBlanco`, para que el editor y el jugador no discrepen —
 *  discrepaban: uno contaba elementos y el otro miraba si había texto. */
export function sinEscribirNada(a) {
  return enBlanco(a?.content);
}

/** LA PANTALLA de «esto todavía no se puede jugar», entera y una sola vez.
 *  La pintaban el jugador, el lanzador de salas y el de tareas, cada uno con su
 *  redacción; la del profe llegaba a decir «La actividad no tiene preguntas» en
 *  una pantalla sin salida. Devuelve HTML ya escapado.
 *  @param {object} a  la actividad  @param {object} rev  su revisión */
export function pantallaNoListaHtml(a, rev) {
  const titulo = escapeHtml(a?.title || 'Sin título');
  return `
    <div class="alert ${rev.vacia ? 'alert-info' : 'alert-danger'} d-flex align-items-start gap-2">
      <i class="bi ${rev.vacia ? 'bi-lightbulb' : 'bi-exclamation-triangle-fill'} mt-1"></i>
      <div>
        <b>«${titulo}» ${rev.vacia ? 'todavía está vacía.' : 'aún no se puede jugar.'}</b>
        ${problemasListaHtml(rev.problemasDeJuego)}
        ${rev.vacia ? `<div class="mt-1">${escapeHtml(rev.primerPaso)}</div>` : ''}
      </div>
    </div>
    <div class="d-flex gap-2 flex-wrap">
      <a class="btn btn-primary" href="#/edit/${encodeURIComponent(a?.id || '')}"><i class="bi bi-pencil"></i> Editar la actividad</a>
      <a class="btn btn-outline-secondary" href="#/home"><i class="bi bi-arrow-left"></i> Volver</a>
    </div>`;
}

/** La lista de problemas en HTML, ya escapada. Vive junto a quien la produce
 *  porque el editor y el jugador la pintaban por su cuenta: dos copias del
 *  mismo `<ul>` y dos sitios donde acordarse de escapar. */
export function problemasListaHtml(problemas) {
  return `<ul class="mb-0 mt-1 ps-3">${(problemas || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
}

/** Los modelos que este revisor sabe mirar (lo usa su test de cobertura). */
export function modelosRevisados() { return Object.keys(POR_MODELO); }

/**
 * ¿Qué le falta a esta actividad para poder jugarse?
 * @returns {{listo:boolean, jugable:boolean, problemas:string[],
 *            problemasDeJuego:string[], faltaTitulo:boolean, vacia:boolean,
 *            primerPaso:string}}
 *   listo     todo en orden, título incluido → lo mira el EDITOR
 *   jugable   nada que rompa la partida (el título no cuenta) → lo miran las
 *             puertas del juego, y la diferencia está explicada abajo
 *   vacia     no hay NADA escrito: toca la pista del primer paso, no reproches
 */
export function revisarActividad(a) {
  const T = getTemplate(a?.template);
  const problemas = [];

  // 1 · EL TÍTULO, que es el primer dato (decisión del dueño). Sin él, la
  // tarjeta de la portada y el podio dicen «Sin título», y con quince
  // actividades ninguna se distingue de la siguiente.
  //
  // PERO NO IMPIDE JUGAR, y la diferencia importa: `migrate` pone «Sin título»
  // por defecto, así que atarlo a la puerta del juego dejaría INJUGABLE una
  // actividad completa traída del banco compartido sin título. Se reclama donde
  // se arregla —el editor— y se separa de lo que sí rompe la partida.
  const faltaTitulo = vacio(a?.title) || String(a.title).trim() === 'Sin título';

  // 2 · SIN NADA ESCRITO. La frase NO intenta declinar el nombre del elemento
  // («ninguna par», «ninguna elemento»): quien sabe decirlo bien es la propia
  // plantilla, en su `primerPaso`, que va escrito en español de verdad y es lo
  // que se pinta al lado.
  const generado = !!T?.meta?.editor?.generado;
  if (generado) {
    // Los tableros los pone la máquina: no hay nada escrito que reclamar.
  } else if (sinEscribirNada(a)) {
    problemas.push('Todavía no tiene contenido.');
  } else {
    const revisor = POR_MODELO[T?.meta?.contentModel];
    if (revisor) problemas.push(...revisor(a?.content || {}));
  }

  // Las dos listas se construyen POR SEPARADO. Antes la de juego salía de
  // filtrar la otra por el principio de la frase («Falta el título…»): reescribir
  // ese texto —o traducirlo— habría hecho que el título bloqueara la partida,
  // que es exactamente lo que el párrafo de arriba dice que nunca puede pasar.
  return {
    listo: !faltaTitulo && problemas.length === 0,
    jugable: problemas.length === 0,        // lo que mira la puerta del juego
    problemas: faltaTitulo ? ['Falta el título de la actividad.', ...problemas] : problemas,
    problemasDeJuego: problemas,
    faltaTitulo,
    vacia: sinEscribirNada(a),
    primerPaso: T?.meta?.editor?.primerPaso || 'Ábrela en Editar y añade su contenido.',
  };
}
