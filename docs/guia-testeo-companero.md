# Guía de testeo — paso a paso (no hace falta saber de informática)

> **Qué es esto.** AulaReto (aulareto.com) es una web para hacer actividades en
> clase. Tú vas a usarla como lo haría un profe y sus alumnos, y a **anotar todo
> lo que se vea raro**. No puedes romper nada: si algo falla, ese es justo el
> resultado que buscamos.

**Qué necesitas**
- Un ordenador (será la pizarra / el profesor).
- **Dos móviles** (serán dos alumnos). Valen los de dos personas.
- Todos en internet. No hace falta que sea la misma wifi.
- 40-60 minutos.

**Cómo anotar los fallos.** Al final de esta guía hay una plantilla. Lo
importante de cada fallo: **el número de versión**, qué esperabas, qué pasó, y
una foto de la pantalla.

---

## PASO 0 — ACTUALIZAR FUERTE (no te lo saltes)

El navegador guarda copias viejas de la web. Si no lo obligas a bajar la nueva,
**vas a probar la versión de ayer** y los fallos que reportes ya estarán
arreglados. Esto es lo más importante de toda la guía.

**En el ordenador:**
1. Abre **aulareto.com**.
2. Pulsa **`Ctrl` + `F5`** (las dos teclas a la vez). En Mac: `Cmd` + `Shift` + `R`.
3. Hazlo **dos veces**, por si acaso.

**En cada móvil:**
1. Abre **aulareto.com**.
2. Cierra la pestaña del todo y vuelve a abrirla.
3. Si sospechas que sigue vieja: ajustes del navegador → *Borrar datos de
   navegación* → *Imágenes y archivos en caché* → recarga.

### Comprobar la versión (obligatorio)

Arriba, en la barra oscura, hay una etiqueta pequeña con un número tipo
**`v1.51.359`**. En el móvil puede estar dentro del menú de las tres rayas (☰).

- **Tiene que poner `1.51.359` o un número MAYOR.**
- Si pone menos, repite el Paso 0. Si sigue igual, prueba en modo incógnito.

> ✍️ **Apunta aquí la versión que ves en cada aparato**, y ponla en cada fallo
> que reportes: `ordenador ______ · móvil 1 ______ · móvil 2 ______`

### 🆕 El reporte de UN TOQUE (desde v1.51.394)

