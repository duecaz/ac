# D7 · Estudio: ¿cuántos bucles de juego en vivo tenemos, y cuánto cuestan?

Kahoot tiene **UN** bucle (pregunta → responder → revelar → ranking) y sus tipos
de pregunta son variantes dentro de ese bucle, no juegos distintos. Esa decisión
es la que le permite añadir tipos de pregunta sin tocar el motor de la partida.

Este estudio responde tres cosas antes de decidir nada: **cuántos bucles tenemos
de verdad**, **quién los elige**, y **qué cuesta cada uno**. Medido sobre el
código, no de memoria (v1.51.340).

## 1. El catálogo REAL no es el catálogo DECLARADO

`meta.play.live` admite tres valores (`core/templateContract.js:46`):

```
LIVE_POLICIES = ['rounds', 'board', 'none']
```

y así están declaradas las 13 plantillas: 6 en `rounds`, 1 en `board`
(Ordena las Pelotas), 6 en `none`.

Pero el sistema ejecuta **cuatro** bucles distintos:

| Bucle | Fase de sala | Quién lo elige | ¿Declarado? |
|---|---|---|---|
| **Rondas** (manual/automático) | `question` → `reveal` → `leaderboard` | la plantilla (`play.live:'rounds'`) | ✅ sí |
| **Carrera libre** | `race` | **el PROFE**, en un `<select>` del lobby | ❌ **no** |
| **Tablero compartido** | `race` (reutilizada) | la plantilla (`play.live:'board'`) | ✅ sí |
| **Pedir la palabra** | `question-live` | **la VISTA, por NOMBRE de plantilla** | ❌ **no** |

Dos de los cuatro no salen de la declaración de la plantilla. Y el cuarto se
elige así (`views/hostLive.js:200`):

```js
const isQL = activity.template === 'question-live' || activity.template === 'wheel';
```

Eso es una lista de nombres concretos de plantilla dentro de la capa de MODO —
justo lo que la ley §0 prohíbe ("un modo no conoce plantillas concretas"). Hay
cuatro sitios más con el mismo patrón (`hostLive.js:669`,
`studentLive.js:243-244`). **Hallazgo principal del estudio**: el problema no es
tener cuatro bucles, es que dos no están declarados y uno se decide mirando el
nombre de la plantilla.

## 2. Lo que cuesta cada bucle

- `views/hostLive.js`: **840 líneas**, 13 ramas por fase.
- `views/studentLive.js`: **714 líneas**, 11 ramas por fase.
- La fase `race` está **compartida** entre dos bucles distintos (carrera libre y
  tablero), y cada vista la desambigua con su propio `isBoard`. O sea: un bucle
  nuevo no añade una rama, añade una rama **en cada una de las dos vistas** más
  su desambiguación.

Las tres regresiones en vivo de este mes cayeron todas en esa zona: el reencolado
de la carrera (v1.51.335), el `submitProgress` no atómico del tablero (deuda F) y
el repintado de carrera sobre el podio (auditoría G). No es casualidad: es donde
se cruzan los bucles.

## 3. Qué NO hay que hacer

Unificar los cuatro bucles en uno **no** es la conclusión. Cada uno responde a
una necesidad de aula real y distinta:

- **Rondas**: la clase entera en la misma pregunta (el bucle de Kahoot).
- **Carrera**: cada alumno a su ritmo, el profe ve avanzar a todos.
- **Tablero**: un puzzle único que cada alumno resuelve (Ordena las Pelotas).
- **Pedir la palabra**: el contenido no tiene clave — puntúa el docente.

Fusionarlos daría un motor con un `if` por cada diferencia: el mismo coste,
peor repartido.

## 4. Propuesta (para decidir, no ejecutada)

1. **Declarar el catálogo completo**: `LIVE_LOOPS = ['rounds','race','board','claim','none']`.
2. **Una plantilla declara los bucles que SOPORTA, no uno solo**: hoy Quiz vale
   para rondas *y* para carrera, pero solo puede declarar `'rounds'`; por eso la
   carrera acabó siendo una opción suelta del profe que se ofrece incluso donde
   no tiene sentido. Sería `play.live: ['rounds','race']`.
3. **El `<select>` del lobby se CONSTRUYE desde esa declaración** y desaparecen
   los cinco `activity.template === '…'` de las vistas (§0).
4. **Congelar**: no se añade un quinto bucle sin entrada en `docs/leyes.md` y su
   test — que es lo único de esta lista que ya está hecho
   (`tests/liveLoops.test.mjs`: el catálogo de hoy queda fijado y una plantilla
   con un bucle inventado hace fallar CI).

Coste estimado de 1-3: un pase sobre `templateContract`, las 13 metas y las dos
vistas de live, con la matriz jugable y `live-smoke` como red. No es urgente: no
hay ningún bug abierto por esto. Es deuda de DISEÑO, y ahora está medida.

---

# Ficha 1 · `rounds` — contrastada paso a paso con Kahoot

Kahoot es el modelo declarado para este bucle. Aquí está su secuencia real frente
a la nuestra, paso por paso, con lo que falta y lo que **no** conviene copiar.
Medido sobre `views/hostLive.js` y `views/studentLive.js` (v1.51.341).

## El bucle, paso a paso

| # | Kahoot | Nosotros hoy | Veredicto |
|---|---|---|---|
| 1 | Lobby con PIN, apodos apareciendo, música | Lobby con PIN + **QR**, lista de jugadores, expulsar | ✅ igual o mejor |
| 2 | **Se muestra SOLO el enunciado** unos segundos ("prepárate") — el móvil aún no deja responder | ❌ **no existe**: se abre la pregunta y las respuestas a la vez | 🔴 **falta lo más importante** |
| 3 | Opciones en la pizarra con texto; en el móvil **solo color/forma** | Opciones **con texto** también en el móvil (la plantilla pinta la ronda) | 🟡 decisión, no fallo (ver abajo) |
| 4 | Cuenta atrás + nº de respuestas; cierra por tiempo o al responder todos | Igual (`time-left`, `ans-count`, cierra por timer o `allAnswered`) | ✅ igual |
| 5 | Revelación: correcta destacada + **distribución** por opción | Igual + **nombres de quién eligió cada opción** | ✅ + extra propio (con matiz, ver riesgos) |
| 6 | En el móvil: correcto/incorrecto, puntos, racha, **tu puesto y a cuánto estás del de arriba** | Correcto/incorrecto, puntos, racha… **sin puesto ni distancia** | 🔴 falta |
| 7 | Marcador entre preguntas con **flechas de quién subió/bajó** | Top 10 estático; el alumno ve "mira la pizarra" | 🟡 falta el movimiento |
| 8 | Siguiente pregunta | Igual (manual o automático con cuenta atrás) | ✅ igual |
| 9 | Podio + resumen personal ("acertaste 7 de 10") | Podio + pantalla de final | ✅ igual |

