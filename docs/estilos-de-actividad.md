# Estilos de actividad — el contrato que hace que TODA actividad escale y cambie de skin

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> **El problema recurrente**: al crear una actividad nueva, el CSS del juego se
> escribe con tamaños fijos (`font-size: .9rem`) o colores a pelo (`color: #6c757d`).
> Resultado: el texto NO crece en 4K ni encoge en 600×800, y los **skins no pueden
> recolorear** la actividad (los skins cambian **tokens**, no reglas). Este MD es el
> contrato para no repetirlo. Guardado por la suite `tests/styles.test.mjs` (ratchet).
>
> Documentos hermanos: cómo se prueba → `docs/testing.md` · qué hace cada actividad
> → `docs/panorama-actividades.md` · modelo de contenido → `docs/ESTRUCTURA.md`.

## 1. Dónde viven los estilos globales (la fuente de los skins)

- **`styles/theme.css` `:root`** — 5 tokens semilla (`--ww-primary/accent/success/warning/danger`).
- **`core/skins.js` (`applySkin`)** — en runtime pinta el **juego completo** de tokens
  desde el `cssVars` de cada skin, sobre `<html>` (global) o acotado a `.ww-player-frame`.
  Ahí se definen los tokens que una actividad debe consumir:
  - Superficie: `--ww-bg`, `--ww-bg-soft`, `--ww-fg`
  - Tarjeta / pieza: `--ww-card-bg`, `--ww-card-fg`, `--ww-card-border`
  - Acentos y formas: `--ww-accent`, `--ww-shape-1..4`
  - Especializados: `--key-*` (teclado), `--display-*` (visor), `--math-*`
- **`styles/player.css`** — `#ww-player-widget { container-type: size }`: es el ANCESTRO de
  consulta, por eso los hijos pueden medir en `cqmin/cqw/cqh` y escalar con el marco.

**Cambiar de skin = cambiar esos tokens.** Si tu actividad escribe `#6c757d` en vez de
`var(--ww-fg)`, ese trozo se queda gris pase el skin que pase. Ese es el bug a evitar.

## 2. Las dos reglas (y cómo cumplirlas)

### Regla A — El PLAYER no lleva tamaños fijos
Todo lo del juego (fuente, padding, huecos, columnas, piezas) se mide **relativo**:
- Unidades de contenedor `cqmin/cqw/cqh` (necesitan un ancestro `container-type: size`;
  el marco ya lo trae, o decláralo en tu arena como hace `styles/diagram.css`).
- `%` del contenedor, o un fitter en JS (`fitLayout`/`fitPassage`).
- **Piso de legibilidad permitido**: `max(12px, 3cqmin)` o `clamp(.72rem, 4cqmin, …)`
  — el `px/rem` es SUELO, nunca TECHO. Un `clamp(.7rem, 2cqw, .95rem)` con tope bajo
  **congela** y por eso lo marca el linter.

```css
/* ❌ congela: no crece en 4K, no encoge en 9:16 */
.mi-label { font-size: .9rem; }
/* ✅ escala con el arena, con piso legible */
.mi-label { font-size: max(.75rem, 4.2cqmin); }
```

El **editor** SÍ puede usar px: es un formulario, no el juego. El linter lo ignora por
selector (`.dg-edit`, `.pcal`, `-ed`, `.mem-…`).

### Regla B — Los colores pintables van por token
`color` / `background` / `background-color` de superficies del juego → `var(--ww-*)`
(con fallback): así el skin recolorea. Excepciones que NO necesitan token (el linter
las permite):
- **Neutros** `#fff`/`#000` (texto sobre color).
- **Estado semántico** acierto/error: verdes (`#16a34a`, `#198754`, `#22c55e`) y rojos
  (`#ef4444`, `#dc3545`, `#dc2626`, `#b91c1c`) — convención de toda la app.
- `rgba(…)` de sombras/anillos/overlays (no es superficie skineable).
- Paleta propia de un skin (`.vs-skin-*`).

```css
/* ❌ gris fijo: ningún skin lo recolorea */
.mi-hint { color: #6c757d; }
/* ✅ sigue al skin */
.mi-hint { color: var(--ww-fg); opacity: .7; }
```

**Y la tinta viaja con el relleno.** Todo color que lleve texto encima tiene su
pareja `-fg` (`--ww-shape-3` ⇒ `--ww-shape-3-fg`): pintar el fondo con token y la
letra con `#fff` a pelo es el bug que ya cazamos tres veces (opciones del quiz,
etiquetas del diagrama y el tema TV Show, los tres a 2,2-2,4:1 — ilegibles a 3 m).

```css
/* ❌ la letra no sigue a la forma: sobre la 3 (ámbar) da 2,4:1 */
.mi-ficha { background: var(--ww-shape-3); color: #fff; }
/* ✅ el tema decide las dos */
.mi-ficha { background: var(--ww-shape-3); color: var(--ww-shape-3-fg, #fff); }
```

