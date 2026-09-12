// LOS SEIS REVISORES DEL CONTRATO DE PLANTILLA — uno por cosa que se comprueba.
//
// El contrato entero vivía en una función de 230 líneas: para saber qué se le
// exige a `meta.play` había que leer también las migraciones y la forma del
// scorer. Aquí cada revisor es PURO (recibe el contexto ya leído y devuelve
// problemas) y cabe en una línea:
//
//   · revisarMeta         — la ficha: etiqueta, icono, instrucciones, editor, familia
//   · revisarPolitica     — `meta.play`: cómo se comporta en cada modo (§0)
//   · revisarContenido    — modelo registrado, contenido por defecto y que sea jugable
//   · revisarCapacidades  — que los métodos que exige cada capacidad estén
//   · revisarScorer       — la FORMA del resultado {correct, points, hits, total}
//   · revisarMigracion    — §24: versión >1 exige migrar, y migrar es idempotente
//
// El orquestador (core/templateContract.js) arma el contexto y los encadena; los
// dos runners (la suite y el panel #/admin) siguen llamando al mismo sitio.
import { sessionItems } from '../kernel/content/sessionItems.js';
import { canAutoScoreRound, faltaParaLive } from './templateCapability.js';
import { LIVE_LOOPS } from './liveLoops.js';
import { mensajeDe } from './frontera.js';

/**
 * Lo que los seis revisores necesitan, leído UNA vez.
 * @typedef {Object} ContextoContrato
 * @property {import('./templateContract.js').PlantillaAuditada} T
 * @property {import('../kernel/contracts/template.js').BaseTemplateMeta} meta
 * @property {import('../kernel/contracts/contentModel.js').ContentModelContract|null|undefined} model
 * @property {import('../kernel/contracts/activity.js').ActivityContent|null} dc
 * @property {string[]} problemasContenido lo que ya falló al pedir `defaultContent()`
 * @property {import('../kernel/contracts/activity.js').Activity} act actividad sintética mínima
 */

/**
 * @template T
 * @param {T} o
 * @returns {T}
 */
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

/**
 * LA FICHA. Lo que la plantilla dice de sí misma antes de jugar a nada.
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarMeta({ meta: m }) {
  /** @type {string[]} */
  const issues = [];
  if (!String(m.label || '').trim()) issues.push('meta.label vacío');
  if (!String(m.icon || '').trim()) issues.push('meta.icon vacío');
  // Regla CLAUDE.md: instrucciones cortas obligatorias (las muestra la pantalla de inicio).
  if (!String(m.instructions || '').trim()) issues.push('meta.instructions vacío (obligatorio: lo muestra la pantalla de inicio)');
  // EL EDITOR SE DECLARA (R-B/R-D · plan del editor, 2026-08-13). Dos cosas que
  // la vista no puede adivinar sin conocer plantillas concretas (§0):
  //   · `elemento` — cómo se llama, en singular, lo que el profe AÑADE
  //     («pregunta», «par», «etiqueta»). De ahí sale el botón «+ Añadir …», que
  //     11 de 13 tenían y el diagrama no: sus pines se ponían clicando la
  //     imagen, escrito en una línea gris que nadie lee.
  //   · `primerPaso` — lo que se lee con la actividad VACÍA. Es lo que enseña,
  //     ahora que las actividades no nacen con contenido de muestra: la frase
  //     ocupa el sitio donde antes había ejemplos que tocaba borrar.
  // `generado: true` exime de `elemento` a las plantillas cuyo contenido NO es
  // una lista que el profe amplía, sino un tablero que la plantilla genera.
  if (!m.editor || typeof m.editor !== 'object') {
    issues.push("meta.editor ausente (declara { elemento: 'pregunta', primerPaso: '…' })");
  } else {
    const paso = String(m.editor.primerPaso || '').trim();
    if (paso.length < 25) issues.push('meta.editor.primerPaso: hace falta una frase que diga qué hacer primero, no una etiqueta');
    if (m.editor.generado) {
      if (m.editor.elemento) issues.push('meta.editor: `generado` y `elemento` a la vez — o el profe añade elementos, o los genera la plantilla');
    } else {
      const el = String(m.editor.elemento || '').trim();
      if (!el) issues.push("meta.editor.elemento ausente (el nombre SINGULAR de lo que se añade, o `generado: true`)");
      else if (/s$|^[A-Z]/.test(el)) issues.push(`meta.editor.elemento «${el}»: en SINGULAR y en minúscula (se usa dentro de «+ Añadir …»)`);
    }
  }
  if (!Number.isInteger(m.templateVersion) || m.templateVersion < 1) issues.push(`meta.templateVersion inválido: ${m.templateVersion}`);
  if (!m.modes || typeof m.modes !== 'object') issues.push('meta.modes ausente');
  // LAS DOS FAMILIAS (norte §4c): 'ejercicio' (el contenido lo pone el docente)
  // o 'juego' (lo genera la plantilla). Se DECLARA — no se adivina mirando el
  // contenido — porque de aquí se derivan decisiones de producto: un juego no se
  // manda como Tarea (no hay nada que evaluar y empuja al uso sin profe, §4d),
  // declara la HABILIDAD que entrena (es su eje de catálogo), y vive en la
  // estantería "Juegos", no en crear-actividad.
  if (!['ejercicio', 'juego'].includes(m.kind ?? '')) {
    issues.push(`meta.kind inválido: ${JSON.stringify(m.kind)} — declara 'ejercicio' o 'juego' (norte §4c)`);
  }
  if (m.kind === 'juego') {
    if (m.modes?.async) issues.push('un JUEGO no se ofrece como Tarea (§4c: no hay contenido del docente que evaluar)');
    if (!String(m.skill || '').trim()) issues.push("un JUEGO declara la HABILIDAD que entrena (meta.skill, p.ej. 'Lógica y deducción')");
  }
  return issues;
}

