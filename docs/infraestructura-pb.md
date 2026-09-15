# Infraestructura — PocketBase + Raspberry Pi (estado REAL)

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

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
| Exposición pública | túnel **cloudflared** → **directo a PocketBase `:8090`** → `https://pb.lanube.uno` |

> **EL NGINX NO ESTÁ EN EL CAMINO DE `pb.lanube.uno`** (comprobado 2026-08-25).
> Esta fila decía «cloudflared + nginx-proxy-manager», y por eso el primer intento de
> arreglar el reloj fue a editar el proxy: no habría hecho nada. La Pi SÍ tiene un
> `nginx_proxy` (jc21/nginx-proxy-manager, puerto 81) pero sirve a OTROS servicios;
> para `pb.lanube.uno` no hay ningún *proxy host* definido. Cómo se comprueba:
>
> ```bash
> docker exec nginx_proxy sh -c 'ls /data/nginx/proxy_host/; grep -rl pb.lanube.uno /data/nginx/'
> ```
> Vacío = el nginx no interviene. Además el túnel es de **token**
> (`cloudflared tunnel run --token …`), así que el enrutado NO vive en la Pi sino en
> **Cloudflare → Zero Trust → Networks → Tunnels → Public Hostnames**. Cualquier cosa
> que haya que tocar «en el servidor» para este dominio se toca en Cloudflare.

⚠️ **La Pi y este PocketBase están COMPARTIDOS con otros proyectos** (colecciones de
`aportes` y `equipos_activados` conviven en la misma instancia). NUNCA borrar/renombrar
colecciones que no sean de AulaReto, y nunca "reset" global de PB.

## Cloudflare — la puerta de `pb.lanube.uno`

Delante de la Pi hay **Cloudflare** (plan **free**), y sus ajustes son parte de la
infraestructura tanto como el contenedor: un interruptor de esa pantalla puede tirar el
modo EN VIVO sin que cambie una línea de código. Comprobado con las cabeceras:

```
curl.exe -sI https://pb.lanube.uno/api/health
→ Server: cloudflare · CF-RAY: … · cf-cache-status: DYNAMIC · alt-svc: h3=":443"
```

Panel: **dash.cloudflare.com → lanube.uno → Speed → Settings → Protocol Optimization**.

| Ajuste | Cómo debe estar | Por qué |
|---|---|---|
| **HTTP/2** | ON | Es el transporte del modo en vivo tras apagar HTTP/3. |
| **HTTP/2 to Origin** | ON | Entre Cloudflare y la Pi; no afecta al navegador. |
| **HTTP/3 (with QUIC)** | **OFF** ← apagado el 2026-08-16 | Con él encendido, Chrome abre el flujo SSE (`/api/realtime`) por QUIC y el navegador lo aborta con `ERR_QUIC_PROTOCOL_ERROR` una y otra vez: el profe y los alumnos veían cortes continuos, en las dos pantallas a la vez. **Apagarlo los eliminó por completo** (consola limpia, verificado por el dueño) — o sea que la causa era el camino QUIC, no un corte por inactividad. La app reconectaba y resincronizaba sola, así que la clase nunca perdió datos, pero el marcador iba a tirones. |
| **Enhanced HTTP/2 Prioritization** | (requiere Pro) | No disponible en free. |
| **Transform Rule · «Exponer Date (reloj de AulaReto)»** | **PUESTA el 2026-08-25** | *Response Header Transform Rule*: si `http.host eq "pb.lanube.uno"`, añade `Access-Control-Expose-Headers: Date`. **Sin ella el modo EN VIVO va con relojes distintos.** PocketBase manda `Date` en cada respuesta y `core/serverNow.js` (§22-5) la usa como hora común; pero `Date` NO es una cabecera que el navegador deje leer a otro origen salvo que el servidor lo autorice, así que la app recibía `null` y caía al reloj del aparato. Ese era el fallo que el compañero reportaba («el alumno marca 15 y el profe 20»): el arreglo estaba en el código desde v1.51.417 pero INERTE en producción. Se comprueba con `curl.exe -s -D - -o NUL -H "Origin: https://aulareto.com" https://pb.lanube.uno/api/health` — tiene que aparecer `access-control-expose-headers: Date`. |
| **0-RTT Connection Resumption** | ON | Está encendido y se deja: Cloudflare solo manda datos anticipados en peticiones GET, así que el riesgo de repetición no toca nada que escriba. Si algún día aparece un fallo raro de duplicados en lecturas, es el primer sospechoso. |

