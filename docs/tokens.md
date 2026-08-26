# Índice de tokens CSS — contrato GENERADO

> **Tipo**: generado · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/tokenConectado.test.mjs`

> **GENERADO** por `node tools/tokens.mjs` — no editar a mano.
> Lo vigila `tests/tokenConectado.test.mjs`: un token declarado que nadie
> consuma, o consumido sin declarar ni respaldo, rompe CI.

Los tokens son la INTERFAZ entre el tema y el juego (ley §3: el skin
cambia tokens, la actividad los consume). Este es el contrato completo.

**206 tokens** en 17 familias.

## `--bs-*` (23)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--bs-accent` | styles/ballsort.css | styles/ballsort.css |
| `--bs-ball-size` | styles/ballsort.css | styles/ballsort.css |
| `--bs-border-radius` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-border-radius-lg` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-border-radius-sm` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-active-bg` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-active-border-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-bg` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-border-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-disabled-bg` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-disabled-border-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-hover-bg` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-btn-hover-border-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-danger` | styles/ballsort.css | styles/ballsort.css · vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-link-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-link-hover-color` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-primary-rgb` | styles/theme.css | vendor/bootstrap-5.3.3/css/bootstrap.min.css |
| `--bs-tertiary-bg` | — *(solo respaldo)* | views/moderate.js |
| `--bs-tube-bg` | styles/ballsort.css | styles/ballsort.css |
| `--bs-tube-border` | styles/ballsort.css | styles/ballsort.css |
| `--bs-tube-gap` | styles/ballsort.css | styles/ballsort.css |
| `--bs-tube-w` | styles/ballsort.css | styles/ballsort.css |

## `--cw-*` (19)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--cw-active-cell` | styles/crossword.css | styles/crossword.css |
| `--cw-active-word` | styles/crossword.css | styles/crossword.css |
| `--cw-cell` | templates/crossword/player.js | styles/crossword.css |
| `--cw-clue-active-bg` | styles/crossword.css | styles/crossword.css |
| `--cw-clue-active-border` | styles/crossword.css | styles/crossword.css |
| `--cw-clue-hover` | styles/crossword.css | styles/crossword.css |
| `--cw-clue-solved` | styles/crossword.css | styles/crossword.css |
| `--cw-clue-wrong` | styles/crossword.css | styles/crossword.css |
| `--cw-cols` | templates/crossword/player.js | styles/crossword.css |
| `--cw-correct-bg` | styles/crossword.css | styles/crossword.css |
| `--cw-correct-fg` | styles/crossword.css | styles/crossword.css |
| `--cw-focus` | styles/crossword.css | styles/crossword.css |
| `--cw-frame` | styles/crossword.css | styles/crossword.css |
| `--cw-heading` | styles/crossword.css | styles/crossword.css |
| `--cw-heading-border` | styles/crossword.css | styles/crossword.css |
| `--cw-hint-fg` | styles/crossword.css | styles/crossword.css |
| `--cw-rows` | templates/crossword/player.js | styles/crossword.css |
| `--cw-wrong-bg` | styles/crossword.css | styles/crossword.css |
| `--cw-wrong-fg` | styles/crossword.css | styles/crossword.css |

## `--dash-*` (14)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--dash-bg` | styles/home.css | styles/home.css |
| `--dash-card-line` | styles/home.css | styles/home.css |
| `--dash-fg` | styles/home.css | styles/home.css |
| `--dash-ink` | styles/home.css | styles/home.css |
| `--dash-line` | styles/home.css | styles/home.css |
| `--dash-muted` | styles/home.css | styles/home.css |
| `--dash-navy` | styles/home.css | styles/home.css |
| `--dash-navy-btn` | styles/home.css | styles/home.css |
| `--dash-navy-btn2` | styles/home.css | styles/home.css |
| `--dash-navy-line` | styles/home.css | styles/home.css |
| `--dash-primary` | styles/home.css | styles/home.css |
| `--dash-primary-d` | styles/home.css | styles/home.css |
| `--dash-yellow` | styles/home.css | styles/home.css |
| `--dash-yellow-d` | styles/home.css | styles/home.css |

