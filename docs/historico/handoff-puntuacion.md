# HANDOFF — Puntuación: dónde vive la decisión de puntos de CADA actividad

> 🗄️ **HISTÓRICO — EJECUTADO.** Se archivó en v1.51.424 al consolidar la
> documentación: el mapa de puntuación se cerró: un solo scorer por plantilla, vigilado por `tests/scoringSources.test.mjs`.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> Estado: **P1–P5 EJECUTADAS (v1.51.268–269)** — `core/scoring/` existe, los 11
> scorers devuelven mérito `{hits, total}`, el contrato lo exige
> (`tests/templateContract.test.mjs` + generador `tools/new-template.mjs`), la
> tabla lee el mérito del scorer único, y las escalas quedaron unificadas (P5,
> autorizada por el usuario en modo debug — los datos previos no importaban).
> El mapa §1 refleja el estado PREVIO a la limpieza (histórico).

## 1. Dónde vive hoy la decisión (mapa real, 13 plantillas)

| # | Módulo que decide los puntos | Plantillas | Escala típica de un acierto |
|---|---|---|---|
| 1 | `core/scoreHelpers.js` (`basePoints`/`wrongPoints`/`usaBonusVelocidad`) | quiz, globos (reusa el scorer de quiz), math, match, diagram | 1 · con un concurso ~500–1500 |
| 2 | `core/textMarks.js` → `scoreMarksPerHit` | tildes, comas | 1 por marca buena |
| 3 | `templates/wordsearch/scorer.js` (propio) | wordsearch | 10–25 (ppc **default 10**) |
| 4 | `templates/ballsort/scorer.js` (propio) | ballsort | 0–1000 |
| 5 | `templates/crossword/template.js` (en línea) | crossword | palabras × ppc |
| 6 | — (stub `{correct:false, points:0}`) | wheel, question-live | los pone el PROFE a mano (`ql_points`) |
| 7 | — (sin `scoreSubmission`) | memory | el player calcula su marcador |

**Solo 5 de 13 pasan por `core/scoreHelpers.js`.** Las demás deciden por su cuenta.

## 2. Qué problemas causa (verificados, no teóricos)

- **A. `correct` significa cosas distintas.** En quiz = "acertó"; en tildes = "ganó
  algún punto" (parcial). Por eso `views/sessionTable.js` necesita `cellScore()` con
  una rama por partes y un *fallback* binario. Origen directo de los bugs "la tabla
  dice 3/4 en vez de 3/8" y "0 pts aunque tenga aciertos".
- **B. Escalas incomparables.** 1 pt/tilde · ~1500 pt/quiz-un concurso · 1000 ballsort ·
  10–25 wordsearch. Un informe que mezcle actividades no significa nada, y el podio
  de una no se puede leer con la vara de otra.
- **C. `pointsPerCorrect` con defaults distintos**: 1 en todas menos **10** en
  wordsearch. El mismo campo del editor no significa lo mismo según la actividad.
- **D. un concurso implementado DOS veces**: `scoreHelpers.usaBonusVelocidad` (oficial, quiz) y
  una fórmula propia dentro de wordsearch. Dos bonus de velocidad distintos.
- **E. `maxScore` lo calcula cada runner** por su cuenta → no hay % fiable común.
- **F. Analítica por partes solo en 3 de 13** (`itemParts`: quiz, tildes, comas).

## 3. La idea: separar MÉRITO de PUNTOS

Hoy un solo número (`points`) responde a dos preguntas que no son la misma:

| Pregunta | Naturaleza | Quién debe decidir |
|---|---|---|
| **¿Cuánto acertó?** (mérito) | objetivo, comparable, sin espectáculo | la PLANTILLA (sabe qué es "una parte") |
| **¿Cuántos puntos?** (ranking) | configurable, con velocidad/bonus | un módulo COMÚN (una sola fórmula) |

Contrato propuesto para `scoreSubmission` (superset del actual → compatible):

```js
scoreSubmission({ value, item, msTaken, activity, mode }) → {
  hits, total,       // MÉRITO (obligatorio). Binarias: 1/1 ó 0/1. Tildes: 3/8.
  correct,           // veredicto para UI (✓/✗). null = ítem no puntuable
  points,            // ranking, escala ÚNICA (lo calcula el helper común)
  over?, perfect?,   // calidad: marcas de más / sin fallos
}
```

Con `hits/total` **obligatorio**, toda vista (tabla, heatmap, podio, CSV, informes
de tarea) funciona igual para las 13 plantillas, sin ramas por plantilla.

