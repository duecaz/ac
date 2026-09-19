// Memory player: grid of face-down cards. Each pair contributes two cards
// (one with .left text, one with .right text), sharing pair.id. Flip 2 → if
// ids match, both stay; else they flip back after revealMs.
import { html, escapeHtml, mount, raizDe } from '../../core/html.js';
import { on } from '../../core/events.js';
import { scoreMemorySubmission } from './scorer.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/azar.js';
import { pairComplete } from '../../core/contentModels/pairs.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { memoryRules } from './template.js';

// TIEMPO DE REVELADO POR DEFECTO — el mismo número vivía escrito a mano tres
// veces (`defaultRules`/editor/player, barrido B5 2026-09-02); el dueño es
// quien lo CONSUME de verdad (el player, aquí abajo).
export const DEFAULT_REVEAL_MS = 900;

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').Pair} Pair
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 * @typedef {import('../../kernel/contracts/session.js').ScoreResult} ScoreResult
 */

/** UNA CARTA del mazo: dos por par, con el id del par que comparten.
 * @typedef {Object} MemoryCard
 * @property {string} cardId
 * @property {string} pairId
 * @property {string} text
 */

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export async function renderMemoryPlayer(rootSel, activity, opts = {}) {
  // Misma regla que el editor y que Emparejar (core/contentModels/pairs.js).
  // Esta copia además ignoraba las imágenes: una pareja dibujo↔palabra se caía
  // del juego aunque el editor la diera por buena.
  const pairs = (/** @type {PairsContent} */ (activity.content)?.pairs || []).filter(pairComplete);
  if (!pairs.length) { mount(rootSel, html`<div class="alert alert-warning m-4">Sin pares.</div>`); return; }

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  // Techo = lo que da el propio scorer si se casan todas las parejas.
  const byId = new Map(pairs.map(p => [p.id, p]));
  const maxScore = activity.scoring?.maxScore
    || pairs.reduce((s, p) => s + scoreMemorySubmission({ value: p.id, item: p, activity }).points, 0);
  // Suma con piso 0 (un fallo penaliza solo si la actividad configura
  // pointsPerWrong negativo; el marcador nunca baja de cero).
  /** @param {ScoreResult} res */
  const addScore = (res) => { state.score = Math.max(0, state.score + res.points); };
  const rules = memoryRules(activity);
  const revealMs = rules.revealMs ?? DEFAULT_REVEAL_MS;
  const columns = Math.max(2, Math.min(8, rules.columns || 4));

  // Todas las cartas (2 por par), en orden canónico. El mazo se baraja al montar,
  // salvo que haya progreso guardado (F5): entonces se recompone ese mismo orden.
  /** @type {MemoryCard[]} */
  const allCards = pairs.flatMap(p => [
    { cardId: p.id + ':L', pairId: p.id, text: p.left },
    { cardId: p.id + ':R', pairId: p.id, text: p.right }
  ]);
  // El progreso guardado es FRONTERA (viene del almacén): se estrecha por forma.
  const bruto = ctx.loadProgress();
  const saved = bruto && typeof bruto === 'object' ? /** @type {Record<string, unknown>} */ (bruto) : null;
  const deckIds = Array.isArray(saved?.deckIds) ? saved.deckIds.map(String) : null;
  const lockedIds = Array.isArray(saved?.locked) ? saved.locked.map(String) : null;
  /** @type {MemoryCard[]|null} */
  let recompuesto = null;
  if (deckIds && lockedIds && deckIds.length === allCards.length) {
    const cardById = new Map(allCards.map(c => [c.cardId, c]));
    /** @type {MemoryCard[]} */
    const ordered = [];
    for (const id of deckIds) {
      const c = cardById.get(id);
      if (!c) { ordered.length = 0; break; }
      ordered.push(c);
    }
    if (ordered.length === deckIds.length) recompuesto = ordered; // orden y cartas coherentes
  }
  const restored = !!recompuesto;
  const deck = recompuesto ?? shuffle(allCards.slice());

  const state = {
    score: 0, matched: 0, mistakes: 0, flips: 0,
    /** @type {string[]} */
    open: [],            // currently face-up (and not yet matched)
    /** @type {Set<string>} */
    locked: new Set(),   // matched cardIds (stay open)
    busy: false
  };
  if (restored && saved) {
    state.score = Number(saved.score) || 0;
    state.matched = Number(saved.matched) || 0;
    state.mistakes = Number(saved.mistakes) || 0;
    state.flips = Number(saved.flips) || 0;
    state.locked = new Set(lockedIds ?? []);
  }

  const snapshot = () => ({
    deckIds: deck.map(c => c.cardId), locked: [...state.locked],
    score: state.score, matched: state.matched, flips: state.flips, mistakes: state.mistakes,
  });

  // ── EL TABLERO SE MONTA UNA VEZ, Y UNA JUGADA CAMBIA CARTAS ───────────────
  // Hasta v1.51.725 cada volteo hacía `mount(rootSel, …)` con el player entero:
  // medido en la matriz, de 51 nodos no sobrevivía ninguno, y un ACIERTO lo
  // rehacía DOS veces con un solo toque (una al abrir la segunda carta y otra
  // al casarlas). Aquí eso es peor que en Quiz o en Tildes, porque al voltear
  // NO cambia el contenido —las cartas ya están puestas—: lo único que cambia
  // es el ESTADO de una o dos de ellas. En una pizarra Android lenta, rehacer
  // doce botones para volver a pintar los mismos doce se nota con el dedo.
  //
  // Cada carta nace con SUS DOS CARAS dentro (el texto y el dorso) y cuál se ve
  // lo decide una clase: así voltear no reemplaza hijos, solo cambia estado.
  /** @param {MemoryCard} c @returns {string} */
  const cartaHtml = (c) => `<button class="mc" data-id="${escapeHtml(c.cardId)}">`
    + `<span class="mc-text">${escapeHtml(c.text)}</span>`
    + `<i class="bi bi-question-lg mc-dorso"></i>`
    + `</button>`;

  mount(rootSel, html`
    <div class="ww-memory">
      ${cabeceraHtml({
        pagina: `${state.matched} / ${pairs.length}`,
        extra: `Flips: ${state.flips}`,
      })}
      <div class="edu-sec edu-sec--tablero ww-memo-grid" style="grid-template-columns:repeat(${columns},1fr)">
        ${deck.map(cartaHtml).join('')}
      </div>
    </div>`);

  const raiz = raizDe(rootSel);
  const gridOpt = raiz?.querySelector('.ww-memo-grid') ?? null;
  if (!gridOpt) return;   // el marco no llegó a montarse (§23)
  ctx.listo();   // la superficie ya existe: el shell arranca su reloj (§23)
  /** Cada carta, por su id. Se resuelve UNA vez: durante la partida los nodos
   *  son siempre los mismos, así que no hace falta volver a buscarlos.
   *  @type {Map<string, HTMLButtonElement>} */
  const nodos = new Map([...gridOpt.querySelectorAll('.mc')]
    .map(b => [/** @type {HTMLButtonElement} */ (b).dataset.id || '', /** @type {HTMLButtonElement} */ (b)]));

  /** El estado visual de UNA carta, desde el estado del juego. Es el único
   *  sitio que toca el DOM del tablero. @param {string} cardId @returns {void} */
  function pintarCarta(cardId) {
    const btn = nodos.get(cardId);
    if (!btn) return;
    const casada = state.locked.has(cardId);
    btn.classList.toggle('mc-locked', casada);
    btn.classList.toggle('mc-open', !casada && state.open.includes(cardId));
    btn.disabled = casada;
  }

  /** Los indicadores, por su dato (nunca rehaciendo la cabecera). */
  const pintarHud = () => {
    hudSet(raiz, 'pagina', `${state.matched} / ${pairs.length}`);
    hudSet(raiz, 'extra', `Flips: ${state.flips}`);
  };

  // Reanudar (F5): el mazo ya viene en el orden guardado y las parejas casadas
  // se marcan aquí, en el primer montaje — nadie las «descubre» otra vez.
  for (const id of state.locked) pintarCarta(id);

  // Un solo handler, delegado en la raíz, para toda la partida: los botones ya
  // no se reemplazan, así que no hay nada que volver a cablear.
  on(rootSel, 'click', '.mc', (_, btn) => onFlip(btn.dataset.id));

  /** @param {string|undefined} cardId */
  function onFlip(cardId) {
    if (!cardId) return;
    if (state.busy) return;
    if (state.locked.has(cardId)) return;
    if (state.open.includes(cardId)) return;
    state.open.push(cardId);
    state.flips += 1;
    pintarCarta(cardId);
    pintarHud();
    if (state.open.length === 2) {
      const [a, b] = state.open;
      const pa = a.split(':')[0], pb = b.split(':')[0];
      if (pa === pb && a !== b) {
        state.locked.add(a); state.locked.add(b);
        state.matched += 1;
        addScore(scoreMemorySubmission({ value: pb, item: byId.get(pa), activity }));   // pa === pb → acierto
        state.open = [];
        pintarCarta(a); pintarCarta(b);   // SOLO esas dos: pasan a casadas
        pintarHud();
        if (state.matched >= pairs.length) finish();
        else ctx.saveProgress(snapshot()); // estado estable → reanudable
      } else {
        state.busy = true;
        addScore(scoreMemorySubmission({ value: pb, item: byId.get(pa), activity }));   // pa ≠ pb → fallo
        state.mistakes += 1;
        setTimeout(() => {
          if (!ctx.alive()) return;
          state.open = [];
          state.busy = false;
          pintarCarta(a); pintarCarta(b);   // se cierran ESAS DOS, y nada más
          ctx.saveProgress(snapshot());
        }, revealMs);
      }
    }
  }

  // TERMINAR con lo que haya. Se llega aquí por dos caminos —levantar el último
  // par o que se acabe el tiempo— y el segundo no puede repetir el podio.
  let terminado = false;
  function finish() {
    if (terminado) return;
    terminado = true;
    ctx.finish({
      title: '¡Memorizado!',
      lead: `Puntos: <b>${state.score}</b> / ${maxScore}`,
      stats: ({ timeUsed }) => `${pairs.length} pares · ${state.flips} flips · ${state.mistakes} fallos · ${timeUsed}s`,
      score: state.score,
      maxScore,
    });
  }

  // El RELOJ no espera a nadie: si hay cuenta atrás y se agota, se cierra con
  // los pares que se hayan levantado (el scorer ya los fue sumando).
  ctx.alAgotarse(finish);
}
