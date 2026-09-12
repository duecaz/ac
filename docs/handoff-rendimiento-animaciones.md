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
