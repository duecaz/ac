# HANDOFF — Analítica por ítem/palabra para el docente ("información poderosa")

> Pedido por el usuario (2026-07): que el docente vea, por tarea, **cuántas palabras/marcas
> acertó cada alumno** y **el detalle de qué palabras** falló la clase (p.ej. "el 50% falla
> en *jugó*"). Vale para Tildes/Comas y, en general, para la mayoría de actividades.
> Estado: **ETAPA 1 HECHA** (puntuar por aciertos). **ETAPA 2 = este plan** (pendiente).

## Qué ya está (Etapa 1, v1.51.238)
- Tildes/Comas puntúan **por número de aciertos**, no todo-o-nada por frase
  (`core/textCorrectionRound.js runTextCorrectionSolo`): cada marca correcta suma, las de
  más restan (suelo 0 por frase); `maxScore = nº total de marcas`. El alumno ve
  "X/Y aciertos" por frase y en el resumen ("aciertos · sin marcar · de más").
- El runner ya calcula `passageResults` con el detalle por frase (`hits/misses/over/total`,
  `got`, `want`) — es la materia prima de la Etapa 2, hoy solo se usa para la revisión local.

## Etapa 2 — plan (analítica de clase)

### El problema de fondo
Hoy un intento/resultado guarda solo agregados (`score`, `max_score`, `time_used`). Para la
analítica hay que guardar el **detalle por ítem** (qué marcó el alumno) y **agregarlo por la
clase** en un informe. Es cross-cutting: conviene un formato común "detalle de intento" que
sirva a varias plantillas, no un parche por plantilla.

### Diseño propuesto
1. **Formato común `itemBreakdown`** (en el JSON del intento/resultado, campo nuevo
   `detail`): lista por ítem con lo mínimo para reconstruir aciertos:
   ```
   detail: [{ i: 0, hits: 4, misses: 1, over: 1, total: 5,
              got: [pos…], want: [pos…] }]   // got/want opcionales (para "qué palabra")
   ```
   Genérico: para Quiz sería `{ i, correct, chosen }`; para Emparejar `{ i, correct }`, etc.
   Cada plantilla rellena lo que tenga; el informe usa lo que haya.
2. **Captura**:
   - Tarea (`views/studentTask.js` → `recordAttempt`): pasar `detail` (de `passageResults`).
   - Solo/resultado (`core/results.js` `saveResult`): aceptar `detail`.
   - Live: el engine ya guarda respuestas por ítem (`live_answers`) — reutilizable.
3. **Esquema PB**: añadir campo `detail` (json, maxSize ~200KB) a `assignment_attempts` y
   `results`. Actualizar DEFS (`views/adminView.js`) + `setup-pocketbase.ps1` + `check-pb.sh`.
4. **Informe** (`views/reports.js` / `renderAttempts`): dos vistas:
   - **Por alumno**: nº de aciertos / total, tiempo (ya casi está).
   - **Por ítem/palabra** (lo potente): para cada marca/palabra, % de la clase que la
     acertó, resaltando las más falladas (mapa de calor sobre el texto original). Para
     Tildes/Comas: pintar el pasaje con cada posición coloreada por % de acierto de la clase
     ("jugó" en rojo si el 50% falló). Reutiliza `passageHtml` con un modo "heatmap".
5. **Privacidad**: el detalle es de alumnos (anónimos por nick). Vive en las colecciones ya
   existentes (task/results), sin PII nueva.

### Alcance por plantilla (incremental)
- **Fase 2a**: Tildes/Comas (motor de texto) — el caso que pidió el usuario, con heatmap
  por posición. `got/want` ya disponibles.
- **Fase 2b**: Quiz/otros de opción — % por opción elegida (distractores más marcados).
- **Fase 2c**: el resto según valor (Emparejar, Crucigrama…): al menos aciertos/ítem.

### Riesgos / notas
- Tamaño: `got/want` por ítem puede crecer; cap por intento y/o omitir `got` cuando el ítem
  se acertó al 100% (solo interesan los fallos). El campo json va con maxSize explícito.
- No romper resultados viejos sin `detail` (el informe degrada a solo-agregados).
- Mantener la ley: si se añade el campo/analítica, sumar checks (contrato/《leyes.md》).

## Reglas de ejecución (las de siempre)
Subir `VERSION`, `node tests/run.mjs`, commit → `main` (+ ACTIVIDAD2). Cambios de esquema PB
= actualizar DEFS + ps1 + check-pb.sh + `infraestructura-pb.md` en el mismo commit.
