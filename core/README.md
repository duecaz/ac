# core/ — núcleo compartido

Módulos reutilizables que NO dependen del backend ni son una vista concreta. Son
muchos para una sola carpeta; la ubicación física se mantiene PLANA (imports
simples), y esta es la guía mental por ROL:

## Plumbing (infra básica)
`html` · `events` · `router` · `routing` · `lifecycle` · `state` · `constants`
· `ls` (localStorage seguro/cuota) · `clock` (reloj inyectable → tests
deterministas) · `boot` (arranque común de las 3 entradas) · `perf` (detección
de gama baja → clase `ww-lite`)

## Datos / persistencia
`storage` · `storageMerge` · `migrate` · `registry` · `registerTemplates`
· `results` · `io` · `connection` · `submitQueue` · `offlineQueue` (cola
genérica anti-pérdida) · `pbFilter` (escape de filtros PocketBase) · `dbDiag`

## Modos de juego — FUENTE ÚNICA
`modes` · `modeMatrix` · `selftest`

## Editor
`editorShell` · `editorModes` · `editorPrimitives`

## Juego (mecánica / feedback)
`roundRender` · `podium` · `resultScreen` · `teams` · `streaks` · `effects`
· `sounds` · `gameEvents` · `scoring/` (convención de puntos compartida)

## Modo SOLO (shells estandarizados — ver CLAUDE.md "Arquitectura de Players")
`soloPlayer` (SequentialShell + FreeformShell) · `soloTimer` (countdown único)
· `soloAnimations` + `soloAnimator` (animación de progreso, carril del marco)
· `player` (wrapper que delega en la plantilla)

## Contenido
`contentModels/` (qa · pairs · entries · textCorrection) · `textMarks`
· `textCorrectionRound` · `textCorrectionDraw` (dibujo lápiz/táctil)
· `penDetector` + `penCalibration` (herramienta por tamaño de contacto,
"Calibrar pizarra")

## Estética / UI
`skins` · `backgrounds` · `presentation` (aplica/revierte escena con scope)
· `imagePicker` · `fullscreen` · `toast` · `tts` · `activityThumb` (previews
del home) · `vsAnimations` + `vsAnimStore` (animación central del VS)

## Identidad / auth (semi-opcional con el banco compartido)
`auth` (PocketBase email/password) · `identity` (anon id) · `nicknameFilter`

## Live / tareas / varios
`livePhases` · `liveTransport` · `liveWords` · `assignmentRules`
· `assignmentsTransport` · `errorLog` · `upload` (imagen → data-URL inline)

---
Las **fuentes únicas de verdad** (modes, modeMatrix, editorShell, resultScreen,
teams, scoring/, results.applyPoints, kernel/content/qaAdapt) centralizan
cada decisión en un solo sitio. Detalle del contrato en `templates/base.js` y
`kernel/contracts/`, guía de modos en `docs/modos-de-juego.md`, testeo en
`docs/testing.md` y el panel `#/admin`.

> Nota: una reorganización física en subcarpetas (`core/game/`, `core/ui/`, …)
> sería válida pero implica reescribir muchas rutas de import; se documenta aquí
> en vez de mover, para no arriesgar las vistas (no cubiertas por tests Node).
