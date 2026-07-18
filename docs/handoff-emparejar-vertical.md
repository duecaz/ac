# HANDOFF — Emparejar (match): conectar en VERTICAL ✅ RESUELTO (v1.51.178 + v1.51.179)

> **SEGUNDA CAUSA (v1.51.179), la que de verdad veía el usuario como "no conecta":**
> tras arreglar el corredor (abajo), en portrait las cuerdas VERTICALES (dos tarjetas
> frente a frente, misma columna → mismos x) **no se dibujaban**. Reproducido headless:
> el `<g>` de la cuerda tenía bbox de ANCHO 0, y el filtro de sombra `feDropShadow`
> (región en % del bbox) colapsaba a cero → borraba la cuerda entera. Las diagonales
> (cruzadas, con ancho > 0) sí se veían; por eso "solo fallan las verticales / frente a
> frente". El `SAG` solo evitaba el caso horizontal (alto 0). Fix en `core/connectRope.js`:
> se elimina el filtro SVG; la sombra pasa a ser un TRAZO DESPLAZADO, que se pinta en
> cualquier orientación. (El enlace SIEMPRE se creaba —`LINK` en los logs—; era puro
> render.) Comparte motor con `diagram`, que casi nunca tenía cuerdas perfectamente
> verticales, por eso no lo había manifestado.
>
> ---
> **PRIMERA CAUSA (v1.51.178):** La causa NO era la que se venía persiguiendo. Se reprodujo
> el fallo EXACTO en headless usando **toque real (eventos táctiles vía CDP)** en un
> marco portrait extremo (field 468×1714, como el dispositivo del usuario): con esa
> geometría el `.ww-stage` (corredor central, `flex:1` del andamio) se estiraba a
> **~1045px de hueco muerto**, empujando los dos grupos a los extremos (grupo de
> arriba en y≈100, grupo de abajo en y≈1460). Al arrastrar entre ellos, soltar en
> ese vacío hacía que `targetCard` CANCELARA por su regla "si el destino queda más
> cerca del origen que del punto de soltado → cancela": con un corredor tan alto,
> medio arrastre legítimo cae más cerca del origen → conexión perdida. Eso es
> justo lo que headless "8/8, 12/12" NO veía: con viewport modesto el corredor era
> pequeño y el punto medio se cruzaba fácil.
>
> **Fix aplicado (dos partes):**
> 1. `styles/match.css` (portrait `@container player (aspect-ratio < 1/1)`): el
>    corredor pasa a un carril fino (`.ww-match-gap { flex:0 0 auto; height:10cqmin }`)
>    y el field centra ambos grupos (`.ww-match-field { justify-content:center }`) →
>    cuerdas cortas, arrastre natural, cabe sin scroll.
> 2. `templates/match/player.js` (`targetCard`): eliminada la comparación frágil
>    origen-vs-destino. Ahora: soltar dentro de una tarjeta opuesta → esa; soltar
>    de vuelta en la PROPIA tarjeta → cancela; en cualquier otro sitio → la tarjeta
>    opuesta más cercana por centro. Un arrastre al otro grupo NUNCA se queda sin
>    conectar. (Mismo criterio robusto que `diagram`, que ya funcionaba.)
>
> Logs `[match]` temporales retirados de `templates/match/player.js`.
>
> ---
> _Lo de abajo es el registro histórico de la investigación previa (ya no vigente)._

## Qué hace el juego
Emparejar (`templates/match/player.js` + `styles/match.css`) usa el ANDAMIO de
regiones (`styles/scaffold.css`): en ancho, dos columnas laterales unidas por
cuerdas; en alto (portrait), refluye a dos filas (grupo arriba / grupo abajo) y
las cuerdas cruzan el corredor central. Motor de cuerdas: `core/connectRope.js`.

## LO QUE SÍ SE SABE (con evidencia, no asumir lo contrario)
- **La cuerda NO tiene altura 0.** La línea fantasma se dibuja durante el
  arrastre (visible en las capturas del usuario). Descartado.
- **La lógica de conexión SÍ crea el enlace.** Los logs `[match]` capturados en
  el dispositivo REAL del usuario mostraron:
  ```
  [match] DOWN L:p_b3zgmg type=touch capture=true
  [match] END ev=pointerup suelta=(124,1534) desde L:p_b3zgmg
  [match] hit=RECT R:p_rhqaej
  [match] LINK p_b3zgmg ↔ p_rhqaej
  [match] lostpointercapture id=3
  ```
  → `pointerup` normal (NO pointercancel), `targetCard` devuelve una tarjeta
  (`hit=RECT`), y `setLink` se ejecuta (`LINK`). Es decir: en el táctil real, el
  enlace se está creando. **El problema NO es (solo) que no conecte a nivel JS.**
