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
