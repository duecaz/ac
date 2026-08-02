# EL NORTE — para quién es esto, y cómo se decide

> **Rango**: este documento manda sobre los demás. `docs/leyes.md` dice cómo se
> construye; **este dice qué construimos y para quién**. Si una ley y el norte
> chocan, gana el norte y la ley se replantea.
>
> **Estado** (v1.51.367). CONFIRMADO por el usuario: §1 escena · §3 R1-R6 · §4
> "lo que no somos" · §5 referentes (⏳ pendiente de DETALLAR: hoy es un esquema
> y hace falta bajar cada fila a ejemplos concretos).
> **[CONFIRMAR]**: §2b presupuesto de tiempo · §6d señales de que vamos bien.
> §3 R7 (privacidad de menores), §3b actores, §3c degradación y §6e vocabulario
> describen lo que YA hacen el código y las reglas del servidor — salvo la
> columna "se dice" del vocabulario, que es la decisión que falta aplicar.

---

## 1. La escena

Un profesor, en su aula, con una **pizarra interactiva** y **unos 33 alumnos**
delante. **Prepara una actividad o BUSCA una ya hecha**, y la usa **unos
minutos**: como introducción, como la actividad del día o para explicar algo.

> **La actividad no es la clase: la enriquece.** Son minutos dentro de una
> sesión que el profe ya tenía preparada. Eso manda sobre todo lo demás: si algo
> exige montar la clase alrededor de la app, está mal planteado.

Cómo se juega, por frecuencia real:

| | Cómo | Cuánto |
|---|---|---|
| **Individual · VS · Equipos** | todos miran la pizarra; se juega ahí mismo | **lo habitual** |
| **En vivo** | cada alumno con su propio móvil | **solo en algunos colegios** |
| **Tarea** | fuera de clase | ocasional |

Todo lo que sigue se juzga contra esa escena.

> **Consecuencia incómoda, medida** (v1.51.365): el tramo "en vivo" tiene 0,75
> líneas de test por línea de código; "buscar/crear" —por donde pasa TODA
> clase— tiene 0,29, y las plantillas, 0,17. Hemos blindado el modo minoritario.
> La foto por tramos está en `docs/arquitectura-modulos.md` y ahora se regenera
> con cada cambio, así que la desviación deja de ser invisible.

## 1b. El ciclo de una clase: antes · durante · después

Sirve para ubicar cualquier función antes de discutirla. La app vive sobre todo
en el **durante**, y ahí manda el reloj.

| | Qué hace el profe | Cuánto dura | Qué NO puede pasar |
|---|---|---|---|
| **ANTES** | busca una actividad o la crea; a veces el día anterior, a veces 3 minutos antes | minutos, y a menudo con prisa | que haya que preparar algo obligatorio para poder jugar (R2) |
| **DURANTE** | proyecta, elige el modo y juega unos minutos; atiende a la clase, no a la app | **la actividad son minutos** dentro de la sesión | que la app pida atención (un error, una espera, un ajuste): la clase se cae con ella (R6) |
| **DESPUÉS** | mira quién falló qué, comenta, y sigue con su clase | segundos, o nada | que revisar exija exportar, cruzar hojas o entrar a otro sitio |

> **Lo que esto implica**: casi todo el valor está en el DURANTE, pero casi todo
> el tiempo de decisión del profe está en el ANTES. Una función que mejora el
> durante a costa de complicar el antes suele ser un mal cambio.

## 2. La promesa (una frase)

> **Convertir cualquier contenido del profe en una actividad jugable en clase,
> en menos tiempo del que tarda en escribirla en la pizarra.**

Lo que hace única a la app frente a los referentes: **el mismo contenido se juega
de cinco maneras** (uno solo, duelo, equipos, toda la clase en vivo, o de tarea)
sin volver a escribirlo. Esa es la razón de ser del modelo de cuatro capas: si
una actividad supiera en qué modo corre, esa promesa sería imposible de mantener.

## 2b. El presupuesto de tiempo **[CONFIRMAR]**

La promesa de §2 es medible o no es nada. Propuesta de objetivos — no son
métricas de vanidad, son el listón contra el que se juzga una pantalla nueva:

| Momento | Objetivo |
|---|---|
| De abrir la app a **estar jugando** una actividad que ya tengo | **≤ 3 toques** y ≤ 15 segundos |
| De decidir "quiero una de tildes" a **tenerla lista** (buscada en la biblioteca) | ≤ 1 minuto |
| De crear una actividad de 5 preguntas desde cero | ≤ 3 minutos |
| De abrir sala en vivo a **el primer alumno dentro** | ≤ 30 segundos (PIN + QR a la vista) |
| De terminar a **ver quién falló qué** | ≤ 2 toques, sin exportar nada |

