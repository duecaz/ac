# Piezas por actividad — inventario GENERADO

> **Tipo**: generado · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tools/piezas.mjs --check`

> No editar a mano: sale de `node tools/piezas.mjs` (mide en el navegador).
> Es el dato que le faltaba a **D8** (`docs/decisiones-pendientes.md`): qué
> elementos concretos tiene cada actividad y cuánto ocupan cuando el hueco es
> ANCHO y cuando es ALTO. El **rol** es una sugerencia por forma (barra si es
> baja y ancha, carril si es estrecha y alta, escenario si es la masa) — la
> decisión de cómo repartir sigue abierta.

Andamio = la plantilla ya usa `styles/scaffold.css` (roles declarados, §3b).

| Actividad | Proporción | Andamio | Piezas en **ancho** (1280×800) | Piezas en **alto** (520×900) |
|---|---|---|---|---|
| **Quiz** (`quiz`) | `16/10` | — | `ww-prow` 100%×6% → **barra**<br>`ww-opt-grid` 100%×92% → **escenario** | `ww-prow` 100%×3% → **barra**<br>`ww-opt-grid` 100%×92% → **escenario** |
| **Ruleta** (`wheel`) | `1/1` | — | `ww-wheel-stage` 47%×78% → **—**<br>`wh-side` 9%×15% → **—** | `ww-wheel-stage` 78%×43% → **—**<br>`wh-side` 24%×13% → **—** |
| **Emparejar** (`match`) | `16/10` | ✅ | `ww-field` 99%×92% → **escenario**<br>`ww-bar` 99%×5% → **barra** | `ww-field` 97%×93% → **escenario**<br>`ww-bar` 97%×4% → **barra** |
| **Memoria** (`memory`) | `1/1` | — | `mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—** | `mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—** |
| **Tildes** (`tildes`) | `16/10` | — | `tc-bar` 88%×6% → **barra**<br>`tc-passage-area` 88%×81% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `tc-bar` 88%×4% → **barra**<br>`tc-passage-area` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Comas** (`comas`) | `16/10` | — | `tc-bar` 88%×6% → **barra**<br>`tc-passage-area` 88%×81% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `tc-bar` 88%×4% → **barra**<br>`tc-passage-area` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Operaciones** (`math`) | `16/10` | — | `ww-keypad-head` 100%×9% → **barra**<br>`ww-keypad` 100%×69% → **escenario** | `ww-keypad-head` 100%×9% → **barra**<br>`ww-keypad` 100%×69% → **escenario** |
| **Sopa de Letras** (`wordsearch`) | `4/3` | — | `ww-ws-grid-wrap` 90%×100% → **escenario**<br>`ww-ws-words` 9%×100% → **carril** | `ww-ws-grid-wrap` 100%×93% → **escenario**<br>`ww-ws-words` 100%×5% → **barra** |
| **Crucigrama** (`crossword`) | `4/3` | — | `cw-tools` 99%×5% → **barra**<br>`cw-body` 99%×85% → **escenario**<br>`cw-footer` 99%×6% → **barra** | `cw-tools` 97%×4% → **barra**<br>`cw-body` 97%×87% → **escenario**<br>`cw-footer` 97%×6% → **barra** |
| **Abre Cajas** (`question-live`) | `4/3` | — | `ab-board` 37%×18% → **—**<br>`ab-hint` 24%×3% → **—** | `ab-board` 94%×16% → **barra**<br>`ab-hint` 61%×3% → **—** |
| **Ordena las Pelotas** (`ballsort`) | `4/3` | — | `bs-toolbar` 100%×7% → **barra**<br>`tubes` 100%×41% → **—** | `bs-toolbar` 100%×6% → **barra**<br>`tubes` 100%×36% → **—** |
| **Etiqueta el diagrama** (`diagram`) | `16/10` | ✅ | `ww-field` 99%×90% → **escenario**<br>`ww-bar` 99%×7% → **barra** | `ww-field` 97%×93% → **escenario**<br>`ww-bar` 97%×4% → **barra** |
| **Explota Globos** (`globos`) | `16/10` | — | `ww-prow` 100%×6% → **barra**<br>`gl-field` 100%×92% → **escenario** | `ww-prow` 100%×3% → **barra**<br>`gl-field` 100%×92% → **escenario** |

## Qué cambia al girar el hueco

Piezas que cambian de rol entre ancho y alto (misma pieza, otra función):

- **Quiz**: 0 de 2
- **Ruleta**: 0 de 2
- **Emparejar**: 0 de 2
- **Memoria**: 0 de 12
- **Tildes**: 0 de 3
- **Comas**: 0 de 3
- **Operaciones**: 0 de 2
- **Sopa de Letras**: 1 de 2
- **Crucigrama**: 0 de 3
- **Abre Cajas**: 1 de 2
- **Ordena las Pelotas**: 0 de 2
- **Etiqueta el diagrama**: 0 de 2
- **Explota Globos**: 0 de 2

## Piezas sin nombre propio

Bloques cuyo único identificador es una utilidad de Bootstrap o un `<div>`
pelado: no se les puede asignar un rol porque no están identificados. Ponerles
clase propia es el primer paso de cualquier reparto.

_Ninguna: las 13 tienen todas sus piezas nombradas._
