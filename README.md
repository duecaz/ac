# WW — Wordwall + Kahoot

Plataforma de actividades. Cada actividad puede lanzarse en dos modos:
- **Empezar** → modo Wordwall (un solo dispositivo).
- **PIN** → modo Kahoot (sala con código, alumnos en sus móviles). _Disponible en Fase 2._

## Stack
HTML + CSS + JS vanilla (ES Modules). Bootstrap 5.3 + Bootstrap Icons por CDN. Supabase como único backend. Sin bundler. GitHub Pages.

## Estado por fases
- v0.2.0 — Fase 0+1: SOLO mode quiz, editor 4 pestañas, sync con Supabase.
- **v0.3.0 (actual)** — Fase 2: LIVE quiz (PIN+QR, lobby, settle-item Edge Function, anti-cheat real).
- v0.4.0 — Fase 3: endurecer LIVE (timer, kick, heartbeat, reconnect).
- v0.5.0 — Fase 4: reportes y CSV.
- v0.6.0 — Fase 5: tareas asíncronas.
- v1.0.0 — Fase 6: auth real, /explore, fork.

## Setup (una vez)
1. Repo `duecaz/ww` con Pages → Source = **Deploy from branch** → Branch: `main` / `(root)`.
2. Schema aplicado en proyecto `www` (klecbdjbrsyshjqzdxhw) vía MCP.
3. Anonymous Sign-Ins activo en Supabase → Auth → Providers.
4. Bucket `media` ya creado (público, 5MB max).

## Local
```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Estructura
```
core/        router, storage, supabase, migrate, registry…
templates/   quiz (única en F0–F4)
editors/     quizEditor (4 tabs)
views/       home, templateSelector, playerView, editView
ui/          hud, controls, start, end (placeholders)
styles/      theme, player, quiz, editor, review, live
supabase/    schema.sql, migrations/
```
