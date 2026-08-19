# Plan · La IA ESCRIBE el contenido de la actividad

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Pedido por el dueño (2026-08-18): «vamos a ver cómo usamos la IA para generar
> el contenido de las actividades, **como siempre módulo aparte para no
> malograr el resto del code**; la IA será como la que usa Wordwall, para
> escribir directamente el contenido de la actividad que estamos creando».
>
> **ESTADO: CONSTRUIDO (v1.51.532), a falta de instalar el hook en la Pi.**
> El documento nació como el plan que exigía `norte.md` §4b para reabrir el tema
> (*«que la IA entre obedeciendo a un plan específico y escrito, no como
> añadido»*); las decisiones de §6 las tomó el dueño el 2026-08-18 y están
> aplicadas. Lo que falta es un paso TUYO, no de código: §7.

## 1 · La idea en una frase

En el editor, un botón **«Escribir con IA»**. El profe dice de qué va
(«fracciones equivalentes, 5.º de primaria, 10 preguntas»), la IA propone el
contenido, él lo VE antes de aceptar, y al aceptar entra en la actividad que
está editando. Ni más ni menos que eso.

## 2 · La decisión de arquitectura que lo sostiene todo: por MODELO, no por plantilla

Es la misma lección que ya está escrita en [`conversiones.md`](conversiones.md)
y en D3 (el imprimible): **el contenido no pertenece a la plantilla, pertenece a
un modelo**. Hay 13 plantillas pero solo 5 modelos con contenido escribible:

| Modelo | Qué es una pieza | Plantillas que lo usan | ¿La IA puede escribirlo? |
|---|---|---|---|
| `qa` | pregunta + respuesta (+ opciones) | Quiz · Operaciones · Explota Globos | **sí** |
| `pairs` | izquierda ↔ derecha | Emparejar · Memoria | **sí** |
| `items` | una pregunta suelta, sin clave | Ruleta · Abre Cajas | **sí** |
| `words` | palabra (+ pista en Crucigrama) | Sopa de Letras · Crucigrama | **sí** |
| `textCorrection` | frase + dónde van las marcas | Tildes · Comas | **sí, y es el más delicado** (§5) |
| `ballsort` | tablero de bolas | Ordena las Pelotas | **no** — ya se genera solo |
| `diagram` | imagen + coordenadas | Etiqueta el diagrama | **no** — necesita una imagen y saber dónde está cada cosa |

**Cinco generadores cubren once plantillas.** Escribirlo por plantilla serían
trece prompts que se desincronizan; por modelo son cinco, y una plantilla nueva
que declare un modelo ya existente lo hereda sin tocar nada. Es exactamente la
regla §0: la plantilla DECLARA su modelo, el motor lo consume.

## 3 · Los tres módulos (y ninguno toca lo que ya existe)

Se calca la forma del **buscador de imágenes**, que ya está en producción y
funciona (`core/imageSearch.js` + `core/imageSearchModal.js`). No es parecido
por casualidad: es el mismo problema —pedir algo a un servicio de fuera,
enseñarlo, y aplicarlo al contenido— y ya está resuelto una vez.

```
core/aiContent.js        NÚCLEO PURO. Sin DOM y sin red propia: recibe el
                         `fetch` (`fetchFn = fetch`, como imageSearch). Construye
                         el prompt por MODELO, y sobre todo VALIDA y normaliza lo
                         que vuelve. Se prueba entero con respuestas de mentira.
core/aiContentModal.js   EL DIÁLOGO. Tema · nº de piezas · curso → «Escribir» →
                         se VE lo propuesto → «Añadir» o «Descartar».
                         Devuelve `{content}` o `null`, como `abrirBuscadorImagenes`.
(transporte)             DÓNDE VIVE LA CLAVE. Es la decisión de §6.
```

**El único punto de contacto con lo existente** es un botón en
`core/editorShell.js` (la pestaña Contenido de las 13) que llama al diálogo y,
si devuelve algo, hace lo que ya hace cualquier «+ Añadir»: mutar `a.content`,
`ctx.onChange(a)` y `ctx.repaint()`. Ese camino ya lo recorren el «Generar
×1–10» de Operaciones y el pegado masivo de la Sopa: no se inventa nada.

## 4 · Lo que la IA NO puede hacer, y por qué es lo más importante del plan

**§24 dice que el contenido es del usuario.** Una IA que escribe en la actividad
del profe es exactamente lo que esa ley vigila, así que:

- **Nunca escribe sin que se vea antes.** Se propone, se enseña, el profe
  acepta. Sin previsualización esto no se hace.
- **Nunca borra lo que ya hay.** Por defecto AÑADE. Reemplazar todo puede ser
  una opción, pero explícita y con su confirmación.