### Regla C — El FONDO pone el lienzo; el TEMA, la paleta
Los dos ejes y quién gana al cruzarse (spoiler: gana la cercanía al píxel, y el
fondo ELEGIDO gana al lienzo que pinte el tema) están en **[`leyes.md` §3c](leyes.md#3c--tema-y-fondo--dos-ejes-y-quién-gana-cuando-se-cruzan)**.
Lo mínimo que hay que saber al escribir CSS de actividad:
- no estiles por clase de fondo (`body.bg-arena .mi-cosa`): el fondo no decide
  componentes;
- el texto suelto sobre el lienzo hereda `--ww-bg-ink` — no le fijes color;
- un fondo nuevo se AÑADE en `core/backgrounds.js` declarando `ink` +
  `colorBase` (o `plate: true`), y CI le mide el contraste.

## 3. Ejemplares y checklist

- **Ejemplares**: `styles/math.css` y `styles/quiz.css` — 0 fija, 0 color a pelo. Cópialos
  de referencia. La suite los verifica limpios en cada corrida.
- **Checklist al crear una actividad**:
  1. ¿Alguna `font-size` en `px/rem/em` sin `cq/%` ni piso `max()`/`clamp()`? → relativízala.
  2. ¿`color`/`background` con `#hex` que no sea neutro ni estado? → token `var(--ww-*)`.
  3. Corre `node tests/styles.test.mjs`. Debe pasar **sin tocar el BASELINE**.

## 3b. Andamio de regiones — el responsive compartido (`styles/scaffold.css`)

Las actividades con "un centro + piezas alrededor" (Etiqueta el diagrama, Emparejar,
Quiz, Sopa…) usan un **andamio de regiones** que refluye solo según el aspect-ratio
del área — **sin breakpoints de píxeles**, como Wordwall. El player marca sus partes
por ROL y el andamio decide dónde van:

```html
<div class="ww-scaffold">                    <!-- columna raíz (contenedor de consulta) -->
  <div class="ww-bar">…progreso · título…</div>
  <div class="ww-field">                     <!-- la zona que refluye -->
    <div class="ww-rail" data-rail="start">…piezas…</div>
    <div class="ww-stage">…imagen / tablero…</div>
    <div class="ww-rail" data-rail="end">…piezas…</div>
  </div>
  <div class="ww-bar ww-bar-actions">…botón…</div>
</div>
```

- **Ancho** (`aspect-ratio ≥ 1/1`) → los rieles son **columnas laterales**, el stage en medio.
- **Alto** (`aspect-ratio < 1/1`) → los rieles pasan a **filas arriba/abajo** (con wrap),
  el stage en medio. Las piezas "viajan" al eje largo y el centro se queda el corto entero.

**Cómo marcar lo reordenable**: es el ROL, no la posición. `ww-stage` = el centro
(máximo tamaño); `ww-rail` `data-rail="start|end"` = un grupo que fluye; `ww-bar` =
chrome fijo. El player NO decide izquierda/derecha/arriba/abajo — lo hace el andamio.

**Nota técnica** (para no perder una tarde): el `@container` se resuelve contra un
ANCESTRO, así que el CONTENEDOR de consulta es `.ww-scaffold` y quien REFLUYE es
`.ww-field` (su descendiente) — un elemento no puede consultar su propio `@container`.
Y en container queries el aspect-ratio va en sintaxis de RANGO (`(aspect-ratio < 1/1)`),
NO `min/max-aspect-ratio` (eso es solo de media queries). `scaffold.css` está en la
lista EXCLUDED del ratchet (es chrome compartido, no el CSS de una actividad).

Ejemplar migrado: **Etiqueta el diagrama** (`styles/diagram.css`) — etiquetas de color
`--ww-shape-*`, imagen que reclama el máximo, y el punto conector se reposiciona al
borde interior según la orientación (derecha/izquierda en ancho, abajo/arriba en alto).

## 4. El guardián: `tests/styles.test.mjs` (ratchet de deuda)

Escanea el CSS de juego y falla si aparece una violación **nueva**. La deuda actual está
congelada en un `BASELINE` por archivo/valor y **no puede crecer**:
- Una **actividad nueva** (archivo sin baseline) debe nacer limpia — cualquier violación falla.
- Al **arreglar** deuda existente, **borra** su entrada del baseline (no la dejes de más).
- **Nunca** metas una violación nueva al baseline para "callar" el test: relativiza o tokeniza.

La deuda de estilos registrada hoy (para ir saldándola): `vs.css`/`teams.css` (chrome del
marcador con rem fijos), `wordsearch.css`/`match.css`/`memory.css`/`ballsort.css` (fuentes
de lista/tarjeta en rem y algún gris a pelo), `crossword.css`, `textCorrection.css`
(veredicto y notebook). Ver el `BASELINE` del test para el detalle exacto.
