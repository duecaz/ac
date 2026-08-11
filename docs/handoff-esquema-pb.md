# Esquema de PocketBase — diseño definitivo (AulaReto)

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Consolidación de todo lo aprendido en las fases S1-S3 + auth v2. Fuente de verdad
> del esquema. Se aplica con **`tools/setup-pocketbase.ps1`** (idempotente) o con el
> botón "Crear colecciones" de `#/admin`. El script y este doc deben coincidir.

## Principios
- **Alumnos anónimos** (results, live_*, attempts): esas colecciones aceptan
  creación pública. No se tocan sus reglas en esta fase (deuda A / live = trabajo aparte).
- **Actividades con dueño**: `owner` = id del profe. Todos ven las `public`; solo el
  dueño (o admin) edita/borra.
- **Admin por rol**: `users.role = "admin"` → modera y edita todo. La cláusula admin
  es ADITIVA (solo concede).
- **Transitorio `owner = ""`**: se mantiene para no orfanar actividades legadas sin
  dueño. Endurecer = quitarlo cuando TODO tenga owner (paso manual documentado).

## Colecciones y campos

### users (auth, ya existe)
| campo | tipo | notas |
|---|---|---|
| (email, password, name…) | sistema | de PocketBase |
| `role` | text | `"admin"` o vacío. **minúscula** (las reglas usan `@request.auth.role`) |
- **Rules**: viewRule `id = @request.auth.id || @request.auth.role = "admin"`;
  listRule `@request.auth.role = "admin"` (para el panel de Profesores). Auth y
  create (signup) por defecto de PB.

### activities
| campo | tipo | notas |
|---|---|---|
| `data` | json (5MB) | la actividad completa |
| `owner` | text | id del profe dueño · **índice** |
| `visibility` | text | `unlisted` (borrador) \| `public` · **índice** |
| `tags` | json | |
| `language` | text | |
| `created`,`updated` | autodate | orden por -updated |
- **Rules**:
  - list/view: `visibility = "public" || owner = "" || owner = @request.auth.id || @request.auth.role = "admin"`
  - create: `""` (el gate de cliente ya exige login; endurecer luego a `@request.auth.id != ""`)
  - update/delete: `owner = "" || owner = @request.auth.id || @request.auth.role = "admin"`
- **Índices**: `owner`, `visibility`.

### activity_likes  (S2)
| `activity` text · `user` text |
- Índice **ÚNICO** `(activity, user)`.
- Rules: list/view `""`; create/delete `@request.auth.id != "" && user = @request.auth.id`; update null.

### reports  (S3)
| `activity` text · `by` text · `reason` text |
- Rules: create `@request.auth.id != ""`; list/view/delete `@request.auth.role = "admin"`; update null.

### results  (alumnos anónimos)
| activity_id, session_id, user_id, player_name, score_auto(n), score_final(n), max_score(n), time_used(n), overrides(json), created(autodate) |
- Rules: create `""`; list/view `@request.auth.id != ""`; update/delete null.

### assignments · assignment_attempts · live_sessions · live_answers
- Se mantienen como están (públicas) — flujo de alumno anónimo. Mejora futura:
  añadir `status` + índice `code` a live_sessions (P2-2) y endurecer con la deuda A.

## Endurecer (cuando todo tenga owner, paso manual)
- activities.create → `@request.auth.id != ""`
- quitar `owner = ""` de activities update/delete/list/view.

## Cómo aplicar
```powershell
# En tu Pi/Windows con PowerShell:
./tools/setup-pocketbase.ps1 -PbUrl "https://pb.lanube.uno"
# te pide email+password de superadmin y configura todo (idempotente, se puede re-correr).
```
