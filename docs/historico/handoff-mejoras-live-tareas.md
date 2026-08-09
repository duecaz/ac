# HANDOFF — Propuestas: informe LIVE estilo Kahoot + mejoras de TAREAS

> 🗄️ **HISTÓRICO — EJECUTADO (A1·A2·B1·B2).** Se archivó en v1.51.424 al consolidar la
> documentación: informe con pestañas, ranking, tabla de intentos y ficha por alumno están en `views/sessionTable.js` y `views/assignments.js`.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> Pedido del usuario (2026-07-23): "desde la visualización no es como la tabla que le
> aparece en Kahoot; dame propuestas para mejorar tareas y live". Estado: **PROPUESTAS**
> (elegir paquete y ejecutar). Base ya construida hoy: analítica por ítem/palabra
> (`handoff-analitica-items.md` F1-F3 + v0/c0 carrera + nombres por veredicto).

## Qué EXISTE ya (no re-proponer)
- **Podio live**: top-3 + botón "Análisis de la clase" (heatmap/partes + quién acertó/falló).
- **Informe de sesión** (`#/reports/session/:id`): TABLA jugador×pregunta con ✓/✗/puntos
  por celda, % por columna, promedio, mejor, **CSV**. ← la "tabla Kahoot" YA existe aquí,
  pero está escondida en Reportes y con estilo Bootstrap plano.
- **Kahoot reveal**: distribución por opción tras cada pregunta (quiz renderRoundHost).
- **Tareas**: lista de intentos plana + "Análisis de la clase" agregado.
- Gate de tarea (cerrada/vencida/intentos) ya testeado en `core/assignmentRules.js`.

## A. LIVE — el final de partida como Kahoot (lo que más se nota)

### A1 ⭐ Informe post-partida unificado en el PODIO (M)
El problema real: al terminar, el profe ve el podio "pelado" y la tabla buena vive en
otra página. Propuesta: pantalla final con PESTAÑAS, sin salir del live:
- **🏆 Podio** (como hoy, + ranking completo debajo del top-3 — hoy solo salen 3).
- **📋 Tabla** — la matriz jugador×pregunta del informe de sesión (celdas ✓ verde / ✗
  roja / — gris, % por pregunta en la cabecera, total por alumno), REUTILIZADA: extraer
  la tabla de `views/reports.js` a un módulo compartido (`views/sessionTable.js`) y
  estilizarla con el chrome nuevo (home.css) en vez de Bootstrap plano. En carrera, la
  celda usa el PRIMER intento (v0/c0) con tooltip "acertó al 2º intento".
- **📊 Por palabra/ítem** — el análisis actual (heatmap + chips de nombres).
- Botones: **CSV** (ya existe la función) · "Abrir en Reportes".
*Un solo lugar, cero datos nuevos: todo sale de live_answers/state que ya tenemos.*

### A2 — Ranking completo + medallas (S)
Debajo del top-3: lista 4º-N con puntos. Medallas calculables gratis con lo capturado:
⚡ respuesta más rápida (ms mínimo en aciertos) · 🎯 más aciertos a la primera (c0) ·
🔥 mejor racha. Se muestran como chips en el podio (efecto Kahoot "fun").

### A3 — Reveal entre preguntas más Kahoot (S-M)
En modo pregunta-a-pregunta ya hay distribución por opción; añadir: barra de % de acierto
grande + los 3 más rápidos de esa pregunta. En texto (tildes/comas), el reveal del host
puede pintar el MISMO heatmap de la clase de esa frase (reutiliza textHeatmapHtml con las
respuestas del ítem) — hoy solo muestra la solución.

### A4 — "¿En qué va cada alumno?" durante la carrera (S)
El tablero de carrera ya lista progreso; añadir por alumno: en qué ítem está atascado y
cuántos fallos al primer intento lleva (ámbar). Todo ya viaja en live_answers.

## B. TAREAS — del listado plano al informe de clase

### B1 ⭐ Tabla alumno×ítem + agrupar intentos (M)
`renderAttempts` hoy es una lista plana (un renglón por intento). Propuesta:
- **Agrupar por alumno**: nombre · nº de intentos · MEJOR puntaje · último intento ·
  tiempo. (Desplegable para ver cada intento.)
- **Matriz alumno×ítem** con ✓/✗ desde `answers` (mismo módulo compartido de A1 —
  `sessionTable.js` recibe filas normalizadas, da igual live o tarea).
- Tarjetas resumen arriba: % completado (si se conoce el grupo), promedio, ítem más fallado.
- **CSV** de intentos.

### B2 — Ficha por alumno (S-M)
Clic en un alumno → SU heatmap individual (qué tildes falló él) para feedback 1-a-1.
Reutiliza itemStatsHtml con las filas de ese alumno.

### B3 — Comparar intentos / progreso (S)
Si un alumno tiene 2+ intentos: flecha de mejora (12→18 pts) y qué ítems corrigió entre
intentos. Los datos ya están en answers de cada intento.

### B4 — Operativa de la tarea (S)
- En la tarjeta de tarea: contador de entregas ("8 intentos · 5 alumnos") sin entrar.
- Aviso visual cuando la fecha límite pasó con intentos pendientes de revisar.
- (El cierre por fecha ya lo aplica el gate del alumno; no hace falta cron.)

## C. Transversal
- **C1** `views/sessionTable.js` (módulo compartido live+tareas de la matriz ✓/✗) — es la
  pieza que evita duplicar; A1 y B1 la comparten. Filas de entrada = forma normalizada de
  `answerRows` (ya unificada hoy).
- **C2** CSS: estilos de la matriz en home.css (chrome), tokens de acierto/error ya
  permitidos por la ley §3.

## Paquete recomendado (orden)
1. **C1 + A1** — el informe final de live con pestañas Podio/Tabla/Por-palabra (lo que
   pediste explícitamente, máximo impacto).
2. **B1** — la misma tabla en tareas + agrupar por alumno.
3. **A2** (ranking completo + medallas) y **B2** (ficha por alumno) — pulido.
4. A3/A4/B3/B4 según ganas.

Regla de ejecución: cada paquete = VERSION + tests (`sessionTable` con test propio de
celdas ✓/✗/primer-intento) + commit a main.