> Si una función añade un paso a cualquiera de estas filas, tiene que quitar
> otro o justificar muy bien por qué.

## 3. Las restricciones duras

No son preferencias: son el terreno. Una función que las incumpla está mal
planteada, aunque funcione en el portátil del que la programa.

| # | Restricción | Qué implica |
|---|---|---|
| **R1** | **La pantalla principal es una pizarra táctil de gama baja**, a 2-3 metros, mirada por 30 personas a la vez | Nada de texto pequeño ni de tamaños fijos; los objetivos táctiles son grandes; sin bucles de animación en reposo (`ww-lite`); contraste alto |
| **R2** | **El profe no configura nada.** Abre y juega | Cero pantallas de ajustes obligatorias; lo que se pueda derivar, se deriva; los ajustes finos son opcionales y viven en el editor |
| **R3** | **El alumno no tiene cuenta.** Entra con un PIN | La identidad del alumno es del aula, no del sistema; la seguridad va por reglas de servidor, no por login (§22) |
| **R4** | **La red del colegio es mala** y los móviles se bloquean | Todo estado importante vive en el servidor como INSTANTE, no como temporizador local; las escrituras se reintentan solas; recargar nunca pierde nada |
| **R5** | **El servidor es una Raspberry Pi compartida** | Los límites son reales y están declarados (§25); una función que multiplique las consultas por alumno hay que medirla ANTES |
| **R6** | **La clase no espera.** Un fallo con 33 críos delante no se depura | Fallar en silencio está prohibido: o funciona, o lo dice claro y sigue |
| **R7** | **Son MENORES.** Lo que se guarda de un alumno es lo mínimo para que la clase funcione | Nada de datos personales más allá del nombre que el profe usa en el aula; sin telemetría del alumno; **el docente NO ve marca ni modelo del aparato**; leer historial exige sesión de profe; la retención tiene fecha de caducidad (§25) |

## 3b. Los actores, y qué puede cada uno

Cuatro, ni uno más. Cada uno existe en las reglas del servidor (`core/pbRules.js`),
no solo en la interfaz — por eso esta tabla se puede contrastar con el código.

| Actor | Cómo se identifica | Puede | NO puede |
|---|---|---|---|
| **Profe (dueño)** | cuenta (Google o alta por admin) | crear/editar SUS actividades · abrir salas · crear tareas · ver informes | tocar actividades de otro (`owner`), ni ver historiales que no sean de sus sesiones |
| **Profe (visitante)** | cuenta | **usar** una actividad pública de la biblioteca · darle "me gusta" · reportarla | editar la original (se la lleva como copia suya) |
| **Alumno** | **sin cuenta**: PIN de sala o enlace de tarea + apodo | entrar, jugar, enviar SU respuesta (atada a su dispositivo, §22-4) | ponerse puntos · editar la respuesta de otro · tocar el estado de la sala · leer el historial de nadie |
| **Admin** | rol `admin` | dar/quitar rol de profe · ver reportes · crear las colecciones | — |

> **Cualquiera sin cuenta** puede además *ver* la biblioteca pública (`visibility
> = "public"`). Es la puerta de entrada del §1: buscar una actividad ya hecha.

## 3c. Qué pasa cuando algo falla (degradación declarada)

R6 dice que la clase no espera. Eso obliga a decidir **de antemano** cómo se
comporta la app rota, en vez de improvisar con 33 críos delante.

| Si falla… | La app debe… | Hoy |
|---|---|---|
| **Internet / el servidor** | seguir jugando en la pizarra con lo que ya está cargado; encolar lo que haya que guardar y reenviarlo solo | ✅ colas de resultados e intentos · driver local |
| **La conexión de UN móvil** | que ese alumno siga y su respuesta llegue tarde pero llegue; la sala no se entera | ✅ reintentos + settle de rezagadas |
| **El proyector sin sonido** | el juego se entiende sin audio (el sonido acompaña, nunca informa) | ✅ mute + señales visuales |
| **Una plantilla concreta** | que el fallo se quede en esa actividad, no tumbe la página | ⚠️ parcial: hay boot-guard, pero no un aislamiento declarado por plantilla |
| **El alumno llega tarde o recarga** | entrar/continuar donde estaba, sin perder nada | ✅ instantes del servidor + reanudar carrera |

