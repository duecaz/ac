# Plan · El EDITOR como pieza general — márgenes, añadir elementos, empezar en blanco e imágenes

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Decidido el 2026-08-13 tras intentar el dueño crear una actividad de «Etiqueta
> el diagrama» y encontrarse cuatro cosas a la vez. **Decisión suya: se resuelve
> al nivel GENERAL** — ninguna de las cuatro es del diagrama, y arreglarlas solo
> ahí las deja vivas en las otras doce plantillas.

## 0 · Qué pasó, y qué lo causa (medido en el código, no supuesto)

| Lo que se ve | Causa real | ¿General? |
|---|---|---|
| «está ahogado, no hay padding a los costados» | `views/editView.js` monta directo en `#app`, y `#app` perdió su `container py-3` cuando la home pasó a poner su propio `.home-wrap`. La home quedó bien; el editor, los reportes y el admin se quedaron a ras del borde | **SÍ** — 13 editores + reportes + admin |
| «no hay cómo colocar más etiquetas» | 11 de 13 editores tienen su botón «+ Añadir…». `diagram` y `ballsort` NO: en el diagrama los pines se añaden CLICANDO la imagen, está escrito en una línea gris y se pierde | **SÍ** — es una gramática que debe ser una |
| «viene ya escrito el contenido» | toda plantilla nace con `defaultContent()` de muestra. En el diagrama son 4 pines *Cabeza/Ojo/Nariz/Boca* sobre una cara de ejemplo | **SÍ** — decisión de producto, las 13 |
| (lo peor, y no lo dijo porque se ve solo) | al **cambiar la imagen** los pines del ejemplo **se quedan clavados** en las coordenadas de la cara anterior: «Nariz» aparece en medio de tu mapa. `templates/diagram/editor.js:58` cambia `content.image` y no toca `content.pins` | diagram (revisar el mismo patrón en crossword/wordsearch) |
| «que se busquen imágenes en un modal» | hoy solo se puede SUBIR un archivo | **SÍ** — lo piden el diagrama, el fondo y la imagen de pregunta |

## 1 · Las reglas que se fijan

- **R-A · El chrome tiene márgenes.** Ninguna vista del panel del profe monta a ras
  del borde. El ancho y el aire los pone UN envoltorio compartido, no cada vista
  con su copia; si una vista no lo trae, se ve como se vio.
- **R-B · Añadir un elemento se hace SIEMPRE con un botón visible.** Un gesto
  (clicar la imagen) puede ser un ATAJO, nunca la única puerta. Cada plantilla
  DECLARA cómo se llama su elemento («etiqueta», «pregunta», «pareja») y el
  editor pinta el botón — la vista no conoce plantillas concretas (§0).
- **R-C · Cambiar el soporte invalida lo anclado a él.** Coordenadas, celdas y
  posiciones se refieren a UNA imagen o UNA rejilla: si esa cambia, o se
  reubican o se avisa. Dejarlas mudas produce el «Nariz en medio del mapa».
- **R-D · La actividad nace VACÍA** (decisión del dueño, 2026-08-13). El ejemplo
  precargado obligaba a borrar antes de empezar. Lo que enseña no es contenido
  falso: es el **estado vacío**, que dice en una línea qué hacer primero.

## 2 · Fases

### F1 · Márgenes del panel (barato, arregla 15 pantallas)
Un envoltorio único `.ww-page` (max-width + padding, la medida ya existe en
`styles/home.css`) que ponen `editView`, `editList`, `reports`, `admin`,
`moderate`, `registro`… **Red**: sonda headless que mide, en 1280 y en 390, que
el primer control de cada ruta del profe no toca el borde. Sin la sonda esto
vuelve: es justo lo que pasó al rediseñar la home.

### F2 · «+ Añadir» en las 13 + estado vacío que enseña
- `diagram`: «+ Añadir etiqueta» pone un pin en el centro, listo para arrastrar;
  el clic sobre la imagen sigue siendo un atajo.
