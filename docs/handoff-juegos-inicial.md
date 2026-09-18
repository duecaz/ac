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

`node tools/check-template.mjs` × 3 · suite · `matrix-smoke` (las plantillas
× modos; los juegos solo en Individual) · `costuras-divergencia` en 0 · preflight
14/14 · sonda visual de los tres montados (captura) · `#/juegos` muestra 4.

## 6. Lo que este plan NO decide (dueño)

1. ~~La línea del norte para el niño que no lee~~ **DECIDIDO (v1.51.671)**: norte §1(c) —
   la instrucción es el gesto, `meta.instructions` es para el docente, objetivo táctil
   ≥ 12 % del lado corto del marco, medido por `matrix-smoke` en pantalla completa.
2. ~~La habilidad de Colorear~~ **DECIDIDO (v1.51.671)**: fila «Motricidad fina» en el
   cuadro del norte §4c; y §4c dice por escrito que lo de inicial entra por la
   estantería de juegos, nunca como opción escondida en un juego.
3. **El tangram, después** (dueño, 2026-09-04: «primero los bugs y la estructura»): (a) que el docente
   haga figuras con las 7 piezas en el EDITOR y eso se vuelva la silueta (con las piezas usadas
   marcadas) — es exactamente el mecanismo de la lámina, sin lámina; (b) y con eso, cargar
   ejemplos buscados. Deuda del tangram, no de esta entrega.
4. **Láminas del tangram**: no hay dataset libre de figuras clásicas con coordenadas y sin lámina de referencia el agente no logró figuras reconocibles. Con una foto de un juego de cartas de tangram (el docente seguro tiene) se transcriben a mano: una tarde por figura.
5. **Calidad del banco**: ocho dibujos hechos a mano por un agente. Si se
   quieren ilustraciones profesionales, entran por la misma puerta (zonas
   cerradas con `data-color`) sin tocar código.

---

## 7. COLOREAR, SEGUNDA MIRADA (2026-09-17) — el banco y el gesto

El dueño entró a crear una actividad de Colorear y encontró tres cosas. Las dos
primeras eran defectos y están arregladas; la tercera es una decisión suya.

### 7a · Lo que estaba roto (arreglado en v1.51.702)

El editor escribía `.co-ed-grid`, `.co-ed-pick`, `.co-ed-mini` y
`.co-ed-pick--on`, y **ninguna de las cuatro tenía una regla de CSS en ninguna
hoja**. El markup se escribió y nunca se le puso estilo, así que la rejilla no
era rejilla, la miniatura era el mismo icono genérico de Bootstrap para los ocho
dibujos, y «elegido» no se veía porque la clase que lo marca no pintaba nada: el
profe tenía ocho botones idénticos sin saber cuál había tocado.

Ahora la miniatura es **el SVG de verdad** (~700 B cada uno, y nacen con
`fill="#ffffff"` y trazo negro: se ve exactamente la lámina que va a repartir), y
lo elegido lleva **tres señales** —borde grueso, fondo teñido y una marca de
visto—, no una sola, porque un borde de color es lo primero que se pierde en un
proyector descalibrado.

> Es una costura de las de §31: markup sin CSS que lo lea. Vale la pena decidir
> si se vigila con una regla («toda clase que emite un editor tiene una regla en
> alguna hoja»), porque este mismo fallo es invisible en revisión.

### 7b · El banco no es el problema de la mecánica, es de contenido

Con las miniaturas puestas se ve lo que antes no: **los ocho dibujos no son
dibujos**. «Gato» es un círculo con dos triángulos y un rombo; «Sol», un rombo
con un círculo; «Mariposa», cuatro óvalos. El §6.5 ya lo decía sin verlo («ocho
dibujos hechos a mano por un agente»).

Fuentes libres de verdad, con su licencia comprobada:

| Fuente | Cuánto | Licencia | Sirve tal cual |
|---|---|---|---|
| **Openclipart** | ~180.000 | **Dominio público / CC0**, sin atribución | La licencia ideal. Pero su línea suele ser trazo o un `path` compuesto, **no regiones cerradas rellenables** |
| **OpenMoji** | ~4.000, con variante **de contorno negro ya dibujada** | **CC BY-SA 4.0** | El arte está listo… y el *share-alike* es CONTAGIOSO: la actividad que el profe publique en la biblioteca heredaría la licencia. Eso es una decisión de producto, no de código |
| publicdomainvectors · freesvg.org | espejos de Openclipart | CC0 | Igual que Openclipart |
| Freepik · Flaticon | mucho | atribución obligatoria y licencia restrictiva | **Descartadas** para contenido que se publica |

**El cuello de botella no es encontrar dibujos: es convertirlos a zonas
cerradas** con `data-zona`/`data-color`, que es lo que exige la mecánica actual.
Tres salidas, con su coste:

1. **Dibujarlos a mano** (lo que se hizo): una hora por dibujo bien hecho.
2. **Importar y trocear** en Inkscape: cerrar regiones y etiquetarlas, 15-30 min
   por dibujo con la rutina montada, más una herramienta que valide el contrato.
3. **Cambiar el gesto** (§7c): si se pinta a mano alzada, **las zonas dejan de
   hacer falta** y los 180.000 de Openclipart entran sin conversión ninguna.

La tercera es la que de verdad quita el problema, y por eso no es solo una
cuestión de motricidad.

### 7c · Tocar para rellenar vs. PINTAR con el dedo

Lo que entrena colorear en inicial es **el trazo**: control de dirección, presión
y no salirse de la raya. Tocar una zona y que se rellene sola entrena *apuntar*,
que es otra habilidad y mucho más pobre. Con la pantalla táctil delante, pintar
de verdad es el gesto que corresponde a la ficha «Motricidad fina» que el norte
§4c ya le asignó a este juego.