**Lo que NO se puede arreglar desde el código**: `EventSource` no permite elegir la
versión de HTTP — la negocian navegador y servidor. Lo que sí hay del lado del cliente es
`core/streamWatchdog.js`: si el flujo lleva 80 s callado, lo renueva por decisión propia
(por debajo de los ~100 s a los que Cloudflare cierra una conexión inactiva). Eso cubre el
corte por inactividad valga la causa que valga, pero NO sustituye a apagar HTTP/3.

**Al diagnosticar un corte del modo en vivo**, el dato que separa las dos causas es la
DURACIÓN de la petición `/api/realtime` en la pestaña Network: ~100 s → inactividad
(cubierto por el vigía); unos segundos → el camino QUIC (interruptor). En el caso de
2026-08-16 fue lo segundo: el interruptor lo resolvió y no hubo que medir nada más.

## MUDANZA A `api.aulareto.com` — la API bajo el dominio de la web (EN CURSO)

Decidido el 2026-09-15, después de que un profe **no pudiera entrar** en el
colegio: el filtro de su red le sustituía el certificado de `pb.lanube.uno` y
Chrome cortaba con `ERR_CERT_AUTHORITY_INVALID`, mientras `aulareto.com` cargaba
sin problema. La causa de fondo no es el certificado (es un Let's Encrypt válido,
ECDSA bajo ISRG Root X2): es que **la web y su API viven en dominios distintos**,
así que un colegio tiene que permitir DOS, y el segundo no lo reconoce ningún
filtro. Con la API bajo `aulareto.com`, permitir un dominio basta.

**NO hace falta otro PocketBase.** Es el MISMO contenedor con un segundo nombre
público en el túnel, apuntando al mismo `localhost:8090`. Los dos nombres
conviven; los otros proyectos siguen entrando por `pb.lanube.uno`.

**El interruptor ya está en el código** (`pocketbase.config.js`): `?pb=nuevo`
apunta la aplicación a `api.aulareto.com` sin cambiárselo a nadie, para probar
antes de mover el valor por defecto. Es una LISTA CERRADA de nombres, no una URL
libre: con un parámetro libre, un enlace podría apuntar la pantalla de entrar a
un servidor falso y quedarse con la contraseña del profe. Lo vigila
`tests/pbUrl.test.mjs`, verificado en rojo.

### El terreno, COMPROBADO el 2026-09-15

| Qué | Cómo está |
|---|---|
| DNS de `aulareto.com` | **GoDaddy** (`ns43/ns44.domaincontrol.com`) — NO está en Cloudflare |
| A dónde apunta | directo a **GitHub Pages** (185.199.108-111.153) |
| Registros MX | **ninguno** — no hay correo en ese dominio |
| Registros TXT | **ninguno** — no hay verificaciones que perder |
| DNS de `lanube.uno` | Cloudflare, 7 registros, todos por el túnel `raspberry` |

Eso convierte la mudanza en rutinaria: lo único que hay que preservar son los
cuatro registros A de la web (y el `www` si existe). **Hay que traer la zona a
Cloudflare** porque un túnel publica sus nombres con un registro que solo
funciona dentro del DNS de Cloudflare; desde GoDaddy no se puede crear. Las dos
salidas cortas no valen: apuntar `api.aulareto.com` a la Pi es imposible (se
expone por el túnel, sin dirección pública) y un alias de GoDaddy a un nombre de
Cloudflare falla por certificado.

