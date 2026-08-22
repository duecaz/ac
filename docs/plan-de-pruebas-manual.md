# Plan de pruebas manual — mapa completo para el tester

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> **Para quién**: el compañero que va a probar los juegos en **aulareto.com**, sin
> necesidad de saber programar. **Qué es**: el recorrido completo de la app, en
> orden, con lo que debe pasar en cada paso y lo que sería un bug.
>
> Lo que una máquina ya vigila (que cada juego ARRANQUE en cada modo, que el motor
> puntúe bien) está cubierto por tests automáticos en cada commit. **Tu valor está en
> lo que la máquina no ve**: que se SIENTA bien, que se lea, que un niño lo entienda,
> que funcione con dedos en una pantalla táctil de verdad.

## Cómo reportar un bug (léelo primero)

Cada bug que apuntes debe llevar estas 5 cosas — sin ellas no se puede reproducir:

1. **Dónde**: juego + modo (ej.: "Emparejar · VS") y pantalla (inicio/jugando/resultado).
2. **Dispositivo**: móvil/tablet/PC/pizarra + vertical u horizontal.
3. **Qué hiciste**: los 2-3 pasos justo antes.
4. **Qué pasó vs. qué esperabas**.
5. **Captura o video** (en móvil: grabar pantalla vale oro).

La **versión** de la app sale abajo en la barra (ej. `v1.51.328`) — inclúyela.
Truco: si algo se ve raro, prueba primero **Ctrl+F5** (recarga dura). Si se arregla,
repórtalo igual como "necesitó recarga dura".

---

## 0 · Preparación (5 min)

| Necesitas | Para qué |
|---|---|
| PC o portátil | hacer de PROFESOR (crear, lanzar en vivo) |
| Móvil (el tuyo) | hacer de ALUMNO (PIN, tareas) — a ser posible en datos móviles, no wifi |
| Segunda ventana en incógnito | hacer de segundo alumno |

- El profesor **inicia sesión** (Google) en aulareto.com.
- El alumno **NUNCA inicia sesión**: todo lo del alumno debe funcionar sin cuenta.
  **Si en algún momento a un alumno se le pide cuenta o contraseña, eso ES un bug.**

---

## 1 · La biblioteca pública, como VISITANTE (15 min)

Abre aulareto.com en incógnito (sin sesión). Debes poder:

- [ ] Ver la portada con actividades destacadas y entrar a **Explorar**.
- [ ] Abrir cualquier actividad pública y jugarla en **Individual** completa.
- [ ] Jugar **VS** y **Equipos** en la misma pantalla (dos personas, un teclado/táctil).
- [ ] Ver los botones **En vivo** y **Tarea** con **candado 🔒** — al pulsarlos debe
      salir un aviso claro tipo *"Inicia sesión para crear una sala en vivo"* y ofrecer
      entrar. **Bug si**: navega a una pantalla rota, o el botón no está, o falla sin explicar.
- [ ] Ver el perfil de un autor (clic en "por X" en una tarjeta).

---

## 2 · Los 13 juegos en INDIVIDUAL (60-90 min — el bloque gordo)

Para cada juego: juega una partida **completa** (hasta la pantalla de resultado), una vez
en PC y otra en el móvil **en vertical**. Fíjate en:

- La pantalla de inicio explica cómo se juega (frase de instrucciones).
- Nada se corta ni se desborda: textos, botones, tarjetas. Ni en 4K ni en un móvil estrecho.
- El resultado final muestra puntos con techo ("X / Y") y ese número es coherente con lo que hiciste.
- **F5 a mitad de partida**: en Individual debe **reanudar** donde ibas (no en Tarea: ahí reinicia, y es correcto).

