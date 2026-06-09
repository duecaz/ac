# Auditoría del camino SOLO (Wordwall) — solo lectura

> Revisión de los 6 `templates/*/player.js` y su lógica compartida, de simple a
> complejo. **No se modificó código.** Severidad: 🔴 alta · 🟠 media · 🟡 baja.

## Estado (actualizado 2026-06-09) — TODOS los bugs listados resueltos
- **Bug 1 (ruleta)** ✅ resuelto por reescritura: `wheel/player.js` captura
  `const winner = entries[target]` ANTES de mutar y pinta ese valor.
- **Bug 2 (quiz kahoot maxScore)** ✅ resuelto: `quiz/player.js maxScore()` calcula
  el techo real en modo kahoot (`base*500 + speedBonus` por ítem puntuable).
- **Bug 3 (tildes/comas inacabable)** ✅ resuelto por reescritura a la mecánica
  táctil compartida (`core/textCorrectionRound.js`): el botón **Listo** existe
  siempre, así que una frase sin marcas es completable.
- **Bug 4 (quiz resaltado de respuesta múltiple)** ✅ resuelto: resalta cada
  opción correcta tratando `item.answer` como valor o array.
- **Bug 5 (etiquetas ruleta a 16 chars)** 🟡 cosmético, sin cambios.
- **Estructural:** `shuffle` unificado en `core/roundRender.js` (lo importan quiz/
  match/memory); `core/textMarks.js` ya tiene tests (`tests/textMarks.test.mjs`).

> Lo de abajo es la auditoría original (lectura), conservada como histórico.

## Bugs reales

### 🔴 1. Ruleta: muestra el ganador equivocado con "quitar tras girar"
`templates/wheel/player.js:72-76`. Tras caer, hace `history.push(entries[target])`
(correcto) y luego, si `removeAfterSpin`, **muta** `entries` quitando el índice; después
`paint(rotation%360, target, …)` y la línea `:44` muestra `entries[landedIdx]` —pero
`entries` ya cambió—, así que el cartel del ganador muestra **otra entrada o `undefined`**.
Además la rueda se repinta con menos sectores sin recalcular la rotación → el puntero
señala un sector distinto al anunciado. Solo ocurre con `removeAfterSpin` activo.

### 🟠 2. Quiz en modo Kahoot: "puntos / máximo" sin sentido
`templates/quiz/player.js:18-21` y `:83`. `maxScore()` usa `pointsPerCorrect*nItems`
(p. ej. 5), pero en modo kahoot los puntos reales son miles → se muestra
"Puntos: 7000 / 5". El cálculo del máximo no contempla el modelo de velocidad.

### 🟠 3. Tildes/Comas: una frase sin marcas deja la actividad atascada
`templates/tildes/player.js:37,53-57` y `templates/comas/player.js:37,53-57`.
Con `allowOverflow` (valor por defecto) y `totalExpected=0`,
`paletteCount = max(missing,1) = 1`: aparece **una ficha suelta y ningún botón
"Terminar"**, y el auto-finish (`correct>=totalExpected`) no se dispara desde un drop
porque no hay posiciones esperadas. Un docente que escriba una frase sin tildes crea
una actividad **inacabable**.

### 🟡 4. Quiz: las respuestas múltiples (answer en array) no resaltan la correcta
`templates/quiz/player.js:58-61`. Al fallar compara `b.dataset.value === String(item.answer)`;
si `item.answer` es un array, nunca coincide → no resalta ninguna opción como correcta.
(El acierto sí funciona porque `isCorrect` ya soporta arrays.)

### 🟡 5. Ruleta: etiquetas recortadas a 16 caracteres sin aviso
`templates/wheel/player.js:30` (`String(e).slice(0,16)`), sin elipsis.

## Riesgos de datos / borde
- **Memory/Match**: `pointsPerWrong` negativo resta sin piso → el marcador puede quedar
  negativo (`memory/player.js:79`, `match/player.js:69`). Cosmético.
- **Tildes**: si una marca esperada cae sobre un carácter no-vocal (datos importados a
  mano), esa posición nunca es zona de drop → inganable. El editor lo evita
  (`parseAccentedText`), pero una importación cruda no.
- **Match**: textos idénticos en pares distintos confunden (solo cuenta el `id` exacto).

## Hallazgo estructural (lo más importante)
La causa raíz de "no se puede testear": **la lógica de acierto y puntuación está
incrustada en el DOM** en match, memory, wheel, tildes y comas. Solo **quiz** la tiene
en un módulo puro (`templates/quiz/scorer.js`, ya cubierto por tests).

Consecuencias concretas:
- `shuffle` está **duplicado** en quiz, memory y match (+ inline en wheel).
- El gating de `saveResult` (`opts.mode !== 'async-tracked'`) se repite en cada `finish()`.
- **Módulos puros críticos sin tests**: `core/textMarks.js` —genera la **clave de
  respuestas** de tildes/comas (`parseAccentedText`, `parseTextWithCommas`,
  `parseRichText`, `applyMarks`, `stripAccents`)— es la **prioridad #1** para blindar
  con tests. (Bien: el indexado editor↔player es consistente, no hay bug ahí.)

## Recomendación de orden (cuando pasemos a arreglar/extraer)
1. **Tests de `core/textMarks.js`** (clave de respuestas tildes/comas) — sin tocar UI.
2. **Wheel**: arreglar bug 🔴 1 + extraer `pickWinner/removeEntry` a módulo puro.
3. **Memory** y **Match**: extraer detección de pareja + scoring a `logic.js` testeable.
4. **Quiz**: arreglar bugs 2 y 4 (maxScore kahoot + resaltado de array).
5. **Tildes/Comas**: arreglar bug 🔴 3 (botón Terminar cuando no hay marcas esperadas).
6. Util común: un único `shuffle` en `core/` y un helper `finishResult()` compartido.
