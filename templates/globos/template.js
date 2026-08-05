// Explota Globos — pregunta arriba, las opciones flotan como GLOBOS de colores;
// tocas el globo correcto y explota. MISMO contenido que Quiz (modelo qa, mismo
// scorer y mismo editor): solo cambia la mecánica — el caso "Wordwall" puro.
import { BaseTemplate } from '../base.js';
import { renderGlobosPlayer, balloonFieldHtml, wireBalloonField } from './player.js';
import { renderQuizEditor } from '../quiz/editor.js';
import { scoreQuizSubmission } from '../quiz/scorer.js';
import { shuffle } from '../../core/roundRender.js';
import { escapeHtml } from '../../core/html.js';
import { emptyHtml } from '../../core/previewKit.js';

export class GlobosTemplate extends BaseTemplate {
  static meta = {
    name: 'globos',
    label: 'Explota Globos',
    icon: 'bi-balloon-fill',
    color: 'danger',
    contentModel: 'qa',           // mismo contenido que Quiz/Operaciones
    templateVersion: 1,
    paginated: true,   // una pregunta por pantalla → nº de páginas = nº de ítems
    instructions: 'Lee la pregunta y toca el globo con la respuesta correcta para explotarlo.',
    panelFit: 'fill',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: [], submit: 'gesto' },
    needsImageUpload: true,       // el editor (el de Quiz) sube imagen por pregunta
    needsAudioUpload: false,
    defaultRules: () => ({ timer: 0, randomize: false, shuffleOptions: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ items: [
      { id: 'gl1', question: '¿Cuál es la capital de España?', answer: 'Madrid', options: ['Madrid', 'Barcelona', 'Lisboa', 'París'], points: 1, image: null, audio: null },
      { id: 'gl2', question: '¿Cuánto es 6 × 7?', answer: '42', options: ['36', '42', '48'], points: 1, image: null, audio: null },
      { id: 'gl3', question: '¿De qué color es el sol?', answer: 'Amarillo', options: ['Amarillo', 'Verde', 'Azul', 'Rojo'], points: 1, image: null, audio: null },
    ] }),
  };

  static renderPlayer = renderGlobosPlayer;
  // MISMO editor y MISMO scorer que Quiz: el contenido es idéntico (qa); esta
  // plantilla solo aporta la mecánica de globos.
  static renderEditor = renderQuizEditor;
  static scoreSubmission = scoreQuizSubmission;

  // Payload de ronda (VS/Equipos): igual que Quiz — pregunta + opciones, SIN answer.
  static getRoundPayload(activity, ctx) {
    const item = activity.content.items[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts);
    return { id: item.id, question: item.question, image: item.image || null, options: opts, points: item.points || 1 };
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

  // Preview de tarjeta: la pregunta + un puñado de globos con los colores de las
  // formas del skin (los mismos tokens que pinta el juego).
  static previewHtml(act) {
    const it = (act.content?.items || [])[0];
    if (!it) return emptyHtml(act);
    const opts = (it.options || []).slice(0, 4);
    return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;gap:1rem">
      <h3 class="ww-q">${escapeHtml(it.question || '')}</h3>
      <div style="flex:1;display:flex;align-items:center;justify-content:space-evenly;">
        ${opts.map((o, i) => `
          <div style="width:150px;height:180px;border-radius:50% 50% 48% 48% / 55% 55% 45% 45%;
            background:var(--ww-shape-${(i % 4) + 1});display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:800;font-size:1.15rem;text-align:center;padding:10px;
            box-shadow:inset -8px -10px 0 rgba(0,0,0,.12);">${escapeHtml(o)}</div>`).join('')}
      </div>
    </div>`;
  }

  static migrateContent(content) { return content; }
}
