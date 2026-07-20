# Login con Google + Google Classroom — guía de configuración

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

## Fase B — Enviar tareas a Google Classroom (siguiente)
Base ya lista: tras el login, `getGoogleAccessToken()` da el token de Google.
Plan (cuando lo abordemos):
1. **Scopes**: añadir en PB/Google el scope
   `https://www.googleapis.com/auth/classroom.coursework.students` (crear tareas) y
   `.../auth/classroom.courses.readonly` (listar cursos). Son "sensibles" → en modo
   Testing con tus usuarios de prueba NO requieren verificación; para abrirlo a
   cualquier profe, sí hay que verificar la pantalla de consentimiento.
2. **Reparto como canal** (simple, reutiliza tus `assignments`): en la vista de
   tarea, botón "Enviar a Classroom" → `GET courses` (elegir curso) →
   `POST courses/{id}/courseWork` con un `link` a `student.html#/task/:code`. El
   alumno abre desde Classroom y cae en el flujo de tarea de siempre. Sin sincronizar
   listas ni notas al principio.
3. **Caducidad del token** (~1 h): para envíos en la misma sesión, directo con el
   token del login. Para envíos en diferido / robustos → **hook JS server-side en tu
   PocketBase** (pb_hooks) que refresque el token de Google y llame a Classroom; así
   el refresh token no vive en el navegador. Tú controlas la Pi → viable.
4. **Grade passback** (devolver notas a Classroom): fase posterior, más scopes.
