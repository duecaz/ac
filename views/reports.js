// Reports view. Three panels: list activities → list sessions → drill-down.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { getClient } from '../core/supabase.js';
import { list as listActivities } from '../core/storage.js';

export async function renderReports(rootSel) {
  const sb = await getClient();
  // Aggregate session counts per activity from sessions table.
  const { data: sessions } = await sb.from('sessions').select('activity_id, started_at, ended_at, status').order('started_at', { ascending: false });
  const acts = listActivities();
  const counts = {};
  (sessions || []).forEach(s => { counts[s.activity_id] = (counts[s.activity_id] || 0) + 1; });

  mount(rootSel, html`
    <h2 class="mb-3"><i class="bi bi-bar-chart-line-fill"></i> Reportes</h2>
    ${acts.length === 0 ? `<p class="text-muted">Aún no hay actividades.</p>` : `
      <div class="list-group">
        ${acts.map(a => `
          <a href="#/reports/${a.id}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
            <div>
              <b>${escapeHtml(a.title)}</b>
              <div class="small text-muted">${(a.content.items?.length ?? a.content.entries?.length ?? 0)} elementos · ${escapeHtml(a.template)}</div>
            </div>
            <span class="badge bg-primary rounded-pill">${counts[a.id] || 0} partidas</span>
          </a>
        `).join('')}
      </div>`}
  `);
}

export async function renderActivityReport(rootSel, activityId) {
  const sb = await getClient();
  const acts = listActivities();
  const a = acts.find(x => x.id === activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada.</div>`); return; }

  const { data: sessions } = await sb.from('sessions')
    .select('id, code, status, started_at, ended_at, current_item')
    .eq('activity_id', activityId).order('started_at', { ascending: false, nullsFirst: false });

  // Player counts per session.
  const ids = (sessions || []).map(s => s.id);
  const counts = {};
  if (ids.length) {
    const { data: ps } = await sb.from('players').select('session_id').in('session_id', ids);
    (ps || []).forEach(p => { counts[p.session_id] = (counts[p.session_id] || 0) + 1; });
  }

  mount(rootSel, html`
    <a href="#/reports" class="btn btn-link"><i class="bi bi-arrow-left"></i> Reportes</a>
    <h2 class="mb-3">${escapeHtml(a.title)}</h2>
    ${(!sessions || sessions.length === 0) ? `<p class="text-muted">Sin partidas todavía.</p>` : `
      <table class="table table-hover">
        <thead><tr><th>Fecha</th><th>PIN</th><th>Estado</th><th>Jugadores</th><th>Pregunta</th><th></th></tr></thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td>${s.started_at ? new Date(s.started_at).toLocaleString() : '<span class="text-muted">no iniciada</span>'}</td>
              <td><code>${escapeHtml(s.code)}</code></td>
              <td><span class="badge bg-${badgeFor(s.status)}">${escapeHtml(s.status)}</span></td>
              <td>${counts[s.id] || 0}</td>
              <td>${s.current_item >= 0 ? s.current_item + 1 : '-'}</td>
              <td><a href="#/reports/session/${s.id}" class="btn btn-sm btn-outline-primary">Ver</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
  `);
}

export async function renderSessionReport(rootSel, sessionId) {
  const sb = await getClient();
  const { data: sess } = await sb.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!sess) { mount(rootSel, html`<div class="alert alert-warning">Sesión no encontrada.</div>`); return; }
  const { data: players } = await sb.from('players').select('*').eq('session_id', sessionId).order('score', { ascending: false });
  const { data: answers } = await sb.from('answers').select('*').eq('session_id', sessionId);

  const items = sess.activity_snap?.content?.items || [];
  const ansByPlayer = {};
  for (const a of answers || []) {
    (ansByPlayer[a.player_id] ||= {})[a.item_index] = a;
  }

  // Aggregates per item: correct%, answered count.
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
    <a href="#/reports/${sess.activity_id}" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h2 class="mb-0">Sesión <code>${escapeHtml(sess.code)}</code></h2>
      <button id="btn-csv" class="btn btn-outline-success"><i class="bi bi-download"></i> Exportar CSV</button>
    </div>
    <p class="text-muted">${sess.started_at ? new Date(sess.started_at).toLocaleString() : '—'} · ${players.length} jugadores · ${items.length} preguntas</p>

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
                return `<td class="text-center ${cls}" title="${escapeHtml(JSON.stringify(a.value))} · ${a.points}pts · ${a.ms_taken ?? '?'}ms">${a.points || 0}</td>`;
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
  const head = ['player', 'user_id', ...items.map((_, i) => `q${i+1}_value`), ...items.map((_, i) => `q${i+1}_correct`), ...items.map((_, i) => `q${i+1}_points`), ...items.map((_, i) => `q${i+1}_ms`), 'total'];
  rows.push(head.join(','));
  for (const p of players) {
    const row = [csv(p.name), csv(p.user_id)];
    for (const k of ['value', 'correct', 'points', 'ms_taken']) {
      for (let i = 0; i < items.length; i++) {
        const a = ansByPlayer[p.id]?.[i];
        row.push(csv(a ? a[k] : ''));
      }
    }
    row.push(p.score);
    rows.push(row.join(','));
  }
  // BOM so Excel reads UTF-8 correctly.
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
