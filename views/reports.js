// Reports view. Three panels: list activities → list sessions → drill-down.
// Data source: PocketBase live_sessions collection.
// All live state lives in live_sessions.state JSON (players[], answers{}).
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list as listActivities } from '../core/storage.js';
import { activityItemCount } from '../core/migrate.js';
import { PB_URL } from '../pocketbase.config.js';

async function pbFetch(path) {
  const r = await fetch(`${PB_URL}${path}`);
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
  return data;
}

// Fetch all live_sessions records (up to 500 — sufficient for classroom use).
async function fetchAllSessions() {
  const data = await pbFetch('/api/collections/live_sessions/records?perPage=500&sort=-created');
  return data?.items || [];
}

// Parse players and answers from a live_sessions state blob.
function parseState(rec) {
  const state = rec.state || {};
  const activity = rec.activity || {};
  return {
    id: rec.id,
    code: rec.code,
    activityId: activity.id || null,
    activitySnap: activity,
    status: state.status || 'lobby',
    phase: state.phase || null,
    currentItem: state.currentItem ?? -1,
    startedAt: state.startedAt || null,
    players: state.players || [],
    answers: state.answers || {},
  };
}

export async function renderReports(rootSel) {
  const acts = listActivities();
  let sessions = [];
  try { sessions = (await fetchAllSessions()).map(parseState); } catch { /* offline */ }

  const counts = {};
  for (const s of sessions) {
    if (s.activityId) counts[s.activityId] = (counts[s.activityId] || 0) + 1;
  }

  mount(rootSel, html`
    <h2 class="mb-3"><i class="bi bi-bar-chart-line-fill"></i> Reportes</h2>
    ${acts.length === 0 ? `<p class="text-muted">Aún no hay actividades.</p>` : `
      <div class="list-group">
        ${acts.map(a => `
          <a href="#/reports/${a.id}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
            <div>
              <b>${escapeHtml(a.title)}</b>
              <div class="small text-muted">${activityItemCount(a)} elementos · ${escapeHtml(a.template)}</div>
            </div>
            <span class="badge bg-primary rounded-pill">${counts[a.id] || 0} partidas</span>
          </a>
        `).join('')}
      </div>`}
  `);
}

