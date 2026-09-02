# Plan · DETECTAR LAS COSTURAS — basura, duplicados, declaraciones que nadie obedece, polimorfismo a medias

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Pedido por el dueño el 2026-09-02, tras tres días en que cada arreglo
> destapaba otro del mismo tipo: «aún hay mucha basura, cosas duplicadas o
> propósito no bien estructurado, cosas mal cableadas o no cableadas,
> polimorfismos no bien aplicados… ¿cómo podemos detectarlo? Haz un plan».
> Este doc ES el plan. Lo que salga de correrlo se convierte en barridos de
> `tools/auditoria.mjs` y en tests, no en párrafos (regla del skill `/auditoria`).

## 0 · Qué encontró esta semana, y por qué ninguna red lo vio

Los seis defectos de los últimos tres días **no eran bugs de una pieza**. Cada
uno era una **costura** entre dos piezas correctas:

| Defecto (versión) | Forma de la costura |
|---|---|
| El reloj vivía en tres sitios y el editor lo ofrecía en 4 de 13 (v1.51.640) | **la misma regla escrita varias veces** (§21b) |
| Diagrama, Emparejar, Memoria y Crucigrama declaraban «sin cuenta atrás» porque no sabían qué hacer al llegar a cero (v1.51.641) | **contrato a medias**: el shell ofrecía `alAgotarse` y 4 de 13 no lo cableaban |
| Teclear repintaba el editor; la pestaña volvía a la primera (v1.51.642) | **un gesto destruye lo que el usuario toca** (solo se ve caminando) |
| La Ruleta declaraba «no llevo reloj» y salía con cronómetro (v1.51.644) | **declaración que solo un lado obedece**: la miraba el editor, no el juego |
| `rules.crono`: un ajuste del profe para una decisión que es de la plantilla (v1.51.644) | **ajuste en la capa equivocada** (§0) |
| `admiteCrono` exportado sin llamantes (v1.51.644) | export muerto — **esta sí la cazó §30** |

Solo la última tenía barrido. Las cinco primeras tienen la misma anatomía:
**algo se DECLARA en un sitio (meta, rules, un método del contrato, un evento,
un selector) y quien debería LEERLO no lo lee, o lo leen dos con dos
criterios.** Ese es el hilo del plan: cada barrido nuevo es un cruce
«¿quién escribe X? · ¿quién lee X?», y lo que tiene escritor sin lector (o
lector sin escritor, o dos lectores con reglas distintas) es la basura.

Lo que YA hay y no se repite aquí: exports muertos y citas rotas
(`tools/auditoria.mjs`), módulos sin importador y rutas sin enlace
(`tests/huerfanos.test.mjs`), ajustes del editor que nadie lee
(`tests/ajusteConectado.test.mjs`), colecciones PB y claves `ww.*` con dueño
(`core/normsCheck.js`), capas que no se cruzan (`tests/layers.test.mjs`), CSS
(`tools/css-inventory.mjs`). Este plan es lo que **falta** entre esas redes.

## 1 · Los SIETE barridos (cada uno: escritor × lector)

Cada barrido tiene tres partes y un coste distinto:
- **(M) mecánica** — un script Node sin modelo, que produce una LISTA. Barato,
  repetible, entra en `tools/auditoria.mjs` con baseline (ratchet) el día que
  nace para no bloquear el preflight con deuda vieja.
- **(J) juicio** — alguien lee la lista y dice, por entrada, `basura` /
  `conectar` / `legítimo (motivo)`. Es trabajo de LECTURA, no de diseño: lo
  hace un motor barato con la plantilla de veredicto de §3.
- **(D) decisión** — solo las entradas donde el juicio dice «hay que
  replantear» llegan al dueño (o a Fable). Son pocas.

### B1 · DECLARACIÓN SIN LECTOR — `meta.*`, `rules.*`, `scoring.*`, `live.*`, `presentation.*`
**EJECUTADO ✅** (`tools/costuras-declaraciones.mjs`, baseline 15 → 0; detalle en §1b).
Lo que cazó la Ruleta. Hoy `ajusteConectado` mira solo lo que el EDITOR
escribe; falta el cruce completo.
- **(M)** Para cada clave que alguna plantilla declara en `meta` (hoy: 30
  claves distintas leídas fuera de `templates/`) y para cada campo de
  `defaultRules/defaultScoring/defaultLive`: lista de ficheros que la LEEN
  fuera de la plantilla. Salida: `clave · nº plantillas que la declaran ·
  lectores`. Sospechosos: lectores = 0 (declaración muerta), o lectores solo en
  `core/editor*` (la lee el formulario y no el juego — la Ruleta), o UNA
  plantilla declara algo que ninguna otra declara (¿mecanismo privado
  disfrazado de contrato?).