/**
 * LA POLÍTICA DE JUEGO declarada: cómo se comporta la plantilla en cada modo, en
 * vez de que cada vista lo adivine (vsView forzaba "carrera" a las 13, así que
 * en Quiz/Tildes el primero en acabar cortaba al otro — bug reportado por QA).
 *   play.vs    'race'  el primero que termina gana y cierra el duelo
 *              'points' espera a AMBOS y gana quien más suma
 *              'none'  la plantilla no se juega en VS
 *   play.teams 'turns' | 'board' | 'propio' | 'none'
 *   play.live  LISTA de los bucles que la plantilla soporta (§26,
 *              core/liveLoops.js): 'rounds' (pregunta→revelar) · 'race'
 *              (cada alumno a su ritmo) · 'board' (tablero compartido) ·
 *              'claim' (pedir la palabra, sin clave: puntúa el docente).
 *              [] = no se juega en vivo. Se acepta la forma heredada (string).
 *              Debe ser coherente con modes.live.
 *   play.retry (opcional) — en VS un fallo se reintenta (la calculadora).
 *   play.submit — CÓMO se manda una respuesta en la ronda (VS/Equipos/Live).
 *              'gesto'  el toque ES la respuesta (elegir opción, pinchar un
 *                       globo, resolver el tablero): CERO botones de envío.
 *              'boton'  se construye la respuesta y se confirma: EXACTAMENTE
 *                       UN control de envío, marcado con `data-ww-submit`.
 *              Obligatorio en toda plantilla con `renderRound`. Existe porque
 *              "cuántos toques cuesta responder" es una decisión de PRODUCTO
 *              (la pizarra es de un alumno con la clase mirando), y sin
 *              declararla nadie puede auditar que no se cuele un segundo
 *              botón. Lo vigila `tools/matrix-smoke.mjs` (cuenta los controles
 *              reales en el panel VS y los compara con lo declarado).
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarPolitica({ T, meta: m }) {
  /** @type {string[]} */
  const issues = [];
  const VS_POLICIES = ['race', 'points', 'none'];
  // 'propio' = la plantilla trae su mecánica de Equipos y su vista (Memoria);
  // la plataforma la monta aparte en vez de pintar la ronda genérica.
  const TEAMS_POLICIES = ['turns', 'board', 'propio', 'none'];
  const LIVE_POLICIES = [...LIVE_LOOPS, 'none'];
  if (!m.play || typeof m.play !== 'object') {
    issues.push("meta.play ausente (declara { vs: 'race'|'points'|'none', teams: 'turns'|'board'|'none', live: 'rounds'|'board'|'none' })");
    return issues;
  }
  if (!VS_POLICIES.includes(m.play.vs)) issues.push(`meta.play.vs inválido: ${JSON.stringify(m.play.vs)} (usa ${VS_POLICIES.join(' | ')})`);
  if (!TEAMS_POLICIES.includes(m.play.teams)) issues.push(`meta.play.teams inválido: ${JSON.stringify(m.play.teams)} (usa ${TEAMS_POLICIES.join(' | ')})`);
  // Quien juega Equipos con la ronda GENÉRICA tiene que poder pintarla; quien
  // declara 'propio' se monta aparte y no la necesita. Sin esta línea, la
  // única forma de saberlo era mirar si la plantilla se llamaba «memory».
  if (['turns', 'board'].includes(m.play.teams) && typeof T.renderRound !== 'function') {
    issues.push("meta.play.teams usa la ronda genérica pero no implementa renderRound (¿querías teams:'propio'?)");
  }
  // B6 (2026-09-02): quien declara VS (play.vs!=='none') se ofrece en la
  // vista de VS genérica (views/vsView.js) igual que 'turns'/'board' se
  // ofrecen en la de Equipos — la declaración es la que EXIGE la capacidad,
  // no al revés (kernel/session/vsMachine.js `isVsCompatible` lee esta misma
  // declaración, ya no adivina por typeof).
  if (m.play.vs !== 'none' && typeof T.renderRound !== 'function') {
    issues.push("meta.play.vs no es 'none' pero no implementa renderRound (VS necesita pintar la ronda)");
  }
  // `play.live` es una LISTA de bucles (§26); se tolera el string heredado.
  const liveRaw = /** @type {string[]} */ (Array.isArray(m.play.live) ? m.play.live : (m.play.live ? [m.play.live] : []));
  for (const l of liveRaw) {
    if (!LIVE_POLICIES.includes(l)) issues.push(`meta.play.live: "${l}" no es un bucle del catálogo (usa ${LIVE_LOOPS.join(' | ')} o [])`);
  }
  // B6: quien declara el bucle 'board' (§26) es a quien la pizarra del host
  // le pide renderRaceCell (views/live/hostTablero.js) — misma declaración,
  // misma exigencia que arriba con renderRound.
  if (liveRaw.includes('board') && typeof T.renderRaceCell !== 'function') {
    issues.push("meta.play.live incluye 'board' pero no implementa renderRaceCell (la pizarra del host no puede pintar el tablero)");
  }
  const liveLoops = liveRaw.filter(l => l !== 'none');
  if (m.modes?.live && liveLoops.length === 0) issues.push('incoherencia: modes.live=true pero play.live no declara ningún bucle (declara cómo corre en vivo)');
  if (!m.modes?.live && liveLoops.length > 0) issues.push('incoherencia: play.live declara bucles pero modes.live=false');
  if ('retry' in m.play && typeof m.play.retry !== 'boolean') issues.push('meta.play.retry debe ser booleano');
  // R2 del norte ("el profe no configura nada para empezar"), ACOTADA: las
  // opciones de partida existen como excepción declarada y con techo — máximo
  // DOS por plantilla y de 2 a 4 valores cada una, siempre con un vigente.
  // Sin este tope, la pantalla de inicio acaba siendo un formulario y R2 se
  // muere por acumulación, opción a opción razonable.
  if ('options' in m.play) {
    const opts = m.play.options;
    if (!Array.isArray(opts)) issues.push('meta.play.options debe ser una lista');
    else {
      if (opts.length > 2) issues.push(`meta.play.options: ${opts.length} opciones — el techo de R2 es 2 (más que eso es un formulario)`);
      for (const o of opts) {
        if (!o?.id || !Array.isArray(o.values) || o.values.length < 2 || o.values.length > 4) {
          issues.push(`meta.play.options «${o?.id || '?'}»: entre 2 y 4 valores (tiene ${o?.values?.length ?? 0})`);
        }
        if (typeof o?.get !== 'function' || typeof o?.set !== 'function') {
          issues.push(`meta.play.options «${o?.id || '?'}»: get/set obligatorios (el vigente viene YA elegido, R2)`);
        }
      }
    }
  }
  // Solo se exige a quien tiene ronda: una plantilla que no corre en
  // VS/Equipos/Live no manda respuestas por ahí y no tiene nada que declarar.
  const SUBMIT_KINDS = ['gesto', 'boton'];
  if (typeof T.renderRound === 'function' && !(m.play.submit && SUBMIT_KINDS.includes(m.play.submit))) {
    issues.push(`meta.play.submit inválido: ${JSON.stringify(m.play.submit)} — con renderRound hay que declarar cómo se envía (${SUBMIT_KINDS.join(' | ')})`);
  }
  return issues;
}

