# Infraestructura — PocketBase + Raspberry Pi (estado REAL)

> **✅ REGLAS L6+M1-M5+R1 APLICADAS Y SONDEADAS (2026-07-30, app v1.51.327)**.
> Las sondas anónimas contra `pb.lanube.uno` dan `200 · 403 · 400` y eso es lo
> CORRECTO — lección de semántica PocketBase que costó una falsa alarma:
> · una `listRule` con expresión (p.ej. exigir sesión) responde **200 con cero
>   filas** al anónimo, no 403 — solo una regla CERRADA (null) da 403;
> · un create que viola la regla responde **400** (no 403) para no filtrar info.
> Comprobación definitiva de `live_keys`: `curl -s .../live_keys/records` debe
> dar `"totalItems":0` aunque existan salas.
> ① `qid` + índices de R1: **CONFIRMADOS** (2026-07-30, panel v1.51.332 con
> verificación por relectura: `results · verificado: 10 campos`,
> `assignment_attempts · verificado: 12 campos`, índices incluidos). El panel
> ahora RELEE el servidor tras aplicar y reporta lo que HAY, no lo que intentó.
> QUEDA: ② la PARTIDA REAL (móvil anónimo: entrar·responder·puntuar en pregunta
> Y carrera) + `node tools/stress-live.mjs <PIN> 30`; ③ qué es @pit (las sondas
> de la Pi daban lo mismo que desde fuera → mismo servidor; @pit como clon
> aparte sigue sin confirmar).

> **Para qué sirve este doc**: es la FUENTE para consultar cómo está montada la base de
> datos y la Pi sin tener que redescubrirlo por SSH. Actualízalo cada vez que cambie algo
> del servidor (versión de PB, reglas, colecciones, backups). Última verificación completa:
> **2026-07-22** con `tools/check-pb.sh` → 13/13 OK.
>
> Diseño/razonamiento del esquema: `docs/handoff-esquema-pb.md`. Plan de seguridad:
> `docs/handoff-seguridad-pb.md`. Plan de usuarios y acceso docente (PIN/NFC/pizarras):
> `docs/handoff-acceso-docente.md`.

## Regla de oro de credenciales

**El superadmin de PocketBase NUNCA se pega en el chat ni queda en historial.** Todos los
comandos que necesiten credenciales se escriben con `read -rp EMAIL` + `read -rsp PASS`
(el usuario los teclea en su terminal; a Claude solo se le pega la SALIDA). Claude redacta
los comandos; el usuario (duecaz) los ejecuta en la Pi.

## La Pi (servidor)

| Qué | Valor |
|---|---|
| Hardware | Raspberry Pi 5 |
| Hostname / usuario | `pio` / `duecaz` |
| IP LAN | `192.168.1.50` |
| Acceso | `ssh duecaz@192.168.1.50` (desde Windows PowerShell del usuario) |
| Repo clonado en la Pi | `~/ac` (para correr `bash ~/ac/tools/check-pb.sh`; actualizar con `git -C ~/ac pull`) |
| Exposición pública | túnel **cloudflared** + **nginx-proxy-manager** → `https://pb.lanube.uno` |

⚠️ **La Pi y este PocketBase están COMPARTIDOS con otros proyectos** (colecciones de
`aportes` y `equipos_activados` conviven en la misma instancia). NUNCA borrar/renombrar
colecciones que no sean de AulaReto, y nunca "reset" global de PB.

## El contenedor PocketBase

| Qué | Valor |
|---|---|
| Contenedor | `pocketbase` (Docker) |
| Imagen | `ghcr.io/muchobien/pocketbase:0.23.8` — **versión FIJADA** (antes `:latest`; se fijó para que un update sorpresa no rompa la API) |
| Puerto | `8090` (localhost de la Pi; el proxy lo publica como `pb.lanube.uno`) |
| Datos | bind mount `/home/duecaz/docker/pocketbase/pb_data` → `/pb_data` |
| Compose | en `~/docker/pocketbase/` (ahí se editó la línea `image:` para fijar versión) |

