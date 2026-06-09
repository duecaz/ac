# AC — plataforma de actividades (Wordwall + Kahoot)

Plataforma de actividades educativas en **JS vanilla (ES Modules)**, sin bundler,
desplegada en **GitHub Pages** con **Supabase** como backend. Una misma actividad
(contenido como dato) se juega en varios **modos**:

- **Individual** — un dispositivo, sin red, puntuación local (estilo Wordwall).
- **VS (duelo)** — dos alumnos compiten en la misma pantalla (carrera).
- **Equipos** — por turnos en pantalla compartida (auto o juez docente); Memoria juega su variante nativa.
- **En vivo** — sala con código/QR, alumnos en sus móviles (estilo Kahoot).
- **Tarea** — asignación asíncrona con intentos.

Qué modo ofrece cada actividad se **deriva** de la plantilla — contrato y reglas
en **`docs/modos-de-juego.md`** (es la fuente única; el gateo vive en `core/modes.js`).

## Stack
HTML + CSS + JS vanilla (ES Modules). Bootstrap 5.3 + Bootstrap Icons por CDN.
Supabase (auth anónima + Postgres con RLS, esquema `repo_ac` + Edge Functions).
Sin bundler. GitHub Pages.

## Páginas
- `teacher.html` (`main.teacher.js`) — crear/editar/jugar/lanzar, reportes, tareas.
- `student.html` (`main.student.js`) — unirse a En vivo / hacer una Tarea.
- `embed.html` (`main.embed.js`) — incrustar una actividad.

## Plantillas
quiz · match (emparejar) · memory · tildes · comas · math · wheel (ruleta).
Cada una es autocontenida en `templates/<name>/`. Añadir una: **`templates/HOW_TO_ADD.md`**
(no se toca el core; el registro valida el contrato y falla ruidosamente).

## Local
```bash
cd ac
python3 -m http.server 8000
# Profesor: http://localhost:8000/teacher.html
# Alumno:   http://localhost:8000/student.html
```
En `localhost` el backend es **`local`** (sin Supabase). Forzar: `ww.setBackend('local'|'supabase')`
en consola y recargar. Detalles: **`docs/dev-local.md`**.

## Tests
```bash
node tests/run.mjs      # núcleo puro: registry, modes, motor de sesión, contenido, live…
```
Lo no automatizable aquí (render DOM / táctil) se verifica en navegador.

## Estructura
```
core/        router, storage, supabase, migrate, registry, modes, skins, sounds…
kernel/      session/ (motor vs·teams·solo·live), content/ (modelos + conversores)
templates/   quiz, match, memory, tildes, comas, math, wheel  (+ HOW_TO_ADD.md)
views/       home, editView, playerView, modeSetup, vsView, teamsView, memoryView, hostLive…
adapters/    backend intercambiable: local · supabase · pocketbase(stub)
styles/      theme, player, quiz, vs, teams, memory, live…
supabase/    migrations/ + Edge Functions (settle-item)
docs/        modos-de-juego.md, panorama-actividades.md, modo-wordwall.md, dev-local.md, auditoria-*.md
```

## Supabase (setup, una vez)
1. Pages: repo `duecaz/ac` → Deploy from branch `main` / `(root)`.
2. Esquema `repo_ac` aplicado en el proyecto `www` (`klecbdjbrsyshjqzdxhw`) y **expuesto** en API → Exposed schemas.
3. **Anonymous Sign-Ins** activo (Auth → Providers).
4. Bucket `media` (público, 5MB máx).

> Versión actual: ver `core/constants.js` (`VERSION`).
