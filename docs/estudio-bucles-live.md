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
