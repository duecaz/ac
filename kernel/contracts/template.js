// TemplateContract — the shape every activity template (plugin) must satisfy.
// Mirrors templates/base.js. The registry validates this at register time.
//
// Conditional requirements:
//   - If meta.modes.live === true, the template MUST provide getRoundPayload()
//     AND scoreSubmission() — LIVE play strips answers per round and scores
//     server-side, so both are mandatory there.
//   - adoptContent() is OPTIONAL (no se valida): solo donde dos plantillas comparten
//     contentModel pero distinta forma de ítem (quiz↔math).

/**
 * @typedef {Object} TemplateModes
 * @property {boolean} [solo]     Single-device, local scoring (Wordwall-style).
 * @property {boolean} [live]     Hosted room with PIN/QR + realtime (Kahoot-style).
 * @property {boolean} [async]    Self-paced / homework.
 * @property {boolean} [practice] Untracked practice.
 */

/**
 * @typedef {Object} TemplateMeta
 * @property {string} name                 Unique id, e.g. 'quiz'. REQUIRED.
 * @property {string} [label]              Human label shown in pickers.
 * @property {string} [icon]               Bootstrap Icons class, e.g. 'bi-question-circle-fill'.
 * @property {string} [color]              Bootstrap color token.
 * @property {string} contentModel         Which ContentModel this consumes. REQUIRED.
 *                                         Drives switch-template compatibility.
 * @property {number} [templateVersion]    Bump when content shape changes.
 * @property {'16/10'|'4/3'|'16/9'|'1/1'|'auto'} [aspectRatio] Player frame ratio.
 * @property {TemplateModes} modes         Supported play modes. REQUIRED.
 * @property {boolean} [needsImageUpload]
 * @property {boolean} [needsAudioUpload]
 * @property {() => Object} [defaultRules]
 * @property {() => Object} [defaultScoring]
 * @property {() => Object} [defaultLive]
 * @property {() => Object} [defaultContent]
 */

/**
 * @typedef {Object} RoundContext
 * @property {number} itemIndex Index of the item/round being served.
 */

/**
 * @typedef {Object} ScoreInput
 * @property {*} value          The learner's submitted value.
 * @property {Object} [item]    The content item being scored.
 * @property {number} [msTaken] Time taken in ms (for speed bonus).
 * @property {Object} activity  The full activity.
 */

/**
 * @typedef {Object} ScoreResult
 * @property {boolean} correct
 * @property {number} points
 */

/**
 * The static surface of a template class. Templates are classes with static
 * members (not instances), matching templates/base.js.
 *
 * @typedef {Object} TemplateContract
 * @property {TemplateMeta} meta
 * @property {(rootSel: string|Element, activity: Object, opts?: Object) => void} renderPlayer  REQUIRED.
 * @property {(root: Element, activity: Object, onChange: Function) => void} renderEditor       REQUIRED.
 * @property {(activity: Object, ctx: RoundContext) => (Object|null)} [getRoundPayload]  Required when modes.live.
 * @property {(input: ScoreInput) => ScoreResult} [scoreSubmission]                      Required when modes.live.
 * @property {(content: Object, fromVersion: number) => Object} [migrateContent]
 * @property {(content: Object, fromTemplate: string) => Object} [adoptContent]  Adapta el
 *   contenido al CONVERTIR hacia esta plantilla desde otra del MISMO contentModel pero
 *   distinta forma de ítem (p. ej. Matemáticas→Quiz genera options[]). Lo invoca
 *   kernel/content/switch.js (applySwitch). Reglas en kernel/content/qaAdapt.js.
 */

export {};
