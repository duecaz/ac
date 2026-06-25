# WW Actividades — Guía para Claude

## Reglas obligatorias (SIEMPRE)

### 1. Versión — en CADA commit y en CADA respuesta
- **SIEMPRE** sube `VERSION` en `core/constants.js` en cada commit (incremento de patch:
  `1.51.49` → `1.51.50`). Nunca bajar la versión, siempre hacia adelante (la caché y el
  service worker dependen de que la versión avance).
- **SIEMPRE** indica el número de versión en la respuesta del chat cuando termines un
  cambio, en formato `(vX.Y.Z)`, para poder referenciar exactamente por versión.
- El número de versión del commit y el de la respuesta deben coincidir.

### 2. Push a AMBAS ramas
Tras commitear, hacer push a las dos ramas:
```
git push -u origin claude/admiring-shannon-06ioqo
git push origin claude/admiring-shannon-06ioqo:ACTIVIDAD2
```
`ACTIVIDAD2` es la rama que sirve GitHub Pages (estático).

## Arquitectura (resumen)
- Vanilla JS, ES modules, sin framework. Routing por hash.
- Backend: **PocketBase** en `pb.lanube.uno` (Pi 5, Docker). **NO Supabase** para live.
- Imágenes inline como data-URL en el JSON de la actividad (límite 200 KB). No subir a storage externo.
- Live: una sola sala PocketBase (`live_sessions`), PIN/QR, `subscribeRoom`, fase de máquina de estados.
  - Pregunta Live y Ruleta Live reutilizan ese mismo live con la fase `'question-live'` y campos `ql_*`.

## Notas de plantillas
- `sessionItems(activity)` lee `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.
- Plantillas con `modes.live: true` deben declarar `getRoundPayload` y `scoreSubmission` (aunque sean stubs).
- Las columnas de rejillas se ponen inline (`grid-template-columns: repeat(N, 1fr)`); las variables CSS se ignoran en algunos móviles.
