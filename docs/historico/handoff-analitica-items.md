# HANDOFF — Analítica por ítem/parte para el docente (plan de módulos, Etapa 2)

> 🗄️ **HISTÓRICO — EJECUTADO (F1-F3).** Se archivó en v1.51.424 al consolidar la
> documentación: la analítica por ítem vive en `core/itemStats.js` y `views/sessionTable.js`; su ley, en §21.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> Objetivo (usuario): que el docente vea **cuántas partes acertó cada alumno** y, sobre
> todo, **qué partes falla LA CLASE** ("el 50% falló en *jugó*") — en **tareas** y en
> **modo EN VIVO**, y para **todas las plantillas live** (ballsort, comas, math,
> question-live, quiz, tildes, wheel), no solo texto. Estado: **PLAN aprobado a diseño,
> pendiente de ejecutar por fases**. Etapa 1 (puntuar por aciertos en tildes/comas) ✅
> v1.51.238.

## ✅ HECHO: F1 (núcleo) · F2 (live) · F3 (tareas) · captura del PRIMER intento en carrera

**Modo carrera — captura de errores (v1.51.243):** en carrera el alumno reintenta hasta
acertar y el cliente solo enviaba la respuesta CORRECTA → el análisis salía siempre verde.
Fix (opción A, no cambia el juego): `submitRaceAttempt` guarda el PRIMER intento en
`live_answers.v0/c0` (inmutable) mientras `value/correct` siguen llevando el progreso; la
analítica prefiere `v0/c0` (answerRows.firstVal/firstCorrect). Requiere los campos
`v0`(json)/`c0`(bool) en `live_answers` (setup-pocketbase.ps1 + check-pb.sh los vigilan).
En un concurso no hace falta: el candado de primera respuesta ya guarda el primer intento.

## 0. Hechos del código que anclan el diseño (verificados)

| Fuente | ¿Guarda detalle por ítem HOY? | Forma |
|---|---|---|
| **Live** (PB `live_answers`) | ✅ SÍ — fila por alumno×ítem | `{session, player, item, value, ms, correct, points}` (raw value). `fetchAnswerRows()` ya dedupea. |
| **Live** (blob legado `state.answers`) | ✅ SÍ | `"${itemIndex}:${playerId}" → {playerId, value, msTaken, correct, points}` — `views/reports.js` ya lo parsea. |
| **Solo secuencial** (math/quiz/froggy) | ✅ en memoria | `runSequentialPlayer` acumula `state.answers[]` (se descarta al guardar). |
| **Tildes/Comas solo/tarea** | ✅ en memoria | `passageResults[]` (`got/want/hits/misses/over`) del runner (v1.51.238). |
| **Tareas** (`assignment_attempts`) | ❌ NO | `recordAttempt(id, actId, nick, score, max, timeUsed)` — solo agregados. |
| **Resultados solo** (`results`) | ❌ NO | agregados + `overrides`. |

**Consecuencia**: para LIVE la analítica es **solo LECTURA** (cero riesgo de captura); el
único cambio de esquema/captura es en **tareas** (y opcional en results).

## 1. Principio de diseño

**Guardar el `value` CRUDO por ítem; interpretar al PINTAR el informe** (vía contrato de
plantilla). Así el informe puede evolucionar sin re-recolectar datos, y una fila de live de
hoy ya sirve mañana. Nada de pre-agregar en la captura.

## 2. Módulos (sólidos, testeables en Node)

### M1 — Contrato de plantilla: descomposición analítica (nuevo, OPCIONAL)
Solo la plantilla sabe qué significa su `value`. Dos métodos estáticos nuevos:
```js
// Partes "respondibles" de un ítem (la unidad del heatmap):
static itemParts({ item, activity })
// tildes/comas → [{ key: pos, label: palabraQueContieneLaMarca, ok: true }]  (una por marca requerida)
// quiz         → [{ key: optIdx, label: textoOpción, ok: esLaCorrecta }]     (una por opción → distractores)
// math         → [{ key: 'ans', label: enunciado, ok: true }]

// Qué partes marcó/eligió UNA respuesta:
static valueParts({ value, item, activity })
// tildes/comas → posiciones marcadas · quiz → [opciónElegida] · math → [] o ['ans'] si acertó
```
**Fallback genérico** (plantilla sin estos métodos): 1 parte por ítem, `ok` del
`scoreSubmission().correct` → TODA plantilla live tiene %acierto por ítem gratis
(ballsort/wheel/question-live empiezan así; enriquecen después si aporta).

### M2 — `core/answerRows.js`: fuentes → forma normalizada (adaptador de lectura)
Aísla los 3 formatos de almacenamiento del resto del sistema:
```js
rowsFromLiveAnswers(rows)   // filas PB live_answers (dedupe: la MÁS RECIENTE por alumno×ítem — ver deuda F: ms~0 hace mal desempate)
rowsFromLiveState(state)    // blob legado state.answers
rowsFromAttempt(attempt)    // assignment_attempts.answers (F3)
rowsFromResult(result)      // results.answers (F4, opcional)
// → siempre: [{ player, itemIndex, value, correct, points, ms? }]
```

### M3 — `core/itemStats.js`: agregador PURO
```js
aggregate({ activity, template, rows }) →
{ nPlayers, items: [{ index, label, n, nCorrect, pct,
    parts: [{ key, label, ok, nMarked, pctMarked }],   // vía M1 (o fallback)
    extras: n }] }                                     // marcas fuera de toda parte ("de más")
```
Sin DOM, sin red → tests deterministas. Maneja: jugador repetido (última respuesta gana),
ítems sin respuestas, plantillas sin M1.