- **Pista fuerte, sin confirmar como causa:** las coordenadas de soltado tienen
  Y ENORME (`1534`, `1679`) → el contenido es más alto que la pantalla y **hay
  scroll**. Sospecha: el grupo de abajo queda fuera de pantalla y no se puede
  arrastrar hasta él, o las cuerdas se dibujan desalineadas por el scroll.

## LO QUE SE PROBÓ (y NO lo cerró)
| Versión | Intento | Por qué no bastó |
|---|---|---|
| 1.51.171 | Migrar match al andamio (reflujo portrait) + conector 2D | Introdujo el reflujo, pero el vertical no conectaba |
| 1.51.172 | Quitar el radio de `targetCard` (creí: rechazaba el borde) | Headless mejoró, dispositivo no |
| 1.51.173 | `targetCard` comprueba el PUNTO primero (creí: el punto sobresale al corredor) | Headless 8/8 en ambas orientaciones, dispositivo NO |
| 1.51.174 | Añadir logs `[match]` (DOWN/END/hit/LINK) | Diagnóstico — reveló que LINK sí ocurre |
| 1.51.175 | `fitLayout` portrait acota altura → cabe sin scroll (creí: scroll/off-screen) | Headless: 12/12 sin overflow. **Dispositivo: el usuario dice que sigue igual.** |

## LA BRECHA CLAVE (por dónde atacar)
**Los tests headless (Playwright, PointerEvents sintéticos) PASAN (8/8, 12/12) pero
el DISPOSITIVO REAL falla.** La causa está en algo que el headless NO reproduce:
- ¿Táctil real vs PointerEvent sintético? (multitáctil, `pointercancel` por
  gesto, scroll nativo pese a `touch-action:none`).
- ¿El scroll del widget/página desalinea `dotPos`/`svgPt` (coordenadas relativas
  a `svg.getBoundingClientRect()`)? Verificar con scroll REAL, no solo tamaño.
- ¿El marco NO está en fullscreen y su `aspect-ratio:16/10` hace que el reflujo a
  portrait ni siquiera dependa de lo que creemos? (Confirmar geometría real: ¿el
  usuario está en pantalla completa? ¿qué mide el field en su dispositivo?)
- ¿`setPointerCapture` en táctil se comporta distinto? El log dice `capture=true`,
  pero conviene confirmar que TODOS los `pointermove/up` llegan al `arena`.

## SIGUIENTE PASO RECOMENDADO (empezar por AQUÍ)
1. **NO asumir la causa.** Pedir al usuario el SÍNTOMA VISUAL EXACTO: al soltar,
   (a) ¿aparece la cuerda entre las dos tarjetas? (b) ¿la tarjeta destino se
   resalta (borde)? (c) ¿conecta a la tarjeta que apuntaba o a otra? (d) ¿el
   marco hace scroll / el grupo de abajo se ve? Un vídeo corto valdría oro.
2. **Los logs `[match]` SIGUEN en el código** (`templates/match/player.js`, helper
   `dbg`). Pedir una captura NUEVA de un intento fallido tras v1.51.175, con la
   línea de montaje (que ahora conviene enriquecer con dims del field/frame y
   `window.scrollY`). Comparar coords de soltado con la posición real de las
   tarjetas en ESE dispositivo.
3. **Reproducir con scroll y táctil reales**, no solo con tamaños de viewport.
   Considerar un dispositivo/emulador táctil real o `page.touchscreen` de
   Playwright (no `dispatchEvent` de PointerEvent, que evita el pipeline táctil).
4. Cuando se resuelva, **QUITAR los logs `[match]`** (`dbg`, y sus llamadas) de
   `templates/match/player.js` — son temporales.

## Ficheros implicados
- `templates/match/player.js` — `targetCard` (detección de destino), `fitLayout`
  (tamaño por orientación), `endDrag`/handlers de pointer, `dbg` (logs temporales).
- `styles/scaffold.css` — el reflujo por `@container player (aspect-ratio …)`.
- `styles/match.css` — puntos conectores orientados (portrait) + tamaño de tarjeta.
- `core/connectRope.js` — `dotPos`/`svgPt` (coordenadas relativas al SVG).

## Contexto: Etiqueta el diagrama (diagram) SÍ funciona
`diagram` usa el mismo andamio y el mismo motor de cuerdas y funciona en ambas
orientaciones (verificado). Comparar `templates/diagram/player.js` (su `nearest`
2D con radio pequeño sobre pines) puede dar la pista de la diferencia real.
