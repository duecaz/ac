# Plan · EL RELOJ Y LA REANUDACIÓN — un origen, un dueño, un orden

> **Tipo**: plan · **Sube a**: [`docs/leyes.md`](leyes.md) §23 · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha); al ejecutarlo, las nueve puertas de §5

> Frente abierto el 2026-09-18 al cerrar la campaña del remontado del DOM
> (`REHACEN_EL_MARCO` vacía, v1.51.727), aprobado por el dueño y **EJECUTADO en
> v1.51.729**. Lo que sigue es el plan tal como se aprobó; el resultado, en §7.

## 0 · Por qué es un frente y no un arreglo

Durante la campaña del DOM apareció tres veces la misma sombra: *«el primer
número del reloj se pierde»*. La primera vez se dejó anotado a propósito —mover
dos líneas habría cambiado el timing en mitad de otro cambio—, y al ir a medirlo
resultó que no era una línea: son **tres grietas distintas que comparten raíz**,
y una de ellas es una trampa que solo se ve con el desfase de servidor puesto.

La raíz es que **el tiempo tiene hoy dos orígenes y ningún dueño**:

- `startedAt` nace de `clock.now()` y `finish()` calcula `clock.now() - startedAt`;
- el cronómetro que se VE lo pinta `startElapsedTicker`, que mide con `serverNow()`;
- y el reloj se arranca **antes** de que exista la superficie donde se pinta y
  **antes** de que la reanudación diga cuál es el origen bueno.

## 1 · LA MEDICIÓN (hecha, 2026-09-18 · v1.51.727)

Con reloj local congelado, `setInterval` falso y un desfase de servidor
controlado. Los números son de la sonda, no de la lectura del código.

| # | Caso | Lo que hace HOY | Lo que debería |
|---|---|---|---|
| A | **Libre · F5 con 37 s jugados** | HUD `0:00` · `timeUsed` **42 s** | los dos, 42 s desde el mismo origen |
| B | **Libre · cuenta de TABLERO (Memoria 180 s) + F5 tras 60 s** | vuelve a **180** | ~120: el límite es de la partida, no del arranque |
| C | **Secuencial · F5 con 37 s** | `state.startedAt` SÍ se restaura… pero el cronómetro ya se creó antes → HUD `0:00` | HUD `0:37` |
| D | **Offset de servidor +10 s, 30 s jugados** | HUD `0:30` · `timeUsed` 30 s → **correcto hoy** | sigue correcto |
| E | **La TRAMPA**: pasar `startedAt` (base `clock`) como `desde` (base `serverNow`) | HUD **`0:40`** con 30 s reales | `0:30` |

**D y E juntos son el hallazgo importante**: hoy nada está roto por el desfase
*porque cada base es autoconsistente*. El arreglo ingenuo —«pásale el
`startedAt` restaurado al ticker»— **introduce** el defecto: +10 s de desfase se
convierten en +10 s de partida. Por eso este frente empieza por la frontera de
los relojes y no por mover líneas.

### 1b · Y una trampa para el ARNÉS, no para el código

`montarReloj()` se planta si no hay `document` (guard deliberado: sin pantalla no
hay reloj que pintar, y una suite en Node no debe quedarse con un intervalo
vivo). Además, un DOM de mentira que responda `[data-hud="tiempo"]` **desde el
primer instante** oculta justo el defecto que queremos ver: en el navegador, la
cabecera del shell libre **todavía no existe** cuando el reloj pinta por primera
vez. Las pruebas de este frente:

- declaran un `document` de mentira para que el reloj se monte;
- y su raíz falsa **no entrega el chip hasta que el player monta su marco** — si
  lo entrega antes, la prueba miente y sale verde con el defecto puesto.

## 2 · La ley que queremos

> **Restaurar el estado y su ORIGEN → montar la superficie estable → arrancar el
> reloj desde ese origen → pintar el contenido.**
>
> Ninguna pantalla recibe el primer tic antes de que exista el sitio donde se
> pinta. Y **lo que muestra el reloj y lo que se guarda como `timeUsed` son dos
> lecturas del MISMO tiempo**: no pueden tener orígenes distintos.

