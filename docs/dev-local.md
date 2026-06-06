# Desarrollo local (sin Supabase)

La app elige backend automáticamente: en **localhost** usa el backend **`local`**
(IndexedDB/localStorage para datos + un driver realtime sobre `BroadcastChannel` para
LIVE). En producción (`*.github.io`) usa **Supabase**, sin cambios. Puedes forzar el
backend en cualquier sitio con la consola del navegador:

```js
ww.setBackend('local')     // o 'supabase'  → recarga la página después
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
2. **Empezar** → juega en una sola pantalla. La puntuación es local.
3. En el editor, prueba **Cambiar formato** (p. ej. Quiz → Ruleta) y verifica que el
   contenido se conserva.

> Todo SOLO funciona 100% offline contra el backend `local`.

## Probar el modo LIVE (Kahoot) — 2 pestañas, sin Supabase
> Importante: usa **dos pestañas del MISMO navegador** (comparten `localStorage` y
> `BroadcastChannel`). El driver `local` da a cada pestaña un `userId` distinto, así que
> el host y el alumno son jugadores diferentes.

1. **Pestaña A (Profesor)**: `teacher.html` → abre una actividad **Quiz** → **PIN**.
   Aparece el código de sala (PIN).
2. **Pestaña B (Alumno)**: `student.html` → **Unirse** → escribe el PIN y un apodo.
   - El host (Pestaña A) debería ver al alumno aparecer en el lobby.
3. **Pestaña A**: inicia la partida. La Pestaña B pasa a la pregunta.
4. **Pestaña B**: responde. **Pestaña A**: pulsa **revelar** → se puntúa
   (server-side en el engine, anti-trampa) → leaderboard. Avanza a la siguiente.
5. Repite hasta terminar; comprueba el podio final.

## Probar el modo ASYNC (tareas) — sin Supabase
1. **Profesor** (`teacher.html`): abre una actividad → **Tareas** → crea una tarea
   (define intentos y fecha límite). Aparece un código.
2. **Alumno** (`student.html`): **Unirse** con ese código (o abre `#/task/<code>`) →
   escribe tu apodo → juega SOLO a tu ritmo. Al terminar queda registrado el intento.
3. Reintenta: al agotar `max_attempts` la tarea se bloquea. El profesor ve los intentos.
> En localhost todo corre contra el backend `local` (offline).

### Qué NO cubre el modo local
- El driver `local` simula realtime entre pestañas del mismo navegador; **no** sincroniza
  entre dispositivos distintos (para eso es Supabase).
- El scoring anti-trampa local corre en el engine del navegador; la **garantía real**
  (service role, RLS) es del backend Supabase. Para probar eso de verdad, ver abajo.

## Probar el backend Supabase de verdad (migración 0013 + Edge Functions)
Requiere Docker + Supabase CLI (no se puede en un entorno solo-Node):
```bash
supabase start                      # stack local (Postgres + Studio + Edge runtime)
supabase db reset                   # aplica todas las migrations/ (incluida 0013)
supabase functions serve            # sirve create-session / settle-item
```
Luego apunta la app a ese stack (URL/anon key locales en `supabase.config.js`) y usa
`ww.setBackend('supabase')`.

## Tests (los que corre el agente)
```bash
node tests/run.mjs    # lógica pura: core, contenido/switch, adapters, SOLO, LIVE…
```
Cubre la lógica sin DOM. El render y la interacción táctil/visual se verifican en el
navegador con los pasos de arriba.
