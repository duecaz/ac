// PANELES POR DEFECTO DEL EDITOR — "Puntuación" y "En vivo", para TODAS.
//
// Los datos que estos paneles editan se leen GLOBALMENTE: `a.scoring.mode` lo
// consume `core/scoring/award.js`, y de `a.live` salen el timer de pregunta
// (`core/timings.js`), la ventana de lectura, el modelo de puntos, el bonus de
// velocidad y el aforo de la sala (`kernel/session/engine.js`). Pero los paneles
// los aportaba CADA plantilla, y así quedó la cosa (auditoría v1.51.408):
//
//   · "Puntuación" existía en 5 de 13 — y las dos más completas ya habían
//     divergido en etiquetas para el MISMO campo.
//   · "En vivo" existía SOLO en Quiz… mientras SIETE plantillas declaran
//     `modes.live: true`. El profe de Tildes o de Operaciones no tenía dónde
//     tocar el timer de su sala: no era duplicación, era funcionalidad AUSENTE.
//
// Ahora el chasis los pone por defecto y la plantilla solo los declara si de
// verdad necesita otra cosa (`spec.scoring` / `spec.live` siguen ganando). Es la
// misma dirección que §0: lo común vive en la capa que lo consume, la plantilla
// declara solo su especialidad.
//
// NOTA sobre R2 ("el profe no configura nada"): esto NO la contradice. R2 habla
// de la pantalla de JUEGO — abrir y jugar sin ajustes. El norte dice
// explícitamente que "los ajustes finos son opcionales y viven en el editor",
// que es exactamente aquí, y con valores por defecto ya puestos.
import { on } from './events.js';
import { readSeconds } from './timings.js';
import { activityItemCount } from './migrate.js';
import { defaultMaxScore } from './scoring/index.js';

