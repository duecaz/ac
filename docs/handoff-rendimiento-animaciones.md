# Plan · RENDIMIENTO DE LAS ANIMACIONES — la pizarra 4K no es el portátil

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha) · cuando se ejecute, `tools/perf-sonda.mjs` y una red nueva de animaciones

> Pedido por el dueño el 2026-09-12: «la app es muy lenta en las animaciones —el
> confeti, la soga del VS— y en Wordwall no se ralentizan en pantallas
> interactivas básicas 4K». Y la decisión: «no vamos a distinguir: las
> animaciones deben ser las mismas en todas las pantallas, como Wordwall».

## Diagnóstico (medido en el código, no adivinado)

La pizarra del aula es **1280×720 CSS a DPR 3** (3840×2160 píxeles reales) con
una GPU modesta (RK3588/Mali) y Chrome 123. Tres cosas se juntan:

1. **La soga es un SVG que se re-dibuja entero cada cuadro.** `assets/animations/
   cuerda.json` pesa 143 KB: 90 cuadros y **153 trazados** en una sola capa.
   `lottie_light` solo tiene renderer SVG, y `core/vsAnimations.js` mueve la
   cuerda con `goToAndStop()` en un bucle de reposo continuo a ~25 fps: cada
   tick recalcula los 153 trazados, reescribe el DOM del SVG y el navegador lo
   rasteriza a 3840×2160. Eso es trabajo del HILO PRINCIPAL, no de la GPU: por
   eso el teclado del duelo se traba.
2. **La puerta «gama baja» no se abre en la pizarra.** El detector de aparato
   (`isLowEndDevice()`, en un módulo `core/perf` ya retirado en la Fase 5) decidía
   `ww-lite` por hardware (≤4 núcleos o ≤2 GB). Un RK3588 tiene 8 núcleos y
   4-8 GB: para el detector es un equipo potente y la cuerda corre a pleno.
   Y `ww-lite` hoy solo apaga 3 cosas (los globos, el reposo de la cuerda, el
   arcade): el resto de animaciones infinitas no lo miran.
3. **Lo que se pinta a DPR 3 cuesta nueve veces más que a DPR 1.** Sombras de
   texto (`text-shadow` en el marcador), el foco giratorio del cierre del duelo
   (`repeating-conic-gradient` rotando 22 s en `::before`, sin capa propia),
   `filter: blur(3px)` girando en el tema TV, `box-shadow` sobre cosas que se
   mueven. Cada uno repinta una región 4K por cuadro. En un portátil 1080p a
   DPR 1 no se nota nada — que es exactamente el aparato donde se programa.

El confeti ya tiene su tope (`TOPE_LIENZO = 1280`, física escalada, medido a
8 fps antes del arreglo): no es el culpable principal, pero sale en el podio
JUNTO con el foco giratorio y los rayos, y esa suma sí se nota.

**Wordwall** no es más rápido por magia: sus animaciones son transformaciones
CSS (`transform`/`opacity`, que van por el compositor) y confeti en un lienzo
pequeño. No mantiene un SVG vivo de 153 trazados en reposo.

**Por qué la sonda no lo vio**: `tools/perf-sonda.mjs` mide a 3840×2160 con
la CPU frenada 12×, pero a **DPR 1** y sin la escena del duelo en reposo. El
coste de DPR 3 (sombras, blur, gradientes) no está modelado.

## La decisión (dueño, 2026-09-12): las MISMAS animaciones en todas las pantallas

No hay «modo ligero». No se distingue por aparato. Cada animación se construye
para que cueste lo mismo en un portátil y en la pizarra 4K — que es lo que
hace Wordwall — y eso solo se consigue con dos materiales:

- **Lo que hace la GPU**: `transform` y `opacity`. Mover, girar, escalar,
  desvanecer. Cuesta igual a 1080p que a 4K porque el compositor no repinta
  píxeles, mueve capas.
