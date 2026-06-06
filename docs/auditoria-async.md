# Auditoría del sistema ASYNC (tareas) — y trabajo de robustez

> Tareas = el docente crea una "tarea" con un PIN y fecha límite; el alumno entra por
> `#/task/:code` y juega **SOLO a su ritmo**; cada intento se registra. Revisión de
> `core/transport/assignments.js`, `views/assignments.js`, `views/studentTask.js`.

## Cómo funciona
- **Crear** (`assignments.js` profesor): `createAssignment(activity, {title, dueAt,
  maxAttempts})` → guarda `activity_snap` + un `code`. Lista/cierra/rota código.
- **Jugar** (`studentTask.js`): `findAssignmentByCode` → gating (cerrada / vencida /
  intentos agotados) → apodo → `runPlayer` SOLO → al terminar `recordAttempt`.
- **Resultados**: cada intento es una fila en `results` con `assignment_id`; el profesor
  ve los intentos (`listAttempts`); el alumno cuenta los suyos (`countOwnAttempts`).

## Hallazgos y trabajo hecho

### 🟠 1. Acoplamiento total a Supabase ✅ RESUELTO (estrategia)
`transport/assignments.js` usaba `getClient`/RPCs directos → tareas solo contra Supabase.
**Resuelto** con el patrón de datos/realtime: `getAssignments()` (local | supabase),
driver `adapters/local/assignments.js` (KV) + wrapper `adapters/supabase/assignments.js`,
y facade `core/assignmentsTransport.js`. Las vistas solo cambiaron el import.

### 🟠 2. `studentTask` llamaba `ensureAuth` (Supabase) directo ✅ RESUELTO
Rompía el modo local offline. **Resuelto** con `core/identity.js → ensureIdentity()`
backend-aware: en `local` usa el anon id de `localStorage` y **no carga el SDK**; en
`supabase` hace el sign-in anónimo como antes.

### 🟡 3. Lógica de gating dispersa en el DOM ✅ EXTRAÍDA
El orden cerrada → vencida → intentos estaba inline en `studentTask`. Extraído a
`core/assignmentRules.js` (`assignmentGate`, `isPastDue`, `attemptsRemaining`,
`normalizeCode`) — puro y testeado. *(La vista aún hace su gate inline; se puede cablear
a `assignmentGate` en una pasada posterior, verificable en navegador.)*

### 🟡 4. Anti-trampa de intentos es de cliente
`countOwnAttempts`/`max_attempts` se comprueban en cliente; en Supabase la RLS limita
algo, pero el límite real de intentos no está forzado server-side. Igual que el apodo
LIVE: mitigable con un trigger/EF. Pendiente (no bloqueante para aula de confianza).

## Tests (lo corre el agente)
- `tests/assignments.test.mjs` (7 checks): reglas puras + flujo del driver local
  (profesor crea tarea → alumno la halla por código → intentos limitados por usuario →
  profesor lista/cierra → rotar código invalida el anterior). **Sin Supabase.**

## Probar ASYNC en local (sin Supabase)
1. `teacher.html` → abre una actividad → **Tareas** → crea una tarea (sale un código).
2. `student.html` → **Unirse** con ese código (o `#/task/<code>`) → juega → al terminar
   queda registrado el intento. Reintenta hasta agotar `max_attempts`.
> En localhost el backend es `local`: todo offline. `ww.setBackend('supabase')` para el real.

## Pendiente
- Cablear el gate de `studentTask` a `assignmentRules.assignmentGate` (DOM, navegador).
- Forzar `max_attempts` server-side en Supabase (trigger/EF) — robustez producción.
