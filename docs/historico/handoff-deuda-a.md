# HANDOFF — Deuda A: lost-update en el blob `state` de `live_sessions`

> 🗄️ **HISTÓRICO — RESUELTO (v1.51.272).** Se archivó en v1.51.424 al consolidar la
> documentación: `live_players` con su índice único está en la Pi; la regla, en `leyes.md` §21.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> Estado: **EJECUTADA (v1.51.272)** — A1-A4 completas. `live_players` (fila por
> jugador) + adaptador dual + marcador derivado + `tools/stress-live.mjs`. El
> `joinSession` de 30 alumnos ya no se pisa: cada uno CREA su fila. Falta SOLO el
> paso del usuario: correr "Crear colecciones" en `#/admin` (crea `live_players`)
> y el stress-test contra la Pi. El plan original queda abajo como registro.

## 1. Superficie REAL hoy (verificada en `adapters/pocketbase/realtime.js`)

| Escritura al blob `state` | ¿Quién? | ¿Choca con 30 alumnos? |
|---|---|---|
| `joinSession` (players[]) | **cada alumno** | **SÍ — el único punto rojo** |
| `submitAnswer` / `submitRaceAttempt` / `submitProgress` | alumno | NO — van a `live_answers` (filas); el blob solo en el fallback legado |
| `startSession` / `setSessionState` / `settleItem` / `settlePending` / `endSession` / `kickPlayer` | **solo el profe** | NO — un solo escritor |
| `pingPresence` / `pingHost` | — | no-ops en PB |

**El escenario de los 30:** todos escanean el QR a la vez. Cada `joinSession`
hace GET del blob → `engine.join()` (push a `players[]`) → PATCH del blob
COMPLETO. El PATCH de B pisa el de A → A recibió un `playerId` que ya no existe
en `players[]`: no aparece en el lobby del profe, el leaderboard no lo conoce y
sus puntos no se le atribuyen. **Es el bug real detrás de "a veces un alumno no
entra y tengo que refrescarle"** (el refresh re-hace el join y suele ganar).
Bonus del mismo origen: `p.id = 'p' + (++seq)` — dos joins simultáneos pueden
COMPARTIR playerId, y el sufijo de apodos únicos ("Juan 2") también corre.

También choca: un join de alumno contra un `setSessionState` del profe (p.ej.
pulsa "Empezar" mientras entran) — puede revertir la fase o perder al alumno.

## 2. Decisión: opción (a) — jugadores a su propia colección

La misma medicina que ya funcionó con las respuestas: **`live_players`, una fila
por jugador**. Un CREATE nunca colisiona. Con eso, el blob `state` queda con UN
solo escritor (el profe) → el lost-update desaparece **por diseño**, no por
reintentos. (La opción (b), concurrencia optimista con merge+retry, se descarta:
PocketBase no tiene If-Match nativo, solo REDUCE la ventana y añade complejidad
permanente.)

```
live_players: session (text) · name (text) · user_id (text) · joined (date/autodate)
  · playerId = el ID de la FILA (se acabó el 'p'+seq del engine)
  · índice ÚNICO (session, name) → apodos únicos ATÓMICOS: el 400 de colisión
    dispara el retry "Juan 2" (hoy el sufijo se calcula leyendo → carrera)
```

Los PUNTOS no necesitan columna: ya son derivables de `live_answers`
(sum(points) por jugador — es EXACTAMENTE lo que hace el podio hoy vía
`buildSessionTable`). `state.players[]` queda solo para el driver local y el
fallback legado.

## 3. Fases

| Fase | Qué | Estado |
|---|---|---|
| **A1** | Colección `live_players` + índice único (session,name) en DEFS de `#/admin`, `tools/setup-pocketbase.ps1` y `tools/check-pb.sh` (+ check del índice) | ✅ v1.51.272 |
| **A2** | Adaptador dual (`playersReady()` cacheado): `joinSession` = gate de status + POST fila con retry de apodo ante el 400 del índice; `listPlayers` = filas; `kickPlayer` = DELETE; sin colección → ruta blob (cero cambio pre-migración). `subscribeRoom` añade el topic `live_players` (solo si existe) → el lobby del profe ve entrar gente al instante. `userId` = anon id estable (reconexión sin duplicar) | ✅ v1.51.272 |
| **A3** | `leaderboard()` derivado: puntos = agregado de `live_answers.points` + nombres de `live_players` (misma fuente que el podio → marcador entre preguntas y podio final coinciden). El blob queda host-only ⇒ **cerrada por diseño** | ✅ v1.51.272 |
| **A4** | `tools/stress-live.mjs <PIN> [N]` — N joins CONCURRENTES contra el PB real (lo corre el usuario), assert: N filas, 0 pisadas, apodos únicos (+ modo `clean`). Test unitario del retry con fetch inyectado: `tests/liveJoin.test.mjs` | ✅ v1.51.272 |

## PASO DEL USUARIO (imprescindible para activarlo)
1. En la web: `#/admin` → **"Crear colecciones"** (añade `live_players` con su índice único — es append-only, no toca nada existente).
2. Verificar: `bash tools/check-pb.sh` → debe salir verde `live_players` + su índice.
3. Aceptación real (2 vías, mismo motor `core/stressTest.js`):
   - En la web: `#/admin` → **"Simular carga"** (30/50/100) → crea sala+tarea desechables, N joins+respuestas+intentos CONCURRENTES, verifica 0 filas perdidas y limpia.
   - CLI: `node tools/stress-live.mjs 30` (auto-crea su propia sala; ya no necesita PIN).
   Cubierto por `tests/stressTest.test.mjs` (PB falso en memoria con índice único).

Orden estricto A1→A2→A3 (cada una deja el sistema funcionando; A2 ya elimina el
clobber de joins aunque A3 no esté).

## 4. Riesgos y decisiones finas

- **Expulsar alumno**: DELETE de su fila. El alumno se entera al no encontrarse
  en `listPlayers` (igual que hoy) — sin cambio de UX.
- **Reconexión**: `joinSession` con el mismo `user_id` en la misma sesión =
  buscar fila existente primero (reconexión conserva nombre e id), como hoy.
- **Zombies**: las filas de una sala muerta se limpian con el mismo mecanismo
  que `live_answers` (barrido por sesión terminada; ya existe patrón).
- **Escala del topic**: suscribirse a la colección `live_players` entera y
  filtrar en cliente emite eventos de otras salas activas. A escala colegio
  (pocas salas simultáneas) es irrelevante; si algún día molesta, PB permite
  suscripción con filtro server-side.
- **Driver local**: sin cambios (en memoria no hay concurrencia real). Los tests
  de concurrencia REALES son el stress-tool de A4 contra PB — el driver local no
  puede reproducir este bug, por eso nunca lo cazó un test.

## 5. Qué NO entra aquí

- Deuda F (`submitProgress` desempate por `ms`) — mismo espíritu, otro pase; el
  helper `dedupeByPlayer` ya deja UN punto donde cambiar el criterio.
- Carrera del alumno (re-score local + recola) — handoff-centralizacion §8.
- Endurecer reglas PB de `live_players`/`live_answers` — handoff-seguridad-pb.
