# Plan · RENDIMIENTO DE LAS ANIMACIONES — la pizarra 4K no es el portátil

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha) · cuando se ejecute, `tools/perf-sonda.mjs` y una red nueva de animaciones

> Pedido por el dueño el 2026-09-12: «la app es muy lenta en las animaciones —el
> confeti, la soga del VS— y en Wordwall no se ralentizan en pantallas
> interactivas básicas 4K».

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
2. **La puerta «gama baja» no se abre en la pizarra.** `core/perf.js` decide
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

## Las fases

**Fase 0 · medir en el aparato real, antes de tocar.** Un medidor de fluidez
en `#/admin` (y por `?perf=1` en cualquier ruta): p50/p95 del tiempo entre
cuadros durante 5 s, y cuadros >50 ms, pintado en pantalla, por escena: VS en
reposo con cuerda · VS respondiendo · podio con confeti · Quiz · Colorear.
Es la única prueba que vale: Playwright no tiene ni la GPU ni el DPR de la
pizarra. Entregable: una tabla con los números de la pizarra del aula.

**Fase 1 · `ww-lite` por SÍNTOMA, no por hardware (`core/perf.js`).** Igual
que el arreglo del fullscreen: se detecta el problema, no el modelo. Al
montar un juego se miden los primeros 3 s de cuadros; si el p50 pasa de 25 ms
o más del 20 % supera 50 ms, se enciende `ww-lite` y se recuerda para ese
aparato (`ww.lite = 'auto'`, con dueño en `LS_OWNERS`, §21). Más un mando
explícito en el panel del profe («Pizarra: modo ligero» on/off/auto): la
pizarra se configura UNA vez y no se vuelve a medir. `applyPerfClass` lee
primero el mando y luego la memoria.

**Fase 2 · la soga sin re-dibujar SVG.** Pre-rasterizar los 90 cuadros UNA
vez (al montar, repartido en cuadros de reposo para no bloquear) en una hoja
de sprites en un lienzo del tamaño CSS de la arena × min(DPR, 1,5); el reposo
y el tirón pasan a ser un `drawImage` por tick (≈0,2 ms) en vez de 153
trazados. Bajo `ww-lite`, cuadro estático (ya existe). Y el reposo baja de 25 a
15 fps: un balanceo lento no lo nota nadie. Alternativa si el sprite no
convence al ojo: hacer del `svg-tug` (transformaciones CSS por compositor,
ya en el repo) el proveedor por defecto en pizarras.

**Fase 3 · el podio.** Un solo lienzo de confeti reutilizado (hoy se crea
uno por ráfaga y hay tres en el cierre), `setTransform` en vez de
`save/translate/rotate/restore` por papelito, alfa solo en los últimos 30
ticks, tope de papelitos por área y la mitad en `ww-lite`. El foco giratorio
del cierre (`vs.css` `.vs-celebration::before`) recibe capa propia
(`will-change: transform`) y en `ww-lite` no gira; el `blur` girando del tema
TV se apaga en `ww-lite`.

**Fase 4 · la regla, como test.** una suite nueva de animaciones en `tests/` (verificada en
rojo con una animación plantada): dentro del marco de juego solo se animan
`transform` y `opacity`; nada de `filter`/`box-shadow`/`text-shadow` animados;
**toda animación `infinite` tiene su contraparte `.ww-lite … { animation:
none }`** (hoy 8 infinitas y solo 3 la tienen). Añade la regla a `docs/
estilos-de-actividad.md` con su porqué (DPR 3).

**Fase 5 · lienzos a DPR acotado.** El lienzo de dibujo de Tildes/Comas
(`core/textCorrectionDraw.js`) y cualquier canvas del juego se crean con
`min(devicePixelRatio, 1,5)` bajo `ww-lite` (y 2 en normal). El DOM no se
puede escalar; los lienzos sí.

**Fase 6 · la sonda aprende DPR.** `tools/perf-sonda.mjs` gana la escena
«pizarra»: viewport 1280×720 con `deviceScaleFactor: 3` (el aparato del aula
tal cual), y las escenas «VS en reposo con cuerda» y «podio del duelo». Los
techos siguen siendo generosos (30 fps); lo que se persigue es el orden de
magnitud.

## Qué NO se hace

- No se quitan las celebraciones: el podio celebra (es producto). Se hacen
  baratas o se reducen en `ww-lite`, nunca desaparecen.
- No se cambia el DPR ni la resolución del aparato: eso es del sistema.
- No se mete otra librería de animación: lo que hay (`transform`/`opacity`
  por compositor, un lienzo pequeño) es lo que Wordwall hace.

## Orden recomendado y coste

Fase 0 (una tarde con la pizarra) → 1 (medio día) → 2 (un día) → 3 (medio
día) → 4 (medio día) → 5 y 6 (medio día). Las fases 1 y 4 son las que
protegen el futuro: sin ellas, la próxima animación bonita volverá a
ralentizar el aula y nadie lo verá hasta la clase.
