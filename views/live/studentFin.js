// ALUMNO · FIN de la sala: resultado propio (ranking o carrera). Extraído de
// views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2
// de CLAUDE.md). No es un bucle de juego (§26): es la pantalla de cierre común
// a los cuatro, por eso vive aparte.
import { html, mount } from '../../core/html.js';
import * as Streaks from '../../core/streaks.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { leaderboard } from '../../core/liveTransport.js';
import { sessionItems } from '../../kernel/session/engine.js';
import { mmss } from '../../core/timings.js';

export function createStudentFin(rt) {
  let endedFired = false;
  let endingInProgress = false;

  async function paintEnded() {
    if (endingInProgress) return;
    endingInProgress = true;
    // resultado = chrome → fondo neutro (Etapa 1)
    Streaks.reset(rt.session.id, rt.player.playerId);
    // La puntuación AUTORITATIVA es la del leaderboard del servidor. `myScore` es
    // solo una ESTIMACIÓN local de respaldo (acumulada en submit/reveal) para el
    // raro caso de que el servidor no responda al terminar — no se muestra durante
    // la partida, así que nunca hay un número local "en desacuerdo" a la vista.
    let finalScore = rt.myScore;
    let rank = 0;
    try {
      const lb = await leaderboard(rt.session.id);
      const meIdx = lb.findIndex(p => p.id === rt.player.playerId);
      // Si el marcador del servidor trae un puntaje real, mándalo; si viene en 0
      // (no se consolidó en state.players), conservamos la estimación local myScore
      // para no mostrar "0 puntos" cuando el alumno sí acertó.
      if (meIdx >= 0) { rank = meIdx + 1; if (lb[meIdx].score) finalScore = lb[meIdx].score; }
    } catch (e) {
      console.warn('[studentLive] leaderboard final no disponible; usando estimación local:', e);
    }
    if (!endedFired) {
      endedFired = true;
      emitGame(GameEvents.PODIUM, { top: [{ name: rt.player.name, score: finalScore }] });
    }
    const rankIcon = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '<i class="bi bi-trophy-fill display-1 text-warning"></i>';
    const rankMsg  = rank === 1 ? '¡Ganaste!' : rank === 2 ? '¡Segundo lugar!' : rank === 3 ? '¡Tercer lugar!' : '¡Se acabó!';
    mount(rt.rootSel, html`
      <div class="text-center py-5">
        <div class="display-1">${rankIcon}</div>
        <h2 class="mt-3">${rankMsg}</h2>
        ${rank === 1 ? '<p class="lead text-warning fw-bold">¡Eres el primero!</p>' : ''}
        ${rt.raceQueue !== null
          // CARRERA: los puntos planos SON los aciertos — repetir el número como
          // "puntos" no dice nada; aciertos y tiempo sí (lo que pide la guía).
          ? `<p class="lead">${rt.raceCorrectCount} / ${sessionItems(rt.activity).length} correctas${rt.raceFinishMs != null ? ` · <b title="Tu tiempo (aprox.). La clasificación usa el reloj del servidor.">${mmss(rt.raceFinishMs, Math.floor)}</b>` : ''}</p>`
          : `<p class="lead">Tu puntuación: <b class="fs-2">${finalScore}</b> puntos</p>`}
        ${rank > 1 ? `<p class="text-muted">Posición ${rank} en el ranking</p>` : ''}
        <p class="text-muted small">Mira el ranking completo en la pantalla del profesor.</p>
        <a href="#/join" class="btn btn-warning btn-lg mt-2"><i class="bi bi-arrow-left"></i> Otra sala</a>
      </div>
    `);
  }

  return { paintEnded };
}