- **Nunca entra sin validar.** Lo que vuelve del modelo pasa por
  `getModel(nombre).validate()` y por `revisarActividad()` — los mismos que
  gatean el juego. Un JSON que no cumple no se aplica, y se dice por qué. Esto
  no es opcional: un modelo de lenguaje devuelve lo que le parece, y la última
  vez que algo entró en el contenido sin que nadie comprobara si era jugable
  (`Operaciones → Globos`) el resultado fue una pantalla vacía.
- **Los ids los pone `rid()`**, no la IA (§24 · regla `id-rid`).
- **Si falla, se dice** (R6 · `fallo-mudo`): sin red, sin cuota o con una
  respuesta ilegible, el mensaje explica cuál de las tres. El buscador de
  imágenes ya distingue 401/403 de lo demás; se copia ese criterio.

## 5 · Lo que hay que probar antes de creerse que funciona

Un generador por modelo no es «escribe preguntas». Cada modelo tiene su trampa:

- **`qa`** — los distractores tienen que ser *plausibles y falsos*. Un
  distractor que también es correcto convierte la actividad en una trampa para
  el alumno, y eso no lo caza ningún validador de forma.
- **`pairs`** — las parejas deben ser 1-a-1. Si «perro» empareja con «dog» y
  también con «can», el juego marca error a quien acierta.
- **`words`** — para la Sopa, palabras sin espacios ni signos; para el
  Crucigrama, además una pista que **no contenga la palabra**.
- **`textCorrection`** — el más delicado, y el que más valor tiene: hay que
  devolver la frase **y las posiciones exactas** de cada tilde o coma. Un
  desplazamiento de un carácter hace que el juego marque mal al alumno que
  acierta. Aquí la validación no es «¿es un array?», es «¿la marca cae sobre
  una vocal?», «¿el texto sin marcas es el mismo?».
- **Todos** — español de España vs de América, y el nivel del curso. Una
  pregunta de 5.º escrita para bachillerato es tan inservible como una vacía.

**La red que corresponde**: un `tools/ia-smoke.mjs` que, con respuestas
GRABADAS (sin red, como `tests/imageSearch.test.mjs`), compruebe que cada
generador produce contenido que `revisarActividad()` da por jugable. Y, aparte,
una comprobación manual con el modelo real antes de encenderlo, porque la
calidad pedagógica no la mide un test.

## 6 · LO DECIDIDO (dueño, 2026-08-18) y cómo quedó

| Decisión | Elegido | Dónde vive |
|---|---|---|
| Dónde está la clave | **en la Pi**, que hace la llamada | `pb_hooks/aulareto.pb.js` + colección `ia_config` |
| Quién puede usarla | **cualquier profe con sesión**, con tope diario | tope de 30/día por profe, en el hook |
| Qué hace con lo que ya hay | **añade**, nunca reemplaza | `fusionarContenido()` |
| Proveedores | **Gemini y Grok**, elegibles en el administrador | cuadro `PROVEEDORES` del hook |

**Cómo quedó la seguridad de la clave, que era lo único que bloqueaba.** La
colección `ia_config` tiene las CINCO reglas a `null`: no la puede leer ni un
profe con sesión, solo el superadmin de PocketBase. Quien la lee es el hook, y
el código de servidor se salta las reglas — por eso puede usarla sin abrirle la
puerta a nadie. El navegador toca la clave UNA vez: cuando el dueño la escribe
en `#/admin`. El extremo `/api/ia/contenido` recibe DATOS (modelo, tema,
cantidad, curso) y nunca un prompt: si aceptara texto libre, cualquiera con
cuenta de profe tendría un modelo de lenguaje gratis pagado por el dueño.

### Lo que se construyó

| Fichero | Qué hace | Probado por |
|---|---|---|
| `core/aiContent.js` | núcleo PURO: qué se pide y —lo que importa— cómo se REVISA lo que vuelve | `tests/aiContent.test.mjs`, sin red |
| `core/aiContentModal.js` | el diálogo: tema · curso · cuántas → se VE → se añade | sonda headless |
| `core/editorShell.js` | el botón, en la pestaña Contenido de las **13** | `matrix-smoke` |
| `pb_hooks/aulareto.pb.js` | la Pi: guarda la clave, llama al proveedor, cuenta el uso | pendiente en la Pi |
| `views/adminView.js` | donde se pega la clave y se prueba | — |

Once plantillas tienen el botón; Ordena las Pelotas y Etiqueta el diagrama no,
y eso es lo correcto: una opción que no puede funcionar no se ofrece.

## 6b · Lo que se descartó por el camino (y por qué)

### D-IA-1 · Dónde vive la clave

Es el mismo muro que ya está documentado para las imágenes de Google
(`CLAUDE.md`, «la clave NO puede vivir en el repo»: la web es estática y todo se
lee). Tres caminos:

