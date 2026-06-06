# Auditoría del sistema LIVE (Kahoot-style) — solo lectura

> Revisión de `core/transport/live.js`, `room.js`, y las Edge Functions
> `create-session` / `settle-item`. Severidad: 🔴 alta · 🟠 media · 🟡 baja.
> Estado de extracción de lógica pura al final.

## Cómo funciona (resumen)
- **Crear sala**: `room.createRoom` → Edge Function `create-session` (service role)
  genera PIN (`generate_session_code`), guarda `activity_snap` (snapshot anti-trampa),
  `status='lobby'`, `phase='idle'`, `current_item=-1`.
- **Unirse**: `live.joinSession(code, nick)` valida apodo en cliente, hace upsert del
  player por `(session_id, user_id)` (reconecta si ya existe).
- **Jugar**: el host avanza fases sobre `sessions.phase`
  (`lobby→question→reveal→leaderboard→…→ended`). Los alumnos envían respuestas
  (`answers`, con `correct/points = null`). El host pulsa "revelar" →
  `settle-item` (service role) **puntúa en el servidor** (anti-trampa) y flipa a `reveal`.
- **Realtime**: `subscribeRoom` escucha `postgres_changes` de `sessions/players/answers`.

## Hallazgos

### 🟠 1. El filtro de apodos es solo de cliente ✅ MITIGADO (pendiente deploy)
`live.joinSession:66` valida con `isAcceptableNickname`, pero el **servidor no
re-validaba**: un cliente modificado podía insertar cualquier `name`.
**Resuelto** en `migrations/0013`: trigger `validate_player_name` (BEFORE INSERT/UPDATE)
bloquea el abuso estructural server-side (vacío, >40, caracteres de control). La
blocklist de insultos sigue en cliente (defensa en profundidad). *Falta aplicar la
migración.*

### 🟠 2. `settle-item`: `players.score` con read-modify-write ✅ ARREGLADO (pendiente deploy)
Leía `score`, sumaba el delta y reescribía en JS → carrera entre settles concurrentes.
**Resuelto**: `migrations/0013` añade `increment_player_score(player, delta)` (UPDATE
atómico) y `settle-item/index.ts` ahora lo llama vía RPC. *Falta aplicar la migración y
redeplegar la Edge Function.*

### 🟡 3. Scorers del servidor solo para `quiz`
`settle-item` solo registra `SCORERS = { quiz }`. Las demás plantillas tienen
`modes.live=false`, así que hoy es correcto; pero **el registry valida el contrato de
cliente (`getRoundPayload`/`scoreSubmission`) y NO la existencia del scorer de
servidor**. Si alguna plantilla activara `live:true` sin scorer en Deno, el settle
fallaría en runtime. Hueco entre el contrato de cliente y el del servidor.

### 🟡 4. Lógica de fases dispersa en el DOM del host
`views/hostLive.js` calculaba inline las transiciones (índice siguiente, `isLast`, flips
de fase). Mismo problema estructural que en SOLO. **Resuelto parcialmente**: extraído a
`core/livePhases.js` (puro + testeado); falta **cablear** el host para que lo use.

### 🟡 5. Acoplamiento a Supabase no encapsulado tras `RealtimePort`
`transport/live.js` + `room.js` **son** de facto el adapter realtime de Supabase, pero
no están detrás del contrato `kernel/contracts/realtimePort.js`. La estrategia pide
moverlos a `adapters/supabase/` tras el Port (como hicimos con datos). Pendiente.

### 🟡 6. Comentario duplicado
`transport/live.js:129-133`: el bloque docstring de `subscribeRoom` está duplicado.

## Lo positivo (conservar)
- **Anti-trampa real**: el cliente nunca escribe `correct/points`; lo hace el servidor
  con service role, validando `host_id` y usando `activity_snap`.
- **Idempotencia** del settle ante doble clic.
- **Reconexión/heartbeat**: `pingPresence` (alumnos) y `pingHost` + RPC de limpieza de
  zombis; banner de conexión con debounce (`core/connection.js`).
- **Bonus de racha** server-side calculado desde el historial (no manipulable).

## Extracción de lógica pura (esta tanda)
- ✅ `core/livePhases.js` — `planTransition` + `isLastItem` + `PHASES`. Codifica el flujo
  legal del host (start/reveal/leaderboard/next/end) con rechazo de transiciones
  inválidas. **8 checks** en `tests/live.test.mjs` (incluye el filtro de apodos).

## Próximos pasos LIVE (orden sugerido, paso seguro)
1. **Cablear `hostLive.js`** para decidir transiciones con `planTransition` (cambio de
   DOM → lo verificas en navegador con 2 pestañas host+alumno).
2. **Re-validar apodo en servidor** (hallazgo 🟠 1).
3. **RPC atómico de score** en `settle-item` (hallazgo 🟠 2).
4. **Mover `live.js`/`room.js` tras `RealtimePort`** en `adapters/supabase/` (estrategia).
5. Extraer un **ranker de leaderboard/podio** puro (orden + empates + top N) si la UI lo
   necesita más allá del `ORDER BY` de SQL.
