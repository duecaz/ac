// EL RUNNER DE UNA HOJA DE CORRECCIÓN EN INDIVIDUAL Y TAREA: pagina las frases,
// las puntúa con el scorer de la plantilla, las corrige y cierra la partida.
//
// Compartido por Tildes y Comas (lo único que cambia es la marca). La pantalla
// de cada frase la pone core/textCorrectionRonda.js, el veredicto palabra por
// palabra core/textCorrectionRevision.js y el texto core/textCorrectionPasaje.js.
//
// C2 de la consolidación: corre sobre el SHELL libre (core/soloPlayer.js) — el
// shell pone timeUsed, la pantalla estándar (+ apéndice de revisión), el guardado
// (trySaveResult según persistPolicy) y la REANUDACIÓN F5, que este runner no
// tenía cuando era el "3er shell" con su copia manual de todo eso.
import { html, mount, raizDe } from './html.js';
import { scoreMarksPerHit } from './textMarks.js';
import { frasesDe } from './contentModels/textCorrection.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { runFreeformPlayer } from './soloPlayer.js';
import { passageHtml, fitPassage } from './textCorrectionPasaje.js';
import { filasRevision, panelRevisionHtml, valorAnulado } from './textCorrectionRevision.js';
import { renderTextCorrectionRound, desdeToque, herramientasTcHtml } from './textCorrectionRonda.js';
import { cabeceraHtml, hudSet, hudMandos, relojActivo } from './playerHud.js';
import { corrigeAlFinal } from './constants.js';
import { relojDe } from './reloj.js';

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/activity.js').Passage} Passage */
/** @typedef {import('./textCorrectionPasaje.js').Marca} Marca */

// Full SOLO runner shared by Tildes and Comas: paginate passages one per
// screen, mark the text, "Listo" reveals the correct/wrong/missed marks, then
// advance. Puntúa NETO por marca (scoreMarksPerHit, la fuente única).
/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../kernel/contracts/template.js').PlayerOpts} [opts]
 * @param {{kind: Marca, title?: string}} o
 */