Redescubrir el estado real (si este doc quedara viejo):

```bash
docker ps                              # contenedor y puertos
docker inspect pocketbase | head -80   # imagen exacta, mounts
docker exec pocketbase pocketbase --version
crontab -l                             # cron de backup
```

### Backup

Cron **diario** en el crontab de `duecaz` que empaqueta `pb_data` (tar con fecha).
Verificar con `crontab -l` y mirando los `.tar.gz` generados. **Antes de cualquier
upgrade de PB: backup manual + parar contenedor** (SQLite se copia frío con seguridad).

### Procedimiento de upgrade de PocketBase (cuando toque)

1. Backup manual de `pb_data` (contenedor parado).
2. Cambiar el pin de `image:` en el compose a la versión nueva; `docker compose up -d`.
3. `bash ~/ac/tools/check-pb.sh` → si algo falla, pegar la salida a Claude ANTES de usar
   la app con alumnos. (El script corre las consultas EXACTAS de la app: health, auth,
   colecciones, campos de activities, query de Explorar, likes, proveedor Google.)
4. Si falla y no hay arreglo rápido: volver al pin anterior + restaurar backup.

## Colecciones de AulaReto (estado actual)

Las crea/actualiza de forma **idempotente** el panel `#/admin` → "Crear colecciones"
(browser) o `tools/setup-pocketbase.ps1` (PowerShell). Ambos piden superadmin y aplican
los MISMOS campos y reglas (fuente de verdad en código: `views/adminView.js` DEFS).

| Colección | Campos propios | Notas |
|---|---|---|
| `users` (auth) | `name`, `role` (**minúscula**; `'admin'` = moderador global), `avatar` | duecaz@gmail.com tiene `role=admin`. Las reglas usan `@request.auth.role` — si el campo se llamara `Role` el servidor NO reconoce el rol (el cliente es tolerante, `getAuthRole()`). |
| `activities` | `data` (json 5MB), `visibility` (`public`/`unlisted`), `tags`, `language`, `owner` (id del profe) | **SIN campos `created`/`updated`** (ver quirks). El JSON `data` lleva la actividad completa, incluido `author {id,name,signedAt}` denormalizado para las tarjetas. |
| `activity_likes` | `activity`, `user` + índice ÚNICO (activity,user) | ❤ de la biblioteca. |
| `reports` | `activity`, `by`, `reason` | 🚩 moderación. |
| `profiles` | `owner`, `name`, `school`, `bio`, `avatar` + índice ÚNICO (owner) | 👤 Perfil PÚBLICO del profe (colegio/frase/avatar de Google), separado de `users` porque el email es privado. Fila id = id de usuario. Lectura pública; escritura solo del dueño. Lo lee la página `#/autor/:id`. |
| `results` | activity_id, session_id, user_id, player_name, score_*, max_score, time_used… | Resultados de alumnos (anónimos). |
| `live_sessions`, `assignments`, `assignment_attempts` | (ver `handoff-esquema-pb.md`) | En vivo y tareas. `assignment_attempts.answers` (json) = detalle por ítem (analítica de tareas, F3). `live_answers.v0`(json)/`c0`(bool) = PRIMER intento en carrera (para capturar errores en la analítica en vivo). |

### Reglas de acceso vigentes (resumen)

- `activities` (**ENDURECIDO U1**, v1.51.228): list/view =
  `visibility='public' || owner=@request.auth.id || @request.auth.role='admin'`;
  create = `@request.auth.id != '' && owner=@request.auth.id` (crear exige sesión y ser tu
  propio owner); update/delete = `owner=@request.auth.id || role='admin'`. Ya **no** hay
  cláusula transitoria `owner=''` (la BD arrancó limpia). → un anónimo no crea filas y
  nadie edita/borra ajenas salvo admin.
