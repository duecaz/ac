# WW Actividades — Estructura del proyecto y de las actividades

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Documento de referencia para asistentes (ChatGPT/Claude). Describe cómo está
> organizado el proyecto y, sobre todo, el **esquema JSON de una actividad** y el
> **modelo de contenido de cada plantilla**, para poder generar o editar
> actividades correctamente. (Vanilla JS, ES modules, sin framework. Backend:
> PocketBase. `schemaVersion` actual: **4**.)

## 1. Estructura de carpetas

```
/                         raíz servida estáticamente (GitHub Pages, rama `main`)
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
│   └── contracts/        interfaces: template, dataPort, contentModel
│
├── templates/            UNA carpeta por plantilla. Ver §3.
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
    "mode": "flat",              // 'flat' | 'velocidad'
    "pointsPerCorrect": 1,
    "pointsPerWrong": 0,         // negativo = penaliza; nunca baja de 0
    "maxScore": 0                // 0 = pointsPerCorrect * nº ítems
  },

  "review": {                    // DEFAULT_REVIEW
    "allowOverride": true
  },

  "presentation": {              // DEFAULT_PRESENTATION
    "skin": "default",           // 'default' | 'space' | 'colegios' | …
    "background": "none",        // 'none' | 'greenboard' | 'corkboard' | … (ver core/backgrounds.js)
    "sound": true,
    "teams": false
  },

  "live": {                      // DEFAULT_LIVE (modo en vivo tipo un concurso)
    "enabled": true,
    "advanceMode": "manual",     // 'manual' | 'autoOnAllAnswered' | 'autoOnTimer'
    "questionTimer": 20,
    "lockAnswersOn": "allAnswered", // 'firstOf' | 'timer' | 'allAnswered'
    "showAnswerAfterEach": true,
    "showLeaderboardBetween": true,
    "pointsModel": "velocidad",     // 'velocidad' (bonus por velocidad) | 'flat'
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

La clave es `template` (name). `contentModel` decide la forma de `content`;
`modes` indica dónde se puede jugar. **La tabla es GENERADA** del registro real
(`node tools/docgen.mjs`): antes se mantenía a mano y llegó a decir «12
plantillas» con varias sin listar.

<!-- GENERADO:catalogo -->
| `template` | label | Familia | `contentModel` | clave(s) en `content` |
|---|---|---|---|---|
| `quiz` | Quiz | E | `qa` | `items` |
| `wheel` | Ruleta | E | `items` | `items` |
| `match` | Emparejar | E | `pairs` | `pairs` |
| `memory` | Memoria | E | `pairs` | `pairs` |
| `tildes` | Tildes | E | `textCorrection` | `passages` |
| `comas` | Comas | E | `textCorrection` | `passages` |
| `math` | Operaciones | E | `qa` | `items` |
| `wordsearch` | Sopa de Letras | E | `words` | `words` |
| `question-live` | Abre Cajas | E | `items` | `items` |
| `ballsort` | Ordena las Pelotas | J | `ballsort` | `level` · `mode` · `random` · `items` |
| `diagram` | Etiqueta el diagrama | E | `diagram` | `image` · `pins` |
| `globos` | Explota Globos | E | `qa` | `items` |
| `colorear` | Colorear | J | `colorear` | `items` |
| `tangram` | Tangram | J | `tangram` | `items` |
| `puzzle` | Rompecabezas | J | `puzzle` | `items` |

> 15 plantillas · 11 ejercicios · 4 juegos. **E** = el contenido lo pone el docente · **J** = lo trae la plantilla (norte §4c).
<!-- /GENERADO:catalogo -->

> (Froggy Jumps fue **eliminado**; su animación de progreso vive ahora en
> `core/soloAnimations.js` como carril opcional del modo Individual.)

> `sessionItems(activity)` lee, en este orden:
> `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.

### qa — quiz / math
Pregunta con opciones (quiz) o respuesta abierta numérica (math).
```jsonc
// quiz
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

### words — wordsearch
```jsonc
// wordsearch: lista de palabras a buscar
"content": { "words": ["GATO","PERRO","PÁJARO","RATÓN"] }
```
- Son CADENAS sueltas: la rejilla la coloca la propia Sopa al generar.

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

### ballsort — Ordena las Pelotas (tablero único)
UN tablero compartido por ronda (por eso `meta.liveBoard: true` — en VS/Live
ambos lados resuelven el MISMO tablero y gana quien termina antes).
```jsonc
"content": {
  "level": "classic", "mode": "moves", "random": true,
  "items": [ { "id": "bs1", "mode": "moves",
    "board": { "tubeCapacity": 7, "colors": ["red","blue",…], "tubes": [["red","blue"],…] } } ]
}
```
- `random: true` → el editor regenera el tablero con `randomBoard(level)`.
- `mode`: `'moves'` (menos movimientos) | `'time'` (más rápido).

### diagram — Etiqueta el diagrama (imagen + pines)
Una imagen de fondo y PINES a coordenadas sobre ella; el alumno arrastra cada
etiqueta a su pin (estilo Wordwall). `x`/`y` son fracciones 0..1 de la imagen.
```jsonc
"content": {
  "image": "data:image/…",                        // imagen de fondo (data-URL, ≤200 KB)
  "pins": [ { "id": "pin_a", "label": "Cabeza", "x": 0.5, "y": 0.11 } ]
}
```
- Acierto = etiqueta enlazada a SU pin (mismo `id`). El editor coloca pines con clic.

## 4. Modos de juego (`modes` de cada plantilla)
- **solo**: un dispositivo, autopuntuado localmente.
- **async** (Tarea): el alumno juega solo y se registra el intento (assignments).
- **live**: sala tipo un concurso (profe hostea, alumnos en sus móviles; PIN/QR).
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
4. Para autopuntuables (quiz/math/froggy/match/wordsearch) incluye
   siempre `answer`/`right`/las palabras correctas.
5. wheel/question-live NO llevan respuesta correcta.
6. Deja `rules`/`scoring`/`live`/`presentation` por defecto salvo que se pida
   cambiarlos; `normalize()` rellena lo que falte.
7. No inventes campos fuera de este esquema.