export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = { kind: 'tilde' }) {
  const passages = frasesDe(activity).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }
  const ppc = activity.scoring?.pointsPerCorrect || 1;
  // maxScore = total de marcas de la actividad (nº de tildes/comas a colocar).
  const totalMarks = passages.reduce((n, p) => n + (p.marks || []).filter(m => m.kind === kind).length, 0);
  const maxScore = activity.scoring?.maxScore || totalMarks * ppc || passages.length * ppc;

  // EL RELOJ ES DEL SHELL, también aquí. Esta hoja cuenta POR FRASE —lo declara
  // la plantilla (`meta.play.reloj.unidad === 'frase'`)— y lo único que hace es
  // PEDIRLE al shell que lo rearme en cada una. Tuvo el suyo propio y durante
  // una versión hubo DOS cuentas atrás escribiendo el mismo chip; la salida de
  // entonces fue apagar el del shell con un booleano, que dejaba la puerta
  // abierta a que mañana otro runner trajera el suyo. Ahora no hay con qué.
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let idx = 0, score = 0, hits = 0, misses = 0, over = 0;
  /** Lo cerrado de cada frase: lo marcado, lo que pedía y su puntaje.
   *  @typedef {{p: Passage, got: Set<number>, want: Set<number>, hits: number,
   *    misses: number, over: number, total: number, correct: boolean,
   *    points: number, anuladas?: number[]}} ResultadoFrase */
  /** @type {ResultadoFrase[]} */
  const passageResults = [];

  // Reanudar (F5): el snapshot guarda contadores + el detalle por frase en forma
  // serializable; `got`/`want` (Sets para la corrección visual) se reconstruyen.
  /** @param {Passage} p @returns {Set<number>} */
  const wantOf = (p) => new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
  // El progreso llega YA ESTRECHADO por el shell (`crearProgreso`, que es quien
  // posee la frontera del almacén): aquí solo se comprueba lo que esta ronda
  // sabe —que el índice va a medias— y se leen sus propios campos.
  const guardado = ctx.loadProgress();
  const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const fila = (/** @type {unknown} */ v) => (v && typeof v === 'object'
    ? /** @type {Record<string, unknown>} */ (v) : {});
  if (guardado && Number.isInteger(guardado.idx) && num(guardado.idx) > 0
      && num(guardado.idx) < passages.length && Array.isArray(guardado.results)) {
    idx = num(guardado.idx); score = num(guardado.score);
    hits = num(guardado.hits); misses = num(guardado.misses); over = num(guardado.over);
    for (const cruda of guardado.results) {
      const r = fila(cruda);
      const p = passages[num(r.i)];
      if (!p) continue;
      passageResults.push({ p, got: new Set((Array.isArray(r.got) ? r.got : []).map(num)),
        want: wantOf(p), hits: num(r.hits),
        misses: num(r.misses), over: num(r.over), total: num(r.total),
        correct: !!r.correct, points: num(r.points) });
    }
  }
  const snapshot = () => ({
    idx, score, hits, misses, over,
    results: passageResults.map((r, i) => ({ i, got: [...r.got], hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points })),
  });

  // EL TIEMPO ES POR HOJA (decisión del dueño, 2026-08-27). El campo ya existía
  // y nadie lo leía en Individual: `rules.timer` son «segundos por ítem», y en
  // Tildes/Comas un ítem ES una frase. No se inventa un campo nuevo — hacerlo
  // habría dejado dos sitios donde poner tiempo y ninguno claramente el bueno.
  // (OJO: `item.seconds` es otra cosa, se llama «Tiempo en vivo» y solo lo lee
  // el panel del host para la ventana de la ronda.)
  // El reloj lo decide y lo lleva `core/reloj.js` —el mismo que usan las otras
  // doce— y esta ronda solo dice DÓNDE se pinta: su propia barra, no el chip del
  // HUD. Antes tenía aquí su cuenta atrás y su cronómetro, copiados: por eso el
  // ajuste del editor acabó existiendo en unas plantillas sí y en otras no.
  const segundos = Math.max(0, Number(activity.rules?.timer) || 0);

  // ── LA HOJA SE MONTA UNA VEZ ───────────────────────────────────────────────
  // Hasta v1.51.723 esto era un `shell(bodyHtml)` que hacía `mount(rootSel, …)`
  // en CADA fase —frase, corrección, siguiente frase—, así que de 196 nodos no
  // sobrevivía ninguno a pulsar «Listo»: el reloj y el botón de pantalla
  // completa se destruían y volvían a nacer entre frase y frase. La hoja de
  // papel (`.tc-round`) y su banda de arriba (la cabecera, con el lápiz, la
  // página, el RELOJ y el maximizar) son la ESTRUCTURA de la partida, no de la
  // frase: se montan aquí y ya no se tocan. Cada fase pinta solo el CUERPO.
  const hayReloj = relojDe(activity).tipo !== 'ninguno';
  mount(rootSel, html`
    <div class="tc-solo">
      <div class="tc-round">
        ${cabeceraHtml({
          herramientas: herramientasTcHtml(),
          pagina: `1 / ${passages.length}`,
          tiempo: hayReloj ? '' : undefined,
          progreso: segundos > 0,
        })}
        <div class="tc-body" data-tc-body></div>
      </div>
    </div>`);
  const raiz = raizDe(rootSel);
  const cuerpoOpt = raiz?.querySelector('[data-tc-body]') ?? null;
  if (!cuerpoOpt) return;   // el marco no llegó a montarse (§23)
  const cuerpo = cuerpoOpt;
  ctx.listo();   // la hoja ya existe: el shell puede arrancar su reloj (§23)

  /** Lo único que cambia entre fases: el cuerpo de la hoja, y los indicadores
   *  por su DATO. Fuera de la hoja se escribe (herramientas y reloj a la vista);
   *  en la corrección no hay nada que dibujar ni tiempo que contar.
   *  @param {string} bodyHtml @param {{escribiendo?: boolean}} [o] */
  function pintarCuerpo(bodyHtml, { escribiendo = false } = {}) {
    cuerpo.innerHTML = bodyHtml;
    hudSet(raiz, 'pagina', `${Math.min(idx + 1, passages.length)} / ${passages.length}`);
    hudMandos(raiz, escribiendo);
    // EL RELOJ ES DE LA HOJA, no de la corrección — y se apaga ENTERO (número y
    // barra). Ocultar solo el número dejaba la barra de agotamiento congelada en
    // el porcentaje donde acabó la frase: con la cabecera estable ya no muere
    // sola, hay que apagarla.
    relojActivo(raiz, escribiendo && hayReloj);
  }

  function ask() {
    // La hoja de esta frase, DENTRO del cuerpo: la cabecera (lápiz · página ·
    // reloj · maximizar) es la misma que ya estaba y no se toca. `cabecera:
    // false` + `mandos` es lo que le dice a la ronda que aquí ya hay una y que
    // su interruptor vive en ella.
    pintarCuerpo('', { escribiendo: true });
    const ronda = renderTextCorrectionRound(cuerpo, passages[idx] || null, {
      kind, onSubmit: grade, cabecera: false, mandos: raiz,
    });
    // Se acabó el tiempo: se entrega LO QUE HAYA. Ni se pierde el trabajo ni se
    // deja al alumno bloqueado en una hoja que ya no puede terminar. (Se vuelve a
    // decir en cada frase porque la hoja que hay que entregar es otra.)
    ctx.alAgotarse(() => ronda.flush());
    ctx.rearmarReloj();   // frase nueva ⇒ tiempo nuevo (la unidad es la frase)
  }

  // ANULAR ES DEL DOCENTE, NO DEL ALUMNO (§22). El botón solo existe en
  // Individual —el modo que se juega con el aparato en la mano, en la pizarra—;
  // en Tarea el alumno juega solo y desde casa, y un botón para darse por bueno
  // convertiría el informe en una encuesta. Se pregunta por el MODO, que es lo
  // que la plataforma declara, no por quién creemos que está delante.
  const anulable = (!opts.mode || opts.mode === 'solo') && activity.review?.allowOverride !== false;

  // CORREGIR AL FINAL, POR DEFECTO (dueño 2026-08-27). Enseñar la corrección
  // entre frase y frase parte el trabajo del alumno: el que va bien pierde el
  // hilo y el que va mal se desanima a mitad. Al final, la hoja se ha hecho
  // entera y la corrección es lo que el PROFE repasa con la clase — que es
  // cuando de verdad sirve. Se puede apagar desde el editor para practicar con
  // realimentación inmediata, pero el defecto es el que pidió el aula.
  const alFinal = corrigeAlFinal(activity);

  /** Aplica las anulaciones del docente a una frase YA cerrada y ajusta los
   *  totales. Puntúa el MISMO scorer (nunca una suma a mano) y vive en un solo
   *  sitio porque lo usan los dos caminos: la corrección entre frases y la del
   *  final. Tenerlo dos veces era pedir que divergieran. */
  /** @param {number} i @param {Set<number>} anulados */
  function recalcular(i, anulados) {
    const prev = passageResults[i];
    if (!prev) return null;
    const rr = scoreMarksPerHit(valorAnulado([...prev.got], anulados, prev.p, kind), prev.p, [kind], activity);
    score += rr.points - prev.points;
    hits += rr.hits - prev.hits;
    over += (rr.over ?? 0) - prev.over;
    misses += (rr.total - rr.hits) - prev.misses;
    Object.assign(prev, { hits: rr.hits, over: rr.over, misses: rr.total - rr.hits,
                          correct: rr.perfect, points: rr.points, anuladas: [...anulados] });
    return rr;
  }

  /** Pasar de frase: al final de la última, a la corrección o al resultado. */
  function siguiente() {
    if (idx === passages.length - 1) { alFinal ? corregirTodo() : finish(); return; }
    idx++; ctx.saveProgress(snapshot()); ask();
  }

  /** @param {number[]} value */
  function grade(value) {
    ctx.pararReloj();   // esta frase ya está entregada: su tiempo no corre
    const p = passages[idx];
    if (!p) return;
    // MISMO scorer que VS/Equipos/Live/Tarea (fuente única): no reimplementamos
    // el conteo aquí. `want/got` solo alimentan la corrección visual y la analítica.
    const want = wantOf(p);
    const got = new Set((value || []).map(Number));
    const r = scoreMarksPerHit(value, p, [kind], activity);
    const miss = r.total - r.hits;
    score += r.points; hits += r.hits; misses += miss; over += (r.over ?? 0);
    // Guarda el detalle por frase (aciertos/fallos/de-más + posiciones + puntos) —
    // materia prima de la analítica por palabra del docente (F3).
    passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: (r.over ?? 0), total: r.total, correct: !!r.perfect, points: r.points });
    if (r.perfect) emitGame(GameEvents.ANSWER_CORRECT, { points: r.points });
    else emitGame(GameEvents.ANSWER_WRONG, {});
    if (alFinal) { siguiente(); return; }
    reveal(value, { hits: r.hits, over: (r.over ?? 0), misses: miss, total: r.total, correct: !!r.perfect });
  }


  /**
   * @param {number[]} value
   * @param {{hits: number, over: number, misses: number, total: number, correct: boolean}} r
   */
  function reveal(value, r) {
    const p = passages[idx];
    if (!p) return;
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    const got = new Set(value.map(Number));
    const last = idx === passages.length - 1;
    /** @type {Set<number>} */
    const anulados = new Set();
    const filas = filasRevision(p, kind, got);
    // LA CABECERA SIGUE AHÍ EN LA CORRECCIÓN, y ahora es LA MISMA: no se repinta,
    // solo se apagan sus herramientas (aquí no se dibuja) y su reloj (aquí no se
    // cuenta). Sin ella, el botón de pantalla completa volvía a la esquina
    // flotante y saltaba de sitio en cada frase (cabecera → esquina → cabecera):
    // el sitio de un mando no puede depender de en qué mitad del ejercicio estás.
    pintarCuerpo(`
      <div class="tc-hoja">
        <div class="edu-sec edu-sec--texto tc-corrige">
          <div class="tc-passage-area"><div class="tc-passage">${passageHtml(p.text, kind, { got, want })}</div></div>
          <div class="tc-review-slot">${panelRevisionHtml(filas, anulados, { anulable })}</div>
        </div>
        <div class="tc-done-wrap edu-send">
          <span class="tc-verdict ${r.correct ? 'ok' : 'bad'}" data-verdicto>
            <i class="bi ${r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            ${r.hits}/${r.total} aciertos${r.over ? ` · ${r.over} de más` : ''}
          </span>
          <div class="mt-2"><button type="button" class="btn btn-primary btn-lg tc-next">
            ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
          </button></div>
        </div>
      </div>`);
    // ANULAR: se repinta el panel y se recalcula con el MISMO scorer. El
    // resultado de la frase NO se cierra hasta pulsar «Siguiente» — mientras el
    // docente está mirando la revisión, todavía puede cambiar de idea.
    const slot = cuerpo.querySelector('.tc-review-slot');
    slot?.addEventListener('click', (e) => {
      const b = desdeToque(e.target).closest('[data-anular]');
      if (!b) return;
      const pos = Number(b.dataset.anular);
      if (anulados.has(pos)) anulados.delete(pos); else anulados.add(pos);
      slot.innerHTML = panelRevisionHtml(filas, anulados, { anulable });
      const rr = scoreMarksPerHit(valorAnulado(value, anulados, p, kind), p, [kind], activity);
      const v = cuerpo.querySelector('[data-verdicto]');
      if (v) {
        v.className = `tc-verdict ${rr.perfect ? 'ok' : 'bad'}`;
        v.innerHTML = `<i class="bi ${rr.perfect ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i> `
          + `${rr.hits}/${rr.total} aciertos${rr.over ? ` · ${rr.over} de más` : ''}`;
      }
    });

    // El texto de la corrección también LLENA el área (mismo tamaño grande).
    const areaEl = /** @type {HTMLElement} */ (cuerpo.querySelector('.tc-passage-area'));
    const passageEl = /** @type {HTMLElement} */ (areaEl.querySelector('.tc-passage'));
    const stopFit = fitPassage(areaEl, passageEl);
    // (el botón de pantalla completa lo cablea el marco, por delegación)
    cuerpo.querySelector('.tc-next')?.addEventListener('click', () => {
      stopFit();
      // AQUÍ se cierra la frase, con las anulaciones ya aplicadas. `grade` dejó
      // un resultado provisional; si el docente tocó algo, se sustituye por el
      // que sale del scorer con las posiciones ajustadas — nunca por una suma
      // hecha a mano en esta vista.
      if (anulados.size) recalcular(passageResults.length - 1, anulados);
      siguiente();
    });
  }

  /** LA CORRECCIÓN AL FINAL — todas las hojas de una vez, cada una con su lista
   *  de palabras. Es a la vez la corrección del alumno y el RESUMEN POR PÁGINA
   *  del docente: con la hoja entera hecha, el profe la repasa con la clase y
   *  puede anular lo que quiera antes de cerrar el resultado.
   *  Nada se guarda hasta pulsar «Finalizar»: mientras se repasa todavía se
   *  puede cambiar de idea, y un puntaje que se cierra a mitad de la revisión no
   *  es el que el profe acabó dando. */
  function corregirTodo() {
    /** @type {Map<number, Set<number>>} */
    const anuladosDe = new Map(passageResults.map((_, i) => [i, new Set()]));
    /** El panel de UNA hoja. @param {number} i @returns {string} */
    const panelDe = (i) => {
      const r = passageResults[i];
      return r ? panelRevisionHtml(filasRevision(r.p, kind, r.got), anuladosDe.get(i) || new Set(), { anulable }) : '';
    };
    pintarCuerpo(`
      <div class="tc-final">
        <div class="tc-final__cab">
          <b>Corrección</b>
          <span class="tc-final__tot" data-total>${hits} de ${totalMarks} · ${score} pts</span>
          <button type="button" class="btn btn-primary tc-fin"><i class="bi bi-flag-fill"></i> Finalizar</button>
        </div>
        ${passageResults.map((r, i) => `
          <section class="tc-final__hoja">
            <h6 class="tc-final__n">Frase ${i + 1}</h6>
            <div class="tc-final__cuerpo">
              <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
              <div class="tc-review-slot" data-hoja="${i}">${panelDe(i)}</div>
            </div>
          </section>`).join('')}
      </div>`);

    // ANULAR CAMBIA UNA PALABRA, NO LA PANTALLA. Antes cada toque volvía a
    // pintar la corrección ENTERA —las N frases, con sus paneles—: con la clase
    // delante, el profe perdía el sitio del scroll en cada perdón que daba. Se
    // reescribe el panel de ESA hoja y el total, que es lo único que cambia.
    cuerpo.querySelector('.tc-final')?.addEventListener('click', (e) => {
      const b = desdeToque(e.target).closest('[data-anular]');
      if (b) {
        const hoja = /** @type {HTMLElement|null} */ (b.closest('[data-hoja]'));
        const i = Number(hoja?.dataset.hoja);
        const pos = Number(b.dataset.anular);
        const set = anuladosDe.get(i);
        if (!set || !hoja) return;
        if (set.has(pos)) set.delete(pos); else set.add(pos);
        recalcular(i, set);
        hoja.innerHTML = panelDe(i);
        const tot = cuerpo.querySelector('[data-total]');
        if (tot) tot.textContent = `${hits} de ${totalMarks} · ${score} pts`;
        return;
      }
      if (desdeToque(e.target).closest('.tc-fin')) finish();
    });
  }

  function finish() {
    // Con la corrección al final ya se han visto TODAS las hojas una por una:
    // repetir aquí las falladas es enseñar dos veces lo mismo en dos pantallas
    // seguidas.
    const wrongResults = alFinal ? [] : passageResults.filter(r => !r.correct);
    const reviewHtml = wrongResults.length ? `
      <div class="tc-review mt-4 text-start" style="max-width:900px;margin:0 auto;padding:0 1rem">
        <h5 class="mb-3"><i class="bi bi-search"></i> Revisión de errores</h5>
        ${wrongResults.map((r) => `
          <div class="tc-review-item mb-4">
            <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
          </div>`).join('')}
      </div>` : '';
    // El shell pinta la pantalla estándar (+ la revisión como apéndice), guarda el
    // resultado según persistPolicy y entrega `answers` a onFinish (analítica F3).
    ctx.finish({
      score, maxScore,
      lead: `Aciertos: <b>${hits}</b> / ${totalMarks}`,
      stats: ({ timeUsed }) => `${hits} aciertos · ${misses} sin marcar · ${over} de más · ${timeUsed}s`,
      after: reviewHtml,
      answers: passageResults.map((r, i) => ({ i, v: [...r.got], c: r.correct, p: r.points || 0 })),
    });
  }

  ask();
}
