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
| **Quiz** (`quiz`) | `16/10` | — | `ww-prow` 100%×6% → **barra**<br>`ww-q-media` 100%×72% → **escenario**<br>`ww-kahoot-grid` 100%×19% → **barra** | `ww-prow` 100%×6% → **barra**<br>`ww-q-media` 100%×75% → **escenario**<br>`ww-kahoot-grid` 100%×16% → **barra** |
| **Ruleta** (`wheel`) | `1/1` | — | `h3 «Piezas · Ruleta» (sin nombre)` 100%×4% → **barra**<br>`ww-wheel-stage` 32%×72% → **carril**<br>`div (sin nombre)` 100%×9% → **barra**<br>`div «Girar» (sin nombre)` 100%×9% → **barra** | `h3 «Piezas · Ruleta» (sin nombre)` 100%×4% → **barra**<br>`ww-wheel-stage` 82%×72% → **escenario**<br>`div (sin nombre)` 100%×9% → **barra**<br>`div «Girar» (sin nombre)` 100%×9% → **barra** |
| **Emparejar** (`match`) | `16/10` | ✅ | `ww-bar` 100%×2% → **barra**<br>`ww-field` 100%×90% → **escenario**<br>`ww-bar` 100%×5% → **barra** | `ww-bar` 100%×2% → **barra**<br>`ww-field` 100%×92% → **escenario**<br>`ww-bar` 100%×4% → **barra** |
| **Memoria** (`memory`) | `1/1` | — | `div «0 / 6 Flips: 0 ★ 0» (sin nombre)` 100%×5% → **barra**<br>`h5 «Piezas · Memoria» (sin nombre)` 100%×4% → **barra**<br>`ww-memo-grid` 58%×79% → **—** | `div «0 / 6 Flips: 0 ★ 0» (sin nombre)` 100%×5% → **barra**<br>`h5 «Piezas · Memoria» (sin nombre)` 100%×4% → **barra**<br>`ww-memo-grid` 100%×79% → **escenario** |
| **Tildes** (`tildes`) | `16/10` | — | `tc-bar` 88%×6% → **barra**<br>`tc-passage-area` 88%×82% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `tc-bar` 88%×4% → **barra**<br>`tc-passage-area` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Comas** (`comas`) | `16/10` | — | `tc-bar` 88%×6% → **barra**<br>`tc-passage-area` 88%×82% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `tc-bar` 88%×4% → **barra**<br>`tc-passage-area` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Operaciones** (`math`) | `16/10` | — | `ww-prow` 100%×2% → **barra**<br>`ww-math-round` 100%×96% → **escenario** | `ww-prow` 100%×2% → **barra**<br>`ww-math-round` 100%×96% → **escenario** |
| **Sopa de Letras** (`wordsearch`) | `4/3` | — | `ww-ws-head` 100%×2% → **barra**<br>`ww-ws-body` 100%×96% → **escenario** | `ww-ws-head` 100%×2% → **barra**<br>`ww-ws-body` 100%×97% → **escenario** |
| **Crucigrama** (`crossword`) | `4/3` | — | `cw-header` 99%×4% → **barra**<br>`cw-body` 99%×87% → **escenario**<br>`cw-footer` 99%×5% → **barra**<br>`#cw-ki` 1%×1% → **—** | `cw-header` 97%×3% → **barra**<br>`cw-body` 97%×89% → **escenario**<br>`cw-footer` 97%×4% → **barra**<br>`#cw-ki` 2%×1% → **—** |
| **Abre Cajas** (`question-live`) | `4/3` | — | `h3 «Piezas · Abre Caja» (sin nombre)` 100%×8% → **barra**<br>`div «1» (sin nombre)` 37%×56% → **—**<br>`p «Toca una caja para» (sin nombre)` 100%×8% → **barra** | `h3 «Piezas · Abre Caja» (sin nombre)` 100%×8% → **barra**<br>`div «1» (sin nombre)` 94%×56% → **escenario**<br>`p «Toca una caja para» (sin nombre)` 100%×8% → **barra** |
| **Ordena las Pelotas** (`ballsort`) | `4/3` | — | `bs-toolbar` 100%×13% → **barra**<br>`tubes` 100%×81% → **escenario** | `bs-toolbar` 100%×13% → **barra**<br>`tubes` 100%×81% → **escenario** |
| **Etiqueta el diagrama** (`diagram`) | `16/10` | ✅ | `ww-bar` 100%×2% → **barra**<br>`ww-field` 100%×89% → **escenario**<br>`ww-bar` 100%×6% → **barra** | `ww-bar` 100%×2% → **barra**<br>`ww-field` 100%×92% → **escenario**<br>`ww-bar` 100%×4% → **barra** |
| **Explota Globos** (`globos`) | `16/10` | — | `ww-prow` 100%×6% → **barra**<br>`gl-field` 100%×92% → **escenario** | `ww-prow` 100%×6% → **barra**<br>`gl-field` 100%×92% → **escenario** |

## Qué cambia al girar el hueco

Piezas que cambian de rol entre ancho y alto (misma pieza, otra función):

- **Quiz**: 0 de 3
- **Ruleta**: 1 de 4
- **Emparejar**: 0 de 3
- **Memoria**: 1 de 3
- **Tildes**: 0 de 3
- **Comas**: 0 de 3
- **Operaciones**: 0 de 2
- **Sopa de Letras**: 0 de 2
- **Crucigrama**: 0 de 4
- **Abre Cajas**: 1 de 3
- **Ordena las Pelotas**: 0 de 2
- **Etiqueta el diagrama**: 0 de 3
- **Explota Globos**: 0 de 2

## Piezas sin nombre propio

Bloques cuyo único identificador es una utilidad de Bootstrap o un `<div>`
pelado: no se les puede asignar un rol porque no están identificados. Ponerles
clase propia es el primer paso de cualquier reparto.

- **Ruleta** → `h3 «Piezas · Ruleta» (sin nombre)`
- **Ruleta** → `div (sin nombre)`
- **Ruleta** → `div «Girar» (sin nombre)`
- **Memoria** → `div «0 / 6 Flips: 0 ★ 0» (sin nombre)`
- **Memoria** → `h5 «Piezas · Memoria» (sin nombre)`
- **Abre Cajas** → `h3 «Piezas · Abre Caja» (sin nombre)`
- **Abre Cajas** → `div «1» (sin nombre)`
- **Abre Cajas** → `p «Toca una caja para» (sin nombre)`