- **(J)** Por sospechoso: ¿quién DEBERÍA leerla? Si nadie → borrar la clave de
  las 13. Si el juego → conectar (y decir en qué módulo).
- **Test de salida**: tests/declaracionLeida.test.mjs (nuevo) — toda clave de `meta`
  tiene al menos un lector fuera del editor, salvo lista `SOLO_EDITOR` con motivo.

### B2 · CONTRATO A MEDIAS — los métodos estáticos de las 13
**EJECUTADO ✅** (`tools/costuras-contrato.mjs`, baseline 16 → 0; detalle en §1b).
Lo que cazó Diagrama/Emparejar. `templateContract` valida que existan; no mira
si son **iguales**, **vacíos** o **inalcanzables**.
- **(M)** Matriz 13 plantillas × cada `static` que la plataforma invoca (hoy 9:
  `renderPlayer · renderEditor · scoreSubmission · getRoundPayload ·
  renderRound · renderRoundHost · renderRaceCell · migrateContent ·
  adoptContent`). Por celda: `propio` / `heredado de base` / `stub` (cuerpo
  ≤ 2 líneas que devuelve null/{}/false) / `copiado` (cuerpo idéntico
  normalizado al de otra plantilla). Además: métodos que las plantillas
  definen y NADIE invoca desde la plataforma (hoy hay plantillas con 12
  estáticos y la plataforma llama a 9).
- **(J)** `stub` en una plantilla cuyos `modes` dicen que ese camino existe →
  contrato a medias (el juego arranca y no hace nada). `copiado` en ≥2 → sube a
  `templates/base.js` o al modelo de contenido (`kernel/content/`). Definido
  sin invocador → §30.
- **Test de salida**: el escaneo entra en `tests/templateContract.test.mjs`
  con dos reglas: «si `modes.X` está encendido, el método que X necesita no es
  stub» y «ningún estático sin invocador».

### B3 · LA VISTA QUE CONOCE UNA PLANTILLA (§0 al revés del polimorfismo)
**EJECUTADO ✅** (`tools/costuras-plantilla-en-vista.mjs`, baseline 9 → 0; detalle en §1b).
Un `if (template === 'wheel')` en una vista es un método del contrato que
falta. Hoy quedan 3 (`core/liveLoops.js`, `views/home.js`…) y cada uno es una
decisión: o se convierte en declaración (`meta.*`) o se documenta como
excepción.
- **(M)** `meta.name ===`, `.template ===`, `contentModel ===` con literal,
  fuera de `templates/` y `core/registerTemplates.js`. Y su primo:
  `switch (a.template)` en `core/homePreview.js` es LEGÍTIMO (dibuja por tipo)
  — se declara.
- **(J)** Por hallazgo: ¿qué pregunta está haciendo la vista? («¿esta
  plantilla puntúa sola?») → esa pregunta es la clave `meta` que falta.
- **Test de salida**: regla `vista-sin-plantilla` en `core/normsCheck.js`
  con lista de excepciones con motivo.

### B4 · CABLEADO SIN EXTREMO — handlers, ids, eventos, `data-*`
**EJECUTADO ✅** (`tools/costuras-cableado.mjs`, baseline 50 → 0; detalle en §1b).
254 handlers delegados. Ninguna red comprueba que el selector que escuchan
exista en algún HTML que se pinte, ni al revés.
- **(M)** Cuatro cruces — ESCRITO: `tools/costuras-cableado.mjs` (primera pasada 2026-09-02: 3 · 24 · 3 · 20 = 50 hallazgos, que son su baseline):
  1. `on(root, 'click', '.sel')` → ¿aparece `class="…sel…"` o `id="sel"` en
     algún literal HTML del repo? (huérfano: escucha a nadie).
  2. `id="x"` / `data-ww-*` pintados → ¿alguien hace `#x`/`[data-ww-*]`?
     (huérfano: nadie lo toca).
  3. `GameEvents.X`: emitido en algún sitio Y escuchado en otro. Hoy
     `PLAYER_ANSWERED` aparece UNA vez en todo el repo (o se emite sin oyente
     o se escucha sin emisor).
  4. `lsSet('ww.x')` sin `lsGet` y al revés (extiende `ls-dueno`).
- **(J)** Casi todo es borrar. Lo que no: un selector que existe solo en HTML
  generado por concatenación (falso positivo) → se apunta el patrón y el
  barrido aprende.
- **Test de salida**: los cuatro cruces en `tools/auditoria.mjs` como
  barridos con baseline.

