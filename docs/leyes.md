# LEYES del proyecto — índice único (qué · dónde está escrito · qué test la vigila)

> **Tipo**: norma · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: cada ley, su test (ver cuadro); enlaces y ficha, `tests/docs.test.mjs`

> **Cada ley se DESPRENDE de una restricción del norte** — la cadena completa
> (restricción → ley → test) está en `docs/norte.md` §6b, y ahí se ven también
> los huecos que van quedando. Una ley que no puede citar su origen es una ley
> huérfana. (Esta cabecera decía que R2 y "buscar/crear" seguían sin ley cuando
> hacía quince versiones que tenían §28 y §27: un índice que grita una urgencia
> falsa entrena a ignorar los avisos de verdad.)
>
> **Por encima de estas leyes está `docs/norte.md`**: para quién es la app, la
> escena real de uso (una pizarra táctil, 45 minutos, tres minutos de
> preparación), las restricciones duras y el criterio de decisión. Las leyes
> dicen CÓMO se construye; el norte, QUÉ y PARA QUIÉN. Si chocan, gana el norte
> y la ley se replantea.

> **Los cuadros entre marcadores `<!-- GENERADO:… -->` NO se editan a mano**: los
> escribe `node tools/docgen.mjs` desde el módulo dueño (`core/liveLoops.js`,
> `core/modes.js`, `core/persistPolicy.js`) y `tests/docs.test.mjs` falla si el
> documento y el código dejan de coincidir. El cuadro de los bucles llegó a decir
> lo contrario que el código EN LOS TRES documentos a la vez.
>
> "Si es norma, es test." Aquí está TODA la ley en un sitio, con el archivo donde se
> explica y el test que la hace fallar en CI si la rompes. Antes de dudar de una
> convención, mira aquí. Verificación de todo: `node tests/run.mjs` (y `#/admin` →
> "Ejecutar tests" corre el mismo escáner en el navegador).

<!-- GENERADO:nav -->
### Índice de este documento

