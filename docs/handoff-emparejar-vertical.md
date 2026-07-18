# HANDOFF — Emparejar (match): conectar en VERTICAL sigue fallando (SIN RESOLVER)

> **Estado: NO RESUELTO.** El usuario reporta, de forma consistente y en su
> dispositivo real, que en orientación VERTICAL (portrait) las conexiones de
> Emparejar "no funcionan". Varios intentos (v1.51.171→175) NO lo cerraron. El
> usuario dijo explícitamente "veo que no entiendes el problema" → **empezar de
> cero, sin asumir que las hipótesis previas eran correctas.**

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
