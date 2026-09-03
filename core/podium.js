// Shared podium component. Bar height reflects the player's PLACE BY SCORE, so
// players who tie get the same height (and the same place number) — which reads
// as a real tie instead of an arbitrary 1/2/3 staircase. Usado SOLO por
// `cierreHtml` de aquí abajo (dueño único de la barras); nadie más lo importa
// tras la migración del cierre compartido (2026-09-04, ver `cierreHtml`).
import { escapeHtml } from './html.js';

/** `list`: entries sorted by score desc, shape { name, score, sub? }. `sub` es
 *  una línea pequeña bajo los puntos — en la CARRERA, la hora de meta ("3:12"):
 *  ahí todos los que acaban lo hacen con todas bien, así que el podio se vería
 *  como un triple empate si no dijera quién llegó antes. Muestra el top 3. */
function podiumHtml(list) {
  const top = (list || []).slice(0, 3);
  if (!top.length) return '<div class="ww-podium mb-4"></div>';
  // Standard competition ranking: same score → same place (ties share height).
  // `tie` (menor = mejor; en carrera, la hora de meta) rompe la igualdad de
  // puntos: sin él, una carrera —donde todos acaban con TODAS bien— pintaba a
  // los tres en el primer puesto y a la misma altura.
  const better = (p, q) => p.score > q.score
    || (p.score === q.score && p.tie != null && q.tie != null && p.tie < q.tie);
  const placeOf = (i) => top.filter(p => better(p, top[i])).length + 1;
  // Classic arrangement: 2nd · 1st · 3rd (winner centered) when we have 3;
  // for 2 players show them side by side; for 1, just the one.
  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [0, 1] : [0];
  const steps = order.map(i => top[i] ? `
    <div class="step s${Math.min(placeOf(i), 3)}">
      <div class="display-6">${placeOf(i)}</div>
      <div class="fw-bold">${escapeHtml(top[i].name)}</div>
      <div>${top[i].score} pts</div>
      ${top[i].sub ? `<div class="ww-podium__sub">${escapeHtml(top[i].sub)}</div>` : ''}
    </div>` : '<div></div>').join('');
  return `<div class="ww-podium mb-4">${steps}</div>`;
}

/** EL CIERRE COMPARTIDO — lo medido (2026-09-04): el podio ya era uno, pero
 *  lo que lo RODEA (título, empate, ranking del 4º en adelante, botones) vivía
 *  copiado en CUATRO pantallas de fin de partida a más de un bando (duelo,
 *  lista, equipos/memoria, informe en vivo): cuatro cabeceras, cuatro pares de
 *  botones, cuatro criterios de empate. `cierreHtml` es el dueño único de esa
 *  envoltura; cada modo aporta SOLO lo suyo (`resumen`/`extra`/`acciones`),
 *  igual que `cabeceraHtml` con la cabecera del juego.
 *
 *  `ranked`: la MISMA lista que come `podiumHtml` (`{ name, score, tie?, sub? }`,
 *  ya ordenada desc.) — se usa completa: el top 3 va al podio, el resto (si hay
 *  más de 3) al ranking corto de debajo.
 *  `tie`: si se omite, el empate se calcula AQUÍ con el mismo criterio que
 *  desempata el podio (mismo `score` y, si hay `tie` — la hora de meta en
 *  carrera —, el mismo `tie`); pásalo explícito cuando el modo ya decidió el
 *  empate con OTRO criterio (el duelo, con `st.leader`/`st.finishedBy`: dos
 *  paneles a la misma puntuación pero uno terminó antes no es un empate).
 *  `resumen`/`extra`/`acciones`: HTML propio del modo, en ese orden fijo.
 *  `clase`: clases extra en el nodo raíz — el duelo cuelga ahí su celebración
 *  (rayos/foco/corona), toda resuelta en CSS puro sobre esta misma estructura. */
export function cierreHtml({ ranked, tie, resumen = '', extra = '', acciones = '', clase = '' } = {}) {
  const list = ranked || [];
  const top = list[0], second = list[1];
  const empatado = tie != null ? tie
    : list.length > 1 && top.score === second.score
      && (top.tie == null || top.tie === second.tie);
  // Sin `top` (ranked vacío: sala sin respuestas) no hay ganador que anunciar,
  // igual que un empate — el título se decide por `ganador`, NO por `empatado`
  // a secas, para que ese borde no reviente sobre un nombre inexistente.
  const ganador = empatado || !top ? null : top;
  const titulo = ganador
    ? `<i class="bi bi-trophy-fill text-warning"></i> ¡<span class="ww-cierre__nombre">${escapeHtml(ganador.name)}</span> gana!`
    : '<i class="bi bi-emoji-neutral"></i> ¡Empate!';
  const resto = list.length > 3 ? `
    <div class="ww-cierre__ranking">${list.slice(3).map((p, i) => `
      <div class="ww-cierre__rank-row"><span>${i + 4}. ${escapeHtml(p.name)}</span><b>${p.score}</b></div>`).join('')}
    </div>` : '';
  return `
    <div class="ww-cierre ${clase}">
      <div class="ww-cierre__titulo">${titulo}</div>
      <div class="ww-cierre__podio">${podiumHtml(list.slice(0, 3))}</div>
      ${resto}
      ${resumen}
      ${extra}
      <div class="ww-cierre__acciones">${acciones}</div>
    </div>`;
}