## `--dg-*` (3)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--dg-color` | templates/diagram/player.js | styles/diagram.css |
| `--dg-dot` | styles/diagram.css | styles/diagram.css |
| `--dg-fg` | templates/diagram/player.js | styles/diagram.css |

## `--display-*` (12)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--display-bg` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--display-border` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--display-fg` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--display-no` | — *(solo respaldo)* | styles/math.css |
| `--display-no-fg` | themes/tv-show/skin.css | styles/math.css |
| `--display-ok` | — *(solo respaldo)* | styles/math.css |
| `--display-ok-fg` | themes/tv-show/skin.css | styles/math.css |
| `--display-pad` | themes/tv-show/skin.css | styles/math.css |
| `--display-radius` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--display-shadow` | themes/tv-show/skin.css | styles/math.css |
| `--display-size` | — *(solo respaldo)* | styles/math.css |
| `--display-text-shadow` | themes/arcade/skin.css | styles/math.css |

## `--gl-*` (2)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--gl-lift` | templates/globos/player.js | styles/globos.css |
| `--gl-sway` | templates/globos/player.js | styles/globos.css |

## `--key-*` (23)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--key-bg` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css · themes/tv-show/skin.css |
| `--key-border` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-cols` | — *(solo respaldo)* | styles/math.css · styles/scaffold.css · styles/vs.css |
| `--key-fg` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-fn-bg` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-fn-border` | themes/tv-show/skin.css | styles/math.css |
| `--key-fn-fg` | — *(solo respaldo)* | styles/math.css |
| `--key-fn-shadow` | themes/tv-show/skin.css | styles/math.css |
| `--key-gap` | themes/tv-show/skin.css | styles/math.css · styles/teams.css · styles/vs.css |
| `--key-ok-bg` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-ok-border-color` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-ok-fg` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-ok-shadow` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-pad` | themes/tv-show/skin.css | styles/math.css |
| `--key-press` | themes/tv-show/skin.css | styles/math.css |
| `--key-radius` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-rows` | — *(solo respaldo)* | styles/math.css · styles/vs.css |
| `--key-shadow` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--key-shadow-active` | themes/tv-show/skin.css | styles/math.css |
| `--key-size` | — *(solo respaldo)* | styles/math.css |
| `--key-text-shadow` | themes/arcade/skin.css | styles/math.css |
| `--key-transition` | themes/tv-show/skin.css | styles/math.css |
| `--key-weight` | themes/tv-show/skin.css | styles/math.css |

## `--keypad-*` (1)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--keypad-top` | themes/tv-show/skin.css | styles/math.css |

