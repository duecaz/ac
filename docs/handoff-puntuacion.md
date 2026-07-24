# HANDOFF — Puntuación: dónde vive la decisión de puntos de CADA actividad

> Estado: **mapa verificado en código + plan por fases**. No ejecutado (salvo la
> unificación de Tildes/Comas, ya en producción desde v1.51.265). Escrito tras la
> caza de bugs "0 pts con aciertos" / "3/8 vs ✓/✗", que fueron SÍNTOMAS de lo que
> este documento describe.

## 1. Dónde vive hoy la decisión (mapa real, 13 plantillas)

| # | Módulo que decide los puntos | Plantillas | Escala típica de un acierto |
|---|---|---|---|
| 1 | `core/scoreHelpers.js` (`basePoints`/`wrongPoints`/`useKahoot`) | quiz, globos (reusa el scorer de quiz), math, match, diagram | 1 · con Kahoot ~500–1500 |
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
- **B. Escalas incomparables.** 1 pt/tilde · ~1500 pt/quiz-Kahoot · 1000 ballsort ·
  10–25 wordsearch. Un informe que mezcle actividades no significa nada, y el podio
  de una no se puede leer con la vara de otra.
- **C. `pointsPerCorrect` con defaults distintos**: 1 en todas menos **10** en
  wordsearch. El mismo campo del editor no significa lo mismo según la actividad.
- **D. Kahoot implementado DOS veces**: `scoreHelpers.useKahoot` (oficial, quiz) y
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
                  de puntos (flat | kahoot con bonus de velocidad).
                  Absorbe basePoints/wrongPoints/useKahoot de scoreHelpers.js
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

| Fase | Qué | Riesgo | Verificación |
|---|---|---|---|
| **P1** | Crear `core/scoring/`, mover `scoreHelpers` + `scoreMarksPerHit`, re-exportar desde las rutas viejas | nulo (solo mueve) | suite verde sin tocar plantillas |
| **P2** | Añadir `hits/total` a los scorers que no lo dan (quiz, math, match, diagram, wordsearch, ballsort, crossword). Binarias: `1/1` ó `0/1` | bajo (campo nuevo, nadie lo lee aún) | test de contrato: todo `scoreSubmission` devuelve `hits/total` |
| **P3** | `normalize()` + exigirlo en `tests/templateContract.test.mjs` | bajo | una plantilla nueva nace cumpliendo |
| **P4** | `sessionTable`/`itemStats` leen `hits/total`; se borra `cellScore` | bajo | tablas idénticas antes/después |
| **P5** | **Unificar escalas**: wordsearch ppc 10→1 y su Kahoot propio → `awardPoints`; ballsort a la escala común | **cambia puntajes** | requiere decisión del usuario |

**P5 cambia los números que ven los alumnos** en Sopa de Letras y Ordena las Pelotas.
No se ejecuta sin el OK explícito del usuario; P1–P4 son invisibles para él.

## 6. Fuera de alcance (decisiones abiertas)

- **wheel / question-live** puntúan a mano (el profe asigna). Encajan como
  "mérito no automático": `hits/total = null` y `points` del docente. No es deuda.
- **memory** no tiene `scoreSubmission` → hoy solo Solo/Tarea. Si algún día va a
  VS/Equipos/Live, necesita uno (P2 sería el momento).
- **`maxScore` unificado** (problema E) se resuelve solo en P4: `maxScore` = suma de
  `total` de todos los ítems.
