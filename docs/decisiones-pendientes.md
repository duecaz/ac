# Decisiones de producto pendientes — contrastadas con Wordwall y Kahoot

Los referentes ya tomaron estas decisiones; nosotros aún no. Este documento NO
es un plan de tareas: es la lista de bifurcaciones donde el proyecto todavía
puede ir a dos sitios distintos, con una recomendación por cada una. Cuando una
se decide, baja a su handoff (o a `docs/leyes.md` si se convierte en norma) y
sale de aquí.

<!-- GENERADO:nav -->
### Índice de este documento

- [Lo que YA está decidido (no re-litigar)](#lo-que-ya-está-decidido-no-re-litigar)
- [D1 · Identidad del alumno: ¿apodo, clase o cuenta?](#d1--identidad-del-alumno-apodo-clase-o-cuenta)
- [D2 · ¿El contenido es un objeto propio o vive dentro de la actividad?](#d2--el-contenido-es-un-objeto-propio-o-vive-dentro-de-la-actividad)
- [D3 · ¿Imprimimos? (hoja de trabajo)](#d3--imprimimos-hoja-de-trabajo)
- [D4 · ¿Aula SIN internet es un caso soportado?](#d4--aula-sin-internet-es-un-caso-soportado)
- [D5 · Taxonomía de la biblioteca](#d5--taxonomía-de-la-biblioteca)
- [D6 · Cuotas y retención — ✅ DECIDIDA Y APLICADA (v1.51.340, ley §25)](#d6--cuotas-y-retención---decidida-y-aplicada-v151340-ley-25)
- [D7 · Congelar el catálogo de bucles en vivo — ✅ ESTUDIADA Y CONGELADA (ley §26)](#d7--congelar-el-catálogo-de-bucles-en-vivo---estudiada-y-congelada-ley-26)
- [Estado (decisión del usuario, v1.51.340)](#estado-decisión-del-usuario-v151340)
  - [Lo aplicado en D6](#lo-aplicado-en-d6)
- [D1 · Identidad del alumno — POSPUESTA CON MOTIVO (v1.51.365)](#d1--identidad-del-alumno--pospuesta-con-motivo-v151365)
  - [Cómo lo está pensando el usuario hoy (v1.51.421) — hipótesis EN ESTUDIO](#cómo-lo-está-pensando-el-usuario-hoy-v151421--hipótesis-en-estudio)

### Ir a otro documento

| Documento | Qué responde |
|---|---|
| [`norte.md`](norte.md) | para quién es la app, la escena real y cómo se decide (**manda sobre el resto**) |
| [`leyes.md`](leyes.md) | TODAS las leyes, cada una con el test que la vigila |
| [`arquitectura-modulos.md`](arquitectura-modulos.md) | la radiografía: capas, imports, esfuerzo por tramo y mapa de datos (GENERADO) |
| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles en vivo |
| [`estudio-bucles-live.md`](estudio-bucles-live.md) | por qué el vivo es como es (estudio medido) |
| [`testing.md`](testing.md) | las suites y las redes de seguridad del preflight |
| [`guia-testeo-companero.md`](guia-testeo-companero.md) | guía de pruebas paso a paso, para alguien no técnico |
| [`../CLAUDE.md`](../CLAUDE.md) | el mapa de entrada del repo: "quiero X → voy a Y" |
<!-- /GENERADO:nav -->

## Lo que YA está decidido (no re-litigar)

| Decisión | Igual que… |
|---|---|
| Alumno **sin cuenta**: PIN + apodo | Kahoot |
| **Puntos por velocidad** (kahoot) + podio como ceremonia | Kahoot |
| Mismo contenido en **vivo** y en **tarea** (student-paced) | Kahoot |
| **Biblioteca pública** con likes y publicar/borrador | Wordwall |
| **Cambiar de plantilla** sobre el mismo contenido | Wordwall |
| **Skins/temas** separados del juego (tokens, §3) | Wordwall (temas) |
| Qué persiste cada modo (`core/persistPolicy.js`); VS/Equipos NO persisten | decisión propia |
| El cliente AFIRMA, el veredicto lo pone el host/servidor (§22) | decisión propia |

## D1 · Identidad del alumno: ¿apodo, clase o cuenta?

- **Ellos**: Kahoot resuelve la partida con apodo y el seguimiento con
  grupos/roster; Wordwall pide el nombre al asignar una tarea.
- **Nosotros hoy**: apodo por sala + id anónimo por dispositivo. Un alumno no
  existe entre una actividad y la siguiente → **no hay seguimiento en el año**,
  que es justo lo que pide un colegio.
- **Opciones**: (a) seguir con apodo suelto — cero fricción, cero seguimiento ·
  (b) **CLASES**: el profe crea una clase con la lista de nombres y un código;
  el alumno se identifica eligiendo su nombre — seguimiento sin cuentas ni datos
  personales de menores · (c) cuentas de alumno — fricción alta y datos de menores.
- **Recomendación: (b)**. Es el prerequisito de lo que ya está registrado como
  deuda (PIN/NFC para pizarras, `docs/handoff-acceso-docente.md` U2-U4) y de los
  informes "por alumno" que ya existen a medias. Impacto: colecciones `classes` y
  `students`, un campo de alumno en `results`/`assignment_attempts`.

## D2 · ¿El contenido es un objeto propio o vive dentro de la actividad?

- **Ellos**: en Wordwall el activo es el CONTENIDO y la plantilla es una vista;
  de una lista salen N juegos sin duplicar nada.
- **Nosotros hoy**: actividad = contenido + plantilla, y cambiar de plantilla
  CONVIERTE en el sitio (mismo id): lo que la plantilla destino no usa se pierde.
  Las "listas" (`#/list/:id`) son otra cosa: una secuencia de partidas VS.
- **Opciones**: (a) dejarlo así · (b) **"Duplicar como otra plantilla"** (no
  destructivo: nace una actividad nueva y la original queda intacta) · (c) elevar
  el contenido a entidad propia con actividades colgando de él.
- **Recomendación: (b) ahora, (c) nunca salvo que la biblioteca lo pida**. (b) da
  el 80% del valor de Wordwall con una fracción del coste y sin tocar el modelo
  de datos; (c) es un rediseño de `storage`, informes y biblioteca entera.

## D3 · ¿Imprimimos? (hoja de trabajo)

- **Ellos**: Wordwall genera versión imprimible de muchas plantillas. Es lo que
  engancha al profe con pocas tabletas: la misma actividad sirve en pantalla y
  en papel.
- **Nosotros hoy**: nada.
- **Recomendación: sí, y por MODELO de contenido, no por plantilla**. Cinco hojas
  genéricas (`qa`, `pairs`, `words`, `items`, `textCorrection`) cubren las 13
  plantillas; una plantilla nueva hereda la hoja de su modelo sin escribir nada.
  Coste bajo (CSS de impresión + una vista), valor alto en aulas con pocos
  dispositivos.

## D4 · ¿Aula SIN internet es un caso soportado?

- **Ellos**: Kahoot y Wordwall exigen internet, sin matices.
- **Nosotros hoy**: existe el backend `local` (misma máquina, BroadcastChannel) y
  los HTML **desregistran** el service worker a propósito. O sea: la decisión
  está tomada de hecho ("siempre hay internet") pero no declarada.
- **Recomendación: decidirlo explícitamente**. Si se soporta, es nuestra única
  ventaja estructural frente a los referentes (pizarra + móviles en la misma
  red). Pero **solo después** de cerrar el problema de caché: ya nos costó dos
  partidas (v1.51.336) y un PWA multiplica esa clase de fallo.

## D5 · Taxonomía de la biblioteca

- **Ellos**: Wordwall filtra por edad, asignatura e idioma, y cada actividad
  tiene página pública. Ese es su motor de tráfico.
- **Nosotros hoy**: `explore` + likes, sin vocabulario fijo.
- **Recomendación: campos obligatorios al publicar** (grado · área · tema) con
  vocabulario CERRADO (currículo peruano). Sin eso, la biblioteca no pasa de
  "lo último publicado" por muchos likes que tenga.

## D6 · Cuotas y retención — ✅ DECIDIDA Y APLICADA (v1.51.340, ley §25)

- **Ellos**: Wordwall limita el plan gratuito (nº de recursos); es una decisión
  de negocio Y de capacidad.
- **Nosotros hoy**: sin límite de actividades por profe, sin tope de tamaño total
  por actividad (solo 200 KB por imagen) y sin política de borrado de
  `live_answers`/`live_sessions`. El servidor es un Raspberry Pi **compartido con
  otros proyectos**.
- **Recomendación: decidirlo ya, aunque sea generoso.** Tres números: actividades
  por profe, tamaño máximo por actividad, y meses de retención de salas y
  respuestas. Es la decisión más barata de tomar y la más cara de no tener.

## D7 · Congelar el catálogo de bucles en vivo — ✅ ESTUDIADA Y CONGELADA (ley §26)

- **Ellos**: Kahoot tiene UN bucle (pregunta → responder → revelar → ranking) y
  los tipos de pregunta son variantes, no juegos distintos.
- **Nosotros hoy**: cuatro bucles declarados en `meta.play.live` (`rounds`,
  `race`, `board`, y la fase `question-live`). Están declarados, que es lo
  correcto — pero nada impide que aparezca un quinto.
- **Recomendación: cerrarlo como norma** — no se añade un bucle nuevo sin entrada
  en `docs/leyes.md` y su test. Cada bucle multiplica el coste de cada cambio en
  vivo (lo hemos pagado ya en la carrera y en el tablero compartido).

## Estado (decisión del usuario, v1.51.340)

Se ejecutan **solo las estructurales**: D6 hecha (ley §25) y D7 estudiada +
congelada (ley §26, estudio en `docs/estudio-bucles-live.md`).

**D1 · D2 · D3 · D4 · D5 quedan como DEUDA REGISTRADA**: son módulos que se
pueden añadir después sin rediseñar nada de lo que ya existe — no bloquean, y
por eso no se hacen ahora. Siguen descritas arriba con su recomendación; cuando
toque una, se retoma desde ahí. Orden si se retoman: D1 (clases) → D3
(imprimible) → D5 (taxonomía) → D2 (duplicar) → D4 (sin internet).

### Lo aplicado en D6
- `core/quotas.js`: los cuatro números en un sitio (200 actividades · 2 MB por
  actividad · 200 KB por imagen · 120 días de retención de salas).
- El tope de tamaño lo aplica **PocketBase** (`maxSize` del campo `data`);
  verificado contra un servidor real: 400 al pasarse, 200 por debajo.
- `#/admin` → **Capacidad**: cuánto ocupas, tus actividades más pesadas, y
  "ver qué salas caducaron" → purga con conteo previo (probado: 12 salas y sus
  hijas borradas; la credencial de una partida de HOY resistió el borrado).
- El editor avisa al 70% y dice cuándo el servidor va a rechazar.


---

## D1 · Identidad del alumno — POSPUESTA CON MOTIVO (v1.51.365)

No es un olvido: es una decisión tomada. Daría muchísimo al docente (ver el
avance DURANTE el curso, no solo al terminar la actividad), pero toda solución
conocida cuesta algo que choca con el norte. Requiere **estudio propio antes de
tocar código**, incluyendo **cómo lo resuelven otras apps**.

**Lo que NO vale** (y por qué):

| Opción | Choca con |
|---|---|
| Cuenta para cada alumno | R3 (el alumno no tiene cuenta) y §4 (no somos un LMS) |
| Contraseñas para el alumno | R2: acaba siendo el profe quien las crea, actualiza y recuerda. Es sencillo de programar y molesto de vivir |
| Delegarlo en Google Classroom | tampoco lo gestiona bien; y nos ataría a un colegio que lo use |

**La forma que más se acerca** (a estudiar, NO decidida): el profe crea sus
salones —*5.º A*, con su lista de ~30 nombres— y el alumno entra **con el código
del profe y elige (o escribe) su nombre de la lista, sin contraseña**. La
identidad la pone el aula, no el sistema. Un profe con 12 salones los tiene
declarados una vez.

**El sustituto de la contraseña, a estudiar con cuidado**: reconocer el
dispositivo desde el que ese alumno abre habitualmente ("equipo de confianza") y
marcar como *sospechoso* un cambio. Ojo con dos cosas:
- Si Juan presta su móvil para que otro haga la tarea, **el uso es legítimo**: no
  puede tratarse como fraude, como mucho como aviso.
- **LÍNEA ROJA**: el docente **no** debe ver marca ni modelo del aparato del
  alumno. Eso no es información del profesor.

**Qué arrastra**: el PIN/NFC para pizarras (U2-U4) y los informes por alumno
dependen de esta pieza. Por eso, cuando se estudie, se estudia entero.

### Cómo lo está pensando el usuario hoy (v1.51.421) — hipótesis EN ESTUDIO

Reafirmada la pausa, con un razonamiento nuevo que cambia el planteamiento y
conviene tener escrito porque **acota mucho el problema**:

> *"Solo damos actividades para un momento en el aula, no somos el sistema del
> colegio. Así que es probable que todos los alumnos estén como ANÓNIMOS, y una
> opción, si el docente lo quiere, de poder subir un txt o un excel con sus
> alumnos. Pero eso se está meditando."*

Lo que implica, y por qué es mejor que lo que había en la ficha de arriba:

- **El caso por defecto NO cambia: anónimo.** La identidad deja de ser un
  requisito del sistema y pasa a ser **una opción del docente**, que es justo lo
  que R2 pide (nada obligatorio para empezar) y lo que R3 protege (el alumno no
  tiene cuenta). Los salones con lista dejan de ser la base para ser el caso
  avanzado.
- **La lista la trae el profe en un archivo** (txt o Excel) en vez de teclearla:
  el coste de entrada baja de "declarar 12 salones a mano" a "arrastrar el
  fichero que el colegio ya tiene". Esa era la objeción de R2 al planteamiento
  anterior.
- **La pregunta que decide sigue abierta, y es de producto, no técnica**: ¿le
  COMPENSA al docente el trabajo extra? Subir la lista solo vale la pena si lo
  que recibe a cambio (seguimiento del alumno durante el curso) le sirve de
  verdad en su día a día. Si la app es "un momento en el aula", puede que no.

**Sigue sin decidirse, y sin fecha.** Lo que hay aquí es la hipótesis con la que
se está meditando, no un plan. Cuando se retome, la primera pregunta a responder
es la de si compensa — antes de diseñar nada.