### M4 — Captura compacta: `core/answerDetail.js` + campo PB `answers`
Formato común del detalle de un intento: `answers: [{ i, v, c, p, ms? }]`.
- `packAnswers(list, { maxBytes: 100_000 })`: cap de tamaño — si excede, va soltando `v`
  (empezando por los ítems CORRECTOS: para el heatmap interesan los fallos) y deja `{i,c,p}`.
- **Esquema PB**: campo `answers` (json, maxSize 200KB) en `assignment_attempts` y
  (F4) `results`. Live NO cambia. Actualizar juntos: DEFS de `adminView.js` +
  `setup-pocketbase.ps1` + `check-pb.sh` + `docs/infraestructura-pb.md` (ley §17).
- **Cableado de captura**:
  - `views/studentTask.js`: `recordAttempt(..., answers)` — el shell secuencial ya expone
    `state.answers`; el runner de texto expone `passageResults` → mapear a `{i,v,c,p}`
    (v = posiciones marcadas). Freeform sin detalle → `answers` vacío (degrada).
  - `core/soloPlayer.js` (shells): pasar `state.answers` en `onFinish`/`trySaveResult` (F4).

### M5 — UI: `views/itemStatsView.js` + gancho rico por plantilla
- **Genérico** (toda plantilla): tabla/barras por ítem — "Ítem · respuestas · % acierto",
  expandible a partes (% que marcó cada parte, extras).
- **Gancho rico OPCIONAL**: `static renderItemStats(root, { item, stats, activity })`:
  - **texto (tildes/comas)**: HEATMAP sobre el pasaje real — cada posición requerida
    coloreada por % de acierto de la clase (reusa `passageHtml` con clase por tramo:
    verde ≥80 · ámbar 50-79 · rojo <50); las palabras con marcas "de más" frecuentes,
    subrayadas. *El caso "jugó en rojo".*
  - **quiz**: distribución por opción (barra por distractor).
- **Puntos de montaje** (3, misma vista):
  1. `views/hostLive.js` podio final → botón **"Análisis de la clase"** (lee live_answers/state ya en memoria).
  2. `views/reports.js` drill-down de sesión → pestaña "Por ítem".
  3. `views/assignments.js renderAttempts` → pestaña "Por ítem" (agrega TODOS los intentos de la tarea).

### M6 — Tests (por módulo, la ley "si es norma, es test")
- `tests/itemStats.test.mjs`: agregación (dedupe, extras, fallback sin M1, cap de pack).
- `tests/itemParts.test.mjs`: contrato M1 de las 7 plantillas live — si declara
  `itemParts`, debe declarar `valueParts` y sus keys deben ser consistentes con un value
  real de esa plantilla (usa `defaultContent()` como fixture).
- Ampliar `tests/templateContract.test.mjs`: M1 es opcional, pero si existe, se valida.

## 3. Fases de ejecución (cada una shippeable, commit+tests+main)

| Fase | Qué | Toca | Riesgo |
|---|---|---|---|
| **F1** | M1 (texto+quiz+fallback) + M2 (live) + M3 + M6 | core/ + templates/ (2) + tests | nulo (puro) |
| **F2** | M5 en LIVE: botón "Análisis" en podio de hostLive + pestaña en informe de sesión | hostLive.js, reports.js | bajo (solo lectura de datos que YA existen) |
| **F3** | M4 en TAREAS: campo PB `answers` + captura en studentTask + pestaña "Por ítem" en renderAttempts | PB (usuario corre setup), studentTask, assignments | medio (esquema) |
| **F4** | results solo con `answers` (informe por actividad) | results.js, shells | bajo |
| **F5** | M1 rico para ballsort/wheel/question-live donde aporte | 3 templates | bajo |

**Orden recomendado: F1 → F2 primero** (valor inmediato con CERO cambio de esquema ni de
captura — la primera sesión live que juegues ya se analiza), después F3 (tareas, que es el
flujo Classroom).

## 4. Decisiones ya tomadas (no re-litigar al ejecutar)
- Crudo-al-guardar / interpretar-al-pintar (§1). Nada de agregados persistidos.
- Dedupe live: **la más reciente** por alumno×ítem (no `ms` más bajo — deuda F).
- Privacidad: solo nicks (sin PII nueva); el detalle vive en colecciones existentes.
- Datos viejos sin `answers` → el informe degrada a agregados sin romper.
- Umbrales heatmap: verde ≥80% · ámbar 50-79% · rojo <50% (constantes en M5, no mágicos).
- El fallback genérico se queda PARA SIEMPRE: ninguna plantilla está obligada a M1.

## 5. Riesgos / cuidados
- `live_answers` con filas duplicadas y `ms≈0` (deuda F, `submitProgress` no atómico):
  M2 dedupea por "última"; NO arreglar la deuda F aquí (pase aparte), solo blindar lectura.
- Tamaño de `answers` en tareas con actividades largas → `packAnswers` cap (M4).
- Ballsort live usa tablero compartido/progreso (no submit clásico) → empieza con
  fallback; su parte rica (si algún día) es otra semántica (progreso, no partes).
- No añadir carga al hilo del host durante la partida: el análisis se calcula SOLO al
  abrirlo (post-podio), nunca en caliente.