- `activity_likes`: leer público; crear/borrar solo el propio (`user=@request.auth.id`).
- `reports`: crear con sesión; listar/borrar solo admin.
- `results`, `live_sessions`, `assignments`, `assignment_attempts`: **públicas** (alumnos
  anónimos). Riesgo conocido y aceptado por ahora (deuda: auditoría Fable P0).
- `users` (**ENDURECIDO U1**): view = uno mismo o admin; list = solo admin;
  **create = solo admin** (`@request.auth.role='admin'`). El signup público por correo se
  cerró; el alta de autoservicio queda por Google (OAuth **no** pasa por createRule en PB,
  así que el primer login con Google sigue creando su user). Las cuentas de correo para
  pizarras las crea el admin (panel Profesores). Aplicado por `setup-pocketbase.ps1`
  (`Apply-Users`), no por el panel `#/admin` (que no toca `users`).

### Quirks de PB 0.23 que YA nos mordieron (no repetir)

- **`activities` NO tiene `created`/`updated`**: en PB ≥0.23 las colecciones creadas por
  API no traen esos autodate, y añadirlos después por PATCH no aplicó. Por eso **PROHIBIDO
  `sort=-updated` / `sort=-created` sobre `activities`** — rompe con el error opaco
  *"Something went wrong while processing your request"* (para TODOS, incluso superadmin:
  es la query, no las reglas). La app ordena en cliente por `data.updatedAt`
  (explore.js / landing.js / author.js). `results` sí intenta `sort=-created` con
  fallback sin orden (remoteStore.listResults).
- **IDs de 15 chars alfanuméricos exactos**: `act_aBcDeFgHiJ` → `actabcdefghij00`
  (strip + pad, `remoteStore.toId`). El id original vive dentro de `data.id`.
- **Filtros**: SIEMPRE `pbEscape`/`pbFilterParam` (`core/pbFilter.js`) — la comilla simple
  no la escapa `encodeURIComponent`.
- Token en `Authorization` va **a pelo** (sin `Bearer `); PB tolera ambos, pero el
  estándar del código es a pelo.

## Login con Google (OAuth2)

- Proveedor **google habilitado** en PB (Settings → Auth providers de la colección
  `users`). El `client_secret` vive SOLO en PB (nunca en el repo/navegador).
- Cliente OAuth en Google Cloud del usuario (proyecto reutilizado; client id
  `12847638894-….apps.googleusercontent.com`).
- Flujo (sin SDK, `core/auth.js`): `auth-methods` → `authURL`+`state`+`codeVerifier`
  (guardados en sessionStorage) → redirección a Google → vuelta a
  `location.origin+pathname` con `?code&state` → `main.teacher.js` canjea en
  `auth-with-oauth2` ANTES de arrancar el router.
- **Authorized redirect URIs en Google Cloud** deben coincidir EXACTAMENTE con
  origin+path de la página que inicia login: hoy `https://aulareto.com/teacher.html`
  (añadir ahí cualquier página/host nuevo que ofrezca el botón, p.ej. dev local).
- `meta.accessToken` de Google se guarda en sessionStorage (`ww.google.token`, ~1 h) →
  es la base para **Google Classroom** (`docs/handoff-google-classroom.md`, Fase B).
- Sesión del profe: token PB + record en localStorage `ww.pb.auth`; `authRefresh()` al
  arrancar (401/403 → limpia sesión).

## La web (cliente)

- GitHub Pages sirve la rama **`main`** del repo `duecaz/ac` → **https://aulareto.com**
  (CNAME en el repo). Por eso TODO commit se propaga a `main` (regla CLAUDE.md).
- Backends del cliente: `local` (dev) y `pocketbase` (prod, `PB_URL` en
  `pocketbase.config.js` → `https://pb.lanube.uno`).

## Estado de datos (2026-07-22)

- `activities`: **0 filas** — se descartó todo lo anterior (actividades legadas sin owner)
  para arrancar limpio con el modelo owner+author. Likes/reports también desde cero.
- Usuarios: duecaz@gmail.com (Google, `role=admin`). El resto de profes se provisionan
  (panel Profesores en `#/admin`) o entran con Google.