> La evidencia publicada sobre colorear y motricidad fina en infantil es amplia,
> pero la que compara **tableta contra papel** es escasa y de revistas menores:
> sirve para no ir a ciegas, no para zanjar nada. Lo que sí es firme es qué
> habilidad entrena cada gesto.

**El coste es menor de lo que parece, y es la razón para mirarlo ahora**: el
motor de tinta YA ESTÁ HECHO y endurecido contra pizarras reales —
`core/textCorrectionDraw.js` + `core/penDetector.js` + `core/penCalibration.js`:
lienzo por DPR, trazos, dos herramientas (dedo/lápiz dibujan, palma borra), el
veredicto aplazado para que la palma no deje rastro, y su sonda en el preflight
(`tools/lapiz-sonda.mjs`). Lo que falta no es el dibujo: es **recortar la tinta
a la silueta** y un scorer nuevo.

Y ahí hay una decisión bonita que el dueño debe tomar:

- **Recortando** la tinta al contorno (`clip-path` con el propio SVG), no se
  puede salir de la raya: es amable y frustra menos.
- **Sin recortar**, salirse ES posible — y entonces el marcador puede medir *qué
  porcentaje quedó dentro*, que es una medida real de motricidad, muy superior
  al «zonas tocadas» de hoy. Pero castiga al que aún no controla el trazo.

Lo que NO hay que hacer es elegir por el niño en silencio: cabe como **opción de
partida** (`meta.play.options`, `core/playOptions.js`) con el tope de R2 —
máximo dos, ya elegida: *«Pintar: tocando / con el dedo»*.

### 7d · Lo que decide el dueño

1. **¿Se añade el trazo libre?** Estimación con el motor de tinta reutilizado:
   un día para el pincel recortado a la silueta + scorer + red en la sonda del
   aula. Sin él, el banco seguirá costando una hora por dibujo.
2. **¿Se acepta CC BY-SA?** Si sí, OpenMoji da mañana mismo ~4.000 contornos ya
   dibujados. Si no, la vía es Openclipart (CC0) y entonces el trazo libre pasa
   de «mejora» a «lo que hace viable el banco».
3. **¿Salirse de la raya puntúa?** Es lo que convierte este juego en una medida
   de motricidad y no en un pasatiempo.

### 7e · EJECUTADO (v1.51.704) — el banco nuevo y el trazo libre

El dueño decidió las tres cosas de §7d de una vez: **acepta CC BY-SA**, **se
añade el trazo libre**, y pidió recursos «cerrados temáticos». Hecho, y las dos
primeras decisiones resultaron ser la misma:

**Las láminas de contorno de OpenMoji son `fill="none"` con trazo — línea pura,
sin una sola región rellenable.** Para tocar-y-rellenar no sirve ni una. Para
pintar con el dedo son exactamente lo que hace falta. Por eso el trazo libre no
es un adorno pedagógico: es lo que abre 4.000 láminas dibujadas por
ilustradores sin convertir nada, y lo que hace que el banco deje de costar una
hora por dibujo.

- **43 láminas en 5 temas cerrados** (animales 12 · frutas 8 · naturaleza 8 ·
  transporte 8 · cosas 7), importadas con `tools/importar-dibujos.mjs`, que se
  puede volver a correr para añadir más. Créditos y licencia en
  `assets/juegos/dibujos/CREDITOS.md`; cada fichero lleva el suyo dentro.
- **Se descartó el balón** (U+26BD) al VERLO: sus pentágonos son negros de
  diseño y como lámina para colorear es una mancha. Lo que se importa se mira.
- **Dos capas**: el lienzo donde se pinta va DEBAJO y la lámina encima. Como la
  lámina es transparente, la tinta se ve por los huecos y el trazo negro no se
  puede tapar. La alternativa —recortar la pintura al contorno— cuesta más y
  quita justo lo que se entrena: salirse tiene que ser POSIBLE para que no
  salirse signifique algo.
- **El scorer mide cobertura**, no zonas tocadas, con techo en el 35 %:
  emborronar el lienzo entero no puede puntuar más que colorear bien.

**EL BANCO SE PARTIÓ EN DOS, y conviene entender por qué** (§21b decía «un banco,
un dueño»): Rompecabezas no recorta piezas a ciegas — deduce dónde está la
figura dentro del lienzo a partir de las zonas `data-color`, y sin ellas el
recorte deja piezas vacías. Colorear quiere la mejor ilustración posible;
Rompecabezas quiere zonas. Compartir un banco que sirve a medias a los dos
habría degradado el puzzle EN SILENCIO para no tocar una regla. Ahora son
`DIBUJOS` (43, línea + color) y `DIBUJOS_PUZZLE` (las 8 originales, en
`dibujos/zonas/`), con dos contratos escritos.

**Lo que queda** (no es deuda oculta, es la siguiente tanda):

1. **El arte del rompecabezas sigue siendo el feo.** Para darle las láminas
   buenas hay que enseñarle a `viewBoxAjustado` a encontrar la figura sin
   `data-color` — se puede, midiendo la caja de los trazos, pero es una tanda
   aparte con su propia red.
2. **Tocar-y-rellenar desapareció.** Si algún día se quiere de vuelta (para un
   ratón, o para quien no controla el trazo), cabe como opción de partida con el
   tope de R2 — y entonces hará falta un banco con zonas de arte decente, que es
   convertir las variantes EN COLOR de OpenMoji (sí traen formas cerradas) con
   la regla de solapes relajada, porque el arte real solapa.
3. **Salirse de la raya no puntúa todavía.** La cobertura se mide contra el
   lienzo entero, no contra la silueta. Medirlo contra la figura es lo que
   convertiría esto en una medida de motricidad de verdad.
