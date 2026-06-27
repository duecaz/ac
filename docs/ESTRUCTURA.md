# WW Actividades — Estructura del proyecto y de las actividades

> Documento de referencia para asistentes (ChatGPT/Claude). Describe cómo está
> organizado el proyecto y, sobre todo, el **esquema JSON de una actividad** y el
> **modelo de contenido de cada plantilla**, para poder generar o editar
> actividades correctamente. (Vanilla JS, ES modules, sin framework. Backend:
> PocketBase. `schemaVersion` actual: **4**.)

## 1. Estructura de carpetas

```
/                         raíz servida estáticamente (GitHub Pages, rama ACTIVIDAD2)
├── index.html            landing / selector
├── teacher.html          app del PROFESOR  → main.teacher.js
├── student.html          app del ALUMNO    → main.student.js
├── embed.html            actividad embebida → main.embed.js
├── pocketbase.config.js  URL del backend (PB_URL)
│
├── core/                 utilidades de dominio (sin DOM cuando es lógica)
│   ├── constants.js      VERSION + DEFAULT_RULES/SCORING/REVIEW/PRESENTATION/LIVE
│   ├── migrate.js        normalize() / newActivity() / migración de esquema
│   ├── registry.js       registro de plantillas (getTemplate, registerTemplate)
│   ├── auth.js           auth PocketBase (email/password)
│   ├── identity.js       id anónimo (ensureIdentity)
│   ├── results.js        guardado de resultados (cola offline)
│   ├── submitQueue.js    cola offline de respuestas en vivo
│   ├── offlineQueue.js   núcleo de cola reintentable (race-safe)
│   ├── clock.js          reloj inyectable (testeable)
│   ├── soloPlayer.js     SHELLS de players (runSequentialPlayer/runFreeformPlayer)
│   ├── soloTimer.js      temporizador único (createCountdown)
│   ├── textMarks.js / contentModels/  modelos de contenido (qa, pairs, textCorrection…)
│   └── …                 html, events, skins, presentation, streaks, sounds, effects…
│
├── adapters/             backends seleccionables
│   ├── index.js          backendName(): 'local' | 'pocketbase'
│   ├── local/            dev offline (en memoria / localStorage)
│   └── pocketbase/       producción (remoteStore, realtime SSE, assignments)
│
├── kernel/               "cerebro" puro, sin DOM ni red
│   ├── session/engine.js MÁQUINA DE ESTADOS única: solo | vs | teams | live
│   ├── live/engine.js    alias de session (format 'live')
│   ├── content/          conversión / modelos de contenido (qaAdapt, models…)
│   └── contracts/        interfaces: template, dataPort, realtimePort, contentModel
│
├── templates/            UNA carpeta por plantilla (11). Ver §3.
│   └── <tpl>/
│       ├── template.js   meta (contentModel, modes, defaults) + scorer/round
│       ├── editor.js     UI de edición
│       ├── player.js     UI de juego (solo/async/live-student)
│       └── index.js      registerTemplate(...)
│
├── views/                pantallas (home, edit, player, hostLive, studentLive,
│                         vsView, reports, explore, admin, assignments…)
├── styles/               CSS por plantilla + skins
├── themes/colegios/      skin "colegios" (cssVars, vsLayout)
└── docs/                 este documento
```

## 2. Esquema de una ACTIVIDAD (objeto JSON)

Toda actividad pasa por `normalize()` (core/migrate.js). Forma canónica
(`schemaVersion: 4`):

```jsonc
{
  "id": "act_xxxxxxxxxx",        // newActivityId()
  "title": "Título",
  "subtitle": "",
  "template": "quiz",            // nombre de plantilla (ver §3)
  "templateVersion": 1,
  "schemaVersion": 4,

  "content": { /* DEPENDE de la plantilla — ver §3 */ },

  "rules": {                     // DEFAULT_RULES
    "timer": 0,                  // segundos por ítem; 0 = sin temporizador
    "randomize": false,          // baraja el orden de los ítems
    "shuffleOptions": true,      // baraja opciones por ítem
    "templateOptions": {}        // ajustes específicos de plantilla
  },

  "scoring": {                   // DEFAULT_SCORING
    "mode": "flat",              // 'flat' | 'kahoot'
    "pointsPerCorrect": 1,
    "pointsPerWrong": 0,         // negativo = penaliza; nunca baja de 0
    "penaltyRatio": 0,
    "maxScore": 0                // 0 = pointsPerCorrect * nº ítems
  },

  "review": {                    // DEFAULT_REVIEW
    "allowOverride": true,
    "showCorrectAnswer": true,
    "autoAdvanceToSummary": false,
    "skipReview": false
  },

  "presentation": {              // DEFAULT_PRESENTATION
    "skin": "default",           // 'default' | 'space' | 'colegios' | …
    "background": "none",        // 'none' | 'notebook' | 'stars' | …
    "layout": "auto",
    "sound": true,
    "showTimer": true,
    "showScore": true,
    "teams": false
  },

  "live": {                      // DEFAULT_LIVE (modo en vivo tipo Kahoot)
    "enabled": true,
    "advanceMode": "manual",     // 'manual' | 'autoOnAllAnswered' | 'autoOnTimer'
    "questionTimer": 20,
    "lockAnswersOn": "allAnswered", // 'firstOf' | 'timer' | 'allAnswered'
    "showAnswerAfterEach": true,
    "showLeaderboardBetween": true,
    "pointsModel": "kahoot",     // 'kahoot' (bonus por velocidad) | 'flat'
    "speedBonusMax": 1000,
    "allowLateJoin": true,
    "maxPlayers": 60,
    "nicknameFilter": true,
    "streakBonus": false,
    "streakBonusPerStep": 50
  },

  "author":     { "id": null, "name": null, "signedAt": null },
  "visibility": "private",       // 'private' | 'public' (aparece en "Explorar")
  "forkOf":     null,
  "tags":       [],
  "language":   "es",
  "media":      {},
  "createdAt":  "ISO-8601",
  "updatedAt":  "ISO-8601"
}
```

