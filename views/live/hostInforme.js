// HOST · INFORME (podio + pestañas post-partida). Extraído de
// views/hostLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2 de
// CLAUDE.md). No es un bucle de juego (§26): es la pantalla de cierre común a
// los cuatro, por eso vive aparte en vez de dentro de uno de ellos.
import { html, escapeHtml, mount } from '../../core/html.js';
import { fetchSessionBlob, listAnswers, listPlayers, leaderboard } from '../../core/liveTransport.js';
import { rowsFromLiveAnswers, rowsFromLiveState } from '../../core/answerRows.js';
import { itemStatsHtml } from '../itemStatsView.js';
import { computeMedals } from '../../core/itemStats.js';
import { sessionTableHtml, sessionTableCsv } from '../sessionTable.js';
import { buildSessionTable } from '../../core/sessionModel.js';   // el modelo es dominio (§0)
import { origenServidor } from '../../core/serverMs.js';   // respaldo del sello en carrera (§22-1)
import { toast } from '../../core/toast.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { cierreHtml } from '../../core/podium.js';
import { mmss } from '../../core/timings.js';
import { destinoTrasJugar } from '../../core/afterPlay.js';
import { esHojaDeTexto } from '../../core/contentModels/textCorrection.js';

export function createHostInforme(rt) {
  // Junta TODAS las respuestas de la sesión (live_answers por ítem + respaldo del
  // blob state.answers), con el nombre del alumno resuelto. Fuente única para las
  // 3 pestañas del informe post-partida (A1) — se calcula una sola vez (cache).
  let _rowsCache = null;
  async function gatherSessionRows() {
    if (_rowsCache) return _rowsCache;
    // El blob PRIMERO: lleva el sello de apertura de cada ítem (§22-1), y sin él
    // la tabla mostraría el `ms` que afirmó el móvil mientras los puntos salen del
    // reloj del servidor — dos tiempos distintos para la misma respuesta.
    let blob = null;
    try { blob = await fetchSessionBlob(rt.sessionId); } catch { /* respaldo best-effort */ }
    // ¿Fue una CARRERA? El sello de apertura único ('race') lo delata aunque la
    // sala ya esté 'ended' — y de él depende que el podio muestre la hora de meta.
    // ¿Fue una CARRERA? Lo DICE la sala (`state.loop`, §26). El respaldo por
    // sello de apertura es solo para salas abiertas antes de que el bucle se
    // guardara — olfatear un detalle del cronometraje para recuperar un hecho de
    // diseño era justo lo que había que dejar de hacer.
    const wasRace = (blob?.loop ? blob.loop === 'race' : (!!blob?.itemOpenedAt?.race || blob?.phase === 'race'));
    // FASE EFECTIVA para derivar el tiempo: en el podio la sala ya está 'ended',
    // y con esa fase core/serverMs.js tomaría `created` (el PRIMER intento). En
    // carrera lo que cuenta es el instante del ACIERTO (`updated`): quien falló
    // y corrigió tarde saldría con una meta más temprana que la real — y la meta
    // es lo que decide la carrera.
    const msOpts = { itemOpenedAt: blob?.itemOpenedAt, phase: wasRace ? 'race' : blob?.phase };
    // Se baja TODO crudo primero: en CARRERA el origen de respaldo (sin sello,
    // §22-1) es el `created` más temprano de TODA la sala — todos los ítems
    // abren a la vez. En rondas cada ítem tiene su hora y el respaldo por ítem
    // lo pone rowsFromLiveAnswers solo.
    const crudo = await Promise.all(rt.items.map((_, i) => listAnswers(rt.sessionId, i).catch(() => [])));
    if (wasRace && !msOpts.itemOpenedAt?.race) msOpts.origen = origenServidor(crudo.flat());
    let rows = crudo.flatMap((a, i) => rowsFromLiveAnswers(a, i, msOpts));
    try {
      const seen = new Set(rows.map(r => `${r.player} ${r.itemIndex}`));
      for (const r of rowsFromLiveState(blob || {})) if (!seen.has(`${r.player} ${r.itemIndex}`)) rows.push(r);
    } catch { /* respaldo best-effort */ }
    try {
      const ps = await listPlayers(rt.sessionId);
      const nameOf = new Map((ps || []).map(p => [p.id, p.name]));
      rows = rows.map(r => ({ ...r, name: r.name || nameOf.get(r.player) || r.player }));
    } catch { /* si no hay nombres, se muestran ids */ }
    // La caché lleva el HECHO junto a los datos: antes "fue una carrera" vivía en
    // una variable de módulo que se escribía como efecto lateral de esta función,
    // y si la lectura fallaba (`.catch(() => [])`) el podio perdía la meta en
    // silencio, sin que se notara que era por el orden de las llamadas.
    _rowsCache = { rows, race: wasRace };
    return _rowsCache;
  }

  const itemLabels = () => rt.items.map((it, i) => { try { return rt.tpl?.itemLabel?.(it) || `Pregunta ${i + 1}`; } catch { return `Pregunta ${i + 1}`; } });

  async function paintPodium(phaseChanged = true) {
    rt.scene(false); // el podio es chrome → fondo neutro (Etapa 1)
    // Ya montado y sin cambio de fase → no re-montar: con la sala 'ended' cada
    // evento (pings de presencia cada 15 s, heartbeats) repintaba el podio
    // entero, re-puntuando la tabla y re-cableando listeners sin motivo.
    if (!phaseChanged && document.getElementById('ll-tabout')) return;
    // Ranking desde los PUNTOS REALES por respuesta (misma fuente que la Tabla →
    // podio y tabla SIEMPRE coinciden). Si no hay filas (colección vacía), cae al
    // marcador oficial de la sesión (state.players[].score).
    // Si las filas NO llegan (red caída al terminar), el respaldo es el marcador
    // del servidor — NO sembrar a los jugadores con 0 encima de un fetch fallido
    // (revisión v1.51.432: la siembra de la decisión C hacía inalcanzable el
    // respaldo y un hipo de PB pintaba un podio con todos a 0).
    let gathered = null;
    try { gathered = await gatherSessionRows(); } catch { /* respaldo abajo */ }
    let lb = [];
    if (gathered) {
      const { rows, race } = gathered;
      // En CARRERA el puntaje NO ordena por sí solo: un fallo vuelve a la cola, así
      // que todo el que termina lo hace con TODAS bien y el podio sería un empate.
      // Lo que decide (y lo que se MUESTRA) es la hora de meta.
      lb = buildSessionTable(rows, rt.items.length, { items: rt.items, template: rt.tpl, activity: rt.activity, players: rt.players }).players.map(p => ({
        name: p.name, score: p.total, marks: p.marks, nCorrect: p.nCorrect,
        // `tie` ordena y `sub` explica: el podio es compartido con el duelo VS, así
        // que no sabe que el desempate es tiempo — recibe el número y el texto.
        ...(race && p.finishMs >= 0 ? { tie: p.finishMs, sub: mmss(p.finishMs) } : {}),
      }));
    }
    if (!lb.length) { try { lb = await leaderboard(rt.sessionId, 100); } catch { lb = []; } }
    if (phaseChanged) emitGame(GameEvents.PODIUM, { top: lb.slice(0, 3).map(p => ({ name: p.name, score: p.score })) });
    const isText = esHojaDeTexto(rt.activity);
    const salidaHost = destinoTrasJugar('live-host');
    mount(rt.rootSel, html`
      ${cierreHtml({
        // `tie` se omite a propósito: el ranking `lb` YA lleva el mismo criterio
        // que el podio (score y, en carrera, `tie` = hora de meta), así que el
        // cálculo por defecto de `cierreHtml` es "empate real entre 1º y 2º" sin
        // repetir la regla aquí (§21b, un solo dueño del criterio de empate).
        // Solo el top 3: el ranking completo ya lo pinta la pestaña «Ranking» de
        // abajo; con `lb` entero salían del 4º en adelante DOS veces (revisión v666).
        ranked: lb.slice(0, 3),
        extra: `
          <div id="ll-medals" class="ll-medals"></div>
          <div class="text-center"><div class="ll-tabs">
            <button class="ll-tab is-active" data-tab="podio"><i class="bi bi-trophy"></i> Ranking</button>
            <button class="ll-tab" data-tab="tabla"><i class="bi bi-table"></i> Tabla</button>
            <button class="ll-tab" data-tab="palabra"><i class="bi bi-bar-chart-line-fill"></i> Por ${isText ? 'palabra' : 'ítem'}</button>
          </div></div>
          <div id="ll-tabout" class="mt-1"></div>`,
        acciones: `
          <button id="ll-csv" class="btn btn-outline-success btn-sm"><i class="bi bi-download"></i> Exportar CSV</button>
          <a href="${salidaHost.href}" class="btn btn-outline-secondary btn-sm"><i class="bi ${salidaHost.icon}"></i> ${salidaHost.label}</a>`
      })}
    `);

    const out = document.getElementById('ll-tabout');
    const spin = () => { out.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>'; };
    const rankingHtml = () => `<div class="ll-rank">${lb.map((p, i) =>
      `<div class="ll-rank__row"><span class="ll-rank__pos">${i < 3 ? ['🥇','🥈','🥉'][i] : (i + 1) + '.'}</span><span class="ll-rank__name">${escapeHtml(p.name)}</span><span class="ll-rank__pts">${p.score ?? 0}${p.sub ? ` <small class="text-muted">· ${escapeHtml(p.sub)}</small>` : ''}</span></div>`).join('')}</div>`;

    async function showTab(tab) {
      document.querySelectorAll('.ll-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
      if (tab === 'podio') { out.innerHTML = rankingHtml(); return; }
      spin();
      try {
        const { rows, race } = await gatherSessionRows();
        out.innerHTML = tab === 'tabla'
          ? sessionTableHtml(rows, rt.items.length, { labels: itemLabels(), items: rt.items, template: rt.tpl, activity: rt.activity, race, players: rt.players })
          : itemStatsHtml(rt.activity, rows);
      } catch (e) { out.innerHTML = `<div class="alert alert-warning">No se pudo cargar: ${escapeHtml(e.message)}</div>`; }
    }
    document.querySelectorAll('.ll-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    document.getElementById('ll-csv')?.addEventListener('click', async () => {
      try {
        const { rows, race } = await gatherSessionRows();
        const csv = sessionTableCsv(rows, rt.items.length, { labels: itemLabels(), items: rt.items, template: rt.tpl, activity: rt.activity, race, players: rt.players });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `sesion-${rt.code}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch { toast('No se pudo exportar el CSV.', 'danger'); }
    });
    showTab('podio');
    // Medallas de aula (A2): se pintan al cargar las respuestas (no bloquea el podio).
    gatherSessionRows().then(({ rows }) => {
      const m = computeMedals(rows);
      const el = document.getElementById('ll-medals');
      if (el && m.length) el.innerHTML = m.map(x => `<span class="ll-medal">${x.icon} ${x.label}: <b>${escapeHtml(x.name)}</b></span>`).join('');
    }).catch(() => {});
  }

  return { paintPodium };
}
