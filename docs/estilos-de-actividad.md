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

## 3b0. Los CUATRO roles del player (decisión del dueño, 2026-08-17)

Todo player se lee con cuatro roles — el prefijo `edu-` marca lo nuevo:

| Rol | Qué es | Regla |
|---|---|---|
| **`edu-hud`** | los INDICADORES: página, ⏱, ★, 🔥 | flotan en las esquinas (`core/playerHud.js`, `hudHtml`/`hudSet`); **nunca crean franja** ni capturan toques |
| **`edu-topbar`** | las HERRAMIENTAS que se tocan | existe **solo** si hay herramienta: lápiz/borrador (Tildes/Comas), Aa/Deshacer (Pelotas), pista/reiniciar (Crucigrama — *Verificar* es envío y vive en `edu-send`) — 3 de 13 |
| **el juego** (`edu-sec`) | todo el alto restante, en subsecciones CON NOMBRE (`edu-sec--enunciado`, `--tablero`, `--texto`, `--pistas`, `--banco`, `--panel`, `--campo`) | refluyen con el contenedor (**ancho estrecho O más alto que ancho**, ver abajo); el **enunciado es la primera subsección**, no una barra |
| **`edu-send`** | el espacio del botón de enviar | UNO como mucho, y todo control de envío dentro (marcador sobre `ww-bar-actions`/`tc-done-wrap`/`cw-footer`) |

Y dos prohibiciones que salieron del inventario (`docs/piezas-por-actividad.md`):
el **título** de la actividad vive en la antesala (inicio · setup · lobby · ficha de
la tarea), jamás dentro del juego; y una **pieza sin clase propia** (solo utilidades
de Bootstrap) no se puede repartir — nómbrala.

**Cómo se marca**: DOBLE CLASE — `class="edu-topbar tc-bar"`. El rol es lo que se
escanea y se verifica; el nombre propio se queda con su CSS y con lo que apuntan
los skins. Así el vocabulario entra sin un renombrado masivo y sin tocar los temas.

### El reflujo se quedó muerto por culpa del MARCO, no del CSS de la plantilla

Historia corta y con moraleja. El reflujo por forma (`aspect-ratio < 1/1`) era
**inalcanzable en las 13**: el marco aplicaba la proporción declarada como
estilo EN LÍNEA, que gana a todo, así que fuera de pantalla completa el
contenedor nunca era vertical. En un móvil de 390×844 el marco medía 358×269
—el **29 % de la pantalla**, con 445 px de alto muerto— y el crucigrama seguía
con las pistas al lado y el tablero a 318 px.

El primer arreglo fue añadir un `max-width: 520px` a la condición, en Crucigrama
y Sopa. Funcionaba… y era el parche equivocado: no devolvía la pantalla al
alumno, reintroducía el breakpoint de píxeles que §3b prohíbe, y dejaba con el
mismo branch muerto a `scaffold.css`, `diagram.css` y `match.css`.

**El arreglo correcto está en el marco** (`core/frameAspect.js` +
`styles/player.css`): la proporción viaja como VARIABLE (`--ww-ar-css`), no como
estilo en línea, y con la ventana claramente vertical (`max-aspect-ratio: 3/4`)
el marco la SUELTA y toma el alto disponible — el tercer caso, junto a pantalla
completa y VS/Equipos. Medido después: el marco pasa a 358×714 y refluyen el
crucigrama, la sopa **y el andamio compartido** (Diagrama vuelve a mover sus
rieles); los dos `max-width` en píxeles se borraron.

La moraleja, que vale para el resto del CSS de actividad: **el contenedor no es
la ventana**. Una regla que mira la forma del contenedor hay que comprobarla
midiendo el contenedor, no razonando sobre el móvil.

### Dónde se ancla el HUD, y por qué cada player declara su alto

El HUD se posiciona contra **quien lo contiene** (`:where(:has(> .edu-hud))` en
`styles/player.css`), así que la raíz del player tiene que LLENAR su hueco o
«la esquina» acaba siendo la esquina de un trozo. Suena a requisito frágil —y
lo era— pero las tres alternativas se midieron (2026-08-17) y esta gana:

| Opción | Medido |
|---|---|
| **Anclar siempre al marco** (borrar la regla) | En Individual perfecto… pero en el DUELO cada HUD pasa de 534 px (su panel) a **1100 px**: se escapa sobre el panel del rival. El día que el duelo muestre indicadores por jugador, se solapan. **Descartada.** |
| **Propagar `height:100%` a los 12** | Es la enfermedad que costó tres copias de la rueda, multiplicada por cuatro. Y no basta: Pelotas tiene TRES envoltorios, así que ninguna regla genérica del marco le llega. **Descartada.** |
| **Que cada player lo declare y la norma lo MIDA** ✅ | 12 de 13 ya lo declaraban; el 13º (Pelotas) tenía el chip a **213 px** del borde y pasaba en verde porque el escaneo contaba nodos. Ahora `matrix-smoke` mide la distancia a la esquina (tope 48 px) y el siguiente que se equivoque falla en rojo. |

La lección general: el problema no era que cada plantilla declarara su alto —era
que **nadie comprobaba el resultado**. Con la medida puesta, doce «funcionan por
accidente» pasan a ser doce verificados.

**Aplazado con motivo**: mover el HUD al MARCO, como el botón de pantalla
completa —que vive ahí y por eso nunca ha tenido este fallo—. Quitaría el
requisito de raíz, pero toca los 13 players, los dos shells y los paneles del
duelo (donde «el marco» es el panel, no la página). Con la medición puesta, su
beneficio baja de «evita un fallo invisible» a «evita un rojo de CI de un
minuto», y a ese precio no compensa. Se retoma si algún día el duelo necesita
indicadores por jugador.

**De dónde sale `edu-send`** (decidido 2026-08-17, corrige una regla anterior):
del **player**, no de `meta.play.submit`. Ese campo describe la **ronda
compartida** (VS · Equipos · live), que es otra pantalla: Emparejar declara
`'gesto'` porque su ronda de duelo es una elección de un toque, y aun así su
player de Individual tiene *Enviar*. Una casilla por plantilla no puede describir
cinco pantallas — que es justo el problema que Wordwall y un concurso no tienen
(allí plantilla = pantalla) y por eso copiarles el modelo salió mal.

La garantía no se pierde, cambia de sitio: la vigila `tools/matrix-smoke.mjs`
MONTANDO las 13 en Individual — **un `edu-hud`, al menos una sección CON NOMBRE
(`edu-sec--*`), como mucho un `edu-send`, y todo `[data-ww-submit]` dentro de
él**. Con UNA excepción DECLARADA (`ENVIO_ES_MECANICA`):

| Excepción | Motivo |
|---|---|
| ✓ del teclado (Operaciones) | es una TECLA: sacarla suma un toque a cada respuesta (§29) |

Empezó siendo tres —«Girar» de la Ruleta y «Listo/Cerrar» de Abre Cajas
entraban «porque su botón es la mecánica»—, pero esas dos no marcan ningún
control como envío: su acción es un GESTO. La excepción no se aplicaba nunca y
el informe presumía de un control inexistente. Una excepción que no protege
nada es una mentira que hay que mantener.

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
