# Cómo añadir una plantilla nueva

Cada plantilla vive en su carpeta `templates/<name>/` y es **autocontenida**: clase, player, editor, scorer (si aplica). Para añadirla, no se toca el core.

## 0. Atajo: el GENERADOR (recomendado)

```bash
node tools/new-template.mjs globos --label "Explota Globos" --icon bi-balloon \
     --color danger --model qa --shell sequential [--vs] [--live] [--dry-run]
```

Crea la carpeta completa (template/player/editor/scorer/index + `styles/<name>.css`
tokenizado), la registra en `core/registerTemplates.js` y **nace cumpliendo el
contrato** (lo garantiza `tests/newTemplate.test.mjs`, que genera en un scratch y
corre los checkers reales). Por defecto la plantilla es SOLO-Individual: `--vs`
añade la ronda (VS/Equipos-auto) y `--live` declara En vivo — así una mecánica a
medio hacer nunca aparece en modos multijugador. Al terminar imprime los pasos
manuales (lista GAME de estilos, `<link>` del CSS, TODOs, docs).

Diagnóstico de una plantilla existente: `node tools/check-template.mjs [name]`.

Las secciones de abajo explican lo que el generador emite, por si lo haces a mano.

## 1. Crea la carpeta y los 4 archivos mínimos

```
templates/
  miplantilla/
    template.js   # clase, meta, defaults
    player.js     # render para SOLO + async (y opcionalmente live-student)
    editor.js     # render del editor
    index.js      # se importa desde main.* y llama a registerTemplate
    scorer.js     # opcional; calcula correct/points si soporta scoring
```

## 2. Define `template.js`

```js
import { BaseTemplate } from '../base.js';
import { renderMyPlayer } from './player.js';
import { renderMyEditor } from './editor.js';

export class MyTemplate extends BaseTemplate {
  static meta = {
    name: 'miplantilla',          // único
    label: 'Mi Plantilla',
    icon: 'bi-star-fill',         // bootstrap-icons
    color: 'warning',             // bootstrap color
    contentModel: 'qa',           // uno de los REGISTRADOS en kernel/content/models.js (tabla abajo)
    templateVersion: 1,
    instructions: 'Frase corta de cómo se juega.', // se muestra en la pantalla de inicio
    panelFit: 'fill',             // maquetación en el panel VS: 'fill' (defecto, el
                                  // contenido llena y se escala) | 'block' (bloque
                                  // único con tope, p.ej. un teclado) | 'center'
    modes: { solo: true, live: false, async: true, practice: false },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules:    () => ({ /* específico */ }),
    defaultScoring:  () => ({ pointsPerCorrect: 1 }),
    defaultLive:     () => ({}),                  // si modes.live
    defaultContent:  () => ({ items: [] })        // shape según contentModel
  };
  static renderPlayer = renderMyPlayer;
  static renderEditor = renderMyEditor;

  // Solo si meta.modes.live = true:
  static getRoundPayload(activity, ctx) { /* return what clients need (NO answer) */ }
  static scoreSubmission({ value, item, msTaken, activity }) { /* { correct, points } */ }

  // Migración interna del content si la versión sube.
  static migrateContent(content, fromVersion) { return content; }
}
```

## 2b. `editor.js` — usa el SHELL (no armes pestañas a mano)

