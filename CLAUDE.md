# WW Actividades — Guía para Claude

## Reglas obligatorias (SIEMPRE)

### 1. Versión — en CADA commit y en CADA respuesta
- **SIEMPRE** sube `VERSION` en `core/constants.js` en cada commit (incremento de patch:
  `1.51.49` → `1.51.50`). Nunca bajar la versión, siempre hacia adelante (la caché y el
  service worker dependen de que la versión avance).
- **SIEMPRE** indica el número de versión en la respuesta del chat cuando termines un
  cambio, en formato `(vX.Y.Z)`, para poder referenciar exactamente por versión.
- El número de versión del commit y el de la respuesta deben coincidir.

### 2. Push a AMBAS ramas
Tras commitear, hacer push a las dos ramas:
```
git push -u origin claude/admiring-shannon-06ioqo
git push origin claude/admiring-shannon-06ioqo:ACTIVIDAD2
```
`ACTIVIDAD2` es la rama que sirve GitHub Pages (estático).

## Arquitectura (resumen)
- Vanilla JS, ES modules, sin framework. Routing por hash.
- Backend: **PocketBase** en `pb.lanube.uno` (Pi 5, Docker). **Solo PocketBase** — Supabase se está retirando.
  - Ya en PB: activities, results, live sessions, tareas (assignments), imágenes (inline), logs (local).
  - Pendiente de migrar a PB: auth (`core/auth.js`/`core/supabase.js`), reportes (`views/reports.js`),
    explorar/banco compartido (`views/explore.js`). Los adaptadores `adapters/supabase/*` quedan solo
    como fallback (`?backend=supabase`); el default es `pocketbase`.
- Imágenes inline como data-URL en el JSON de la actividad (límite 200 KB). **No subir a storage externo**
  (`core/upload.js` convierte a data-URL; nunca a un bucket).
- Live: una sola sala PocketBase (`live_sessions`), PIN/QR, `subscribeRoom`, fase de máquina de estados.
  - Pregunta Live y Ruleta Live reutilizan ese mismo live con la fase `'question-live'` y campos `ql_*`.

## Notas de plantillas
- `sessionItems(activity)` lee `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.
- Plantillas con `modes.live: true` deben declarar `getRoundPayload` y `scoreSubmission` (aunque sean stubs).
- Las columnas de rejillas se ponen inline (`grid-template-columns: repeat(N, 1fr)`); las variables CSS se ignoran en algunos móviles.

## Deuda técnica registrada

### 🔴 DEUDA IMPORTANTE

#### 1. Retiro de Supabase (pendiente desde migración a PocketBase)
- **Qué**: auth (`core/supabase.js`, `core/auth.js`), reportes (`views/reports.js`), explorar (`views/explore.js`) todavía apuntan a Supabase.
- **Impacto**: si Supabase se apaga, auth y reportes dejan de funcionar. El fallback `?backend=supabase` complica el mantenimiento.
- **Archivos principales**: `core/supabase.js`, `core/auth.js`, `views/reports.js`, `views/explore.js`, `adapters/supabase/*` (4 archivos), `core/assignmentsTransport.js`, `core/liveTransport.js`, `core/identity.js`.
- **Plan**: migrar auth a PocketBase users/anon-id, reescribir reportes sobre `live_sessions` PB, luego eliminar `adapters/supabase/`.

#### 2. `Date.now()` no determinista en lógica de dominio
- **Qué**: `Date.now()` aparece en `core/effects.js`, `core/textCorrectionRound.js`, `core/assignmentRules.js`, `core/submitQueue.js`, `core/results.js`, `core/sounds.js`, `core/errorLog.js`.
- **Impacto**: los tests de tiempo son imposibles de escribir (siempre verde aunque la lógica esté mal). Un bug en timers se encuentra tarde.
- **Plan**: centralizar en un reloj inyectable `core/clock.js` — `export const clock = { now: () => Date.now() }` que los tests reemplazan con `clock.now = () => fakeTs`. No requiere cambios de API en producción.

### 🟡 DEUDA ARQUITECTÓNICA (en progreso)

#### 3. Players sin contrato uniforme → pérdida silenciosa de datos
- **Qué**: Wheel y Question-Live no llaman `trySaveResult`. Crossword guarda `scoreAuto: totalWords` en vez de puntos. Timer duplicado en 3 players (Quiz, Froggy, Wordsearch).
- **Plan**: ver sección "Arquitectura de Players" más abajo.

## Arquitectura de Players (plan de estandarización)

Tres capas, sin herencia forzada:

```
CONTRATO  (templates/base.js)      — qué DEBE hacer cada player
SHELLS    (core/soloPlayer.js)     — cuándo: timer, avance, finish, trySaveResult
CORES     (templates/*/player.js)  — cómo: drag, click, tipo, animación (único por plantilla)
```

**Shell Secuencial** `runSequentialPlayer(activity, opts, callbacks)`:
- Maneja: `state`, timer, `idx++`, `finish()`, `trySaveResult()`, `onFinish()`
- Callers destino: Quiz, Math, Froggy

**Shell Libre** `runFreeformPlayer(activity, opts)` → devuelve `ctx`:
- El player llama `ctx.finish({score, maxScore, lead, stats})` al terminar
- Shell garantiza: `resultScreenHtml()`, `trySaveResult()`, `onFinish()`
- Callers destino: Memory, Match, Wordsearch, Crossword, Wheel, Question-Live

**Timer único** `core/soloTimer.js` — `createTimer(secs, {onTick, onTimeout})`:
- Cierra 3 implementaciones divergentes (Quiz, Froggy, Wordsearch)

**Orden de migración** (menor a mayor riesgo):
1. `core/soloTimer.js` — solo nuevo código, sin tocar players aún
2. `FreeformShell` — cerrar bug trySaveResult en Wheel/Question-Live
3. Migrar Math al SequentialShell (más simple, valida el shell)
4. Migrar Quiz al shell
5. Migrar Froggy al shell (conserva todas sus animaciones)
