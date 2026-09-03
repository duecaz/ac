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
  - Especializados: `--key-*` (teclado), `--display-*` (visor), `--math-*`, `--opt-*` (la opción de respuesta, `styles/opcion.css`)
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

- **Ejemplares**: `styles/math.css` y `styles/opcion.css` — 0 fija, 0 color a pelo, 0 techo. Cópialos
  de referencia. La suite los verifica limpios en cada corrida.
- **Checklist al crear una actividad**:
  1. ¿Alguna `font-size` en `px/rem/em` sin `cq/%` ni piso `max()`/`clamp()`? → relativízala.
  2. ¿`color`/`background` con `#hex` que no sea neutro ni estado? → token `var(--ww-*)`.
  3. Corre `node tests/styles.test.mjs`. Debe pasar **sin tocar el BASELINE**.

## 3b0. Los TRES roles del player (2026-08-17, revisado el 2026-09-03)

Todo player se lee con tres roles — el prefijo `edu-` marca lo nuevo:

| Rol | Qué es | Regla |
|---|---|---|
| **`edu-cabecera`** | la CABECERA: herramientas · página/racha/extra · RELOJ centrado · pantalla completa | **una sola**, la misma en las 13 (`core/playerHud.js`, `cabeceraHtml`). La plantilla aporta SOLO sus herramientas —lápiz/borrador (Tildes/Comas), Aa/Deshacer (Pelotas), pista/reiniciar (Crucigrama; *Verificar* es envío y vive en `edu-send`)—; lo demás lo pone la cabecera. El aspecto lo pone la superficie de debajo, por tokens (`--cab-tinta`/`--cab-fondo`): sobre el marco, los del tema; sobre la hoja de Tildes/Comas, los del papel |
| **el juego** (`edu-sec`) | todo el alto restante, en subsecciones CON NOMBRE (`edu-sec--enunciado`, `--tablero`, `--texto`, `--pistas`, `--banco`, `--panel`, `--campo`) | refluyen con el contenedor (**ancho estrecho O más alto que ancho**, ver abajo); el **enunciado es la primera subsección**, no una barra |
| **`edu-send`** | el espacio del botón de enviar | UNO como mucho, y todo control de envío dentro (marcador sobre `ww-bar-actions`/`tc-done-wrap`/`cw-footer`) |

**POR QUÉ ERAN CUATRO Y AHORA SON TRES** (dueño, 2026-09-03: «solo estás
parchando, piensa mejor»). Los roles nacieron con los indicadores FLOTANDO
(`edu-hud`) y una barra aparte solo para quien tuviera herramientas
(`edu-topbar`). Medido montando las 13: la misma franja tenía **tres**
tratamientos —9 con los chips flotando y el botón en la esquina, 2 con banda
propia, 2 repartidos entre su barra y la esquina—. Y el motivo original de no
dibujarla (ganar alto) ya no se sostenía: `styles/player.css` RESERVABA
`max(30px, 6.5cqmin)` arriba en cuanto el reloj estaba visible, para que los
chips no taparan el juego. La franja estaba pagada y no se dibujaba. Lo que
sigue prohibido —y era lo que robaba entre el 4 % y el 25 % del alto— es la
**cabecera con TÍTULO**.

Y dos prohibiciones que salieron del inventario (`docs/piezas-por-actividad.md`):
el **título** de la actividad vive en la antesala (inicio · setup · lobby · ficha de
la tarea), jamás dentro del juego; y una **pieza sin clase propia** (solo utilidades
de Bootstrap) no se puede repartir — nómbrala.

**LOS ICONOS SON DE LUCIDE, EN LÍNEA, Y CON UN DUEÑO**: `core/lucide.js`
(`lucide('timer')`). SVG pegado, nunca una librería de CDN —la app no depende
de la red, la misma lección que la CDN de Bootstrap y las webfonts— y nunca un
EMOJI haciendo de icono: el «⏱» viajaba pegado al valor dentro de
`core/reloj.js`, así que el dueño del tiempo mandaba sobre el aspecto de dos
superficies a la vez (el chip del HUD y la banda de Tildes). El reloj entrega
el número; el icono lo pone la superficie que pinta. El SVG mide `1em` y toma
`currentColor`, así que crece con la letra de su mando y se recolorea con el
token del skin (§3) sin CSS que acordarse de añadir. Añadir un icono = una
entrada más en el diccionario de `core/lucide.js`; ninguna otra.

