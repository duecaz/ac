import { BaseTemplate } from '../base.js';
import { renderMathPlayer } from './player.js';
import { renderMathEditor } from './editor.js';
import { renderKeypadRound } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';
import { adoptForMath } from '../../kernel/content/qaAdapt.js';
import { escapeHtml } from '../../core/html.js';

export class MathTemplate extends BaseTemplate {
  static meta = {
    name: 'math',
    label: 'Operaciones',
    icon: 'bi-calculator-fill',
    color: 'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'qa',
    templateVersion: 1,
    paginated: true,   // una operación por pantalla → nº de páginas = nº de ítems
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'operación', primerPaso: 'Pulsa «Generar» para crear operaciones de golpe, o «Añadir operación» para escribirlas tú.' },
    instructions: 'Resuelve cada operación y escribe el resultado con el teclado.',
    panelFit: 'block',   // el teclado es UN bloque: no se estira en el panel VS
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'race', teams: 'turns', live: ['rounds', 'race'], retry: true, submit: 'boton' },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ items: [
      { id: 'm1', question: '2 × 6', answer: '12', points: 1 },
      { id: 'm2', question: '2 × 7', answer: '14', points: 1 },
      { id: 'm3', question: '3 × 4', answer: '12', points: 1 },
      { id: 'm4', question: '5 × 3', answer: '15', points: 1 },
    ] }),
  };
  static renderPlayer = renderMathPlayer;
  static renderEditor = renderMathEditor;
  static scoreSubmission = scoreMathSubmission;

  static getRoundPayload(activity, ctx) { const it = activity.content.items[ctx.itemIndex]; return it ? { question: it.question } : null; }
  static renderRound(root, payload, opts) { return renderKeypadRound(root, payload, opts); }
  static migrateContent(content) { return content; }
  // Adapta el contenido al cambiar de formato HACIA Matemáticas (quita opciones).
  static adoptContent(content) { return adoptForMath(content); }
}