| # | Juego | Qué probar específicamente | Ojo con |
|---|---|---|---|
| 1 | **Quiz** | responder bien, mal, y dejar agotar el tiempo | el timer por pregunta; imágenes en opciones |
| 2 | **Operaciones** | teclado numérico; borrar; enviar con respuesta vacía | que las teclas se toquen bien con el dedo; tamaño en vertical |
| 3 | **Emparejar** | arrastrar cuerdas L↔R; deshacer un enlace; corregir | **en vertical**: que la cuerda se dibuje y conecte (bug histórico aquí) |
| 4 | **Memoria** | voltear parejas; fallar mucho | que dos cartas falladas se vean un instante antes de taparse |
| 5 | **Tildes** | marcar letras; marcar DE MÁS a propósito | marcar todo NO debe dar puntos (neto: aciertos − de más) |
| 6 | **Comas** | igual que Tildes con comas | ídem |
| 7 | **Sopa de Letras** | seleccionar palabras en todas las direcciones | selección con el dedo (no solo ratón); palabra fallida destella |
| 8 | **Crucigrama** | teclear; moverse entre casillas; terminar | teclado en pantalla del móvil no debe tapar la casilla activa |
| 9 | **Explota Globos** | tocar los globos correctos | ritmo jugable en un móvil modesto |
| 10 | **Ordena las Pelotas** | resolver el tablero; deshacer | que no se pueda "romper" el tablero con toques rápidos |
| 11 | **Etiqueta el diagrama** | arrastrar etiquetas a los pines de la imagen | precisión táctil; imagen que escala sin deformarse |
| 12 | **Ruleta** | girar; que salga cada entrada | es herramienta del profe (sin puntos automáticos) |
| 13 | **Abre Cajas** | abrir cajas / ruleta de números | ídem: lo puntúa el profe |

**Extra por juego (5 min al final)**: cambia el **tema/skin** (Espacio, Arcade, TV-show…)
y el **fondo** desde la página de la actividad → nada debe quedar ilegible (texto claro
sobre fondo claro = bug). En VS prueba los 3 skins con Operaciones.

---

## 3 · VS y EQUIPOS en una pantalla (30 min)

En PC o tablet grande (esto simula la pizarra del aula):

- [ ] **VS** con Operaciones → es **carrera**: el primero que termina gana y CIERRA la partida.
- [ ] **VS** con Quiz o Tildes → es **por puntos**: espera a que AMBOS terminen; el rápido NO corta al lento. **Bug si el primero en acabar le roba la partida al otro.**
- [ ] **Equipos** con Quiz (turnos) y con Memoria (tablero por turnos).
- [ ] Gira la tablet a vertical en medio del duelo: todo debe recolocarse sin romperse.
- [ ] Cambiar de modo A MITAD de partida (botones de la barra de modos): lo anterior debe pararse limpio — sin sonidos fantasma ni pantallas que se pisan.

---

## 4 · EN VIVO — el flujo estrella (60 min, necesita los 2 dispositivos)

**Es la parte que MÁS ha cambiado (v1.51.343 → v1.51.350): prioridad nº 1.**
Cambió el ritmo del juego, el lobby, cuándo termina una partida y qué ve la
pizarra. Léete este cuadro antes de empezar, porque varias cosas "raras" son
ahora el comportamiento correcto:

| Antes | Ahora (correcto) |
|---|---|
| Pregunta y opciones salían a la vez | Primero **solo la pregunta** unos segundos ("Preparados… 3·2·1") y **el móvil no deja tocar**; luego se abren las respuestas |
| Un desplegable "Manual · Automático · Carrera" | **Dos preguntas**: "¿Cómo juega la clase?" y (solo en rondas) "¿Quién avanza?" + "Tiempo de lectura" |
| La carrera no terminaba nunca sola | Terminas tú **o** se cierra sola según "¿Cuándo termina?" |
| Carrera y tablero ordenaban por puntuación | Muestran **avance**, en orden fijo. La clasificación es del **podio** |
| Tras responder solo veías "+80 puntos" | También **tu puesto y a cuánto estás** del de arriba |

### 4a · Rondas (tipo un concurso) — con Quiz
1. PC (profe, con sesión): actividad → **En vivo** → sala con **PIN y QR**.
2. Móvil (alumno, SIN cuenta): entrar con el PIN y apodo → aparece en el lobby del PC.
3. Incógnito: entrar con **el mismo apodo** → debe entrar como "Nombre 2" (no expulsar al primero).
4. En el lobby, comprueba el bloque de ajustes:
   - "¿Cómo juega la clase?" ofrece **Rondas juntas** y **Carrera libre** (Quiz soporta ambas).
     **Bug** si aparece una opción que no tiene sentido para ese juego.
   - "Avanzar de pregunta": **Yo controlo** viene marcado por defecto.
   - "Tiempo de lectura": **3 s** por defecto.
   - **Mira que se LEA**: el texto de cada botón debe contrastar con su fondo.