### B5 · LA MISMA REGLA ESCRITA DOS VECES (§21b, pero medido)
**EJECUTADO ✅** (`tools/costuras-duplicados.mjs`, baseline 67 → 0; detalle en §1b).
No duplicado textual (eso lo ve cualquier linter) sino **semántico**: dos
funciones que hacen lo mismo con otro nombre, y dos frases de UI que explican
la misma regla (el «0 = sin límite» vivía en dos sitios hasta ayer).
- **(M)** (a) cuerpos de función normalizados (sin nombres de variable, sin
  espacios) con similitud de tejas (shingles, k=8) ≥ 0,7 entre ficheros
  distintos; (b) literales de texto de UI ≥ 25 caracteres repetidos en ≥ 2
  ficheros; (c) números mágicos repetidos (`200 * 1024`, `600`, `0.75`…) que
  no vienen de `core/quotas.js` / `core/constants.js` / `core/timings.js`.
- **(J)** Por par: `misma regla` (→ un dueño, el otro llama) · `parecido de
  forma, distinta intención` (→ legítimo, se anota) · `misma frase` (→ una
  constante o un helper).
- **Test de salida**: (c) entra en `norms` como regla `numero-con-dueno`; (a)
  y (b) quedan como barrido con baseline (el umbral se APRIETA por pasadas).

### B6 · AJUSTE EN LA CAPA EQUIVOCADA (§0)
**EJECUTADO ✅** (`tools/costuras-capa.mjs`, baseline 22 → 0; detalle en §1b).
`rules.crono` era una decisión de la PLANTILLA puesta como ajuste del PROFE.
- **(M)** Cruzar cada campo de `defaultRules()` con: ¿lo lee el player de la
  plantilla (contenido/plantilla), o lo lee `core/`/`views/` (modo/plataforma)?
  Y cada `meta.*`: ¿lo lee solo la propia plantilla? (entonces es privado, no
  contrato). Cuatro columnas, cuatro capas — y cada valor tiene que caer en UNA.
- **(J)** Por campo: ¿QUIÉN debe decidirlo, el que prepara la clase o la
  mecánica? Es la pregunta de §0 hecha campo por campo. El dueño la responde
  en una tabla (media hora, no más).
- **Test de salida**: la tabla queda como `CAPA_DE` en el test de B1: un campo
  nuevo sin capa declarada rompe CI.

### B7 · UN GESTO DESTRUYE LO QUE SE TOCA (solo caminando)
**EJECUTADO ✅** (sondas en `tools/matrix-smoke.mjs`/`tools/live-smoke.mjs`, no un
script aparte; 2 → 0, con un bug real cazado — detalle en §1b).
El de la pestaña. No es estático: hay que medirlo en el navegador. La sonda
`tools/edit-audit.mjs` ya lo hace para los 13 editores; falta el resto de sitios
donde un humano tiene algo entre manos.
- **(M)** Extender el patrón (foco · pestaña · scroll · selección ANTES y
  DESPUÉS de cada gesto) a: la antesala (apodo, nº de equipos), el alumno en
  vivo (respuesta a medias cuando llega un snapshot), la tarea (PIN, nombre),
  los modales (buscar imagen, IA), el buscador de la biblioteca (scroll al
  teclear). Va en `tools/matrix-smoke.mjs` y `tools/live-smoke.mjs`, no en un
  tool nuevo.
- **(J)** Ninguno: o pasa o no pasa.
- **Regla de instrumento**: **cada red nueva se comprueba en rojo antes de
  creerla en verde** (la primera versión de la red de la pestaña dio verde con
  el bug puesto). Eso va en `/auditoria` §4 como paso obligatorio.

## 1b · ESTADO (2026-09-02, al cierre de la primera pasada)

| Barrido | Script | 1ª pasada | Hoy | Qué salió |
|---|---|---|---|---|
| B4 cableado | `tools/costuras-cableado.mjs` | 50 | **0** | 7 basuras · TICK conectado · política de fin al editor · STREAK conectado · almacén unificado (35 sitios, regla `almacen-crudo`) |
| B1 declaraciones | `tools/costuras-declaraciones.mjs` | 15 | **0** | 14 claves fuera del esquema (3 declaradas por las 13 sin lector; 6 viajando en el JSON de toda actividad); 4 «prometidas sin mecánica» retiradas |
| B3 vista↔plantilla | `tools/costuras-plantilla-en-vista.mjs` | 9 | **0** | 4 conectados a `esHojaDeTexto()`; la ruleta a `core/ruleta/` (pieza del bucle) |
| B2 contrato | `tools/costuras-contrato.mjs` | 16 | **0** | 6 cuerpos tecleados dos veces subidos a su dueño; el editor de Tildes/Comas unificado |
| B5 duplicados | `tools/costuras-duplicados.mjs` | 67 | **0** | 16 dueños nuevos (toasts, PRNG único, tile de imagen, modal, cableado de lista de ítems en 6 editores…); 24 coincidencias declaradas con motivo |
| B6 capa | `tools/costuras-capa.mjs` | 22 | **0** | los 10 ajustes de sala del Quiz eran copias de `DEFAULT_LIVE`; 4 gates pasan de capacidad a declaración y el contrato lo exige |
| B7 gestos | `edit-audit` + `matrix-smoke` + `live-smoke` | 2 | **0** | antesala · biblioteca · modales · alumno en vivo. Cazó un bug real: «Pausa» del host borraba la marca en curso del alumno |

