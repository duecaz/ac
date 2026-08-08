# El reloj de CADA aparato — diagnóstico de los dos fallos de la ronda del compañero

> Estado: **✅ ARREGLADO Y VIGILADO** (v1.51.418). El diagnóstico de abajo se
> conserva entero porque es el "por qué se nos dio": lo que enseñó este fallo
> vale más que el fallo. Lo ejecutado, al final del documento.

## Lo que reportó el compañero (rondas juntas, PC + Android)

1. *"¿Se abren las respuestas solas al terminar esa espera? **No, sale (sin
   respuesta) + 0 puntos**"*.
2. *"El tiempo de preparación es diferente: en PC 10 s y en el Android 20 s"*.

Parecían dos cosas. **Son la misma**, y la segunda explica la primera.

## La causa, reproducida

Abrir una pregunta escribe en la sala DOS INSTANTES absolutos
(`views/hostLive.js openQuestion`): `answers_open_at` y `deadline`. Los estampa
`clock.now()` — **el reloj del aparato del PROFESOR**. El móvil del alumno los
compara contra **su propio** `clock.now()` (`views/studentLive.js`:
`reading = openAtMs > clock.now()`).

Nada mide el desfase entre los dos relojes. Si el Android va 10 s atrasado, la
resta da 10 s de más, y ese error se cuela entero en la cuenta atrás de lectura,
en la barra de tiempo y en el momento en que el móvil se deja tocar.

Sonda headless con dos pantallas y el reloj del móvil desplazado a propósito
(lectura configurada 10 s, ventana de respuesta 20 s):

| Desfase del móvil | Qué ve el profe | Qué ve el alumno | Consecuencia |
|---|---|---|---|
| **−10 s** (atrasado) | `Preparados… 9` | `Preparados… 19` | **Exactamente el reporte del compañero** (10 vs 20) |
| **−25 s** | pregunta abierta y luego liquidada | nunca se abren las respuestas | **"sin respuesta · 0 puntos"** — el fallo 1 |
| **+10 s** (adelantado) | `Preparados… 9` | responde **al instante** | La ventana de lectura (R-1) **no existe**: premia al que clica sin leer, que es justo lo que vino a impedir |

El desfase no es un caso raro de laboratorio: un Android con la hora automática
apagada, un portátil de aula que lleva meses sin sincronizar o una pizarra sin
NTP lo producen solos. **En un aula lo normal es que los relojes NO coincidan.**

## Clasificación

| | |
|---|---|
| **Tipo** | Bug de **acuerdo entre aparatos**, no de lógica. Cada pieza es correcta por separado; lo que falla es que dan por hecho un reloj común |
| **Gravedad** | **Alta**: se come respuestas del alumno (0 puntos por algo que no hizo mal) y anula una regla de juego (R-1) sin avisar |
| **Silencioso** | Sí. No hay error, ni pantalla roja, ni nada en el log: el alumno cree que tardó y el profe cree que no respondió |
| **Ley que lo cubre a medias** | **§22 · CONFIANZA**. §22-1 ya dice que *el tiempo que puntúa lo mide el SERVIDOR* y lo resolvió para el bonus (`core/serverMs.js` deriva el `ms` de los autodate). Pero solo miró la PUNTUACIÓN. El **gateo** —cuándo el móvil se deja tocar— siguió usando el reloj del aparato |
| **Alcance** | Rondas juntas (lectura + cierre), y en menor medida cualquier pantalla que compare contra un instante de la sala: la barra de cuenta atrás y el cronómetro de carrera |

## Por qué NINGUNA de las seis redes lo vio

**Porque todas corren en una sola máquina, con un solo reloj.** `live-smoke`
abre host y alumno en dos pestañas **del mismo navegador**: desfase exacto = 0.
Es un punto ciego estructural, no un descuido: la red está bien escrita y jamás
podría haberlo encontrado.

Y es una FAMILIA, no un caso: todo lo que **difiere entre aparatos** nos es
invisible hoy — reloj, zona horaria, velocidad de red, suspensión del móvil,
tamaño de pantalla real. El reloj es el primero que sale porque decide puntos.

## Lo que nos falta (esto es lo que el fallo nos está diciendo)

1. **Una hora común, y que la ponga el servidor.** El cliente debe medir su
   desfase (`offset = hora del servidor − hora del aparato`) y usar
   `serverNow()` en TODO lo que se compare contra un instante de la sala.
   PocketBase da dos fuentes: la cabecera `Date` de cualquier respuesta y los
   autodate (`updated`) de la fila de la sala. El profesor **también** es un
   cliente: sus instantes deberían nacer con esa corrección.
