// Tangram — armar las 7 piezas clásicas sobre la silueta gris hasta cubrirla.
import { BaseTemplate } from '../../templates/base.js';
import { renderTangramPlayer } from './player.js';
import { renderTangramEditor } from './editor.js';
import { scoreTangramSubmission } from './scorer.js';
import { rid } from '../../core/ids.js';
import { ORDEN_SILUETAS } from './game/siluetas.js';

export class TangramTemplate extends BaseTemplate {
  static meta = {
    name: 'tangram',
    label: 'Tangram',
    icon: 'bi-triangle-fill',              // bootstrap-icons
    color: 'success',            // color bootstrap del botón/badge
    // familia (norte §4c): 'ejercicio' (el docente pone el contenido) o 'juego'
    // (la plantilla lo genera; entonces declara también meta.skill y async:false).
    kind: 'juego',
    skill: 'Espacial',   // el eje del catálogo de juegos (norte §4c)
    contentModel: 'tangram',     // registrado en kernel/content/models.js
    templateVersion: 1,
    // OBLIGATORIO (contrato): frase corta de cómo se juega — la pantalla de inicio.
    instructions: 'Arrastra las piezas hasta cubrir la figura gris. Toca una pieza para girarla; tócala dos veces para voltearla.',
    // El EDITOR se declara (lo exige el contrato): `generado:true` dice que
    // el profe NO añade elementos (norte §4c: el contenido lo trae el
    // juego, solo se ELIGE la figura) — igual que Colorear y Rompecabezas.
    // Sin este `generado`, la suite exige un revisor de contenido por
    // modelo en core/activityCheck.js que aquí no aplica.
    editor: {
      generado: true,
      primerPaso: 'Elige qué silueta jugará la clase en la rejilla de abajo.',
    },
    panelFit: 'fill',             // panel VS: 'fill' (llena y escala) | 'block' | 'center'
    aspectRatio: '4/3',           // marco del player: '16/10' | '4/3' | '1/1' | 'auto'
    modes: { solo: true, live: false, async: false },   // juego: sin Tarea (§4c/§4d)
    // POLÍTICA DE JUEGO (contrato): cómo se comporta en cada modo — la leen el
    // motor y las vistas, no la adivinan. Tangram nace SOLO-Individual (no hay
    // VS/Equipos «a medias»: una silueta no se reparte entre dos pantallas).
    play: {
      vs: 'none', teams: 'none', live: [],
      // El toque ES la respuesta (arrastrar/girar/voltear): cero botones de envío.
      submit: 'gesto',
      // Sin reloj: la silueta gris es la pista pasiva y no hay penalización
      // por tardar (§29: nadie revela solo, nadie corre contra nadie).
      reloj: { unidad: null, crono: false },
    },
    defaultRules:   () => ({}),
    // Puntuación FIJA (§ enunciado): 100 puntos al resolver, nada por fallar
    // (no hay «fallar»: no se puede enviar a medias). El scorer no lee estos
    // campos —son informativos para el panel de Puntuación— la cifra real
    // vive en scorer.js (PUNTOS_RESOLVER), un solo dueño (§21b).
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 100, pointsPerWrong: 0, maxScore: 100 }),
    defaultLive:    () => ({}),
    // Contenido DEMO jugable (nunca nace vacía — igual que las 12 reales).
    defaultContent: () => ({
      items: [{ id: rid('it_'), figura: ORDEN_SILUETAS[0] }],
    }),
  };

  static renderPlayer = renderTangramPlayer;
  static renderEditor = renderTangramEditor;
  static scoreSubmission = scoreTangramSubmission;

  // Preview de tarjeta (miniatura del home) — OBLIGATORIO (contrato). Markup
  // estático de la primera pantalla; reusa los builders del player cuando puedas.

}
