# core/ — núcleo compartido

Módulos reutilizables que NO dependen del backend ni son una vista concreta. Son
muchos para una sola carpeta; la ubicación física se mantiene PLANA (imports
simples), y esta es la guía mental por ROL:

## Plumbing (infra básica)
`html` · `events` · `router` · `routing` · `lifecycle` · `state` · `constants`

## Datos / persistencia
`storage` · `storageMerge` · `migrate` · `registry` · `results` · `supabase`
· `io` · `connection` · `submitQueue`

## Modos de juego — FUENTE ÚNICA
`modes` · `modeMatrix` · `selftest`

## Editor
`editorShell` · `editorModes` · `editorPrimitives`

## Juego (mecánica / feedback)
`roundRender` · `podium` · `resultScreen` · `teams` · `streaks` · `effects`
· `sounds` · `gameEvents`

## Contenido
`contentModels/` · `textMarks` · `textCorrectionRound`

## Estética / UI
`skins` · `backgrounds` · `imagePicker` · `fullscreen` · `toast` · `tts`

## Identidad / auth (semi-opcional con el banco compartido)
`auth` · `identity` · `nicknameFilter`

## Live / tareas / varios
`livePhases` · `liveTransport` · `transport/` · `assignmentRules`
· `assignmentsTransport` · `errorLog` · `player` · `upload` · `vsAnimations`

---
Las **fuentes únicas de verdad** (modes, modeMatrix, editorShell, resultScreen,
teams, results.applyPoints, kernel/content/qaAdapt) centralizan cada decisión en
un solo sitio. Detalle del contrato en `templates/base.js` y `kernel/contracts/`,
y guía de modos en `docs/modos-de-juego.md` + el panel `#/admin`.

> Nota: una reorganización física en subcarpetas (`core/game/`, `core/ui/`, …)
> sería válida pero implica reescribir muchas rutas de import; se documenta aquí
> en vez de mover, para no arriesgar las vistas (no cubiertas por tests Node).
