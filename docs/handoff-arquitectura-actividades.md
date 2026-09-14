# Plan · LA ARQUITECTURA DE LAS ACTIVIDADES — un paquete que declara, un anfitrión que no lista

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha) · cuando se ejecute, una regla de import nueva y la paridad carpeta↔registro

> Pedido por el dueño el 2026-09-13, al ver que retirar una actividad tocó 92
> ficheros: «esto es infraestructura y no está bien diseñada, hay que dar un
> paso atrás y rediseñar cómo debería ser en realidad, fíjate cómo lo hacen
> programas similares».

Este documento NO propone reescribir las actividades: por dentro están sanas.
Propone arreglar **la frontera** entre una actividad y la plataforma, que hoy
no existe como tal.

## 1 · El diagnóstico, medido

Retirar el Crucigrama movió 92 ficheros. Repartidos:

| Qué eran | Cuántos |
|---|---|
| La actividad en sí (sus módulos, su CSS, su suite) | 15 |
| Documentación en prosa | 20 |
| Código de la plataforma donde solo se la **mencionaba en un comentario** | 10 |
| Listas de excepción en tests y herramientas | 22 |
| Enlaces a su hoja de estilo en tres HTML | 4 |
| Regenerados automáticamente | 6 |
| **Acoplamiento real** | **8** |

Y las tres cifras que explican el resto:

- **46 módulos distintos de `core/`** los importan las actividades. No hay
  superficie de API: hay un directorio abierto.
- **~2.100 líneas de `core/` no las usa la plataforma**, solo dos a cuatro
  actividades cada una: corrección de texto (1.509, Tildes y Comas), arrastre
  de cuerdas (183, Emparejar y Diagrama), ruleta (139, Ruleta y Abre Cajas),
  banco de dibujos (33, Colorear y Rompecabezas), pintura de ronda (113),
  baldosa de imagen y editor de pares (112).
- **El anfitrión guarda cuatro listas por actividad**: un `switch` de 15 casos
  para el dibujo de la tarjeta, 36 enlaces de CSS escritos a mano en tres HTML,
  las baldosas del selector y el registro.

Lo que **sí** está bien y no se toca: once módulos de `core/` los importan
entre diez y quince actividades (el shell, la cabecera, el reloj, los eventos,
la convención de puntos, el azar, los identificadores, las primitivas del
editor). Eso es plataforma legítima. Y el fichero más grande dentro de
cualquier actividad son 350 líneas: ninguna es un monolito.

**La conclusión**: el problema no es que las actividades estén mal hechas, ni
que se comparta demasiado. Es que `core/` es un cajón plano donde conviven, con
el mismo aspecto, tres cosas distintas —plataforma, familia y tripas— y una
actividad puede alcanzar cualquiera de las tres.

## 2 · Cómo lo resuelven los sistemas comparables

Cuatro sistemas que tienen exactamente este problema. Leído de su código y su
documentación oficial, no de memoria (fuentes al final).

**H5P** es el análogo más directo: actividades educativas empaquetadas. Cada
una es una *librería* con un manifiesto `library.json` que declara su identidad,
su versión, la versión mínima del núcleo que necesita (`coreApi`), sus ficheros
JS, **sus CSS**, sus dependencias de ejecución y —por separado— las de su
editor. El anfitrión aplana el árbol de dependencias y compone la lista de
estilos y scripts; ningún HTML lleva enlaces escritos a mano. El esquema del
contenido se declara en `semantics.json` y la migración es un `upgrades.js`
indexado por versión de destino: una función pura de JSON a JSON por cada salto.

Y H5P tiene nombre para la familia: **librería no ejecutable** (`runnable: 0`).
`H5P.Question` es exactamente eso — una unidad de primera clase, versionada
igual que una actividad, con su propio CSS, que nadie puede jugar y que decenas
de actividades declaran como dependencia.

**Moodle** descubre sus plugins **iterando el directorio**: si la carpeta tiene
un nombre válido y un `version.php`, existe. Nadie escribe la lista. Los estilos
van por convención pura: si el plugin tiene un `styles.css`, el tema lo incluye.
Y su nombre para la familia es **subplugin**: un tipo de plugin propiedad de un
módulo padre, declarado en un `db/subplugins.json`, con su versión atada a la
del padre. El código compartido por algunas unidades no es una carpeta suelta
en el núcleo: es una unidad con dueño.

**VS Code** lleva la idea al extremo con `contributes`: la unidad **declara
datos** y el anfitrión los consume sin conocerla. Un lenguaje aporta su gramática
como fichero, un tema aporta sus colores como JSON. Y la superficie de API es
**un solo módulo**, `vscode`, cuya versión fija el propio manifiesto. Importar
las tripas del editor no es que esté prohibido: no hay por dónde.