- [0) ⚖️ EL MODELO DE CUATRO CAPAS — el norte de la arquitectura](#0--el-modelo-de-cuatro-capas--el-norte-de-la-arquitectura)
- [1) Versión — en CADA commit y en CADA respuesta](#1-versión--en-cada-commit-y-en-cada-respuesta)
- [2) Todo a `main` (sirve la web)](#2-todo-a-main-sirve-la-web)
- [3) ⚖️ LEY DE ESTILO — las cuatro capas del píxel](#3--ley-de-estilo--las-cuatro-capas-del-píxel)
  - [§3c · TEMA y FONDO — dos ejes, y quién gana cuando se cruzan](#3c--tema-y-fondo--dos-ejes-y-quién-gana-cuando-se-cruzan)
- [4) ResizeObserver → `observeResize()`](#4-resizeobserver--observeresize)
- [5) Filtros PocketBase → `pbEscape`/`pbFilterParam`](#5-filtros-pocketbase--pbescapepbfilterparam)
- [6) `kernel/` sin `Date.now()` → `clock.now()`](#6-kernel-sin-datenow--clocknow)
- [7) IDs con `rid()` (`core/ids.js`)](#7-ids-con-rid-coreidsjs)
- [8) Contrato de plantilla](#8-contrato-de-plantilla)
- [9) Skins completos](#9-skins-completos)
- [10) Handlers delegados + `clearListeners(APP)`](#10-handlers-delegados--clearlistenersapp)
- [11) Pantalla de inicio obligatoria](#11-pantalla-de-inicio-obligatoria)
- [12) Registro único + arranque](#12-registro-único--arranque)
- [13) Gama baja `ww-lite` (`core/perf.js`)](#13-gama-baja-ww-lite-coreperfjs)
- [14) Puntos (`core/scoring/`)](#14-puntos-corescoring)
- [── LEYES DE DATOS / SEGURIDAD (biblioteca pública) ──────────────────────────](#-leyes-de-datos--seguridad-biblioteca-pública-)
- [15) Solo PocketBase (Supabase RETIRADO)](#15-solo-pocketbase-supabase-retirado)
- [16) `owner` (permiso) ≠ `author` (etiqueta) ≠ `profiles` (perfil)](#16-owner-permiso--author-etiqueta--profiles-perfil)
- [17) Reglas PB endurecidas (U1)](#17-reglas-pb-endurecidas-u1)
- [18) XSS: escapar SIEMPRE lo que viene de datos → `escapeHtml`](#18-xss-escapar-siempre-lo-que-viene-de-datos--escapehtml)
- [19) Credenciales de PocketBase/Pi — NUNCA en el chat](#19-credenciales-de-pocketbasepi--nunca-en-el-chat)
- [20) OAuth redirect canónico](#20-oauth-redirect-canónico)
- [21) ⚖️ LEY DE DATOS — cada colección tiene UN dueño](#21--ley-de-datos--cada-colección-tiene-un-dueño)
- [22) ⚖️ LEY DE CONFIANZA — el cliente AFIRMA, el veredicto lo pone otro](#22--ley-de-confianza--el-cliente-afirma-el-veredicto-lo-pone-otro)
  - [Los LÍMITES de esta ley — permanentes, no pendientes (v1.51.421)](#los-límites-de-esta-ley--permanentes-no-pendientes-v151421)
- [23) ⚖️ LEY DE VISTA — ciclo de vida de una pantalla](#23--ley-de-vista--ciclo-de-vida-de-una-pantalla)
- [24) ⚖️ LEY DE CONTENIDO — el modelo evoluciona por caminos declarados](#24--ley-de-contenido--el-modelo-evoluciona-por-caminos-declarados)
- [§25 · CAPACIDAD — el sistema tiene límites, y son UNO](#25--capacidad--el-sistema-tiene-límites-y-son-uno)
- [§26 · BUCLES EN VIVO — el catálogo está congelado](#26--bucles-en-vivo--el-catálogo-está-congelado)
- [§27 · VIAJES — si es un tramo del norte, tiene su RECORRIDO](#27--viajes--si-es-un-tramo-del-norte-tiene-su-recorrido)
  - [Corolario: al unificar, migrar también la DECISIÓN](#corolario-al-unificar-migrar-también-la-decisión)
- [§28 · EN CLASE — el profe no configura y el alumno no puede romper](#28--en-clase--el-profe-no-configura-y-el-alumno-no-puede-romper)
- [⚖️ §29 · PRESUPUESTO — el coste de conducir la clase se MIDE](#-29--presupuesto--el-coste-de-conducir-la-clase-se-mide)
- [⚖️ §30 · ALCANZABLE — lo que no tiene puerta de entrada, se borra](#-30--alcanzable--lo-que-no-tiene-puerta-de-entrada-se-borra)
  - [§30b · Y ADEMÁS: toda ruta tiene una DECISIÓN escrita](#30b--y-además-toda-ruta-tiene-una-decisión-escrita)
  - [Convención de los MD (decidida el 2026-08-11)](#convención-de-los-md-decidida-el-2026-08-11)
  - [Cómo se auto-verifica todo](#cómo-se-auto-verifica-todo)

### Ir a otro documento

| Documento | Qué responde |
|---|---|
| [`norte.md`](norte.md) | para quién es la app, la escena real y cómo se decide (**manda sobre el resto**) |
| [`arquitectura-modulos.md`](arquitectura-modulos.md) | la radiografía: capas, imports, esfuerzo por tramo y mapa de datos (GENERADO) |
| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles en vivo |
| [`decisiones-pendientes.md`](decisiones-pendientes.md) | lo aplazado, con su condición para reabrirlo |
| [`estudio-bucles-live.md`](estudio-bucles-live.md) | por qué el vivo es como es (estudio medido) |
| [`testing.md`](testing.md) | las suites y las redes de seguridad del preflight |
| [`guia-testeo-companero.md`](guia-testeo-companero.md) | guía de pruebas paso a paso, para alguien no técnico |
| [`../CLAUDE.md`](../CLAUDE.md) | el mapa de entrada del repo: "quiero X → voy a Y" |
<!-- /GENERADO:nav -->

## 0) ⚖️ EL MODELO DE CUATRO CAPAS — el norte de la arquitectura
Cuatro capas, cada una con UN dueño y UNA prohibición. Toda decisión de diseño
se contrasta contra este cuadro ANTES de escribir código; si un cambio necesita
violar una prohibición, el diseño está mal planteado.

| Capa | Vive en | Dueña de | PROHIBIDO |
|---|---|---|---|
| **CONTENIDO** | `kernel/content` | modelos + validación + conversores | saber de mecánicas o modos |
| **PLANTILLA** | `templates/*` | UNA mecánica: el MÉRITO (scorer) + el render + sus políticas (`meta.play`) | saber en qué modo corre (lo DECLARA, no lo pregunta) |
| **MODO** | `core/modes` + `kernel/session` + shells (`core/soloPlayer`) | el arreglo social: quién juega · quién puntúa cuándo · qué persiste · qué reloj | conocer una plantilla concreta (solo consume el contrato) |
| **PLATAFORMA** | `views/` + editor + biblioteca | navegación, setup, resultados (chrome) | decidir reglas de juego (el bug del `raceToFinish` fue esto) |

- **El norte medible**: plantilla nueva = 1 carpeta · modo nuevo = 1 módulo ·
  **ninguna celda de la matriz plantilla×modo se programa a mano** — la matriz
  EMERGE del contrato.
- **Fronteras que no se cruzan**: el mérito NUNCA sube al kernel (la plantilla
  decide qué es correcto; el kernel cuándo se liquida). Un "game mode" con
  mecánica propia (p.ej. tipo Blooket) es una PLANTILLA live, no un modo.
- **Todo modo responde 5 preguntas** antes de existir (ficha en
  `docs/modos-de-juego.md` §9): quién puntúa · quién decide el fin · qué
  persiste · qué reloj · hay identidad de alumno.
- **LA DIRECCIÓN DE LAS DEPENDENCIAS ES LEY, y ahora es TEST** (`tests/layers.test.mjs`):
  cada capa declara a quién puede importar y el escáner recorre los **874 imports**
  del repo. Lo de arriba sabe de lo de abajo, **nunca al revés**. Las excepciones
  están listadas UNA A UNA con su motivo, y son ratchet: una nueva rompe CI.
  Hoy son 12 — el `import()` dinámico con el que un modo monta su vista, la
  fachada `adapters/index.js`, y una deuda declarada (`question-live` importa
  `sessionItems` del motor).
  - **El caso que lo destapó**: `buildSessionTable` —que decide QUIÉN GANA una
    carrera— vivía en `views/`, o sea la PLATAFORMA decidiendo reglas de juego.
    Se notó porque los tests de dominio tenían que importarlo de una vista.
    Ahora el modelo está en `core/sessionModel.js` y la vista solo lo pinta.
  - **El diagrama se GENERA** (`node tools/module-map.mjs` →
    `docs/arquitectura-modulos.md`) del mismo grafo, y el test comprueba que
    está al día: un dibujo hecho a mano envejece en silencio y acaba mintiendo,
    que es peor que no tenerlo.
- **Tests que lo vigilan**: `layers` (dirección de los imports + diagrama al día) ·
  `scoringSources` (el mérito vive en la plantilla) ·
  `persistPolicy` (qué persiste cada modo) · `templateContract` (meta.play
  declarado) · `moduleRefs` + matriz jugable (`tools/matrix-smoke.mjs`).

## 1) Versión — en CADA commit y en CADA respuesta
- Sube `VERSION` en `core/constants.js` (patch: `x.y.z → x.y.z+1`), nunca hacia atrás.
- Indica la versión `(vX.Y.Z)` en la respuesta del chat; commit y respuesta deben coincidir.
- **Dónde**: `CLAUDE.md §1` · **Por qué**: caché + service worker dependen de que avance.

## 2) Todo a `main` (sirve la web)
- `main` es GitHub Pages → **aulareto.com** (CNAME). Cada commit se propaga a `main`
  (permiso permanente) y por legado a `ACTIVIDAD2`.
- **Dónde**: `CLAUDE.md §2`.

## 3) ⚖️ LEY DE ESTILO — las cuatro capas del píxel
El contrato de estilos del PLAYER, en el mismo formato del §0: cada capa con UN
dueño y UNA prohibición. Un cambio visual se ubica en su capa ANTES de
escribirse; si necesita violar una prohibición, está en la capa equivocada.

| Capa | Vive en | Dueña de | PROHIBIDO |
|---|---|---|---|
| **TOKENS** | `core/skins.js` (`cssVars` de `default`) + `styles/theme.css :root` | el VOCABULARIO: los 14 `--ww-*` (bg/bg-soft/fg · card-* · accent · shape-1..4 · success/danger/warning) | que un token viva solo en `:root` (es red de seguridad, no fuente); añadir un token a `default` obliga a TODOS los skins |
| **SKIN** | `core/skins.js` (`registerSkin`) + `themes/<name>/skin.css` | dar VALOR a los 14 tokens (+ layout VS opcional) | tocar reglas de una actividad · pintar fuera de su scope `.skin-<name>`/`.vs-skin-<name>` · declarar `stylesheet:` sin archivo |
| **CSS DE PLANTILLA** (el juego) | `styles/<actividad>.css` (lista `GAME`) | la maquetación del ejercicio: RELATIVA (`cq*`, `%`, `fitLayout`/`fitPassage`) y pintada SOLO con `var(--ww-*)` | `px`/`rem` que congelen (`max(12px, Xcqmin)` vale como PISO, nunca techo) · `#hex` a pelo salvo neutros y acierto/error |
| **CHROME** | `styles/` en `EXCLUDED` (player, scaffold, editor, home, live, touch…) | el marco: `#ww-player-widget{container-type:size}`, el andamio `ww-scaffold/rail/stage/bar`, formularios | decidir el aspecto del EJERCICIO (el editor sí puede usar px: es formulario) |

- **La frontera que no se cruza**: el skin cambia TOKENS, nunca reglas; la
  actividad consume TOKENS, nunca hex. Si un trozo queda gris al cambiar de
  piel, ese `#6c757d` es el bug.
- **Ratchet, no formateador**: la deuda vive congelada en `BASELINE` por
  archivo+valor; actividad nueva (sin entrada) nace limpia; al arreglar deuda se
  BORRA su entrada; nunca se añade una violación para callar el test.
- **Dónde se explica**: `docs/estilos-de-actividad.md` (contrato + ejemplares
  `math.css`/`quiz.css` con assert duro a cero; **§3b0 los CUATRO roles del
  player** —`edu-hud` · `edu-topbar` · `edu-sec--*` · `edu-send`— y §3b andamio
  de regiones).
- **La DIAGRAMACIÓN también es norma** (2026-08-17): un indicador nunca crea
  franja, una barra existe solo si hay herramienta que tocar, el juego se queda
  el resto y el envío tiene su región. Lo vigila `tools/matrix-smoke.mjs`
  MONTANDO las 13 en Individual (un `edu-hud`, ≥1 sección CON NOMBRE
  `edu-sec--*`, ≤1 `edu-send` y todo `[data-ww-submit]` dentro), con las
  excepciones declaradas en `ENVIO_ES_MECANICA` — cada una con su motivo.
- **Y se mide DÓNDE, no solo SI**: el chip del HUD tiene que quedar a ≤48 px de
  la esquina del marco. Contar nodos daba verde a Pelotas con el indicador a
  213 px, en mitad del tablero — la norma existía y el fallo pasaba igual.
- **Tests que lo vigilan**: `tests/styles.test.mjs` (ratchet + completeness gate
  23/23 + **gate de themes**: todo `stylesheet:` declarado existe y ningún
  `themes/*/skin.css` queda huérfano sin documentar) · `tests/skins.test.mjs`
  (set COMPLETO de tokens por skin).
- **✅ CERRADO (M7) — el reparto del TECLADO ya no está copiado**: lo tenían
  `styles/vs.css`, `styles/teams.css` y el skin tv-show con los mismos flex/grid.
  Ahora vive una vez en `styles/scaffold.css` y cada contenedor solo pone TAMAÑOS
  (el panel VS mide en `cqw`, la tarjeta de Equipos en `cqmin`). Dos bloques, no
  uno, porque la CONDICIÓN difiere y eso no se comparte en CSS (Equipos siempre
  reparte; VS solo cuando el panel es bajo o vertical — estirar en escritorio alto
  dejaba hueco muerto bajo la tarjeta-esquina de tv-show).
- **NUEVA HERRAMIENTA — `node tools/shots.mjs`**: capturas VS/Equipos × 3 skins ×
  2 orientaciones con diff POR PÍXEL (`before` → cambios → `after`). Es lo que
  permitió cerrar esta deuda: el refactor quedó en **12/12 sin cambios visuales**,
  y de paso pilló tres regresiones invisibles a ojo mientras se hacía (teclas de
  arcade encogidas por especificidad, filas de tv-show sin estirar, marcador
  descuadrado). Sin esto, "unificar CSS" era apostar.
- **El andamio portrait del SCOREBOARD se queda en cada skin, a propósito**: cada
  skin define su `.vs-skin-X .vss-bar` (0,2,0), así que una regla compartida
  `.vss-bar` (0,1,0) pierde y la barra vuelve a su alto de escritorio (medido:
  256k píxeles de diferencia en tv-show vertical). Ganar exigiría selectores más
  específicos que los propios skins o `!important` — peor que la repetición. La
  razón está escrita en `styles/vs.css`, no sobreentendida.
- **DEUDA REGISTRADA (decisión del usuario, 2026-07-30) — CSS propio, Bootstrap
  fuera**: hoy Bootstrap entra por CDN en los 4 HTML (7 tags) y ~250 sitios de
  JS usan sus clases (`btn`, `badge`, `modal`, `form-control`, `spinner-border`) +
  `bootstrap.Modal` en `core/toast.js`. Dos problemas: en un colegio sin internet
  los diálogos de confirmación REVIENTAN (dependencia de red en tiempo de clase),
  y el chrome mezcla dos sistemas de estilo. Plan acordado: construir un CSS
  centralizado PROPIO — la grilla súper reducida de Bootstrap que realmente
  usamos + las reglas dispersas nuestras — y al hacerlo escribir la LEY de estilo
  del chrome (hoy §3 solo legisla el JUEGO). Mientras tanto, cualquier trabajo
  offline debe recordar que `confirmModal` depende del CDN (el shim de
  `tools/live-smoke.mjs` existe por esto).
  **PRIMER TRAMO DE ESA LEY, ya ejecutable (2026-08-18)**: la regla
  `chrome-boton` (`core/normsCheck.js`, vigilada por `tests/norms.test.mjs`).
  Las vistas declaradas en `CHROME_VIEWS` visten con la familia propia del panel
  (`.btn-ghost` / `.btn-primary-solid`, `styles/home.css`) y no pueden volver a
  `btn btn-*`. Nació de una captura del dueño: «Crear actividad» llevaba
  `btn btn-primary` y salía en azul de Bootstrap, con esquina afilada y otra
  altura, dentro de la barra crema/naranja — arreglarlo a mano en una vista no
  impedía que la siguiente pantalla naciera igual, que es cómo llegó. Es un
  RATCHET con lista declarada (como `LS_OWNERS`): lo limpio no retrocede, y lo
  que falta por migrar (admin, tareas, editor, informes) sigue siendo legal
  hasta que se decidan las variantes que la familia no tiene — no hay
  `.btn-ghost--danger` para los borrados del admin, y ESA es la decisión que
  bloquea el resto. El juego queda fuera: allí manda el skin (§3).
  **La especificación ya es ejecutable (R3/R4)**: `node tools/css-inventory.mjs`
  cuenta qué clases de Bootstrap usa la app de verdad, por familia (hoy ~3.900
  usos: texto 761 · iconos `bi` 690 · spacing 613 · botones 507 · flex 371 ·
  forms 279 · grid 216 · …). El CSS propio se escribe familia a familia,
  empezando por la de más usos; re-correr el inventario tras cada migración dice
  cuánto falta (debe tender a 0). Los iconos son decisión aparte: `bi` es una
  FUENTE, no CSS — vendorizarla o pasar a SVG inline.
  **Themes ya están en el escáner de px (R3)**: `tests/styles.test.mjs` congela
  los `font-size` fijos que quedaban en arcade/tv-show como baseline
  propio (solo encoge) — la cifra "27" de la deuda era vieja; L5/M7 ya habían
  limpiado el resto.
- **Deuda registrada**: ~~`themes/colegios/skin.css` huérfano~~ ✅ RESUELTO
  (v1.51.415): se retiró — estaba en disco sin `registerSkin`, así que ningún
  profe podía elegirlo, y su copia del teclado era código muerto. `KNOWN_ORPHANS`
  queda VACÍO · deuda de ratchet en vs/teams/wordsearch (la mayor) +
  match/memory/ballsort/crossword/textCorrection/question-live ·
  `themes/*/skin.css` aún fuera del escáner de px (font-size fijos entre
  arcade/tv-show) · el escape por selector `.mem-`/`-ed\b` exime más de
  lo que debería (todo memory) · `rgba()` de superficie sin vigilar.
  (Las reglas muertas del skin `space` no registrado se retiraron en L5.)

### §3c · TEMA y FONDO — dos ejes, y quién gana cuando se cruzan

Decidido el 2026-08-12, a raíz de dos hallazgos de la misma semana: el enunciado
ilegible sobre la foto del profe y «algunos fondos son muy oscuros que hacen que
no se vean las otras letras» (ronda del compañero, prueba 10). Los dos eran el
mismo defecto: **el fondo no declaraba nada**, así que la legibilidad dependía de
parches caso a caso.

| Eje | Dueño | Declara | PROHIBIDO |
|---|---|---|---|
| **TEMA** (skin) | `core/skins.js` | la PALETA: los `--ww-*` completos **y la pareja `-fg` de todo color que lleve texto** | pintar el LIENZO cuando el profe ha elegido fondo · fijar `color` a pelo en un componente que ya tiene su token (`.skin-tv-show .ww-opt{color:#fff}` daba 2,2:1) |
| **FONDO** | `core/backgrounds.js` | el LIENZO: la textura + (`ink` + `colorBase`) **o** `plate:true` | definir tokens del tema · estilar componentes (`body.bg-arena .card{…}` era un fondo decidiendo el color de una tarjeta) |

**Quién gana: no un eje sobre el otro, sino la CERCANÍA al píxel.**

```
veredicto (verde/rojo)  >  placa/tarjeta (--ww-card-*)  >  tinta del lienzo (--ww-bg-ink)  >  paleta base del tema
```

- Texto DENTRO de una tarjeta o placa → tinta del TEMA: el lienzo no le toca.
- Texto SUELTO sobre el lienzo → tinta del FONDO: el tema no puede saber si el
  lienzo elegido es claro u oscuro.
- Y el **fondo elegido gana al lienzo del tema**: `applyBackground` marca
  `bg-set`, que sube la especificidad de la textura y de la tinta por encima de
  lo que pinte el tema. Sin esto ganaba quien cargara después — pedías «Papel» y
  salía el plató de TV Show, con su tinta clara sobre papel claro (1,0:1).
- La **placa** no es un parche: la PIDE el fondo con `plate:true` y
  `applyBackground` pone `bg-plated`. Hoy solo la foto del profe, porque es el
  único lienzo que no se puede conocer ni medir.

**El contraste se garantiza en TRES niveles**, del origen a la red final:

1. **Al declarar** — `tests/contrast.test.mjs` calcula el ratio WCAG sobre los
   hex de los manifests, sin navegador: cada par tinta/relleno del tema (4,5:1
   texto · 3:1 opciones) y cada `ink` contra su `colorBase`. Los dos bugs de
   contraste que ya tuvimos habrían muerto aquí.
2. **Con placa** donde no se puede garantizar (fotos): tokens de tarjeta.
3. **Al pintar** — `node tools/contrast-torture.mjs` mide las **70
   combinaciones** tema × fondo en el juego real. Es la red que faltaba: la
   matriz sube por los padres buscando color y ABANDONA al topar con un
   `background-image`, y las 10 texturas son degradados → los fondos llevaban
   meses contados como «no medibles». Aquí el lienzo se resuelve por el
   `colorBase` DECLARADO, que existe justo para eso. Entra en el preflight.

- **Un fondo nuevo** que no declare (`ink` + `colorBase`) o `plate` rompe CI: la
  legibilidad se DECIDE al añadirlo, no se descubre con la clase delante.
- **Tests que lo vigilan**: `tests/contrast.test.mjs` (con contra-prueba: un tema
  con el ámbar en letra blanca es rechazado, y el camino legítimo sigue pasando)
  · `tools/contrast-torture.mjs` en el preflight.
- **Límite declarado**: en este entorno el CDN de Bootstrap está bloqueado, así
  que la tortura no juzga los rellenos suyos (`.badge.bg-*`) y lo DICE en cada
  pasada en vez de dar un falso ilegible. Lo que mide es el CSS del proyecto.

## 4) ResizeObserver → `observeResize()`
- Nunca `new ResizeObserver(cb)` directo si el callback muta layout: usa
  `observeResize()` (`core/observeResize.js`, rAF-debounced).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 5) Filtros PocketBase → `pbEscape`/`pbFilterParam`
- SIEMPRE `core/pbFilter.js`, NUNCA `encodeURIComponent` a pelo sobre el valor (no
  escapa la comilla simple de `campo='valor'`).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 6) `kernel/` sin `Date.now()` → `clock.now()`
- La lógica de dominio usa `core/clock.js` (`clock.now()`), inyectable → tests
  deterministas. (Pendiente: deadlines de hostLive/studentLive.)
- **Dónde**: `CLAUDE.md` deuda §2 · **Test**: `tests/norms.test.mjs` + `tests/clock.test.mjs`.

## 7) IDs con `rid()` (`core/ids.js`)
- Nunca `Math.random().toString(36)` a mano. Prefijos: `q_ p_ it_ w_ ps_ pin_`.
- **Dónde**: `CLAUDE.md` estándares.

## 8) Contrato de plantilla
- Cada plantilla: `meta.instructions` (obligatorio), modelo registrado, scorer que
  devuelve `{correct, points}`, `migrate` idempotente, carpeta↔registro. Plantillas con
  `modes.live` declaran `getRoundPayload`+`scoreSubmission`.
- **Dónde**: `docs/sistema-de-plantillas.md` · **Test**: `tests/templateContract.test.mjs`.
- **Generador**: `node tools/new-template.mjs <name> --model qa [--vs] [--live]` (nace
  cumpliendo el contrato) · Diagnóstico: `node tools/check-template.mjs`.

## 9) Skins completos
- Cada skin define el set COMPLETO de tokens de `default` (sin caer al fallback `:root`).
- **Test**: `tests/skins.test.mjs` (+ `core/skinContract.js`).

## 10) Handlers delegados + `clearListeners(APP)`
- Las vistas montan en `#app` y registran con `on(APP, …)` (delegación). El router llama
  `clearListeners(APP)` en `setBeforeResolve` antes de cada ruta — NUNCA lo quites.
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/events.test.mjs`.

## 11) Pantalla de inicio obligatoria
- Todo modo Individual pasa por `views/startScreen.js` (título + instrucciones + Iniciar
  → fullscreen). El ejercicio queda oculto hasta Iniciar.

## 12) Registro único + arranque
- Las 13 plantillas se registran solo en `core/registerTemplates.js`; sonidos/efectos/
  versión/mute se cablean solo en `core/boot.js`. Los `main.*.js` no repiten ese wiring.

## 13) Gama baja `ww-lite` (`core/perf.js`)
- ≤4 núcleos o ≤2GB → `ww-lite` en `<html>`; sin bucles rAF continuos en reposo. El VS
  debe ir fluido en pizarras A55.

## 14) Puntos (`core/scoring/`)
- `basePoints`/`wrongPoints`/`usaBonusVelocidad`. Tildes VS: 1 punto fijo por tilde buena
  (`scoreMarksPerHit`).

## ── LEYES DE DATOS / SEGURIDAD (biblioteca pública) ──────────────────────────

## 15) Solo PocketBase (Supabase RETIRADO)
- Backends válidos: `local` (dev) y `pocketbase` (prod, `PB_URL`). Nada de Supabase.
- **Dónde**: `CLAUDE.md` arquitectura · infra real en `docs/infraestructura-pb.md`.

## 16) `owner` (permiso) ≠ `author` (etiqueta) ≠ `profiles` (perfil)
- `owner` = columna PB de permisos (la pone `remoteStore`). `author = {id,name}` =
  etiqueta LIGERA dentro del JSON de la actividad (para las tarjetas). El **perfil rico**
  (colegio/frase/avatar) vive en la colección pública `profiles`, NO en la actividad.
- **Dónde**: `docs/infraestructura-pb.md` · `core/profile.js`.

## 17) Reglas PB endurecidas (U1)
- `activities`: crear exige sesión + ser tu owner; editar/borrar solo owner o admin;
  público lee lo `visibility='public'`. `users`/`profiles`/`likes`/`reports` con sus
  reglas (ver infra). Fuente en código: `views/adminView.js` DEFS = `setup-pocketbase.ps1`.
- **Verificación**: `bash tools/check-pb.sh` (incluye checks negativos: crear anónimo y
  signup DEBEN fallar). **Nunca** `sort=-updated/-created` sobre `activities` (rompe).
- **Dónde**: `docs/infraestructura-pb.md` · `docs/handoff-seguridad-pb.md`.

## 18) XSS: escapar SIEMPRE lo que viene de datos → `escapeHtml`
- Todo valor de la actividad/usuario que entra al DOM pasa por `escapeHtml`
  (`core/html.js`). La defensa del token en localStorage ES esta disciplina.
- **Test**: `tests/security.test.mjs`.

## 19) Credenciales de PocketBase/Pi — NUNCA en el chat
- Superadmin PB y contraseñas se teclean en la Pi con `read -rsp`; a Claude solo se le
  pega la SALIDA. Claude redacta los comandos, el usuario los ejecuta.
- **Dónde**: `docs/infraestructura-pb.md` (regla de oro).

## 20) OAuth redirect canónico
- `oauthRedirectUrl()` normaliza `/teacher` → `/teacher.html` (una sola URI autorizada en
  Google) y se preserva el `#hash` para volver a donde estabas.
- **Test**: `tests/oauth.test.mjs`.

## 21) ⚖️ LEY DE DATOS — cada colección tiene UN dueño
El equivalente del §0 para la persistencia: si no está declarado quién escribe,
cualquier módulo puede "parchar algo" escribiendo directo a la BD — y eso es
exactamente lo que causó los lost-updates (deuda A) y el guardado doble.

| Colección | DUEÑO (único módulo que la nombra/escribe) | Autoritativo | PROHIBIDO |
|---|---|---|---|
| `activities` | `adapters/pocketbase/remoteStore.js` (entrada: `core/storage.js` save/remove — cola `_unsynced` + tombstones) | PB; LWW por `updatedAt`; `owner` lo sella SOLO remoteStore | que una vista haga fetch propio a la colección |
| `results` | `remoteStore.js` (entrada ÚNICA: `trySaveResult` de `core/results.js`, gateado por `persistPolicy`) | append-only | escribir results desde un modo que `persistPolicy` no declare |
| `live_sessions` | `adapters/pocketbase/realtime.js` (blob `state` = host-only) | la fase la manda el host | que una vista/el alumno toque el blob por fetch propio |
| `live_answers` | `realtime.js` (`postAnswer` upsert atómico; índice único session+player+item) | los PUNTOS los pone el settle del host (C6) | POST/PATCH fuera de `postAnswer`/settle |
| `live_players` | `realtime.js` (fila por jugador; apodo único por índice) | la fila ES el playerId | tocar `players[]` del blob (retirado) |
| `assignments` / `assignment_attempts` | `adapters/pocketbase/assignments.js` (fachada: `core/assignmentsTransport.js`) | attempts append-only; NUNCA results+attempts a la vez | reimplementar el gateo fuera de `assignmentGate` |
| `reports` · `activity_likes` · `profiles` | `core/reports.js` · `core/likes.js` · `core/profile.js` (upsert `id=uid`) | PB (el perfil local es cache declarada) | duplicar el wrapper `pb()` en un módulo nuevo — pídele el método al dueño |
| `users` | `core/auth.js` (alta/está/patch) + `core/teachers.js` (rol, panel admin) | token PB | leer/escribir users desde vistas |
| _esquema_ | `views/adminView.js` (DEFS + reglas = `tools/setup-pocketbase.ps1`) | el DEFS del admin | migrar esquema desde otro sitio |

- **La regla de oro**: un módulo nuevo que necesite datos NO hace fetch a la
  colección — **le pide un método al dueño**. El dueño concentra firma
  (`signedFetch`), filtros (`pbFilter`), reintentos e idempotencia.
- **Excepción sancionada**: `core/stressTest.js` (prueba de carga: escribe filas
  `stress_*` y las borra; replica adrede el camino del alumno).
- **Test que lo vigila**: regla `pb-dueno` en `core/normsCheck.js` +
  `tests/norms.test.mjs` — nombrar una colección (URL o literal) fuera de su
  allowlist rompe CI. El allowlist es RATCHET: solo encoge.
- **✅ CERRADO (M6) — ya NO hay lectores directos**: portada, Explorar, perfil de
  autor, panel de Profesores y el diagnóstico piden métodos al dueño
  (`listPublicActivities` · `countActivitiesByOwner` · `probeActivitiesPayload`
  en `remoteStore`, expuestos por `core/storage.js`), y los informes piden
  `listSessions`/`fetchSessionRecord` al dueño de `live_sessions` — lo que además
  **arregla el seam local|pb**: en dev sin PocketBase los informes ya funcionan
  (el driver local implementa los mismos dos métodos). El allowlist del ratchet
  encogió: `activities` y `live_sessions` ya solo las nombran su dueño y el dueño
  del esquema. Ganancia de paso: las tres copias del filtro/normalización
  divergían (una devolvía el id de PB y otra el del contenido, y ninguna migraba
  el modelo) — ahora es un solo lector que además MIGRA, así una tarjeta pública
  de una actividad vieja se pinta con el modelo de hoy.
- **✅ CERRADO (R1)** — las tres piezas de robustez de escritura:
  - **Cola offline de intentos** (`core/attemptQueue.js`): la entrega de una
    tarea con la red caída se guarda en el dispositivo y se reenvía sola (al
    volver la red, al reabrir una tarea, o en el piggyback de la siguiente
    entrega). La vista lo DICE ("quedó guardado en este dispositivo…"). Un 403
    del servidor (tope/cerrada, §22-3) NO se encola: se explica.
  - **Idempotencia por `qid`** en `results` y `assignment_attempts`: la clave
    nace ANTES del primer envío (misma identidad en el reintento) y el índice
    único PARCIAL (`WHERE qid != ''`, no molesta a las filas antiguas) convierte
    el reintento tras un ACK perdido en no-op. En intentos era lo grave: el
    reintento recontaba y entraba como `attempt_no+1` — fila duplicada Y un
    intento del alumno gastado en falso. Test: `tests/idempotency.test.mjs`
    (ACK perdido de verdad: la fila queda, el cliente ve error, el reintento no
    duplica, y la contra-prueba de que la entrega nueva real sigue entrando).
  - **UN wrapper JSON de PocketBase** (`pbJson` en `core/pbHttp.js`): 6 de las 7
    copias migradas (likes, reports, teachers y los 3 adaptadores; el timeout de
    realtime queda como capa encima). `core/auth.js` conserva la suya A
    PROPÓSITO: es el dueño del token y pbHttp importa de él — sería un ciclo.
  - **PASO DEL USUARIO**: re-correr "Crear colecciones" cuando haya acceso a
    @pio (añade `qid` + sus 2 índices). Sin eso, el reintento sigue funcionando
    pero sin la garantía del índice (la comprobación por consulta del adaptador
    cubre mientras tanto).

## 22) ⚖️ LEY DE CONFIANZA — el cliente AFIRMA, el veredicto lo pone otro
El principio que ya aplicamos tres veces sin nombrarlo (C6, answer-safety R5,
reglas U1/S3), ahora como ley: **lo que llega de un cliente es una AFIRMACIÓN;
el veredicto (correcto/puntos/fin) solo lo pone el host o una regla del
servidor.** Una feature nueva que confíe en el móvil está mal diseñada.

| Actor | AFIRMA (se acepta como dato) | PROHIBIDO decidir |
|---|---|---|
| **ALUMNO en vivo** (anónimo) | apodo · `value` · `ms` · abrir pregunta en QL (`ql_open`, sancionado) | su veredicto/puntos (los pone el settle del host — C6) · la fase/fin de la sala · expulsar · responder por otro `playerId` |
| **PROFESOR (host)** | fase · deadlines · settle · `ql_award` (acto docente manual) | responder por un alumno · re-abrir lo liquidado (candado del engine) |
| **CLIENTE Individual** (`results`) | score/techo/tiempo (append-only; deuda: autodeclarado) | editar/borrar lo ya guardado (reglas append-only) |
| **CLIENTE Tarea** (`assignment_attempts`) | intento con score y `answers` (deuda: autodeclarado, re-puntuable desde `answers[].v`) | crear/cerrar/rotar la TAREA (exige sesión de profe — regla L2) · editar intentos ajenos |

- **Dónde vive el veredicto**: settle del host (`realtime.js settleItem`/
  `settlePendingInto` sobre `engine.settle`, idempotente) **+ las reglas de
  PocketBase**, declaradas UNA vez en **`core/pbRules.js`** (fuente única que
  leen el panel `#/admin` y `tools/setup-pocketbase.ps1`).
- **Reglas EJECUTABLES** (esto es lo que las saca de "configuración que nadie
  mira"): `tests/pbRules.test.mjs` fija los invariantes (nadie con update/delete
  abierto · el veredicto `scored`/`points` es host-only · el blob de la sala es
  host-only · append-only donde el dato es un hecho entregado) **y compara regla
  a regla con el script de PowerShell** (la divergencia silenciosa era un bug
  real). `tests/liveRules.test.mjs` va más lejos: un **evaluador del dialecto de
  reglas PB** hace de servidor y el **adaptador REAL** juega contra él, así se
  vigilan los dos fallos posibles — que la regla sea muy ABIERTA (9 trampas
  deben rebotar) y que sea muy CERRADA (el alumno anónimo debe poder jugar
  entero: entrar · responder · reintentar en carrera · mover el tablero · pedir
  la palabra). En la Pi de verdad: `bash tools/check-pb.sh` (6 chequeos live,
  negativos Y positivos).
- **Otros tests**: regla `confianza-alumno` en `core/normsCheck.js` (el código de
  `views/student*` no puede ni NOMBRAR los verbos del host, `setSessionState`
  incluido) · `tests/liveAnswers.test.mjs` (C6) · `tests/answerSafety.test.mjs`.
- **Reglas aplicadas (L2 + L6)** — re-correr `#/admin` → "Crear colecciones":
  - `live_answers`: el alumno crea su respuesta (forzosamente `scored:false`,
    `points:0`) y puede corregir `value`/`ms`, pero **no puede ni mencionar
    `scored`/`points`** en un PATCH. Sin esto, C6 se saltaba entero desde
    DevTools: `{scored:true, points:9999}` entraba y el marcador lo sumaba.
  - `live_sessions`: **el blob `state` es host-only** (fase, ítem, deadline,
    puntajes) y crear/borrar sala exige sesión. Para que eso fuera posible, el
    "pedir la palabra" de Pregunta en Vivo salió del blob a un campo propio
    `ql` con su verbo propio (`claimQuestion`) — el alumno escribe ESO y nada
    más. (Se lee con respaldo al blob: las salas creadas antes siguen bien.)
  - `live_players`: solo el profe **expulsa** (antes cualquier alumno echaba a
    un compañero) y nadie renombra.
  - `assignments`: crear/cerrar/rotar/borrar exige sesión (un alumno ya no
    reabre una tarea cerrada, ni mueve `due_at`, ni se sube el tope).
  - `results`: **leer exige sesión** (privacidad: nombres y notas de menores).
  - **Consecuencia operativa — AUTORIDAD DE MODO, y hay que DECIRLO ANTES**:
    dirigir una sala en vivo o crear tareas EXIGE haber entrado con la cuenta de
    profe (el servidor solo distingue host de alumno por el token). **Jugar,
    explorar, entrar con PIN y hacer una tarea siguen SIN cuenta.** Esa
    autoridad no se re-escribe en cada vista: el modo declara en qué colección
    escribe (`MODE_DEFS[].writes`) y qué acto docente hace (`hostAction`), y
    `modeNeedsAuth()`/`modeAuthHint()` (`core/modes.js`) lo **derivan** de
    `HOST_ONLY_WRITES` (`core/pbRules.js`) → una sola redacción
    ("Inicia sesión para crear una sala en vivo") para el **botón** (candado en
    la tarjeta y en la barra de modos), el **modal** (`openLoginModal({reason})`)
    y el **gate del router** (`requireTeacher` en `#/launch`, `#/host`,
    `#/tasks`). Prohibido **esconder** el modo (esconderlo enseña que no existe)
    y prohibido **dejar que falle** para explicarlo después: `views/hostLive.js`
    conserva el mensaje del 403 solo como red para la sesión caducada.
    Lo vigila `tests/modeAuth.test.mjs` (incluida la anti-divergencia
    `HOST_ONLY_WRITES` ↔ `MODE_DEFS.writes` en ambos sentidos).
- **① `ms` de SERVIDOR — CERRADO (M1)**: el bonus de velocidad ya no se fía del
  reloj del móvil. Al abrir un ítem, el host SELLA en el blob (host-only) el
  `updated` que devuelve PocketBase = instante servidor de la apertura; al
  liquidar, el tiempo se DERIVA de los autodate de la fila contra ese sello
  (`core/serverMs.js`: `created` en fase pregunta, `updated` en carrera, donde
  cuenta el instante del acierto). Las dos marcas son del MISMO reloj, así que no
  hay desfase entre dispositivos, y el `ms` del cliente queda como respaldo
  MARCADO (`source:'claimed'`) para el blob legado / driver local / host recargado
  a mitad de pregunta. El tiempo que ve el profe en el informe sale de la misma
  derivación (`rowsFromLiveAnswers(rows, i, {itemOpenedAt, phase})`) → un solo
  tiempo por respuesta. Test: `tests/serverMs.test.mjs` (mentir con `ms:0` no
  cobra bonus **y** el alumno rápido de verdad conserva el suyo).
- **② LA CLAVE NO VIAJA EN LA SALA — CERRADO (M2)**: `live_sessions` tiene
  lectura ABIERTA por necesidad (el alumno anónimo entra con el PIN) y ahí se
  guardaba la actividad ENTERA → cualquiera con el PIN se leía todas las
  respuestas, y R5 no protegía nada porque el propio móvil se construía el
  payload en local desde ese snapshot. Ahora la sala guarda el **snapshot
  saneado** (`core/liveSnapshot.js studentSnapshot`: whitelist de metadatos +
  los payloads de ronda ya sin solución + huecos vacíos para contar ítems) y el
  contenido completo vive en **`live_keys`**, colección con las CINCO reglas
  cerradas a quien no tiene sesión. Lo que el alumno puede leer de un ítem sale
  de `visibleItem()` (payload), no de `content`. El host trae la clave de
  `live_keys` con caché por sala; si no puede (sesión caducada, colección sin
  crear) lo DICE al entrar en vez de fallar al revelar.
  **Excepción declarada**: en *carrera libre* el móvil juzga cada intento en
  local (colorea y re-encola al instante), así que esa sala sí sube el contenido
  completo al arrancar y vuelve al snapshot saneado al cerrar. Cerrarlo del todo
  pide un **validador en el servidor** (hook de PocketBase en la Pi): sin él,
  cualquier alternativa de cliente es cosmética — con 4 opciones visibles, un
  hash de la correcta se rompe probando las 4.
  Test: `tests/liveSnapshot.test.mjs` (las 13 plantillas: del contenido solo
  viaja el payload; fugas comprobables como cadena cerradas; contra-prueba de
  que con el snapshot aún se juega; `live_keys` cerrada).
  **PASO DEL USUARIO**: `#/admin` → "Crear colecciones" (añade `live_keys`).
  Sin ella, crear sala falla con ese mensaje exacto.
- **③ TOPE DE INTENTOS — CERRADO en el servidor (M3)**: el límite vivía ENTERO en
  el cliente (`countOwnAttempts` contaba, la vista decidía), así que un POST a
  mano entregaba infinitas veces y una tarea CERRADA seguía aceptando entregas por
  API. Ahora el intento declara su número (`attempt_no`) y la regla de
  `assignment_attempts` lo acota contra el `max_attempts` de SU tarea vía join con
  alias (`@collection.assignments:asg`, misma fila) y rechaza si está `closed`; el
  índice ÚNICO `(assignment_id, user_id, attempt_no)` impide gastar el mismo número
  dos veces. La rama `attempt_no = 1` mantiene la semántica canónica "null ⇒ 1
  intento" para las tareas antiguas (si no, la regla bloquearía al alumno legítimo
  — el otro modo de fallar). El alumno sigue SIN cuenta. El adaptador recuenta y
  reintenta ante el 400 del índice, y traduce el 403 a una frase que
  `views/studentTask.js` MUESTRA (antes un `console.warn`: el alumno creía que
  había entregado).
  **LÍMITE que queda**: el `user_id` es anónimo y se puede rotar (borrar
  almacenamiento, incógnito) → el tope es por IDENTIDAD, no por persona. Cerrarlo
  pide identidad de alumno (PIN/NFC, `docs/handoff-acceso-docente.md` U2-U4).
  Tests: `tests/taskRules.test.mjs` (6) con el evaluador de reglas haciendo de
  servidor + el adaptador real; el evaluador vive ahora en
  `tests/helpers/pbRuleEval.mjs` (compartido con `liveRules`) y entiende
  comparaciones y joins `@collection`.
- **④ RESPUESTA ATADA AL DISPOSITIVO — CERRADO (M4)**: el `playerId` es PÚBLICO
  (la lista de jugadores se lee sin cuenta y el host la necesita), así que bastaba
  verlo para responder en nombre de otro o pisarle su respuesta. Ahora, al entrar,
  el dispositivo genera un SECRETO, lo registra en **`live_claims`** (crear
  abierto + índice ÚNICO `(session, player)` → el primero se queda el jugador;
  leer/editar/borrar CERRADOS, así que no se puede espiar ni robar) y lo manda en
  la cabecera **`X-WW-Claim`** con cada escritura. La rama anónima de
  `live_answers` exige esa cabecera contra el join de `live_claims` — al CREAR
  contra el `player` del cuerpo y al ACTUALIZAR contra el de la FILA (si fuera el
  del cuerpo, mandar otro `player` seguiría editando filas ajenas). La cabecera NO
  se guarda en la fila, así que el secreto no queda legible en `live_answers`, que
  sí es pública; el join de una regla es interno del servidor y no pasa por las
  reglas de API de la colección consultada.
  Efectos de borde cuidados: si el dispositivo pierde su credencial (limpiar
  almacenamiento, otro móvil) NO se reutiliza su fila de jugador — entra como
  nuevo (con sufijo de apodo) en vez de quedarse mudo; y un 403 al responder ya no
  se encola como si fuera falta de red (`core/submitQueue.js`), le dice al alumno
  que vuelva a entrar.
  Tests: `tests/liveRules.test.mjs` sube a **14 trampas** (responder como otro con
  y sin secreto inventado · pisar la respuesta ajena · robar la credencial por
  duplicado y por PATCH · listar credenciales) **+ la contra-prueba de que la
  dueña de la credencial sigue respondiendo** y el alumno anónimo juega entero.
  **PASO DEL USUARIO**: `#/admin` → "Crear colecciones" (añade `live_claims`).
- **⑤ LA HORA COMÚN — CERRADO (v1.51.418)**: el veredicto del servidor no es
  solo el que PUNTÚA (①), también es **el tiempo con el que el cliente SE
  GATEA**. Los instantes de la sala (`answers_open_at`, `deadline`,
  `started_at`, `last_seen`) los estampaba el aparato del PROFE con su reloj y
  los comparaba CADA móvil con el suyo. Nadie medía el desfase, y en un aula lo
  normal es que los relojes NO coincidan (un Android con la hora automática
  apagada, una pizarra sin sincronizar). Lo destapó una ronda de pruebas real y
  se reprodujo con dos pantallas y el reloj desplazado a propósito:
  **−10 s** → el profe ve «Preparados… 9» y el alumno «19» · **−25 s** → al
  alumno no se le abren las respuestas NUNCA y su pregunta se liquida «sin
  respuesta · 0 puntos» · **+10 s** → la ventana de lectura (R-1) desaparece y
  responde antes de leer, que es justo lo que R-1 vino a impedir.
  DOS defensas, y hacen falta las dos:
  **(a) `core/serverNow.js`** — cada aparato mide su desfase con la cabecera
  `Date` de las respuestas de PocketBase (hora de servidor gratis, sin endpoint
  ni NTP), guarda la MEDIANA de las últimas muestras y la re-mide en cada
  respuesta, porque un móvil que suspende deriva. Se toma en `core/pbHttp.js`,
  puerta única del tráfico PB, así que ningún llamador tiene que acordarse. Sin
  servidor (backend local, red caída, cabecera ilegible) el desfase es 0 y todo
  se comporta EXACTAMENTE como antes. R7: el desfase vive en memoria, no se
  persiste, no viaja al profe y no entra en ningún informe.
  **(b) `core/liveGate.js`** — el cinturón: la espera de lectura se ACOTA a la
  ventana declarada y una pregunta ya cerrada no hace leer a nadie. Es lo que
  salva la clase el día que (a) no esté. Con el reloj torcido se puede empezar
  tarde; quedarse fuera de la pregunta, no.
  El PROFE también es un cliente: sus instantes NACEN en hora común, o su reloj
  torcido rompe a toda la clase a la vez.
  Regla ejecutable **`reloj-sala`** (`core/normsCheck.js`): un instante de la
  sala en la misma línea que `clock.now()` rompe CI — con contra-prueba de que
  un aparato midiendo SU propia duración (el player Individual) sigue siendo
  legítimo. Tests: `tests/serverNow.test.mjs` (7, incluido el CABLEADO real con
  `fetch` inyectado) · `tests/liveGate.test.mjs` (5) · y `tools/live-smoke.mjs`
  gana un alumno con el reloj desplazado: **paridad** de cuenta atrás con hora
  de servidor y **cinturón** sin ella. Verificado que la red FALLA sin el
  arreglo (se revirtieron las dos defensas y salió el fallo de aula exacto:
  «el profe ve 6 y el alumno 31»).
  **Por qué ninguna red lo veía antes**: las seis corren en UNA máquina con UN
  reloj — `live-smoke` abría host y alumno en el mismo navegador, desfase 0. Era
  un punto ciego estructural, y de una FAMILIA entera: todo lo que DIFIERE entre
  aparatos (red, suspensión, pantalla real). El reloj salió primero porque
  decide puntos. Diagnóstico completo: `docs/handoff-reloj-aparatos.md`.
  **Lo que queda FUERA de §22-5, declarado** (decisión v1.51.421): el resto de la
  familia —red lenta, móvil que se suspende, tamaño de pantalla real— NO tiene
  ley propia. Se pensó §31 y se descartó: una ley sin red que la vigile es
  decoración, y hoy solo sabemos escribir la red del reloj (la del desfase, en
  `live-smoke`). Escribir §31 sin test incumpliría *«si es norma, es test»* en su
  propio estreno. Queda como **límite conocido**: si uno de los tres muerde,
  primero se escribe su red y después su ley — en ese orden, como se hizo aquí.
### Los LÍMITES de esta ley — permanentes, no pendientes (v1.51.421)

Los cuatro puntos de arriba están cerrados. Lo que queda **no es una lista de
tareas**: son tres límites que se ACEPTAN por escrito. Se cambia el rótulo a
propósito — un "pendiente" que nadie puede resolver deja de leerse como tarea y
empieza a leerse como reproche; a los tres meses ya nadie sabe si es grave.

| Límite | Por qué es estructural | Qué haría falta |
|---|---|---|
| **El veredicto de Individual y Tarea lo AFIRMA el cliente** (`results` y `assignment_attempts` son declaraciones, append-only) | Sin identidad de alumno ni validación en el servidor, no hay contra quién contrastar. Y el daño real es bajo: el que se engaña a sí mismo en Individual no le quita nada a nadie | Identidad de alumno (D1) **o** código en el servidor |
| **El tope de intentos es por IDENTIDAD, no por persona** — borrar los datos del navegador o entrar en incógnito da intentos nuevos | El alumno es anónimo POR DISEÑO (R3). Cerrar esto exige lo contrario de lo que el norte protege | Identidad de alumno (D1) |
| **En carrera la clave viaja al móvil** (excepción declarada en §22-2) | Cada alumno va a su ritmo: sin clave local, el móvil no puede decir "correcto" y re-encolar el fallo al instante | Un **hook de PocketBase** en la Pi que juzgue en el servidor |

**Decisión del usuario (v1.51.421)**: los dos primeros quedan como límites
permanentes — D1 está en estudio y **no se ejecuta** hasta responder si le
compensa al docente (ver `docs/decisiones-pendientes.md`). El tercero, el hook,
**queda fuera por ahora**: sería la primera vez que metemos código de servidor,
en una Pi COMPARTIDA con otros proyectos, y ahora mismo estamos cerrando huecos,
no abriendo superficie. Se reabre solo si aparece un caso real de trampa en
clase — que hasta hoy no ha aparecido.

## 23) ⚖️ LEY DE VISTA — ciclo de vida de una pantalla
Las normas 4, 6 y 10 son piezas de esta ley; aquí está el cuadro completo de
dueños. El síntoma de violarla siempre es el mismo: algo del pasado (un reloj,
un handler, un observer, un modal) sigue vivo pintando encima del presente.

| Pieza | Dueña de | PROHIBIDO |
|---|---|---|
| **VISTA** (`views/*`, montada en `#app`) | su render + sus handlers `on(APP,…)` + sus disposers (`acquire()`/`ctx`) | listeners globales sin remove · guardar referencias DOM entre montajes · estado module-level salvo preferencia declarada (filtro de home) |
| **ROUTER** (`core/router` + `setBeforeResolve`) | el ciclo de vida: `clearListeners(APP)` antes de CADA ruta | que una vista lo esquive colgando handlers "para siempre" |
| **RELOJES** | `createCountdown` (duración) · `startDeadlineTicker` (hasta instante del servidor) · `startElapsedTicker` (ascendente) · `ctx.setInterval` (polling con limpieza) | `setInterval` a pelo (regla `reloj-primitivo`) · `Date.now()` en dominio (→ `clock.now()`) |
| **AZAR** | `azar.random()` de `core/azar.js` (y `shuffle()`, que es su dueño) · o inyectado por parámetro (`rnd = Math.random` en la firma) | `Math.random()` LLAMADO en su sitio dentro de `kernel/` o `templates/` (regla `azar-primitivo`) · Fisher–Yates escrito a mano |
| **CALLBACKS DIFERIDOS** (`setTimeout` que repinta) | guard de vida: `if (!rootEl()) return` / `host.isConnected` / `ctx.setTimeout` | repintar sin comprobar que la ruta sigue viva (el patrón wheel es el ejemplar) |
| **OVERLAYS en `<body>`** (toast, modales, banner) | cierre propio + **cierre en `hashchange`** si sobrevive a la ruta (loginModal) | quedar huérfanos encima de la vista siguiente |

- **Ejemplares** (así se hace): `views/studentLive.js` (100% ctx + primitivos +
  disposer de suscripción) · `views/playerView.js` (token de generación
  anti-carrera async) · `views/editView.js` (único listener de window en views/,
  con remove en el disposer).
- **El azar es la gemela del reloj** (v1.51.592): lo mismo que se hizo con el
  tiempo hay que hacerlo con la suerte, y por la misma razón — que se pueda
  REPRODUCIR desde fuera. Se descubrió por una red que mentía: `tools/shots.mjs`
  comparaba dos capturas del MISMO árbol y cantaba ~2.500 píxeles de cambio
  porque Quiz baraja sus opciones al montar. El apaño de entonces apagaba el
  barajado desde el `rules` de esa actividad: conocía el ajuste de UNA plantilla,
  no servía para las otras doce, y fotografiaba una pantalla que la clase NO ve.
  Con `semilla(7)` se siembra la FUENTE y la herramienta retrata el juego de
  verdad, dos veces igual. Lo que la ley NO toca, porque no es contenido jugable:
  el confeti, las partículas, los IDs, el jitter de reconexión y —sobre todo—
  los PIN de sala y de tarea, que deben ser impredecibles.
- **Tests que lo vigilan**: `reloj-primitivo` + `azar-primitivo` + `resize-observer` en
  `core/normsCheck.js`/`tests/norms.test.mjs` · `tests/events.test.mjs`
  (delegación + clearListeners) · `tests/deadlineTicker.test.mjs` (guard
  anti-zombi).
- **Arreglado en L3**: `started_at` de hostLive con `clock.now()` (era el único
  `new Date()` vivo de la vista → relojes de carrera testeables con tiempo
  congelado) · guard de vida en el giro de Abre-Cajas y en el "cubrir" de
  Memoria-Equipos · loginModal se cierra al navegar (quedaba huérfano y
  bloqueaba reabrirse).
- **✅ CERRADO (M8)**: las vistas de LIVE ya no miran el reloj del sistema — todo
  deadline y cronómetro pasa por `clock.now()` o por los primitivos de
  `core/deadlineTicker.js`, y `tests/clock.test.mjs` FALLA si vuelve un
  `Date.now()` crudo a `hostLive`/`studentLive`. En hostLive, el cronómetro de
  carrera y el repintado de respaldo estaban copiados en sus dos pantallas
  (lista de progreso y tablero): ahora es `startRaceLoop(repaint, cada)` y los
  ritmos tienen nombre en `core/timings.js` (`RACE_POLL_MS`/`BOARD_POLL_MS`).
  `tools/live-smoke.mjs` cubre además la CARRERA de punta a punta (el cronómetro
  avanza de verdad → el progreso del alumno llega → podio), que era el hueco
  declarado del runner.
- **✅ CERRADO (R2)**: `views/vsView.js` registra sus 5 `setTimeout` de ritmo en
  el lifecycle (`acquire('vsView')` + `release()` en su dispose — nuevo
  `release(key)` para vistas embebidas que desmonta un PADRE sin hashchange);
  match/diagram guardan y sueltan el disposer de `observeResize` al terminar; y
  el wiring del evento `'online'` vive UNA vez en la factory de `offlineQueue`
  (las tres colas lo copiaban). Vigilado en `tests/offlineQueue.test.mjs`.
  Cicatriz útil: el primer intento redeclaró el parámetro `ctx` de `mountVs` →
  SyntaxError al cargar y la app entera sin arrancar — lo cazó
  `tools/matrix-smoke.mjs` (0/37), no las suites de Node. La matriz va después
  de cualquier cambio en vistas, siempre.
- **Deuda registrada**:  `Date.now()` en expiración de tokens
  (`auth`/`classroomAuth`: legítimo reloj de pared, pero con `clock.now()`
  serían testeables) · timestamps de `editList` con `new Date()` crudo.

## 24) ⚖️ LEY DE CONTENIDO — el modelo evoluciona por caminos declarados
El contenido de una actividad es del USUARIO: sobrevive años en PB/localStorage.
Solo puede cambiar de forma por caminos versionados y testeados — nunca por un
módulo que lo "arregle" al vuelo.

| Camino | Único mecanismo | PROHIBIDO |
|---|---|---|
| **Evolución de forma** | `migrateContent` + subir `meta.templateVersion` (idempotente; `core/migrate.js` lo aplica fail-safe con `?? content`) | cambiar la forma sin migración (contrato: versión >1 EXIGE migrate) · una migración que devuelva `undefined` ya no puede borrar contenido |
| **Cambio de formato** (gesto Wordwall) | `kernel/content/convert.js` (entre modelos) + `adoptContent` de la plantilla destino (afinado de FORMA intra-modelo) | convertir a mano en una vista/editor · un switch "directo" que produzca contenido inservible (era el caso Sopa↔Crucigrama) |
| **IDs** | `rid()` de `core/ids.js` (prefijos `q_ p_ it_ w_ ps_ pin_ m_ cw_`) | `Math.random().toString(36)` a mano (regla `id-rid`) |
| **Edición** | el editor hace CRUD del contenido; los PARÁMETROS los lee el scorer | lógica de juego en el editor (el caso patrón: el Timer muerto de Emparejar) · campos que ningún player/scorer lee |
| **En caliente** | el player LEE; normalizar es de `migrate`/`adoptContent` | mutar `activity.content` durante el juego |

- **Tests que lo vigilan**: `templateContract` (migrate idempotente + versión>1
  ⇒ migrate) · regla `id-rid` en `normsCheck`/`tests/norms.test.mjs` ·
  `tests/switchTemplate.test.mjs` (conversores).
- **Arreglado en L4**: los 9 generadores de id a mano migrados a `rid()`
  (quiz/math/match/memory/crossword + toast/embedModal/adaptadores/stressTest —
  el allowlist de la regla es SOLO `core/ids.js`) · `migrate` fail-safe ·
  contrato versión>1⇒migrate · **Sopa↔Crucigrama por fin convierte de verdad**:
  `adoptContent` en ambas (Crucigrama→Sopa se queda las palabras; Sopa→Crucigrama
  las CRUZA con el auto-layout del generador, pistas vacías para el editor).
- **Deuda registrada**: `ensureContent` de ballsort vive en su editor y lo
  importan player/getRoundPayload (el editor como dependencia del runtime —
  moverlo a template) · campos muertos que aún se escriben (`rules.allowOverflow`
  en tildes/comas, `hintMode` de crossword, `answerIdx`/`kind`/`audio` de quiz,
  `rules.timer`/`livesPerMistake` residuales de match/diagram) · el editor de
  quiz lleva la 3ª copia de la regla de respuesta correcta (las otras:
  template.migrate y qaAdapt) · modelo `entries` huérfano en models.js ·
  `sessionItems`/`activityItemCount` mantienen dos listas paralelas de nombres
  de colección · la pseudo-plantilla `list` de `views/editList.js` define su
  actividad a mano fuera del contrato · Ruleta/Abre-Cajas no pueden VOLVER a
  Quiz (falta `items→qa`).

---

## §25 · CAPACIDAD — el sistema tiene límites, y son UNO

> **Dueño**: `core/quotas.js` · **PROHIBIDO**: escribir un límite en cualquier
> otro sitio (vista, esquema, script). · **Vigilada por**: `tests/quotas.test.mjs`.

El servidor es **una Raspberry Pi compartida con otros proyectos**. Hasta
v1.51.340 no había ningún tope: ni actividades por profe, ni tamaño real por
actividad (200 KB por imagen, un aviso a 1,5 MB… y el campo de PocketBase
aceptando 5 MB: tres números que nadie podía comparar), ni borrado de las salas
en vivo, que crecen para siempre aunque la partida durase 20 minutos.

**Los cuatro números** (decisión D6, `docs/decisiones-pendientes.md`):

| Límite | Valor | Quién lo aplica |
|---|---|---|
| Actividades por profe | 200 | **AVISO** — una regla de PB no sabe contar filas, y se dice |
| Tamaño de UNA actividad | 2 MB | **EL SERVIDOR** (`maxSize` del campo `data`) |
| Una imagen DENTRO de un ítem (foto de la pregunta) | 200 KB | el cliente, al subirla |
| Una imagen que es el LIENZO (fondo · dibujo del diagrama) | 800 KB / 1920 px | el cliente, al subirla |
| Retención de salas en vivo | 120 días | el profe, desde `#/admin` → Capacidad |

**Por qué DOS presupuestos de imagen** (2026-08-13): no es lo mismo la foto que
acompaña un enunciado —se ve pequeña— que el lienzo sobre el que se trabaja. Un
diagrama se mira de cerca y sus rótulos se leen: con 200 KB / 1280 px salía
borroso justo donde hay que señalar. El fondo ya usaba el presupuesto grande por
su cuenta; ahora el número está UNA vez y el diagrama entra en él. Dos lienzos al
máximo siguen cabiendo de sobra en los 2 MB que aplica el servidor — lo comprueba
`tests/quotas.test.mjs`.

**Reglas que se derivan:**
- **Un número, un sitio**: el panel `#/admin`, `tools/setup-pocketbase.ps1` y
  `core/upload.js` LEEN de `core/quotas.js`. El test compara el `maxSize` del
  script con el módulo: si divergen, falla.
- **Se avisa antes de rebotar**: el editor avisa al 70% y dice claramente cuándo
  el servidor va a rechazar (§22 — lo que no se puede aplicar, se declara como
  aviso, no se disfraza de veredicto).
- **La retención NUNCA toca el registro del profe**: se purgan `live_sessions`,
  `live_answers`, `live_players` y `live_claims`; jamás `results` ni
  `assignment_attempts`. Una fila **sin fecha no se purga** (§24: ante la duda,
  se conserva el dato del usuario).
- **La purga la ejecuta el DUEÑO** de esas colecciones (`purgeOldLive` en los dos
  adaptadores, §21), nunca la vista; y siempre puede CONTAR sin borrar (`dryRun`).
- **Las credenciales de HOY no se borran**: `live_claims.deleteRule` exige
  `created < @todayStart`, porque borrar la credencial viva de un jugador
  permitiría robarle el puesto (§22-4). Lo evalúa el servidor, no el cliente.

## §26 · BUCLES EN VIVO — el catálogo está congelado

> **Dueño**: `core/templateContract.js` (`LIVE_POLICIES`) · **PROHIBIDO**: añadir
> un bucle o una fase de sala sin decisión escrita. · **Vigilada por**:
> `tests/liveLoops.test.mjs`.

un concurso tiene UN solo bucle de juego; nosotros **cuatro** (rondas · carrera · tablero ·
pedir la palabra) repartidos entre dos vistas de 840 y 714 líneas — y las tres
regresiones en vivo de julio cayeron justo donde se cruzan. Mientras se decide el
rediseño (**estudio completo y medido en `docs/estudio-bucles-live.md`**), el
catálogo queda CONGELADO: una plantilla con política inventada, una fase de sala
nueva, o una elección de bucle más por NOMBRE de plantilla rompen CI.

**Cada bucle declara CÓMO SE GANA**, y esa regla vive en el motor, no en la vista
(cuadro completo en `docs/modos-de-juego.md` §9.4 y en CLAUDE.md):

<!-- GENERADO:bucles -->
| Bucle | Fase | Quién avanza | **Cómo se gana** | Puntos | Fin | Plantillas que lo declaran |
|---|---|---|---|---|---|---|
| `rounds` · Rondas juntas | `question` | el profe o el reloj | más puntos | bonus: base×500 + bonus por velocidad | al agotar las preguntas | Comas · Operaciones · Quiz · Tildes |
| `race` · Carrera libre | `race` | cada alumno | **terminar primero con todas bien** (empate ⇒ hora de meta) | **planos**: el puntaje ES el nº de aciertos | política declarada: todos · primeros N · tiempo | Comas · Operaciones · Quiz · Tildes |
| `board` · Tablero | `race` | cada alumno | avanzar más en el tablero | escala propia de la plantilla (Pelotas: 0-1000 por eficiencia) | igual que la carrera | Ordena las Pelotas |
| `claim` · Pedir la palabra | `question-live` | el profe (a quien pide turno) | los puntos que da el docente | manuales (+10/+50), sin clave de respuesta | lo cierra el docente | Abre Cajas · Ruleta |

> Generado de `core/liveLoops.js` + `meta.play.live` de las 13 plantillas.
> El modelo de puntos lo decide `pointsModeFor(loop)`: `rounds`→`live` · `race`→`race` · `board`→`race` · `claim`→`live`.
<!-- /GENERADO:bucles -->

En carrera un fallo VUELVE A LA COLA: todo el que termina lo hace con TODAS bien,
así que el puntaje no ordena y **manda la hora de meta**. El desempate va en los
DOS caminos que ordenan alumnos —`core/liveRank.js` (marcador) y
`views/sessionTable.js` (`finishMs`, de donde sale el PODIO del profe)— y el
podio la MUESTRA. Vigilado por `tests/raceRank.test.mjs`, con contra-prueba de
que en rondas el bonus de velocidad sigue vivo.

**Deuda declarada y acotada (§0)**: hoy las vistas de vivo eligen bucle mirando
el nombre de la plantilla en 4 sitios (`activity.template === 'wheel'`…). Es una
violación de "un modo no conoce plantillas concretas". No se arregla ahora, pero
el test fija el número: **no puede crecer**.

**La prueba de CARGA cuenta como cliente**: `core/stressTest.js` simula un alumno
anónimo, así que tiene que cumplir lo mismo que él — desde §22-4 eso incluye
registrar la credencial del dispositivo (`live_claims`) y mandar `X-WW-Claim`.
Sin eso el servidor rechaza sus respuestas con 403 y el informe lo contaba como
"filas perdidas bajo carga", culpando al hardware de una regla (reproducido: 200
rechazos en 439 ms contra un PocketBase local y ocioso). Vigilado por
`tests/stressClaim.test.mjs`, con contra-prueba de que un rechazo se INFORMA como
rechazo, con su código HTTP.

## §27 · VIAJES — si es un tramo del norte, tiene su RECORRIDO

> **Dueño**: `tools/preflight.mjs` (las redes) + `tests/helpers/journeyTracks.mjs`
> (los tramos) · **PROHIBIDO**: dar por probado un tramo del viaje del profesor
> sin un recorrido que lo camine con el navegador; y prohibido que un recorrido
> se salte la interfaz o se dé a sí mismo el veredicto. · **Vigilada por**:
> `tests/journeys.test.mjs`.

La extensión natural de *"si es norma, es test"*. Teníamos las suites en verde y la
clase encontró cinco fallos en una semana. Ninguno estaba en una pieza: **los
cinco vivían en la costura entre piezas correctas.**

| Lo que falló | Las piezas | Los tests decían | El profe vio |
|---|---|---|---|
| Buscar desde la portada | el enlace y el router, cada uno correcto | ✅ routing 5/5 | "Ruta no encontrada" |
| Carrera en vivo | snapshot, PATCH y scorer, cada uno correcto | ✅ race-e2e verde | todo suena a error |
| Pantalla completa en VS | el botón, en el DOM, con su CSS | ✅ `querySelector` lo veía | no se puede pulsar |
| Nº de páginas | el componente, ya unificado | ✅ activityCard verde | no sale en la portada |

De ahí las tres reglas:

**1 · Cada tramo del norte (§1) tiene UN recorrido automático.** Los tramos están
declarados en `tests/helpers/journeyTracks.mjs` y son los mismos que mide la
radiografía. Hoy: buscar/crear → `find-smoke` · pizarra → `matrix-smoke` · en
vivo → `live-smoke` · tareas/informes → `task-smoke` · los 13 editores → `edit-audit` (crear → PIN → jugar → tope
de intentos → informe) · carrera contra PocketBase real → `race-e2e` (manual,
pide credenciales). Un tramo sin recorrido es un tramo donde el primero en
enterarse es el profesor — y en TAREAS ni siquiera eso: el fallo es silencioso
y se descubre semanas después, con los intentos ya perdidos.

**2 · El recorrido usa la app como el profe, y NO se da el veredicto a sí mismo.**
Se teclea en la caja real, se pulsa el botón real, y quien decide es la
aplicación. `race-e2e` llamaba a `submitRaceAttempt` con el `correct` ya
calculado por el test: probaba el ranking fingiendo probar la carrera, y por eso
no vio que el móvil daba por fallada una hoja perfecta.

**3 · Se comprueba lo que TOCA EL DEDO, no lo que existe en el DOM.** El botón de
pantalla completa existía, se veía a medias y estaba debajo del marcador del
duelo (z-index 10 vs 5). `querySelector` decía que sí; el dedo del profe decía
que no. Los controles de los que depende una clase se verifican con
`elementFromPoint`: pantalla completa, el envío de la ronda y el "Revelar" de
Equipos — 47 comprobaciones por pasada en `matrix-smoke`.

### Corolario: al unificar, migrar también la DECISIÓN

El quinto fallo no fue de costura sino de configuración, y merece su propia
frase porque es el error más fácil de repetir: **un componente compartido con una
lista de banderitas por llamador no está unificado.** `activityCardHtml` era
único desde julio… y cada vista decidía por su cuenta qué enseñaba, así que el
badge de nº de páginas solo salía en "Mis actividades" y el subtítulo faltaba en
la portada. La duplicación se había mudado del markup a la configuración, donde
no se ve.

Señal de alarma medible: **más de ~3 banderitas booleanas por llamador**. Cuando
pasa eso, la pieza necesita VARIANTES declaradas (`variant: 'mine' | 'library'`)
con los campos informativos encendidos por defecto, y un ratchet que impida
apagarlos en silencio (`tests/activityCard.test.mjs`). Lo mismo aplica a
`meta.play`: ahí funcionó desde el principio porque la plantilla DECLARA y la
vista LEE, en vez de que cada vista configure.

**Antes de tocar `main` (que sirve la web): `node tools/preflight.mjs`** — las
redes del preflight en ~2 min, y para en la primera que falle enseñando SU salida. La
suite sola (`--rapido`) no basta para un cambio en vistas, CSS o router: es
exactamente el hueco por el que se colaron los cinco.

## §28 · EN CLASE — el profe no configura y el alumno no puede romper

> **Dueño**: `core/templateContract.js` (tope de opciones) + `tools/matrix-smoke.mjs`
> (escaneo del marco) · **PROHIBIDO**: un tercer control de partida en una
> plantilla, y cualquier control destructivo o de identidad DENTRO del marco de
> juego. · **Vigilada por**: `tests/playOptions.test.mjs` (contra-prueba del
> tope) + `tests/journeys.test.mjs` (que el escaneo siga conectado).

Las dos restricciones del norte que faltaban por convertir en test (§6b las
tenía como hueco declarado):

**R2 — "el profe no configura nada para empezar", ACOTADA.** Las opciones de
partida (`meta.play.options`) existen como excepción declarada y con techo que
el contrato EXIGE: máximo **dos** por plantilla, de 2 a 4 valores cada una, y el
vigente viene siempre YA elegido. Sin el techo, R2 no muere de un golpe: muere
por acumulación — cada opción nueva es razonable y la pantalla de inicio acaba
siendo un formulario. `core/playOptions.js` prometía este tope en un comentario
("lo vigila el contrato") y nadie lo vigilaba: una promesa en un comentario no
es una norma.

**R2b — quien toca la pizarra es UN ALUMNO sobre la sesión del profe.** El profe
lanza la actividad y sale el alumno a resolver (§1, la mayoría de las veces).
Dentro del marco de juego (`#ww-frame`, que es TODO lo visible en pantalla
completa) no puede existir ningún control destructivo ni de identidad: borrar o
editar la actividad, publicar/despublicar, la papelera, el menú de sesión.
"No debería tocarlo" no protege de un dedo curioso con la clase mirando; que NO
ESTÉ en el DOM, sí. `matrix-smoke` escanea el marco en cada plantilla × modo,
por SELECTORES concretos y no por texto — el teclado numérico tiene un "Borrar"
(un dígito) perfectamente legítimo.

---

## ⚖️ §29 · PRESUPUESTO — el coste de conducir la clase se MIDE

> **Dueño**: `tools/matrix-smoke.mjs` (el coste dentro de la ronda) +
> `tools/find-smoke.mjs` (el coste de llegar a ella) · **PROHIBIDO**: añadir un
> toque, un diálogo o un avance automático al camino que el profe recorre con la
> clase delante. · **Vigilada por**: la sección "PRESUPUESTO DE CONDUCCIÓN" de
> `matrix-smoke` + el conteo de toques de `find-smoke`.

El norte abre §2b diciendo *"la promesa de §2 es medible o no es nada"* — y sus
18 filas llevaban meses sin medirse ni una. Esta ley empieza por los que el
propio norte marca como **los de más peso**, porque son los que deciden si el
profe vuelve a usar la actividad al día siguiente:

**1 · Jugar no abre diálogos.** Ni `confirm`, ni `alert`, ni `prompt` durante la
ronda, en ninguno de los tres modos de pizarra. "Pasar a la siguiente pregunta:
1 toque, **sin diálogos ni confirmaciones**" es el gesto que se repite toda la
clase; un `confirm()` metido "por seguridad" lo dobla y nadie lo nota en el
portátil del que programa — se nota con 33 críos esperando. La matriz sustituye
los tres diálogos por espías antes de jugar y falla si alguno se llama.

**2 · Revelar nunca solo.** En Equipos, tras responder se espera **sin tocar
nada** y la respuesta NO puede aparecer: la destapa el docente con su botón, o
no se destapa. *"La clase responde en voz alta primero; si la pantalla se
adelanta, mata la participación"* — y matar la participación es matar el
producto, porque para eso existe (§1). Un autoavance añadido "para pulir" sería
invisible para todas las demás redes: monta bien, juega bien, puntúa bien.

**3 · De la lista a jugar, ≤ 3 toques.** `find-smoke` los cuenta de verdad
(pulsa lo que pulsaría el profe y para cuando el juego está montado): hoy son
**2**. Es el momento en que la clase está esperando y el que más barato se
encarece — una pantalla intermedia "solo para elegir el modo" lo dobla.

**4 · SE LEE DESDE EL FONDO DEL AULA — el CONTRASTE, medido** (v1.51.423). Era
la promesa más repetida del proyecto (R1, «mirada a 3 m») y la que menos red
tenía: §3 vigila que no haya tamaños FIJOS, pero un `clamp()` con tope bajo
cumple §3 y aun así se lee diminuto. Ahora la matriz mide, en cada plantilla y
modo, el **contraste real** (color computado contra el fondo real, subiendo por
los ancestros) de todo el texto visible del marco. Umbral **3:1** (AA para texto
grande, que es lo que hay aquí).

Nació encontrando dos fallos reales, los dos del mismo tipo — **letra blanca
sobre el ámbar**, 2,4:1, el peor contraste de la app:
- las **opciones de respuesta** del quiz (`.ww-opt-grid`), que es el texto que
  la clase entera lee a la vez;
- los **globos** (`.gl-c3`).
Arreglados con un token de primer plano por forma (`--ww-shape-N-fg`, oscuro en
el ámbar): 6,2:1 sin tocar el color de la forma, que es lo que la hace
reconocible. Y de paso salió por qué el ratchet de §3 no veía el tamaño fijo de
las opciones: `styles/live.css` estaba clasificado como *chrome* en su lista de
exclusiones, y dentro vive el juego.

**Lo que esta ley todavía NO mide** (declarado, no escondido):
- **Los tiempos** (≤ 15 s al montar, ≤ 3 min crear, ≤ 30 s abrir sala): piden un
  banco de medida estable. En este entorno el reloj mide el rendimiento de un
  servidor, no el de una pizarra: publicar ese número sería peor que no tenerlo.
- **El TAMAÑO del texto, como veredicto.** Se mide y se PUBLICA (informe en la
  matriz: media y los seis textos más pequeños), pero no falla la red — y el
  motivo es honesto: *el texto más pequeño casi siempre es CHROME* (el contador
  «1 / 2», el botón «Girar», el título de la actividad), no lo que hay que leer
  para jugar. Un veredicto rojo sobre ruido se apaga en una semana.
  **Para juzgarlo hace falta una decisión de contrato**: que la PLANTILLA declare
  cuál es su texto de lectura (`data-ww-read`, §0 — la plantilla declara, el
  motor consume), en las 13. Mientras no se tome, el número se ve y se compara
  entre versiones, que ya es más de lo que había.

## ⚖️ §30 · ALCANZABLE — lo que no tiene puerta de entrada, se borra

> **Dueño**: `tests/huerfanos.test.mjs` · **PROHIBIDO**: dejar en el repo un
> módulo que nadie importe, una ruta a la que no lleve ningún enlace o una hoja
> de estilo que nadie cargue. · **Vigilada por**: el escaneo del repo (imports
> estáticos, de efecto secundario y dinámicos + rutas de las `main.*.js` +
> `<link>`/`@import`/`stylesheet:`), con `PUERTAS` declaradas y su motivo.

`views/sorteoView.js` era una ruleta de aula suelta, con su ruta `#/sorteo`
registrada y su vista pintando — **y ni un enlace en todo el producto que
llevara hasta ella**. Llevaba meses así. Cuando salió en una auditoría, la
reacción del dueño del proyecto fue *"eso no lo tenemos, ¿te confundes con la
actividad Ruleta?"*. Detrás vinieron cuatro más: `core/tts.js`,
`themes/colegios/skin.css` (un skin entero que ningún `registerSkin` cargaba),
`tools/test.html` (una SEGUNDA suite de tests, en el navegador, que nadie abría)
y `kernel/contracts/realtimePort.js` (el contrato del puerto en vivo, que no
importaba nadie — y por eso pudo mentir durante versiones).

**Por qué es una ley y no una limpieza.** Un tumor no es peso muerto: MIENTE.
Se lee como código vivo al auditar, sale en las búsquedas, alguien lo "arregla"
cuando lo roza, y el día que se enlaza por casualidad se descubre que llevaba
meses roto — con la clase delante. Peor con los contratos y los tests: una
suite que nadie corre y un typedef que nadie lee son las dos cosas que MÁS
tranquilidad dan y menos vigilan.

**Y ninguna ley anterior lo veía**: `layers` comprueba la DIRECCIÓN de los
imports (no que exista alguno), `moduleRefs` que lo importado EXISTA (no que a
lo que existe lo importe alguien). Las dos miran las flechas; ninguna miraba los
nodos sueltos.

**Las PUERTAS son la parte honesta.** Hay código legítimamente sin importador:
las entradas de página (`main.*.js`, que carga un `<script type=module>`), el
service worker, las herramientas de `tools/`, las suites, una librería de
terceros que se inyecta con un `<script>` en tiempo de ejecución. Cada clase
está declarada CON SU MOTIVO en el propio test — escribir el motivo es cuando se
ve si de verdad lo es. Sin motivo, es un tumor con permiso.

**Contra-prueba obligatoria**: el test comprueba que un módulo huérfano
inventado SÍ sería cazado y que las puertas no eximen de más (una vista
cualquiera no queda exenta por accidente). Sin eso, un fallo del parser —una
forma de `import` no contemplada— dejaría la lista vacía y todo verde, que es
exactamente cómo un tumor sobrevive a su vigilante.

### §30b · Y ADEMÁS: toda ruta tiene una DECISIÓN escrita

> **Dueño**: `tests/rutasNorte.test.mjs` · **PROHIBIDO**: registrar una ruta en
> el router sin decir de qué sección del norte sale. · **Vigilada por**: el
> escaneo de las `main.*.js` cruzado con la tabla `DECIDIDA_EN`.

Lo de arriba caza lo que **nadie alcanza**. Falta la otra mitad, que es la que de
verdad dejó nacer el sorteo: **una ruta puede estar perfectamente enlazada y aun
así no responder a ninguna decisión de producto**. El sorteo tenía su enlace el
día que se escribió; lo perdió después, y nadie se enteró porque nunca hubo una
línea que dijera qué pintaba ahí.

Cada ruta tiene su fila con **la sección del norte que la justifica** y una frase
de qué resuelve. No se exige que el norte escriba `#/mine`: el norte habla de
PANTALLAS, no de URLs, y llenarlo de almohadillas lo volvería ilegible — lo que
se exige es que alguien haya tenido que ESCRIBIR de dónde sale, y que la sección
citada **exista** (si no, la tabla sería un trámite: pones «§9» y pasas).

Tres cierres para que no se pudra: una ruta nueva sin fila rompe CI · una fila
que ya no corresponde a ninguna ruta también (un permiso fantasma acabaría
justificando a la siguiente que se llame igual) · y la contra-prueba comprueba
que `#/sorteo` **no habría llegado a existir**.


---
### Convención de los MD (decidida el 2026-08-11)

La documentación es un **ÁRBOL** con raíz en `CLAUDE.md` → `docs/README.md` →
cada doc; se baja de lo general a lo específico por enlaces, y se sube por la
ficha. Tres reglas, vigiladas por `tests/docs.test.mjs`:

1. **FICHA**: todo doc vivo abre con
   `> **Tipo**: … · **Sube a**: … · **Vigila**: …`. Tipos válidos: `mapa`
   (índices) · `norma` (este doc) · `decisión` (norte, pendientes, estudios) ·
   `guía` (cómo funciona algo hoy) · `plan` (handoffs con trabajo por delante) ·
   `generado` (NO editar a mano; su ficha la emite el generador). Lo de
   `docs/historico/` queda fuera: está congelado a propósito.
2. **CLAUDE.md es el mapa, no el diario**: sin bloques «✅ RESUELTO» (la crónica
   vive en `historico/deuda-resuelta.md`) y con presupuesto de líneas — pasarlo
   obliga a podar o a subir el tope a conciencia.
3. **El comportamiento no se cuenta en prosa**: dado/cuando/entonces (Gherkin)
   SOLO en las fichas de modo (`modos-de-juego.md` §9) y en las decisiones
   pendientes; lo que ya es norma va como TEST, y lo que se prueba a mano va
   como ronda de `qa/` (su `accion`/`espera` ES el cuando/entonces). Un MD que
   describe comportamiento sin ninguna de esas tres formas es un candidato a
   pudrirse.

---
### Cómo se auto-verifica todo
`node tools/preflight.mjs` corre las DIEZ redes (suites + los nueve recorridos)
antes de subir a `main` — es la orden que hay que teclear (§27).
`node tests/run.mjs` corre TODAS las suites. Los escáneres compartidos
(`core/normsCheck.js` / `core/templateContract.js` / `core/skinContract.js`) corren
también en `#/admin` → "Ejecutar tests". Si añades una norma nueva: **escríbela como
test**, no solo en un MD.
