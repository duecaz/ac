# Desarrollo local (offline, sin backend)

La app elige backend automáticamente: en **localhost** usa el backend **`local`**
(localStorage para datos + un driver realtime sobre `BroadcastChannel` para
LIVE). En producción (`*.github.io`) usa **PocketBase** (`pb.lanube.uno`), sin
cambios. Puedes forzar el backend en cualquier sitio con la consola del navegador:

```js
ww.setBackend('local')     // o 'pocketbase'  → recarga la página después
```

## Arrancar
```bash
cd ac
python3 -m http.server 8000
# Profesor:  http://localhost:8000/teacher.html
# Alumno:    http://localhost:8000/student.html
```

## Probar el modo Wordwall (SOLO) — 1 pestaña
1. `teacher.html` → **Nueva** → elige *Quiz* (u otra plantilla) → añade preguntas → Guardar.
2. En la página de la actividad, la **pantalla de inicio** muestra título +
   instrucciones + ajustes (sonido/efectos, y "Calibrar pizarra" en Tildes/Comas).
   **Iniciar** entra en pantalla completa y arranca.
3. En el editor, prueba **Cambiar formato** (p. ej. Quiz → Ruleta) y verifica que el
   contenido se conserva.

> Todo SOLO funciona 100% offline contra el backend `local`.

## Probar el modo LIVE (Kahoot) — 2 pestañas, sin red
> Importante: usa **dos pestañas del MISMO navegador** (comparten `localStorage` y
> `BroadcastChannel`). El driver `local` da a cada pestaña un `userId` distinto, así que
> el host y el alumno son jugadores diferentes.

1. **Pestaña A (Profesor)**: `teacher.html` → abre una actividad **Quiz** → **En vivo**.
   Aparece el código de sala (PIN).
2. **Pestaña B (Alumno)**: `student.html` → **Unirse** → escribe el PIN y un apodo.
   - El host (Pestaña A) debería ver al alumno aparecer en el lobby.
3. **Pestaña A**: inicia la partida. La Pestaña B pasa a la pregunta.
4. **Pestaña B**: responde. **Pestaña A**: pulsa **revelar** → se puntúa → leaderboard.
   Avanza a la siguiente.
5. Repite hasta terminar; comprueba el podio final.

## Probar el modo ASYNC (tareas) — offline
1. **Profesor** (`teacher.html`): abre una actividad → **Tareas** → crea una tarea
   (define intentos y fecha límite). Aparece un código.
2. **Alumno** (`student.html`): **Unirse** con ese código (o abre `#/task/<code>`) →
   escribe tu apodo → juega SOLO a tu ritmo. Al terminar queda registrado el intento.
3. Reintenta: al agotar `max_attempts` la tarea se bloquea. El profesor ve los intentos.
> En localhost todo corre contra el backend `local` (offline).

### Qué NO cubre el modo local
- El driver `local` simula realtime entre pestañas del mismo navegador; **no**
  sincroniza entre dispositivos distintos (para eso es PocketBase).
- La concurrencia real del blob `state` de `live_sessions` (30 alumnos
  respondiendo a la vez contra PocketBase) no se ejercita en local — es la deuda
  "lost-update" documentada en `CLAUDE.md`.

## Probar contra PocketBase de verdad
El backend de producción es una instancia PocketBase (`pb.lanube.uno`, definida en
`pocketbase.config.js`). Para probar contra ella desde localhost:
```js
ww.setBackend('pocketbase')   // en consola → recargar
```
Las colecciones (`live_sessions`, `assignments`, `assignment_attempts`) se crean
una sola vez desde `#/admin` → "PocketBase — configuración de colecciones"
(pide email+contraseña de admin de la instancia).

## Tests
```bash
node tests/run.mjs    # lógica pura: core, contenido, adapters, SOLO, LIVE…
```
El mapa completo de suites, el self-test del panel admin y la receta de
verificación headless (Playwright) están en **`docs/testing.md`**.