El editor **debe** delegar el chasis en `core/editorShell.js`. Aporta solo tus
paneles; las pestañas **Modos** y **Presentación** (y su gateo) son automáticas.
NO construyas tu propia barra `nav-tabs` (eso es lo que causaba que "cada editor
hiciera lo suyo").

```js
import { renderEditorShell } from '../../core/editorShell.js';

export function renderMyEditor(root, activity, onChange) {
  renderEditorShell(root, activity, onChange, {
    content: { label: 'Contenido', html: (a) => `…`, wire: (root, a, ctx) => { /* ctx.onChange(a); ctx.repaint(); */ } },
    rules:   { html: (a) => `…`, wire: (root, a, ctx) => {} },  // pestaña "Individual" (opcional)
    scoring: { html: (a) => `…`, wire: (root, a, ctx) => {} },  // opcional
    live:    { html: (a) => `…`, wire: (root, a, ctx) => {} },  // opcional; solo si meta.modes.live
    // presentation: false  // para ocultar la pestaña Presentación (por defecto true)
  });
}
```

`ctx = { onChange, repaint }`. Usa `ctx.repaint()` tras alta/baja/reordenado de
ítems (re-renderiza), y `ctx.onChange(a)` en cambios de campo. El título, el
subtítulo, la pestaña **Modos** y la **Presentación** los cablea el shell.

## 3. `index.js` — registro

```js
import { registerTemplate } from '../../core/registry.js';
import { MyTemplate } from './template.js';
registerTemplate(MyTemplate);
export { MyTemplate };
```

## 4. Regístrala en el punto ÚNICO

Los mains NO importan plantillas sueltas: los tres (`main.teacher/student/embed`)
importan `core/registerTemplates.js`, el punto único. Añade ahí tu línea:

```js
import '../templates/miplantilla/index.js';
```

(El generador lo hace solo. Si olvidas este paso, `tests/templateContract.test.mjs`
falla con "carpeta existe pero NO está registrada".)

## 5. (Si soporta LIVE / VS / Equipos-auto) — añade el scorer

La puntuación es **pura y del lado del cliente** (no hay Edge Function; Supabase
fue retirado). Implementa `scoreSubmission` como un `static` de tu plantilla,
normalmente delegando a `templates/miplantilla/scorer.js`:

```js
// templates/miplantilla/scorer.js
import { basePoints, wrongPoints } from '../../core/scoreHelpers.js';
export function scoreMiSubmission({ value, item, activity, mode = 'solo' }) {
  const ok = /* ¿correcto? */;
  if (ok === null) return { correct: null, points: 0 };          // no puntuable
  const scoring = activity?.scoring || {};
  return ok
    ? { correct: true,  points: basePoints(item, scoring) }
    : { correct: false, points: wrongPoints(scoring) };
}
```

Y en `template.js`: `static scoreSubmission = scoreMiSubmission;` (más
`getRoundPayload` si declara `meta.modes.live`). El registro valida que ambas
existan cuando la plantilla es live.

## 6. Modos de juego (qué desbloquea cada método)

Los modos de la página de actividad (Individual · VS · Equipos · En vivo ·
Tarea) **se derivan** de lo que tu plantilla declara/implementa — no se
configuran por actividad. Esta es la única tabla que necesitas; el contrato
completo está en **`docs/modos-de-juego.md`** y el gateo en **`core/modes.js`**.

| Para que la actividad ofrezca… | Implementa / declara… |
|---|---|
| **Individual** | nada extra (siempre) — `renderPlayer` |
| **VS** y **Equipos‑auto** | `scoreSubmission(...)` **y** `renderRound(root, payload, {onSubmit})` (VS además exige ≥2 ítems) |
| **Equipos‑juez** | nada — el docente marca ✓/✗ sobre cualquier contenido |
| **En vivo** | `meta.modes.live = true` + `getRoundPayload` + `scoreSubmission` |
| **Tarea** | `meta.modes.async = true` |

`core/registry.js` valida esto al arrancar y **falla ruidosamente** si declaras
`modes.live` sin `getRoundPayload`/`scoreSubmission`. No escribas pantallas de
modo propias: VS/Equipos/Memoria usan el andamiaje común `views/modeSetup.js`.

## 7. Listo

- Aparecerá automáticamente en `#/new` (selector de plantilla).
- El home pintará Empezar/PIN/Tareas según `meta.modes`.
- La barra de modos de la actividad se gatea sola (tabla §6).
- El editor cargará `renderEditor`. El player, `renderPlayer`.
- Si soporta image upload, usa `core/imagePicker.js` dentro del editor.

## Content models reconocidos

Los REGISTRADOS viven en `kernel/content/models.js` (fuente única — el
`contentModel` que declares DEBE estar ahí, lo exige el contrato):

| `contentModel` | Schema | Templates que lo usan |
|---|---|---|
| `qa`     | `items[{question, options[], answer, points, image, audio}]` | quiz, math |
| `pairs`  | `pairs[{left, right, leftImage?, rightImage?}]` | match, memory |
| `textCorrection` | `passages[{id, text, marks[{pos, kind}]}]` | tildes, comas |
| `words`  | sopa: `words['GATO', …]` · crucigrama: `words[{word, clue, row, col, dir}]` | wordsearch, crossword |
| `items`  | `items[{id, q, image?}]` | wheel, question-live |
| `ballsort` | `{level, mode, random, items[{id, board, mode}]}` | ballsort |
| `diagram`| `{image, pins[{id, label, x, y}]}` (x,y en 0..1) | diagram |
| `entries`| `entries[]` (huérfano: sin plantilla hoy; Wheel migró a `items`) | — |

## El contrato es EJECUTABLE

Tu plantilla nueva queda cubierta automáticamente al registrarse:
`node tests/templateContract.test.mjs` (y el panel `#/admin` → "Ejecutar tests",
grupo *Contrato*) verifican meta completa (`instructions` obligatorio),
`contentModel` registrado, `defaultContent` válido y jugable, scorer con forma
`{correct, points}`, `migrateContent` idempotente y `static previewHtml(act)`
(la miniatura de la tarjeta del home — reutiliza los builders del player o los
helpers de `core/previewKit.js`; NO hay switch central que tocar). Si eso pasa y
`tests/norms.test.mjs` + `tests/styles.test.mjs` están en verde (sin
`ResizeObserver` directo, filtros PB por `pbFilter.js`, CSS relativo +
tokens de skin → `docs/estilos-de-actividad.md`), la plantilla nace estándar.
