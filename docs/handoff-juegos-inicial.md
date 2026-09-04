# Handoff · TRES JUEGOS PARA INICIAL — Colorear · Tangram · Rompecabezas

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha) · `tests/kind.test.mjs` (familia y techo) · `tools/costuras-divergencia.mjs`

> **Estado** (2026-09-04): decidido por el dueño («rompecabezas, tangram y colorear
> estarán en juegos»). Estudio contra las leyes hecho, referencias contrastadas,
> plan escrito, en ejecución por agentes. Lo que NO decide este doc está en §6.

## 0. De dónde sale

Un docente de **inicial** (3-6 años; muchos no leen) pidió «pintar como en los
libros de colorear» y «armar un tangram». Se investigó qué ofrecen Wordwall,
Educaplay, Toy Theater, Cokitos, PBS Kids y Khan Kids (17 mecánicas) y cómo se
construyen técnicamente (flood fill vs zonas SVG · detección de tangram resuelto ·
piezas de puzzle). Lo relevante para la decisión:

- En todas esas herramientas **colorear, tangram y puzzle traen el dibujo hecho**;
  el docente elige, no crea. Eso es exactamente la definición de JUEGO del norte
  §4c (el contenido lo pone la plantilla, no hay clave que decida el docente, el
  juego es UNO).
- Colorear **con el dibujo del profe** no encaja en ninguna familia (contenido
  suyo pero sin clave): el dueño lo resolvió poniéndolo en juegos → el dibujo lo
  trae la app.

## 1. Contraste con las leyes (hecho ANTES de escribir código)

| Ley | Qué exige aquí | Cómo se cumple |
|---|---|---|
| **Norte §4c** familia | `meta.kind: 'juego'` · `meta.skill` · `async:false` · sin biblioteca ni tarea | Los tres lo declaran; `tests/kind.test.mjs` lista los juegos a conciencia |
| **Norte §4c** techo | máximo 8 juegos | Pasan a **4 de 8** (Pelotas + 3) |
| **Norte §1** escena | quien toca puede ser un niño «de 8-12 años» | **Público nuevo** (3-6, no lee): pide una línea en el norte — ver §6. Mientras, cero texto dentro del juego: el gesto es la instrucción |
| **§0** cuatro capas | la plantilla DECLARA, no sabe en qué modo corre | `modes: {solo:true, live:false, async:false}` · `play: {vs:'none', teams:'none', live:[]}` — una mecánica a medias nunca aparece en VS/Equipos (CLAUDE.md) |
| **§3** estilo | nada de px fijos ni `#hex` en el juego | Piezas y zonas en `%`/`cq*` sobre un `viewBox`; los COLORES de la paleta y de los dibujos son DATO (van inline desde JS, como las bolas de Pelotas), no CSS |
| **§21b** un dueño | una regla, un sitio | Un banco de dibujos (`assets/juegos/dibujos/*.svg`) lo comparten Colorear y Rompecabezas: el mismo SVG se pinta sin relleno (colorear) o con él (puzzle) |
| **§23** vista | relojes por primitivo · `alive()` · `observeResize` | Sin relojes (ninguno de los tres cuenta tiempo en v1) · arrastre con `pointerdown` como `templates/ballsort/render/drag.js` |
| **§24** contenido | ids con `rid()`, `defaultContent` válido, migrate si versión>1 | `templateVersion:1`; el contenido es el nivel elegido, no creación del profe |
| **§25** capacidad | límites UNO | Banco: ≤ 12 SVG · ≤ 12 KB cada uno · sin fotos (una foto pasa de 80 KB; una ilustración SVG no) |
| **§28** R2/R2b | ≤ 2 opciones de partida, ya elegidas · nada destructivo en el marco | Opción única «dibujo/figura» con valor por defecto; ninguna otra |
| **§29** presupuesto | jugar sin diálogos · nadie revela solo | Sin modales; la pista es pasiva (silueta gris · imagen fantasma) |
| **§30** alcanzable | todo módulo con importador | Registro por `core/registerTemplates.js` (lo hace el generador) |
| **§31** costuras | una cabecera · fin por el shell · B8 | `cabeceraHtml` primer hijo · `ctx.finish()` del shell libre · `costuras-divergencia` en 0 |
| **Roles del player** | `edu-cabecera` · `edu-sec--*` · `edu-send` solo si el envío se construye | Colorear: `submit:'boton'` con UN «Listo» (`data-ww-submit`, la única forma de decir «terminé» sin clave); Tangram y Puzzle: `submit:'gesto'` (encajar la última pieza ES terminar) |
| **Contrato** | scorer `{correct, points, hits, total}` | Colorear: `hits` = zonas pintadas / `total` zonas, `correct` = ≥1 pintada · Tangram: piezas bien / 7 · Puzzle: piezas en su sitio / N |

## 2. Decisiones técnicas (contrastadas con la investigación)