> **La regla que las une**: *fallar en silencio está prohibido*. Si algo no se
> pudo guardar, se dice. La prueba de carga que informaba "0 filas" cuando en
> realidad el servidor rechazaba con 403 fue exactamente este error, y costó
> tiempo buscando en el hardware lo que era una regla.

## 4. Lo que NO somos ✅ CONFIRMADO

Decirlo importa tanto como decir lo que sí: la mitad de las discusiones de diseño
se resuelven aquí.

- **No somos un LMS.** No gestionamos matrículas, ni currículo, ni boletines.
  Nos integramos con lo que el colegio ya use (Classroom) en vez de sustituirlo.
- **No somos evaluación formal.** Lo que se guarda sirve para que el profe VEA
  cómo va la clase, no para poner notas oficiales. Por eso el alumno no tiene
  expediente ni cuenta.
- **No somos una red social.** La biblioteca pública es para reutilizar
  actividades, no para seguir a nadie ni acumular seguidores.
- **No somos una app de estudio en casa.** El modo Tarea existe para extender la
  clase, no para sustituirla. Si algo solo tiene sentido con el alumno solo en
  su casa, probablemente no es nuestro.

## 5. Los referentes: qué tomamos y qué no ✅ CONFIRMADO · ⏳ falta detallar

> Confirmado en lo esencial, pero **todavía es pobre**: cada celda debería bajar
> a ejemplos concretos (qué pantalla, qué mecánica, qué ajuste) para que no
> queden dudas al decidir. Pendiente de una sesión propia.

| | Wordwall | Kahoot | Nosotros |
|---|---|---|---|
| **Idea central** | un contenido, muchas plantillas | una sala en vivo con PIN | **las dos**: un contenido, muchas plantillas Y muchos modos |
| **Qué TOMAMOS** | el catálogo de mecánicas · cambiar de plantilla sin reescribir · la biblioteca reutilizable | el PIN + QR · el ritmo marcado por el profe · el podio como cierre emocional | — |
| **Qué NO tomamos** | la maraña de opciones por actividad (choca con R2) · el muro de pago por plantilla | que TODO sea la misma carrera de preguntas · el ranking en pantalla durante el juego (decisión C-2: durante el juego se muestra **avance**, no puestos) | — |
| **Dónde vamos por delante** | — | — | el mismo contenido en 5 modos · 4 bucles en vivo distintos (no solo rondas) · funciona en la pizarra sin que los alumnos tengan dispositivo |
| **Dónde vamos por detrás** | biblioteca enorme y taxonomía (D5) · imprimibles (D3) | analítica pulida · identidad del alumno a lo largo del curso (D1) | — |

## 6. El criterio de decisión

Ante cualquier función nueva, en este orden:

1. **¿Sirve en la escena del §1?** Un profe con la pizarra encendida, 33
   alumnos, y unos minutos de actividad dentro de una clase que ya tenía
   preparada. Si exige montar la clase alrededor de la app, va al final.
   **Y para qué tramo es**: lo que toca "buscar/crear" o "jugar en la pizarra"
   llega a todas las clases; lo que toca "en vivo", solo a algunos colegios.
2. **¿Rompe alguna restricción dura (§3)?** Si sí, no se parchea: se replantea.
3. **¿Cae en "lo que no somos" (§4)?** Si sí, se descarta o se integra con quien
   ya lo hace.
4. **¿En qué capa vive (§0 de las leyes)?** Si no encaja en ninguna, el diseño
   todavía no está listo.
5. **¿Qué test la vigila?** Si la respuesta es "ninguno", no está terminada.

## 6b. DE DÓNDE SE DESPRENDE CADA LEY — la cadena de derivación

Esto es lo que impide ir a la deriva: **ninguna ley de arquitectura existe
porque sí**. Cada una implementa una restricción de §3 o la promesa de §2, y
cada una tiene un test que la hace cumplir. Se lee de izquierda a derecha:
*por qué → cómo → quién lo vigila*.

