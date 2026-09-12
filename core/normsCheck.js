import { sinComentarios } from './sinComentarios.js';
// Normas transversales EJECUTABLES — escáner puro de fuente JS que convierte
// las reglas de CLAUDE.md ("Estándares transversales") en checks de máquina:
//
//   · resize-observer : NUNCA `new ResizeObserver(` fuera de core/observeResize.js
//                       (un RO directo cuyo callback muta layout dispara el aviso
//                       "ResizeObserver loop…"; el helper rAF-debounced es la norma).
//   · pb-filter       : NUNCA construir `?filter=` de PocketBase con
//                       `encodeURIComponent` en la misma expresión (no escapa la
//                       comilla simple → inyección/rotura del filtro). La norma es
//                       pbEscape/pbFilterParam (core/pbFilter.js).
//   · kernel-puro     : kernel/** es el cerebro PURO y determinista: sin
//                       `Date.now()` ni `new Date()` (el reloj se inyecta vía
//                       core/clock.js; sin esto los tests dejan de ser deterministas).
//   · fallo-mudo      : R6 del norte ("la clase no espera": fallar en silencio
//                       está PROHIBIDO) — un `catch {}` vacío que se traga una
//                       operación que el usuario PIDIÓ (guardar, borrar,
//                       entregar, sincronizar). El best-effort no se prohíbe: se
//                       exige DECIR el motivo en un comentario, que es justo
//                       cuando uno se da cuenta de si de verdad lo era.
//   · ls-dueno        : LEY DE DATOS (docs/leyes.md §21) aplicada al ALMACÉN —
//                       cada clave `ww.*` de localStorage/sessionStorage está
//                       DECLARADA en LS_OWNERS con UN dueño; nadie más la nombra.
//                       Sin esta regla `ww.nick` acabó declarada en dos vistas y
//                       `ww.skin` se leía sin que nadie la escribiera nunca.
//   · pb-dueno        : LEY DE DATOS (docs/leyes.md §21) — cada colección de
//                       PocketBase tiene UN módulo dueño; nadie más la nombra
//                       (ni por URL `collections/x` ni por literal 'x'). Un
//                       módulo nuevo que necesite esos datos pide un método al
//                       dueño, no hace fetch por su cuenta — así "parchar algo"
//                       escribiendo directo a la BD hace fallar CI.
//   · confianza-alumno: LEY DE CONFIANZA (docs/leyes.md §22) — el código del
//                       LADO ALUMNO (views/student*) no puede ni NOMBRAR los
//                       verbos del host (settleItem, endSession, startSession,
//                       kickPlayer, setSessionState, fetchSessionKey/Blob): el
//                       alumno AFIRMA, nunca liquida ni controla la sala. Para
//                       pedir la palabra tiene `claimQuestion`, que escribe
//                       SOLO el campo `ql` (fuera del blob de control).
//   · imagen-buscable : toda puerta de imagen de CONTENIDO ofrece las DOS vías —
//                       subir un archivo Y buscar una libre (core/imageSearchModal.js).
//                       «Etiqueta el diagrama» solo dejaba subir: quien quería un
//                       corazón humano no tenía ninguno en el móvil y no podía ni
//                       empezar. Las excepciones (perfil, avatar, fondo de partida)
//                       están declaradas con su motivo en ALLOW.
//   · reloj-primitivo : LEY DE VISTA (docs/leyes.md §23) — nunca `setInterval(`
//                       a pelo: un reloj repetitivo va por su primitivo
//                       (createCountdown / startDeadlineTicker /
//                       startElapsedTicker) o por `ctx.setInterval` (lifecycle,
//                       que lo limpia al salir de la ruta). Un interval crudo
//                       es el reloj zombi que repinta sobre la vista siguiente.
//   · reloj-sala      : LEY DE CONFIANZA §22-5 (docs/leyes.md) — un INSTANTE DE
//                       LA SALA (answers_open_at · deadline · started_at ·
//                       last_seen) lo estampa un aparato y lo leen otros, así
//                       que se compara y se sella con `serverNow()` (hora
//                       común), NUNCA con `clock.now()` (el reloj de este
//                       cacharro). Con un Android 10 s atrasado, el profe veía
//                       «Preparados… 9» y el alumno «19»; con 25 s, al alumno
//                       no se le abrían las respuestas y la pregunta se
//                       liquidaba «sin respuesta · 0 puntos».
//   · azar-primitivo  : LEY DE VISTA (docs/leyes.md §23), gemela de reloj-primitivo
//                       — el azar sale del PRIMITIVO `azar.random()`
//                       (core/azar.js) y el barajado, de su `shuffle`. Nadie
//                       nombra `Math.random` salvo los usos declarados en ALLOW
//                       con su motivo: IDs, confeti, partículas, jitter de
//                       reconexión y los PIN de sala y tarea, que deben ser
//                       IMPREDECIBLES (reproducirlos sería el fallo).
//                       Se paga en herramientas: `tools/shots.mjs` comparaba dos
//                       capturas del MISMO árbol y cantaba 2.500 píxeles de
//                       cambio porque Quiz baraja al montar, y el apaño fue
//                       apagar el barajado de UNA plantilla desde su `rules`.
//                       Prohibido también el Fisher–Yates a mano: estaba copiado
//                       en cuatro sitios y el dueño es `shuffle` de core/azar.js.
//                       Y prohibido reescribir el GENERADOR mismo: un mulberry32
//                       propio (templates/wordsearch/generator.js lo tenía) no
//                       nombra `Math.random` ni una vez y por eso era invisible a
//                       la regla — se caza por su FIRMA (la constante 4294967296
//                       = 2**32 que normaliza a [0,1), o las constantes de mezcla
//                       0x6D2B79F5/1831565813), fuera de core/azar.js, que ES la
//                       implementación permitida.
//   · icono-primitivo : gemela de las dos de arriba, para los ICONOS. El SVG en
//                       línea sale del PRIMITIVO `lucide()` (core/lucide.js);
//                       nadie pega a mano un icono —`viewBox="0 0 24 24"` con
//                       `stroke="currentColor"`, que es la firma de Lucide—
//                       fuera de ese fichero. Nació el 2026-09-02: el ayudante
//                       de SVG vivía dentro de textCorrectionRound y al pedir el
//                       dueño un reloj y un «maximizar» iba a quedar tecleado en
//                       tres módulos. Las ILUSTRACIONES no entran (la ruleta, las
//                       animaciones del duelo, los previos de la portada): tienen
//                       geometría propia, no son glifos de mando.
//   · id-rid          : LEY DE CONTENIDO (docs/leyes.md §24) — IDs SIEMPRE con
//                       `rid()` de core/ids.js, nunca `Math.random().toString(36)`
//                       a mano (estaba copiado en ~17 sitios con longitudes y
//                       prefijos dispares).
//   · almacen-crudo   : LEY DE DATOS (docs/leyes.md §21) aplicada al ALMACÉN,
//                       gemela de `ls-dueno` pero por el otro lado: `ls-dueno`
//                       vigila que cada CLAVE tenga un dueño; esta vigila que
//                       el ACCESO en sí pase por el wrapper. Ningún fichero
//                       fuera de `core/ls.js` nombra `localStorage.` /
//                       `sessionStorage.` / `globalThis.localStorage` — el
//                       barrido `tools/costuras-cableado.mjs` encontró 35
//                       sitios saltándose el portero (informativo entonces, sin
//                       CI detrás). Los wrappers `ls*`/`ss*` son el ÚNICO punto
//                       que sabe tratar la ausencia de storage (modo privado,
//                       sandbox estricto) y la cuota llena — un acceso directo
//                       no hereda ese tratamiento y revienta donde el wrapper
//                       no revienta. Excepciones en ALLOW_ALMACEN_CRUDO, con motivo.
//
// Lo consumen DOS runners (mismo patrón que core/templateContract.js):
//   · tests/norms.test.mjs — Node, recorre el filesystem COMPLETO (autoridad).
//   · core/selftest.js     — panel #/admin: humo del deploy sobre BROWSER_SCAN_FILES
//                            + los ficheros de plantilla derivados del registro.
// LA TABLA DE DUEÑOS Y EXCEPCIONES vive aparte (core/normsOwners.js): esto es
// el ESCÁNER. Se re-exporta lo que ya importaban otros módulos, para que el
// cambio no obligue a tocar a nadie más.
import { ALLOW, ALLOW_ALMACEN_CRUDO, CHROME_VIEWS, INSTANTES_SALA,
         LS_OWNERS, LS_PREFIXES, PB_OWNERS, PB_SCHEMA_OWNERS, BROWSER_SCAN_FILES }
  from './normsOwners.js';
