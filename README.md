# AC — plataforma de actividades (Wordwall + un concurso)

Plataforma de actividades educativas en **JS vanilla (ES Modules)**, sin bundler,
desplegada en **GitHub Pages** con **PocketBase** como backend. Una misma actividad
(contenido como dato) se juega en varios **modos**:

- **Individual** — un dispositivo, sin red, puntuación local (estilo Wordwall).
- **VS (duelo)** — dos alumnos compiten en la misma pantalla (carrera).
- **Equipos** — por turnos en pantalla compartida (auto o juez docente); Memoria juega su variante nativa.
- **En vivo** — sala con código/QR, alumnos en sus móviles (estilo concurso).
- **Tarea** — asignación asíncrona con intentos.

Qué modo ofrece cada actividad se **deriva** de la plantilla — contrato y reglas
en **`docs/modos-de-juego.md`** (es la fuente única; el gateo vive en `core/modes.js`).

## Stack
HTML + CSS + JS vanilla (ES Modules). Bootstrap 5.3 + Bootstrap Icons por CDN.
PocketBase (`pb.lanube.uno`): auth email/password (`core/auth.js`), id anónimo
(`core/identity.js`), colecciones para activities/results/live/tareas/reportes.
Imágenes inline como data-URL en el JSON (sin storage externo). Sin bundler. GitHub Pages.

## Páginas
- `teacher.html` (`main.teacher.js`) — crear/editar/jugar/lanzar, reportes, tareas.
- `student.html` (`main.student.js`) — unirse a En vivo / hacer una Tarea.
- `embed.html` (`main.embed.js`) — incrustar una actividad.

## Plantillas
quiz · match (emparejar) · memory · tildes · comas · math · wheel (ruleta) ·
crossword · wordsearch · ballsort · question-live · diagram (etiqueta el diagrama) ·
globos (explota globos — mismo contenido que Quiz, mecánica de globos) ·
colorear · tangram · puzzle (rompecabezas) — los tres JUEGOS de inicial, `docs/handoff-juegos-inicial.md`.
Cada una es autocontenida en `templates/<name>/`. Añadir una: **`templates/HOW_TO_ADD.md`**
(no se toca el core; el registro valida el contrato y falla ruidosamente).

## Local
```bash
cd ac
python3 -m http.server 8000
# Profesor: http://localhost:8000/teacher.html
# Alumno:   http://localhost:8000/student.html
```
En `localhost` el backend es **`local`** (offline). Forzar: `ww.setBackend('local'|'pocketbase')`
en consola y recargar. Detalles: **`docs/dev-local.md`**.

## Tests
```bash
node tests/run.mjs      # núcleo puro: registry, modes, motor de sesión, contenido, live…
```
Lo no automatizable aquí (render DOM / táctil) se verifica en navegador.

## Estructura
```
core/        router, storage, migrate, registry, modes, skins, sounds, auth, identity…
kernel/      session/ (motor vs·teams·solo·live), content/ (modelos + conversores)
templates/   quiz, match, memory, tildes, comas, math, wheel, crossword, wordsearch,
             ballsort, question-live, diagram, globos, colorear, tangram, puzzle  (+ HOW_TO_ADD.md)
views/       home, editView, playerView, antesala, vsView, teamsView, hostLive…
adapters/    backend intercambiable: local (offline) · pocketbase (prod)
styles/      theme, player, quiz, vs, teams, memory, live…
themes/      skins con CSS propio (colegios, tv-show, arcade)
docs/        modos-de-juego.md, panorama-actividades.md, modo-wordwall.md, dev-local.md, auditoria-*.md
```

## PocketBase (backend)
Backend en **PocketBase** (`pb.lanube.uno`, Docker en una Raspberry Pi 5). Maneja
activities, results, live sessions, tareas (assignments), reportes y auth
(email/password en `core/auth.js`). Las imágenes van **inline** como data-URL en
el JSON de la actividad (límite ~200 KB) — sin storage externo. El backend `local`
es para desarrollo offline. (Supabase fue **retirado**; ya no se usa en ninguna ruta.)

> Versión actual: ver `core/constants.js` (`VERSION`).

## Modelo de datos — cada actividad tiene DUEÑO
> Fuente de verdad: `core/pbRules.js` (las reglas que se aplican en PocketBase) y
> `adapters/pocketbase/remoteStore.js`. Si esto y el código discrepan, manda el
> código — y corrige este párrafo.

Cada actividad lleva un **`owner`** (el id del profe que la creó) y una
**`visibility`**:

| Quién | Qué puede |
|---|---|
| cualquiera, sin cuenta | **ver y jugar** una actividad `public` (por URL, sin login) |
| el dueño | ver las suyas sean o no públicas, editarlas y borrarlas |
| admin | lo mismo que el dueño, sobre cualquiera |
| cualquiera, sin cuenta | **crear: no.** Crear exige sesión, y el `owner` que se
  envía tiene que ser el tuyo (no se crea a nombre de otro) |

Es decir: **la privacidad por cuenta YA existe** — una actividad que no es
`public` solo la ve su dueño. «Publicar» es una acción aparte y con condición: la
actividad tiene que estar jugable (`decidirVisibilidad`, `core/activityCheck.js`).

Ojo con un nombre parecido: **`author_id` no es el dueño de una actividad**. Vive
en las **tareas** (`assignments`) y guarda el id ANÓNIMO del navegador que la
creó, para que un profe sin cuenta pueda gestionar la tarea que acaba de repartir
(ver `core/assignmentRules.js`).

Lo que **sí** sigue siendo cierto del texto viejo: jugar no depende de la
identidad del navegador, así que limpiar la caché no pierde nada — `sync()`
repuebla desde la nube lo que tu cuenta puede ver.

Estado de las reglas: escritas y probadas en código (`tests/pbRules.test.mjs`);
aplicarlas en la Pi es un paso manual pendiente — ver `docs/handoff-seguridad-pb.md`.