- **Lienzos pequeños y con tope**: un `<canvas>` de 1280 de ancho estirado por
  CSS (lo que ya hace el confeti). Se pinta lo mismo en todas las pantallas;
  el estirado es gratis.

Y con una prohibición: **nada que repinte píxeles cada cuadro** — ni SVG
re-dibujado, ni `filter`/`blur`, ni sombras sobre lo que se mueve, ni
gradientes que giran sin capa propia. Ese es el presupuesto; se mide en la
peor pantalla (DPR 3) y lo que no lo cumple no entra.

## Las fases

**Fase 0 · medir en el aparato real, antes de tocar.** ✅ HECHA (v1.51.684). Un medidor de fluidez
en `#/admin` (y por `?perf=1` en cualquier ruta): p50/p95 del tiempo entre
cuadros durante 5 s y cuadros >50 ms, por escena: VS en reposo con cuerda ·
VS respondiendo · podio con confeti · Quiz · Colorear. Playwright no tiene ni
la GPU ni el DPR de la pizarra; los números de verdad salen de ahí.
Entregable: la tabla «antes».

**Fase 1 · la soga, una sola y barata.** ✅ HECHA (v1.51.684-685): camino 1 (lienzo con tope) y el reposo QUIETO. Tres caminos, en orden de
preferencia, y se elige con los números de la Fase 0 delante:
1. **`lottie-web` con renderer `canvas`** sobre un lienzo con tope de 1280
   (el mismo truco del confeti). Se conserva la animación tal cual (misma
   cuerda, mismos personajes); el coste pasa de «re-dibujar 153 trazados en el
   DOM y rasterizar a 4K» a «calcular 153 trazados y pintarlos en un lienzo
   pequeño». Cuesta el build completo de lottie (280 KB, local, ya sin CDN) en
   vez del `light` (168 KB). El reposo baja de 25 a 15 fps: un balanceo lento
   no lo nota nadie.
2. **Hoja de sprites**: pre-rasterizar N cuadros una vez y hacer `drawImage`
   por tick. Es lo más barato por cuadro, pero 90 cuadros a tamaño de arena
   son decenas de MB de memoria, y a menos cuadros o menos tamaño la cuerda se
   ve a saltos o borrosa en la 4K. Solo si el camino 1 no llega.
3. **`svg-tug`** (ya en el repo): personajes por `transform` CSS, coste cero.
   Cambia el aspecto; es decisión del dueño verlo en la pizarra.

**Fase 2 · el podio.** ✅ HECHA (v1.51.684). Un solo lienzo de confeti reutilizado (hoy uno por
ráfaga, tres en el cierre), `setTransform` en vez de `save/translate/rotate/
restore` por papelito, alfa solo en los últimos 30 ticks. El foco giratorio
del cierre (`vs.css` `.vs-celebration::before`, un gradiente cónico rotando
22 s) recibe capa propia (`will-change: transform`) o se sustituye por una
imagen que gira; el `blur(3px)` girando del tema TV se rehace sin `filter`
(el desenfoque se pinta UNA vez en el SVG, no por cuadro).

**Fase 3 · la regla, como test.** ✅ HECHA (v1.51.684). Una suite nueva en `tests/` (verificada en
rojo con una animación plantada): dentro del marco de juego solo se animan
`transform` y `opacity`; nada de `filter`/`box-shadow`/`text-shadow` animados;
ningún `@keyframes` que toque `width`, `height`, `top`, `left`, `text-indent`
o `background-position` (la marquesina arcade anima `text-indent`: es layout
por cuadro, se rehace con `transform`). Añade la regla a
`docs/estilos-de-actividad.md` con su porqué (DPR 3).

**Fase 4 · lienzos con tope, todos.** ✅ HECHA (2026-09-12). El del confeti ya lo tiene (1280). El
lienzo de dibujo de Tildes/Comas (`core/textCorrectionDraw.js`) y cualquier
canvas del juego se crean a `min(devicePixelRatio, 1,5)`: a esa escala el
trazo del lápiz se ve igual y cuesta la mitad o menos.

