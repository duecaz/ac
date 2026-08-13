// Contrato de plantilla EJECUTABLE — un solo checker puro que verifica todo lo
// que HOW_TO_ADD.md / CLAUDE.md exigen a una plantilla. Lo consumen DOS runners:
//   · tests/templateContract.test.mjs  (suite Node, CI)
//   · core/selftest.js                 (panel #/admin, "Ejecutar tests")
// Así una actividad NUEVA queda cubierta automáticamente al registrarse, sin
// escribir tests propios — y las reglas que antes solo vivían en un MD (p.ej.
// "meta.instructions es obligatorio", "el scorer devuelve {correct, points}")
// fallan en CI/admin en vez de romperse en silencio a mitad de partida.
//
// Sin DOM, sin red: solo registry + modelos de contenido + el motor puro.
import { sessionItems } from '../kernel/session/engine.js';
import { getModel } from '../kernel/content/models.js';
import { canAutoScoreRound } from './templateCapability.js';
import { LIVE_LOOPS } from './liveLoops.js';

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

/**
 * Verifica UNA plantilla contra el contrato completo.
 * @param {any} T Template class (como sale de listTemplates()).
 * @returns {string[]} problemas encontrados (vacío = cumple).
 */
// El catálogo de bucles vive en core/liveLoops.js (§26): aquí solo se valida.
export function checkTemplateContract(T) {
  const issues = [];
  const m = T?.meta;
  if (!m?.name) return ['sin meta.name — no es una plantilla registrable'];

  // ── meta obligatoria ──────────────────────────────────────────────────────
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
  if (!['ejercicio', 'juego'].includes(m.kind)) {
    issues.push(`meta.kind inválido: ${JSON.stringify(m.kind)} — declara 'ejercicio' o 'juego' (norte §4c)`);
  }
  if (m.kind === 'juego') {
    if (m.modes?.async) issues.push('un JUEGO no se ofrece como Tarea (§4c: no hay contenido del docente que evaluar)');
    if (!String(m.skill || '').trim()) issues.push("un JUEGO declara la HABILIDAD que entrena (meta.skill, p.ej. 'Lógica y deducción')");
  }
  // POLÍTICA DE JUEGO declarada: cómo se comporta la plantilla en cada modo, en
  // vez de que cada vista lo adivine (vsView forzaba "carrera" a las 13, así que
  // en Quiz/Tildes el primero en acabar cortaba al otro — bug reportado por QA).
  //   play.vs    'race'  el primero que termina gana y cierra el duelo
  //              'points' espera a AMBOS y gana quien más suma
  //              'none'  la plantilla no se juega en VS
  //   play.teams 'turns' | 'board' | 'none'
  //   play.live  LISTA de los bucles que la plantilla soporta (§26,
  //              core/liveLoops.js): 'rounds' (pregunta→revelar) · 'race'
  //              (cada alumno a su ritmo) · 'board' (tablero compartido) ·
  //              'claim' (pedir la palabra, sin clave: puntúa el docente).
  //              [] = no se juega en vivo. Se acepta la forma heredada (string).
  //              Debe ser coherente con modes.live.
  //   play.retry (opcional) — en VS un fallo se reintenta (la calculadora).
  //   play.submit — CÓMO se manda una respuesta en la ronda (VS/Equipos/Live).
  //              'gesto'  el toque ES la respuesta (elegir opción, pinchar un
  //                       globo, resolver el tablero): CERO botones de envío.
  //              'boton'  se construye la respuesta y se confirma: EXACTAMENTE
  //                       UN control de envío, marcado con `data-ww-submit`.
  //              Obligatorio en toda plantilla con `renderRound`. Existe porque
  //              "cuántos toques cuesta responder" es una decisión de PRODUCTO
  //              (la pizarra es de un alumno con la clase mirando), y sin
  //              declararla nadie puede auditar que no se cuele un segundo
  //              botón. Lo vigila `tools/matrix-smoke.mjs` (cuenta los controles
  //              reales en el panel VS y los compara con lo declarado).
  const VS_POLICIES = ['race', 'points', 'none'];
  const TEAMS_POLICIES = ['turns', 'board', 'none'];
  const LIVE_POLICIES = [...LIVE_LOOPS, 'none'];
  if (!m.play || typeof m.play !== 'object') {
    issues.push("meta.play ausente (declara { vs: 'race'|'points'|'none', teams: 'turns'|'board'|'none', live: 'rounds'|'board'|'none' })");
  } else {
    if (!VS_POLICIES.includes(m.play.vs)) issues.push(`meta.play.vs inválido: ${JSON.stringify(m.play.vs)} (usa ${VS_POLICIES.join(' | ')})`);
    if (!TEAMS_POLICIES.includes(m.play.teams)) issues.push(`meta.play.teams inválido: ${JSON.stringify(m.play.teams)} (usa ${TEAMS_POLICIES.join(' | ')})`);
    // `play.live` es una LISTA de bucles (§26); se tolera el string heredado.
    const liveRaw = Array.isArray(m.play.live) ? m.play.live : (m.play.live ? [m.play.live] : []);
    for (const l of liveRaw) {
      if (!LIVE_POLICIES.includes(l)) issues.push(`meta.play.live: "${l}" no es un bucle del catálogo (usa ${LIVE_LOOPS.join(' | ')} o [])`);
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
    if (typeof T.renderRound === 'function' && !SUBMIT_KINDS.includes(m.play.submit)) {
      issues.push(`meta.play.submit inválido: ${JSON.stringify(m.play.submit)} — con renderRound hay que declarar cómo se envía (${SUBMIT_KINDS.join(' | ')})`);
    }
  }
  // (Aquí se exigía `static previewHtml(act)`. Se retiró en v1.51.406: su ÚNICO
  // consumidor era core/activityThumb.js, que NADIE importaba desde que
  // core/homePreview.js pasó a pintar las tarjetas. Eran 285 líneas repartidas
  // en las 13 plantillas y, peor, una obligación FALSA para cada plantilla
  // nueva: el contrato pedía un preview que no se veía en ninguna pantalla,
  // mientras tests/homePreview.test.mjs exigía el otro, el que sí se ve.)

  // ── modelo de contenido registrado + defaultContent válido ────────────────
  const model = getModel(m.contentModel);
  if (!model) issues.push(`meta.contentModel "${m.contentModel}" no está registrado en kernel/content/models.js`);
  let dc = null;
  if (typeof m.defaultContent !== 'function') {
    issues.push('meta.defaultContent no es función');
  } else {
    try { dc = m.defaultContent(); } catch (e) { issues.push(`defaultContent() lanza: ${e.message}`); }
    if (dc && model) {
      const v = model.validate(dc);   // ContentModelContract: {ok, errors}
      if (v && v.ok === false) issues.push(`defaultContent no pasa validate() de "${m.contentModel}": ${(v.errors || []).join(', ')}`);
    }
  }
  for (const fn of ['defaultRules', 'defaultScoring']) {
    if (typeof m[fn] !== 'function') issues.push(`meta.${fn} no es función`);
  }

  // ── coherencia de métodos por capacidad ───────────────────────────────────
  // renderRound sin scorer o sin payload = una ronda que se pinta pero no se
  // puntúa (o no se puede construir): VS/Equipos-auto quedarían a medias.
  if (typeof T.renderRound === 'function') {
    if (typeof T.scoreSubmission !== 'function') issues.push('tiene renderRound pero no scoreSubmission (ronda sin puntuación)');
    if (typeof T.getRoundPayload !== 'function') issues.push('tiene renderRound pero no getRoundPayload (ronda sin datos)');
  }
  if (m.modes?.live) {
    if (typeof T.getRoundPayload !== 'function') issues.push('modes.live sin getRoundPayload');
    if (typeof T.scoreSubmission !== 'function' && typeof T.renderRoundHost !== 'function') {
      issues.push('modes.live sin scoreSubmission ni renderRoundHost (ni auto-puntúa ni proyecta)');
    }
  }

  // ── el contenido default debe ser JUGABLE en los modos que ofrece ─────────
  const act = { id: '_contract', template: m.name, content: dc || {}, scoring: safeCall(m.defaultScoring) || {} };
  if (dc && (canAutoScoreRound(T) || m.modes?.live)) {
    if (sessionItems(act).length < 1) {
      issues.push('defaultContent no produce ítems de sesión (sessionItems=0) pese a ofrecer rondas (VS/Equipos/Live)');
    }
  }

  // ── forma del scorer: {correct, points, hits, total} — nunca otra ──────────
  // hits/total = MÉRITO (docs/historico/handoff-puntuacion.md §3): binarias 1/1 ó 0/1;
  // por partes (tildes) 3/8; total=0 = ítem no auto-puntuable (puntúa el profe).
  // Con el mérito obligatorio, tabla/heatmap/CSV leen igual las 13 plantillas.
  if (typeof T.scoreSubmission === 'function' && dc) {
    const item = sessionItems(act)[0] ?? null;
    let r;
    try { r = T.scoreSubmission({ value: null, item, msTaken: 0, activity: act, mode: 'contract' }); }
    catch { r = undefined; /* un scorer puede exigir un value con forma; no lo penalizamos */ }
    if (r !== undefined && r !== null) {
      if (typeof r !== 'object' || !('correct' in r) || typeof r.points !== 'number') {
        issues.push(`scoreSubmission devuelve ${JSON.stringify(r)} — el contrato es {correct, points, hits, total}`);
      } else if (!Number.isFinite(r.hits) || !Number.isFinite(r.total)) {
        issues.push(`scoreSubmission no devuelve el mérito {hits, total} (dio ${JSON.stringify(r)}) — ver docs/historico/handoff-puntuacion.md`);
      }
    }
  }

  // ── Ley de contenido (§24): versión >1 EXIGE saber migrar ─────────────────
  // Si la plantilla subió su templateVersion es que la forma del contenido
  // cambió — el contenido viejo guardado en PB/localStorage necesita el camino.
  if ((m.templateVersion || 1) > 1 && typeof T.migrateContent !== 'function') {
    issues.push(`templateVersion=${m.templateVersion} sin migrateContent: el contenido legado no tiene camino de subida`);
  }

  // ── migrateContent idempotente sobre el contenido default ────────────────
  if (typeof T.migrateContent === 'function' && dc) {
    try {
      const once = T.migrateContent(clone(dc), m.templateVersion) ?? clone(dc);
      const twice = T.migrateContent(clone(once), m.templateVersion) ?? clone(once);
      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        issues.push('migrateContent NO es idempotente sobre defaultContent (migrar dos veces cambia el contenido)');
      }
    } catch (e) { issues.push(`migrateContent lanza sobre defaultContent: ${e.message}`); }
  }

  return issues;
}

function safeCall(fn) { try { return typeof fn === 'function' ? fn() : null; } catch { return null; } }

/**
 * Corre el contrato sobre TODAS las plantillas dadas.
 * @param {any[]} templates listTemplates()
 * @returns {{name:string, issues:string[]}[]} solo las que fallan.
 */
export function checkAllTemplates(templates) {
  return templates
    .map(T => ({ name: T?.meta?.name || '(sin nombre)', issues: checkTemplateContract(T) }))
    .filter(r => r.issues.length);
}
