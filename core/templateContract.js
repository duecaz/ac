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
  if (!Number.isInteger(m.templateVersion) || m.templateVersion < 1) issues.push(`meta.templateVersion inválido: ${m.templateVersion}`);
  if (!m.modes || typeof m.modes !== 'object') issues.push('meta.modes ausente');
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
  }
  // Preview de tarjeta obligatorio: cada plantilla declara su `previewHtml(act)`
  // → no hay switch central que olvidar y la miniatura no se desfasa del juego
  // (vive en la propia plantilla). Ver core/activityThumb.js / core/previewKit.js.
  if (typeof T.previewHtml !== 'function') issues.push('falta static previewHtml(act) (preview de tarjeta del home)');

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
  // hits/total = MÉRITO (docs/handoff-puntuacion.md §3): binarias 1/1 ó 0/1;
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
        issues.push(`scoreSubmission no devuelve el mérito {hits, total} (dio ${JSON.stringify(r)}) — ver docs/handoff-puntuacion.md`);
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