**Fase 5 · retirar `ww-lite`.** ✅ HECHA (2026-09-12): borrados el detector, la
clase y sus tres bifurcaciones (globos, reposo de la cuerda, arcade) y la mitad
de papelitos del confeti; el `ww-lite` que fingía la sonda tampoco hace falta. Cuando la soga, el podio y las hojas cumplan
el presupuesto, la clase `ww-lite`, `isLowEndDevice()` y las tres bifurcaciones
que hoy dependen de ella (globos, reposo de la cuerda, arcade) se BORRAN: una
sola animación por sitio, la misma en todas las pantallas. Si algún día hace
falta una salida de emergencia, será un mando del profe, no una detección.

**Fase 6 · la sonda es la puerta.** ✅ HECHA (v1.51.684). `tools/perf-sonda.mjs` gana la escena
«pizarra»: viewport 1280×720 con `deviceScaleFactor: 3` (el aparato del aula
tal cual), y las escenas «VS en reposo con cuerda» y «podio del duelo». Con
la CPU frenada 12×. Una animación nueva que no pase ahí no entra en `main`.

## Cómo EXPORTAR una animación Lottie que quepa en la pizarra

Pedido por el dueño el 2026-09-14 («¿cómo exporto las animaciones de Lottie?
¿cómo minimizamos lo que consume?»). Lo que sigue sale de medir el fichero que
ya está en producción, `assets/animations/cuerda.json`:

| Qué tiene | Cuánto |
|---|---|
| Trazados | 153 |
| Rellenos sólidos | 131 |
| Rellenos con DEGRADADO | 4 |
| Grupos (cada uno con su transformación) | 158 |
| Vértices en los trazados | 1.702 |
| **Propiedades realmente animadas** | **31** |
| Máscaras · mattes · expresiones | 0 · 0 · 0 |
| Lienzo nativo · cuadros · fps declarado | 620×360 · 90 · 30 |

**El dato que manda es el último de los primeros**: de 158 grupos, solo 31
propiedades se mueven. Cada vez que se pide un cuadro se vuelve a rasterizar el
dibujo ENTERO —los 153 trazados, los 1.702 vértices— para mover 31 cosas. Por
eso el coste no baja pidiendo menos cuadros por segundo: baja no repitiendo el
trabajo (de ahí el caché de cuadros en `core/vsAnimations.js`).

Lo que sí se puede hacer al EXPORTAR, por orden de lo que más ahorra:

1. **Menos trazados.** 153 para dos personajes y una cuerda es mucho: suele
   venir de no unir formas del mismo color, de grupos duplicados y de detalles
   invisibles a tamaño real. Unir y borrar ahí es lo que más se nota.
2. **Nada de degradados** si se puede evitar. Un relleno con degradado cuesta
   varias veces más que uno sólido al pintar en lienzo; aquí hay 4.
3. **Ni máscaras ni capas de recorte (mattes).** Son lo más caro de Lottie en
   lienzo. Este fichero no tiene, y así debe seguir.
4. **Ni expresiones.** Se evalúan en JavaScript en cada cuadro. Si la animación
   las usa, se hornean a fotogramas clave antes de exportar. Este fichero
   tampoco tiene.
5. **Sin imágenes incrustadas**: que sea vectorial de punta a punta, o el
   `.json` engorda y el aula sin internet lo paga al cargar.
6. **El tamaño del lienzo, pequeño.** 620×360 está bien: la plataforma estira
   por CSS y el estirado es gratis. Exportar a 1920 no mejora nada y multiplica
   lo que cuesta cada píxel pintado.
7. **Los fps y el número de cuadros casi no importan** en nuestro uso: el duelo
   no reproduce la animación, la RECORRE (el cuadro lo elige el marcador). Menos
   cuadros solo aligeran el fichero.

Y la regla de oro del formato, que ya está escrita en `core/vsAnimations.js`:
la animación se autora en UNA línea de tiempo donde el cuadro 0 es «gana el de
la izquierda», el del medio es empate y el último «gana el de la derecha».