| | Cómo | A favor | En contra |
|---|---|---|---|
| **(a) La Pi hace de intermediaria** | un `pb_hooks/aulareto.pb.js` en PocketBase que recibe la petición y llama al modelo con la clave guardada allí | es lo que hace Wordwall · el profe no configura nada · una sola clave · se puede limitar por profe | **sería el primer trozo de servidor del proyecto** · toca el compose de una Pi COMPARTIDA con `aportes` y `equipos_activados` · el coste lo paga el dueño |
| **(b) Cada profe pone su clave** | un campo en su perfil, guardado en su navegador | cero infraestructura · cero coste para el dueño | ningún profe de primaria tiene una clave de API. En la práctica, la función no existiría |
| **(c) Copiar y pegar** | la app arma el prompt, el profe lo pega en ChatGPT/Claude, y pega la respuesta de vuelta | cero infraestructura, cero coste, funciona hoy mismo · el validador es el mismo | dos saltos de aplicación en mitad de la clase. No es «como Wordwall» |

**Recomendación: (a)**, y (c) como escalón previo si se quiere ver funcionando la
parte difícil —los generadores y el validador— sin montar nada. Los módulos son
los MISMOS en las tres: solo cambia quién entrega el texto, que es una función.

### D-IA-2 · Qué modelo y cuánto cuesta

Sin decidir. Lo que sí está claro: es una llamada por actividad, no por partida
—el gasto lo hace el profe al preparar, no la clase al jugar—, así que el
volumen es bajo y predecible. Hay que poner un tope por profe y día, y decirlo
en la interfaz antes de que se agote (misma norma que §25).

### D-IA-3 · Dónde aparece el botón

- (i) solo en el editor, junto a «+ Añadir» — el sitio natural, y no cambia
  ningún viaje existente;
- (ii) además al crear («¿de qué va tu actividad?»), que es lo que hace Wordwall
  y ahorra la pantalla en blanco;
- (iii) también en la conversión, para rellenar lo que la conversión no puede
  inventar — **Sopa → Crucigrama pide pistas y hoy se las deja al profe**
  (`conversiones.md`): es el caso donde la IA encaja sin discusión.

**Recomendación: (i) primero, (iii) después** — (iii) resuelve un hueco REAL y
ya identificado, y (ii) es el que más superficie nueva añade.

## 7 · LO QUE FALTA — instalar el hook en la Pi (paso del dueño)

El código está. Sin este paso, el botón sale, se toca, y dice *«La IA todavía no
está configurada en el servidor»* — que es lo correcto: la puerta se avisa, no
se descubre fallando.

**1. Subir el hook.** El repo es PÚBLICO, así que la Pi se lo descarga sola —
no hay que copiar ficheros a mano:

```bash
ssh duecaz@pio.local
curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-instalar-hook.sh | bash
```

`tools/pi-instalar-hook.sh` averigua cómo está montado PocketBase (no da por
supuesto lo que dice este documento: el servidor es el que manda), baja el hook,
reinicia y comprueba que la ruta responde. **No toca el compose**: si falta el
montaje `./pb_hooks:/pb_hooks` lo dice y enseña la línea exacta — la Pi está
compartida con `aportes` y `equipos_activados`, y editar a ciegas el compose de
un servidor compartido es justo lo que no se hace.

**2. Crear las colecciones.** En `#/admin` → «Crear colecciones» (crea
`ia_config` e `ia_usos` con sus reglas; es append-only, no borra nada).

**3. Pegar la clave.** En `#/admin` → «IA que escribe contenido»: proveedor,
clave, «Guardar clave». Después «Probar», que pide dos preguntas de verdad y
enseña el resultado.

**Comprobar que quedó bien cerrado** (debe responder 403/404, nunca la clave):

```bash
curl -s https://pb.lanube.uno/api/collections/ia_config/records | head -c 200
```

## 8 · Lo que queda para otro día

- **(iii) las pistas del Crucigrama.** `conversiones.md` documenta que
  Sopa → Crucigrama traslada las palabras pero no puede inventar las pistas, y
  hoy se le dejan al profe. Es el hueco donde la IA encaja sin discusión.
- **(ii) el botón al CREAR** («¿de qué va tu actividad?»), que es lo que hace
  Wordwall y ahorra la pantalla en blanco. Se dejó fuera a propósito: es lo que
  más superficie nueva añade y conviene verlo funcionando en el editor primero.
- **La calidad pedagógica no la mide un test.** Los generadores están probados
  contra las trampas de §5, pero si las preguntas que salen sirven o no para una
  clase de 5.º solo se sabe usándolo. Es lo primero que hay que mirar tras el
  paso 3.