## 3. Plantillas y su MODELO DE CONTENIDO (`content`)

11 plantillas. La clave es `template` (name). `contentModel` decide la forma de
`content`. `modes` indica dónde se puede jugar.

| template        | label          | contentModel    | clave en `content` |
|-----------------|----------------|-----------------|--------------------|
| `quiz`          | Quiz           | `qa`            | `items[]`          |
| `math`          | Operaciones    | `qa`            | `items[]`          |
| `froggy`        | Froggy Jumps   | `qa`            | `items[]`          |
| `memory`        | Memoria        | `pairs`         | `pairs[]`          |
| `match`         | Emparejar      | `pairs`         | `pairs[]`          |
| `wordsearch`    | Sopa de Letras | `words`         | `words[]` (strings)|
| `crossword`     | Crucigrama     | `words`         | `words[]` (objetos)|
| `tildes`        | Tildes         | `textCorrection`| `passages[]`       |
| `comas`         | Comas          | `textCorrection`| `passages[]`       |
| `wheel`         | Ruleta         | `items`         | `items[]`          |
| `question-live` | Abre Cajas     | `items`         | `items[]`          |

> `sessionItems(activity)` lee, en este orden:
> `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.

### qa — quiz / math / froggy
Pregunta con opciones (quiz/froggy) o respuesta abierta numérica (math).
```jsonc
// quiz / froggy
"content": { "items": [
  { "id": "q_ab12", "question": "¿Capital de España?", "answer": "Madrid",
    "options": ["Madrid","Barcelona","Lisboa","París"],
    "points": 1, "image": null, "audio": null }
]}
// math (teclado numérico; sin options)
"content": { "items": [
  { "id": "m1", "question": "2 × 6", "answer": "12", "points": 1 }
]}
```
- `answer` puede ser string o **array** (multi-correcta): `["rojo","colorado"]`.
- `answer: null` → ítem NO puntuable (no marca a nadie como incorrecto).
- Comparación de respuestas: sin distinguir mayúsculas ni tildes, con trim.

### pairs — memory / match
Parejas izquierda↔derecha.
```jsonc
"content": { "pairs": [
  { "id": "p_x1", "left": "España", "right": "Madrid" }
]}
```
- `match` admite imágenes: `leftImage`, `rightImage`, `image` (data-URL).

### words — wordsearch (strings) / crossword (objetos)
```jsonc
// wordsearch: lista de palabras a buscar
"content": { "words": ["GATO","PERRO","PÁJARO","RATÓN"] }

// crossword: palabra + pista + posición + dirección
"content": { "words": [
  { "id": "cw1", "word": "GATO", "clue": "Animal felino", "row": 0, "col": 0, "dir": "H" }
]}
```
- crossword `dir`: `'H'` (horizontal) | `'V'` (vertical). `row`/`col` base 0.

### textCorrection — tildes / comas
Un pasaje por ronda; `marks` es la clave de respuesta (posiciones).
```jsonc
"content": { "passages": [
  { "id": "ps_1", "text": "cancion popular", "marks": [/* posiciones */] }
]}
```
- `tildes`: el alumno toca las vocales que llevan tilde.
- `comas`: el alumno toca el hueco entre dos palabras donde falta la coma.
- `marks` se genera en el editor; no escribir a mano salvo que se conozca el formato.

### items — wheel / question-live
Lista simple de entradas (sin respuesta correcta: el profe valida verbalmente).
```jsonc
// wheel (ruleta que gira y cae en una entrada)
"content": { "items": [ { "q": "Opción 1", "image": null } ] }
// question-live "Abre Cajas"
"content": { "items": [ { "id": "i1", "q": "¿Capital de Francia?", "image": null } ] }
```

## 4. Modos de juego (`modes` de cada plantilla)
- **solo**: un dispositivo, autopuntuado localmente.
- **async** (Tarea): el alumno juega solo y se registra el intento (assignments).
- **practice**: práctica libre sin guardar.
- **live**: sala tipo Kahoot (profe hostea, alumnos en sus móviles; PIN/QR).
  - Fases: `lobby → question → reveal → leaderboard …`; variantes `race`
    (carrera libre) y `question-live` (Abre Cajas / Ruleta Live).
- **vs**: duelo 1v1 a pantalla compartida. Requiere que la plantilla exponga
  `scoreSubmission` + `renderRound` (`isVsCompatible`). En VS gana quien más
  acierta; si empatan a puntos, desempata quien terminó primero.

## 5. Reglas de imágenes/medios
- Imágenes **inline como data-URL** dentro del JSON de la actividad (límite ~200 KB
  por imagen). **No** se suben a almacenamiento externo.

## 6. Reglas para generar actividades (resumen para el asistente)
1. Elige `template` según el objetivo y usa SU `content` (tabla §3).
2. Da `id` único a cada ítem/pareja/palabra (string corto).
3. `title` claro; `language` `"es"` salvo indicación.
4. Para autopuntuables (quiz/math/froggy/match/wordsearch/crossword) incluye
   siempre `answer`/`right`/`word`+posición correctos.
5. wheel/question-live NO llevan respuesta correcta.
6. Deja `rules`/`scoring`/`live`/`presentation` por defecto salvo que se pida
   cambiarlos; `normalize()` rellena lo que falte.
7. No inventes campos fuera de este esquema.