## LA FLUIDEZ DE LOS JUEGOS, MEDIDA — y por qué Wordwall se ve mejor

Pedido por el dueño el 2026-09-14: «las animaciones en Wordwall son mejores;
¿cómo construimos mejor las nuestras, o usamos otra tecnología? Ya no Lottie
sino JSON directo u otras librerías».

### Primero el dato, porque cambia el planteamiento

Medidos TODOS los juegos del catálogo en reposo, en la pizarra del aula
(1280×720 a DPR 3, CPU frenada 12×), mediana de milisegundos por fotograma:

| Qué | ms/cuadro | Lectura |
|---|---|---|
| Cualquier juego del catálogo, en reposo | 16,5 – 17,0 | 60 fps, todos sin excepción |
| Confeti del podio | ~44 | 23 fps mientras dura la ráfaga |
| **Soga del duelo meciéndose** | **~58** | **17 fps, y es lo único continuo** |

**La falta de fluidez no está repartida por los juegos: está en dos sitios.**
Ningún jugador baja de 60 fps con nadie tocando nada. Así que «mejorar la
fluidez de los players» no es un trabajo de quince frentes — son dos piezas, y
una de ellas (la soga) es la que el dueño ve todo el rato.

Y hay un detalle que explica por qué se NOTA tanto: el reposo pide un cuadro
cada 40 ms y tarda 58. No es que vaya lento de media, es que **llega tarde a
cada cita**, y eso es justo lo que el ojo lee como tirón. Un movimiento a 25
cuadros REGULARES se ve mejor que uno a 30 irregulares.

### Qué hace Wordwall de verdad (y no es una librería mejor)

Su propia página «about» describe la arquitectura sin ambigüedad: separan la
LÓGICA del juego de la VISTA, y **la vista dibuja SPRITES sobre un fondo de
parallax por capas usando las APIs de Canvas y de Audio**. Los temas son
**marcado XML** que describe conjuntos de gráficos, sonidos y secuencias de
animación — cambiar el tema cambia el aspecto del mismo juego. Todo escrito en
C# y compilado cruzado a JavaScript. Hay incluso volcados públicos de sus
atlas de sprites, que confirman que el arte viaja ya rasterizado.

O sea: **no tienen mejor tecnología de animación, tienen otro MATERIAL**. Mueven
mapas de bits por traslación, que es la operación más barata que existe en una
pantalla. Nosotros re-teselamos 153 trazados vectoriales 25 veces por segundo
para mecer una cuerda. La sensación de calidad que el dueño admira sale del
arte, del sonido y de que el movimiento no cuesta nada — no del runtime.

### Las alternativas, con los pesos medidos

Punto de partida real: `lottie_light_canvas-5.13.0.min.js` son 55 KB
comprimidos y el JSON de la cuerda, 28 KB. Total 83 KB.

| Opción | Runtime (gzip) | Coste por cuadro | ¿Sirve sin build ni internet? |
|---|---|---|---|
| **Lottie canvas (hoy)** | 55 KB + 28 KB de datos | re-teselar 153 trazados | sí, ya está |
| **Rive** (`canvas-lite` / completo) | **443 KB** / **887 KB** | teselado en WASM / WebGL2 | sí (UMD + wasm propio), pero ver abajo |
| **dotLottie** (`.lottie` + ThorVG) | **530 KB** | WASM | sí, pero ver abajo |
| **Sprites en atlas** (PNG/WebP) | **0 KB** | un `drawImage` = copia de textura | sí, trivial |
| **Vídeo con alfa** (WebM VP9) | 0 KB | decodificación | NO fiable en Android |
| **CSS / Web Animations** | 0 KB | compositor | sí, trivial |
| **WebGL · PixiJS · Spine** | cientos de KB | — | desproporcionado |

**Lo que NO merece la pena, y por qué:**

- **Rive** cuesta entre 443 y 887 KB comprimidos de runtime. El WASM solo se
  amortiza con MUCHAS animaciones; nosotros tenemos una, decorativa. Y añade un
  editor propietario de pago por suscripción a un proyecto cuyo norte es «sin
  build, sin internet en el aula».