## 4. Estructura de módulos propuesta

```
core/scoring/
  contract.js   — forma del resultado + normalize(): rellena correct/points a
                  partir de hits/total si el scorer no los da
  award.js      — awardPoints({hits,total,msTaken,activity,mode}) → ÚNICA fórmula
                  de puntos (flat | velocidad con bonus de velocidad).
                  Absorbe basePoints/wrongPoints/usaBonusVelocidad de scoreHelpers.js
  marks.js      — scoreMarksPerHit (se MUEVE desde core/textMarks.js, que debe
                  ser texto y marcas, no puntuación)
  index.js      — re-exporta (punto único de importación)
```

Reglas de reparto (la "guía" pedida):

- **La PLANTILLA decide el mérito** (`hits`/`total`) y nada más. Es lo único que
  solo ella sabe.
- **`core/scoring/award.js` decide los puntos**, igual para todas. Ninguna plantilla
  vuelve a escribir una fórmula de velocidad ni un default de `pointsPerCorrect`.
- **Los PARÁMETROS viven en la actividad** (`activity.scoring`), no en el código.
- **Ningún modo (Solo/Tarea/VS/Equipos/Live/futuros) reimplementa el conteo**: todos
  llaman a `T.scoreSubmission`. (Ley ya vigente, ver `docs/leyes.md`.)

Ganancias concretas: `cellScore()` de `views/sessionTable.js` **desaparece** (la
tabla lee `hits/total` ya calculados); ranking y podio en una escala; un modo nuevo
hereda mérito+puntos coherentes sin tocar nada.

## 5. Plan por fases (riesgo creciente; las 4 primeras NO cambian puntajes)

| Fase | Qué | Riesgo | Estado |
|---|---|---|---|
| **P1** | Crear `core/scoring/`, mover `scoreHelpers` + `scoreMarksPerHit`, re-exportar desde las rutas viejas | nulo (solo mueve) | ✅ v1.51.268 |
| **P2** | Añadir `hits/total` a los scorers que no lo daban. Binarias: `1/1` ó `0/1`; wheel/question-live `total:0` (puntúa el profe). Quiz además usa `awardPoints` (misma fórmula, un solo sitio) | bajo | ✅ v1.51.268 |
| **P3** | Contrato exige el mérito (`core/templateContract.js` + self-test + generador `new-template.mjs`) | bajo | ✅ v1.51.268 |
| **P4** | `cellScore` de sessionTable lee el mérito del SCORER (multi-parte); en binarias sigue mandando el veredicto guardado del settle (autoritativo, sin re-scoring). `itemParts` queda SOLO para el heatmap por parte (itemStats), que sí necesita el desglose | bajo | ✅ v1.51.268 |
| **P5** | **Unificar escalas** (cambió puntajes; autorizado en modo debug): **wordsearch** ppc default 10→1, fuera el un concurso propio y el bonus de longitud, y el player SOLO llama al scorer (tenía copia en línea); **math** paga en vivo con el mismo bonus por velocidad que quiz (antes 1 plano vs ~1500); **ballsort** mérito fraccional `hits/100` (% ordenado) y conserva su escala 0–1000 A PROPÓSITO (codifica eficiencia y nunca comparte sesión con otra plantilla, ver §6) | **cambia puntajes** | ✅ v1.51.269 |

**P5 cambia los números que ven los alumnos** en Sopa de Letras y Ordena las Pelotas.
No se ejecuta sin el OK explícito del usuario; P1–P4 son invisibles para él.

## 6. Decisiones tomadas y restantes

- **ballsort conserva su escala 0–1000** (decisión P5): sus puntos codifican la
  EFICIENCIA (menos movimientos/tiempo = más), que la escala plana no expresa, y
  un tablero en vivo nunca comparte sesión con otra plantilla → no hay informes
  mezclados que descuadrar. Su MÉRITO sí es estándar: `hits/100` (% ordenado).
- **wheel / question-live** puntúan a mano (el profe asigna). Mérito no automático:
  `total: 0` y `points` del docente. No es deuda.
- **memory** no tiene `scoreSubmission` → hoy solo Solo/Tarea. Si algún día va a
  VS/Equipos/Live, necesita uno (nacerá conforme: el contrato lo exige).
- **`maxScore` unificado** (problema E): los runners aún lo calculan cada uno;
  con el mérito en pie, el siguiente paso natural es `maxScore = Σ total` — pase
  corto pendiente.