## Lo que hay que tomar de Kahoot, por orden de valor/coste

**R-1 · Fase de LECTURA antes de abrir respuestas** (la más importante).
Hoy la pregunta y las opciones aparecen juntas: gana quien hace clic rápido, no
quien lee. Kahoot separa "lee el enunciado" de "responde" desde su primera
versión, y es lo que hace que el bonus por velocidad sea justo — el cronómetro
de respuesta empieza cuando **todos** han podido leer.
Implementación honesta: NO hace falta una fase de sala nueva (§26 la congela);
basta con que `question` lleve un instante `answersOpenAt` y que el móvil pinte
el enunciado en modo "prepárate" hasta ese instante. El sello ya lo sabe poner
el servidor (§22-1, `itemOpenedAt`). Duración: configurable, 0 = como ahora.

**R-2 · Tu puesto y tu distancia, en el móvil, tras cada pregunta.**
Es el motor de enganche de Kahoot: "2º · a 120 puntos de Ana" hace que el alumno
levante la vista. Tenemos el `leaderboard()` derivado y ya se consulta en la
pantalla de clasificación: es coserlo en el reveal del alumno. Coste bajo,
efecto alto.

**R-3 · Tiempo POR pregunta.**
Hoy hay UNA ventana para toda la actividad (`live.questionTimer`, 20s por
defecto: `core/timings.js`). Kahoot deja 5-240s por pregunta. Una de comprensión
lectora y un 2+2 no pueden compartir cronómetro. Cambio de modelo de contenido
(campo `seconds` por ítem, con la ventana de la actividad como valor por
defecto) → toca migración versionada (§24).

**R-4 · Movimiento en el marcador** (flechas ↑↓ y "estás aquí" para el alumno).
Cosmético comparado con R-1/R-2, pero es lo que convierte la tabla en narrativa.

## Lo que NO hay que copiar (y por qué)

- **Ocultar el texto de las opciones en el móvil**: en Kahoot funciona porque
  SIEMPRE hay pizarra. Nosotros corremos en aulas donde a veces solo hay móviles;
  sin texto en el móvil, el juego es imposible. Y nuestras plantillas no son solo
  opción múltiple: en Tildes/Comas el texto **es** la pregunta. Si se hace, que
  sea un interruptor del profe ("hay proyector"), nunca un cambio a ciegas.
- **La música y la ceremonia continua**: en pizarras de gama baja (`ww-lite`) el
  coste de animación importa más que el espectáculo.

## Riesgo propio a decidir (no es de Kahoot)

En la revelación mostramos **los nombres de quién eligió cada opción**. Para el
docente es oro (ve al instante quién no entendió); proyectado en la pizarra, es
exponer al que falló delante de toda la clase. Kahoot no lo hace por eso.
**Sugerencia**: mantenerlo, pero como interruptor del profe y **apagado por
defecto en la proyección**; en el informe posterior, siempre visible.

## Sobre los tres botones del lobby (manual · automático · carrera)

Están al mismo nivel y **no son la misma clase de cosa** — ese es el origen del
desorden que vimos en el estudio:

- *Manual* y *Automático* responden a **"¿quién avanza?"** → son un ajuste DEL
  bucle de rondas.
- *Carrera* responde a **"¿cómo juega la clase?"** → es OTRO bucle (cada alumno
  a su ritmo, sin pregunta compartida).

Ponerlos en un único `<select>` es lo que hizo que la carrera nunca se declarara
en la plantilla (§0) y que se ofrezca incluso donde no tiene sentido.

**Propuesta**: dos preguntas separadas en el lobby.

1. **¿Cómo juega la clase?** → `Rondas juntas` · `Carrera libre` · `Tablero`
   — construido desde lo que la plantilla DECLARA que soporta (`play.live` pasa a
   ser una lista), no desde un `<select>` fijo.
2. **(solo si eligió Rondas) ¿Quién avanza?** → `Yo` / `Automático`, un toggle.

Así el lobby enseña dos decisiones pequeñas en vez de tres opciones desiguales,
y el catálogo `LIVE_LOOPS = ['rounds','race','board','claim','none']` deja de ser
una lista teórica: es lo que el profe ve.

## Orden sugerido para seguir

1. Cerrar el diseño de `rounds` (R-1 → R-4) y el lobby de dos preguntas.
2. Ficha de `race` (avance automático): qué significa "terminar", qué ve el que
   va último, y si la carrera debe tener tiempo límite.
3. Ficha de `board` (tablero compartido).
4. Ficha de `claim` (pedir la palabra) — la única sin clave de respuesta, donde
   el veredicto es del docente.

---

# Ficha 1b · El bucle `rounds` CERRADO — máquina de estados propuesta

Tres preguntas que quedaban abiertas, respondidas.

## A · ¿Por horario o por retardo? — por INSTANTE, y ya lo hacemos así

Kahoot no "abre a una hora": el anfitrión abre la pregunta y **el servidor fija
el instante de cierre**; cada dispositivo solo calcula *cuánto falta*. Nosotros
ya funcionamos exactamente así (`views/hostLive.js:261` escribe un `deadline`
ISO en la sala; el móvil hace `deadline - clock.now()`), y es la decisión
correcta por tres razones concretas:

- **Un retardo (`setTimeout` de N segundos en cada móvil) se desincroniza**: cada
  teléfono lo arranca cuando *él* pintó, así que el que tiene peor red juega con
  menos tiempo. Un instante compartido no tiene ese sesgo.