**LA WEB NO CAMBIA.** Al añadir el dominio, Cloudflare importa los registros; si
se dejan todos en **«DNS only» (nube gris)**, el tráfico sigue yendo directo a
GitHub Pages igual que hoy — mismo servidor, mismo certificado, mismo
comportamiento. Solo el `api` nuevo pasa por Cloudflare, y ese SÍ va proxied
(nube naranja): es el túnel.

### Los pasos, en orden

1. **Cloudflare → Add a site → `aulareto.com`** (plan free). Deja que escanee.
2. **Revisar lo importado**: tienen que estar los cuatro A de `@` a
   185.199.108/109/110/111.153 y el `www` si lo hay. **Todos en «DNS only»**.
   Comparar contra la lista de GoDaddy antes de seguir.
3. **GoDaddy → el dominio → Nameservers → Change → Custom**: poner los dos que
   dé Cloudflare. Propagación: de minutos a unas horas.
4. **Esperar y verificar**: `nslookup -type=NS aulareto.com` tiene que devolver
   los de Cloudflare. Y comprobar que la web sigue abriendo.
5. **Añadir el nombre público** en Zero Trust → Networks → Tunnels → `raspberry`
   → Public Hostnames: `api.aulareto.com` → `http://localhost:8090`.
6. **Replicar los ajustes de zona** (las tres trampas de abajo).
7. **Probar sin mover el valor por defecto**, con el interruptor que ya existe:
   `https://aulareto.com/teacher.html?pb=nuevo#/explore` — entrar, jugar, y
   **probar el modo EN VIVO**, que es donde se ve si la regla de la hora está.
   Además, por consola:
   - `curl.exe -sI https://api.aulareto.com/api/health` → 200, `Server: cloudflare`, y **sin** `alt-svc: h3`.
   - `curl.exe -s -D - -o NUL -H "Origin: https://aulareto.com" https://api.aulareto.com/api/health` → tiene que aparecer `access-control-expose-headers: Date`.
8. **Mover el valor por defecto** en `pocketbase.config.js` (una línea) y dejar
   `pb.lanube.uno` vivo indefinidamente: lo usan otros proyectos.

### LAS TRES TRAMPAS (los ajustes de Cloudflare son POR ZONA)

