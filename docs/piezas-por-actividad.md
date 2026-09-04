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
| **Quiz** (`quiz`) | `16/10` | — | `header «1 / 3» (sin nombre)` 100%×6% → **barra**<br>`ww-prow` 100%×10% → **barra**<br>`ww-opt-grid` 100%×80% → **escenario** | `header «1 / 3» (sin nombre)` 100%×4% → **barra**<br>`ww-prow` 100%×12% → **barra**<br>`ww-opt-grid` 100%×82% → **escenario** |
| **Ruleta** (`wheel`) | `1/1` | — | `header (sin nombre)` 98%×6% → **barra**<br>`wh-flow` 98%×90% → **escenario** | `header (sin nombre)` 96%×3% → **barra**<br>`wh-flow` 96%×94% → **escenario** |
| **Emparejar** (`match`) | `16/10` | ✅ | `header «0 / 4» (sin nombre)` 94%×6% → **barra**<br>`ww-field` 94%×77% → **escenario**<br>`ww-bar` 94%×5% → **barra** | `header «0 / 4» (sin nombre)` 89%×3% → **barra**<br>`ww-field` 89%×85% → **escenario**<br>`ww-bar` 89%×4% → **barra** |
| **Memoria** (`memory`) | `1/1` | — | `header «0 / 6» (sin nombre)` 100%×6% → **barra**<br>`ww-memo-grid` 58%×94% → **—** | `header «0 / 6» (sin nombre)` 100%×4% → **barra**<br>`ww-memo-grid` 100%×96% → **escenario** |
| **Tildes** (`tildes`) | `16/10` | — | `header «Lápiz» (sin nombre)` 100%×7% → **barra**<br>`div (sin nombre)` 100%×1% → **barra**<br>`tc-hoja` 100%×93% → **escenario** | `header «Lápiz» (sin nombre)` 100%×5% → **barra**<br>`div (sin nombre)` 100%×0% → **barra**<br>`tc-hoja` 100%×95% → **escenario** |
| **Comas** (`comas`) | `16/10` | — | `header «Lápiz» (sin nombre)` 100%×7% → **barra**<br>`div (sin nombre)` 100%×1% → **barra**<br>`tc-hoja` 100%×93% → **escenario** | `header «Lápiz» (sin nombre)` 100%×5% → **barra**<br>`div (sin nombre)` 100%×0% → **barra**<br>`tc-hoja` 100%×95% → **escenario** |
| **Operaciones** (`math`) | `16/10` | — | `header «1 / 4» (sin nombre)` 100%×6% → **barra**<br>`ww-math-round` 100%×92% → **escenario** | `header «1 / 4» (sin nombre)` 100%×4% → **barra**<br>`ww-math-round` 100%×95% → **escenario** |
| **Sopa de Letras** (`wordsearch`) | `4/3` | — | `header «0 / 10» (sin nombre)` 100%×6% → **barra**<br>`ww-ws-body` 100%×93% → **escenario** | `header «0 / 10» (sin nombre)` 100%×4% → **barra**<br>`ww-ws-body` 100%×95% → **escenario** |
| **Crucigrama** (`crossword`) | `4/3` | — | `header «Reiniciar» (sin nombre)` 99%×7% → **barra**<br>`cw-body` 99%×83% → **escenario**<br>`cw-footer` 99%×6% → **barra** | `header «Reiniciar» (sin nombre)` 97%×6% → **barra**<br>`cw-body` 97%×86% → **escenario**<br>`cw-footer` 97%×6% → **barra** |
| **Abre Cajas** (`question-live`) | `4/3` | — | `header «0 / 6» (sin nombre)` 99%×6% → **barra**<br>`ab-board` 37%×18% → **—**<br>`ab-hint` 24%×3% → **—** | `header «0 / 6» (sin nombre)` 97%×3% → **barra**<br>`ab-board` 94%×16% → **barra**<br>`ab-hint` 61%×3% → **—** |
| **Ordena las Pelotas** (`ballsort`) | `4/3` | — | `header «Aa» (sin nombre)` 100%×7% → **barra**<br>`tubes` 100%×41% → **—** | `header «Aa» (sin nombre)` 100%×6% → **barra**<br>`tubes` 100%×36% → **—** |
| **Etiqueta el diagrama** (`diagram`) | `16/10` | ✅ | `header «0 / 4» (sin nombre)` 94%×6% → **barra**<br>`ww-field` 94%×75% → **escenario**<br>`ww-bar` 94%×6% → **barra** | `header «0 / 4» (sin nombre)` 89%×3% → **barra**<br>`ww-field` 89%×85% → **escenario**<br>`ww-bar` 89%×4% → **barra** |
| **Explota Globos** (`globos`) | `16/10` | — | `header «1 / 3» (sin nombre)` 100%×6% → **barra**<br>`ww-prow` 100%×10% → **barra**<br>`gl-field` 100%×80% → **escenario** | `header «1 / 3» (sin nombre)` 100%×4% → **barra**<br>`ww-prow` 100%×12% → **barra**<br>`gl-field` 100%×82% → **escenario** |
| **Colorear** (`colorear`) | `4/3` | — | `header (sin nombre)` 100%×6% → **barra**<br>`#co-lienzo` 100%×64% → **escenario**<br>`div (sin nombre)` 100%×14% → **barra**<br>`div «Listo» (sin nombre)` 100%×11% → **barra** | `header (sin nombre)` 100%×4% → **barra**<br>`#co-lienzo` 100%×69% → **escenario**<br>`div (sin nombre)` 68%×16% → **—**<br>`div «Listo» (sin nombre)` 100%×7% → **barra** |
| **Tangram** (`tangram`) | `4/3` | — | `header (sin nombre)` 100%×6% → **barra**<br>`ta-tablero` 100%×92% → **escenario** | `header (sin nombre)` 100%×4% → **barra**<br>`ta-tablero` 100%×95% → **escenario** |
| **Rompecabezas** (`puzzle`) | `4/3` | — | `header «0 / 4» (sin nombre)` 100%×6% → **barra**<br>`pu-arena` 100%×52% → **escenario**<br>`pu-pieces` 100%×39% → **—** | `header «0 / 4» (sin nombre)` 100%×4% → **barra**<br>`pu-arena` 100%×80% → **escenario**<br>`pu-pieces` 100%×14% → **barra** |

