// Etiqueta el diagrama — arrastra cada etiqueta al pin correcto sobre una imagen
// (estilo Wordwall "Label the diagram"). Reutiliza el motor de cuerdas de
// Emparejar (core/connectRope.js) pero los destinos son PINES a (x,y) sobre la
// imagen en vez de una segunda columna. Modelo de contenido: 'diagram'.
import { BaseTemplate } from '../base.js';
import { renderDiagramPlayer } from './player.js';
import { renderDiagramEditor } from './editor.js';
import { newPin } from '../../core/contentModels/diagram.js';
import { scoreDiagramSubmission } from './scorer.js';
import { escapeHtml } from '../../core/html.js';
import { emptyHtml } from '../../core/previewKit.js';

// Imagen de ejemplo (una cara simple) como SVG inline → funciona sin subir nada.
const SAMPLE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>" +
  "<rect width='400' height='300' fill='#eef2ff'/>" +
  "<circle cx='200' cy='150' r='115' fill='#fde3c4' stroke='#e0a878' stroke-width='4'/>" +
  "<circle cx='155' cy='128' r='16' fill='#fff' stroke='#333' stroke-width='3'/><circle cx='155' cy='131' r='7' fill='#333'/>" +
  "<circle cx='245' cy='128' r='16' fill='#fff' stroke='#333' stroke-width='3'/><circle cx='245' cy='131' r='7' fill='#333'/>" +
  "<path d='M200 150 q-14 22 0 30' fill='none' stroke='#c98a5a' stroke-width='4'/>" +
  "<path d='M160 205 q40 34 80 0' fill='none' stroke='#b5533a' stroke-width='6' stroke-linecap='round'/>" +
  "</svg>";
const SAMPLE_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(SAMPLE_SVG);

export class DiagramTemplate extends BaseTemplate {
  static meta = {
    name: 'diagram',
    label: 'Etiqueta el diagrama',
    icon: 'bi-pin-map-fill',
    color: 'success',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'diagram',
    templateVersion: 1,
    instructions: 'Arrastra cada etiqueta al punto correcto del dibujo. Pulsa Enviar para corregir.',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: [] },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules: () => ({ timer: 0, randomize: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({
      image: SAMPLE_IMAGE,
      pins: [
        { ...newPin(0.50, 0.11), label: 'Cabeza' },
        { ...newPin(0.39, 0.43), label: 'Ojo' },
        { ...newPin(0.50, 0.60), label: 'Nariz' },
        { ...newPin(0.50, 0.73), label: 'Boca' },
      ],
    }),
  };

  static renderPlayer = renderDiagramPlayer;
  static renderEditor = renderDiagramEditor;
  static scoreSubmission = scoreDiagramSubmission;

  // Preview de tarjeta: imagen central con sus pines (en %) y las etiquetas como
  // pastillas con punto conector a los lados.
  static previewHtml(act) {
    const pins = (act.content?.pins || []).filter(p => p && String(p.label || '').trim());
    const image = act.content?.image;
    if (!image || !pins.length) return emptyHtml(act);
    const labels = pins.slice(0, 6);
    const half = Math.ceil(labels.length / 2);
    const pill = (p, side) => `<div style="position:relative;display:flex;align-items:center;justify-content:center;
        padding:12px 26px;border-radius:999px;border:3px solid #c7d2fe;background:#fff;font-weight:700;
        font-size:1.3rem;color:#1f2937;box-shadow:0 3px 10px rgba(0,0,0,.06);white-space:nowrap;">
      ${escapeHtml(p.label)}
      <span style="position:absolute;${side === 'L' ? 'right' : 'left'}:-11px;width:20px;height:20px;border-radius:50%;
        background:#94a3b8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);"></span></div>`;
    const pinDot = (p) => `<span style="position:absolute;left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%;
        transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:#fff;
        border:6px solid #475569;box-sizing:border-box;box-shadow:0 1px 5px rgba(0,0,0,.4);"></span>`;
    return `<div style="display:flex;height:100%;gap:26px;align-items:stretch;">
      <div style="flex:0 0 auto;display:flex;flex-direction:column;gap:20px;justify-content:center;align-items:flex-start;">
        ${labels.slice(0, half).map(p => pill(p, 'L')).join('')}</div>
      <div style="flex:1 1 auto;display:flex;align-items:center;justify-content:center;min-width:0;">
        <div style="position:relative;display:inline-block;line-height:0;">
          <img src="${escapeHtml(image)}" style="max-width:100%;max-height:640px;display:block;border-radius:10px;" alt="">
          ${pins.map(pinDot).join('')}
        </div>
      </div>
      <div style="flex:0 0 auto;display:flex;flex-direction:column;gap:20px;justify-content:center;align-items:flex-end;">
        ${labels.slice(half).map(p => pill(p, 'R')).join('')}</div>
    </div>`;
  }

  static migrateContent(content) { return content; }
}
