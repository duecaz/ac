// LA IA ESCRIBE EL CONTENIDO — núcleo PURO.
//
// Sin DOM y sin red propia: el `fetch` se INYECTA (igual que core/imageSearch.js),
// así que todo esto se prueba entero con respuestas grabadas y sin salir a
// internet. El diálogo vive aparte (core/aiContentModal.js) y la clave no está
// aquí ni puede estarlo: la app es estática y todo lo que llega al navegador se
// lee. La llamada al modelo la hace la Pi (`pb_hooks/aulareto.pb.js`), que es
// quien guarda la clave; este módulo habla con NUESTRO extremo, nunca con
// Gemini o Grok directamente. Plan completo en docs/handoff-ia-contenido.md.
//
// POR MODELO DE CONTENIDO, NO POR PLANTILLA (§0 · la plantilla DECLARA su
// modelo, el motor lo consume). Cinco modelos cubren once de las trece
// plantillas; escribirlo trece veces sería garantizar que se desincronizan.
//
// LO QUE MÁS IMPORTA DE ESTE FICHERO NO ES PEDIR, ES REVISAR. Un modelo de
// lenguaje devuelve lo que le parece, así que nada entra en la actividad del
// profe sin pasar por `interpretarRespuesta`: forma, contenido y las trampas
// propias de cada modelo (un distractor que también es correcto, una pareja que
// empareja con dos, una pista que contiene la palabra…). Lo que no cumple se
// DESCARTA y se cuenta por qué — nunca se cuela a medias (§24 · R6).
import { rid } from './ids.js';
import { parseRichText } from './textMarks.js';

// ── Qué sabe escribir, y con qué forma ───────────────────────────────────────
// `pide` es lo que se le manda a la Pi; el TEXTO del prompt vive en el hook (no
// aquí) para que este extremo no se pueda usar como un modelo de lenguaje
// gratis: se mandan datos, no instrucciones. Lo que sí vive aquí —y es lo que
// hay que poder probar— es cómo se lee y se depura la respuesta.
export const MODELOS_IA = {
  qa: {
    etiqueta: 'preguntas con respuesta',
    elemento: 'pregunta',
    // Lo que la Pi le pedirá al modelo, descrito para el profe (sale en el diálogo).
    describe: 'preguntas de opción múltiple: enunciado, la respuesta correcta y tres opciones falsas',
  },
  pairs: {
    etiqueta: 'parejas',
    elemento: 'pareja',
    describe: 'parejas para unir: cada una con su lado izquierdo y su lado derecho',
  },
  items: {
    etiqueta: 'preguntas abiertas',
    elemento: 'pregunta',
    describe: 'preguntas sueltas para que las responda la clase en voz alta (sin respuesta escrita)',
  },
  words: {
    etiqueta: 'palabras',
    elemento: 'palabra',
    describe: 'palabras sueltas del tema, cada una con una pista que la define sin nombrarla',
  },
  textCorrection: {
    etiqueta: 'frases para corregir',
    elemento: 'frase',
    describe: 'frases escritas CORRECTAMENTE, con sus tildes y sus comas puestas',
  },
};

/** ¿Sabe la IA escribir contenido de este modelo? */
export function iaSabeEscribir(modelo) {
  return Object.prototype.hasOwnProperty.call(MODELOS_IA, modelo);
}

