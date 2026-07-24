// C1 — Matriz alumno×ítem estilo Kahoot, COMPARTIDA por el informe de live (A1) y
// el de tareas (B1). Recibe filas ya normalizadas de core/answerRows.js
// ({ player, name, itemIndex, value, correct, points }) → tabla con una fila por
// alumno y una columna por pregunta: ✓ verde / ✗ roja / — gris, % de acierto por
// columna en la cabecera y total por alumno. En carrera la fila trae el PRIMER
// intento (v0/c0) → refleja el error real. Ver docs/handoff-mejoras-live-tareas.md.
import { escapeHtml } from '../core/html.js';
import { dedupeRows } from '../core/answerRows.js';

// Construye el modelo puro (sin DOM) → testeable.
//   rows: filas normalizadas · nItems: nº de preguntas · labels?: etiquetas de columna
// → { players:[{name, cells:[{correct,points,value}|null], total}], perItem:[{n,nCorrect,pct}] }
export function buildSessionTable(rows, nItems, { labels = [] } = {}) {
  const deduped = dedupeRows(rows || []);
  const byPlayer = new Map();       // player → { name, cells:[] }
  for (const r of deduped) {
    if (!byPlayer.has(r.player)) byPlayer.set(r.player, { name: r.name || r.player, cells: Array(nItems).fill(null) });
    const p = byPlayer.get(r.player);
    if (r.name && (!p.name || p.name === r.player)) p.name = r.name;
    if (r.itemIndex >= 0 && r.itemIndex < nItems) {
      p.cells[r.itemIndex] = { correct: r.correct, points: r.points || 0, value: r.value };
    }
  }
  const players = [...byPlayer.values()].map(p => ({
    name: p.name,
    cells: p.cells,
    total: p.cells.reduce((s, c) => s + (c?.points || 0), 0),
    nCorrect: p.cells.filter(c => c?.correct === true).length,
    // Ranking: MANDAN los aciertos (respuestas correctas a la primera); los puntos
    // (que incluyen el bonus de velocidad) solo DESEMPATAN. Antes ordenaba por
    // puntos → un alumno más rápido pero con menos aciertos adelantaba a otro con
    // más aciertos. Ahora no.
  })).sort((a, b) => b.nCorrect - a.nCorrect || b.total - a.total);

  const perItem = Array.from({ length: nItems }, (_, i) => {
    let n = 0, nCorrect = 0;
    for (const p of players) { const c = p.cells[i]; if (c) { n++; if (c.correct === true) nCorrect++; } }
    return { label: labels[i] || `P${i + 1}`, n, nCorrect, pct: n ? Math.round(100 * nCorrect / n) : null };
  });
  return { players, perItem };
}

// HTML de la tabla. Cabecera con % por pregunta; celdas coloreadas. Envuelta en
// scroll horizontal propio (nunca desborda el body).
export function sessionTableHtml(rows, nItems, opts = {}) {
  const { players, perItem } = buildSessionTable(rows, nItems, opts);
  if (!players.length) return `<p class="text-muted text-center py-3">Sin respuestas todavía.</p>`;
  const head = perItem.map((it, i) =>
    `<th class="st-qh" title="${escapeHtml(it.label)}">P${i + 1}<br><small>${it.pct == null ? '—' : it.pct + '%'}</small></th>`).join('');
  const body = players.map((p, rank) => `
    <tr>
      <td class="st-name">${rank < 3 ? ['🥇','🥈','🥉'][rank] + ' ' : ''}${escapeHtml(p.name)}</td>
      ${p.cells.map(c => {
        if (!c) return `<td class="st-cell st-cell--none">—</td>`;
        const cls = c.correct === true ? 'ok' : c.correct === false ? 'bad' : 'meh';
        // Falló al 1er intento pero acabó con puntos = lo CORRIGIÓ (típico de carrera:
        // reintenta hasta acertar). Se marca ✗↻ para no confundir con "quedó mal".
        const corrected = c.correct === false && (c.points || 0) > 0;
        const icon = c.correct === true ? '<i class="bi bi-check-lg"></i>'
          : c.correct === false ? (corrected ? '<i class="bi bi-x-lg"></i><sup class="st-fix">↻</sup>' : '<i class="bi bi-x-lg"></i>')
          : '·';
        const title = corrected ? 'Falló al 1er intento, luego lo corrigió' : `${c.points} pts`;
        return `<td class="st-cell st-cell--${cls}" title="${title}">${icon}</td>`;
      }).join('')}
      <td class="st-total">${p.total}</td>
    </tr>`).join('');
  return `<div class="st-wrap"><table class="st-table">
    <thead><tr><th class="st-name">Alumno</th>${head}<th class="st-total">Total</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

// Filas en formato CSV (para exportar). Devuelve un string CSV.
export function sessionTableCsv(rows, nItems, opts = {}) {
  const { players, perItem } = buildSessionTable(rows, nItems, opts);
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['alumno', ...perItem.map((_, i) => `P${i + 1}`), 'total'];
  const lines = [head.map(esc).join(',')];
  for (const p of players) {
    lines.push([esc(p.name), ...p.cells.map(c => esc(c == null ? '' : c.correct === true ? 1 : 0)), p.total].join(','));
  }
  return lines.join('\n');
}