- **dotLottie** no aporta compresión: el `.lottie` es un ZIP del mismo JSON, y
  GitHub Pages ya lo sirve comprimido. Lo que aportaría es su reproductor nuevo,
  y cuesta 530 KB.
- **Vídeo con transparencia**: Chrome en Android se equivoca con el canal alfa
  de forma documentada e inconsistente entre aparatos (fondo negro en unos,
  transparente en otros). En una pizarra es apostar.
- **SMIL** sigue vivo pero está desaconsejado para código nuevo.

**Y «JSON directo», que es lo que pidió el dueño, tiene una lectura buena y una
mala.** La mala es escribir un intérprete propio de animación vectorial: eso es
reescribir Lottie peor. La buena es un JSON propio y minúsculo que no describa
vectores sino **una coreografía de piezas** —`{pieza, x, y, giro, escala,
opacidad}` por fotograma clave— aplicada con `transform` a imágenes. Treinta
líneas de intérprete, cero librería, todo por compositor. **Eso es exactamente
el modelo de Wordwall**, y es la lectura que hay que darle.

### Por qué cuesta lo que cuesta, en una línea

620×360 a DPR 3 son **2 millones de píxeles** re-teselados y rellenados en cada
repintado. El coste es `área × DPR²`, y por eso topar el lienzo fue la palanca
más grande de todo este plan. En la cuerda se puede bajar más: a tres metros de
distancia, un DPR de 1 en esa escena no se distingue.

Dos apuntes más, con fuente:

- **`will-change` mal usado empeora**: cada capa promovida come memoria de GPU.
  Se promueve la capa que se MUEVE, y solo esa.
- **`content-visibility: auto`** se salta estilo, maqueta y pintado de lo que
  está fuera de pantalla. Sirve para paneles largos, no para la cuerda visible.

### Lo que haría, por orden de (coste × riesgo) frente a ganancia

1. **Partir la escena en fondo QUIETO y capa que se mueve, y bajar el DPR de la
   cuerda.** De los 158 grupos del fichero, solo 31 propiedades se animan: hoy
   se re-rasteriza el dibujo entero para mover 31 cosas. El fondo se pinta UNA
   vez. Es la ganancia mayor de la lista y no cambia ni de librería ni de
   herramienta de autoría.
2. **La coreografía en JSON propio** (el «JSON directo» del dueño, leído como
   Wordwall): las figuras como imágenes movidas por `transform`, y solo la
   cuerda sigue siendo vector. Cero librería, se autora dibujando piezas.
3. **Atlas de sprites** si hace falta más: es literalmente la tecnología de
   Wordwall, cuesta 0 KB de runtime y convierte cada cuadro en una copia de
   textura. Se PIERDE el recoloreado por tokens (§3 de las leyes): eso hay que
   decidirlo por escrito antes, no descubrirlo después.
4. **`OffscreenCanvas` en un worker** para lo que quede de Lottie. Solo si lo
   anterior no basta.

Lo que decide el dueño antes de ejecutar: si el arte de la cuerda se puede
rehacer separando fondo y movimiento (toca al ilustrador, no al código), y si
acepta perder el recoloreado por tema en esa escena a cambio de los sprites.

## Lo medido el 2026-09-14, y qué hacer con ello (conversación, sin ejecutar)

El dueño: «¿separamos lógica y vista? ¿cuál sería el coste?». Las medidas
contestaron otra cosa, así que queda escrito antes de retomarlo.

**Separar lógica y vista NO es la palanca, y además ya la tenemos.** En Wordwall
eso es una decisión de reutilización entre plantillas; aquí ya está (la plantilla
declara, la plataforma pinta, el scorer vive aparte del player, todo sobre dos
armazones). Lo que abarata sus animaciones es otro MATERIAL: mueven mapas de
bits. Mezclar las dos cosas lleva a gastar en arquitectura esperando fluidez.