Con su corolario, que es de §22-5 y ya está escrito en `core/serverNow.js`: la
**hora común** (`serverNow()`) es para instantes que se comparan **entre
aparatos** (la sala en vivo). Una **duración local** —lo que tarda un alumno en
su propia pantalla— se mide con `clock.now()`. Individual no comparte instantes
con nadie.

## 3 · Diseño de propiedad (a decidir por el dueño)

### 3a · La base temporal — recomendación: **duración local**

Individual y Tarea miden una duración en UN aparato. La recomendación es que
**todo el reloj de Solo cuente con `clock.now()`**, y que `serverNow()` se quede
donde nació: las salas en vivo. Eso exige que `startElapsedTicker` deje de
imponer su base — hoy la tiene cableada — y reciba su fuente de tiempo, con el
defecto puesto en `serverNow()` para no tocar Live.

- **Riesgo**: `startElapsedTicker` lo usan también las vistas de carrera/tablero
  en vivo, donde el origen ES de la sala y debe seguir siendo hora común. El
  cambio es por INYECCIÓN con defecto intacto, nunca global.
- **Alternativa descartable**: traducir el origen (`startedAt + offset`) al
  pasarlo. Funciona, pero deja dos bases vivas y la traducción hay que acordarse
  de hacerla en cada llamada nueva. La ley dice «un origen», no «dos y una
  conversión».

### 3b · Quién monta el reloj, y `reloj:false` desaparece

Hoy `runFreeformPlayer(…, { reloj:false })` es un booleano público: mañana otro
caller dice «yo traigo el mío» y vuelven los relojes paralelos. Pero la
necesidad de Tildes/Comas es real, y **ya está declarada**: la unidad de la
cuenta atrás la dice la plantilla (`meta.play.reloj.unidad`, `unidadDeCuenta()`).
El catálogo entero, medido:

| Unidad declarada | Plantillas | De quién es el reloj |
|---|---|---|
| `pregunta` · `operación` | Quiz · Globos · Operaciones | del **ÍTEM** → el shell secuencial lo rearma en cada uno (hoy ya correcto) |
| `frase` | Tildes · Comas | de la **FASE** → hoy por eso existe `reloj:false` |
| `partida` · `diagrama` · `sopa` | Memoria · Emparejar · Diagrama · Sopa | de la **PARTIDA** → el shell libre, una vez, y F5 continúa |
| `null` + `crono:false` | Ruleta · Abre Cajas · Pelotas · Tangram · Rompecabezas · Colorear | no hay reloj |

De ahí sale el diseño sin booleano: **el dueño del reloj es siempre el shell**, y
lo que cambia es CUÁNDO lo rearma, que lo dice la unidad declarada. Un runner con
unidad más pequeña que la partida (la frase) no monta un reloj propio: le pide al
shell que lo **rearme** (`ctx.rearmarReloj()` o equivalente). Un segundo dueño
deja de ser posible porque no hay API para serlo.

### 3c · La fase que le falta al shell libre

En el shell libre el marco es del player, así que el shell no puede saber por su
cuenta cuándo existe la superficie. Hace falta una fase explícita —el player
declara «mi superficie ya está»— y el reloj arranca ahí. **Prohibido** resolverlo
con `setTimeout`, microtask o `requestAnimationFrame`: eso convierte el ciclo de
vida en timing accidental, que es la clase de defecto que esta campaña vino a
cerrar.

## 4 · Fuera de alcance (no se toca)

La campaña del remontado del DOM · Memoria salvo como fixture de F5 · la
puntuación · los estilos · las mecánicas · Live y sus `deadline`s más allá de
comprobar que su hora común sigue intacta. **`serverNow()` no se cambia
globalmente para arreglar Solo**: eso arreglaría una pantalla y rompería el aula.

## 5 · Las nueve puertas (cada una, ROJA antes del arreglo)

Cada puerta dice qué defecto demuestra y dónde corre. Node donde la lógica
basta; navegador donde lo que se juzga es lo que se ve.

