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
| **Quiz** (`quiz`) | `16/10` | — | `edu-sec` 100%×6% → **barra**<br>`edu-sec` 100%×92% → **escenario** | `edu-sec` 100%×6% → **barra**<br>`edu-sec` 100%×92% → **escenario** |
| **Ruleta** (`wheel`) | `1/1` | — | `edu-sec` 47%×78% → **—**<br>`edu-sec` 4%×15% → **—** | `edu-sec` 78%×43% → **—**<br>`edu-sec` 10%×13% → **—** |
| **Emparejar** (`match`) | `16/10` | ✅ | `edu-sec` 100%×94% → **escenario**<br>`ww-bar` 100%×5% → **barra** | `edu-sec` 100%×95% → **escenario**<br>`ww-bar` 100%×4% → **barra** |
| **Memoria** (`memory`) | `1/1` | — | `mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—** | `mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—**<br>`mc` 24%×31% → **—** |
| **Tildes** (`tildes`) | `16/10` | — | `edu-topbar` 88%×6% → **barra**<br>`edu-sec` 88%×82% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `edu-topbar` 88%×4% → **barra**<br>`edu-sec` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Comas** (`comas`) | `16/10` | — | `edu-topbar` 88%×6% → **barra**<br>`edu-sec` 88%×82% → **escenario**<br>`tc-done-wrap` 88%×8% → **barra** | `edu-topbar` 88%×4% → **barra**<br>`edu-sec` 88%×86% → **escenario**<br>`tc-done-wrap` 88%×7% → **barra** |
| **Operaciones** (`math`) | `16/10` | — | `edu-sec` 33%×8% → **—**<br>`edu-sec` 32%×69% → **carril** | `edu-sec` 57%×6% → **—**<br>`edu-sec` 92%×69% → **escenario** |
| **Sopa de Letras** (`wordsearch`) | `4/3` | — | `edu-sec` 90%×100% → **escenario**<br>`edu-sec` 9%×100% → **carril** | `edu-sec` 100%×94% → **escenario**<br>`edu-sec` 100%×5% → **barra** |
| **Crucigrama** (`crossword`) | `4/3` | — | `edu-topbar` 99%×5% → **barra**<br>`cw-body` 99%×85% → **escenario**<br>`edu-send` 99%×6% → **barra** | `edu-topbar` 97%×4% → **barra**<br>`cw-body` 97%×87% → **escenario**<br>`edu-send` 97%×6% → **barra** |
| **Abre Cajas** (`question-live`) | `4/3` | — | `edu-sec` 37%×18% → **—**<br>`ab-hint` 100%×2% → **barra** | `edu-sec` 94%×16% → **barra**<br>`ab-hint` 100%×2% → **barra** |
| **Ordena las Pelotas** (`ballsort`) | `4/3` | — | `edu-topbar` 100%×13% → **barra**<br>`edu-sec` 100%×81% → **escenario** | `edu-topbar` 100%×13% → **barra**<br>`edu-sec` 100%×81% → **escenario** |
| **Etiqueta el diagrama** (`diagram`) | `16/10` | ✅ | `edu-sec` 100%×93% → **escenario**<br>`ww-bar` 100%×6% → **barra** | `edu-sec` 100%×95% → **escenario**<br>`ww-bar` 100%×4% → **barra** |
| **Explota Globos** (`globos`) | `16/10` | — | `edu-sec` 100%×6% → **barra**<br>`edu-sec` 100%×92% → **escenario** | `edu-sec` 100%×6% → **barra**<br>`edu-sec` 100%×92% → **escenario** |

## Qué cambia al girar el hueco

Piezas que cambian de rol entre ancho y alto (misma pieza, otra función):

- **Quiz**: 1 de 2
- **Ruleta**: 0 de 2
- **Emparejar**: 0 de 2
- **Memoria**: 0 de 12
- **Tildes**: 0 de 3
- **Comas**: 0 de 3
- **Operaciones**: 2 de 2
- **Sopa de Letras**: 2 de 2
- **Crucigrama**: 0 de 3
- **Abre Cajas**: 1 de 2
- **Ordena las Pelotas**: 0 de 2
- **Etiqueta el diagrama**: 0 de 2
- **Explota Globos**: 1 de 2

## Piezas sin nombre propio

Bloques cuyo único identificador es una utilidad de Bootstrap o un `<div>`
pelado: no se les puede asignar un rol porque no están identificados. Ponerles
clase propia es el primer paso de cualquier reparto.

_Ninguna: las 13 tienen todas sus piezas nombradas._