- `ballsort`: su equivalente, a decidir al abrirlo.
- **Regla ejecutable** en el contrato: toda plantilla con lista de elementos
  declara `meta.editor.elemento` (singular, en español) y el contrato falla si
  falta — descubre por escaneo, no por lista. `tools/new-template.mjs` lo genera.
- **Estado vacío**: cada plantilla declara UNA frase de arranque
  (`meta.editor.primerPaso`, p. ej. «Sube tu diagrama y haz clic para poner la
  primera etiqueta»). Es lo que sustituye al contenido de muestra: enseña sin
  meter datos que hay que borrar, y **no depende de los vídeos**.

### F3 · Imagen y pines coherentes (el bug feo)
Al cambiar la imagen del diagrama: si hay pines, preguntar UNA vez —«¿mantener
las etiquetas donde están o empezar de cero?»— con **vaciar por defecto**, que
es lo que espera quien sube su propio diagrama. Revisar el mismo patrón en
crucigrama y sopa (cambiar la rejilla con palabras ya colocadas).

### F4 · Nacer en blanco (R-D)
`defaultContent()` deja de precargar muestras: devuelve la forma vacía. Hay que
revisar que las 13 aguanten contenido vacío en el EDITOR y en el jugador (varias
redes siembran con `defaultContent`, así que la matriz y el edit-audit pasarán a
sembrar contenido de prueba explícito — es el trabajo real de esta fase, no el
borrado).

### F5 · Botón de TUTORIAL — el hueco se deja hecho, el botón NO se enciende
Decisión del dueño: el botón espera a que existan los vídeos, y los vídeos
esperan a que las actividades estén terminadas y ordenadas. Para que luego cueste
cero: cada plantilla podrá declarar `meta.editor.tutorial` (una URL); el editor
pinta el botón **solo si esa URL existe**. Hoy no la declara ninguna → no hay
botón, y no hay que tocar 13 ficheros el día que se graben.

### F6 · Buscador de imágenes — ✅ HECHO (v1.51.471)
Un componente único con dos puertas —**Subir** y **Buscar**— en **los SEIS** sitios
que piden una imagen de contenido, no en los tres del plan: al escribirlo se vio que
la lista de tres era otra lista enumerada, y que wheel/question-live/match tenían el
mismo agujero esperando. Al elegir, la imagen pasa por `core/upload.js` (comprime)
igual que un archivo local, así el tope de §25 se respeta solo.

- `core/imageSearch.js` — el NÚCLEO: sin DOM y sin red propia (recibe el `fetch`),
  construye la petición y normaliza las dos fuentes a la MISMA forma. Testeado
  entero con respuestas de mentira (`tests/imageSearch.test.mjs`).
- `core/imageSearchModal.js` — el diálogo: rejilla, descarga de lo elegido y
  conversión por `uploadMedia`. Devuelve `{ url, atribucion }`.
- Puertas: diagrama · fondo de la actividad · imagen de pregunta (quiz, vía
  `core/imagePicker.js`) · ruleta · pregunta en vivo · emparejar.
- **Es norma, no costumbre**: la regla `imagen-buscable` (`core/normsCheck.js`)
  ESCANEA — un fichero que llame a `uploadMedia`/`readBackgroundImage` sin ofrecer
  el buscador rompe CI. Las tres excepciones (foto de perfil, avatar del duelo,
  fondo de ESTA partida) están declaradas con su motivo: no son contenido, y
  buscarle la cara a alguien en internet es justo lo que R7 no quiere.
- La **atribución** se guarda junto a la imagen y se muestra en el editor:
  `content.imageCredit` (diagrama) · `presentation.backgroundImageCredit` (fondo) ·
  `item.imageCredit` (pregunta/ruleta) · `left|rightImageCredit` (emparejar).
  Campos opcionales, sin migración (§24). **Pendiente**: pintarla también en el
  player para quien JUEGA la actividad publicada.
