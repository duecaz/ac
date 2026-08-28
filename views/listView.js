// List view — orchestrates a sequence of VS rounds from a 'list' activity.
// Each round loads one activity, runs a VS match (skipping the per-round setup
// screen since names are collected once at the top), and accumulates scores.
// After all rounds a combined podium is shown.
//
// NO es un modo (decisión C7): no está en MODE_DEFS ni pasa por runMode a
// propósito — es un ORQUESTADOR de partidas VS ya existentes (usa la rama
// opts.onFinish de mountVs). Si algún día una "lista" debe poder jugarse en
// otros modos (equipos/live), ahí sí tocará registrarla como modo; mientras
// tanto, registrarla solo añadiría gateo y setup que no aplican.
import { html, escapeHtml, mount } from '../core/html.js';
import { getAnywhere } from '../core/storage.js';
import { podiumHtml } from '../core/podium.js';
import { renderModeSetup } from './modeSetup.js';
import { mountVs } from './vsView.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { destinoTrasJugar } from '../core/afterPlay.js';

export async function renderListView(rootSel, id) {
  const host = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!host) return;

  const lista = await getAnywhere(id, { cache: true });
  if (!lista) {
    mount(host, html`<div class="alert alert-warning m-3">Lista no encontrada. <a href="${destinoTrasJugar('solo').href}">Volver</a></div>`);
    return;
  }

  const roundDefs = lista.content?.items || [];
  if (roundDefs.length === 0) {
    mount(host, html`
      <div class="alert alert-info m-3">
        Esta lista no tiene actividades.
        <a href="#/edit-list/${escapeHtml(lista.id)}">Editar</a>
      </div>`);
    return;
  }

  // Pre-load all round activities (local cache first, then remote fallback).
  const activities = [];
  for (const def of roundDefs) {
    const a = await getAnywhere(def.activityId, { cache: true });
    if (a) activities.push(a);
  }

  if (activities.length === 0) {
    mount(host, html`<div class="alert alert-warning m-3">No se encontraron las actividades de esta lista. Verifica que existan.</div>`);
    return;
  }

  let leftName = 'Alumno 1';
  let rightName = 'Alumno 2';

  showSetup();

  function showSetup() {
    const roundList = activities.map((a, i) => `
      <div class="d-flex align-items-center gap-2 py-1 border-bottom">
        <span class="badge bg-secondary">${i + 1}</span>
        <span class="flex-grow-1">${escapeHtml(a.title)}</span>
        <small class="text-muted">${sessionItems(a).length} preg.</small>
      </div>`).join('');

    const body = `
      <div class="row justify-content-center g-3 mb-3" style="max-width:480px;margin:auto">
        <div class="col-6">
          <label class="form-label small text-muted fw-semibold">Equipo izquierda</label>
          <input id="list-name-left" class="form-control text-center" value="${escapeHtml(leftName)}" maxlength="20" placeholder="Alumno 1">
        </div>
        <div class="col-6">
          <label class="form-label small text-muted fw-semibold">Equipo derecha</label>
          <input id="list-name-right" class="form-control text-center" value="${escapeHtml(rightName)}" maxlength="20" placeholder="Alumno 2">
        </div>
      </div>
      <div class="mx-auto mt-2 text-start" style="max-width:480px">${roundList}</div>`;

    renderModeSetup(host, {
      icon: 'bi-collection-play-fill',
      color: 'primary',
      title: 'Lista encadenada',
      subtitle: `${escapeHtml(lista.title)} · ${activities.length} rondas`,
      body,
      note: 'Las puntuaciones de cada ronda se acumulan en el marcador final.',
      backHref: '#/home',
      onStart: () => {
        leftName = (document.getElementById('list-name-left')?.value || '').trim() || 'Alumno 1';
        rightName = (document.getElementById('list-name-right')?.value || '').trim() || 'Alumno 2';
        runRounds();
      }
    });
  }

  function runRounds() {
    const scores = { left: 0, right: 0 };
    let round = 0;

    function nextRound() {
      if (round >= activities.length) {
        showFinalPodium(scores);
        return;
      }
      const a = activities[round];
      const roundNum = round + 1;
      const total = activities.length;
      round++;

      showRoundIntro(roundNum, total, a, () => {
        mountVs(host, a, null, {
          leftName,
          rightName,
          onFinish: (st) => {
            scores.left += st.left.score;
            scores.right += st.right.score;
            if (round < activities.length) {
              showRoundResult(roundNum, total, st, scores, nextRound);
            } else {
              showFinalPodium(scores);
            }
          }
        });
      });
    }

    nextRound();
  }

  function showRoundIntro(roundNum, total, a, onGo) {
    const salida = destinoTrasJugar('solo');
    mount(host, html`
      <div class="list-round-intro text-center py-5 px-3">
        <p class="text-muted text-uppercase small mb-1">Ronda ${roundNum} de ${total}</p>
        <h2 class="mb-2">${escapeHtml(a.title)}</h2>
        ${a.subtitle ? `<p class="text-muted mb-3">${escapeHtml(a.subtitle)}</p>` : ''}
        <p class="text-muted mb-4">${sessionItems(a).length} preguntas</p>
        <button id="list-go" class="btn btn-primary btn-lg px-5"><i class="bi bi-play-fill"></i> ¡A jugar!</button>
        <a href="${salida.href}" class="btn btn-link ms-3">Salir</a>
      </div>`);
    const btn = document.getElementById('list-go');
    if (btn) btn.onclick = () => onGo();
  }

  function showRoundResult(roundNum, total, st, scores, onNext) {
    const winnerSide = st.finishedBy || (st.leader !== 'tie' ? st.leader : null);
    const winnerName = winnerSide ? st[winnerSide].name : null;
    mount(host, html`
      <div class="list-round-result text-center py-5 px-3">
        <p class="text-muted text-uppercase small mb-1">Ronda ${roundNum} de ${total} completada</p>
        <h3 class="mb-4">${winnerName
          ? `<i class="bi bi-trophy-fill text-warning"></i> ¡${escapeHtml(winnerName)} gana la ronda!`
          : '<i class="bi bi-emoji-neutral text-secondary"></i> ¡Empate!'}</h3>
        <div class="d-flex justify-content-center gap-5 mb-4">
          <div class="text-center">
            <div class="fs-2 fw-bold text-danger">${scores.left}</div>
            <div class="text-muted small">${escapeHtml(leftName)}</div>
            <div class="text-muted small">+${st.left.score} esta ronda</div>
          </div>
          <div class="text-center align-self-center text-muted fs-4">vs</div>
          <div class="text-center">
            <div class="fs-2 fw-bold text-primary">${scores.right}</div>
            <div class="text-muted small">${escapeHtml(rightName)}</div>
            <div class="text-muted small">+${st.right.score} esta ronda</div>
          </div>
        </div>
        <button id="list-next" class="btn btn-primary btn-lg px-5">
          <i class="bi bi-arrow-right"></i> Ronda ${roundNum + 1}
        </button>
      </div>`);
    const btn = document.getElementById('list-next');
    if (btn) btn.onclick = () => onNext();
  }

  function showFinalPodium(scores) {
    const ranked = [
      { name: leftName, score: scores.left },
      { name: rightName, score: scores.right }
    ].sort((a, b) => b.score - a.score);
    const tie = scores.left === scores.right;
    const winnerName = tie ? null : ranked[0].name;

    const salida = destinoTrasJugar('solo');
    mount(host, html`
      <div class="list-final text-center py-5 px-3">
        <p class="text-muted text-uppercase small mb-1">Resultado final · ${activities.length} rondas</p>
        <h2 class="mb-4">${tie
          ? '<i class="bi bi-emoji-neutral text-secondary"></i> ¡Empate!'
          : `<i class="bi bi-trophy-fill text-warning"></i> ¡${escapeHtml(winnerName)} gana la lista!`}</h2>
        ${podiumHtml(ranked)}
        <div class="mt-4 d-flex gap-2 justify-content-center flex-wrap">
          <button id="list-again" class="btn btn-primary btn-lg"><i class="bi bi-arrow-repeat"></i> Jugar de nuevo</button>
          <a href="${salida.href}" class="btn btn-outline-secondary btn-lg">Salir</a>
        </div>
      </div>`);
    const btn = document.getElementById('list-again');
    if (btn) btn.onclick = () => showSetup();
  }
}
