// Tangram — armar las 7 piezas clásicas sobre la silueta gris hasta cubrirla.
import { BaseTemplate } from '../../templates/base.js';
import { renderTangramPlayer } from './player.js';
import { renderTangramEditor } from './editor.js';
import { scoreTangramSubmission } from './scorer.js';
import { normalizarContenido, normalizarItem, colocacionesDePreset, esCuadradoRoto } from './content.js';
import { ORDEN_SILUETAS } from './game/siluetas.js';

export class TangramTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<import('../../kernel/contracts/activity.js').TangramContent>} */
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
    // v2 (§24): el ítem guarda `nombre` + las 7 `colocaciones` que armó el
    // docente; la v1 guardaba solo `figura` del catálogo. Ver migrateContent.
    templateVersion: 3,
    // OBLIGATORIO (contrato): frase corta de cómo se juega — la pantalla de inicio.
    instructions: 'Arrastra las piezas hasta cubrir la figura gris. Toca una pieza para girarla; tócala dos veces para voltearla.',
    // El EDITOR se declara (lo exige el contrato): `generado:true` dice que
    // el profe NO añade elementos (norte §4c: las 7 piezas las trae el
    // juego; el docente ARMA la figura con ellas en el tablero, o parte de
    // una del catálogo) — igual que Colorear y Rompecabezas. Sin este
    // `generado`, la suite exige un revisor de contenido por modelo en
    // core/activityCheck.js que aquí no aplica.
    editor: {
      generado: true,
      primerPaso: 'Carga una figura de partida y mueve las piezas en el tablero: lo que quede armado es la silueta que jugará la clase.',
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
    // Contenido DEMO jugable (nunca nace vacía — igual que el resto).
    defaultContent: () => ({
      items: [normalizarItem({ figura: ORDEN_SILUETAS[0] })],
    }),
  };

  static renderPlayer = renderTangramPlayer;
  static renderEditor = renderTangramEditor;
  static scoreSubmission = scoreTangramSubmission;

  // v1 → v2 (§24): `{id, figura}` pasa a `{id, nombre, colocaciones}` copiando
  // la solución de esa figura del catálogo (desconocida → la primera). Un
  // ítem ya v2 se devuelve TAL CUAL (idempotente: correr dos veces = una), y
  // otro contenido cualquiera no es de esta plantilla: se devuelve sin tocar.
  /**
   * @template C
   * @param {C} content
   * @returns {C}
   */
  static migrateContent(content, desde = 1) {
    if (!content || typeof content !== 'object' || !Array.isArray(/** @type {{items?: unknown}} */ (content).items)) return content;
    const v2 = normalizarContenido(content);
    // v3 · EL «CUADRADO» QUE NO ERA UN CUADRADO. Las actividades creadas antes
    // de v1.51.715 copiaron del catálogo una disección rota (la pieza del
    // cuadrado fuera, el paralelogramo volteado). Se sube SOLO si las siete
    // piezas están exactamente donde las dejó aquel catálogo: si el docente
    // movió una, la figura es suya (§24) y se queda como está.
    if (desde < 3) {
      for (const it of v2.items) {
        if (esCuadradoRoto(it.colocaciones)) it.colocaciones = colocacionesDePreset('cuadrado');
      }
    }
    return /** @type {C} */ (/** @type {unknown} */ (v2));
  }

  // Preview de tarjeta (miniatura del home) — OBLIGATORIO (contrato). Markup
  // estático de la primera pantalla; reusa los builders del player cuando puedas.

}