| Del norte… | …sale esta ley | …vigilada por |
|---|---|---|
| **§2 la promesa** (un contenido, muchos modos) | **§0 · CUATRO CAPAS** — la plantilla DECLARA sus políticas (`meta.play`), el modo las consume; una plantilla no sabe en qué modo corre | `layers` · `templateContract` · `scoringSources` · matriz jugable |
| **§2 la promesa** (el contenido sobrevive al cambio de plantilla) | **§24 · CONTENIDO** — modelos versionados, migración declarada, ids con `rid()` | `templateContract` · regla `id-rid` |
| **R1 pizarra de gama baja, mirada a 3 m** | **§3 · ESTILO** — el skin cambia TOKENS, la actividad los consume; nada de tamaños fijos; sin bucles de animación en reposo | `styles` (ratchet) · `skins` |
| **R3 el alumno no tiene cuenta** | **§22 · CONFIANZA** — el cliente AFIRMA, el veredicto lo pone el host o una regla del servidor | `pbRules` · `liveRules` · `answerSafety` · `modeAuth` |
| **R3 + R6** (nadie edita lo de otro, y el fallo se ve) | **§21 · DATOS** — cada colección tiene UN dueño; quien necesite datos le pide un método | regla `pb-dueno` |
| **R4 la red del colegio es mala** | **§23 · VISTA** — el ritmo es un INSTANTE del servidor, nunca un temporizador local; cada reloj por su primitivo; la vista posee su ciclo de vida | `deadlineTicker` · `clock` · `events` · `idempotency` |
| **R5 el servidor es una Pi compartida** | **§25 · CAPACIDAD** — los límites son UNO y están declarados (200 actividades · 2 MB · 120 días) | `quotas` (paridad módulo↔panel↔script) |
| **R6 la clase no espera** | **§26 · BUCLES LIVE** — el catálogo está congelado: fase nueva = decisión escrita | `liveLoops` |

**Los huecos que esta tabla destapa** (y que hay que resolver, no esconder):

| Hueco | Estado |
|---|---|
| **R2 "el profe no configura nada" no tiene ley ni test.** Es la restricción que más decisiones de UI debería gobernar (cuántos ajustes salen antes de jugar, qué se deriva solo) y hoy vive solo como intención | ⚠️ **falta la ley** — candidata a §27 |
| **El tramo "buscar/crear" no tiene ley propia**, pese a ser por donde pasa TODA clase (§1) y tener el ratio de test más bajo (0,29) | ⚠️ deuda de prioridad, ya medida en `arquitectura-modulos.md` |
| §26 (bucles congelados) se desprende de R6, pero **cubre el modo minoritario**; ninguna ley cubre con el mismo detalle los modos de pizarra, que son los habituales | ⚠️ desequilibrio declarado |

## 6c. CÓMO SE DECIDE LA ARQUITECTURA

El procedimiento que ya usamos de facto, ahora escrito. Ante un cambio
estructural, en este orden:

1. **¿De qué restricción o promesa se desprende?** Si no se desprende de
   ninguna, **no es arquitectura: es preferencia** — se anota como tal y se deja
   pasar solo si no cuesta nada. Esta pregunta es la que evita la deriva.
2. **¿En qué capa vive?** (§0). Si no encaja en ninguna, el diseño no está listo
   todavía. Si "encaja en dos", falta partir algo.
3. **¿Quién es el dueño del dato?** (§21). Un dato sin dueño acaba con tres
   escritores y un lost-update.
4. **¿Qué dice el cliente y qué decide el servidor?** (§22). Todo lo que decida
   un resultado tiene que poder verificarlo el servidor.
5. **¿Qué test la vigila, y cuál es su CONTRA-PRUEBA?** Un test que solo
   comprueba que lo nuevo funciona deja pasar la regla demasiado cerrada: hay
   que comprobar también que el camino legítimo sigue vivo.
6. **¿A qué tramo del viaje sirve?** (§1). Determina la prioridad, no la
   corrección: lo que toca "buscar/crear" o "la pizarra" llega a todas las
   clases.

> **Regla de oro**: una decisión de arquitectura que no puede citar su origen en
> el norte es una decisión huérfana. Con el tiempo, las huérfanas son las que
> nadie sabe por qué están y nadie se atreve a quitar.

## 6d. Señales de que vamos bien **[CONFIRMAR]**

Sin esto, "mejorar" es opinión. Propuesta de señales — ninguna necesita
analítica ni espiar a nadie (R7): salen de preguntar al profe y de mirar el repo.

| Señal | Cómo se ve | Por qué esa |
|---|---|---|
| **El profe REPITE a la semana siguiente** | preguntándole | es la única señal que no se puede fingir |
| **La usa sin avisar a nadie** | no hay mensajes de "no me funciona" | R6: si la clase se cayó, lo sabemos |
| **La actividad empieza dentro del presupuesto** (§2b) | cronómetro en mano, una vez al mes | la promesa es el tiempo |
| **Ninguna clase se rompe por un fallo nuestro** | los reportes del profe | R6 otra vez |
| **El esfuerzo cae donde el profe pasa** | tabla por tramos de `arquitectura-modulos.md` | evita repetir lo de esta semana (blindar el modo minoritario) |