5. Empezar. **LO NUEVO**: en el móvil sale la pregunta pero **no se puede tocar**
   durante ~3 s (dice "Preparados… 3, 2, 1"); en la pizarra se ve el enunciado
   **sin las opciones**. Al llegar a 0 se abren solas en los dos sitios.
   - **Bug** si se puede responder durante la cuenta atrás.
   - **Bug** si al abrirse las opciones el cronómetro ya empezó a correr antes.
6. Responde → "¡Respuesta enviada!". **BUG GRAVE si sale "El servidor no aceptó tu
   respuesta"** — anota el mensaje EXACTO.
7. Revelar → **en el móvil**, además de correcto/incorrecto y los puntos, debe salir
   tu **puesto y la distancia** ("2º de 5 · a 120 puntos de Ana", o "¡vas primero!").
8. Clasificación en la pizarra: los que suben o bajan llevan **flecha ▲▼** (desde la
   segunda pregunta; en la primera aún no hay con qué comparar).
9. Deja una pregunta SIN responder en un móvil → a ese le sale "Sin respuesta", **no** "Incorrecto".
10. **Prueba "Saltar pregunta"** (botón del profe): la siguiente pregunta también
    debe tener su cuenta atrás de lectura. **Bug** si se abre directa.
11. Termina → podio en el PC y pantalla de final en el móvil.

### 4a-bis · Tiempo POR pregunta (nuevo)
1. Edita el Quiz: en una pregunta, abre **Avanzado** → "Tiempo en vivo (s)" → pon **60**.
   Deja otra en blanco (hereda el de la actividad, 20 s).
2. Juega en vivo: la pregunta de 60 s debe **durar 60 s**, y la otra 20.
3. Con puntuación **un concurso**: responder **a la mitad** de su tiempo debe dar
   aproximadamente **los mismos puntos** en la de 20 y en la de 60. Lo que premia es
   ir rápido *para esa pregunta*, no que la pregunta sea corta.
4. El mismo campo existe en **Operaciones, Tildes y Comas**. Vacío = el de la actividad.

### 4b · Carrera libre — con Operaciones
1. En el lobby elige **Carrera libre**. Aparece **"¿Cuándo termina?"** con tres opciones.
2. Prueba **"Cuando todos terminen"**: con 2 alumnos, cuando el segundo acaba la
   partida **se cierra sola** y salta el podio. **Bug** si se queda esperando.
