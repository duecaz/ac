// Reports view. Three panels: list activities → list sessions → drill-down.
// Data source: PocketBase live_sessions collection.
// All live state lives in live_sessions.state JSON (players[], answers{}).
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list as listActivities } from '../core/storage.js';
import { activityItemCount } from '../core/migrate.js';
import { getTemplate } from '../core/registry.js';
import { listSessions, fetchSessionRecord } from '../core/liveTransport.js';
import { rowsFromLiveState } from '../core/answerRows.js';
import { sessionTableHtml, sessionTableCsv } from './sessionTable.js';
import { sessionItems } from '../kernel/session/engine.js';
import { downloadText } from '../core/io.js';
import { itemStatsHtml } from './itemStatsView.js';

// Las filas de salas las sirve el DUEÑO de la colección (ley de datos §21):
// adapters/*/realtime.js vía core/liveTransport.js. Esta vista tenía su propio
// `fetch` firmado a `live_sessions`, lo que además rompía el seam local|pb (en
// dev, sin PocketBase, no había informes).
const fetchAllSessions = () => listSessions({ limit: 500 });

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
  // Los JUEGOS no entran en los informes de aprendizaje (§4c): no llevan
  // contenido del profe, así que no hay nada de lo que informar — un ranking de
  // sudokus no dice nada de nadie. La derivación estaba escrita en el norte y
  // sin aplicar: "Ordena las Pelotas" aparecía en la lista (auditoría v1.51.400).
  const acts = listActivities().filter(a => getTemplate(a.template)?.meta?.kind !== 'juego');
  let sessions = [];
  try { sessions = (await fetchAllSessions()).map(parseState); } catch { /* offline */ }

  const counts = {};
  for (const s of sessions) {
    if (s.activityId) counts[s.activityId] = (counts[s.activityId] || 0) + 1;
  }

  mount(rootSel, html`
    <h2 class="mb-3"><i class="bi bi-bar-chart-line-fill"></i> Informes</h2>
    ${acts.length === 0 ? `<p class="text-muted">Aún no hay actividades.</p>` : `
      <div class="list-group">
        ${acts.map(a => `
          <a href="#/reports/${a.id}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
            <div>
              <b>${escapeHtml(a.title)}</b>
              <div class="small text-muted">${activityItemCount(a)} elementos · ${escapeHtml(a.template)}</div>
            </div>
            <span class="badge bg-primary rounded-pill">${counts[a.id] || 0} salas</span>
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
    <a href="#/reports" class="btn btn-link"><i class="bi bi-arrow-left"></i> Informes</a>
    <h2 class="mb-3">${escapeHtml(a.title)}</h2>
    ${sessions.length === 0 ? `<p class="text-muted">Sin salas todavía.</p>` : `
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
    const rec = await fetchSessionRecord(sessionId);
    if (!rec) { mount(rootSel, html`<div class="alert alert-warning">Sesión no encontrada.</div>`); return; }
    sess = parseState(rec);
  } catch {
    mount(rootSel, html`<div class="alert alert-warning">Sesión no encontrada.</div>`);
    return;
  }

  const activity = sess.activitySnap || {};
  const tpl = getTemplate(activity.template);
  const items = sessionItems(activity);
  // LAS MISMAS matemáticas que el informe del host y que el de tareas
  // (core/sessionModel.js). Esta vista tenía su propia matriz alumno×ítem, con
  // la aritmética de ANTES de dos arreglos: contaba `correct === true` sobre
  // ítems×jugadores, así que (a) un ítem SIN CLAVE —Abre Cajas, Ruleta, donde
  // los puntos los da el docente— contaba como fallo y el informe decía 0 %, y
  // (b) el mérito por partes de Tildes/Comas ("3 de 8") se perdía. El mismo
  // profe veía DOS porcentajes distintos de la MISMA sesión según por dónde
  // entrara. Las filas ya se calculaban aquí para el análisis por ítem.
  const rows = rowsFromLiveState(sess);
  const labels = items.map((it, i) => { try { return tpl?.itemLabel?.(it) || `Pregunta ${i + 1}`; } catch { return `Pregunta ${i + 1}`; } });
  const opts = { labels, items, template: tpl, activity };
  const jugadores = sess.players.length;

  mount(rootSel, html`
    <a href="#/reports/${sess.activityId}" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h2 class="mb-0">Sesión <code>${escapeHtml(sess.code)}</code></h2>
      <button id="btn-csv" class="btn btn-outline-success"><i class="bi bi-download"></i> Exportar CSV</button>
    </div>
    <p class="text-muted">${sess.startedAt ? new Date(sess.startedAt).toLocaleString() : '—'} · ${jugadores} jugadores · ${items.length} preguntas</p>

    <div class="istats-wrap mb-4">${sessionTableHtml(rows, items.length, opts)}</div>

    <h4 class="mt-4 mb-2"><i class="bi bi-bar-chart-line-fill"></i> Análisis por ${tpl?.meta?.contentModel === 'textCorrection' ? 'palabra' : 'ítem'}</h4>
    <div class="istats-wrap">${itemStatsHtml(activity, rows)}</div>
  `);

  // UN solo CSV (views/sessionTable.js): antes esta pantalla exportaba columnas
  // distintas a las del host para la misma sesión, y las mejoras del compartido
  // (etiqueta de ítem, mérito por partes) no llegaban aquí.
  on(rootSel, 'click', '#btn-csv', () =>
    downloadText(`sesion-${sess.code}.csv`, 'text/csv', sessionTableCsv(rows, items.length, opts)));
}

function badgeFor(s) {
  return s === 'ended' ? 'secondary' : s === 'running' ? 'success' : s === 'review' ? 'warning' : 'info';
}