// ── Utilidades de revisión ───────────────────────────────────────────────────
const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Compara como compara el juego: sin tildes ni mayúsculas (mismo criterio que
// `isCorrect` en core/contentModels/qa.js — si se comparara distinto, un
// distractor «Mexico» pasaría por bueno frente a la respuesta «México»).
const norm = (s) => txt(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * LEE LA RESPUESTA DEL MODELO Y LA DEJA LISTA (o la descarta).
 *
 * @param {string} modelo   uno de MODELOS_IA
 * @param {string|object} bruto  el JSON que devolvió el modelo (texto o ya parseado)
 * @param {object} [opts]
 * @param {boolean} [opts.palabrasComoTexto]  `words`: Sopa de Letras guarda
 *        cadenas sueltas y Crucigrama fichas con pista. Se pide siempre la ficha
 *        (la pista es lo que el Crucigrama no puede inventar) y aquí se aplana
 *        para la Sopa, en vez de generar dos veces.
 * @returns {{content: object|null, piezas: number, descartadas: string[], error: string|null}}
 */
export function interpretarRespuesta(modelo, bruto, opts = {}) {
  const vacio = { content: null, piezas: 0, descartadas: [], error: null };
  if (!iaSabeEscribir(modelo)) return { ...vacio, error: `No sé escribir contenido de tipo «${modelo}».` };

  let datos = bruto;
  if (typeof bruto === 'string') {
    // Los modelos suelen envolver el JSON en ```json … ```. Se limpia antes de
    // parsear en vez de fallar: es la forma de error más común y más tonta.
    const limpio = bruto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { datos = JSON.parse(limpio); }
    catch { return { ...vacio, error: 'La respuesta no vino en el formato esperado. Prueba otra vez.' }; }
  }
  const lista = Array.isArray(datos) ? datos : (Array.isArray(datos?.items) ? datos.items : null);
  if (!lista) return { ...vacio, error: 'La respuesta no traía una lista de elementos.' };

  const descartadas = [];
  const rechaza = (i, motivo) => { descartadas.push(`${i + 1}: ${motivo}`); return null; };

  if (modelo === 'qa') {
    const items = lista.map((it, i) => {
      const question = txt(it?.pregunta ?? it?.question);
      const answer = txt(it?.respuesta ?? it?.answer);
      if (!question) return rechaza(i, 'sin enunciado');
      if (!answer) return rechaza(i, 'sin respuesta correcta');
      const brutas = Array.isArray(it?.opciones ?? it?.options) ? (it.opciones ?? it.options) : [];
      // El distractor que TAMBIÉN es correcto es la trampa de este modelo: el
      // alumno acierta y la app le dice que no. No se puede detectar por la
      // forma, así que se quita todo lo que coincida con la respuesta.
      const distractores = [];
      for (const o of brutas) {
        const s = txt(o);
        if (!s || norm(s) === norm(answer)) continue;
        if (distractores.some(d => norm(d) === norm(s))) continue;   // ni repetidos
        distractores.push(s);
      }
      if (!distractores.length) return rechaza(i, 'sin ninguna opción falsa usable');
      const options = [answer, ...distractores].slice(0, 4);
      return {
        id: rid('q_'), question, answer,
        answerIdx: [0],
        options,
        image: null, audio: null,
      };
    }).filter(Boolean);
    if (!items.length) return { ...vacio, descartadas, error: 'Ninguna pregunta era utilizable.' };
    return { content: { items }, piezas: items.length, descartadas, error: null };
  }

  if (modelo === 'pairs') {
    const vistos = { izq: new Set(), der: new Set() };
    const pairs = lista.map((p, i) => {
      const left = txt(p?.izquierda ?? p?.left);
      const right = txt(p?.derecha ?? p?.right);
      if (!left || !right) return rechaza(i, 'le falta un lado');
      // UNO A UNO. Si «perro» empareja con «dog» y también con «can», el juego
      // marca error a quien acierta — y por la forma no se ve.
      if (vistos.izq.has(norm(left))) return rechaza(i, `«${left}» ya estaba a la izquierda`);
      if (vistos.der.has(norm(right))) return rechaza(i, `«${right}» ya estaba a la derecha`);
      vistos.izq.add(norm(left)); vistos.der.add(norm(right));
      return { id: rid('p_'), left, right };
    }).filter(Boolean);
    if (!pairs.length) return { ...vacio, descartadas, error: 'Ninguna pareja era utilizable.' };
    return { content: { pairs }, piezas: pairs.length, descartadas, error: null };
  }

  if (modelo === 'items') {
    const items = lista.map((it, i) => {
      const question = txt(it?.pregunta ?? it?.question ?? it);
      if (!question) return rechaza(i, 'vacía');
      return { id: rid('it_'), question, image: null };
    }).filter(Boolean);
    if (!items.length) return { ...vacio, descartadas, error: 'Ninguna pregunta era utilizable.' };
    return { content: { items }, piezas: items.length, descartadas, error: null };
  }

  if (modelo === 'words') {
    const vistas = new Set();
    const fichas = lista.map((w, i) => {
      const palabra = txt(w?.palabra ?? w?.word ?? w).toUpperCase();
      const pista = txt(w?.pista ?? w?.clue);
      if (!palabra) return rechaza(i, 'vacía');
      // Una sola palabra, solo letras: la rejilla no admite espacios ni signos.
      if (!/^[A-ZÑÁÉÍÓÚÜ]{2,}$/.test(palabra)) return rechaza(i, `«${palabra}» no es una palabra suelta de letras`);
      if (vistas.has(palabra)) return rechaza(i, `«${palabra}» repetida`);
      vistas.add(palabra);
      // La pista que CONTIENE la palabra regala la respuesta. Se descarta la
      // pista, no la palabra: la palabra sigue sirviendo (y en la Sopa no hay pista).
      const limpia = pista && !norm(pista).includes(norm(palabra)) ? pista : '';
      if (pista && !limpia) descartadas.push(`${i + 1}: la pista de «${palabra}» contenía la palabra`);
      return { id: rid('w_'), word: palabra, clue: limpia };
    }).filter(Boolean);
    if (!fichas.length) return { ...vacio, descartadas, error: 'Ninguna palabra era utilizable.' };
    const words = opts.palabrasComoTexto ? fichas.map(f => f.word) : fichas;
    return { content: { words }, piezas: fichas.length, descartadas, error: null };
  }

  if (modelo === 'textCorrection') {
    const passages = lista.map((p, i) => {
      const frase = txt(p?.frase ?? p?.text ?? p);
      if (!frase) return rechaza(i, 'vacía');
      // LAS POSICIONES NO LAS CALCULA LA IA. Se le pide la frase BIEN ESCRITA y
      // `parseRichText` (core/textMarks.js) deriva texto+marcas exactos — el
      // mismo camino por el que entra una frase pegada a mano en el editor.
      // Pedirle índices al modelo era el mayor riesgo del plan: un carácter de
      // desplazamiento marca mal al alumno que acierta.
      const { text, marks } = parseRichText(frase);
      if (!text) return rechaza(i, 'vacía');
      if (!marks.length) return rechaza(i, `«${frase}» no tiene ninguna tilde ni coma que corregir`);
      return { id: rid('ps_'), text, marks };
    }).filter(Boolean);
    if (!passages.length) return { ...vacio, descartadas, error: 'Ninguna frase era utilizable.' };
    return { content: { passages }, piezas: passages.length, descartadas, error: null };
  }

  return { ...vacio, error: `No sé escribir contenido de tipo «${modelo}».` };
}

/**
 * AÑADE lo propuesto a lo que la actividad YA tiene (decisión del dueño,
 * 2026-08-18). Nunca reemplaza: lo escrito a mano no se pierde (§24). Con la
 * actividad vacía —el caso normal— el resultado es el mismo que reemplazar.
 * No muta: devuelve contenido nuevo.
 */
export function fusionarContenido(actual, nuevo) {
  if (!nuevo) return actual;
  const clave = ['items', 'pairs', 'words', 'passages'].find(k => Array.isArray(nuevo[k]));
  if (!clave) return actual;
  const previas = Array.isArray(actual?.[clave]) ? actual[clave] : [];
  // Lo que estaba EN BLANCO no cuenta como trabajo del profe: las plantillas
  // nacen con una pieza vacía (R-D) y conservarla dejaría un hueco delante de
  // lo que acaba de escribir la IA.
  const utiles = previas.filter(p => !enBlanco(p));
  return { ...actual, [clave]: [...utiles, ...nuevo[clave]] };
}

function enBlanco(p) {
  if (typeof p === 'string') return txt(p) === '';
  if (!p || typeof p !== 'object') return true;
  return !['question', 'left', 'right', 'word', 'text', 'answer'].some(k => txt(p[k]) !== '');
}

/**
 * PIDE el contenido a NUESTRO extremo (la Pi). No conoce a Gemini ni a Grok:
 * quien elige el proveedor y guarda la clave es el hook.
 *
 * @param {object} p
 * @param {string} p.modelo    modelo de contenido a escribir
 * @param {string} p.tema      de qué va (lo escribe el profe)
 * @param {number} p.cantidad  cuántas piezas
 * @param {string} [p.curso]   a quién va dirigido («5.º de primaria»)
 * @param {string} p.url       extremo (lo compone quien llama, con PB_URL)
 * @param {string} [p.token]   sesión del profe — sin ella el hook no responde
 * @param {Function} [p.fetchFn]
 * @param {boolean} [p.palabrasComoTexto]
 */
export async function pedirContenido({
  modelo, tema, cantidad = 8, curso = '', url, token = '',
  fetchFn = fetch, palabrasComoTexto = false, signal,
} = {}) {
  if (!iaSabeEscribir(modelo)) throw new Error(`No sé escribir contenido de tipo «${modelo}».`);
  if (!txt(tema)) throw new Error('Escribe de qué va la actividad.');

  let r;
  try {
    r = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify({ modelo, tema: txt(tema), cantidad: Math.max(1, Math.min(20, Number(cantidad) || 8)), curso: txt(curso) }),
      signal,
    });
  } catch {
    // R6: el motivo, no un «algo falló». Sin red es el caso más frecuente y el
    // que el profe puede resolver solo.
    throw new Error('No se pudo conectar. Comprueba la conexión a internet.');
  }

  if (!r.ok) {
    const cuerpo = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) throw new Error('Necesitas entrar con tu cuenta para usar la IA.');
    if (r.status === 429) throw new Error(cuerpo?.message || 'Has llegado al límite de generaciones por hoy. Mañana se renueva.');
    if (r.status === 501 || r.status === 503) throw new Error('La IA todavía no está configurada en el servidor.');
    // 404 = la RUTA no existe, que es distinto de «falta la clave»: significa
    // que el hook no está instalado en la Pi. PocketBase contesta con su
    // «The requested resource wasn't found», que es cierto y no sirve de nada
    // — el mensaje tiene que decir qué hacer, no qué pasó (R6).
    if (r.status === 404) {
      throw new Error('El servidor no tiene instalado el asistente de IA '
        + '(falta pb_hooks/aulareto.pb.js en la Pi). Pasos en docs/handoff-ia-contenido.md §7.');
    }
    throw new Error(cuerpo?.message || `El servidor respondió ${r.status}.`);
  }

  const cuerpo = await r.json().catch(() => null);
  if (!cuerpo) throw new Error('La respuesta del servidor no se pudo leer.');
  return interpretarRespuesta(modelo, cuerpo.contenido ?? cuerpo, { palabrasComoTexto });
}
