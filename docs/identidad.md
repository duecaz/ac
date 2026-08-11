# Identidad — anon id local + auth PocketBase

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Cómo se identifica al usuario y a quién pertenecen las actividades. Verificado
> contra `core/identity.js`, `core/auth.js`, `core/state.js` y `core/storage.js`.
> (La versión anterior de este doc describía el flujo Supabase con Google
> linking; **Supabase fue retirado** y ese flujo ya no existe.)

## El modelo actual

- **Identidad base = anon id local.** `core/identity.js → ensureIdentity()`
  devuelve `{ id: getAnonId() }`: un id anónimo persistido en `localStorage`
  (`core/state.js`), igual en cualquier backend. Con eso SOLO/ASYNC/LIVE
  funcionan también offline y sin login.
- **Auth real = PocketBase email/password** (`core/auth.js`). Facade con token +
  record en `localStorage` (`ww.pb.auth`), `onAuthChange` por listeners. Se usa
  para acciones que requieren cuenta, no para jugar.
- **Las actividades son un banco compartido sin dueño** (`author_id = null`):
  cualquiera las ve/abre por URL, y `sync()` (`core/storage.js`) las repuebla
  desde la nube si se limpia la caché. `localStorage` es la fuente de lectura,
  scopeada por uid (`setStorageUser`).

## Qué identifica a quién

| Contexto | Identidad usada |
|---|---|
| Jugar SOLO / guardar resultado | anon id (`ensureIdentity`) |
| Unirse a LIVE (alumno) | anon id + apodo elegido |
| Tarea (async) | anon id + apodo; los intentos guardan `user_id = anon id` |
| Editar/crear actividades | ninguna exigida (banco compartido) |
| Login profesor (opcional) | PocketBase email/password (`core/auth.js`) |

## Historia (por qué este doc cambió)

El flujo anterior (usuario anónimo de Supabase + `linkIdentity` con Google para
migrar anónimo→cuenta) se retiró junto con Supabase. Si en el futuro se quieren
actividades privadas por cuenta, el camino es: `author_id = user.id` de
PocketBase al guardar + filtro por autor en `sync()` — la infraestructura de
auth ya está en `core/auth.js`.