- **Sobrevive a recargar y a entrar tarde**: quien llega a mitad de pregunta ve
  el tiempo que queda de verdad, no una ventana nueva.
- **Es verificable en el servidor** (§22-1): el `ms` de cada respuesta se mide
  contra ese instante sellado, no contra lo que afirme el móvil.

Regla que se deriva y hay que respetar: **todo lo que gobierne el ritmo del
juego se escribe como INSTANTE en la fila de la sala; nunca como un temporizador
local**. La fase de lectura (R-1) es un instante más, no un `setTimeout`.

## B · El bucle, paso a paso (con los dos instantes)

La sala lleva, por pregunta: `current_item`, `answersOpenAt` (cuándo se pueden
tocar las respuestas) y `deadline` (cuándo cierra). **Las fases de sala NO
cambian** (`question` → `reveal` → `leaderboard`, §26 sigue congelada): la
lectura vive DENTRO de `question`.

```
LOBBY
  │  el profe pulsa Empezar
  ▼
QUESTION ── el host escribe de una vez:
  │           current_item = i
  │           answersOpenAt = ahora + lectura(i)
  │           deadline      = answersOpenAt + segundos(i)
  │
  ├─ [1] LECTURA   (ahora → answersOpenAt)
  │      pizarra: enunciado grande (+ imagen)
  │      móvil:   el mismo enunciado y "prepárate… 3·2·1", botones BLOQUEADOS
  │      → nadie puede clicar al azar; el reloj de respuesta no ha empezado
  │
  ├─ [2] RESPUESTA (answersOpenAt → deadline)
  │      pizarra: opciones + cuenta atrás + nº de respuestas
  │      móvil:   la ronda de la plantilla, activa
  │      el ms se mide desde answersOpenAt (servidor) → el bonus de velocidad
  │      premia pensar rápido, no tener mejor móvil
  │      cierra por: deadline vencido  ó  todos han respondido
  ▼
REVEAL ── veredicto del SERVIDOR (settle, §22)
  │      pizarra: correcta destacada + distribución por opción
  │      móvil:   correcto/incorrecto · +puntos · racha · **tu puesto y a
  │               cuánto estás del de arriba**  (R-2)
  ▼
LEADERBOARD
  │      pizarra: top con flechas ↑↓ de quién subió o bajó (R-4)
  │      móvil:   tu fila resaltada
  │
  ├─ ¿quedan preguntas? → vuelve a QUESTION con i+1
  │     · por defecto lo dispara el PROFE ("Siguiente")
  │     · si activó "avanzar solo", lo dispara el cronómetro
  ▼
PODIO + resumen personal ("acertaste 7 de 10")
```

Casos borde que este diseño resuelve solo, y hay que probar:
- **Entrar a mitad de lectura** → ve la lectura y responde con todos.
- **Entrar a mitad de respuesta** → responde con el tiempo que queda (menos), que
  es lo justo y lo que hace Kahoot.
- **Recargar el móvil** → ambos instantes vienen de la sala; no gana tiempo extra.
- **Pausa del profe** → ya existe (`deadline: null` congela la barra); con la
  lectura, pausar durante la lectura la congela igual.
- **`lectura = 0`** → se comporta exactamente como hoy (retrocompatible).

## C · ¿Quitamos "manual" y dejamos solo automático, como Kahoot?

**No, y el motivo es que la premisa no es exacta**: en Kahoot en vivo el docente
**también avanza a mano** entre preguntas por defecto — el automatismo está
DENTRO de la pregunta (el cronómetro cierra solo), y "avanzar solo por las
preguntas" es una opción que se activa, no el comportamiento base. Nuestro
`advanceMode` por defecto ya es `manual`: coincidimos con el modelo sin saberlo.

Tres razones propias para no quitarlo:
1. **El valor pedagógico está justo ahí**: la revelación es cuando el profe dice
   "¿por qué tres eligieron B?". Un avance automático se lleva por delante ese
   momento, que es la mitad de la clase.
2. **Aulas reales**: con móviles y redes desiguales, el automático deja atrás al
   que aún está entrando o al que se le cayó el wifi.
3. Ya está implementado y probado en las dos vistas; quitarlo es perder función.

**Lo que sí cambia es DÓNDE vive la opción.** Hoy son tres hermanos desiguales
en un `<select>` ("manual · automático · carrera"). Propuesta:

```
¿Cómo juega la clase?     [ Rondas juntas ] [ Carrera libre ] [ Tablero ]
                            ← solo las que la PLANTILLA declara soportar

(si eligió Rondas)
  Avanzar de pregunta:    ( • ) Yo controlo      ( ) Solo, cada 5 s
  Tiempo de lectura:      [ 3 s ]      ← 0 = como hasta ahora
```

Dos decisiones pequeñas y ordenadas en vez de tres opciones que mezclan "qué
juego" con "quién avanza". Y el catálogo `LIVE_LOOPS` deja de ser teoría: es
literalmente lo que el profe ve en el lobby.

## D · Qué habría que tocar (estimación honesta)

| Pieza | Cambio |
|---|---|
| `core/timings.js` | `readWindowMs(activity, item)` junto a `questionWindowMs` |
| host: abrir pregunta | escribir `answersOpenAt` además de `deadline` (mismo PATCH) |
| `views/studentLive.js` `paintQuestion` | pintar lectura hasta `answersOpenAt`; medir el ms desde ahí |
| `views/hostLive.js` `paintQuestion` | la pizarra muestra enunciado y luego opciones |
| reveal del alumno | añadir puesto + distancia (R-2) desde el `leaderboard()` ya existente |
| lobby | las dos preguntas separadas (C) |
| tests | instantes en `deadlineTicker`/`serverMs`; `live-smoke` con lectura > 0 |

**No** toca: fases de sala (§26 intacta), reglas de PocketBase, esquema, ni el
scorer. Es un cambio de ritmo, no de motor.

---

# Ficha 1c · APLICADO (v1.51.343)

Lo que estaba escrito arriba como propuesta, ya en producción:

