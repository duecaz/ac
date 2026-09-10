// Tildes. Tap the vowels that take an accent — the single touch-first mechanic
// shared by solo, VS, Equipos and LIVE (see core/textCorrectionRound.js).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseAccentedText, applyMarks } from '../../core/textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost, textCorrectionPreviewHtml, passageRoundPayload } from '../../core/textCorrectionRound.js';
import { markPartsFor, markValueParts, passageLabel } from '../../core/textMarks.js';
import { scoreTildesSubmission } from './scorer.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').TextCorrectionContent} TextCorrectionContent
 * @typedef {import('../../kernel/contracts/activity.js').Passage} Passage
 * @typedef {import('../../kernel/contracts/session.js').RoundContext} RoundContext
 * @typedef {import('../../kernel/contracts/session.js').RoundPayload} RoundPayload
 * @typedef {import('../../kernel/contracts/template.js').RoundCallbacks} RoundCallbacks
 * @typedef {import('../../kernel/contracts/template.js').HostRoundContext} HostRoundContext
 */

/** @param {unknown} v @returns {v is object} */
const esObjeto = (v) => !!v && typeof v === 'object';

/** Este contenido es el de Tildes/Comas (una lista de frases con sus marcas).
 * Se pregunta por FORMA porque `migrateContent` lo recibe como el contenido de
 * cualquier modelo (la base no sabe de quién es).
 * @param {unknown} c @returns {c is TextCorrectionContent} */
const esTextCorrection = (c) => esObjeto(c) && Array.isArray(/** @type {{passages?: unknown}} */ (c).passages);

