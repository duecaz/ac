# CONVERSIONES entre plantillas — qué produce cada caso

> **Tipo**: generado · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/templateContract.test.mjs` (toda conversión ofrecida da una ronda jugable)

> **GENERADO** — no editar a mano: `node tools/conversiones.mjs --md`.
> Sale del contenido real de cada plantilla (`defaultContent()`), el motor real
> (`switchOptions`/`applySwitch`) y el revisor real de la app
> (`revisarActividad`). Si una fila cambia, es que cambió el código.

## Cómo funciona

El contenido no pertenece a la plantilla sino a un **modelo** (`qa`, `pairs`,
`items`, `words`, `textCorrection`…). Dos plantillas con el mismo modelo se
intercambian **directa**mente; entre modelos distintos hay que **convertir**, y
eso lo hacen los conversores de `kernel/content/convert.js`.

Hay un segundo paso que es el que se olvida: **`adoptContent`**. Dentro de un
mismo modelo puede haber formas distintas de ítem — en `qa` conviven los que
llevan opciones (Quiz, Explota Globos: se elige) y los que no (Operaciones: se
teclea). `adoptContent` es lo que ajusta esa forma a la plantilla destino, y
olvidarlo es exactamente el fallo que dejaba «Operaciones → Explota Globos» sin
un globo que tocar (v1.51.527).

Desde la página de jugar, convertir **duplica**: nace una actividad nueva y la
original no se toca (D2 · opción b). El editor conserva su «Cambiar formato»,
que sí convierte en el sitio.

## Las tres cosas que la conversión NO puede inventar

1. **Pistas** (Crucigrama). Una palabra suelta no trae pista, e inventarla
   revelaría la respuesta: «pista: CABALLO». Se traslada la palabra y el profe
   escribe la pista — y la app **lo avisa antes** de crear la copia.
2. **Distractores buenos**. Al pasar a una plantilla de elegir, las opciones se
   construyen con las respuestas de los otros ítems (`adoptForQuiz`). Funcionan,
   pero un distractor pensado enseña más que uno tomado de otra pregunta.
3. **Lo que el destino no usa**. Al convertir se pierde lo que el modelo nuevo
   no contempla. Por eso desde la página de jugar se duplica en vez de pisar.

## El cuadro

| De | A | Tipo | Modelo | Piezas | Al terminar |
|---|---|---|---|---|---|
| Quiz | Explota Globos | directa | `qa` | 2→2 | lista para jugar |
| Quiz | Operaciones | directa | `qa` | 2→2 | lista para jugar |
| Quiz | Abre Cajas | conversión | `qa→items` | 2→2 | lista para jugar |
| Quiz | Emparejar | conversión | `qa→pairs` | 2→2 | lista para jugar |
| Quiz | Memoria | conversión | `qa→pairs` | 2→2 | lista para jugar |
| Quiz | Ruleta | conversión | `qa→items` | 2→2 | lista para jugar |
| Ruleta | Abre Cajas | directa | `items` | 4→4 | lista para jugar |
| Emparejar | Memoria | directa | `pairs` | 4→4 | lista para jugar |
| Emparejar | Abre Cajas | conversión | `pairs→items` | 4→8 | lista para jugar |
| Emparejar | Explota Globos | conversión | `pairs→qa` | 4→4 | lista para jugar |
| Emparejar | Operaciones | conversión | `pairs→qa` | 4→4 | lista para jugar |
| Emparejar | Quiz | conversión | `pairs→qa` | 4→4 | lista para jugar |
| Emparejar | Ruleta | conversión | `pairs→items` | 4→8 | lista para jugar |
| Memoria | Emparejar | directa | `pairs` | 6→6 | lista para jugar |
| Memoria | Abre Cajas | conversión | `pairs→items` | 6→12 | lista para jugar |
| Memoria | Explota Globos | conversión | `pairs→qa` | 6→6 | lista para jugar |
| Memoria | Operaciones | conversión | `pairs→qa` | 6→6 | lista para jugar |
| Memoria | Quiz | conversión | `pairs→qa` | 6→6 | lista para jugar |
| Memoria | Ruleta | conversión | `pairs→items` | 6→12 | lista para jugar |
| Tildes | Comas | directa | `textCorrection` | 2→2 | lista para jugar |
| Comas | Tildes | directa | `textCorrection` | 3→3 | lista para jugar |
| Operaciones | Explota Globos | directa | `qa` | 4→4 | lista para jugar |
| Operaciones | Quiz | directa | `qa` | 4→4 | lista para jugar |
| Operaciones | Abre Cajas | conversión | `qa→items` | 4→4 | lista para jugar |
| Operaciones | Emparejar | conversión | `qa→pairs` | 4→4 | lista para jugar |
| Operaciones | Memoria | conversión | `qa→pairs` | 4→4 | lista para jugar |
| Operaciones | Ruleta | conversión | `qa→items` | 4→4 | lista para jugar |
| Sopa de Letras | Crucigrama | directa | `words` | 10→10 | hay que completar: La palabra «CABALLO» no tiene pista. |
| Crucigrama | Sopa de Letras | directa | `words` | 4→4 | lista para jugar |
| Abre Cajas | Ruleta | directa | `items` | 6→6 | lista para jugar |
| Explota Globos | Operaciones | directa | `qa` | 3→3 | lista para jugar |
| Explota Globos | Quiz | directa | `qa` | 3→3 | lista para jugar |
| Explota Globos | Abre Cajas | conversión | `qa→items` | 3→3 | lista para jugar |
| Explota Globos | Emparejar | conversión | `qa→pairs` | 3→3 | lista para jugar |
| Explota Globos | Memoria | conversión | `qa→pairs` | 3→3 | lista para jugar |
| Explota Globos | Ruleta | conversión | `qa→items` | 3→3 | lista para jugar |

> 36 conversiones · 35 salen listas · 1 piden completar algo (la app lo avisa ANTES de crear la copia).
>
> Sin ninguna salida: Ordena las Pelotas · Etiqueta el diagrama.

## Sin ninguna salida, y por qué

**Ordena las Pelotas** (`ballsort`) y **Etiqueta el diagrama** (`diagram`) no
convierten a nada. No es un olvido: su contenido no es contenido de pregunta.
El de Pelotas son tubos con bolas de colores y el del diagrama son coordenadas
sobre una imagen — llevarlos a otra plantilla no daría una actividad, daría un
texto sin sentido. Un conversor hacia un modelo que nadie puede jugar es código
muerto, y el contrato ya prohíbe declararlos (`tests/templateContract.test.mjs`:
«todos los conversores unen modelos con plantilla viva»).

**Tildes y Comas** solo se intercambian entre ellas: comparten
`textCorrection`, que es texto con marcas, y no hay conversor hacia `qa` —
convertir un texto marcado en preguntas exigiría decidir qué se pregunta.