3. El primero en terminar debe ver **qué está esperando** ("Faltan 1 compañero por
   terminar"), no un "esperando…" mudo.
4. Prueba **"Tiempo límite"** con 1 minuto: la pizarra muestra "queda 0:45"
   descendiendo, el alumno que terminó ve **el mismo reloj**, y al llegar a 0 se
   cierra sola. **Bug** si los dos relojes no coinciden.
5. Prueba **"Los primeros N"** con N=1: en cuanto uno termine, cierra.
6. **La pizarra NO ordena por puntuación**: las barras van en orden fijo y nadie
   aparece "el último". **Bug** si se reordenan solas mientras juegan.
7. Fallar una pregunta la re-encola (vuelve a salir al final); corregirla debe contar.
8. **Recarga el móvil a mitad de carrera** → debe seguir donde iba, **sin repetir**
   lo que ya acertó.

### 4c · Tablero compartido — con Ordena las Pelotas
- La pizarra ve el tablero de cada alumno moviéndose casi en vivo (≤ ~2 s).
- Las celdas **no saltan de sitio** mientras alguien juega. **Bug** si se reordenan.
- También tiene "¿Cuándo termina?": pruébalo con "cuando todos terminen".

### 4d · Pedir la palabra — Abre Cajas / Ruleta
1. Un alumno pulsa su caja → al profe le sale quién pidió.
2. **Lo nuevo**: en la pizarra hay una tira con **todos los nombres**; los que **aún
   no han participado** salen destacados en ámbar, con el conteo arriba.
3. El profe da los puntos a mano. En el móvil debe decir **"¡Respuesta enviada! La
   valora tu profe"** — **bug si dice "Incorrecto"**.
4. **COMPRUEBA ESTO SÍ O SÍ** (era un bug gordo hasta v1.51.347): al **terminar**, el
   podio debe mostrar **los puntos que diste**. **Bug grave si sale todo a cero.**
5. En la tabla del informe esa pregunta sale como "—", no como fallo.

### 4e · Informe post-partida
- Al cerrar: pestañas de tabla por alumno (✓/✗/—), ranking y análisis por pregunta.
- Los **tiempos** deben ser creíbles (segundos de verdad, no todos 0.0 s).
- Exportar CSV y abrirlo.

### 4f · Torturas (cada una es un caso real de aula)
- Móvil: **bloquea la pantalla 20 s** en plena pregunta y desbloquea → se recupera solo.
- Móvil: **modo avión**, responde, desactiva → "se enviará al reconectar" y al volver la red, llega.
- Móvil: **cierra el navegador** y vuelve a entrar con el PIN → reconecta y puede seguir.
- Móvil: **entra TARDE**, a mitad de una pregunta → debe ver el tiempo que queda de
  verdad (menos que los demás), no una ventana nueva completa.
- PC: **F5 al profe** en plena partida → vuelve a la sala y puede seguir dirigiendo.
  En carrera con tiempo límite, el reloj debe seguir en su sitio (no reiniciarse).
- Móvil: si sale **"Actualizando a la versión del profesor…"** y recarga solo, es
  correcto (pasa cuando el móvil tenía una versión vieja en caché). **Bug** si se
  queda en bucle recargando.

---

## 5 · TAREAS (20 min)

1. PC (profe): actividad → **Tarea** → crear con **2 intentos** y fecha límite.
2. Móvil (alumno, sin cuenta): abrir el enlace/código → nombre → jugar → "¡Tarea enviada!".
3. Segundo intento → debe dejar. **Tercero → debe decir que se agotaron** (antes de jugar, no después).
4. Cerrar la tarea desde el PC → el alumno ya no puede entregar, con mensaje claro.
5. **Tortura offline**: modo avión ANTES de terminar la tarea → al acabar debe decir
   *"Sin conexión: tu intento quedó guardado en este dispositivo…"* → volver la red →
   comprobar en el PC (Intentos) que llegó **UNA sola vez** (no duplicado).
6. El profe ve la tabla de intentos con detalle por pregunta.

---

## 6 · El lado del PROFESOR (20 min)

- [ ] Crear una actividad de cada 2-3 tipos desde **Nueva** (el editor guarda, "Probar" funciona).
- [ ] **Cambiar formato**: en una actividad de Quiz, botón de formatos hermanos → convertir a Globos → el contenido sobrevive.
- [ ] Publicar / pasar a borrador → aparece/desaparece de Explorar.
- [ ] Duplicar una actividad pública de otro autor ("Probar" / duplicar) → editable como tuya.
- [ ] Móvil: el menú hamburguesa de la barra funciona; las tarjetas de "Mis actividades" se usan bien con el dedo.
- [ ] Los **previews** de las tarjetas del home se parecen al juego real.

### 6b · Capacidad y limpieza (nuevo, `#/admin`)
- [ ] En `#/admin` hay un bloque **Capacidad**: nº de actividades (de 200), MB en
      total y "las más pesadas". Los números deben ser creíbles.
- [ ] Crea una actividad y **mete imágenes hasta pasar de 2 MB**: el editor debe
      avisar **antes** ("pesa X de 2 MB") y, si te pasas, decir claramente que el
      servidor NO la va a guardar. **Bug** si deja guardar en silencio y luego no
      sincroniza.
- [ ] Botón "**Ver qué salas caducaron**": con salas recientes debe decir que no
      hay nada que limpiar (la retención es de 120 días). No borra nada sin
      confirmar, y antes te dice cuántas salas se van.

---

## 7 · Lo feo a propósito (15 min — aquí viven los bugs buenos)

- [ ] Apodo con groserías al entrar a una sala → debe rechazarse con mensaje.
- [ ] Actividad con textos LARGUÍSIMOS (pega un párrafo entero como pregunta) → se ajusta, no revienta.
- [ ] Quiz de 1 sola pregunta · actividad con 30+ ítems.
- [ ] Denegar el fullscreen (botón atrás del móvil al pedirlo) → la app sigue, no pantalla roja.
- [ ] Dos pestañas del MISMO profe dirigiendo la misma sala → no debe corromperse.
- [ ] Girar el móvil repetidamente en cada pantalla clave.
- [ ] Volumen: botón de mute — y que el juego no suene tras cambiar de ruta.
- [ ] **Editar una pregunta ya creada**: cambia el TEXTO de la opción correcta de un
      Quiz (corrige una tilde, por ejemplo) y juégalo. Debe seguir dando esa opción
      por buena. **Bug grave si de repente todas las respuestas salen mal.**
- [ ] En el editor de Quiz, deja una pregunta **sin marcar la correcta** → debe salir
      un aviso rojo diciendo que así todo contará como fallo. **Bug** si no avisa.
- [ ] Pon "Tiempo de lectura" en **0** → debe comportarse como antes (responder al
      instante). Ponlo en **10** → 10 segundos de espera, sin poder tocar.

---

## Matriz de cobertura (marca lo probado)

Modos REALES de cada juego (lo que no tiene columna, no existe para ese juego — no es bug):

| Juego | Individual | VS | Equipos | En vivo | Tarea |
|---|:-:|:-:|:-:|:-:|:-:|
| Quiz | ☐ | ☐ | ☐ | ☐ | ☐ |
| Operaciones | ☐ | ☐ carrera | ☐ | ☐ | ☐ |
| Tildes | ☐ | ☐ puntos | ☐ | ☐ | ☐ |
| Comas | ☐ | ☐ puntos | ☐ | ☐ | ☐ |
| Emparejar | ☐ | ☐ puntos | ☐ | — | ☐ |
| Memoria | ☐ | — | ☐ tablero | — | ☐ |
| Sopa de Letras | ☐ | ☐ carrera | ☐ tablero | — | ☐ |
| Crucigrama | ☐ | — | — | — | ☐ |
| Explota Globos | ☐ | ☐ puntos | ☐ | — | ☐ |
| Ordena las Pelotas | ☐ | ☐ carrera | ☐ tablero | ☐ tablero | ☐ |
| Etiqueta el diagrama | ☐ | — | — | — | ☐ |
| Ruleta | ☐ | — | — | ☐ | — |
| Abre Cajas | ☐ | — | — | ☐ | — |

### Lo NUEVO de esta tanda (v1.51.343 → v1.51.350) — marca aparte

| Novedad | Dónde probarla | ☐ |
|---|---|:-:|
| Lectura antes de responder (3 s) | 4a paso 5 | ☐ |
| "Saltar pregunta" también con lectura | 4a paso 10 | ☐ |
| Tu puesto y distancia en el móvil | 4a paso 7 | ☐ |
| Flechas ▲▼ en la clasificación | 4a paso 8 | ☐ |
| Lobby de dos preguntas + contraste | 4a paso 4 | ☐ |
| Tiempo POR pregunta (y bonus justo) | 4a-bis | ☐ |
| Carrera: "¿cuándo termina?" (3 formas) | 4b 2-5 | ☐ |
| Carrera/tablero: avance, no ranking | 4b 6 · 4c | ☐ |
| Recargar el móvil a mitad de carrera | 4b 8 | ☐ |
| Participación en "pedir la palabra" | 4d 2 | ☐ |
| **Puntos del docente en el podio** | 4d 4 | ☐ |
| Capacidad y limpieza | 6b | ☐ |
| Editar la opción correcta no la borra | 7 | ☐ |

**Prioridad si hay poco tiempo**:
1. **4a** completo (rondas con lectura) — es lo que más cambió.
2. **4d paso 4** (puntos del docente en el podio) — era un bug gordo, confirma que está.
3. **4b 2-5** (cuándo termina la carrera) — comportamiento nuevo.
4. **5** (tareas con modo avión).
5. **2** en móvil vertical (sobre todo Emparejar y Operaciones).
6. El resto.

---

## Para el que recoge el reporte (no para el tester)

Cuando llegue la lista de bugs, antes de tocar código:
- ¿Es de los **13 juegos** o del **motor de la partida**? Los primeros viven en
  `templates/<nombre>/`, los segundos en `views/hostLive.js` / `views/studentLive.js`.
- Si es de ritmo (tiempos, cuándo se abre o cierra algo), la ley §26 y
  `docs/estudio-bucles-live.md` dicen **por qué** está así antes de cambiarlo.
- Si es de estilo, mirar primero si es **chrome** (barra, lobby, paneles → CSS propio)
  o **juego** (tokens `--ww-*` y skins, ley §3). No se arreglan igual.