export class TildesTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<TextCorrectionContent>} */
  static meta = {
    name: 'tildes',
    label: 'Tildes',
    icon: 'bi-pencil-fill',
    color: 'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'textCorrection',
    markNoun:        'tilde',   // lo que el alumno marca (informes) — §26: la plantilla lo DECLARA
    templateVersion: 1,
    paginated: true,   // una frase por pantalla → nº de páginas = nº de frases
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'frase', primerPaso: 'Pulsa «Añadir frase» y escribe una oración; luego marca qué vocales llevan tilde.' },
    instructions: 'Dibuja la tilde (´) sobre las vocales que la llevan. Cuando termines, pulsa “Listo” para corregir.',
    panelFit: 'fill',    // el texto llena el panel y se escala para caber
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    // Se juega MARCANDO sobre un texto, así que en una pizarra interactiva
    // conviene calibrar el lápiz antes de empezar. Lo DECLARA la plantilla: la
    // pantalla de inicio preguntaba «¿te llamas tildes o comas?», que es la ley
    // §0 al revés (un modo no conoce plantillas concretas).
    seMarcaConLapiz: true,
    play:            { vs: 'points', teams: 'turns', live: ['rounds', 'race'], submit: 'boton' , reloj: { unidad: 'frase' } },
    // `allowOverflow`/`showHints` se quitaron (barrido B1, 2026-09-02):
    // prometidas sin mecánica — decisión del dueño.
    defaultRules: () => ({ timer: 30, randomize: false }),
    // DIEZ POR MARCA, no uno (dueño 2026-08-27, comparando con la app anterior:
    // «cada tilde es 10 puntos por defecto»). En una pizarra a tres metros, 20 y
    // 120 se leen y 2 y 12 no. Solo cambia el DEFECTO de las actividades nuevas:
    // las que ya existen llevan su `pointsPerCorrect` guardado y el editor tiene
    // el campo «Puntos por acierto», así que un 1 almacenado puede ser una
    // decisión del profe — migrarlo sería pisarle el contenido (§24).
    defaultScoring: () => ({ pointsPerCorrect: 10, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const examples = [
        'Jamás tanto cariño doloroso, jamás tanta cerca arremetió lo lejos, jamás el fuego nunca jugó mejor su rol de frío muerto! Jamás, señor ministro de salud, fue la salud más mortal',
        'y la migraña extrajo tanta frente de la frente! Y el mueble tuvo en su cajón, dolor, el corazón, en su cajón, dolor, la lagartija, en su cajón, dolor.',
      ];
      return { passages: examples.map(s => ({ ...newPassage(), ...parseAccentedText(s) })) };
    },
    // Suggest a notebook background by default — author can override.
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderTildesPlayer;
  static renderEditor = renderTildesEditor;
  static scoreSubmission = scoreTildesSubmission;


  // One passage = one round. The answer key (marks) is stripped from the payload.
  /**
   * @param {import('../../kernel/contracts/activity.js').Activity} activity
   * @param {RoundContext} ctx
   * @returns {RoundPayload|null}
   */
  static getRoundPayload(activity, ctx) { return passageRoundPayload(activity, ctx.itemIndex); }

  // One passage = one round (tap the accented vowels). Shared renderer.
  // `chips` viaja tal cual a la ronda (contrato de barra única): quedarse solo
  // con onSubmit era lo que dejaba a la vista pintando su fila ENCIMA de la
  // barra de la hoja — las dos barras de la captura del dueño.
  /**
   * @param {Element} root
   * @param {RoundPayload} payload
   * @param {RoundCallbacks} [cbs]
   */
  static renderRound(root, payload, { onSubmit, chips } = {}) {
    return renderTextCorrectionRound(root, payload, { kind: 'tilde', onSubmit, chips });   // devuelve { flush }
  }

  // Projector view for LIVE (passage big; solution on reveal).
  /**
   * @param {Element} root
   * @param {HostRoundContext} [ctx]
   */
  static renderRoundHost(root, ctx = {}) {
    // Solo la fase y el pasaje: lo demás del contexto del host (payload,
    // respuestas) no lo mira la vista de proyector de texto.
    renderTextCorrectionHost(root, {
      phase: ctx.phase,
      item: esObjeto(ctx.item) ? /** @type {Passage} */ (ctx.item) : null,
      kind: 'tilde',
    });
  }

  // Analítica por parte (M1): cada parte = una tilde requerida (key=posición,
  // label=palabra) → el informe pinta un heatmap sobre el texto con el % de la
  // clase que acertó cada tilde ("jugó en rojo").
  // `item` llega como `unknown` (el contrato no sabe de qué plantilla es): se
  // estrecha por FORMA antes de dárselo al primitivo de marcas.
  /** @param {{item: unknown}} input */
  static itemParts({ item }) {
    return markPartsFor(esObjeto(item) ? /** @type {Passage} */ (item) : null, 'tilde');
  }
  /** @param {{value: unknown}} input */
  static valueParts({ value }) { return markValueParts(value); }
  /** @param {unknown} item */
  static itemLabel(item) {
    return passageLabel(esObjeto(item) ? /** @type {Passage} */ (item) : null);
  }

  // Recupera pasajes guardados ANTES del fix de normalización: si se pegó texto
  // con tildes DESCOMPUESTAS (vocal + U+0301), el parse viejo no las reconocía →
  // el texto se guardó con acentos combinantes sueltos y `marks` incompleto (el
  // denominador de aciertos salía menor, "3/4" en vez de "3/8"). Reconstruimos el
  // texto acentuado (aplicando las marcas conocidas) y lo re-parseamos ahora con
  // NFC → recupera TODAS las tildes. Idempotente en pasajes ya limpios (las comas
  // literales del texto se conservan; parseAccentedText solo toca acentos). Ver
  // docs/historico/handoff-emparejar-vertical.md (histórico) y core/textMarks.js.
  /**
   * @template C
   * @param {C} content
   * @returns {C}
   */
  static migrateContent(content) {
    if (!esTextCorrection(content)) return content;
    for (const p of content.passages) {
      if (!p || typeof p.text !== 'string') continue;
      // Solo re-parsear si el texto muestra la FIRMA de la corrupción (acentos
      // combinantes U+0300-036F sueltos). migrate() corre en CADA carga/sync de
      // cada actividad — sin este guard, todos los pasajes limpios pagaban el
      // applyMarks+parse completo para siempre.
      if (!/[\u0300-\u036f]/.test(p.text)) continue;
      const re = parseAccentedText(applyMarks(p.text, p.marks || []));
      p.text = re.text;
      p.marks = re.marks;
    }
    return content;
  }
}