export async function renderActivityReport(rootSel, activityId) {
  const acts = listActivities();
  const a = acts.find(x => x.id === activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada.</div>`); return; }

  let allSessions = [];
  try { allSessions = (await fetchAllSessions()).map(parseState); } catch { /* offline */ }
  const sessions = allSessions.filter(s => s.activityId === activityId);

  mount(rootSel, html`
    <a href="#/reports" class="btn btn-link"><i class="bi bi-arrow-left"></i> Reportes</a>
    <h2 class="mb-3">${escapeHtml(a.title)}</h2>
    ${sessions.length === 0 ? `<p class="text-muted">Sin partidas todavía.</p>` : `
      <table class="table table-hover">
        <thead><tr><th>Fecha</th><th>PIN</th><th>Estado</th><th>Jugadores</th><th>Pregunta</th><th></th></tr></thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td>${s.startedAt ? new Date(s.startedAt).toLocaleString() : '<span class="text-muted">no iniciada</span>'}</td>
              <td><code>${escapeHtml(s.code)}</code></td>
              <td><span class="badge bg-${badgeFor(s.status)}">${escapeHtml(s.status)}</span></td>
              <td>${s.players.length}</td>
              <td>${s.currentItem >= 0 ? s.currentItem + 1 : '-'}</td>
              <td><a href="#/reports/session/${s.id}" class="btn btn-sm btn-outline-primary">Ver</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
  `);
}

export async function renderSessionReport(rootSel, sessionId) {
  let sess;
  try {
    const rec = await pbFetch(`/api/collections/live_sessions/records/${sessionId}`);
    if (!rec) { mount(rootSel, html`<div class="alert alert-warning">Sesión no encontrada.</div>`); return; }
    sess = parseState(rec);
  } catch {
    mount(rootSel, html`<div class="alert alert-warning">Sesión no encontrada.</div>`);
    return;
  }

  const players = [...sess.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const activity = sess.activitySnap || {};
  const c = activity.content || {};
  const items = c.items ?? c.entries ?? c.pairs ?? c.groups ?? c.words ?? c.passages ?? [];

  // Build ansByPlayer: playerId → itemIndex → answer
  const ansByPlayer = {};
  for (const [key, ans] of Object.entries(sess.answers)) {
    const colonIdx = key.indexOf(':');
    const iStr = key.slice(0, colonIdx);
    const pid = key.slice(colonIdx + 1);
    const i = parseInt(iStr);
    (ansByPlayer[pid] ||= {})[i] = ans;
  }

  // Aggregates per item.
  const itemStats = items.map((_, i) => {
    let correct = 0, answered = 0;
    for (const p of players) {
      const a = ansByPlayer[p.id]?.[i];
      if (!a) continue;
      answered++;
      if (a.correct === true) correct++;
    }
    return { answered, correct, pct: answered ? Math.round(100 * correct / answered) : null };
  });

  const avgScore = players.length ? Math.round(players.reduce((s, p) => s + (p.score || 0), 0) / players.length) : 0;
  const overallPct = (() => {
    const total = items.length * players.length;
    if (!total) return 0;
    let c = 0;
    for (const p of players) for (let i = 0; i < items.length; i++) {
      if (ansByPlayer[p.id]?.[i]?.correct === true) c++;
    }
    return Math.round(100 * c / total);
  })();

  mount(rootSel, html`
    <a href="#/reports/${sess.activityId}" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h2 class="mb-0">Sesión <code>${escapeHtml(sess.code)}</code></h2>
      <button id="btn-csv" class="btn btn-outline-success"><i class="bi bi-download"></i> Exportar CSV</button>
    </div>
    <p class="text-muted">${sess.startedAt ? new Date(sess.startedAt).toLocaleString() : '—'} · ${players.length} jugadores · ${items.length} preguntas</p>

    <div class="row g-2 mb-3">
      <div class="col-md-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">Promedio</div><div class="h4 mb-0">${avgScore}</div></div></div></div>
      <div class="col-md-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">% acierto</div><div class="h4 mb-0">${overallPct}%</div></div></div></div>
      <div class="col-md-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">Mejor</div><div class="h4 mb-0">${players[0]?.score ?? 0}</div></div></div></div>
    </div>

    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle">
        <thead>
          <tr><th>Jugador</th>${items.map((_, i) => `<th class="text-center" title="${itemStats[i].correct}/${itemStats[i].answered} aciertos">Q${i+1}<br><small class="text-muted">${itemStats[i].pct == null ? '—' : itemStats[i].pct + '%'}</small></th>`).join('')}<th class="text-center">Total</th></tr>
        </thead>
        <tbody>
          ${players.map(p => `
            <tr>
              <td><b>${escapeHtml(p.name)}</b></td>
              ${items.map((_, i) => {
                const a = ansByPlayer[p.id]?.[i];
                if (!a) return `<td class="text-center text-muted">—</td>`;
                const cls = a.correct === true ? 'text-bg-success' : a.correct === false ? 'text-bg-danger' : 'text-bg-secondary';
                return `<td class="text-center ${cls}" title="${escapeHtml(JSON.stringify(a.value))} · ${a.points}pts · ${a.msTaken ?? '?'}ms">${a.points || 0}</td>`;
              }).join('')}
              <td class="text-center fw-bold">${p.score}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);

  on(rootSel, 'click', '#btn-csv', () => downloadCsv(sess, players, items, ansByPlayer));
}

function badgeFor(s) {
  return s === 'ended' ? 'secondary' : s === 'running' ? 'success' : s === 'review' ? 'warning' : 'info';
}

function downloadCsv(sess, players, items, ansByPlayer) {
  const rows = [];
  const head = ['player', ...items.map((_, i) => `q${i+1}_value`), ...items.map((_, i) => `q${i+1}_correct`), ...items.map((_, i) => `q${i+1}_points`), ...items.map((_, i) => `q${i+1}_ms`), 'total'];
  rows.push(head.join(','));
  for (const p of players) {
    const row = [csv(p.name)];
    for (const k of ['value', 'correct', 'points', 'msTaken']) {
      for (let i = 0; i < items.length; i++) {
        const a = ansByPlayer[p.id]?.[i];
        row.push(csv(a ? a[k] : ''));
      }
    }
    row.push(p.score);
    rows.push(row.join(','));
  }
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ww-session-${sess.code}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function csv(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