**Las tres medidas que mandan** (CPU frenada 12×):

| | |
|---|---|
| Un repintado de la cuerda, lienzo de 2 Mpx | 11,3 ms |
| El mismo, lienzo 32 veces menor (0,06 Mpx) | 6,6 ms |
| Copiar un mapa de bits ya rasterizado | 0,0 ms |
| Pre-rasterizar los 90 cuadros en el navegador | 15 s |

De ahí sale todo: **bajar la resolución no salva** (el coste es el vector, no el
píxel), **el atlas sí** (copiar es gratis), y **el atlas hay que fabricarlo
antes**, porque en el navegador tarda quince segundos.

**El precio del atlas, medido:** 30 cuadros a 460×267 en WebP son 332 KB y 14 MB
de memoria; pero a esa resolución, estirado a la pizarra, la cuerda pierde
textura (comparado con capturas). Hay que rasterizar al tamaño de destino, ~920
de ancho, y entonces son **~1 MB servido y ~20 MB de memoria**, frente a los
83 KB de hoy. Ese es el intercambio real.

**Herramienta**: las hechas están MUERTAS (`puppeteer-lottie` archivado en 2023
y además exige binarios del sistema; `rlottie` de Samsung, archivado y sin
soporte de seguridad). Lo que hacen es abrir la animación en un Chromium y
capturar cuadros — y ese Chromium ya está en `tools/`. Serían ~60 líneas
propias, con la ventaja de rasterizar con el MISMO motor que pinta hoy. Para
empaquetar los cuadros sí hay una pieza viva y con licencia permisiva
(`free-tex-packer-core`), que además emite el formato de atlas de facto.

**Si algún día son muchas**: la práctica general es generar en CI y no versionar
lo generado, pero aquí NO aplica igual porque Pages sirve el repositorio: lo
generado ES lo que se sirve. El patrón correcto es el que ya usamos con los docs
generados — generar, commitear, y **un test de frescura** que guarde el hash del
original dentro del atlas y rompa CI si alguien toca uno sin regenerar el otro.
Pasadas ~20 animaciones, mudarlas a `ww-assets`.

**Lo que dice la documentación coincide con lo medido**: la guía de optimización
de lienzo de Mozilla recomienda pre-dibujar fuera de pantalla lo repetido, no
escalar dentro de `drawImage` sino cachear tamaños, y preferir lienzo pequeño
ampliado a lienzo grande reducido.

**Corrección sobre Wordwall**: no hay NINGUNA fuente que diga que produzcan sus
sprites con Adobe Animate. Se insinuó en conversación y no se sostiene. Lo que sí
está documentado es sprites sobre canvas, temas en XML y C# compilado a
JavaScript; y sus volcados sugieren un atlas POR JUEGO y variantes por tema, no
uno global.

**EL PASO 1 NO ES CÓDIGO: es medir en la pizarra de verdad.** Todos estos
números salen de un contenedor headless SIN tarjeta gráfica, que castiga el
dibujo en lienzo mucho más que el aparato del aula. El medidor de fluidez ya
existe desde la Fase 0 (`?perf=1` en cualquier ruta). Si el duelo va fluido allí,
no se toca nada y nos ahorramos un mega en el repositorio y dos días de trabajo.

## Qué NO se hace

- No se quitan las celebraciones: el podio celebra (es producto). Se hacen
  baratas, no se reducen ni se apagan según el aparato.
- No se cambia el DPR ni la resolución del aparato: eso es del sistema.
- No se mete otra librería de animación: lo que hay (`transform`/`opacity`
  por compositor, un lienzo pequeño) es lo que Wordwall hace.

## Orden recomendado y coste

Fase 0 (una tarde con la pizarra) → 1 (un día) → 2 (medio día) → 3 (medio
día) → 4 (medio día) → 5 (medio día) → 6 (medio día). Las fases 3 y 6 son las
que protegen el futuro: sin ellas, la próxima animación bonita volverá a
ralentizar el aula y nadie lo verá hasta la clase.
