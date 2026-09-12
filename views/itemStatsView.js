// M5 — Vista de analítica por ítem/parte (la "información poderosa" para el
// docente). Genérica para cualquier plantilla (barras por parte, coloreadas por %
// de acierto de la clase) + heatmap sobre el texto para tildes/comas. Se monta en
// el podio del host (hostLive), en el informe de sesión y en los intentos de
// tarea (F3). Ver docs/historico/handoff-analitica-items.md.
import { escapeHtml } from '../core/html.js';
import { getTemplate } from '../core/registry.js';
import { esHojaDeTexto } from '../core/contentModels/textCorrection.js';
import { aggregate, heatClass } from '../core/itemStats.js';
import { textHeatmapHtml } from '../core/textCorrectionRound.js';

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/template.js').TemplateContract} Plantilla */
/** @typedef {import('../core/itemStats.js').Parte} Parte */
/** UNA ficha de la analítica, tal como la devuelve `aggregate`. */
/** @typedef {ReturnType<typeof aggregate>['items'][number]} FichaItem */

/**
 * El TEXTO de un ítem, si lo trae (las hojas de Tildes/Comas).
 * @param {unknown} item
 * @returns {string}
 */
function textoDe(item) {
  const t = (item && typeof item === 'object') ? /** @type {{text?: unknown}} */ (item).text : null;
  return typeof t === 'string' ? t : '';
}

/** @param {Activity|null|undefined} activity */
function itemsOf(activity) {
  const c = /** @type {Record<string, unknown[]|undefined>} */ (activity?.content || {});
  return c.items ?? c.entries ?? c.pairs ?? c.groups ?? c.words ?? c.passages ?? [];
}

// itemStatsHtml(activity, rows) → HTML. rows en la forma normalizada de answerRows.
/**
 * @param {Activity|null|undefined} activity
 * @param {import('../core/answerRows.js').AnswerRow[]|null|undefined} rows
 * @returns {string}
 */
export function itemStatsHtml(activity, rows) {
  // El registro guarda la meta ANCHA; `aggregate` pide el contrato exacto.
  const T = /** @type {Plantilla|null} */ (getTemplate(activity?.template));
  const items = itemsOf(activity);
  const stats = aggregate({ items, template: T, rows: rows ?? [], activity: activity ?? null });
  if (!stats.nPlayers) return `<p class="text-muted text-center py-3">Sin respuestas para analizar todavía.</p>`;
  const isText = esHojaDeTexto(activity);
  // Qué se marca lo DECLARA la plantilla (`meta.markNoun`), no el nombre del
  // fichero: era la última bandera `template === 'comas'` de esta vista.
  const kind = T?.meta?.markNoun || 'marca';
  return `<div class="istats">
    <p class="istats__head"><i class="bi bi-people-fill"></i> ${stats.nPlayers} ${stats.nPlayers === 1 ? 'participante' : 'participantes'} · análisis de aciertos por ${isText ? 'palabra' : 'ítem'}</p>
    ${stats.items.map((it, i) => itemBlock(it, items[i], isText, kind)).join('')}
  </div>`;
}

/**
 * @param {FichaItem} it
 * @param {unknown} item
 * @param {boolean} isText
 * @param {string} kind
 * @returns {string}
 */
function itemBlock(it, item, isText, kind) {
  if (!it.n) {
    return `<div class="istats-item istats-item--empty"><div class="istats-item__head"><b>${escapeHtml(it.label)}</b> · sin respuestas</div></div>`;
  }
  const pct = Math.round(it.pctCorrect * 100);
  // El ítem llega como lo guarde su plantilla: solo las hojas de texto traen
  // `text`, y solo en ellas `markNoun` es una marca de verdad (tilde/coma).
  const texto = textoDe(item);
  const heat = isText && texto
    ? `<div class="istats-heat tc-passage">${textHeatmapHtml(texto, /** @type {import('../core/textCorrectionRound.js').Marca} */ (kind), it.parts)}</div>` : '';
  const bars = it.parts.map(p => {
    const w = Math.round(p.pctMarked * 100);
    const cls = p.ok ? heatClass(p.pctMarked) : 'muted';
    return `<div class="istats-bar" title="${w}% de la clase">
      <span class="istats-bar__lbl">${escapeHtml(p.label)}${p.ok ? '' : ' <i class="bi bi-dash-circle"></i>'}</span>
      <span class="istats-bar__track"><span class="istats-bar__fill is-${cls}" style="width:${w}%"></span></span>
      <span class="istats-bar__pct">${w}%</span>
    </div>`;
  }).join('');
  /**
   * @param {string[]} names
   * @param {string} cls
   */
  const chips = (names, cls) => names.length
    ? `<span class="istats-who istats-who--${cls}">${names.map(n => `<span class="istats-chip">${escapeHtml(n)}</span>`).join('')}</span>` : '';
  const who = (it.correctNames?.length || it.wrongNames?.length)
    ? `<div class="istats-names">
         ${it.wrongNames?.length ? `<i class="bi bi-x-circle-fill text-danger"></i> ${chips(it.wrongNames, 'bad')}` : ''}
         ${it.correctNames?.length ? `<i class="bi bi-check-circle-fill text-success"></i> ${chips(it.correctNames, 'ok')}` : ''}
       </div>` : '';
  return `<div class="istats-item">
    <div class="istats-item__head"><b>${escapeHtml(it.label)}</b> · ${it.n} resp · ${pct}% acierto${it.extras ? ` · <span class="text-danger">${it.extras} marca(s) de más</span>` : ''}</div>
    ${heat}
    <div class="istats-bars">${bars}</div>
    ${who}
  </div>`;
}
