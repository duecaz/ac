# Seguridad PocketBase — plan por fases (P0-1 · P0-2 · P0-3 · P2-1)

> **Estado: PROPUESTA — requiere DECISIÓN del usuario + acceso al servidor
> (pb.lanube.uno). NO auto-aplicado a propósito** (ver "Por qué no lo apliqué ya").
> Opus 4.8, tras la auditoría de Fable (2026-07).

## El problema (recordatorio)
Las reglas de todas las colecciones PB están en `''` (público total):
`views/adminView.js` → `publicRules = { listRule:'', viewRule:'', createRule:'',
updateRule:'', deleteRule:'' }`. Un alumno con las DevTools puede:
- `PATCH` al `state` de `live_sessions` → ponerse 9999 pts, cambiar la fase, terminar la sala.
- `POST`/`PATCH` a `results`/`assignment_attempts` con score arbitrario.
- **Modificar o borrar actividades de OTROS autores** (`activities` update/delete públicos).
- Listar TODAS las salas activas y leer su `activity` (con respuestas) sin PIN (P0-3/P0-2).

## Por qué NO lo apliqué ya (la trampa)
Dos hechos del código hacen que el "fix obvio" (reglas por autor) ROMPA la app:

1. **El cliente NO envía token de auth en las escrituras de actividades.**
   `adapters/pocketbase/remoteStore.js` `pbFetch` no manda `Authorization` NUNCA
   (lo verifiqué). El token del profe (`ww.pb.auth`, `core/auth.js`) se guarda pero
   no se usa para el CRUD de actividades. → Si pongo
   `activities.updateRule = "@request.auth.id = data.author.id"`, **todas las
   guardadas del profe fallarían** (van sin auth → regla falla).

2. **Los alumnos son ANÓNIMOS (sin cuenta PB).** Se unen con PIN y `core/identity.js`
   (id anónimo), sin token. → No puedo exigir `@request.auth.id` en las colecciones
   que tocan los alumnos (`live_sessions` read, `live_answers` create,
   `results`/`assignment_attempts` create) sin dejar fuera a toda la clase.

Además, enviar un token EXPIRADO en `pbFetch` podría hacer que PB responda 401 aun
con reglas públicas (comportamiento que varía por versión) → **riesgo de romper
guardadas que hoy funcionan**. No es verificable desde el sandbox (sin red a PB).

Aplicar reglas a ciegas sobre el servidor de producción del usuario, sin poder
probarlas, podría **dejar sin servicio a una clase en vivo** — peor que el riesgo
documentado. Por eso: propuesta + decisión, no push.

## Plan por FASES (cada una desbloquea la siguiente)

### Fase 0 — Prerrequisito de código: enviar el token del profe (seguro, testeable)
`adapters/pocketbase/remoteStore.js` `pbFetch`: si existe `ww.pb.auth.token`,
añadir `Authorization: Bearer <token>` en POST/PATCH/DELETE de `activities`.
- Con reglas aún en `''` esto es NO-OP funcional (las públicas ignoran el auth) →
  no rompe nada HOY, pero posiciona la Fase 1.
- **Cuidado (a validar contra PB real):** confirmar que un token EXPIRADO no
  provoca 401 con regla pública. Si PB 0.23 lo rechaza, primero validar/expirar el
  token en cliente (re-login silencioso) antes de mandarlo. Prueba manual: expira
  el token a mano y guarda una actividad → debe seguir guardando.
- **Guardar el owner como campo indexado**: hoy el autor va dentro de `data.author.id`.
  Para reglas eficientes conviene un campo `owner` (text, indexado) en `activities`
  que el cliente rellene con el id del profe autenticado al crear. `adminView.js`
  debe añadir ese campo + índice.

### Fase 1 — Reglas de `activities` (protege el contenido del profe)
Tras Fase 0, en el setup de `adminView.js` (reemplazar `publicRules` por reglas
POR COLECCIÓN):
```
activities:
  listRule:   "visibility = 'public' || owner = @request.auth.id"
  viewRule:   "visibility != 'private' || owner = @request.auth.id"
  createRule: "@request.auth.id != ''"          // solo profes logueados crean
  updateRule: "owner = @request.auth.id"        // solo el autor edita
  deleteRule: "owner = @request.auth.id"        // solo el autor borra
```
Esto cierra el "borrar/editar actividades ajenas" y la enumeración de privadas.
Requiere que TODO `saveActivity` mande auth (Fase 0) y setee `owner`.

