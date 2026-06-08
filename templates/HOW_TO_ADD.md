# Cómo añadir una plantilla nueva

Cada plantilla vive en su carpeta `templates/<name>/` y es **autocontenida**: clase, player, editor, scorer (si aplica). Para añadirla, no se toca el core.

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
    contentModel: 'qa',           // 'qa' | 'pairs' | 'groups' | 'words' | 'entries' | 'diagram'
    templateVersion: 1,
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

## 3. `index.js` — registro

```js
import { registerTemplate } from '../../core/registry.js';
import { MyTemplate } from './template.js';
registerTemplate(MyTemplate);
export { MyTemplate };
```

## 4. Importa desde los mains

En `main.teacher.js` **y** `main.student.js`:

```js
import './templates/miplantilla/index.js';
```

(En `main.student.js` solo si la plantilla soporta `solo`/`async`; si solo es `live`, basta con teacher.)

## 5. (Si soporta LIVE) — añade scorer en la Edge Function

En `supabase/functions/settle-item/_scorers/miplantilla.ts`:

```ts
export function scoreOne(activity, item, ans) {
  return { correct: true|false|null, points: 0 };
}
```

Y en `index.ts` del Edge Function:

```ts
import { scoreOne as miScore } from "./_scorers/miplantilla.ts";
const SCORERS = { quiz: quizScoreOne, miplantilla: miScore };
```

Redeploya con:
```
mcp deploy_edge_function settle-item
```

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

| `contentModel` | Schema | Templates típicos |
|---|---|---|
| `qa`     | `items[{question, options[], answer, points, image, audio}]` | quiz, true/false, type-the-answer |
| `pairs`  | `pairs[{left, right, leftImage?, rightImage?}]` | match, memory, flip-tiles |
| `groups` | `groups[{label, members[{text,image}]}]` | group sort, categorize |
| `words`  | `words[{word, clue?, image?}]` | hangman, crossword, word search, anagram |
| `entries`| `entries[]` | wheel, flashcards, random cards |
| `diagram`| `image, labels[{x,y,text}]` | labelled diagram |
