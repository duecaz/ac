# HANDOFF — Deuda A: lost-update en el blob `state` de `live_sessions`

> Estado: **PLAN, no ejecutado**. Escrito tras medir la superficie real del
> problema (v1.51.271). La mitad de la deuda ya se pagó sola con la analítica:
> las RESPUESTAS viven en `live_answers` (una fila por alumno×ítem, un CREATE
> nunca pisa a otro). Lo que queda es más pequeño de lo que dice CLAUDE.md — y
> por eso es abordable en una sesión.

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

| Fase | Qué | Tamaño |
|---|---|---|
| **A1** | Colección `live_players` + índice único (session,name) en: `#/admin` "Crear colecciones" (DEFS), `tools/setup-pocketbase.ps1`, `tools/check-pb.sh` (+ check negativo). Reglas como `live_answers` (públicas hoy; endurecer va con handoff-seguridad-pb) | S |
| **A2** | Adaptador dual (patrón `answersReady()` → `playersReady()` cacheado): `joinSession` = gate de status (lectura) + POST fila con retry de apodo ante 400 del índice único; `listPlayers` = filas; `kickPlayer` = DELETE fila; sin colección → ruta blob actual (cero cambio pre-migración). `subscribeRoom` añade el topic `live_players` (filtrado por sesión en cliente) para que el lobby del profe vea entrar gente al instante — hoy los joins se ven porque PATCHean el blob; al dejar de hacerlo, hace falta el topic (y de paso puede añadirse `live_answers`, que hoy depende de pings+poll) | M |
| **A3** | `leaderboard()` derivado: puntos = agregado de `live_answers` + nombres de `live_players` (misma fuente que el podio → el marcador entre preguntas y el final SIEMPRE coinciden). `paintEnded` del alumno igual. Tras esto el blob es host-only ⇒ **deuda A cerrada** | M |
| **A4** | Verificación: `tools/stress-live.mjs <PIN> 30` — 30 joins + 30 respuestas CONCURRENTES contra el PB real (lo corre el usuario contra la Pi), assert: 30 filas de jugador, 0 pisados, apodos únicos. + test unitario del retry de apodo (fetch inyectado) + actualizar CLAUDE.md/este handoff | S |

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
