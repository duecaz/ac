// Colorear — un JUEGO para inicial (norte §4c, docs/handoff-juegos-inicial.md):
// el dibujo lo trae la app (banco compartido con Rompecabezas en
// assets/juegos/dibujos/), el docente solo ELIGE cuál. Sin clave de
// respuesta: cualquier zona pintada de cualquier color es correcta, así que no
// hay "mal" (§29: nadie revela solo, no hay nada que revelar).
import { BaseTemplate } from '../../templates/base.js';
import { renderColorearPlayer } from './player.js';
import { renderColorearEditor } from './editor.js';
import { scoreColorearSubmission, PUNTOS_TERMINAR } from './scorer.js';
import { rid } from '../../core/ids.js';

export class ColorearTemplate extends BaseTemplate {
  static meta = {
    name: 'colorear',
    label: 'Colorear',
    icon: 'bi-palette-fill',              // bootstrap-icons
    color: 'warning',            // color bootstrap del botón/badge
    // familia (norte §4c): 'ejercicio' (el docente pone el contenido) o 'juego'
    // (la plantilla lo genera; entonces declara también meta.skill y async:false).
    kind: 'juego',
    skill: 'Motricidad fina',   // el eje del catálogo de juegos (norte §4c)
    contentModel: 'colorear',     // registrado en kernel/content/models.js
    templateVersion: 1,
    // OBLIGATORIO (contrato): frase corta de cómo se juega — la pantalla de inicio.
    // Sin dar por hecho que el que juega LEE (§1 del norte, público 3-6 años):
    // el gesto ya es la instrucción, esta frase es para el profe que prepara la clase.
    instructions: 'Toca un color y luego toca la parte del dibujo que quieras pintar.',
    // El EDITOR se declara (lo exige el contrato). Aquí no se AÑADE nada —el
    // profe no crea zonas ni preguntas—, solo ELIGE de un banco fijo: por eso
    // es `generado: true` (como Pelotas con su tablero), nunca `elemento`.
    editor: {
      generado: true,
      primerPaso: 'Elige un dibujo del banco: casa, pez, flor, coche, globo, gato, sol o mariposa.',
    },
    panelFit: 'fill',             // panel VS: 'fill' (llena y escala) | 'block' | 'center'
    aspectRatio: '4/3',           // marco del player: '16/10' | '4/3' | '1/1' | 'auto'
    // Juego (§4c/§4d): sin Tarea (mandarlo a casa sin profe delante) y sin En
    // vivo (no hay ronda que compartir: cada niño colorea a su ritmo).
    modes: { solo: true, live: false, async: false },
    // POLÍTICA DE JUEGO (contrato): cómo se comporta en cada modo — la leen el
    // motor y las vistas, no la adivinan. Sin VS/Equipos: colorear no se compite
    // (§29, nadie revela solo — comparar "quién pintó mejor" no tiene sentido
    // sin clave). submit:'boton' porque hace falta decir "ya terminé" —el toque
    // no distingue "pintando" de "terminado"— con UN botón (edu-send, «Listo»).
    // Sin reloj: colorear no se cronometra (su mecánica no mide tiempo, como
    // el tablero de Pelotas, que ya lleva el suyo a la vista).
    play: { vs: 'none', teams: 'none', live: [], submit: 'boton', reloj: { unidad: null, crono: false } },
    // NINGUNA opción de partida (play.options): el contrato limita cada opción a
    // 2-4 valores y el banco tiene 8 dibujos — no encaja como "opción de
    // partida, ya elegida" (R2). El dibujo es una decisión de CONTENIDO (qué
    // actividad es esta), así que vive en el editor, como el nivel de Pelotas.
    defaultRules:   () => ({}),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: PUNTOS_TERMINAR }),   // el mismo número que usa el scorer (§21b)
    defaultLive:    () => ({}),
    // Contenido DEMO jugable (nunca nace vacía — igual que las 12 reales).
    defaultContent: () => ({
      items: [{ id: rid('it_'), dibujo: 'casa' }],
    }),
  };

  static renderPlayer = renderColorearPlayer;
  static renderEditor = renderColorearEditor;
  static scoreSubmission = scoreColorearSubmission;

  // §24: versión 1, sin forma previa que migrar — cuando suba, aquí se escribe
  // la conversión (nunca se reinterpreta contenido viejo en el player).
}
