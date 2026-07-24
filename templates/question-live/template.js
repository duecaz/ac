import { BaseTemplate } from '../base.js';
import { renderQuestionLiveEditor } from './editor.js';
import { renderQuestionLivePlayer } from './player.js';
import { wheelSvg } from '../wheel/render.js';
import { newItem, migrateLegacyItems } from '../../core/contentModels/items.js';
import { escapeHtml } from '../../core/html.js';


export class QuestionLiveTemplate extends BaseTemplate {
  static meta = {
    name: 'question-live',
    label: 'Abre Cajas',
    icon: 'bi-grid-3x3-gap-fill',
    color: 'warning',
    contentModel: 'items',
    templateVersion: 2,   // v2: campo `q` → `question` (vocabulario reservado)
    instructions: 'Espera tu turno: cuando salga tu pregunta, respóndela como indique el docente.',
    aspectRatio: '4/3',
    modes: { solo: true, live: true, async: false, practice: false },
    needsImageUpload: false, // images stored inline as data-URLs (no external upload)
    needsAudioUpload: false,
    defaultRules: () => ({ selector: 'boxes' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        newItem('¿Cuál es la capital de Francia?'),
        newItem('¿Cuánto es 8 × 7?'),
        newItem('¿Quién escribió el Quijote?'),
        newItem('¿Cuál es el río más largo del mundo?'),
        newItem('¿En qué año llegó Colón a América?'),
        newItem('¿Cuál es el planeta más grande del sistema solar?'),
      ]
    })
  };
  static renderPlayer = renderQuestionLivePlayer;
  static renderEditor = renderQuestionLiveEditor;
  // v1 usaba `q`; la hoja compartida lo migra a `question` (idempotente).
  static migrateContent(content) { return migrateLegacyItems(content); }

  // Required by the registry for live-capable templates.
  // Question Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  static getRoundPayload(activity, { itemIndex }) {
    return activity.content?.items?.[itemIndex] ?? null;
  }
  static scoreSubmission() { return { correct: null, points: 0, hits: 0, total: 0 }; }   // puntúa el profe (ql_points): sin mérito automático

  // Preview de tarjeta: rejilla de cajas numeradas de colores (o ruleta de
  // números si la actividad usa el selector de ruleta) — como el player solo.
  static previewHtml(act) {
    const BOX = ['#e74c3c', '#e67e22', '#d4ac0d', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#c0392b'];
    const items = act.content?.items || act.content?.entries || [];
    const n = items.length || 6;
    if (act.rules?.selector === 'wheel') {
      const labels = Array.from({ length: Math.min(n, 8) }, (_, i) => String(i + 1));
      return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
        ${wheelSvg(labels, { size: 520 })}
        <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Abre Cajas')}</div>
      </div>`;
    }
    const cols = Math.min(4, Math.max(2, Math.ceil(n / 2)));
    const boxes = Array.from({ length: n }, (_, i) =>
      `<div style="background:${BOX[i % BOX.length]};color:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:clamp(1.6rem,9cqmin,3.4rem);font-weight:800;aspect-ratio:1">${i + 1}</div>`
    ).join('');
    return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;gap:1.2rem;justify-content:center">
      <div class="fs-3 fw-bold text-center">${escapeHtml(act.title || 'Abre Cajas')}</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;max-width:760px;margin:0 auto;width:100%">${boxes}</div>
    </div>`;
  }
}