- **R-1 · Lectura antes de responder.** `core/timings.js readSeconds()` (3 s por
  defecto, tope 30, `0` = como antes). El host abre la pregunta con
  `openQuestion()`: **un solo PATCH con los dos instantes** (`answers_open_at` y
  `deadline`). La pizarra oculta las opciones (`.hl-reading`) y el móvil se ve
  pero no se toca (`.s-reading`, `pointer-events:none`) hasta el instante. El
  `ms` se mide desde `answers_open_at`, no desde que el móvil pintó.
- **R-2 · Puesto y distancia** en el móvil tras cada pregunta ("2º de 12 · a 120
  puntos de Ana" / "¡vas primero!"), del `leaderboard()` derivado del servidor —
  la misma fuente que el podio, así que no pueden discrepar.
- **R-4 · Movimiento** en el marcador del host (flechas ↑↓ contra la ronda
  anterior).
- **Lobby de dos preguntas**: "¿Cómo juega la clase?" construido desde
  `play.live` de la plantilla + (solo en rondas) "¿quién avanza?" y "tiempo de
  lectura". Se fue el `<select>` de tres opciones desiguales.
- **§0 SALDADA**: `play.live` es una LISTA (`core/liveLoops.js`) y las vistas
  preguntan `supportsLoop(...)`. Quedan **0** sitios eligiendo por nombre de
  plantilla (eran 4); la ruleta se declara en `rules.selector`, y `normalize()`
  lo rellena en las actividades antiguas.

**Hueco que encontró el test** (`tests/roundsLoop.test.mjs`): "Saltar pregunta"
abría la siguiente por su cuenta, sin lectura y con el reloj ya corriendo. Ahora
los tres caminos (empezar · siguiente · saltar) pasan por `openQuestion()`, y el
test falla si aparece un cuarto.

**Pendiente declarado de esta ficha**: R-3 (tiempo POR pregunta) — toca el modelo
de contenido y su migración (§24), y no se ha hecho.

---

# Ficha 2 · `race` — la carrera libre

Medido sobre `views/hostLive.js paintRace` y `views/studentLive.js paintRace`
(v1.51.344). **No tiene referente en Kahoot**: lo más parecido es su modo
asignado (student-paced), pero ese es una TAREA, no una clase en directo con la
pizarra puesta. Aquí el referente somos nosotros, así que las decisiones hay que
tomarlas, no copiarlas.

## Cómo corre hoy

1. El profe elige "Carrera libre" y pulsa Empezar → fase `race`, **sin deadline**.
2. Cada alumno recibe su cola de ítems y avanza a su ritmo. Su móvil **juzga en
   local** (excepción declarada de §22-2: la sala lleva el contenido completo) y
   colorea al instante; el fallo **se re-encola al final** y vuelve más tarde.
3. La pizarra muestra una **lista ordenada por aciertos** con barra de progreso y
   un cronómetro ascendente. El host **re-puntúa cada fila** con la clave real
   (`paintRace` línea 606): el veredicto del móvil no cuenta para el ranking.
4. Termina **solo cuando el profe pulsa "Terminar carrera"** → `endSession`
   liquida lo pendiente y sale el podio.

## Diferencias de fondo con `rounds`

| | `rounds` | `race` |
|---|---|---|
| Quién marca el ritmo | el profe (o el reloj) | **cada alumno** |
| Qué ve la pizarra | la pregunta actual | **quién va por dónde** |
| Cuándo se puntúa | al revelar cada ítem (settle) | al cerrar la carrera |
| Quién juzga en el momento | el servidor | el móvil (hint), el host re-puntúa |
| Ítem fallado | se queda fallado | **vuelve a la cola** |
| Fin | se acaban las preguntas | **lo decide el profe** |

Ese último renglón es el problema de diseño: en rondas el juego tiene final
propio; en carrera **no termina nunca solo**.

## Las tres preguntas abiertas, con recomendación

**C-1 · ¿Qué significa "terminar"?** — ✅ **DECIDIDO Y APLICADO (v1.51.346)**
Hoy: nada — la carrera sigue hasta que el profe corta, aunque los 30 hayan
acabado hace dos minutos. El primero en terminar se queda mirando una pantalla
de "esperando" sin saber cuánto.
**Recomendación**: la carrera termina cuando se cumple lo primero de estas tres,
y el profe lo elige al empezar: **(a) todos terminan** (por defecto), **(b) los
primeros N terminan**, **(c) tiempo límite**. En los tres casos el profe
conserva el botón de cortar. Sin esto, "terminar" es un acto de voluntad y la
clase se queda en el limbo.

**C-2 · ¿Qué ve el que va último?** — ✅ **DECIDIDO Y APLICADO (v1.51.345)**
Hoy ve su cola y su contador; en la pizarra aparece **el último de una lista
ordenada por aciertos**, con su nombre y su barra vacía, proyectado. Eso es
exposición pública del que menos sabe, y en una carrera dura varios minutos —
mucho más tiempo que la revelación de una pregunta.
**Recomendación**: la pizarra muestra **avance, no ranking**: mismo orden que la
lista de clase (o alfabético) y barras de progreso, con la posición SOLO en el
podio final. El profe puede activar "ordenar por avance" si quiere competición.
Es la decisión análoga a la de los nombres en la revelación de rondas.

**C-3 · ¿Debe tener tiempo límite?**
**Recomendación: opcional y visible.** Si el profe pone límite, se escribe como
INSTANTE en la sala (`deadline`, igual que en rondas — §26 ficha 1b) y todos ven
el mismo cronómetro **descendente**; sin límite, el cronómetro es ascendente
como hoy. Nada de temporizadores locales.

## Deuda propia de este bucle (ya conocida)

- La fase `race` la comparten **carrera y tablero**; cada vista desambigua con su
  propio `isBoard`. Al declarar el catálogo (§26) el bucle ya está declarado,
  pero **la fase sigue compartida** — separarlas es trabajo pendiente.
- El re-cálculo del ranking en el host es O(alumnos × ítems) **en cada
  repintado** (`RACE_POLL_MS`). Con 30 alumnos y 20 ítems son 600 evaluaciones
  por tick; funciona, pero es el sitio donde una clase grande se notará primero.

---

# Ficha 3 · `board` — el tablero compartido

Medido sobre `paintLiveBoardHost` y `paintLiveBoard`. Hoy solo lo usa **Ordena
las Pelotas**. Tampoco tiene equivalente en Kahoot ni en Wordwall en vivo.

## Cómo corre hoy

1. Comparte la fase `race` (no elige el profe: lo **declara la plantilla**).
2. Cada alumno recibe **el mismo tablero** y lo resuelve; cada movimiento se
   emite (throttled) con `submitProgress`, que hace *upsert* de SU fila.
3. La pizarra muestra **una rejilla de mini-tableros en vivo**, ordenados:
   resueltos primero, luego por menos movimientos o menos tiempo (según
   `content.mode`).
4. Termina cuando el profe cierra.

## Diferencias de fondo con `race`

Parecen el mismo bucle (ambos van a ritmo del alumno, ambos en fase `race`) pero
se distinguen en algo que importa:

| | `race` | `board` |
|---|---|---|
| Unidad de avance | **ítems** de una lista | **un solo** puzzle |
| Progreso | cuántos lleva bien | qué tan ordenado está su tablero |
| Ranking | aciertos | resuelto → menos movimientos / menos tiempo |
| Qué ve la pizarra | barras | **el tablero de cada uno, moviéndose** |
| Re-encolar fallos | sí | no aplica (no hay "fallar", hay "mover") |

Por eso fusionarlos sería un error: comparten el "cada uno a su ritmo" y nada
más. Lo que sí deberían compartir es la **política de fin** (C-1) y la de
**exposición** (C-2) — son la misma pregunta en los dos.

## Recomendaciones

**B-1** — ✅ **APLICADO (v1.51.346)**: fin declarado, igual que en la carrera: "cuando todos resuelvan",
"los primeros N" o "tiempo límite". Misma implementación, mismo instante en la
sala. Es literalmente el mismo código si se hace una vez.

**B-2 · El coste de la rejilla en pizarras de gama baja.** Con 30 alumnos son 30
mini-tableros repintándose por polling. En una pizarra A55 (`ww-lite`) eso se
nota. **Recomendación**: tope de mini-tableros visibles (p.ej. 12, "y 18 más") y
repintado más lento en `ww-lite`. Hoy no está medido — antes de tocarlo, medirlo.

**B-3 · Un tablero por alumno vs el mismo para todos**: hoy es el mismo tablero
generado del contenido, y está bien (es comparable). Dejarlo declarado: si algún
día se genera aleatorio por alumno, deja de ser una competición justa.

---

# Ficha 4 · `claim` — pedir la palabra

Es el bucle **distinto de verdad**: el contenido **no tiene clave de respuesta**.
Lo usan Pregunta en Vivo y Ruleta.

1. El alumno ve una rejilla de cajas (o la ruleta) y **pide turno** tocando una.
2. La caja se abre para toda la clase; el enunciado sale en la pizarra.
3. El alumno responde **en voz alta** (fuera de la app).
4. **El docente da los puntos** con botones (o cierra sin puntos, y la caja
   vuelve a estar disponible).

Diferencia esencial con los otros tres: aquí **no hay veredicto automático**, y
por eso `scoreSubmission` devuelve `correct: null` — el ítem no es puntuable y
la cadena entera lo respeta (deuda C, ley §22-5): la tabla pinta "—", no cuenta
como fallo, no rompe la racha.

**Recomendaciones (menores, es el bucle más sano):**
- **CL-1 · Turnos justos**: hoy quien pulsa primero se queda la caja. Con 30
  alumnos, los rápidos acaparan. Opción del profe: "solo pueden pedir los que
  aún no han participado".
- **CL-2 · Se escribe cuánto valió**, no solo el total: hoy `ql_points` guarda el
  puntaje por caja, pero el informe no distingue "acertó" de "el profe le dio 2".
  Como los puntos son juicio del docente, conviene que quede así dicho en el
  informe (una nota, no una nota fingida).

---

# Qué comparten los cuatro (y qué no)

| | rounds | race | board | claim |
|---|---|---|---|---|
| Ritmo | profe | alumno | alumno | profe |
| Veredicto | servidor | host al cerrar | host al cerrar | **docente** |
| Fin propio | sí (se acaban) | **no** | **no** | no |
| Exposición pública | por pregunta | **continua** | continua | por turno |
| Fase de sala | `question` | `race` | `race` (compartida) | `question-live` |

**Las dos decisiones transversales** que salen de este estudio y que conviene
tomar UNA vez para los tres bucles sin final propio:

1. **Política de fin** (todos · primeros N · tiempo límite), escrita como
   instante en la sala.
2. **Política de exposición** (¿la pizarra ordena por ranking o muestra avance?),
   con el mismo interruptor que ya se propuso para los nombres en la revelación
   de rondas.

Hacerlas una vez y que los tres bucles las consuman es lo que evita que
`race`/`board`/`claim` se sigan separando entre sí.

---

# Decisión aplicada · POLÍTICA DE EXPOSICIÓN (v1.51.345)

**Decisión del usuario**: en los bucles a ritmo del alumno se elimina el ranking
de la pizarra y se deja el AVANCE.

**Matiz honesto sobre el referente**: en el Kahoot **en vivo** el marcador entre
preguntas **sí** es una clasificación — y por eso lo conservamos en `rounds`,
donde dura segundos y es el momento de la ceremonia. Es en sus modos **a ritmo
del alumno** (los que se parecen a nuestra carrera y a nuestro tablero) donde la
vista del docente es de progreso, no de puestos. Así que la decisión coincide con
el referente **bucle a bucle**, no en bloque.

**Qué cambió:**

| Pantalla | Antes | Ahora |
|---|---|---|
| Carrera (pizarra) | lista ordenada **por aciertos**, con puesto `1.` `2.`… | orden **estable** (el de entrada a la sala), sin puestos; cada uno ve su barra crecer |
| Tablero (rejilla) | celdas reordenadas en vivo: resueltos primero, luego por movimientos/tiempo | cada tablero **se queda en su sitio** |
| Rondas (marcador) | clasificación entre preguntas | **igual** — es su momento y dura poco |
| Podio | clasificación final | **igual** — ahí sí se compite |

**Por qué importa más de lo que parece**: en carrera y tablero la pizarra está
puesta varios MINUTOS. Un orden por puntuación deja al que menos sabe el último
de una lista proyectada todo ese rato — mucha más exposición que la revelación
de una pregunta. Y en el tablero había un efecto secundario feo: al reordenar en
vivo, las celdas **saltaban bajo el dedo** del alumno que estaba jugando.

Vigilado por `tests/liveLoops.test.mjs` ("exposición: carrera y tablero muestran
avance; rondas conserva su ranking"), con contra-prueba incluida para que nadie
"arregle" el ranking de rondas por error.

---

# Decisión aplicada · POLÍTICA DE FIN (C-1 / B-1, v1.51.346)

En rondas el juego acaba solo (se terminan las preguntas). Carrera y tablero
**no acababan nunca**: seguían hasta que el profe pulsaba "Terminar", aunque los
30 hubieran acabado hacía dos minutos — y el primero que terminaba miraba un
"esperando…" mudo, sin saber si faltaban diez segundos o diez minutos.

**Una sola política (`core/liveEnd.js`) que consumen los dos bucles**, elegida en
el lobby:

| | Cuándo cierra | Para qué sirve |
|---|---|---|
| **Cuando todos terminen** (defecto) | el último acaba | nadie se queda a medias |
| **Los primeros N** | acaba el N-ésimo | competición corta |
| **Tiempo límite** | llega el instante | la clase tiene 10 minutos y punto |

Detalles que importan y están cubiertos por `tests/liveEnd.test.mjs`:

- El **tiempo límite viaja como INSTANTE en la sala** (§26 ficha 1b), así que el
  alumno ve **el mismo reloj** que la pizarra y sobrevive a que el profe recargue.
- **Una sala vacía no se auto-termina** (0 de 0 no es "todos acabaron").
- Con **menos alumnos que N**, basta con que acaben todos (si no, no cerraría
  nunca).
- **Sin instante, la política de tiempo no cierra**: mejor que corte el profe a
  cerrar una clase por sorpresa.
- El profe **conserva siempre su botón** de terminar antes: la política decide
  cuándo se cierra SOLA, no le quita el mando.
- Al alumno se le dice **la regla, no un número inventado** ("termina cuando
  acaben todos" / "los 3 primeros" / reloj), porque el alumno no lee la lista de
  jugadores (§21). El conteo exacto lo ve el profe en la pizarra.
- El cierre automático es **una función compartida** (`maybeAutoEnd`): el test
  falla si un bucle se la salta y vuelve a quedarse sin final.

---

# Hallazgo al revisar `claim` · los puntos del docente NO llegaban al podio
### (bug real, encontrado y arreglado en v1.51.347)

Al ir a implementar CL-1/CL-2 apareció algo más grave que las dos mejoras:

**En Pregunta en Vivo y en Ruleta, los puntos que reparte el docente durante toda
la clase acababan en CERO en el podio.** Verificado contra un PocketBase real
antes y después del arreglo (3 puntos → 0 · 3 puntos → 3).

**Causa**: la deuda A (v1.51.272) hizo que el marcador se DERIVE de
`live_answers` — "misma fuente que el podio", que era lo correcto. Pero este
bucle nunca escribe una respuesta: el premio iba al blob de la sala
(`ql_award` → `state.players[].score`), que el marcador derivado ya no mira. Los
otros tres bucles no se enteraron porque todos pasan por `live_answers`.

**Arreglo**: cada premio es también una fila, escrita por el DUEÑO de la
colección (§21), con la semántica honesta de este bucle:
`scored: true` (el veredicto ya está dado) + `unscorable: true` (no había clave
que acertar: el mérito es del docente, §22-5). Así la tabla la pinta "—" con sus
puntos —sin fingir un acierto automático— y el podio la suma como cualquier otra.
Si la caja se reabre y se vuelve a premiar, la fila se actualiza en vez de
duplicarse.

**Esto responde de paso a CL-2** (que el informe diga que el punto lo puso el
profe): la fila lo dice por sí sola, sin una columna nueva.

**Por qué no lo cazó ningún test**: los tests de podio usan el driver local,
cuyo marcador SÍ sale del motor (blob) — el bucle de `claim` solo se rompía en
PocketBase. Cerrado con una guarda en `tests/unscorable.test.mjs` y anotado aquí
como el patrón a vigilar: **un bucle que no escribe en `live_answers` no existe
para el marcador**.

---

# B-2 · MEDIDO (v1.51.347): la rejilla de tableros NO es un problema

La ficha 3 decía "hay que medirlo antes de tocarlo". Medido con la rejilla real
y la CPU ralentizada ×6 (una pizarra de gama baja):

| Alumnos | CPU normal | CPU ×6 (pizarra lenta) |
|---|---|---|
| 6 | 1,4 ms | 8,8 ms |
| 12 | 2,4 ms | 15,9 ms |
| 30 | **4,8 ms** | **39,3 ms** |

El presupuesto para que NO se note son ~50 ms (3 fotogramas). Con 30 alumnos en
una pizarra lenta estamos por debajo. **Conclusión: no se toca nada** — ni tope
de mini-tableros ni repintado más lento. La sospecha era razonable y el dato
dice que no. Si algún día se nota, el sospechoso NO es el pintado: será la
frecuencia de sondeo o la red.

---

# R-3 · TIEMPO POR PREGUNTA — aplicado (v1.51.348)

**Decisión**: los segundos son **por pregunta**, con el tiempo de la actividad
como valor por defecto, y el profe lo cambia **al crear o editar** la actividad.

## Análisis previo (por qué así, y qué se podía romper en silencio)

Había **una** ventana para toda la actividad. Buscando quién dependía de ella
aparecieron **tres** consumidores, y uno era una trampa:

| Quién | Antes | Ahora |
|---|---|---|
| **Host** (fija el cierre) | `questionWindowMs(activity)` | `itemWindowMs(activity, item)` |
| **Bonus de velocidad** (`core/scoring/award.js`) | dividía por la ventana de la ACTIVIDAD | por la ventana **del ítem** |
| **Barra del alumno** | `questionWindowMs(activity)` | la **deriva** de `deadline − answers_open_at` |

El de en medio es el que importaba: el bonus se calcula como "tiempo que te
sobró / ventana". Con preguntas de 60 s y una ventana declarada de 20, el bonus
habría salido **mal en silencio** —de más en las largas, de menos en las
cortas— y nadie lo habría visto: solo puntajes raros. Está cubierto con un test
que comprueba que responder **a mitad de ventana da el mismo bonus** dure la
pregunta 20 s o 60 s.

El tercero tiene una consecuencia bonita: como el alumno **deriva** la ventana de
los dos instantes de la sala, los segundos **no viajan en el snapshot** (§22-2) y
la barra cuadra siempre con el reloj, sea cual sea el tiempo de esa pregunta.

## Sin migración, a propósito (§24)

`item.seconds` es **opcional**: ausente o 0 = heredar el de la actividad. Una
actividad creada antes de hoy se comporta **exactamente igual**, así que no hace
falta transformar contenido ni subir `templateVersion` — el camino con menos
riesgo. Suelo 5 s y tope 300 s (como el campo de la actividad).

## Dónde lo cambia el profe

- **Por actividad**: pestaña *En vivo* → "Timer pregunta (s)" (ya existía).
- **Por pregunta**: en Quiz, dentro de *Avanzado* de cada pregunta → "Tiempo en
  vivo (s)", con el valor de la actividad como marcador de posición; **vacío =
  heredar**.
- **Pendiente declarado**: Operaciones, Tildes y Comas no tienen zona "Avanzado"
  por ítem en su editor, así que en ellas rige el tiempo de la actividad. El
  motor ya lo soporta: es solo añadir el campo a esos tres editores cuando toque.

---

# CL-1 · Turnos justos en "pedir la palabra" — ANÁLISIS (sin ejecutar)

## Qué pasa hoy

El alumno ve la rejilla de cajas y **el primero que toca se queda la caja**
(`canPick = qlOpen === null`, una caja abierta a la vez). Con 30 alumnos, los
rápidos acaparan: el mismo niño puede llevarse cinco cajas seguidas mientras
otros no participan ninguna vez. No hay ningún reparto.

## El dato que falta

Hoy se guarda **cuánto valió cada caja** (`ql_points[idx]`), pero **no quién se
la llevó**. Desde v1.51.347 sí queda en `live_answers` (una fila por premio con
su `player`), así que la información YA existe — pero en una colección que el
alumno no consulta para pintar su rejilla.

## Tres formas, con su coste y su honestidad

1. **Aviso, no regla** (más barato): la pizarra muestra quién ha participado ya;
   el profe reparte con la vista. Cero código de reglas, cero falsas promesas.
2. **Gate en el móvil** (medio): si el profe activa "solo los que no han
   participado", el alumno que ya tiene caja no puede pedir. **Aviso honesto**:
   es una ayuda de aula, **no una garantía** — un alumno con conocimientos podría
   saltárselo desde el navegador, igual que el tope de actividades de §25 es un
   aviso y no un veredicto. Necesita que la sala lleve quién participó.
3. **Regla de servidor** (caro): que PocketBase rechace el `claim` de quien ya
   participó. Es lo único que sería una garantía de verdad, y exige que la regla
   pueda consultar `live_answers` por join desde el PATCH de `ql` — factible pero
   es tocar la parte más delicada del sistema.

## Mi recomendación

**(1) ahora, (2) si el profe lo pide.** Razones: el problema real es de gestión
de aula, no de trampa —nadie "hackea" para responder una pregunta oral—, y el
docente ya tiene el mando (ve quién pidió y puede cerrar sin puntos). (3) sería
gastar la parte más frágil del sistema en un problema que no es de seguridad.

**Decisión tomada: (1), aplicada en v1.51.349.** Al premiar queda registrado
QUIÉN se llevó la caja (antes solo se guardaba cuánto valió), y la pizarra
muestra una tira de participación: los que aún no han participado salen
destacados, que es lo accionable para el docente. **No se bloquea a nadie en el
móvil** — sería una promesa que el cliente no puede garantizar; el test lo fija
(`tests/unscorable.test.mjs`: la vista del alumno no puede usar `ql_taken` para
bloquear).

---

# Estado de las cuatro fichas (v1.51.349)

| | Decidido | Aplicado | Queda |
|---|---|---|---|
| **rounds** | lectura previa · puesto y distancia · movimiento · tiempo por pregunta · lobby de dos preguntas | R-1 · R-2 · R-3 · R-4 | el campo de tiempo por ítem en los editores de Operaciones/Tildes/Comas (el motor ya lo soporta) |
| **race** | fin declarado · avance en vez de ranking · tiempo límite | C-1 · C-2 · C-3 | separar la fase `race` del tablero (comparten fase) |
| **board** | mismo fin y misma exposición que la carrera | B-1 · B-2 (medido: no hacía falta tocar) | — |
| **claim** | los puntos del docente llegan al podio · aviso de participación | bug del podio · CL-1 (aviso) · CL-2 (lo dice la fila) | gate opcional en el móvil, si el profe lo pide |

**Lo único estructural que queda de todo el estudio D7**: la fase `race` la
comparten carrera y tablero, y cada vista las desambigua. No hay ningún bug
abierto por ello — es deuda de diseño, medida y acotada por
`tests/liveLoops.test.mjs`.

---

# Ficha 2b · `race` frente a `rounds`+automático — ¿por qué se sienten dos productos?

La pregunta: *automático y carrera no deberían ser tan distintos*. Al ponerlos
en columnas sobre el código sale que **casi todo lo que los separa es
consecuencia de UNA sola decisión** — y que una de las diferencias no está
decidida, es un fallo.

## La estructura, columna a columna

| | Rondas · **Yo controlo** | Rondas · **automático** | **Carrera** |
|---|---|---|---|
| ¿Quién avanza? | el profe | **el reloj** | **cada alumno** |
| ¿La clase está en la misma pregunta? | sí | sí | **no** |
| Fase de sala | `question`→`reveal`→`leaderboard` | igual | `race` |
| Ventana de LECTURA | sí (3 s) | sí | **no** |
| Tiempo por pregunta | sí (R-3) | sí | **no hay cronómetro** |
| ¿Quién juzga en el momento? | el servidor (settle) | igual | **el móvil** (hint) |
| ¿Cuándo se puntúa de verdad? | al revelar cada ítem | igual | **al cerrar** |
| Fallo | se queda fallado | igual | **vuelve a la cola** |
| Qué ve la pizarra | la pregunta | igual | **el avance** |
| Revelación colectiva | sí | sí | **no** (cada uno va por su sitio) |
| Fin | se acaban las preguntas | igual | política declarada (C-1) |

**Las tres primeras filas son la misma decisión** ("¿quién avanza?") y las demás
**se derivan de ella**: si cada alumno va por su cuenta, la pizarra no PUEDE
mostrar "la pregunta actual" ni hay revelación común. Eso no es un diseño
distinto: es la consecuencia obligada.

Las que **no** se derivan de nada y son puro accidente histórico: **la carrera no
tiene ventana de lectura ni tiempo por pregunta**, aunque el problema que
resolvían (responder antes de leer) existe igual cuando un alumno va solo.

## 🔴 Y una diferencia que NO está decidida: la carrera puntúa mal

El sello de tiempo del servidor en carrera es **uno solo para toda la partida**
(`openedKey('race')` devuelve `'race'`, no el índice del ítem). O sea: el `ms`
que puntúa **no es "lo que tardaste en ESA pregunta"**, es **"cuánto llevabas de
carrera"**. Con puntos Kahoot y ventana de 20 s, medido:

| El alumno responde… | Puntos |
|---|---|
| en el segundo 5 de carrera | **1250** |
| en el segundo 15 | 750 |
| en el segundo 25 | 500 |
| en el segundo 60 | 500 |
| en el segundo 180 | 500 |

**A partir del segundo 20 de carrera, la velocidad deja de contar para siempre.**
Todo el bonus se reparte en las dos primeras preguntas y el resto valen lo mismo
se conteste en 2 segundos o en 2 minutos. Nadie lo vería: solo parecería que "la
carrera puntúa raro".

## Lo adecuado, en mi opinión

**Un solo bucle de preguntas con un dial de tres posiciones**, en vez de "dos
juegos":

```
¿Quién avanza de pregunta?
   ( ) Yo controlo        → la clase junta, yo marco el ritmo
   ( ) El reloj           → la clase junta, avanza sola
   ( ) Cada alumno        → cada uno a su ritmo  (esto es la "carrera")
```

Con eso, el profe deja de elegir entre "un juego u otro" y elige **una sola
cosa**. Todo lo demás lo deriva el sistema. Y de paso se arregla lo que hoy
falta por accidente:

1. **La carrera hereda la ventana de lectura** — mismo motivo que en rondas: que
   no gane el que hace clic antes de leer. Aquí el instante es local por alumno
   (cada uno abre su pregunta cuando llega), y es legítimo porque tras el punto 2
   ya no se comparan velocidades entre alumnos.
2. **La carrera puntúa PLANO, sin bonus de velocidad.** Es lo honesto: en una
   carrera la velocidad ya está medida por **cuánto avanzas y cuándo terminas**,
   que es justo lo que la pizarra y el podio muestran. Meter además un bonus por
   pregunta obliga a un sello por alumno y por ítem (más escrituras, más
   superficie) para medir dos veces lo mismo. **Decisión tuya**: esto cambia
   puntajes de las carreras — a mejor, porque hoy el bonus está roto, pero cambia.
3. **Mismo vocabulario y mismos ajustes** en el lobby para las tres posiciones.

## Lo que NO propongo

**Fusionar las fases de sala** (`question` y `race` en una). El motor tendría que
llevar un cursor por alumno *y* uno común, y las dos vistas se llenarían de
condicionales. La unificación que vale la pena es **la que ve el profe**; por
dentro pueden seguir siendo dos caminos mientras la ley §26 los tenga declarados
y probados.

## Orden si se aprueba

1. **Puntuación plana en carrera** (arregla el bonus roto) — pequeño y cerrado.
2. **Ventana de lectura en carrera** — reutiliza lo de R-1.
3. **Dial de tres posiciones en el lobby** — cosmético, pero es lo que hace que
   dejen de parecer dos productos.

---

# Aplicado (v1.51.352) · paso 1 — la carrera la gana quien termina primero con todas bien

Definición del usuario, textual: *«la idea de la carrera es quien termina primero
con todas bien, no que haya más puntos por velocidad; el que primero termina con
todas bien gana, simple»*. Antes de tocar nada se **verificó** con tres
navegadores contra PocketBase (uno por dispositivo — con un solo navegador los
dos alumnos comparten anon id y reconectan como el MISMO jugador):

| alumno | aciertos | cuándo | puntos ANTES | puntos AHORA |
|---|---|---|---|---|
| RAPIDO | **2** de 5 | primeros segundos | **2997** 🏆 | 2 |
| LENTO | **5** de 5 | pasados 25 s | 2500 | **5** 🏆 |

Ganaba quien no terminó. Dos cambios, cada uno en UN sitio:

1. **Puntos PLANOS en carrera** — `kernel/session/engine.js`: el settle pasa
   `mode: 'race'` cuando la fase es carrera, y `useKahoot()` (`core/scoring/award.js`)
   solo enciende el bonus con `mode:'live'`. Ni una plantilla se entera: la
   fórmula sigue siendo la única. **El puntaje de una carrera ES su número de
   aciertos.**
2. **Empate ⇒ gana quien llegó ANTES** — `core/liveRank.js` (`rankPlayers`),
   compartido por el marcador derivado de PocketBase y por el motor, así que
   marcador y podio no pueden divergir. La "hora de meta" es el instante de la
   última respuesta que SUMÓ; en PocketBase se toma del autodate `created`
   (servidor, inmutable), **no** del `ms` que afirma el móvil — si el desempate
   dependiera del cliente, bastaría jurar `ms:0` para ganar todos los empates (§22).

Contra-prueba incluida: en **rondas** el bonus de velocidad sigue intacto — es
ahí donde tiene sentido, porque todos abren la misma pregunta en el mismo
instante. Vigilado por `tests/raceRank.test.mjs` (4 comprobaciones) y verificado
de punta a punta contra PocketBase real (5/5 tarde gana a 2/5 rapidísimo; y a
igualdad de aciertos gana quien terminó antes).

Pendientes de la ficha: **2** (ventana de lectura en carrera) y **3** (dial de
tres posiciones en el lobby).