/**
 * EL CONTENIDO: modelo registrado, `defaultContent()` válido para ese modelo, y
 * que lo que produce sea JUGABLE en los modos que la plantilla ofrece.
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarContenido({ T, meta: m, model, dc, problemasContenido, act }) {
  const issues = [...problemasContenido];
  if (!model) issues.push(`meta.contentModel "${m.contentModel}" no está registrado en kernel/content/models.js`);
  if (dc && model) {
    const v = model.validate(dc);   // ContentModelContract: {ok, errors}
    if (v && v.ok === false) issues.push(`defaultContent no pasa validate() de "${m.contentModel}": ${(v.errors || []).join(', ')}`);
  }
  for (const fn of /** @type {Array<'defaultRules'|'defaultScoring'>} */ (['defaultRules', 'defaultScoring'])) {
    if (typeof m[fn] !== 'function') issues.push(`meta.${fn} no es función`);
  }
  if (dc && (canAutoScoreRound(T) || m.modes?.live)) {
    if (sessionItems(act).length < 1) {
      issues.push('defaultContent no produce ítems de sesión (sessionItems=0) pese a ofrecer rondas (VS/Equipos/Live)');
    }
  }
  return issues;
}

/**
 * COHERENCIA DE MÉTODOS POR CAPACIDAD. `renderRound` sin scorer o sin payload =
 * una ronda que se pinta pero no se puntúa (o no se puede construir):
 * VS/Equipos-auto quedarían a medias.
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarCapacidades({ T, meta: m }) {
  /** @type {string[]} */
  const issues = [];
  if (typeof T.renderRound === 'function') {
    if (typeof T.scoreSubmission !== 'function') issues.push('tiene renderRound pero no scoreSubmission (ronda sin puntuación)');
    if (typeof T.getRoundPayload !== 'function') issues.push('tiene renderRound pero no getRoundPayload (ronda sin datos)');
  }
  // Qué exige `modes.live` lo responde su DUEÑO (`core/templateCapability.js`),
  // el mismo al que pregunta `core/registry.js` al registrar: antes cada uno
  // llevaba su copia y no decían lo mismo.
  for (const falta of (m.modes?.live ? faltaParaLive(T) : [])) {
    issues.push(`modes.live sin ${falta}`);
  }
  return issues;
}