2. **Cinturón, además de tirantes.** Aunque el desfase se corrija, nada debería
   dejar al alumno encerrado en "Preparados…": si el instante de apertura ya
   pasó, se abre; y una cuenta atrás de lectura nunca puede ser mayor que la
   configurada. Hoy no hay tope de cordura: el móvil pintó `Preparados… 34`
   sobre una lectura de 10 s y nadie chistó.
3. **Una red que pueda ver lo que difiere entre aparatos.** La sonda de este
   diagnóstico (`scratchpad/skew-probe.mjs`) ya lo hace: mismo recorrido con el
   reloj del alumno desplazado. Convertirla en caso de `live-smoke` cierra el
   punto ciego para siempre.
4. **§22 se queda corta y hay que ampliarla**: *"el veredicto lo pone el
   servidor"* tiene que incluir **el tiempo con el que el cliente se GATEA**, no
   solo el que puntúa. Con su contra-prueba: con el reloj movido, el alumno debe
   seguir viendo la misma cuenta atrás que el profe.

## Lo aprendido de la ronda (v1.51.417) — y el plan de arriba, MEJORADO

Releída la ronda completa del compañero como DATO, no solo como lista de ✅/❌,
salen tres lecciones y cuatro tests concretos. El plan de 4 puntos de arriba
sigue valiendo; esto lo reordena y le pone las aserciones exactas.

### Tres lecciones

1. **Todo lo que PASÓ tenía una red ejecutable detrás; lo único que FALLÓ era
   lo único que ninguna red podía ver.** Las 8 torturas pasaron — y 5 tienen
   suite directa (`raceResume` recargar a media carrera · `offlineQueue` modo
   avión · `liveJoin` entrar tarde · `live.test` apodo con emojis ·
   `liveEnd` terminar con uno solo) y las otras 3 red parcial (stability ·
   live-smoke · shots portrait). No es casualidad: es la confirmación más
   fuerte que tenemos de "si es norma, es test". Corolario: el testeo manual
   NO es para re-encontrar lo que las suites ya vigilan — es para descubrir
   FAMILIAS de puntos ciegos. Encontró una: *lo que difiere entre aparatos*.
2. **La sonda encontró en 3 minutos lo que la clase tardaría semanas en
   aislar** (¿quién sospecha del reloj del móvil?). Una sonda parametrizada
   (`SKEW=±ms`) vale más que diez pruebas manuales del mismo tramo: se queda
   como herramienta, no como anécdota.
3. **El formato de la guía funcionó**: preguntas cerradas con el número
   esperado («¿en PC 10 y en el móvil 20?») hicieron que el compañero
   reportara EL DATO EXACTO que reproducía el bug. Mantener ese formato en
   futuras rondas; una pregunta abierta habría devuelto "va raro".

### Cuatro tests que salen de la ronda

- **T1 · PARIDAD de cuenta atrás** (la aserción correcta, que la sonda aún no
  hace): con desfase ±10/±25 s, host y alumno muestran **el mismo
  «Preparados… N» (±1)** y las respuestas se abren tras ~los segundos
  configurados de espera REAL. "Se abre" no basta: con +10 s se abría… al
  instante, y eso también es fallo.
- **T2 · TOPE de cordura** (unit, Node, sin navegador): la cuenta de lectura
  pintada nunca supera los `readSeconds` configurados; si `answers_open_at` ya
  pasó, la ronda es jugable. Es el cinturón del punto 2, escrito como test
  ANTES de escribir el cinturón.
- **T3 · `serverNow()`** (unit): el offset se deriva de una cabecera `Date`
  simulada y se aplica; **contra-prueba**: con offset 0 todo se comporta
  EXACTAMENTE como hoy (que es el caso de las seis redes actuales).
- **T4 · el PROFE también es un cliente**: los instantes que estampa
  `openQuestion` nacen corregidos — si solo se corrige el alumno, un host con
  el reloj mal puesto rompe a TODA la clase a la vez.

### El plan, reordenado (rojo primero, cinturón antes que cirugía)

| # | Qué | Por qué en este orden |
|---|---|---|
| **0** | La sonda entra en `live-smoke` como caso que HOY FALLA (T1) | Rojo primero: el arreglo de después tiene su contra-prueba desde el minuto cero, y el punto ciego "una máquina, un reloj" queda cerrado para siempre |
| **1** | Cinturón: topes de cordura (T2) | Barato y sin riesgo: corta YA la pérdida de respuestas («sin respuesta · 0 puntos») aunque la corrección de reloj tarde. Un aparato desfasado jugará con la ventana algo movida, pero JUGARÁ |
| **2** | `serverNow()` con dueño único (`core/serverNow.js`, junto a `serverMs`): offset = mediana de varias muestras de la cabecera `Date` de PocketBase, re-muestreado en cada respuesta (un móvil que SUSPENDE deriva; medirlo una vez no basta) (T3) | Es la corrección de verdad. R7: el offset es dato del aparato — vive en memoria, no se persiste ni viaja al profe |
| **3** | Aplicarlo en los gateos de alumno **y de host** (T4) y ampliar §22: «el veredicto del servidor incluye el tiempo con el que el cliente SE GATEA, no solo el que puntúa» | La ley al final, cuando ya es test — como §29 y §30 |

