// Contrato de plantilla EJECUTABLE — el ORQUESTADOR. Lee la plantilla UNA vez
// (meta, modelo de contenido, contenido por defecto, actividad sintética) y pasa
// ese contexto por los SEIS REVISORES de `core/templateRevisores.js`, que son
// puros y se leen uno a uno. Lo consumen DOS runners:
//   · tests/templateContract.test.mjs  (suite Node, CI)
//   · core/selftest.js                 (panel #/admin, "Ejecutar tests")
// Así una actividad NUEVA queda cubierta automáticamente al registrarse, sin
// escribir tests propios — y las reglas que antes solo vivían en un MD (p.ej.
// "meta.instructions es obligatorio", "el scorer devuelve {correct, points}")
// fallan en CI/admin en vez de romperse en silencio a mitad de partida.
//
// Sin DOM, sin red: solo registry + modelos de contenido + el motor puro.
import { getModel } from '../kernel/content/models.js';
import { mensajeDe } from './frontera.js';
import { revisarMeta, revisarPolitica, revisarContenido, revisarCapacidades,
         revisarScorer, revisarMigracion } from './templateRevisores.js';

/** Los seis revisores, en el orden en que se leen. */
const REVISORES = [
  revisarMeta, revisarPolitica, revisarContenido, revisarCapacidades, revisarScorer, revisarMigracion,
];
/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */

/**
 * Lo que se puede AUDITAR: el contrato entero en opcional, con la meta ANCHA
 * (`BaseTemplateMeta`) que es la que guarda el registro — `listTemplates()` es
 * el llamante principal.
 * @typedef {Partial<Omit<import('../kernel/contracts/template.js').TemplateStatic, 'meta'>>
 *   & {meta?: import('../kernel/contracts/template.js').BaseTemplateMeta}} PlantillaAuditada
 */

/**
 * Verifica UNA plantilla contra el contrato completo.
 * Lo que entra es lo que se DIAGNOSTICA: una plantilla que puede estar a medio
 * escribir. Por eso `Partial` — exigir el contrato en la firma haría imposible
 * comprobarlo.
 * @param {PlantillaAuditada} T
 * @returns {string[]} problemas encontrados (vacío = cumple).
 */
// El catálogo de bucles vive en core/liveLoops.js (§26): aquí solo se valida.
export function checkTemplateContract(T) {
  const m = T?.meta;
  if (!m?.name) return ['sin meta.name — no es una plantilla registrable'];

  // ── El contexto, leído UNA vez para los seis ──────────────────────────────
  const model = getModel(m.contentModel ?? '');
  /** @type {string[]} */
  const problemasContenido = [];
  /** @type {import('../kernel/contracts/activity.js').ActivityContent|null} */
  let dc = null;
  if (typeof m.defaultContent !== 'function') {
    problemasContenido.push('meta.defaultContent no es función');
  } else {
    try { dc = /** @type {import('../kernel/contracts/activity.js').ActivityContent} */ (m.defaultContent()); }
    catch (e) { problemasContenido.push(`defaultContent() lanza: ${mensajeDe(e)}`); }
  }
  // Actividad SINTÉTICA mínima: lo que el contrato necesita para pedir ítems de
  // sesión y una puntuación de muestra.
  const act = /** @type {Activity} */ ({ id: '_contract', template: m.name, content: dc || {}, scoring: safeCall(m.defaultScoring) || {} });

  const ctx = { T, meta: m, model, dc, problemasContenido, act };
  return REVISORES.flatMap(revisar => revisar(ctx));
}

/** @param {(() => unknown)|undefined} fn */
function safeCall(fn) { try { return typeof fn === 'function' ? fn() : null; } catch { return null; } }

/**
 * Corre el contrato sobre TODAS las plantillas dadas.
 * @param {PlantillaAuditada[]} templates listTemplates()
 * @returns {{name:string, issues:string[]}[]} solo las que fallan.
 */
export function checkAllTemplates(templates) {
  return templates
    .map(T => ({ name: T?.meta?.name || '(sin nombre)', issues: checkTemplateContract(T) }))
    .filter(r => r.issues.length);
}