export { ALLOW_ALMACEN_CRUDO, CHROME_VIEWS, LS_OWNERS, PB_OWNERS, BROWSER_SCAN_FILES };

const RE_ALMACEN_CRUDO = /\blocalStorage\s*\.|\bsessionStorage\s*\.|globalThis\.localStorage\b/;

// R6 · FALLAR EN SILENCIO ESTÁ PROHIBIDO. Un `catch {}` vacío alrededor de una
// operación que el usuario PIDIÓ (guardar, borrar, entregar…) es la forma más
// barata de perder el trabajo de una clase sin que nadie se entere.
const CATCH_VACIO_RE = /catch\s*(\([A-Za-z_$][\w$]*\))?\s*\{\s*\}/;
// Como CADENAS y no regex literal: escritos como identificadores, moduleRefs
// los contaría como "usados sin importar" en este mismo fichero (mismo truco
// que HOST_VERBS más abajo).
const VERBOS_USUARIO = ['save', 'remove', 'delete', 'submit', 'record', 'create', 'update',
  'patch', 'post', 'fetch', 'send', 'upload', 'publish', 'flush', 'settle', 'end' + 'Session'];
const VERBO_USUARIO_RE = new RegExp(`\\b(${VERBOS_USUARIO.join('|')})\\w*\\s*\\(`, 'i');
// Cualquier literal 'ww.…' que aparezca en el código.
const LS_LITERAL_RE = /['"`](ww\.[A-Za-z0-9_.]*)/g;

// Precompilado: nombre → regex que caza `collections/<x>` o el literal '<x>'.
const PB_RES = Object.keys(PB_OWNERS).map(c => ({
  coll: c,
  allow: [...PB_OWNERS[c], ...PB_SCHEMA_OWNERS],
  re: new RegExp(`collections/${c}(?![a-zA-Z_])|['"\`]${c}['"\`]`),
}));

// LEY DE CONFIANZA — verbos del HOST que el lado alumno no puede ni nombrar.
// (Como cadenas, no regex literal: si fueran identificadores, moduleRefs los
// contaría como "usados sin importar" en este mismo fichero.)
const HOST_VERBS = ['settleItem', 'endSession', 'startSession', 'kickPlayer', 'setSessionState',
  'fetchSessionKey', 'fetchSessionBlob'];
const HOST_VERBS_RE = new RegExp(`\\b(${HOST_VERBS.join('|')})\\b`);

// El intercambio de Fisher–Yates, escrito a mano: `[a[i], a[j]] = [a[j], a[i]]`.
// Con UNA retro-referencia basta (el array tiene que ser el mismo); pedir además
// que los índices se crucen era precisión que no compraba nada —un barajado con
// variable temporal se escapa de las dos formas— a cambio de un regex que nadie
// puede verificar de un vistazo. Comprobado sobre todo el repo: mismas líneas.
const BARAJADO_A_MANO = /\[\s*(\w+)\[[^\]]+\]\s*,\s*\1\[[^\]]+\]\]\s*=\s*\[\s*\1\[/;

// Firma de un mulberry32 escrito a mano: el divisor que normaliza el entero
// de 32 bits a [0,1) (4294967296 = 2**32) o las dos constantes de mezcla que
// usa siempre ese algoritmo, en hex o en decimal — ninguna de las tres tiene
// otro uso legítimo fuera de core/azar.js.
const MULBERRY32_FIRMA_RE = /\b(4294967296|0x6D2B79F5|1831565813)\b/i;

// Comentarios fuera. Era una regex copiada aquí y en tres barridos, y se
// tragaba medio core/selftest.js (un `/*` dentro de un comentario de línea):
// ese fichero llevaba INVISIBLE a estas reglas desde que existe. Ahora hay un
// dueño (core/sinComentarios.js), que recorre el fuente en vez de adivinarlo.
const blank = sinComentarios;

/**
 * Escanea UN fichero. `path` relativo a la raíz del repo (p.ej. "views/explore.js").
 * @param {string} path
 * @param {string} source
 * @returns {{path:string, line:number, rule:string, text:string}[]}
 */
export function scanNormsSource(path, source) {
  /** @type {{path:string, line:number, rule:string, text:string}[]} */
  const out = [];
  const crudas = String(source || '').split('\n');   // CON comentarios: el motivo se lee ahí
  const lines = blank(String(source || '')).split('\n');
  const allowed = (/** @type {string} */ rule) => (ALLOW[rule] || []).some(a => path.endsWith(a));
  lines.forEach((ln, i) => {
    if (/new\s+ResizeObserver\s*\(/.test(ln) && !allowed('resize-observer')) {
      out.push({ path, line: i + 1, rule: 'resize-observer', text: ln.trim() });
    }
    if (/filter=/.test(ln) && /encodeURIComponent\s*\(/.test(ln) && !allowed('pb-filter')) {
      out.push({ path, line: i + 1, rule: 'pb-filter', text: ln.trim() });
    }
    if (path.startsWith('kernel/') && /(Date\.now\s*\(|new Date\s*\(\s*\))/.test(ln)) {
      out.push({ path, line: i + 1, rule: 'kernel-puro', text: ln.trim() });
    }
    // almacen-crudo: SOLO core/ls.js habla directamente con el storage; el
    // resto pasa por lsGet/lsSet/lsDel/ssGet/ssSet/ssDel.
    if (!path.endsWith('core/ls.js')
        && !Object.keys(ALLOW_ALMACEN_CRUDO).some(a => path.endsWith(a))
        && RE_ALMACEN_CRUDO.test(ln)) {
      out.push({ path, line: i + 1, rule: 'almacen-crudo', text: ln.trim() });
    }
    for (const { coll, re, allow } of PB_RES) {
      if (re.test(ln) && !allow.some(a => path.endsWith(a))) {
        out.push({ path, line: i + 1, rule: 'pb-dueno', text: `[${coll}] ${ln.trim()}` });
      }
    }
    // ls-dueno: toda clave del almacén está DECLARADA y solo la nombra su dueño.
    // (`core/normsOwners.js` ES el registro: nombra todas por definición.)
    for (const m of (path.endsWith('core/normsOwners.js') ? [] : ln.matchAll(LS_LITERAL_RE))) {
      const clave = m[1];
      const pref = LS_PREFIXES.find(p => clave.startsWith(p));
      if (!pref) {
        out.push({ path, line: i + 1, rule: 'ls-dueno', text: `[${clave}] clave sin dueño declarado en LS_OWNERS` });
      } else if (!LS_OWNERS[pref].some(a => path.endsWith(a))) {
        out.push({ path, line: i + 1, rule: 'ls-dueno', text: `[${clave}] la escribe/lee ${path}, y su dueño es ${LS_OWNERS[pref][0]}` });
      }
    }
    // fallo-mudo: un `catch {}` VACÍO que se traga una operación que el usuario
    // PIDIÓ (guardar, borrar, entregar, sincronizar) sin decir por qué. R6 del
    // norte: "fallar en silencio está prohibido". No se prohíbe el best-effort
    // —hay teardowns y `setPointerCapture` que deben poder fallar—: se exige
    // DECIR el motivo en un comentario, que es cuando uno se da cuenta de si de
    // verdad lo era. El almacén local queda fuera (su aviso ya lo da core/ls.js
    // con `ww:storage-full`, y limpiar una clave que no está es inofensivo).
    if (CATCH_VACIO_RE.test(ln)) {
      const ctxTry = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
      const almacen = /(local|session)Storage/.test(ctxTry);
      const conMotivo = /\/\/|\/\*/.test(crudas[i] || '') || /\/\/|\*/.test(crudas[i - 1] || '');
      if (VERBO_USUARIO_RE.test(ctxTry) && !almacen && !conMotivo) {
        out.push({ path, line: i + 1, rule: 'fallo-mudo', text: ln.trim() });
      }
    }
    if (path.startsWith('views/student') && HOST_VERBS_RE.test(ln)) {
      out.push({ path, line: i + 1, rule: 'confianza-alumno', text: ln.trim() });
    }
    // `setInterval(` sin prefijo (ctx.setInterval y setIntervalFn( son legítimos).
    if (/(^|[^.\w])setInterval\s*\(/.test(ln) && !allowed('reloj-primitivo')) {
      out.push({ path, line: i + 1, rule: 'reloj-primitivo', text: ln.trim() });
    }
    if (/Math\.random\s*\(\s*\)\s*\.toString\s*\(\s*36\s*\)/.test(ln) && !allowed('id-rid')) {
      out.push({ path, line: i + 1, rule: 'id-rid', text: ln.trim() });
    }
    // azar-primitivo · el azar sale del PRIMITIVO, en TODO el repo.
    //
    // Dos correcciones de altitud, las dos aprendidas en caliente:
    // · El alcance era una lista de rutas (`kernel/`, `templates/` y tres
    //   ficheros de core NOMBRADOS). Eso lo hacía la única regla del fichero que
    //   mira solo donde se le dice: su modo de fallar era SILENCIOSO —un
    //   `core/loQueSea.js` nuevo que ordenase lo que ve la clase simplemente no
    //   se miraba—. Las otras diez escanean todo y declaran sus excepciones con
    //   motivo, y su modo de fallar es RUIDOSO. Ahora esta también.
    // · Se dejaba pasar `Math.random` como VALOR (`rnd = Math.random` en una
    //   firma) por considerar que «eso ES inyectarlo». No lo era: ningún
    //   llamador inyectaba nunca, así que el defecto era el que corría siempre y
    //   sembrar el azar no llegaba a la ruleta, a Pregunta en vivo ni al tablero
    //   de las Pelotas. Un parámetro cuyo defecto esquiva el primitivo ES el
    //   primitivo sin usar. Se inyecta pasando `azar.random` o una fuente
    //   sembrada; `Math.random` no se nombra fuera de ALLOW.
    if (!allowed('azar-primitivo')) {
      if (/Math\.random\b/.test(ln)) {
        out.push({ path, line: i + 1, rule: 'azar-primitivo', text: ln.trim() });
      }
      if (BARAJADO_A_MANO.test(ln)) {
        out.push({ path, line: i + 1, rule: 'azar-primitivo',
                   text: `barajado a mano; el dueño es shuffle() de core/azar.js — ${ln.trim()}` });
      }
      // Generador de azar PROPIO (mulberry32 a mano): no nombra Math.random,
      // así que las dos comprobaciones de arriba no lo ven. Se caza por su
      // firma — el divisor de normalización a [0,1) (2**32) o las constantes
      // de mezcla, en hex o en decimal. (Excluye este propio fichero: la
      // REGLA nombra sus tres constantes en texto plano para definirse.)
      if (!path.endsWith('core/normsCheck.js') && MULBERRY32_FIRMA_RE.test(ln)) {
        out.push({ path, line: i + 1, rule: 'azar-primitivo',
                   text: `generador de azar propio: usa mulberry32/semilla de core/azar.js — ${ln.trim()}` });
      }
    }
    // icono-primitivo · un icono pegado a mano. Se caza por la FIRMA de Lucide
    // (lienzo 24×24 + trazo que toma el color del texto): una ilustración con su
    // propia geometría no la cumple, así que la ruleta y las animaciones no
    // entran. (Excluye este fichero: la REGLA nombra la firma para definirse.)
    if (!allowed('icono-primitivo') && !path.endsWith('core/normsCheck.js')
        && /viewBox="0 0 24 24"/.test(ln) && /stroke="currentColor"/.test(ln)) {
      out.push({ path, line: i + 1, rule: 'icono-primitivo',
                 text: `icono pegado a mano: usa lucide() de core/lucide.js — ${ln.trim()}` });
    }
    // §22-5 · un instante de la SALA medido con el reloj de ESTE aparato.
    // (el patrón lleva clase de caracteres a propósito: escrito entero, el
    //  escáner de imports de moduleRefs lo lee como un uso de `clock` aquí)
    if (/c[l]ock\.now\s*\(\s*\)/.test(ln) && !allowed('reloj-sala')
        && INSTANTES_SALA.some(n => ln.includes(n))) {
      out.push({ path, line: i + 1, rule: 'reloj-sala', text: ln.trim() });
    }
  });
  // imagen-buscable · TODA puerta de imagen ofrece BUSCARLA (F6, 2026-08-13).
  // Es de FICHERO, no de línea: lo que se comprueba es que quien pide una
  // imagen de contenido tenga las DOS puertas. Nació porque «Etiqueta el
  // diagrama» solo dejaba subir: el dueño quería un corazón humano y no tenía
  // ninguno en el móvil, con lo que la actividad no se podía ni empezar. Un
  // editor nuevo que copie el bloque de subir y olvide el de buscar rompe CI —
  // que es lo que impide que la puerta se vuelva a cerrar en un sitio solo.
  // (los nombres van con clase de caracteres a propósito: escritos enteros, el
  //  escáner de imports de moduleRefs los lee como usos REALES en este fichero)
  if (/\b(u[p]loadMedia|r[e]adBackgroundImage)\s*\(/.test(blank(String(source || '')))
      && !/a[b]rirBuscadorImagenes/.test(String(source || ''))
      && !allowed('imagen-buscable')) {
    out.push({ path, line: 1, rule: 'imagen-buscable',
               text: 'pide una imagen pero no ofrece buscarla (core/imageSearchModal.js)' });
  }

  // chrome-boton · UNA gramática de botón en el panel del profe. Las vistas de
  // CHROME_VIEWS visten con la familia propia (.btn-ghost / .btn-primary-solid,
  // styles/home.css), no con la de Bootstrap. Nació de una captura del dueño:
  // «Crear actividad» llevaba `btn btn-primary` y salía en azul de Bootstrap,
  // con esquina afilada y otra altura, dentro de una barra crema/naranja —
  // «está horrible». Arreglarlo a mano en una vista no impide que la siguiente
  // pantalla del panel vuelva a nacer con Bootstrap, que es exactamente cómo
  // llegó: es un RATCHET, no una migración. Las vistas que aún no están en la
  // lista (admin, tareas, editor, informes…) siguen siendo legales; migrarlas
  // pide antes decidir las variantes que la familia no tiene (peligro, aviso).
  // El JUEGO queda fuera a propósito: allí manda el skin con sus tokens --ww-*.
  if (CHROME_VIEWS.includes(path) && /class="[^"]*\bbtn\s+btn-/.test(String(source || ''))) {
    const src = String(source || '').split(/\r?\n/);
    src.forEach((ln, i) => {
      if (/class="[^"]*\bbtn\s+btn-/.test(ln)) {
        out.push({ path, line: i + 1, rule: 'chrome-boton',
                   text: `botón de Bootstrap en una vista de chrome: usa .btn-ghost / .btn-primary-solid — ${ln.trim().slice(0, 90)}` });
      }
    });
  }
  // comilla-en-comentario · UN ACENTO GRAVE DENTRO DE UN COMENTARIO HTML CIERRA
  // LA PLANTILLA DE TEXTO. Las vistas escriben su markup con plantillas de texto
  // (backticks), así que un comentario HTML con acentos graves
  // dentro TERMINA la plantilla ahí: el fichero deja de parsearse y la página
  // entera muere con «SyntaxError: missing ) after argument list». Sin pista de
  // dónde, porque el error apunta al final del fichero.
  //
  // Ha pasado TRES veces en este proyecto (dos en playerView, una en adminView),
  // siempre por documentar bien: el hábito de citar código con acentos graves es
  // correcto en Markdown y letal aquí. No lo caza `node --check` (el fichero
  // sigue siendo sintaxis válida hasta que se lee entero) y no lo caza ningún
  // test de unidad: solo el navegador, o esto.
  {
    const src = String(source || '');
    const re = /<!--[\s\S]*?-->/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m[0].indexOf('`') === -1) continue;
      const linea = src.slice(0, m.index).split('\n').length;
      out.push({ path, line: linea, rule: 'comilla-en-comentario',
                 text: 'comentario HTML con acento grave: cierra la plantilla de texto y mata la página. '
                     + 'Escribe el nombre sin comillas.' });
    }
  }
  return out;
}

