# LEYES del proyecto — índice único (qué · dónde está escrito · qué test la vigila)

> **Cada ley se DESPRENDE de una restricción del norte** — la cadena completa
> (restricción → ley → test) está en `docs/norte.md` §6b, y ahí se ven también
> los huecos: R2 ("el profe no configura nada") todavía no tiene ley, y el tramo
> "buscar/crear" tampoco. Una ley que no puede citar su origen es una ley
> huérfana.
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
- [23) ⚖️ LEY DE VISTA — ciclo de vida de una pantalla](#23--ley-de-vista--ciclo-de-vida-de-una-pantalla)
- [24) ⚖️ LEY DE CONTENIDO — el modelo evoluciona por caminos declarados](#24--ley-de-contenido--el-modelo-evoluciona-por-caminos-declarados)
- [§25 · CAPACIDAD — el sistema tiene límites, y son UNO](#25--capacidad--el-sistema-tiene-límites-y-son-uno)
- [§26 · BUCLES EN VIVO — el catálogo está congelado](#26--bucles-en-vivo--el-catálogo-está-congelado)
- [§27 · VIAJES — si es un tramo del norte, tiene su RECORRIDO](#27--viajes--si-es-un-tramo-del-norte-tiene-su-recorrido)
  - [Corolario: al unificar, migrar también la DECISIÓN](#corolario-al-unificar-migrar-también-la-decisión)
  - [Cómo se auto-verifica todo](#cómo-se-auto-verifica-todo)

### Ir a otro documento

| Documento | Qué responde |
|---|---|
| [`norte.md`](norte.md) | para quién es la app, la escena real y cómo se decide (**manda sobre el resto**) |
| [`arquitectura-modulos.md`](arquitectura-modulos.md) | la radiografía: capas, imports, esfuerzo por tramo y mapa de datos (GENERADO) |
| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles en vivo |
| [`decisiones-pendientes.md`](decisiones-pendientes.md) | lo aplazado, con su condición para reabrirlo |
| [`estudio-bucles-live.md`](estudio-bucles-live.md) | por qué el vivo es como es (estudio medido) |
| [`testing.md`](testing.md) | las suites y las cuatro redes de seguridad |
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
  `math.css`/`quiz.css` con assert duro a cero; §3b andamio de regiones).
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
  **La especificación ya es ejecutable (R3/R4)**: `node tools/css-inventory.mjs`
  cuenta qué clases de Bootstrap usa la app de verdad, por familia (hoy ~3.900
  usos: texto 761 · iconos `bi` 690 · spacing 613 · botones 507 · flex 371 ·
  forms 279 · grid 216 · …). El CSS propio se escribe familia a familia,
  empezando por la de más usos; re-correr el inventario tras cada migración dice
  cuánto falta (debe tender a 0). Los iconos son decisión aparte: `bi` es una
  FUENTE, no CSS — vendorizarla o pasar a SVG inline.
  **Themes ya están en el escáner de px (R3)**: `tests/styles.test.mjs` congela
  los 7 `font-size` fijos que quedaban en arcade/colegios/tv-show como baseline
  propio (solo encoge) — la cifra "27" de la deuda era vieja; L5/M7 ya habían
  limpiado el resto.
- **Deuda registrada**: `themes/colegios/skin.css` huérfano (en disco, sin
  `registerSkin` — decidir si se registra o se retira; fijado en
  `KNOWN_ORPHANS`; su copia del teclado es CÓDIGO MUERTO, no una 4ª copia viva) · deuda de ratchet en vs/teams/wordsearch (la mayor) +
  match/memory/ballsort/crossword/textCorrection/question-live ·
  `themes/*/skin.css` aún fuera del escáner de px (27 font-size fijos entre
  arcade/tv-show/colegios) · el escape por selector `.mem-`/`-ed\b` exime más de
  lo que debería (todo memory) · `rgba()` de superficie sin vigilar.
  (Las reglas muertas del skin `space` no registrado se retiraron en L5.)

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
- `basePoints`/`wrongPoints`/`useKahoot`. Tildes VS: 1 punto fijo por tilde buena
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
- **Sigue pendiente**: nada de los cuatro. Lo que queda en §22 son los límites
  DECLARADOS: el veredicto autodeclarado de Individual/Tarea (`results` y
  `assignment_attempts` son afirmaciones del cliente, append-only), el tope de
  intentos por IDENTIDAD y no por persona (rotar el anon id da intentos nuevos), y
  la carrera libre, que necesita un validador en el servidor. Los tres piden lo
  mismo para cerrarse de verdad: **identidad de alumno** (PIN/NFC,
  `docs/handoff-acceso-docente.md`) o **código en el servidor** (hook de PB).

## 23) ⚖️ LEY DE VISTA — ciclo de vida de una pantalla
Las normas 4, 6 y 10 son piezas de esta ley; aquí está el cuadro completo de
dueños. El síntoma de violarla siempre es el mismo: algo del pasado (un reloj,
un handler, un observer, un modal) sigue vivo pintando encima del presente.

| Pieza | Dueña de | PROHIBIDO |
|---|---|---|
| **VISTA** (`views/*`, montada en `#app`) | su render + sus handlers `on(APP,…)` + sus disposers (`acquire()`/`ctx`) | listeners globales sin remove · guardar referencias DOM entre montajes · estado module-level salvo preferencia declarada (filtro de home) |
| **ROUTER** (`core/router` + `setBeforeResolve`) | el ciclo de vida: `clearListeners(APP)` antes de CADA ruta | que una vista lo esquive colgando handlers "para siempre" |
| **RELOJES** | `createCountdown` (duración) · `startDeadlineTicker` (hasta instante del servidor) · `startElapsedTicker` (ascendente) · `ctx.setInterval` (polling con limpieza) | `setInterval` a pelo (regla `reloj-primitivo`) · `Date.now()` en dominio (→ `clock.now()`) |
| **CALLBACKS DIFERIDOS** (`setTimeout` que repinta) | guard de vida: `if (!rootEl()) return` / `host.isConnected` / `ctx.setTimeout` | repintar sin comprobar que la ruta sigue viva (el patrón wheel es el ejemplar) |
| **OVERLAYS en `<body>`** (toast, modales, banner) | cierre propio + **cierre en `hashchange`** si sobrevive a la ruta (loginModal) | quedar huérfanos encima de la vista siguiente |

- **Ejemplares** (así se hace): `views/studentLive.js` (100% ctx + primitivos +
  disposer de suscripción) · `views/playerView.js` (token de generación
  anti-carrera async) · `views/editView.js` (único listener de window en views/,
  con remove en el disposer).
- **Tests que lo vigilan**: `reloj-primitivo` + `resize-observer` en
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
| Una imagen | 200 KB | el cliente, al subirla |
| Retención de salas en vivo | 120 días | el profe, desde `#/admin` → Capacidad |

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

Kahoot tiene UN bucle de juego; nosotros **cuatro** (rondas · carrera · tablero ·
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
| `rounds` · Rondas juntas | `question` | el profe o el reloj | más puntos | Kahoot: base×500 + bonus por velocidad | al agotar las preguntas | Comas · Operaciones · Quiz · Tildes |
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

La extensión natural de *"si es norma, es test"*. Teníamos 87 suites verdes y la
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
vivo → `live-smoke` · carrera contra PocketBase real → `race-e2e` (manual, pide
credenciales). Un tramo sin recorrido es un tramo donde el primero en enterarse
es el profesor.

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
cuatro redes en ~45 s, y para en la primera que falle enseñando SU salida. La
suite sola (`--rapido`) no basta para un cambio en vistas, CSS o router: es
exactamente el hueco por el que se colaron los cinco.

---
### Cómo se auto-verifica todo
`node tools/preflight.mjs` corre las CUATRO redes (suites + los tres recorridos)
antes de subir a `main` — es la orden que hay que teclear (§27).
`node tests/run.mjs` corre TODAS las suites. Los escáneres compartidos
(`core/normsCheck.js` / `core/templateContract.js` / `core/skinContract.js`) corren
también en `#/admin` → "Ejecutar tests". Si añades una norma nueva: **escríbela como
test**, no solo en un MD.
