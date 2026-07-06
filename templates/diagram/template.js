// Etiqueta el diagrama — arrastra cada etiqueta al pin correcto sobre una imagen
// (estilo Wordwall "Label the diagram"). Reutiliza el motor de cuerdas de
// Emparejar (core/connectRope.js) pero los destinos son PINES a (x,y) sobre la
// imagen en vez de una segunda columna. Modelo de contenido: 'diagram'.
import { BaseTemplate } from '../base.js';
import { renderDiagramPlayer } from './player.js';
import { renderDiagramEditor } from './editor.js';
import { newPin } from '../../core/contentModels/diagram.js';
import { scoreDiagramSubmission } from './scorer.js';

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
    contentModel: 'diagram',
    templateVersion: 1,
    instructions: 'Arrastra cada etiqueta al punto correcto del dibujo. Pulsa Enviar para corregir.',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
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

  static migrateContent(content) { return content; }
}
