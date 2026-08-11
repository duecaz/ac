# Login con Google + Google Classroom — guía de configuración

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> **Fase A (login con Google) IMPLEMENTADA en código (v1.51.215).** Funciona en
> cuanto configures Google Cloud + PocketBase (abajo). Fase B (enviar tareas a
> Classroom) es el siguiente paso, ya con base montada.

## Qué hace el código (Fase A)
- Botón **"Entrar con Google"** en la barra superior (`core/authWidget.js` → `#ww-auth-slot`).
- Flujo OAuth2 por redirección contra PocketBase (`core/auth.js`:
  `startOAuthLogin` → Google → vuelve a `teacher.html?code&state` →
  `completeOAuthLogin` canjea el code en PB). Sin SDK, REST puro.
- El `client_secret` de Google **NUNCA** toca el navegador: PB hace el intercambio.
- Al loguear, se guarda la sesión PB (`ww.pb.auth`) → `getAuthUserId()` alimenta el
  campo `owner` de las actividades (activa la seguridad de Fase 1) — y el
  `accessToken` de Google queda en `sessionStorage` (`getGoogleAccessToken()`) para
  la Fase B (Classroom).

## PASO 1 — Google Cloud (una vez, tú)
1. https://console.cloud.google.com → crea un proyecto (p.ej. "AulaReto").
2. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo: **Externo**. Modo **Testing** (así NO necesitas verificación de Google).
   - Añade tu(s) email(s) de profe en **Usuarios de prueba** (hasta ~100).
   - Scopes: para Fase A basta `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `openid` (los pone Google por defecto). Los de Classroom se añaden en Fase B.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - **Orígenes autorizados de JavaScript**:
     - `https://aulareto.com`
     - (dev) `http://localhost:8099`  ← el puerto que uses en local
   - **URIs de redireccionamiento autorizados** (EXACTOS, con `/teacher.html`):
     - `https://aulareto.com/teacher.html`
     - (dev) `http://localhost:8099/teacher.html`
   - Copia el **Client ID** y el **Client secret**.

## PASO 2 — PocketBase (una vez, en tu Pi)
1. Entra al panel admin de PB (pb.lanube.uno) como superusuario.
2. **Settings → Auth providers → Google → Enable**.
3. Pega **Client ID** y **Client secret**. Guarda.
   - (No hace falta configurar redirect en PB: el flujo usa la redirect URL de la
     app, que registraste en Google. PB solo canjea el code.)
4. Asegúrate de que la colección `users` tiene el auth habilitado (viene por defecto).

## PASO 3 — Probar
1. Abre https://aulareto.com/teacher.html → pulsa **"Entrar con Google"**.
2. Elige tu cuenta (debe estar en Usuarios de prueba) → acepta.
3. Vuelves a la app logueado: la barra muestra tu nombre + "Salir".
4. Crea/guarda una actividad → ahora se guarda con `owner = tu id`.
5. (Tras aplicar las reglas de Fase 1 y el backfill — ver `handoff-seguridad-pb.md`)
   una sesión SIN login no podrá editar/borrar esa actividad (403).

### Si algo falla
- **"redirect_uri_mismatch"**: la URI de la app no coincide EXACTA con la registrada
  en Google (revisa `http` vs `https`, el puerto, y `/teacher.html`).
- **"El proveedor google no está habilitado"**: falta el paso 2 en PB.
- **403/access_denied**: tu email no está en Usuarios de prueba (paso 1.2).

---

## Fase B — Enviar tareas a Google Classroom ✅ IMPLEMENTADA (v1.51.229)

### Qué hace el código
- Botón **"Classroom"** en cada tarea abierta (`views/assignments.js`) → lista tus
  cursos activos → eliges uno (`core/coursePicker.js`) → publica una tarea con
  **enlace** a `student.html#/task/:code`. El alumno la abre desde Classroom y cae en el
  flujo de tarea de siempre. Sin sincronizar listas ni notas (eso es fase posterior).
- `core/classroom.js`: `listCourses()` + `createCourseworkLink(courseId, {...})` contra
  `classroom.googleapis.com`. Parte la fecha límite en `dueDate`+`dueTime` (UTC).

### El punto CLAVE — los scopes (por qué NO basta el login)
El token del login de PocketBase solo trae `email`/`profile`/`openid` (PocketBase pide
scopes fijos para Google; no reenvía los de Classroom). Por eso Classroom usa
**autorización incremental con Google Identity Services (GIS)**
(`core/classroomAuth.js`): la primera vez que pulsas "Classroom", Google pide aparte el
consentimiento de estos scopes y cachea ese token ~55 min en sessionStorage:
- `https://www.googleapis.com/auth/classroom.courses.readonly` (listar cursos)
- `https://www.googleapis.com/auth/classroom.coursework.students` (crear tareas)

### Config necesaria (una vez, tú)
1. **`pocketbase.config.js` → `GOOGLE_CLIENT_ID`**: pon tu Client ID público
   (`…apps.googleusercontent.com`, el mismo del login). Vacío = el botón avisa de que
   falta configurarlo. (Es público, no es el secret — no pasa nada por commitearlo.)
2. **Google Cloud → APIs y servicios**:
   - **Habilita la API "Google Classroom API"** en la biblioteca de APIs.
   - **Pantalla de consentimiento → Scopes**: añade los dos scopes de Classroom de
     arriba. Son "sensibles": en modo **Testing** con tus usuarios de prueba funcionan
     SIN verificación de Google; para abrirlo a cualquier profe (Producción) hay que
     verificar la pantalla de consentimiento.
   - **Orígenes autorizados de JavaScript** del cliente OAuth: debe estar
     `https://aulareto.com` (GIS usa el origin, no una redirect URI).
3. Listo: entra normal (Google), crea una tarea y pulsa **Classroom** → acepta el
   permiso extra la primera vez → elige curso → publicada.

### Notas
- Errores claros: sin `GOOGLE_CLIENT_ID` → avisa; 401/403 por scopes → fuerza el
  consentimiento y reintenta una vez; sin cursos → lo dice.
- **Caducidad**: para envíos en la misma sesión, directo. Para envíos en diferido /
  robustos → hook JS en la Pi (`pb_hooks`) que refresque el token de Google server-side
  (el refresh token no viviría en el navegador). Tú controlas la Pi → viable a futuro.
- **Grade passback** (devolver notas a Classroom): fase posterior, más scopes.
