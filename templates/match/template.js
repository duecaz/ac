// Match Up: two columns; tap left then right to pair. Solo + async.
import { BaseTemplate } from '../base.js';
import { rid } from '../../core/ids.js';
import { renderMatchPlayer } from './player.js';
import { renderMatchEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { renderChoiceRound } from '../../core/roundRender.js';
import { shuffle } from '../../core/azar.js';
import { scoreMatchSubmission } from './scorer.js';
import { escapeHtml } from '../../core/html.js';

export class MatchTemplate extends BaseTemplate {
  static meta = {
    name: 'match',
    label: 'Emparejar',
    icon: 'bi-link-45deg',
    color: 'info',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'pairs',
    templateVersion: 1,
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'par', primerPaso: 'Pulsa «Añadir par» y escribe los dos elementos que el alumno tendrá que unir.' },
    instructions: 'Une cada elemento con su pareja arrastrando de uno al otro. Pulsa Enviar para corregir.',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: [], submit: 'gesto' },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules: () => ({ timer: 0, randomize: true, livesPerMistake: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const id = () => rid('p_');
      return { pairs: [
        { id: id(), left: 'España',    right: 'Madrid' },
        { id: id(), left: 'México',    right: 'Ciudad de México' },
        { id: id(), left: 'Argentina', right: 'Buenos Aires' },
        { id: id(), left: 'Colombia',  right: 'Bogotá' },
      ]};
    }
  };
  static renderPlayer = renderMatchPlayer;
  static renderEditor = renderMatchEditor;
  static scoreSubmission = scoreMatchSubmission;


  // One pair = one matching round: prompt is the left side, options are the
  // right sides (the correct one + up to 3 distractors), shuffled. Answer-safe:
  // the payload never says which option is right.
  static getRoundPayload(activity, ctx) {
    const pairs = activity.content?.pairs || [];
    const item = pairs[ctx.itemIndex];
    if (!item || !item.right) return null;
    const answer = String(item.right);
    const others = pairs.map(p => String(p.right)).filter(r => r && r !== answer);
    const distractors = shuffle([...new Set(others)]).slice(0, 3);
    return { id: item.id, question: String(item.left), image: item.image || null,
             options: shuffle([answer, ...distractors]) };
  }

  // The matching round is a multiple-choice pick of the right side.
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  static migrateContent(content) { return content; }
}