**Obsidian** es el caso sin gestor de paquetes, que es el nuestro: una unidad son
tres ficheros en una carpeta cuyo nombre debe coincidir con su `id`, y si hay un
`styles.css` el anfitrión lo inyecta por el hecho de existir. No tiene concepto
de familia: cada plugin empaqueta lo suyo y paga en duplicación. Es la prueba de
que sin familia se puede vivir — pero duplicando, que es lo que aquí ya se
decidió no hacer.

**El patrón que comparten los cuatro**: la unidad declara, el anfitrión descubre.
Ninguno mantiene una lista por unidad dentro del núcleo.

## 3 · El rediseño: cinco decisiones

Cada una corresponde a una pieza medida del §1 y borra código en vez de añadirlo.

### D1 · UNA PUERTA, con versión declarada

Una actividad importa de **un solo módulo de plataforma**, que reexporta la
superficie legítima y nada más. Lo demás de `core/` deja de ser alcanzable desde
`templates/**`, y una regla ejecutable lo vigila (el equivalente sin
empaquetador del módulo `vscode` y del `coreApi` de H5P).

De 46 puertas a una. El beneficio inmediato no es estético: hoy nadie puede
decir qué rompe al tocar un módulo de `core/`, porque cualquiera puede estar
importado desde cualquier actividad.

El manifiesto declara contra qué versión de esa puerta está escrita la actividad.
Eso convierte «esta actividad es vieja» en un dato comprobable en vez de en una
sorpresa a mitad de partida.

### D2 · EL MANIFIESTO DECLARA LO QUE HOY SON LISTAS DEL ANFITRIÓN

El `meta` de una actividad ya declara casi todo: nombre, icono, modelo,
versión, proporción del marco, modos, política de juego, instrucciones y valores
por defecto. Le faltan cuatro campos, y son exactamente las cuatro listas:

- **su hoja de estilo** → mueren los 36 enlaces a mano (Moodle por convención,
  H5P por declaración);
- **su dibujo de tarjeta** → muere el `switch` de 15 casos, y con él el test que
  existía solo para vigilar que nadie olvidara un caso;
- **de qué familias depende** → hoy es una importación invisible;
- **la forma real de su contenido** → hoy solo hay un nombre de modelo.

Es el `contributes` de VS Code: la unidad aporta datos, el anfitrión los usa sin
saber quién es.

### D3 · LA FAMILIA ES UNA UNIDAD, NO CÓDIGO DEL NÚCLEO

Las ~2.100 líneas que usan dos a cuatro actividades salen de `core/` a su propia
carpeta hermana, cada una con su manifiesto, su CSS y su nombre. No aparecen en
el catálogo —no se pueden jugar— y las actividades las declaran como dependencia.
Es la librería no ejecutable de H5P y el subplugin de Moodle.

Esto arregla tres cosas de golpe:

- **El tamaño de una actividad deja de ser mentira.** Comas son hoy 153 líneas y
  Tildes 188 porque su mecánica, 1.509 líneas, vive fuera de su carpeta. Ni el
  mapa de módulos ni una revisión humana ven eso.
- **Cambiar una mecánica deja de parecer cambiar la plataforma.** Hoy el arrastre
  de cuerdas está en el mismo cajón y con el mismo aspecto que el reloj, y nada
  dice que uno lo usan dos actividades y el otro quince.
- **Cierra la única fuga de capa que queda**: la vista en vivo de «pedir la
  palabra», que es plataforma, importa directamente el giro de la ruleta, que es
  mecánica de dos actividades. Con las familias fuera de `core/`, ese import es
  ilegal por construcción y hay que resolverlo por el contrato de la plantilla.

### D4 · EL ESQUEMA LO DECLARA LA UNIDAD

Hoy el modelo de contenido es un **nombre** compartido, no una forma. Dos
actividades compartían el modelo de palabras con dos formas de dato
incompatibles —cadenas sueltas frente a fichas con palabra, pista y posición— y
el revisor común tuvo que aprender la regla de una de ellas: que una ficha sin
sitio en la rejilla no existe para el juego. Esa regla llegó al núcleo porque el
contenido escrito por la IA producía palabras perfectas que el juego descartaba,
con el profe mirando palabras correctas sin entender nada.

La regla nueva: **un modelo, una forma**. Si dos actividades necesitan formas
distintas, son dos modelos. Y lo que el modelo común no pueda comprobar lo aporta
la actividad, en vez de que el validador compartido aprenda casos particulares.
Es el `semantics.json` de H5P: el esquema vive con la unidad.

La conversión entre actividades sigue trabajando sobre modelos, que es donde
tiene sentido; lo que desaparece es la ambigüedad de forma dentro de un modelo.

### D5 · DESCUBRIR POR CONVENCIÓN, VERIFICAR EN CI