Colateral: la regex que quitaba comentarios se tragaba medio `core/selftest.js`
(invisible a TODAS las reglas desde que existe) → `core/sinComentarios.js`, dueño
único. Y la sonda del lápiz medía en ms absolutos → calibrada contra el reposo.

## 2 · Cómo se corre — quién hace qué

Las reglas de OPERACIÓN de los agentes (un agente edita, nunca ejecuta git; un
barrido a la vez por sesión; retomar con `git status` + suite; cada red nueva
se comprueba en ROJO antes de creerla) viven en el skill `/auditoria` §3b —no
se copian aquí, se citan.

El plan está pensado para que **lo caro sea poco**. Tres roles:

| Rol | Motor | Qué hace | Coste |
|---|---|---|---|
| **Escribir los barridos (M)** | Sonnet | un script por barrido, con la contra-prueba dentro (una entrada plantada a propósito debe salir) | 7 scripts, ~1 h cada uno |
| **Juzgar las listas (J)** | Haiku/Sonnet, en paralelo, uno por barrido | lee cada entrada + los dos ficheros que cita y rellena la plantilla de §3. NO cambia código | proporcional a la lista; se recorta con el baseline |
| **Decidir (D)** | Fable + el dueño | solo las entradas marcadas `replantear`; la tabla de capas de B6 | corto: es leer veredictos, no código |
| **Ejecutar** | Sonnet, con `/entregar` | borrar/conectar por lotes de un barrido, un commit por barrido, preflight cada uno | 7 commits |

Orden: **B4 → B1 → B2 → B3 → B5 → B6 → B7**. Los tres primeros son los que
tienen más «borrar» y menos juicio; se gana espacio antes de mirar lo fino.
B7 va último porque son sondas de navegador y tardan.

**Cadencia**: un barrido por sesión, no los siete de golpe. Cada barrido entra
en `tools/auditoria.mjs` con su baseline el mismo día que se escribe — así lo
que se limpia no vuelve, aunque el resto de la lista siga abierta.

**Invocación desde una sesión**: cada (M) y cada (J) se lanza como agente
con el prompt de §3; los (J) de barridos distintos van en paralelo, porque no
dependen entre sí. El orquestador (esta sesión) solo recoge veredictos.

## 3 · La plantilla de veredicto (para el motor barato)

Cada entrada de cada lista se responde con EXACTAMENTE esto, sin prosa:

```
ENTRADA:   <lo que dice el barrido, tal cual>
LEÍ:       <los 1-3 ficheros abiertos para decidir>
VEREDICTO: basura | conectar | legítimo | replantear
PORQUÉ:    <una frase, con el fichero:línea que lo prueba>
ACCIÓN:    <si basura: qué borrar · si conectar: quién debe llamar a quién ·
            si legítimo: el motivo que va en la lista de excepciones ·
            si replantear: la pregunta de diseño, en una línea>
```
Reglas para quien juzga: no inventar intención («probablemente se usa para…»
no vale: si no se encuentra el lector, es `basura` o `replantear`); no
proponer refactors grandes (eso es `replantear`, y lo decide otro); y **cada
`legítimo` lleva motivo** porque ese motivo es lo que entra en la lista de
excepciones del test.

## 4 · Qué se mide al final (para saber si sirvió)

- Nº de entradas por barrido en la primera pasada → el baseline. Cada pasada
  siguiente lo APRIETA (el número solo baja).
- Nº de reglas nuevas en `tests/` / `normsCheck.js`: el objetivo son 7 (una
  por barrido). Si un barrido no deja test, no ha terminado.
- Líneas: `core/` tiene hoy 15.348, `views/` 8.363, `templates/` 5.816. Lo que
  se borre se apunta en cada commit; no es la meta pero sí el termómetro.
- **La contra-prueba de cada red, en el commit**: «con X plantado a propósito,
  la red sale en rojo». Sin esa línea, la red no se acepta.

## 5 · Lo que este plan NO hace

- No reordena carpetas ni renombra módulos «para que quede bonito»: cada
  cambio sale de una entrada con veredicto.
- No toca contenido guardado (§24) aunque un campo se declare basura: se deja
  de leer y se limpia por migración versionada, si algún día hace falta.
- No sustituye la mano del compañero: B7 mide lo que un humano toca, pero la
  pizarra real sigue en la hoja de pruebas manual.