| Trampa | Qué pasa si se olvida |
|---|---|
| **La Transform Rule de la hora** está escrita como `http.host eq "pb.lanube.uno"` | Con el nombre nuevo NO se aplica: la app recibe `null` en `serverNow` y el modo en vivo vuelve a tener relojes distintos entre profe y alumno (§22-5). Es el fallo que costó meses encontrar. Hay que ampliar la condición a los dos nombres. |
| **HTTP/3 (with QUIC) está OFF** en la zona `lanube.uno` | En la zona nueva viene ENCENDIDO de fábrica. Con él, Chrome abre el flujo SSE por QUIC y lo aborta una y otra vez: cortes continuos en las dos pantallas. |
| **El resto de Protocol Optimization** (HTTP/2 ON) y `0-RTT` | Mismo motivo: no se heredan de la otra zona. |

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
| `activities` | `data` (json 2MB), `visibility` (`public`/`unlisted`), `tags`, `language`, `owner` (id del profe) | `created`/`updated` REPARADOS el 2026-08-11 (ver quirks). El JSON `data` lleva la actividad completa, incluido `author {id,name,signedAt}` denormalizado para las tarjetas. |
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
- `users` (**ALTA REABIERTA 2026-08-11**; U1 la había cerrado): view = uno mismo o admin;
  list = solo admin; **create = abierto SI el cuerpo no trae `role`**
  (`@request.body.role:isset = false || @request.auth.role='admin'`) → el profe se
  registra desde `#/registro` con correo+clave, y nadie puede registrarse con rol.
  Google sigue igual (OAuth no pasa por createRule). Las cuentas de pizarra las sigue
  pudiendo crear el admin (panel Profesores). **APLICADA Y PROBADA en la Pi el
  2026-08-11** (alta sin `role` → 200 · alta con `role` → 400).
  Se aplica con una de las dos herramientas (el panel `#/admin` NO toca `users`
  a propósito: tocar el esquema de auth desde el navegador puede dejarte sin
  entrar) — la regla se declara UNA vez en `core/pbRules.js` (`USERS_RULES`) y
  `tests/pbRules.test.mjs` comprueba que las tres copias coinciden:
  ```bash
  ssh duecaz@pio.local
  git -C ~/ac pull && bash ~/ac/tools/pb-reglas-users.sh   # aplica, PRUEBA la puerta y limpia
  ```
  (En Windows: `.\tools\setup-pocketbase.ps1`, que hace lo mismo entre otras cosas.)
  ✅ SMTP CONFIGURADO Y PROBADO (2026-08-13): Brevo, `smtp-relay.sendinblue.com`
  puerto 587, remitente `duecaz@gmail.com`. Se hizo con `bash ~/ac/tools/pb-smtp.sh`,
  que guarda los ajustes y ENVÍA un correo real — el correo llegó. Con esto quedó
  activado «¿Olvidaste tu contraseña?» en el modal de entrar (`views/loginModal.js`).
  Dos cosas que costaron una vuelta cada una y están cosidas en el script:
  el host **NO** es `smtp-relay.brevo.com` (su certificado sigue emitido para
  `*.sendinblue.com` y la conexión se cae con un `x509` antes de enviar), y el
  remitente se limpia de caracteres invisibles antes de mandarlo (PocketBase solo
  sabe decir «Must be a valid email address» sobre un correo que a la vista es
  correcto). PENDIENTE si se quiere `noresponder@aulareto.com`: verificar el
  dominio en Brevo con sus registros DNS.

### Quirks de PB 0.23 que YA nos mordieron (no repetir)

- **Los autodate `created`/`updated` hay que DECLARARLOS** (y faltaban en 7 colecciones —
  RESUELTO 2026-08-11, v1.51.438). En PB ≥0.23 no son campos de sistema: una colección
  creada por API sin declararlos se queda sin ellos. El panel los declara al CREAR desde
  v1.51.2xx, pero al REPARAR una colección existente los excluía igual que en <0.23 (donde
  declararlos sí revienta), así que **las colecciones viejas no se arreglaban nunca**.
  - Estaban sin ellos: `activities`, `results`, `live_sessions`, `assignments`,
    `assignment_attempts`, `activity_likes`, `reports`. Las creadas después (`live_answers`,
    `live_players`, `live_claims`, `live_keys`, `profiles`) sí los tenían.
  - **Qué rompía, en silencio**: sin `updated` en la respuesta del PATCH, el sello de
    apertura de §22-1 NI SE INTENTABA (`noteItemOpened` sale por `!rec.updated`), así que el
    tiempo de una carrera caía al `ms` que AFIRMA el móvil. Y los listados que ordenan por
    fecha (`listSessions`, `listResults`, `listReports`) caían a "sin orden".
  - **Cómo se cazó**: el botón `#/admin` → «Probar carrera» (`core/raceE2e.js`), que mira el
    sello y, si falta, comprueba si la fila trae `updated` y lo dice. Antes se veía como
    "los dos alumnos empatan en tiempo".
  - **Arreglo**: `core/pbSchema.js camposQueFaltan()` — en ≥0.23 los autodate SÍ se reparan;
    en <0.23 se siguen excluyendo. Vigilado por `tests/pbSchema.test.mjs`.
  - Los cuatro apaños "por si la colección no tiene el campo" (`listSessions`,
    `listResults`, `listReports`, `listPublicActivities`) **se quedan**: protegen a otra
    instalación que aún no haya aplicado el panel. `activities` ya no debería romper con
    `sort=-created`, pero el orden en cliente por `data.updatedAt` funciona y no depende del
    servidor: si alguien quiere volver al sort del servidor, que lo pruebe antes.
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