| Juego | Investigación recomendaba | Decisión aquí y por qué |
|---|---|---|
| **Colorear** | flood fill en canvas, porque el clipart libre no trae zonas cerradas | **Zonas SVG** (`<path data-zona>` → tocar = rellenar), porque el banco lo **dibujamos nosotros** con zonas cerradas garantizadas: sin fugas, sin canvas de 1200 px en una pizarra lenta, escala sin píxeles (§3) y sin problema de licencia. Si algún día entra clipart ajeno, se audita zona a zona |
| **Tangram** | máscara raster (XOR de área) al soltar; girar con UN toque (45°), voltear con doble toque, imán a 15° y rejilla | Igual, pero el XOR se calcula en una MATRIZ DE BITS pura (`game/mascara.js`, testeable en Node sin canvas) UNA vez por soltar. **Siluetas: 2** (cuadrado · casa, ésta con coordenadas del dueño). Se pidieron 10 y el agente entregó 8 blobs conexos pero irreconocibles: se BORRARON (§30) antes que enseñar a un niño un «gato» que no lo es. Faltan gato · barco · cisne · conejo · pez · árbol: entran por la misma estructura cuando haya lámina de referencia (ver §6) |
| **Rompecabezas** | cuadrícula N×N sobre imagen fantasma, sin pestañas ni rotación, 6-12 piezas | Igual, y **sin canvas**: cada pieza es un `<div>` con `background-image` del mismo SVG y `background-position` por celda. Tres tamaños: 2×2 · 2×3 · 3×3 |
| **Al terminar** | celebración corta sin texto | `emitGame(PODIUM)` (confeti y sonido ya existentes) + la pantalla estándar del shell — la regla del fin de partida no tiene excepciones |
| **Objetivo táctil** | ≥ 48 px CSS, más para 3-6 años | Piezas ≥ 12 % del lado corto del marco; las zonas de colorear se dibujan gordas a propósito |

## 3. El banco de dibujos (compartido)

`assets/juegos/dibujos/<nombre>.svg`, `viewBox="0 0 100 100"`, cada zona un
`<path>` cerrado con `data-zona="pelo"` y `data-color="#f4c542"` (el color con que
el rompecabezas lo muestra y el que Colorear NO muestra). Trazo negro uniforme
(`stroke-width` 2.5) para que se lea a 3 m. Ocho para empezar: casa · pez ·
flor · coche · globo · gato · sol · mariposa. Un `index.js` los lista con nombre
y nº de zonas (lo lee `defaultContent` de los dos juegos). Sin texto dentro del SVG.

## 4. Reparto entre agentes (ficheros DISJUNTOS)

El esqueleto (modelos registrados, carpetas por el generador, entradas en
`kind.test`/`styles.test`/`homePreview`) lo hace el orquestador ANTES. Luego, en
paralelo:

| Agente | Ficheros suyos |
|---|---|
| **A · Colorear + el banco** | `templates/colorear/**` · `styles/colorear.css` · `assets/juegos/dibujos/**` · `tests/colorear.test.mjs` |
| **B · Tangram** | `templates/tangram/**` · `styles/tangram.css` · `tests/tangram.test.mjs` |
| **C · Rompecabezas** | `templates/puzzle/**` · `styles/puzzle.css` · `tests/puzzle.test.mjs` (lee el banco de A: si aún no existe, usa dos SVG de prueba propios en su carpeta y lo dice) |

Reglas de agente (skill `/auditoria` §3b): editan, NUNCA git; no tocan ficheros
ajenos; cada test con contra-prueba; `node tools/check-template.mjs <name>` y
`node tests/run.mjs` en verde antes de informar.

## 5. Verificación de salida

`node tools/check-template.mjs` × 3 · suite · `matrix-smoke` (las 16 plantillas
× modos; los juegos solo en Individual) · `costuras-divergencia` en 0 · preflight
14/14 · sonda visual de los tres montados (captura) · `#/juegos` muestra 4.

## 6. Lo que este plan NO decide (dueño)

1. **La línea del norte para el niño que no lee** (§1): hoy `meta.instructions`
   es texto obligatorio. Propuesta: «(c) el que toca puede no saber leer: en
   inicial la instrucción es el gesto, y la frase es para el profe».
2. **La habilidad de Colorear**: el cuadro del norte §4c no tiene fila para
   «motricidad fina». Se declara `skill: 'Motricidad fina'` y se propone la fila;
   Tangram y Rompecabezas van en **Espacial**, que ya existe.
3. **Láminas del tangram**: no hay dataset libre de figuras clásicas con coordenadas y sin lámina de referencia el agente no logró figuras reconocibles. Con una foto de un juego de cartas de tangram (el docente seguro tiene) se transcriben a mano: una tarde por figura.
4. **Calidad del banco**: ocho dibujos hechos a mano por un agente. Si se
   quieren ilustraciones profesionales, entran por la misma puerta (zonas
   cerradas con `data-color`) sin tocar código.
