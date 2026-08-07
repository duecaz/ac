// Random wheel: spin, land on one entry. Solo/practice + Live (teacher-scored).
import { BaseTemplate } from '../base.js';
import { renderWheelPlayer } from './player.js';
import { renderWheelEditor } from './editor.js';
import { wheelSvg } from './render.js';
import { migrateLegacyItems } from '../../core/contentModels/items.js';
import { escapeHtml } from '../../core/html.js';

export class WheelTemplate extends BaseTemplate {
  static meta = {
    name: 'wheel',
    label: 'Ruleta',
    icon: 'bi-bullseye',
    color: 'success',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'items',
    templateVersion: 3,   // v3: campo `q` → `question` (vocabulario reservado)
    instructions: 'Gira la ruleta y responde la pregunta que toque.',
    aspectRatio: '1/1',
    modes: { solo: true, live: true, async: false, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: ['claim'] },
    needsImageUpload: true,   // wheel/editor.js: imagen opcional por entrada (data-URL, 200 KB)
    needsAudioUpload: false,
    // `selector: 'wheel'` es la DECLARACIÓN de que esta actividad usa la ruleta
    // para elegir turno (§0): antes la vista lo deducía del NOMBRE de la
    // plantilla. `normalize()` lo rellena también en las actividades ya
    // guardadas, así que las salas antiguas siguen girando la ruleta.
    defaultRules: () => ({ spinDurationMs: 4000, removeAfterSpin: false, selector: 'wheel' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        { question: 'Opción 1', image: null },
        { question: 'Opción 2', image: null },
        { question: 'Opción 3', image: null },
        { question: 'Opción 4', image: null },
      ]
    })
  };
  static renderPlayer = renderWheelPlayer;
  static renderEditor = renderWheelEditor;
  // v1 entries planas y v2 `q` → forma actual {id, question, image} (hoja compartida).
  static migrateContent(content) { return migrateLegacyItems(content); }
  // Required by the registry for live-capable templates.
  // Wheel Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  // ANSWER-SAFETY (R5): whitelist de campos de PANTALLA — nunca el ítem crudo.
  // El modelo `items` hoy no guarda clave de respuesta, pero un passthrough
  // filtraría cualquier campo que un contenido importado traiga de más.
  static getRoundPayload(activity, { itemIndex }) {
    const it = activity.content?.items?.[itemIndex];
    return it ? { id: it.id, question: it.question, image: it.image || null } : null;
  }
  static scoreSubmission() { return { correct: null, points: 0, hits: 0, total: 0 }; }   // puntúa el profe (ql_points): sin mérito automático

}