Cuando algo falle, **toca esa misma etiqueta de versión**: se copia solo al
portapapeles un reporte con la versión, la pantalla exacta donde estabas y los
últimos errores que la app registró por dentro (esos que "salen un segundo y
desaparecen"). Pégalo tal cual en el chat y añade una frase con lo que estabas
haciendo. Con eso el fallo se puede reproducir a la primera — sin el reporte,
toca adivinar. No lleva ningún dato de alumnos ni del aparato.

---

## PASO 1 — Entrar como profesor (solo en el ordenador)

1. Arriba a la derecha, **Entrar** → inicia sesión con la cuenta de Google del
   profe (o con el correo y clave que te hayan dado).
2. Debes acabar en **"Mis actividades"**.

**Mira y anota:**
- ¿Se ve bien la página, sin textos encima de otros ni botones cortados?
- Los **alumnos NO necesitan cuenta**. Los móviles se quedan sin iniciar sesión.

---

## PASO 2 — Crear la actividad de prueba

1. Botón **Nueva** → elige **Quiz** (preguntas con opciones).
2. Ponle de título: **Prueba de <tu nombre>**.
3. Escribe **5 preguntas** fáciles (2+2, capital de Perú…). En cada una, marca
   **cuál es la respuesta correcta**.
4. **Guarda**.

**Mira y anota:**
- Al escribir una pregunta o cambiar el texto de una opción, ¿aparece algún
  **aviso rojo** diciendo que falta marcar la respuesta correcta? Si aparece
  cuando SÍ la marcaste, eso es un fallo — apúntalo.
- Vuelve a "Mis actividades": la tarjeta de tu actividad, ¿tiene un dibujito de
  vista previa? ¿El título correcto?

---

## PASO 3 — Jugar tú solo (modo Individual)

1. Abre tu actividad → **Individual** → **Iniciar**.
2. Responde las 5, **fallando una a propósito**.

**Mira y anota:**
- Antes de empezar, ¿sale una pantalla con el título y las instrucciones?
- Al acertar, ¿se pone verde? Al fallar, ¿rojo?
- Al terminar, ¿sale tu puntuación como **"X / 5"**?
- ¿Se ve bien todo sin tener que hacer zoom ni desplazar la pantalla a los lados?

---

## PASO 4 — EN VIVO · **CARRERA LIBRE** ⭐ (lo más importante de esta ronda)

Aquí cada alumno va **a su ritmo**. La regla del juego es:

> **Gana quien termina primero con TODAS bien.**
> Si fallas una, esa pregunta **vuelve a la cola** y te la volverá a poner hasta
> que la aciertes. Por eso todos los que terminan, terminan con todas bien: lo
> que decide el ganador es **el tiempo**.

### 4.1 Abrir la sala (ordenador)

1. Tu actividad → **En vivo**.
2. Verás dos preguntas. En la primera, elige **"Carrera libre"**.
3. En la segunda, elige cómo termina: deja **"Terminan todos"**.
4. Aparece un **PIN** (una palabra, tipo `CASA`) y un código QR.

### 4.2 Entrar con los móviles

1. En cada móvil: **aulareto.com** → **Soy alumno / Entrar con PIN**.
2. Escribe el PIN y un **nombre distinto** en cada móvil (p. ej. `Ana` y `Luis`).
3. En el ordenador deben aparecer los dos nombres en la lista.

> 🔎 **Prueba extra:** pon el MISMO nombre en los dos móviles. La app debe
> resolverlo sola (uno quedará como `Ana 2` o similar). No debe dar error ni
> dejar a nadie fuera.

### 4.3 Correr

1. En el ordenador, pulsa **Empezar**.
2. **Móvil 1 (`Ana`)**: responde **todo bien y rápido**.
3. **Móvil 2 (`Luis`)**: **falla las dos primeras a propósito**, y luego ve
   acertándolo todo **despacio**.

**Mira y anota, mientras juegan:**
- En el ordenador hay un **cronómetro** arriba: ¿avanza solo, segundo a segundo?
- Cada alumno tiene una **barra que crece**. ¿Crece al responder bien?
- La lista, ¿muestra **avance** (cuántas lleva) y **no** un ranking de puestos?
  *Durante el juego es a propósito: no queremos a nadie proyectado como último.*
- En el móvil de `Luis`: al fallar, ¿esa pregunta **vuelve a aparecer** más
  tarde? Debe volver.
- ¿Aparece la misma pregunta dos veces seguidas sin haberla fallado? Eso sería
  un fallo.

### 4.4 El final y el podio ⭐

1. Cuando los dos terminen (o pulsa **Terminar carrera** en el ordenador).
2. En cada móvil debe salir **"¡Terminaste!"** con **`5 / 5 correctas`** y
   **un tiempo** (p. ej. `1:12`).

**Mira y anota — esto es lo nuevo, míralo con calma:**
- En el ordenador sale el **podio**. Debajo de los puntos de cada uno hay una
  **hora de meta** tipo **`0:47`**. ¿Está?
- **¿Ganó quien terminó antes?** Los dos tienen 5 de 5, así que el orden lo
  tiene que decidir el tiempo. `Ana` (rápida) debe ir **por delante** de `Luis`
  (lento), aunque los dos acabaran con todas bien.
- Los dos, ¿tienen la **misma puntuación** (5)? En carrera es correcto: el
  puntaje son los aciertos, no la velocidad.
- Las tres barras del podio, ¿están a **alturas distintas** (1.º, 2.º, 3.º)?
  Si salen todas iguales y con el mismo número de puesto, es un fallo.
- Pestaña **Tabla**: ¿hay una columna **Meta** con los tiempos?
- Botón **Exportar CSV**: descárgalo y ábrelo. ¿Trae una columna `meta`?

> ⚠️ **El fallo más importante que buscamos aquí:** que gane quien NO debería.
> Si el que terminó **más tarde** aparece primero, o si el tiempo del podio no
> se parece a lo que tardó de verdad, **apúntalo con foto**.

---

## PASO 5 — EN VIVO · **RONDAS JUNTAS** (toda la clase en la misma pregunta)

1. Vuelve a **En vivo** → esta vez elige **"Rondas juntas"** → **Empezar**.
2. Entra otra vez con los dos móviles (PIN nuevo).

**Mira y anota:**
- Al abrirse cada pregunta: durante unos segundos **se ve la pregunta pero no se
  puede tocar** (es la ventana de lectura, a propósito). ¿Pasa?
- ¿Se abren las respuestas **solas** al terminar esa espera?
- Hay una **cuenta atrás**. ¿Baja bien y llega a `0:00` sin quedarse colgada?
- Aquí **sí** hay bonus por rapidez: el que responde antes debe sacar **más
  puntos** que el que responde tarde, aunque los dos acierten. ¿Ocurre?
- Entre pregunta y pregunta, en el móvil sale **tu puesto** y a cuánto estás del
  de delante. ¿Cuadra con lo que muestra el ordenador?
- Al terminar, podio y **Tabla**: los números del podio y los de la tabla,
  ¿**coinciden**? (Si no coinciden, es un fallo gordo — apúntalo.)

---

## PASO 6 — VS (duelo) y Equipos, en el ordenador

1. Tu actividad → **VS (duelo)**. Juega los dos lados tú mismo.
2. Luego → **Equipos**.

**Mira y anota:**
- ¿Se ven bien los dos lados, sin cortarse?
- En el Quiz, el duelo debe esperar a que **ambos** terminen y gana quien más
  puntos. ¿Uno corta al otro antes de tiempo?
- Prueba a cambiar el **skin** (aspecto) si hay botón: ¿se lee todo bien, sin
  texto del mismo color que el fondo?

---

## PASO 7 — Tarea (para casa)

1. En la actividad → **Tarea** → créala.
2. Copia el enlace o el código y ábrelo **en un móvil**.
3. Complétala y entrégala.
4. En el ordenador, mira el informe de la tarea.

**Mira y anota:**
- ¿Aparece tu intento con la nota?
- Vuelve a abrir la tarea con el mismo móvil: si solo hay **1 intento
  permitido**, debe decírtelo claramente y **no** dejarte jugar otra vez.

---

## PASO 8 — Torturas (romper a propósito)

Haz cada una y anota qué pasa. **No** deberían perderse respuestas ni salir
pantallas en blanco o rojas.

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | En mitad de una carrera, **recarga** el móvil (deslizar hacia abajo) | Vuelves donde estabas; **no** te repite las que ya acertaste |
| 2 | Pon el móvil en **modo avión** 10 segundos mientras respondes, y quítalo | La respuesta debe acabar llegando sola |
| 3 | **Bloquea la pantalla** del móvil un minuto y vuelve | Sigue la partida, no se queda colgado |
| 4 | Entra con un **tercer** móvil **a mitad** de la carrera | Debe poder entrar y empezar |
| 5 | En el ordenador, **recarga** durante la partida | La sala sigue viva, con los mismos alumnos |
| 6 | Gira los móviles (vertical ↔ horizontal) | Todo se recoloca, nada se corta |
| 7 | Escribe un nombre de alumno con **emojis o símbolos raros** | O lo acepta o lo rechaza con un mensaje claro; nunca se rompe |
| 8 | Pulsa **Terminar carrera** cuando solo uno ha acabado | Se cierra bien y el podio sale con los dos |

---

## PASO 9 — Cómo reportarlo

Copia esta plantilla por cada fallo:

```
FALLO Nº:
Versión que salía en pantalla:      (p. ej. 1.51.359)
Aparato:                            (ordenador Windows / iPhone / Android)
Dónde:                              (paso 4.4, podio de la carrera)
Qué hice:                           (Ana terminó a los 47 s, Luis a 1:20)
Qué esperaba:                       (que Ana saliera primera)
Qué pasó de verdad:                 (salió primero Luis)
PIN de la sala (si era en vivo):
Foto de la pantalla:                (adjunta)
```

**Manda también los aciertos**: "el paso 5 funcionó perfecto" también sirve, así
sabemos qué está sano.

---

## Lo que buscamos con más ganas (resumen de una línea)

1. **En la carrera, que gane quien terminó antes con todas bien** — y que el
   podio **diga** su tiempo.
2. Que **una pregunta fallada vuelva a la cola** y no puedas acabar con fallos.
3. Que **el podio y la tabla digan lo mismo**.
4. Que **nada se pierda** al recargar, al quedarse sin cobertura o al bloquear
   el móvil.
5. Que **todo se lea** en un móvil, sin zoom y sin texto cortado.

Gracias 🙌 — cada fallo que anotes es uno que no pasará con la clase delante.