### Fase 2 — `results` / `assignment_attempts` (alumnos anónimos)
No se puede exigir auth (alumnos sin cuenta). Mínimo viable:
```
results / assignment_attempts:
  createRule: ""      // el alumno anónimo crea su resultado (necesario)
  listRule/viewRule:  "@request.auth.id != ''"   // solo profes leen los reportes
  updateRule/deleteRule: null (deshabilitado)    // nadie edita/borra por API
```
Un alumno aún puede crear un resultado con score inflado (no hay cómo evitarlo con
reglas si el cliente calcula el score). Mitigación real = validación server-side
(hook PB) o recalcular en el reporte del profe. Documentarlo como límite aceptado.

### Fase 3 — `live_sessions` / `live_answers` (lo más delicado — junto con P0-2/P2-1)
Alumnos anónimos DEBEN poder: leer la sala por PIN y crear respuestas. Pero NO
deben poder PATCHear el `state` (scores/fase) ni leer las respuestas correctas.
```
live_sessions:
  listRule:  null                       // NO enumerable (cierra P0-3)
  viewRule:  ""  o filtrado por code     // unirse por PIN exacto (ver nota)
  createRule/updateRule: "@request.auth.id != ''"  // solo el host (profe) muta el state
  deleteRule: "@request.auth.id != ''"
live_answers:
  createRule: ""                         // el alumno envía su respuesta
  listRule/viewRule: "@request.auth.id != ''"  // solo el host lee el tablero
  updateRule/deleteRule: null
```
- **Choque con el diseño actual:** hoy el ALUMNO hace `setSessionState`/PATCH del
  `state` (submitAnswer en el path blob, join, etc.) — con `updateRule` de host eso
  ROMPE. Por eso Fase 3 va ACOPLADA a mover las respuestas del alumno a
  `live_answers` (colección propia, ya existe en el esquema) y a que el HOST sea el
  único que escribe `live_sessions.state`. Esto es exactamente la **deuda A**
  (lost-update) y el **P0-2** (stripping de respuestas) y **P2-1** (validar en
  servidor). No se puede cerrar la regla sin ese refactor.
- **P0-2 (respuestas viajan al alumno):** `live_sessions.activity` guarda el
  `activity` íntegro con `answerIdx`. Aunque cierres `viewRule`, el alumno necesita
  ver la sala para jugar → verá el activity. Fix: guardar en `activity` un snapshot
  SIN claves (usar `getRoundPayload` por plantilla para strippear) y las claves en
  un campo/colección que solo lea el host. Es cambio de esquema + de `createRoom`.
- **join por PIN sin listRule:** si se quita `listRule`, `findRoomByCode` (que hoy
  hace `getFullList filter=code='X'`) deja de funcionar. Alternativas: (a) un
  `viewRule` público pero SIN el campo `activity`-con-claves (requiere P0-2), o
  (b) un endpoint/función server que resuelva code→sessionId. Decidir con el usuario.

## Qué necesito del usuario para ejecutar
1. **Decisión de alcance:** ¿hacemos Fase 0+1 ya (protege actividades, bajo riesgo)
   y dejamos Fase 3 para el refactor grande (deuda A/P0-2/P2-1)? Recomendado.
2. **Acceso/permiso** para que, tras preparar el código, él aplique el setup de
   reglas desde `#/admin` (o comandos `curl`/PS que le dejo listos) contra
   pb.lanube.uno, y **probar en un dispositivo real** que:
   - el profe sigue guardando/borrando SUS actividades,
   - un segundo profe NO puede borrar las del primero,
   - un alumno se une por PIN y responde,
   - un alumno NO puede PATCHear el state (probar con DevTools → 403).
3. Confirmar la versión de PB (0.23+ vs anterior) para la sintaxis de reglas/índices.

## Recomendación
Ir por **Fase 0 → Fase 1** en cuanto el usuario dé luz verde (cierra el vector más
sangrante: manipular/borrar actividades ajenas, con bajo riesgo de romper la clase).
**Fase 3** se hace junto con la deuda A en el bloque de diseño grande (P0-2/P2-1),
con el usuario validando en dispositivo. **Fase 2** es rápida y de riesgo medio.