- **VERIFICADO contra las APIs reales** (2026-08-14, desde la Pi): Openverse
  responde sin clave; Commons devuelve resultados con su `thumburl`; y
  `upload.wikimedia.org` manda `access-control-allow-origin: *`, que era lo único
  que ninguna prueba de la API cubría — sin esa cabecera el buscador encontraría
  imágenes y fallaría justo al elegir una. Los tres comandos, abajo.

**Sobre Google, que es lo que se preguntó.** No hay una API de imágenes de Google
que se pueda cablear: la vieja *Google Image Search API* está retirada. Lo que
existe es *Programmable Search Engine*, que sí busca imágenes pero (a) necesita
una clave que NO puede ir en el navegador —se vería en el código— así que la Pi
tendría que hacer de intermediaria, (b) es gratis hasta 100 consultas al día y
después se paga, y (c) —lo importante— devuelve imágenes de cualquier web, con
derechos desconocidos. Como los profes PUBLICAN sus actividades en la biblioteca
pública, eso traslada un problema legal al proyecto. Por eso la propuesta es
buscar en fuentes **libres**:

| Fuente | Clave | Licencia | Para qué sirve |
|---|---|---|---|
| **Wikimedia Commons** | no | libre | diagramas escolares: anatomía, mapas, ciclos, geometría |
| **Openverse** (agrega Flickr y otros CC) | no | CC | fotos y dibujos de apoyo |
| Pixabay / Pexels | sí | libre de uso | catálogo más «bonito»; clave que mantener |

**Sin verificar todavía**: que las dos primeras se puedan llamar desde el
navegador sin clave y con CORS. No se pudo comprobar desde el entorno de
desarrollo (bloquea la salida a internet). Se comprueba en un minuto desde la Pi:

**Ojo con el `gsrnamespace=6`**: sin él, Commons busca en las galerías (espacio
principal), donde `filetype:bitmap` no aplica, y devuelve `{"batchcomplete":""}` —
cero resultados que parecen «la API no sirve» cuando en realidad la consulta estaba
mal. La URL de abajo es la que CONSTRUYE el código (sale de `FUENTES.wikimedia.url`).

```bash
curl -s "https://api.openverse.org/v1/images/?q=corazon&page_size=1" | head -c 300
curl -s "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=2&gsrsearch=filetype%3Abitmap%20corazon&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=320" | head -c 400
# …y que el NAVEGADOR pueda descargar el píxel, no solo consultar la API:
curl -sI "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Heart_diagram-es.svg/320px-Heart_diagram-es.svg.png" | grep -i "access-control-allow-origin"
```

Dos avisos que van en el plan para que no sorprendan:
- **La atribución no es opcional** con CC: si se busca, se guarda de dónde salió
  y se muestra. Campo nuevo en el contenido (§24, opcional, sin migración).
- **Es una función ONLINE.** El aula sin internet (D4) seguirá subiendo archivos;
  el buscador se degrada con su aviso, nunca en silencio (R6).

### F7 · El presupuesto de la imagen del diagrama
Hoy usa el tope de imagen inline: **200 KB / 1280 px**. Un diagrama se mira de
cerca y tiene detalle fino. El fondo de actividad ya usa **800 KB / 1920 px** y
es el mismo tipo de uso. Propuesta: el diagrama pasa al presupuesto de fondo.
Toca §25 (cuotas), así que va con su test de paridad.

## 3 · Orden

F1 (barato, 15 pantallas) → F3 (el bug feo) → F2 (+Añadir y estado vacío, con su
regla) → F7 (presupuesto) → F4 (nacer en blanco: la que más redes toca) → F6 (el
buscador) → F5 queda esperando a los vídeos.

**Estado (v1.51.471): F1 · F2 · F3 · F4 · F6 · F7 hechos. Solo queda F5**, que no
espera a código sino a que existan los vídeos.