| # | Puerta | Demuestra | Dónde |
|---|---|---|---|
| 1 | Secuencial nuevo con cronómetro: el primer valor se ve YA | el tic perdido | Node |
| 2 | Secuencial F5: página restaurada · el primer valor sale del `startedAt` original · `timeUsed` del mismo origen | caso C | Node |
| 3 | Libre nuevo: el primer valor se ve al montar el player, no un segundo después | el tic perdido, con la superficie del player | Node |
| 4 | Libre F5: estado restaurado ANTES de arrancar · HUD y `timeUsed` continúan la partida | caso A | Node |
| 5 | Offset de servidor: variar `serverNow − clock` NO cambia una duración Individual | casos D y E | Node |
| 6 | Cuenta atrás por ÍTEM: empieza tras existir el ítem y cada ítem rearma su límite | que el arreglo no rompa lo que ya estaba bien | Node |
| 7 | Cuenta atrás por PARTIDA/tablero: F5 conserva lo consumido, no regala el límite | caso B | Node |
| 8 | Tildes/Comas: UN solo reloj · la frase nueva rearma · la corrección lo apaga · la siguiente lo enciende · misma cabecera | que el rediseño de 3b no rompa v1.51.724-725 | navegador (`matrix-smoke`) |
| 9 | Guardia de propiedad: ningún caller puede introducir un segundo reloj ni un equivalente a `reloj:false` | que la puerta quede cerrada | norma (`core/normsCheck.js`) |

## 6 · Qué entregar al terminar

El ANTES/DESPUÉS **de cada caso de §1 y de cada puerta de §5** —no «preflight
verde»—, la lista completa de ficheros tocados, y el cuadro de §3b actualizado si
el diseño se movió. Si alguna puerta obliga a cambiar el diseño, se escribe el
porqué aquí antes de cambiarlo.


## 7 · EJECUTADO (v1.51.729)

Las nueve puertas viven en `tests/reloj.test.mjs` (G1-G7, G9) y en
`tools/matrix-smoke.mjs` (G8). **Todas se escribieron antes del arreglo y se
vieron en ROJO**; G6 nació verde a propósito, porque vigila lo que ya estaba
bien.

| Puerta | Antes | Después |
|---|---|---|
| G1 · secuencial nuevo | el primer valor no llegaba a la cabecera | `0:00` al montar |
| G2 · secuencial F5 | cabecera «1 / 3» + reloj en `0:00` | «2 / 3» y `0:37` de nacimiento |
| G3 · libre nuevo | el reloj pintaba contra el vacío | `0:00` al decir el player que existe |
| G4 · libre F5 | HUD `0:00` · `timeUsed` 42 s | `0:37` y 42 s, mismo origen |
| G5 · desfase +10 s | (no restauraba, y traducir mal daba `0:40`) | `0:30` y 30 s · Live sigue con hora común |
| G6 · cuenta por ítem | ya era correcto | sigue: cada ítem estrena su límite |
| G7 · cuenta de partida + F5 | volvía a **180** | **120** |
| G8 · Tildes/Comas | (el rearme no se medía) | un solo reloj · 60 s por frase · apagado al corregir |
| G9 · propiedad | `textCorrectionSolo` montaba el suyo + `reloj:false` | solo el shell monta; la puerta ya no existe |

**Lo que cambió de sitio la autoridad**

- `startElapsedTicker` y `startDeadlineTicker` aceptan `now`, **con `serverNow`
  de defecto**: Live no se entera y Solo inyecta `clock.now`.
- `montarReloj` recibe el ORIGEN y su fuente, y distingue las dos cuentas atrás
  por la unidad declarada (`alcanceDeReloj`): la de unidad estrena tiempo, la de
  partida se ancla al origen y lo recalcula en cada tic — nunca un «restante»
  cerrado al montar, que es como se separaría de `timeUsed`.
- El shell secuencial **restaura antes de montar** y arranca el reloj después.
- El shell libre gana la fase que le faltaba: `ctx.listo()` («mi superficie ya
  existe»), y los verbos `rearmarReloj()` / `pararReloj()` para una unidad más
  pequeña que la partida. `{ reloj:false }` se borró.
- Los 12 callers del shell libre dicen `ctx.listo()`; olvidarlo rompe CI.