## `--math-*` (23)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--math-ancho` | styles/math.css | styles/math.css |
| `--math-cifra` | styles/math.css · styles/teams.css · styles/vs.css | styles/math.css |
| `--math-eq-color` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-eq-opacity` | — *(solo respaldo)* | styles/math.css |
| `--math-font` | — *(solo respaldo)* | styles/math.css |
| `--math-gap` | themes/tv-show/skin.css | styles/math.css · styles/teams.css · styles/vs.css |
| `--math-head-gap` | — *(solo respaldo)* | styles/math.css |
| `--math-head-min` | styles/vs.css | styles/math.css |
| `--math-pad` | themes/tv-show/skin.css | styles/math.css |
| `--math-q-bg` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-q-border` | themes/arcade/skin.css | styles/math.css |
| `--math-q-color` | core/skins.js · themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-q-pad` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-q-radius` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-q-rotulo` | themes/arcade/skin.css | styles/math.css |
| `--math-q-rotulo-color` | themes/arcade/skin.css | styles/math.css |
| `--math-q-rotulo-shadow` | themes/arcade/skin.css | styles/math.css |
| `--math-q-rotulo-size` | — *(solo respaldo)* | styles/math.css |
| `--math-q-shadow` | themes/tv-show/skin.css | styles/math.css |
| `--math-q-size` | — *(solo respaldo)* | styles/math.css |
| `--math-q-text-shadow` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/math.css |
| `--math-q-weight` | themes/tv-show/skin.css | styles/math.css |
| `--math-tope` | styles/math.css | styles/math.css |

## `--opt-*` (10)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--opt-border` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-hover` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-hover-filter` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-press` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-radius` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-shadow` | themes/tv-show/skin.css | styles/opcion.css · themes/tv-show/skin.css |
| `--opt-shadow-active` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-shadow-hover` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-transition` | themes/tv-show/skin.css | styles/opcion.css |
| `--opt-weight` | themes/tv-show/skin.css | styles/opcion.css · styles/vs.css |

## `--qh-*` (14)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--qh-bien` | test.html | qa/hoja.js |
| `--qh-bien-bg` | test.html | qa/hoja.js |
| `--qh-card` | test.html | qa/hoja.js |
| `--qh-foco` | test.html | qa/hoja.js |
| `--qh-line` | test.html | qa/hoja.js |
| `--qh-mal` | test.html | qa/hoja.js |
| `--qh-mal-bg` | test.html | qa/hoja.js |
| `--qh-primario` | test.html | qa/hoja.js |
| `--qh-primario-fg` | test.html | qa/hoja.js |
| `--qh-ruta` | — *(solo respaldo)* | qa/hoja.js |
| `--qh-ruta-1` | — *(solo respaldo)* | qa/hoja.js |
| `--qh-ruta-1-bg` | — *(solo respaldo)* | qa/hoja.js |
| `--qh-ruta-bg` | — *(solo respaldo)* | qa/hoja.js |
| `--qh-soft` | test.html | qa/hoja.js |

## `--soft-*` (12)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--soft-danger-bg` | styles/home.css | styles/home.css |
| `--soft-danger-fg` | styles/home.css | styles/home.css |
| `--soft-info-bg` | styles/home.css | styles/home.css |
| `--soft-info-fg` | styles/home.css | styles/home.css |
| `--soft-neutral-bg` | styles/home.css | styles/home.css |
| `--soft-neutral-fg` | styles/home.css | styles/home.css |
| `--soft-primary-bg` | styles/home.css | styles/home.css |
| `--soft-primary-fg` | styles/home.css | styles/home.css |
| `--soft-success-bg` | styles/home.css | styles/home.css |
| `--soft-success-fg` | styles/home.css | styles/home.css |
| `--soft-warning-bg` | styles/home.css | styles/home.css |
| `--soft-warning-fg` | styles/home.css | styles/home.css |

## `--suelto-*` (2)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--dx` | core/soloAnimations.js | styles/soloAnim.css |
| `--dy` | core/soloAnimations.js | styles/soloAnim.css |

## `--vs-*` (6)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--vs-done-bg` | — *(solo respaldo)* | styles/vs.css |
| `--vs-done-fg` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |
| `--vs-done-muted` | themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |
| `--vs-left` | — *(solo respaldo)* | styles/vs.css |
| `--vs-right` | — *(solo respaldo)* | styles/vs.css |
| `--vs-total` | views/vsView.js | themes/tv-show/skin.css |

## `--vss-*` (8)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--vss-alto` | styles/vs.css · themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |
| `--vss-av` | styles/vs.css · themes/tv-show/skin.css | styles/vs.css · themes/tv-show/skin.css |
| `--vss-badge` | styles/vs.css · themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css · themes/tv-show/skin.css |
| `--vss-badge-size` | styles/vs.css · themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |
| `--vss-label-size` | — *(solo respaldo)* | styles/vs.css |
| `--vss-mid` | styles/vs.css · themes/arcade/skin.css | styles/vs.css |
| `--vss-name-size` | styles/vs.css · themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |
| `--vss-score-size` | styles/vs.css · themes/arcade/skin.css · themes/tv-show/skin.css | styles/vs.css |

## `--ws-*` (3)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--ws-cell` | styles/wordsearch.css | styles/wordsearch.css |
| `--ws-cols` | templates/wordsearch/editor.js · templates/wordsearch/player.js | styles/wordsearch.css |
| `--ws-lado` | styles/wordsearch.css | styles/wordsearch.css |