**Lo que NO vamos a medir**, aunque sea fácil: nada del alumno más allá de lo que
la clase necesita (R7). Ni cuántas veces abre, ni desde qué aparato, ni cuánto
tarda en responder fuera de la partida.

## 6e. UNA COSA, UN NOMBRE (vocabulario)

Hoy la interfaz llama a lo mismo de tres maneras. Medido en `views/`: **sala 46 ·
sesión 24 · partida 15** para el mismo objeto; **tarea 31 · intento 28 ·
entrega 5**. Eso no es cosmética: el profe aprende un nombre, el código usa otro
y la documentación un tercero, y cada uno arrastra su malentendido.

**La palabra que manda** (propuesta, y luego se aplica en UI y docs):

| Concepto | **Se dice** | En el código | Nunca se dice |
|---|---|---|---|
| Lo que el profe crea y guarda | **actividad** | `activities` | "juego", "ejercicio" |
| La mecánica con la que se juega | **plantilla** | `templates/*` | "tipo", "formato" |
| Cómo se organiza la clase para jugar | **modo** (Individual · VS · Equipos · En vivo · Tarea) | `MODE_DEFS` | "método" |
| La forma del juego DENTRO de "en vivo" | **bucle** (rondas · carrera · tablero · pedir la palabra) | `LIVE_LOOPS` | "modo en vivo" |
| El encuentro en vivo, con su PIN | **sala** | `live_sessions` | ~~sesión~~, ~~partida~~ |
| Lo que un alumno envía en la sala | **respuesta** | `live_answers` | "envío" |
| El trabajo que se manda fuera de clase | **tarea** | `assignments` | "deber", "asignación" |
| Lo que el alumno entrega de una tarea | **intento** | `assignment_attempts` | ~~entrega~~ (un intento es uno de varios) |
| Lo que queda de jugar en Individual | **resultado** | `results` | "puntuación guardada" |

> **Deuda declarada**: el código dice `live_sessions` y la UI dirá "sala". No se
> renombra la colección (migración con datos vivos, coste alto y beneficio nulo
> para el profe); lo que se unifica es **lo que ve y lee la gente**. La tabla es
> el puente, y el `docgen` puede vigilarla más adelante.

## 7. El viaje del profesor — dónde estamos

Esto es lo que hoy puede hacer, de principio a fin. Las flechas **gruesas** son
el camino habitual (la pizarra, sin móviles); en **rojo**, lo que falta.

```mermaid
flowchart TD
  A([Entro con mi cuenta]) --> B[Mis actividades]
  B --> C{¿Tengo la actividad?}
  C -- no, la busco --> D2[Biblioteca pública: la encuentro y la uso]
  C -- no, la creo --> D[Elijo plantilla y escribo el contenido]
  C -- sí --> E
  D --> E[Elijo cómo jugarla]
  D2 --> E
  E ==> F[Individual · en la pizarra]
  E ==> G[VS o Equipos · en la pizarra]
  E --> H[En vivo · pizarra + móviles de los alumnos]
  E --> I[Tarea · para casa]
  H --> J[Elijo el bucle: rondas · carrera · tablero · pedir la palabra]
  J --> K[PIN y QR · los alumnos entran con apodo]
  K --> L[Se juega]
  L --> M[Podio + tabla + CSV]
  I --> N[Entregas + informe por intento]
  M --> O[/¿Cómo va MI CLASE este trimestre?/]
  N --> O
  O --> P([Hoy el viaje se acaba aquí])

  style O fill:#fdeaea,stroke:#ef4444,stroke-width:2px
  style P fill:#fdeaea,stroke:#ef4444,stroke-width:2px
```

**El hueco, dicho claro**: el viaje termina en el informe de UNA partida. El
profe ve cómo fue *esa* sesión, pero no cómo va *su clase*, porque el sistema no
sabe quién es "Juan": cada partida crea apodos nuevos y desechables (R3).

**DECISIÓN: se pospone a propósito** (no es un olvido). Daría muchísimo al
docente —vería el avance DURANTE el curso y no solo al acabar la actividad— pero
toda solución conocida tiene un coste que choca con el norte:

- **Cuentas para el alumno** → choca con R3 y con "no somos un LMS" (§4).
- **Contraseñas** → el profe acaba creándolas, actualizándolas y recordándolas:
  choca con R2 ("el profe no configura nada").
- **Huella del dispositivo** como sustituto de la contraseña ("se abrió en el
  equipo de Juan", marcar como sospechoso si cambia) → hay que estudiarlo con
  cuidado: si Juan presta su móvil para una tarea, el uso es legítimo. Y una
  línea roja: **el docente NO debe ver marca ni modelo del aparato del alumno**.
- **Delegarlo a Classroom** no resuelve: tampoco lo gestiona bien.

La forma que más se acerca al norte (a estudiar, no decidida): el profe crea sus
salones (*5.º A*, con su lista de 30 nombres), y el alumno entra **con el código
del profe y elige su nombre de la lista, sin contraseña** — la identidad la pone
el aula, no el sistema.

Antes de tocar código hace falta **ver cómo lo resuelven otras apps** y comparar
opciones por impacto. Queda al FINAL de la cola, con estudio propio pendiente
(`docs/decisiones-pendientes.md` D1). Y conviene saber lo que arrastra: el
PIN/NFC de pizarras (U2-U4) y los informes por alumno dependen de esta pieza.

## 8. LA COLA, DERIVADA DEL NORTE (no de la inercia)

Cada posición cita su origen. Si algo no puede citarlo, no está en la cola: está
en "ideas".

| # | Qué | Se desprende de | Por qué ahí |
|---|---|---|---|
| **1** | **Cubrir "buscar/crear"**: la home, la biblioteca y el editor | §1 (por ahí pasa TODA clase) + la medición 0,29 | Es el tramo más usado y el menos protegido. Si el editor rompe la clave de una actividad, el profe lo descubre con 33 críos delante |
| **2** | **La ley que falta para R2** ("el profe no configura nada") | §6b, hueco declarado | Sin ella, cada pantalla nueva decide por su cuenta cuántos ajustes enseña — y eso es justo lo que hace que Wordwall canse |
| **3** | **Cubrir las mecánicas en pizarra** (Individual · VS · Equipos) | §1 ("lo habitual") + medición 0,47 y 0,17 | Es donde se juega de verdad. Las 13 plantillas tienen el ratio de test más bajo del repo |
| **4** | Terminar la ficha 2b de live (ventana de lectura en carrera · dial del lobby) | §26 + estudio D7 | Sigue siendo correcto, pero sirve al modo minoritario: va DESPUÉS de lo de arriba |
| **5** | Partir `views/hostLive.js` (1031 líneas) | §23 + "candidatos a partir" del mapa | Mismo motivo que el 4: es deuda real, pero de la zona menos usada |
| **6** | **D1 · identidad del alumno**, con estudio propio previo | §7 (el viaje se corta ahí) · R2 · R3 · §4 | Cierra el viaje y desbloquea 3 cosas, pero toda solución conocida choca con el norte: primero se estudia cómo lo resuelven otros |
| **7** | **Unificar el vocabulario en la UI** (§6e) | §6e, medido: sala/sesión/partida conviven | Barato y se nota: el profe aprende UN nombre. Se hace de paso al tocar cada pantalla, no como obra aparte |
| **8** | D3 imprimible · D5 taxonomía · D2 duplicar como otra plantilla | `decisiones-pendientes.md` | Módulos que se pueden añadir después sin rediseñar nada |

**Fuera de la cola, y a propósito**: R7 (privacidad de menores) no es una tarea
sino un filtro permanente — se aplica a todo lo que entre. Si alguna función
futura pide datos del alumno "porque son útiles", esa es la conversación.

> **Lo que cambió al escribir el norte**: la ficha 2b y partir `hostLive` estaban
> arriba por inercia (era lo que teníamos entre manos). Al derivar la cola de la
> escena, bajan al 4 y al 5. No porque estén mal, sino porque sirven al modo que
> solo usan algunos colegios.

## 9. Cómo se relaciona con el resto de la documentación

| Documento | Responde a |
|---|---|
| **este** | qué construimos, para quién, y cómo se decide |
| `docs/leyes.md` | cómo se construye (8 leyes, cada una con su test) |
| `docs/arquitectura-modulos.md` | cómo está montado HOY (generado del código) |
| `docs/modos-de-juego.md` | el contrato de los 5 modos y los 4 bucles |
| `docs/decisiones-pendientes.md` | qué está sin decidir, y la recomendación |
| `docs/estudio-bucles-live.md` | por qué el vivo es como es (estudio medido) |
