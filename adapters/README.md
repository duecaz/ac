# adapters/

Implementaciones concretas del **RemoteStore** (la mitad intercambiable de la
persistencia). `core/storage.js` mantiene localStorage como caché offline-first y
delega lo remoto en el adapter que elija la config — nunca importa Supabase directo.

## RemoteStore (contrato)
Todos los métodos son async y operan sobre el JSONB de la actividad:
- `saveActivity(activity) → Promise<void>`
- `deleteActivity(id) → Promise<void>`
- `getActivity(id) → Promise<Object|null>`
- `listActivities() → Promise<{id, data}[]>`

## Drivers
- `local/` — sin red; simula un backend con un blob clave-valor (localStorage en el
  navegador; KV inyectable para tests). **Por defecto en desarrollo** → app 100% offline.
- `supabase/` — la lógica Supabase existente (auth, author stamping, tabla `activities`,
  filtrado por autor), movida aquí desde `core/storage.js`.
- `pocketbase/` — stub para `pb.lanube.com`; falla ruidosamente hasta implementarse.

## Selección (`index.js`)
1. override `localStorage['ww.backend']` (`local`|`supabase`|`pocketbase`)
2. localhost / 127.0.0.1 / `file:` → `local`
3. en otro caso → `supabase` (el sitio desplegado no cambia de comportamiento)

En el navegador puedes cambiar en caliente: `ww.setBackend('local')` y recargar.