## Qué cambia al girar el hueco

Piezas que cambian de rol entre ancho y alto (misma pieza, otra función):

- **Quiz**: 0 de 3
- **Ruleta**: 0 de 2
- **Emparejar**: 0 de 3
- **Memoria**: 1 de 2
- **Tildes**: 0 de 3
- **Comas**: 0 de 3
- **Operaciones**: 0 de 2
- **Sopa de Letras**: 0 de 2
- **Crucigrama**: 0 de 3
- **Abre Cajas**: 1 de 3
- **Ordena las Pelotas**: 0 de 2
- **Etiqueta el diagrama**: 0 de 3
- **Explota Globos**: 0 de 3
- **Colorear**: 1 de 4
- **Tangram**: 0 de 2
- **Rompecabezas**: 1 de 3

## Piezas sin nombre propio

Bloques cuyo único identificador es una utilidad de Bootstrap o un `<div>`
pelado: no se les puede asignar un rol porque no están identificados. Ponerles
clase propia es el primer paso de cualquier reparto.

- **Quiz** → `header «1 / 3» (sin nombre)`
- **Ruleta** → `header (sin nombre)`
- **Emparejar** → `header «0 / 4» (sin nombre)`
- **Memoria** → `header «0 / 6» (sin nombre)`
- **Tildes** → `header «Lápiz» (sin nombre)`
- **Tildes** → `div (sin nombre)`
- **Comas** → `header «Lápiz» (sin nombre)`
- **Comas** → `div (sin nombre)`
- **Operaciones** → `header «1 / 4» (sin nombre)`
- **Sopa de Letras** → `header «0 / 10» (sin nombre)`
- **Crucigrama** → `header «Reiniciar» (sin nombre)`
- **Abre Cajas** → `header «0 / 6» (sin nombre)`
- **Ordena las Pelotas** → `header «Aa» (sin nombre)`
- **Etiqueta el diagrama** → `header «0 / 4» (sin nombre)`
- **Explota Globos** → `header «1 / 3» (sin nombre)`
- **Colorear** → `header (sin nombre)`
- **Colorear** → `div (sin nombre)`
- **Colorear** → `div «Listo» (sin nombre)`
- **Tangram** → `header (sin nombre)`
- **Rompecabezas** → `header «0 / 4» (sin nombre)`