## `--ww-*` (31)

| Token | Lo DECLARA | Lo CONSUME |
|---|---|---|
| `--ww-accent` | core/skins.js · styles/theme.css | styles/diagram.css · styles/memory.css · styles/player.css · styles/textCorrection.css · styles/vs.css |
| `--ww-accent-fg` | — *(solo respaldo)* | styles/player.css |
| `--ww-accent-soft` | — *(solo respaldo)* | styles/player.css |
| `--ww-ar` | core/frameAspect.js | styles/player.css |
| `--ww-ar-css` | core/frameAspect.js · core/gameFrame.js | styles/player.css |
| `--ww-bg` | core/skins.js | core/homePreview.js · core/skins.js |
| `--ww-bg-image` | core/backgrounds.js | styles/backgrounds.css |
| `--ww-bg-ink` | core/backgrounds.js | styles/backgrounds.css |
| `--ww-bg-soft` | core/skins.js | styles/crossword.css · styles/diagram.css · styles/wordsearch.css |
| `--ww-card-bg` | core/skins.js | embed.html · styles/crossword.css · styles/match.css · styles/memory.css · styles/opcion.css · styles/player.css · styles/question-live.css · styles/wordsearch.css |
| `--ww-card-border` | core/skins.js | core/skins.js · styles/crossword.css · styles/diagram.css · styles/match.css · styles/opcion.css · styles/question-live.css · styles/wordsearch.css |
| `--ww-card-fg` | core/skins.js | styles/backgrounds.css · styles/crossword.css · styles/globos.css · styles/match.css · styles/memory.css · styles/opcion.css · styles/player.css · styles/question-live.css · styles/wordsearch.css |
| `--ww-danger` | core/skins.js · styles/theme.css | styles/crossword.css · styles/math.css · styles/opcion.css · styles/wheel.css |
| `--ww-fg` | core/skins.js | core/editorShell.js · core/skins.js · embed.html · styles/backgrounds.css · styles/crossword.css · styles/globos.css · styles/match.css · styles/memory.css · styles/opcion.css · styles/player.css · styles/question-live.css · styles/wordsearch.css · themes/tv-show/skin.css |
| `--ww-fs-reserve` | styles/player.css | styles/live.css · styles/player.css |
| `--ww-line` | — *(solo respaldo)* | styles/player.css |
| `--ww-muted` | — *(solo respaldo)* | styles/player.css |
| `--ww-paper` | themes/arcade/skin.css | styles/textCorrection.css |
| `--ww-paper-ink` | themes/arcade/skin.css | styles/textCorrection.css |
| `--ww-shape-1` | core/skins.js | core/editorShell.js · core/skins.js · styles/globos.css · styles/opcion.css |
| `--ww-shape-1-fg` | core/skins.js | styles/globos.css · styles/opcion.css |
| `--ww-shape-2` | core/skins.js | core/editorShell.js · core/skins.js · styles/globos.css · styles/opcion.css |
| `--ww-shape-2-fg` | core/skins.js | styles/globos.css · styles/opcion.css |
| `--ww-shape-3` | core/skins.js | core/editorShell.js · core/skins.js · styles/globos.css · styles/opcion.css |
| `--ww-shape-3-fg` | core/skins.js | styles/globos.css · styles/opcion.css |
| `--ww-shape-4` | core/skins.js | core/editorShell.js · core/skins.js · styles/globos.css · styles/opcion.css |
| `--ww-shape-4-fg` | core/skins.js | styles/globos.css · styles/opcion.css |
| `--ww-success` | core/skins.js · styles/theme.css | styles/crossword.css · styles/math.css · styles/opcion.css |
| `--ww-success-ink` | — *(solo respaldo)* | styles/wordsearch.css |
| `--ww-topbar-h` | core/boot.js · styles/home.css | styles/home.css · styles/player.css |
| `--ww-warning` | core/skins.js · styles/theme.css | styles/memory.css |