/**
 * LA FORMA DEL SCORER: {correct, points, hits, total} — nunca otra.
 * hits/total = MÉRITO (docs/historico/handoff-puntuacion.md §3): binarias 1/1 ó 0/1;
 * por partes (tildes) 3/8; total=0 = ítem no auto-puntuable (puntúa el profe).
 * Con el mérito obligatorio, tabla/heatmap/CSV leen igual todas las plantillas.
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarScorer({ T, dc, act }) {
  /** @type {string[]} */
  const issues = [];
  if (typeof T.scoreSubmission !== 'function' || !dc) return issues;
  const item = sessionItems(act)[0] ?? null;
  let r;
  // Sin `mode`: aquí solo se mira la FORMA del resultado, y el modo es
  // opcional en ScoreInput. Antes se mandaba `mode: 'contract'`, un valor
  // fuera de la unión declarada (`PointsMode`) que no leía nadie.
  try { r = T.scoreSubmission({ value: null, item, msTaken: 0, activity: act }); }
  catch { r = undefined; /* un scorer puede exigir un value con forma; no lo penalizamos */ }
  if (r !== undefined && r !== null) {
    if (typeof r !== 'object' || !('correct' in r) || typeof r.points !== 'number') {
      issues.push(`scoreSubmission devuelve ${JSON.stringify(r)} — el contrato es {correct, points, hits, total}`);
    } else if (!Number.isFinite(r.hits) || !Number.isFinite(r.total)) {
      issues.push(`scoreSubmission no devuelve el mérito {hits, total} (dio ${JSON.stringify(r)}) — ver docs/historico/handoff-puntuacion.md`);
    }
  }
  return issues;
}

/**
 * LEY DE CONTENIDO (§24). Si la plantilla subió su `templateVersion` es que la
 * forma del contenido cambió — el contenido viejo guardado en PB/localStorage
 * necesita el camino. Y migrar dos veces no puede cambiar nada.
 * @param {ContextoContrato} ctx
 * @returns {string[]}
 */
export function revisarMigracion({ T, meta: m, dc }) {
  /** @type {string[]} */
  const issues = [];
  if ((m.templateVersion || 1) > 1 && typeof T.migrateContent !== 'function') {
    issues.push(`templateVersion=${m.templateVersion} sin migrateContent: el contenido legado no tiene camino de subida`);
  }
  if (typeof T.migrateContent === 'function' && dc) {
    try {
      const once = T.migrateContent(clone(dc), m.templateVersion) ?? clone(dc);
      const twice = T.migrateContent(clone(once), m.templateVersion) ?? clone(once);
      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        issues.push('migrateContent NO es idempotente sobre defaultContent (migrar dos veces cambia el contenido)');
      }
    } catch (e) { issues.push(`migrateContent lanza sobre defaultContent: ${mensajeDe(e)}`); }
  }
  return issues;
}
