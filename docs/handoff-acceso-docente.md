# HANDOFF — Plan de usuarios y acceso docente (endurecer · PIN · NFC · pizarras)

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Estado: **PLAN aprobable** (2026-07-22). Cierra el sistema de usuarios que empezó en
> `handoff-biblioteca-publica.md` (S1–S3 hechos) y añade lo que faltaba: acceso FÁCIL del
> docente en pizarras interactivas (PIN numérico y tarjeta NFC), panel de profesores
> completo y el endurecimiento final de reglas. Infra real: `docs/infraestructura-pb.md`.

## 0. Auditoría honesta del sistema actual (qué está bien, qué no)

### Bien (verificado en código, 2026-07-22)
- Login Google (OAuth por redirección, state anti-CSRF, secret solo en PB) ✓
- Correo+contraseña para pizarras ya FUNCIONA (modal "o con correo" + createTeacher) ✓
- Almacén por usuario + claim de anónimas + tombstones + `_unsynced` optimista ✓
- `owner` (permiso, columna PB) separado de `author` (visual, dentro del JSON) ✓
- Rol admin unificado (`role='admin'`, sin contraseña 'fernando') + moderación + reportes ✓
- Likes con índice único (activity,user); conteo público, voto con sesión ✓
- Sin `sort` server-side sobre activities (quirk PB documentado); filtros con pbEscape ✓

### Fallos/huecos REALES detectados (por prioridad)
1. **Cualquiera puede crear cuenta y publicar** — `users.createRule` abierto + botón
   "¿No tienes cuenta? Crear una" en el modal. Para una biblioteca curada de colegio es
   la puerta al spam. → U1 lo cierra (alta por admin o Google solamente).
2. **`activities.createRule` abierto + cláusula `owner=''`** — un anónimo puede crear
   filas, y cualquier fila sin owner la puede editar/borrar CUALQUIERA. Con la BD limpia
   ya no hay legadas que proteger → U1 endurece sin coste.
3. **"Probar" en Explorar CLONA a PB** (`views/explore.js exp-play`): cada visitante
   anónimo que pulsa Probar crea una copia `unlisted` en el servidor (save→remoteSave
   anónimo). Basura acumulándose. → U1: jugar la vista previa SOLO en local (sin subir),
   y de paso el endurecimiento del create la bloquearía igualmente.
4. **El nombre del autor nunca se refresca**: `save()` solo sella `author` si no existe;
   si el profe se renombra, sus tarjetas viejas quedan con el nombre antiguo. → U2: si
   `author.id === uid`, refrescar `author.name` en cada save.
5. **`createTeacher` no firma con el token del admin** (`pbPost` sin Authorization) — hoy
   funciona porque el create de users es público; al cerrarlo en U1 hay que mandarlo
   autenticado o se rompe el panel Profesores.
6. Menores/conocidos: `results`/`live_*` siguen 100% abiertas (alumno puede falsear
   resultados — deuda de la auditoría Fable, pase aparte); `fetchLikeCounts` trunca a 500
   likes totales (tope de escala, no de corrección); token PB en localStorage (aceptado:
   la defensa es la disciplina `escapeHtml`, ya auditada); cuentas correo sin verificación
   de email (aceptable: las crea el admin).

## 1. Métodos de acceso (visión completa)

| Método | Dónde | Estado | Seguridad |
|---|---|---|---|
| Google OAuth | equipo del profe / móvil | ✅ hecho | fuerte (la de Google) |
| Correo + contraseña | pizarras, sin Google | ✅ hecho (provisiona admin) | media (contraseña ≥8) |
| **PIN numérico** (elige tu nombre → tecleas 4-6 dígitos) | pizarras | 🔜 U3/U4 | débil por diseño → SOLO con rate-limit server-side |
| **Tarjeta NFC** (acercar tarjeta al lector) | pizarras | 🔜 U3/U4 | conveniencia; UID clonable → revocable, nunca para admin |
| Código de vinculación (el móvil del profe aprueba la pantalla) | pizarras | opcional U6 | fuerte; el más "pro" |

**Principio**: PIN y NFC son credenciales de *conveniencia de aula*. Dan sesión normal de
profe (crear/editar SUS actividades). Un compañero que vea el PIN puede entrar como él —
riesgo asumible en un colegio y revocable. Lo que NO deben dar jamás es superficie de
administración: **la cuenta admin (duecaz) no debe tener PIN/NFC habilitado**, o si lo
tiene, el endpoint emite la sesión con el rol degradado (ver U3).

