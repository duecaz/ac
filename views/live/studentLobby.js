// ALUMNO · bucle LOBBY (§26): sala de espera hasta que el profe empieza.
// Extraído de views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda
// condicionada #2 de CLAUDE.md). `paintWaiting` NO se movió aquí: lo usan
// varios bucles (rondas, tablero) además del propio ensamblador, así que sigue
// en views/studentLive.js.
import { html, escapeHtml, mount } from '../../core/html.js';

export function createStudentLobby(rt) {
  function paintLobby() {
    mount(rt.rootSel, html`
      <div class="text-center py-5">
        <h1 class="display-4">${escapeHtml(rt.player.name)}</h1>
        <p class="lead">¡Estás dentro!</p>
        <p>PIN: <b>${escapeHtml(rt.code)}</b></p>
        <p>Esperando a que el profesor empiece…</p>
        <div class="spinner-border"></div>
      </div>
    `);
  }

  return { paintLobby };
}
