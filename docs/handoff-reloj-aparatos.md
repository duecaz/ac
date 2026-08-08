# El reloj de CADA aparato — diagnóstico de los dos fallos de la ronda del compañero

> Estado: **CAUSA CONFIRMADA, sin arreglar todavía** (v1.51.416). Este documento
> es el "por qué se nos dio" que pidió el usuario antes de tocar nada.

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