## 2. Fases

### FASE U1 — Endurecer reglas + cerrar signup (sin UI nueva; 1 commit + comandos Pi)
1. `activities`: `createRule: "@request.auth.id != '' && owner = @request.auth.id"`;
   quitar `owner = ''` de list/view/update/delete (queda
   `visibility='public' || owner=@request.auth.id || @request.auth.role='admin'`).
2. `users`: `createRule: "@request.auth.role = 'admin'"` (solo el admin da de alta por
   correo; Google sigue creando su propio user — OAuth NO pasa por createRule en PB…
   **VERIFICAR en 0.23**: si sí pasa, dejar `createRule` abierto pero quitar el botón de
   signup del modal y compensar con el punto 4).
3. Cliente: quitar "Crear una" del `loginModal` (signup público fuera); `createTeacher`
   manda `Authorization` del admin; `pbFetch` ya propaga el error si el token caducó (el
   fallback anónimo pasará a fallar → correcto, el profe ve "vuelve a entrar").
4. Red de seguridad anti-spam aunque el create de users quede abierto por OAuth: los
   profes nuevos SIN rol no aparecen en ningún listado y sus actividades públicas pueden
   moderarse (#/moderar). Opcional: campo `approved` bool y filtro en la portada.
5. "Probar" de Explorar: jugar sin subir (guardar la copia solo si NO hay `remoteSave`,
   o marcar `_localOnly` que remoteSave respeta).
6. Actualizar `tools/setup-pocketbase.ps1` + DEFS de `adminView.js` (misma fuente),
   correr setup, `check-pb.sh` ampliado con 2 checks: create anónimo de activities
   DEBE fallar (403) y update de fila ajena DEBE fallar.

### FASE U2 — Panel del profe "Mi acceso rápido" (web, sin servidor nuevo)
Página `#/perfil` (o sección en `#/mine`): nombre visible (con refresco de `author.name`
en save — fallo 4), y la gestión de acceso rápido: **crear/cambiar mi PIN** (4-6 dígitos,
teclado grande), **registrar mi tarjeta NFC** (campo que captura el UID del lector),
**activar/desactivar** mi aparición en la pantalla de pizarras, y botón "revocar todo".
Guarda en `users`: `pin_hash` (hidden), `pin_salt` (hidden), `nfc_uid` (hidden, índice
único), `quick_login` (bool). *Hidden* de PB = jamás se serializa a clientes.

### FASE U3 — pb_hooks en la Pi (el único trozo de servidor; es 1 archivo JS)
La imagen muchobien soporta montar `pb_hooks/`. Un archivo `pb_hooks/aulareto.pb.js`:
- `GET  /api/aulareto/teachers` → lista `{id, name, avatar}` SOLO de users con
  `quick_login=true` (opt-in → sin fuga de la lista completa de usuarios).
- `POST /api/aulareto/pin-login {userId, pin}` → verifica hash+salt, y si ok emite token
  de sesión PB para ese user (`$tokens.recordAuthToken` — verificar API exacta 0.23).
- `POST /api/aulareto/nfc-login {uid}` → busca `nfc_uid`, emite token.
- **Rate-limit en memoria**: máx 5 intentos/min por IP y por userId, lockout 10 min tras
  10 fallos. Sin esto un PIN de 4 dígitos se fuerza en minutos — el rate-limit ES la
  seguridad del PIN, no el hash (10⁴ combinaciones no dan entropía).
- Si el user tiene `role='admin'`: el endpoint **rechaza** PIN/NFC (login fuerte
  obligatorio para admin).
- Despliegue: añadir el mount al compose (`./pb_hooks:/pb_hooks`), reiniciar contenedor,
  smoke-check nuevo en `check-pb.sh`.

### FASE U4 — Pantalla de acceso para pizarras (web)
Ruta `#/pizarra` (enlace "Entrar en una pizarra" en el modal): rejilla de tarjetas
grandes con avatar+nombre (de `/api/aulareto/teachers`) → tocas tu nombre → teclado
numérico gigante para el PIN → dentro. En esa pantalla, SIEMPRE activo un capturador de
lector NFC (ver §3): "…o acerca tu tarjeta 💳". Botón alternativo "entrar con correo o
Google" para quien lo prefiera.

### FASE U5 — Panel Profesores completo (admin, web)
En `#/admin`: tabla de users (nombre, email, rol, ¿PIN?, ¿tarjeta?, nº de actividades),
acciones: crear (ya está), **dar/quitar admin**, resetear PIN, desasignar tarjeta,
desactivar cuenta. Todo con el token del admin (list de users ya es admin-only).

### FASE U6 (opcional, después) — Código de vinculación
La pizarra muestra un código de 6 letras (colección `login_codes`, TTL 2 min); el profe,
logueado en su móvil, teclea/escanea y aprueba → hook canjea el código por un token para
la pizarra. Es el flujo más seguro (nada que teclear en público, nada clonable); vale la
pena si el PIN genera fricción o dudas.

### FASE S4 — Classroom (sin cambios, `handoff-google-classroom.md`)
Independiente de esto; solo requiere sesión Google (ya guardamos `meta.accessToken`).

## 3. Consejos NFC (hardware y captura) — leído ANTES de comprar

- **Contexto confirmado por el usuario**: las pizarras son **táctiles con lector NFC
  integrado** → esto cambia el plan A. Si el navegador de la pizarra es **Chrome sobre
  Android**, **Web NFC (`NDEFReader`) pasa a ser el plan A** (nativo, sin hardware extra):
  `new NDEFReader().scan()` y en el evento leer `serialNumber` (el UID) → `nfc-login`.
  Requiere HTTPS (lo tenemos) y un gesto del usuario para pedir permiso NFC.
- **Plan B universal — lector USB que emula TECLADO (HID)**: para pizarras que NO sean
  Android/Chrome (Windows, WebView raro). "Acerca la tarjeta y el lector *teclea* el UID +
  Enter"; funciona en cualquier OS/navegador sin drivers. 13.56 MHz (Mifare/NTAG) con
  "keyboard emulation". La app detecta la ráfaga rápida de teclas (§captura).
- **Detección**: probar `('NDEFReader' in window)` → si existe, ofrecer "acerca tu
  tarjeta" con Web NFC; si no, el capturador de teclado HID queda activo de fondo. Así la
  misma pantalla `#/pizarra` cubre ambos tipos de pizarra sin que el docente elija nada.
- **Captura en la app** (`#/pizarra`): sin input visible — un buffer global de teclas que
  detecta "ráfaga rápida de [0-9a-f] terminada en Enter" (los HID teclean a <30 ms/tecla,
  un humano no) → eso dispara `nfc-login` sin que el docente toque nada.
- **El UID NO es un secreto**: se clona con un lector de 10 €. Tratarlo como llave de
  aula: cómodo, revocable (desasignar tarjeta en U2/U5), jamás para admin. Si algún día
  se quiere de verdad seguro: tarjetas NTAG con firma/contador, o UID+PIN corto (2FA de
  aula) — pero para el caso de uso real (ahorrarle 20 segundos al docente delante de la
  clase) el UID pelado + revocación es el equilibrio correcto.
- Consejo práctico: registrar la tarjeta desde la MISMA pantalla con el mismo lector
  (U2 pide "acerca la tarjeta ahora") — así nunca hay que teclear UIDs a mano.

## 4. Orden recomendado y tamaño

| Fase | Tamaño | Depende de |
|---|---|---|
| U1 endurecer + cerrar signup + fix Probar | S (1 sesión) | BD limpia ✅ |
| U2 panel Mi acceso rápido | M | U1 |
| U3 pb_hooks (PIN/NFC/teachers + rate-limit) | M (1 archivo + compose) | U2 (campos) |
| U4 pantalla pizarras | M | U3 |
| U5 panel Profesores completo | S-M | U1 |
| U6 vinculación por código | M | U3 |

U1 es la única con riesgo de romper algo existente (reglas) → hacerla con `check-pb.sh`
ampliado y prueba manual de: crear con Google ✓, editar propia ✓, editar ajena ✗,
anónimo crear ✗, panel Profesores crea cuenta ✓.

## 5. Reglas de ejecución (las de siempre)

- Cada fase: subir `VERSION`, `node tests/run.mjs`, commit → push rama + `main` (+
  `ACTIVIDAD2`). Reglas nuevas de PB = actualizar `adminView.js` DEFS **y**
  `setup-pocketbase.ps1` **y** `check-pb.sh` **y** `infraestructura-pb.md` (mismo commit).
- Comandos de Pi: Claude los redacta, el usuario los ejecuta; credenciales con `read -rsp`,
  nunca en el chat.