### Qué NO haremos, y por qué (para no sobre-reaccionar)

- **No** vamos a sincronizar relojes en VS/Equipos/Individual: son UNA
  pantalla, no hay segundo reloj. El problema es exclusivo de "dos aparatos
  mirando la misma sala".
- **No** hace falta NTP ni nada exótico: una mediana de la cabecera `Date`
  con precisión de ±1-2 s sobra — las ventanas son de 10-300 s.
- **El resto de la familia** (red lenta, suspensión, pantalla real) queda
  ANOTADA como familia en la cola, no abierta ahora: el reloj era el único
  que decide puntos.

## Lo demás del reporte

- **Todo lo de carrera** (podio, hora de meta, orden por tiempo, misma
  puntuación, barras del podio, columna Meta, CSV) ✅.
- **Las 8 torturas** ✅ — recargar a media carrera, modo avión, pantalla
  bloqueada, tercer móvil entrando tarde, recargar el host, girar, nombre con
  emojis, terminar con uno solo. Es la parte que más trabajo llevó y aguantó.
- **VS y Equipos** ✅, incluido que el duelo de Quiz espera a los dos.
- **Tarea** ✅, incluido el tope de intentos.
- **Observación de vocabulario del compañero**: desde el panel del profe, el
  botón dice **"Intentos"** y él esperaba algo como *"revisar informes o
  tareas"*. No es un fallo: es que el nombre no dice a dónde lleva. Va al mismo
  saco que §6e (una cosa, un nombre) y se decide, no se parchea.


---

## LO EJECUTADO (v1.51.418) — los cuatro pasos del plan

Orden real: **rojo primero, cinturón antes que cirugía**.

**0 · La red, en rojo.** `tools/live-smoke.mjs` gana una tercera pasada con un
alumno cuyo reloj está desplazado a propósito (±25 s / +10 s), en tres casos:
CON hora de servidor (paridad) y SIN ella (cinturón). Antes de arreglar nada se
comprobó que **falla**, y falla con el fallo de aula exacto:
`§22-5: desfase -25s → el profe ve «Preparados… 6» y el alumno «31»`.
El punto ciego "una máquina, un reloj" queda cerrado.

**1 · El cinturón** — `core/liveGate.js` (`questionGate`, puro): la espera de
lectura se ACOTA a la ventana declarada y una pregunta ya cerrada no hace leer a
nadie. Con el reloj torcido se puede empezar tarde; quedarse fuera, no. Añadido
al aplicarlo: `studentLive` recuerda **por ítem** que ya cumplió su lectura — sin
eso, un reloj muy desfasado repetía la espera acotada una y otra vez (el mismo
fallo disfrazado de cuentas atrás cortas). Test: `tests/liveGate.test.mjs` (5).

**2 · La hora común** — `core/serverNow.js`: cada aparato mide su desfase con la
cabecera `Date` de PocketBase, guarda la MEDIANA de las últimas 5 muestras y la
re-mide en CADA respuesta (un móvil que suspende deriva). Se toma en
`core/pbHttp.js`, puerta única del tráfico PB. Sin servidor → desfase 0 → todo
igual que antes. R7: en memoria, no se persiste, no viaja al profe. Test:
`tests/serverNow.test.mjs` (7, incluido el CABLEADO con `fetch` inyectado y la
contra-prueba de "sin muestras, exactamente como hoy").

**3 · Aplicado a los dos lados + ley.** `studentLive` y `hostLive` comparan y
SELLAN con `serverNow()` — el profe también es un cliente. Los dos relojes de
`core/deadlineTicker.js` también. Ley **§22-5** escrita en `docs/leyes.md`, con
la regla ejecutable **`reloj-sala`** (`core/normsCheck.js`): un instante de la
sala en la misma línea que el reloj del aparato rompe CI, con contra-prueba de
que un aparato midiendo SU propia duración (modo Individual) sigue siendo
legítimo.

### Lo que el compañero debería ver ahora
Repetir el PASO 5 de la guía con los dos aparatos **sin tocarles la hora**: la
cuenta de «Preparados…» tiene que ser la MISMA en el PC y en el móvil, y ninguna
respuesta puede acabar como «sin respuesta · 0 puntos». Si su Android sigue con
la hora automática apagada, ahora da igual: es justo el caso que se arregló.
