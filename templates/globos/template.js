// Explota Globos — pregunta arriba, las opciones flotan como GLOBOS de colores;
// tocas el globo correcto y explota. MISMO contenido que Quiz (modelo qa, mismo
// scorer y mismo editor): solo cambia la mecánica — el caso "Wordwall" puro.
import { basePoints } from '../../core/scoring/index.js';
import { stripSeededPoints } from '../../core/contentModels/qa.js';
import { adoptForQuiz } from '../../kernel/content/qaAdapt.js';
import { BaseTemplate } from '../base.js';
import { renderGlobosPlayer, balloonFieldHtml, wireBalloonField } from './player.js';
import { renderQuizEditor } from '../quiz/editor.js';
import { scoreQuizSubmission } from '../quiz/scorer.js';
import { shuffle } from '../../core/azar.js';
import { escapeHtml } from '../../core/html.js';

export class GlobosTemplate extends BaseTemplate {
  static meta = {
    name: 'globos',
    label: 'Explota Globos',
    icon: 'bi-balloon-fill',
    color: 'danger',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'qa',           // mismo contenido que Quiz/Operaciones
    templateVersion: 2,
    paginated: true,   // una pregunta por pantalla → nº de páginas = nº de ítems
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'pregunta', primerPaso: 'Pulsa «Añadir pregunta» y escribe la pregunta con sus respuestas: una correcta y las demás no.' },
    instructions: 'Lee la pregunta y toca el globo con la respuesta correcta para explotarlo.',
    panelFit: 'fill',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: [], submit: 'gesto' },
    needsImageUpload: true,       // el editor (el de Quiz) sube imagen por pregunta
    needsAudioUpload: false,
    // 30 s por pregunta desde el nacimiento (dueño 2026-09-01, como el quiz).
    defaultRules: () => ({ timer: 30, randomize: false, shuffleOptions: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ items: [
      { id: 'gl1', question: '¿Cuál es la capital de España?', answer: 'Madrid', options: ['Madrid', 'Barcelona', 'Lisboa', 'París'], image: null, audio: null },
      { id: 'gl2', question: '¿Cuánto es 6 × 7?', answer: '42', options: ['36', '42', '48'], image: null, audio: null },
      { id: 'gl3', question: '¿De qué color es el sol?', answer: 'Amarillo', options: ['Amarillo', 'Verde', 'Azul', 'Rojo'], image: null, audio: null },
    ] }),
  };

  static renderPlayer = renderGlobosPlayer;
  // MISMO editor y MISMO scorer que Quiz: el contenido es idéntico (qa); esta
  // plantilla solo aporta la mecánica de globos.
  static renderEditor = renderQuizEditor;
  static scoreSubmission = scoreQuizSubmission;
  // …y por lo mismo, la MISMA adopción de contenido. Faltaba, y el fallo no se
  // veía hasta jugar: al traer contenido de Operaciones —que es `qa` pero SIN
  // opciones, porque se responde con el teclado— los ítems entraban tal cual y
  // la pantalla salía vacía, sin un globo que tocar. `adoptForQuiz` construye
  // las opciones que faltan. Reutilizar el editor y el scorer de otra plantilla
  // y NO reutilizar su adopción es la costura por donde se coló.
  static adoptContent(content) { return adoptForQuiz(content); }

  // Payload de ronda (VS/Equipos): igual que Quiz — pregunta + opciones, SIN answer.
  static getRoundPayload(activity, ctx) {
    const item = activity.content.items[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts);
    // Los puntos salen de la fórmula única (item si lo tiene, si no el panel):
    // aquí estaba cableado `|| 1`, así que «Puntos por acierto: 10» tampoco
    // llegaba a la ronda de VS/Equipos.
    return { id: item.id, question: item.question, image: item.image || null, options: opts,
             points: basePoints(item, activity?.scoring) };
  }

  // Ronda VS/Equipos-auto: el mismo campo de globos; tocar = responder.
  static renderRound(root, payload, { onSubmit } = {}) {
    root.innerHTML = `<div class="gl-round">
      <p class="gl-round-q">${escapeHtml(payload?.question || '')}</p>
      ${balloonFieldHtml(payload?.options || [])}
    </div>`;
    wireBalloonField(root, { onPick: (value, btn) => {
      root.querySelectorAll('.gl-balloon').forEach(b => { b.disabled = true; });
      btn.classList.add('gl-pop');
      onSubmit?.(value);
    } });
  }


  // v1→v2: fuera el `points: 1` sembrado, que anulaba «Puntos por acierto»
  // del panel (el profe ponía 10 y el duelo seguía dando 1).
  static migrateContent(content) { return stripSeededPoints(content); }
}