// ── Puntuación ─────────────────────────────────────────────────────────────
export function scoringPanelHtml(a) {
  const s = a.scoring || {};
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Modo</label>
      <select class="form-select" id="f-mode">
        <option value="flat" ${s.mode === 'flat' ? 'selected' : ''}>Plano</option>
        <option value="kahoot" ${s.mode === 'kahoot' ? 'selected' : ''}>Kahoot (bonus por velocidad)</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input type="number" class="form-control" id="f-ppc" value="${s.pointsPerCorrect ?? 1}"></div>
    <div class="col-md-4"><label class="form-label">Puntos por error</label><input type="number" class="form-control" id="f-ppw" value="${s.pointsPerWrong ?? 0}"></div>
    <!-- EL EFECTO, A LA VISTA. El bug de «puse 10 y el duelo dio 1» vivió meses
         porque el ajuste no tenía NINGUNA consecuencia visible hasta el podio.
         Esta línea cierra el circuito: cambias el número y ves al instante qué
         vale un acierto y cuál es el máximo de ESTA actividad — si algún día un
         cambio no la mueve, el mando desconectado se delata solo. -->
    <div class="col-12"><p class="text-muted small mb-0" id="f-resumen-pts">${resumenPuntosHtml(a)}</p></div>
  </div>`;
}

function resumenPuntosHtml(a) {
  const n = activityItemCount(a);
  const max = defaultMaxScore(a, n);
  const ppc = a.scoring?.pointsPerCorrect ?? 1;
  const kahoot = a.scoring?.mode === 'kahoot';
  if (!n) return `Cada acierto vale <b>${ppc}</b>. Cuando añadas contenido verás aquí el máximo de la actividad.`;
  return `Cada acierto vale <b>${ppc}</b> punto${ppc === 1 ? '' : 's'} → con ${n} elemento${n === 1 ? '' : 's'}, `
    + `el máximo de esta actividad es <b>${max}</b>`
    + (kahoot ? ' <i>(en modo Kahoot se suma además el bonus por velocidad)</i>.' : '.');
}

export function wireScoringPanel(root, a, ctx) {
  const refrescar = () => {
    const el = root.querySelector('#f-resumen-pts');
    if (el) el.innerHTML = resumenPuntosHtml(a);
  };
  on(root, 'change', '#f-mode', e => { a.scoring.mode = e.target.value; ctx.onChange(a); refrescar(); });
  on(root, 'input', '#f-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 1; ctx.onChange(a); refrescar(); });
  on(root, 'input', '#f-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; ctx.onChange(a); refrescar(); });
}

// ── En vivo ────────────────────────────────────────────────────────────────
export function livePanelHtml(a) {
  const l = a.live || {};
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Modo de avance</label>
      <select class="form-select" id="l-advance">
        <option value="manual" ${l.advanceMode === 'manual' ? 'selected' : ''}>manual</option>
        <option value="autoOnAllAnswered" ${l.advanceMode === 'autoOnAllAnswered' ? 'selected' : ''}>autoOnAllAnswered</option>
        <option value="autoOnTimer" ${l.advanceMode === 'autoOnTimer' ? 'selected' : ''}>autoOnTimer</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Timer pregunta (s)</label><input id="l-qtimer" type="number" min="5" max="300" class="form-control" value="${l.questionTimer}"></div>
    <div class="col-md-4"><label class="form-label">Tiempo de lectura (s)</label>
      <input id="l-read" type="number" min="0" max="30" class="form-control" value="${readSeconds(a)}">
      <div class="form-text">Se ve la pregunta pero aún no se puede responder. 0 = al instante.</div></div>
    <div class="col-md-4"><label class="form-label">Bloquear respuestas</label>
      <select class="form-select" id="l-lock">
        <option value="firstOf" ${l.lockAnswersOn === 'firstOf' ? 'selected' : ''}>firstOf</option>
        <option value="timer" ${l.lockAnswersOn === 'timer' ? 'selected' : ''}>timer</option>
        <option value="allAnswered" ${l.lockAnswersOn === 'allAnswered' ? 'selected' : ''}>allAnswered</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Modelo de puntos</label>
      <select class="form-select" id="l-points">
        <option value="kahoot" ${l.pointsModel === 'kahoot' ? 'selected' : ''}>kahoot</option>
        <option value="flat" ${l.pointsModel === 'flat' ? 'selected' : ''}>flat</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Speed bonus máx</label><input id="l-bonus" type="number" min="0" class="form-control" value="${l.speedBonusMax}"></div>
    <div class="col-md-4"><label class="form-label">Máx. jugadores</label><input id="l-max" type="number" min="1" max="500" class="form-control" value="${l.maxPlayers}"></div>
    <div class="col-md-4 form-check pt-4"><input id="l-late" class="form-check-input" type="checkbox" ${l.allowLateJoin ? 'checked' : ''}><label class="form-check-label" for="l-late">Permitir unirse tarde</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-after" class="form-check-input" type="checkbox" ${l.showAnswerAfterEach ? 'checked' : ''}><label class="form-check-label" for="l-after">Mostrar respuesta tras cada</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-lb" class="form-check-input" type="checkbox" ${l.showLeaderboardBetween ? 'checked' : ''}><label class="form-check-label" for="l-lb">Leaderboard entre preguntas</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-nick" class="form-check-input" type="checkbox" ${l.nicknameFilter ? 'checked' : ''}><label class="form-check-label" for="l-nick">Filtro de apodos</label></div>
    <!-- BONUS POR RACHA: el mando estaba aquí y la función NO EXISTE. Su
         comentario en core/streaks.js lo dice: los puntos extra los calculaba
         una Edge Function de Supabase, y Supabase se RETIRÓ del proyecto. El
         profe lo encendía, ponía «50 por paso» y no pasaba nada nunca.
         Se quita el mando en vez de dejarlo mintiendo; la función queda como
         deuda en CLAUDE.md con lo que hay que decidir (¿lo calcula el settle
         del host? ¿cuenta la racha por alumno o por sala?). La racha SÍ se
         sigue viendo en pantalla (🔥), que es lo que ya funcionaba. -->
  </div>`;
}

export function wireLivePanel(root, a, ctx) {
  const oc = ctx.onChange;
  on(root, 'change', '#l-advance', e => { a.live.advanceMode = e.target.value; oc(a); });
  on(root, 'input', '#l-qtimer', e => { a.live.questionTimer = +e.target.value || 20; oc(a); });
  on(root, 'input', '#l-read', e => { a.live.readSeconds = Math.max(0, Math.min(30, Math.round(+e.target.value || 0))); oc(a); });
  on(root, 'change', '#l-lock', e => { a.live.lockAnswersOn = e.target.value; oc(a); });
  on(root, 'change', '#l-points', e => { a.live.pointsModel = e.target.value; oc(a); });
  on(root, 'input', '#l-bonus', e => { a.live.speedBonusMax = +e.target.value || 0; oc(a); });
  on(root, 'input', '#l-max', e => { a.live.maxPlayers = +e.target.value || 60; oc(a); });
  on(root, 'change', '#l-late', e => { a.live.allowLateJoin = e.target.checked; oc(a); });
  on(root, 'change', '#l-after', e => { a.live.showAnswerAfterEach = e.target.checked; oc(a); });
  on(root, 'change', '#l-lb', e => { a.live.showLeaderboardBetween = e.target.checked; oc(a); });
  on(root, 'change', '#l-nick', e => { a.live.nicknameFilter = e.target.checked; oc(a); });
}
