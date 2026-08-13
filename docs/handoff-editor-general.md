# Plan · El EDITOR como pieza general — márgenes, añadir elementos, contenido de ejemplo e imágenes

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Decidido el 2026-08-13 tras intentar el dueño crear una actividad de «Etiqueta
> el diagrama» y encontrarse cuatro cosas a la vez. Se plantea GENERAL a petición
> suya: ninguna de las cuatro es del diagrama — son del editor, y arreglarlas
> solo ahí las deja vivas en las otras doce plantillas.

## 0 · Qué pasó, y qué lo causa (medido en el código, no supuesto)

| Lo que se ve | Causa real | ¿General? |
|---|---|---|
| «está ahogado, no hay padding a los costados» | `views/editView.js` monta directo en `#app`, y `#app` perdió su `container py-3` cuando la home pasó a poner su propio `.home-wrap`. La home quedó bien; el editor, los reportes y el admin se quedaron a ras del borde | **SÍ** — 13 editores + reportes + admin |
| «no hay cómo colocar más etiquetas» | 11 de 13 editores tienen su botón «+ Añadir…». `diagram` y `ballsort` NO: en el diagrama los pines se añaden CLICANDO la imagen, está escrito en una línea gris y se pierde | **SÍ** — es una gramática que debe ser una |
| «viene ya escrito el contenido» | toda plantilla nace con `defaultContent()` de muestra. En el diagrama son 4 pines *Cabeza/Ojo/Nariz/Boca* sobre una cara de ejemplo | **SÍ** — decisión de producto, las 13 |
| (lo peor, y no lo dijo porque se ve solo) | al **cambiar la imagen** los pines del ejemplo **se quedan clavados** en las coordenadas de la cara anterior: «Nariz» aparece en medio de tu mapa. `templates/diagram/editor.js:58` cambia `content.image` y no toca `content.pins` | diagram (pero el patrón «cambiar el soporte y dejar lo anclado» hay que revisarlo en crossword/wordsearch) |
| «que se busquen imágenes en un modal» | hoy solo se puede SUBIR un archivo | **SÍ** — lo piden el diagrama, el fondo y la imagen de pregunta |

## 1 · Las reglas que se fijan

- **R-A · El chrome tiene márgenes.** Ninguna vista del panel del profe monta a ras
  del borde. El ancho y el aire los pone UN envoltorio compartido, no cada vista
  con su copia; si una vista no lo trae, se ve como se vio.
- **R-B · Añadir un elemento se hace SIEMPRE con un botón visible.** Un gesto
  (clicar la imagen) puede ser un ATAJO, nunca la única puerta: lo que no tiene
  botón, no existe para quien no lee la línea gris. Cada plantilla DECLARA cómo
  se llama su elemento («etiqueta», «pregunta», «pareja») y el editor pinta el
  botón — la vista no conoce plantillas concretas (§0).
- **R-C · Cambiar el soporte invalida lo anclado a él.** Coordenadas, celdas y
  posiciones se refieren a UNA imagen o UNA rejilla: si esa cambia, o se
  reubican o se avisa. Dejarlas mudas produce el «Nariz en medio del mapa».
- **R-D · El ejemplo se ve, pero no estorba.** El contenido de muestra sirve para
  entender la mecánica en 3 segundos; empezar el trabajo real no puede costar
  borrar cuatro cosas de una en una.

## 2 · Fases

### F1 · Márgenes del panel (barato, arregla 15 pantallas)
Un envoltorio único `.ww-page` (max-width + padding, ya existe la medida en
`styles/home.css`) que ponen `editView`, `editList`, `reports`, `admin`,
`moderate`, `registro`… — o el router para toda ruta que no declare lo
contrario. **Red**: sonda headless que mide, en 1280 y en 390, que el primer
control de cada ruta del profe no toca el borde. Sin la sonda esto vuelve: es
justo lo que pasó al rediseñar la home.

### F2 · «+ Añadir» en las 13 (cierra la inconsistencia)
- `diagram`: botón «+ Añadir etiqueta» que coloca un pin en el centro de la
  imagen, listo para arrastrar; el clic sobre la imagen sigue funcionando.
- `ballsort`: su equivalente («+ Añadir tubo» / «+ Añadir color», a decidir al
  abrirlo).
- **Regla ejecutable** en el contrato de plantilla: toda plantilla con lista de
  elementos declara `meta.editor.elemento` (singular, en español) y el contrato
  falla si falta. Descubre por escaneo, no por lista: una plantilla nueva sin
  botón rompe CI. Ahí entra `tools/new-template.mjs`, que lo genera.

### F3 · Imagen y pines coherentes (el bug feo)
Al cambiar la imagen del diagrama: si hay pines, preguntar UNA vez —
«¿Mantener las etiquetas donde están o empezar de cero?»— y por defecto
**vaciar**, que es lo que espera quien sube su propio diagrama. Revisar el mismo
patrón en crucigrama y sopa (cambiar tamaño de rejilla con palabras colocadas).

### F4 · Empezar en limpio (R-D)
Recomendación: la actividad **sigue naciendo con el ejemplo** (se entiende la
mecánica de un vistazo, R2 del norte: el profe no configura nada para empezar) y
gana un botón **«Vaciar y empezar de cero»** en la cabecera del editor —
compartido por las 13, un solo clic, con deshacer por confirmación. Es lo más
barato y no quita el valor del ejemplo. Alternativa si prefieres lo contrario:
nacer vacías y ofrecer «Ver un ejemplo». **Decisión del dueño.**

### F5 · Buscador de imágenes (lo nuevo)
Un componente único `core/imagePicker.js` con dos pestañas —**Subir** y
**Buscar**— usado por los TRES sitios que hoy solo suben: imagen del diagrama,
fondo de la actividad e imagen de pregunta. Al elegir, pasa por `core/upload.js`
(comprime) igual que un archivo local, así el tope de §25 se respeta solo.

Lo que hay que decidir antes de escribir una línea, porque condiciona todo:

| Fuente | Clave API | Licencia | Nota |
|---|---|---|---|
| **Openverse** (Wikimedia + Flickr CC) | no | CC / dominio público | la más limpia para un colegio; obliga a guardar la ATRIBUCIÓN junto a la imagen |
| **Wikimedia Commons** | no | libre | ideal para diagramas escolares (anatomía, mapas) |
| **Pixabay / Unsplash** | sí | libre de uso | catálogo más «bonito», pero hay que registrar y guardar una clave |

Dos avisos que van en el plan para que no sorprendan:
- **La atribución no es opcional** con CC: si se busca, se guarda de dónde salió
  y se muestra en algún sitio. Es un campo nuevo en el contenido (§24, opcional,
  sin migración).
- **Es una función ONLINE.** El aula sin internet (D4) seguirá subiendo archivos;
  el buscador se degrada con su aviso, nunca en silencio (R6).

### F6 · El presupuesto de la imagen del diagrama
Hoy usa el tope de imagen inline: **200 KB / 1280 px**. Un diagrama se mira de
cerca y tiene detalle fino (rótulos, líneas). El fondo de actividad ya usa
**800 KB / 1920 px** y es el mismo tipo de uso. Propuesta: el diagrama pasa al
presupuesto de fondo. Toca §25 (cuotas), así que va con su test de paridad.

## 3 · Orden sugerido

F1 (barato, arregla 15 pantallas) → F3 (el bug feo) → F2 (+Añadir, con su regla)
→ F6 (presupuesto) → F4 (decisión) → F5 (el buscador, el más grande y el que
más decisiones pide).