**Cómo se marca**: DOBLE CLASE — `class="edu-sec edu-sec--tablero cw-grid-wrap"`.
El rol es lo que se escanea y se verifica; el nombre propio se queda con su CSS y
con lo que apuntan los skins. Así el vocabulario entra sin un renombrado masivo y
sin tocar los temas. La cabecera es la excepción: **no lleva nombre propio**,
porque no es de la plantilla — es la misma pieza para las trece.

**EL FINAL DE LA PARTIDA es del mismo dueño único**: lo pinta el SHELL
(`core/resultScreen.js`, montado desde `core/soloPlayer.js`); una plantilla
puede AÑADIR encima (`title`/`icon`/`stats`/`after` que digan la verdad de
cómo acabó) pero no SUSTITUIRLO por un cartel propio. Medido el 2026-09-04
montando las 13: once terminaban con la estándar, el Crucigrama pintaba su
propio `.cw-celebration` que dejaba al alumno sin puntaje ni salida al
cerrarse, y Abre Cajas se la saltaba con un `skipResultScreen: true` suelto
y sin motivo. Se pensó un mapa de excepciones con motivo y el dueño lo cerró
el mismo día: **sin salida** — `skipResultScreen` ya no existe en el shell,
Abre Cajas añade «N / N cajas» sobre la estándar, y cualquier player que lo
pida lo caza `tools/costuras-divergencia.mjs` en CI.

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

### Por qué la cabecera está EN EL FLUJO (y ya no se ancla a nada)

Hasta 2026-09-03 los indicadores FLOTABAN en la esquina, posicionados contra
**quien los contenía** (`:has(> .edu-hud)`), así que la raíz de cada player
tenía que LLENAR su hueco o «la esquina» acababa siendo la esquina de un trozo.
Aquello era un requisito frágil sostenido por una medida: `matrix-smoke`
comprobaba que el chip quedara a ≤48 px del borde, porque Pelotas lo tenía a
213 px, en mitad del tablero, y pasaba en verde por contar nodos.

Se documentó entonces un **aplazado con motivo** —«mover el HUD al MARCO, como
el botón de pantalla completa»— descartado porque tocaba los 13 players. La
unificación de la franja lo resolvió por otra vía y sin ese coste: la cabecera
**no se ancla**, es un `<header>` en el flujo, primer hijo de la raíz. Ya no hay
«esquina» que calcular, ni depende de que el player llene su hueco, ni se
escapa sobre el panel del rival en el duelo (era la objeción que descartaba
anclar al marco). Lo que sí se conserva es la MEDIDA, con otra geometría: la
cabecera tiene que quedar pegada arriba y a todo el ancho de su raíz
(`TOPE_CABECERA` en `matrix-smoke`), y se comprueba en cuatro ventanas.

La lección general se mantiene y es la que importa: el problema nunca fue que
cada plantilla declarara su alto —era que **nadie comprobaba el resultado**.

**De dónde sale `edu-send`** (decidido 2026-08-17, corrige una regla anterior):
del **player**, no de `meta.play.submit`. Ese campo describe la **ronda
compartida** (VS · Equipos · live), que es otra pantalla: Emparejar declara
`'gesto'` porque su ronda de duelo es una elección de un toque, y aun así su
player de Individual tiene *Enviar*. Una casilla por plantilla no puede describir
cinco pantallas — que es justo el problema que Wordwall y un concurso no tienen
(allí plantilla = pantalla) y por eso copiarles el modelo salió mal.

La garantía no se pierde, cambia de sitio: la vigila `tools/matrix-smoke.mjs`
MONTANDO las 13 en Individual — **una `edu-cabecera`, al menos una sección CON NOMBRE
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

> **DOS BANDAS COMO MUCHO, y la de arriba dice la verdad entera.** La Sopa llegó a
> tener TRES rangos de `aspect-ratio` encadenados: la regla base acotaba los dos
> ejes, la banda vertical soltaba el alto «para colocar el aire» y una tercera
> banda (`< 1/1 and > 3/4`) devolvía el alto solo en el tramo donde eso desbordaba.
> Medidas las cinco formas (móvil alto · casi cuadrada · PC 4:3 · pizarra 4K ·
> tableta vertical), la de en medio no aportaba nada: acotar los dos ejes en toda
> la vertical da la MISMA rejilla en las cinco y encima reparte mejor el aire.
> **Rangos numéricos que se acumulan uno tras otro son la señal de que la regla de
> arriba estaba bien y alguien la fue recortando** — cada banda nueva se descubrió
> midiendo una pantalla concreta, y la siguiente pantalla sin medir es la próxima
> banda. Antes de añadir un rango, mide las formas que ya funcionan.

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
