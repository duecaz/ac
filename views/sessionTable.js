// VISTA de la matriz alumno×ítem (HTML + CSV). El MODELO —quién gana, cuántos
// aciertos, la hora de meta— vive en `core/sessionModel.js`: aquí solo se pinta
// (§0: la plataforma no decide reglas de juego).
import { escapeHtml } from '../core/html.js';
import { heatClass } from '../core/itemStats.js';
import { mmss } from '../core/timings.js';
import { buildSessionTable } from '../core/sessionModel.js';

function cellHtml(c) {
  if (!c) return `<td class="st-cell st-cell--none">—</td>`;
  if (!c.binary) {   // ítem con varias partes (Tildes/Comas): "4/5" coloreado
    const pct = c.total ? c.hits / c.total : 0;
    return `<td class="st-cell st-cell--${heatClass(pct)}" title="${c.hits} de ${c.total} bien${c.points ? ` · ${c.points} pts` : ''}">${c.hits}/${c.total}</td>`;
  }
  const cls = c.correct === true ? 'ok' : c.correct === false ? 'bad' : 'meh';
  const corrected = c.correct === false && (c.points || 0) > 0;   // falló y lo corrigió (carrera)
  const icon = c.correct === true ? '<i class="bi bi-check-lg"></i>'
    : c.correct === false ? (corrected ? '<i class="bi bi-x-lg"></i><sup class="st-fix">↻</sup>' : '<i class="bi bi-x-lg"></i>')
    : '·';
  return `<td class="st-cell st-cell--${cls}" title="${corrected ? 'Falló al 1er intento, luego lo corrigió' : (c.points || 0) + ' pts'}">${icon}</td>`;
}

// `opts.race` = la partida fue una CARRERA → se añade la columna META. Ahí el
// orden lo decide el tiempo (todos acaban con todas bien), así que una tabla sin
// esa columna no permite entender —ni reconstruir— la clasificación.
export function sessionTableHtml(rows, nItems, opts = {}) {
  const { players, perItem } = buildSessionTable(rows, nItems, opts);
  if (!players.length) return `<p class="text-muted text-center py-3">Sin respuestas todavía.</p>`;
  const race = !!opts.race;
  const head = perItem.map((it, i) =>
    `<th class="st-qh" title="${escapeHtml(it.label)}">P${i + 1}<br><small>${it.pct == null ? '—' : it.pct + '%'}</small></th>`).join('');
  const body = players.map((p, rank) => `
    <tr>
      <td class="st-name">${rank < 3 ? ['🥇','🥈','🥉'][rank] + ' ' : ''}${escapeHtml(p.name)}</td>
      ${p.cells.map(cellHtml).join('')}
      <td class="st-total" title="${p.marks}/${p.maxMarks} aciertos · ${p.total} pts">${p.marks}<small class="text-muted"> ac.</small></td>
      ${race ? `<td class="st-total">${p.finishMs >= 0 ? mmss(p.finishMs) : '—'}</td>` : ''}
    </tr>`).join('');
  return `<div class="st-wrap"><table class="st-table">
    <thead><tr><th class="st-name">Alumno</th>${head}<th class="st-total">Aciertos</th>${race ? '<th class="st-total">Meta</th>' : ''}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

export function sessionTableCsv(rows, nItems, opts = {}) {
  const { players, perItem } = buildSessionTable(rows, nItems, opts);
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const race = !!opts.race;
  const head = ['alumno', ...perItem.map((_, i) => `P${i + 1}`), 'aciertos', 'puntos', ...(race ? ['meta'] : [])];
  const lines = [head.map(esc).join(',')];
  for (const p of players) {
    lines.push([esc(p.name), ...p.cells.map(c => esc(c == null ? '' : `${c.hits}/${c.total}`)), p.marks, p.total,
      ...(race ? [esc(p.finishMs >= 0 ? mmss(p.finishMs) : '')] : [])].join(','));
  }
  return lines.join('\n');
}