Moodle y Obsidian escanean el directorio. Un navegador no puede listar carpetas,
así que el equivalente honesto es **generar** el registro con una herramienta y
que **un test escanee** y exija que carpeta y registro digan lo mismo. Esa
paridad ya existe a medias; aquí se vuelve la regla de entrada, y con ella el
registro deja de ser una lista que alguien mantiene a mano.

## 4 · Qué NO se copia, y por qué

- **Varias versiones de la misma unidad conviviendo** (H5P instala
  `H5P.MultiChoice-1.16` junto a otras y resuelve pesos de carga). Exige
  instalación, inventario y base de datos. Aquí hay una sola versión de cada
  cosa en el árbol: la dependencia se declara para **documentar y verificar**,
  no para resolver.
- **Instalación en caliente y empaquetado firmado** (`.h5p`, VSIX). No hay
  terceros instalando actividades: todo se sirve del mismo repositorio.
- **Escaneo de directorio en ejecución**. El navegador no puede; por eso D5.
- **Aislamiento real en iframe** (H5P). Rompería el aula sin internet y el
  rendimiento. El aislamiento aquí es disciplina verificada, como en Moodle.
- **API «propuesta» con tipos paralelos** (VS Code). Sin distribución a terceros,
  la gobernanza cuesta más de lo que da.

## 5 · El orden, y lo que cuesta

Cada fase es un commit con preflight, y cada una **borra** código:

1. **La puerta** (D1). Módulo de plataforma + la regla de import como test
   verificado en rojo. Cero cambio de conducta; es el paso que hace visibles los
   otros cuatro.
2. **La hoja de estilo en el manifiesto** (D2, primera mitad). Mueren 36 enlaces.
3. **El dibujo de la tarjeta en el manifiesto** (D2, segunda mitad). Muere el
   `switch` de 15 casos y el test que lo vigilaba.
4. **Las familias fuera de `core/`** (D3). Es la fase gorda: ~2.100 líneas se
   mueven sin cambiar, se declaran como dependencia, y se resuelve la fuga de la
   ruleta en la vista en vivo.
5. **Un modelo, una forma** (D4). La más delicada, porque toca contenido guardado
   por profes: se hace con migración versionada o no se hace.

D5 cabe dentro de la fase 1.

**El riesgo real está en la fase 4 y en la 5.** Mover 2.100 líneas no cambia
conducta, pero toca las dos actividades de corrección de texto, que son las que
usan el lápiz en la pizarra —lo único que ninguna sonda puede verificar sola—.
La fase 5 toca contenido del profe, y ahí la ley §24 manda: se migra con versión
o no se toca.

**Decidido por el dueño (2026-09-14)**: las familias se mueven **todas de una
vez**, no una por commit. Y la ejecución **no es ahora**: se hace de noche o
cuando el dueño lo indique, con este plan revisado antes de empezar.

Sigue abierto: si la fase 5 («un modelo, una forma») entra en esa misma tanda o
espera a que una razón de producto la pida. Es la única que toca contenido ya
guardado por profes.

## 6 · Fuentes

Leídas el 2026-09-13 del código y la documentación oficiales:

- H5P: [`library.json` de MultiChoice](https://raw.githubusercontent.com/h5p/h5p-multi-choice/master/library.json) ·
  [`library.json` de H5P.Question](https://raw.githubusercontent.com/h5p/h5p-question/master/library.json) ·
  [`semantics.json`](https://raw.githubusercontent.com/h5p/h5p-multi-choice/master/semantics.json) ·
  [`upgrades.js`](https://raw.githubusercontent.com/h5p/h5p-multi-choice/master/upgrades.js) ·
  [`h5p.classes.php`](https://raw.githubusercontent.com/h5p/h5p-php-library/master/h5p.classes.php)
- Moodle: [`core_component`](https://raw.githubusercontent.com/moodle/moodle/main/public/lib/classes/component.php) ·
  [`theme_config`](https://raw.githubusercontent.com/moodle/moodle/main/public/lib/classes/output/theme_config.php) ·
  [`upgradelib.php`](https://raw.githubusercontent.com/moodle/moodle/main/public/lib/upgradelib.php) ·
  [`db/subplugins.json` de mod/quiz](https://raw.githubusercontent.com/moodle/moodle/main/public/mod/quiz/db/subplugins.json)
- VS Code: [manifiesto de extensión](https://raw.githubusercontent.com/microsoft/vscode-docs/main/api/references/extension-manifest.md) ·
  [puntos de contribución](https://raw.githubusercontent.com/microsoft/vscode-docs/main/api/references/contribution-points.md) ·
  [anatomía de una extensión](https://raw.githubusercontent.com/microsoft/vscode-docs/main/api/get-started/extension-anatomy.md)
- Obsidian: [manifiesto](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/main/en/Reference/Manifest.md)
