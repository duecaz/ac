# HANDOFF — Centralizar decisiones que hoy viven repartidas en vistas

> 🗄️ **HISTÓRICO — EJECUTADO en lo esencial.** Se archivó en v1.51.424 al consolidar la
> documentación: paneles del editor, questionLive, sessionTable y la tarjeta única ya tienen dueño; lo que quede se pide como deuda concreta, no como plan.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> Origen: pase de limpieza tras el sistema de puntuación (v1.51.270, 4 agentes de
> revisión). El ESPÍRITU es el mismo que `core/scoring/`: la decisión vive en la
> PLANTILLA o en UN módulo core; las vistas solo la consumen. Cada ítem indica
> dónde está duplicado hoy y dónde debería vivir. Ninguno es urgente; son pases
> cortos e independientes, ideales para sesiones sueltas.

## Ya hecho en v1.51.278 (segundo pase)
- **#2 Payload de ronda** → `roundPayloadOf(T, activity, itemIndex, fallback)`
  exportado del kernel; 5 sitios en vistas + 2 internos del kernel colapsados. El
  try/catch degrada IGUAL en todos (antes host tenía guarda y el alumno no).
- **#4 Ventana de pregunta** → `questionWindowMs(activity)` en `core/timings.js`;
  usado por deadline del host, barra del alumno y bonus Kahoot (`award.js`) — que
  OMITÍA el piso de 5s: ya no puede mentir el bonus con timers < 5s.

## Ya hecho en el pase v1.51.270 (referencia del patrón)
- `flush` en el contrato de `renderRound` (rescate del trazo SIN querySelector a
  clases internas) — `core/textCorrectionRound.js` lo devuelve, studentLive lo usa.
- `dedupeByPlayer` + `hydrateAnswerRow` únicos en el adaptador PB (criterio de
  desempate y anti-doble-conteo en UN sitio).
- `engine.settleAll({keepPhase})` en el kernel (barrido de cierre, ambos drivers).
- `canAutoScoreRound` también en `core/editorModes.js` (era el 4º sitio con
  criterio propio — mostraba "Automática" en Equipos para plantillas sin renderRound).
- `basePoints(null, scoring)` como única casa del default de ppc (marks, wordsearch).

## Pendientes, por valor

### 1. Clasificación fase→pantalla (juego/chrome) por ROL — `core/livePhases.js`
- **Duplicado**: los `paint()` de `views/hostLive.js` y `views/studentLive.js`
  esparcen `scene(true/false)` rama a rama; host trata `leaderboard` como juego y
  el alumno como chrome (intencional, pero nada lo registra). El router del
  alumno además es un hermano a mano del `hostPaintDecision` ya extraído/testeado.
- **Casa**: `screenKind(session, role) → 'game'|'chrome'` + `studentPaintDecision`
  en `core/livePhases.js` (ya es el dueño puro y testeado de las fases). `paint()`
  queda en `scene(screenKind(...) === 'game')` una vez.

### 2. ✅ HECHO (v1.51.278) Payload de ronda — `roundPayloadOf` en el kernel
Exportado; 5 sitios de vistas + 2 internos colapsados; try/catch uniforme. (Queda
el caso VS con params extra `side`/`found` en engine.js — distinto, no se tocó.)

### 3. Etiquetas de ítem — un helper
- **Duplicado**: `try { T.itemLabel?.(it) || \`Pregunta ${i+1}\` } catch {...}`
  en `views/hostLive.js` y `views/assignments.js`; el literal `Pregunta N` suelto
  en teamsView/studentLive/hostLive.
- **Casa**: `itemLabels(T, items)` junto a `sessionItems` o en `core/itemStats.js`
  (es el input `labels` que sessionTable ya consume).

### 4. ✅ HECHO (v1.51.278) Ventana de pregunta — `questionWindowMs` en timings.js
Un solo default (piso 5s incluido); host + alumno + bonus Kahoot lo comparten.

### 5. Identidad de plantilla por META, no por string
- **Duplicado**: `template === 'wheel'` / `=== 'question-live'` en hostLive:180,
  :666 y studentLive:203; `template === 'tildes' || 'comas'` en startScreen:45,
  reports:187; `kind = template === 'comas' ? 'coma' : 'tilde'` en itemStatsView.
- **Casa**: meta — `meta.teacherScored: true` (wheel/question-live; la semántica
  ya existe: su scorer devuelve `total:0`), `meta.selector: 'wheel'` en Wheel,
  `meta.contentModel === 'textCorrection'` en vez de nombres, y `meta.markKind`
  ('tilde'/'coma') para el heatmap. Patrón bueno ya en el repo: `meta.liveBoard`.

### 6. Prompt/respuesta de un ítem — al contrato
- **Duplicado**: `promptOf/answerOf` en `views/teamsView.js:197-208` (sabe de
  `left` y reconstruye la respuesta de textCorrection con applyMarks) vs
  `templates/base.js:52` (cadena de campos SIN `left` ni marcas) vs el baile
  `question ?? q` en studentLive:181 / wheel / question-live.
- **Casa**: contrato — `itemPrompt(item)` / `itemAnswerText(item)` con default en
  BaseTemplate; las vistas dejan de adivinar campos por modelo de contenido.

### 7. Mérito persistido en la fila (mata `cellScore` del todo)
- **Hoy**: la tabla re-puntúa el `value` con el scorer para el mérito multi-parte
  (binarias usan el veredicto guardado). Si se edita el contenido tras la sesión,
  el mérito se recalcula contra la clave NUEVA.
- **Casa**: guardar `hits/over/total` en `live_answers` al settle (el motor ya
  corre el scorer autoritativamente; es UN campo más en el PATCH). Entonces
  `cellScore` desaparece — la promesa original de P4.

### 8. Carrera del alumno (re-score local + política de recola) — va con la deuda A
- `views/studentLive.js` puntúa en cliente y decide la recola de fallos; es el
  único modo fuera del paraguas kernel. NO arreglar a medias en la vista: va
  junto al rediseño lost-update (deuda A de CLAUDE.md).

## Descartes conscientes del pase (no hacer sin motivo nuevo)
- Chunking de los PATCH de settlePending (≤~30 filas reales por sala; el probe ya
  evita el caso común).
- Precomputar el set normalizado de wordsearch (listas de ~12 palabras, micro).
- `attempts` configurable en pbFetch: el coalesce de `refreshSession` en
  studentLive ya corta el apilamiento de reintentos; añadir knobs es complejidad.
