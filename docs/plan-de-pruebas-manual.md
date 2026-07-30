# Plan de pruebas manual — mapa completo para el tester

> **Para quién**: el compañero que va a probar los juegos en **aulareto.com** (dos.pe),
> sin necesidad de saber programar. **Qué es**: el recorrido completo de la app, en
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

## 4 · EN VIVO — el flujo estrella (45 min, necesita los 2 dispositivos)

**Esto acaba de pasar por una reforma de seguridad grande: es la prioridad nº 1 del testeo.**

### 4a · Pregunta a pregunta (tipo Kahoot) — con Quiz
1. PC (profe, con sesión): actividad → **En vivo** → sale sala con **PIN y QR**.
2. Móvil (alumno, SIN cuenta): entrar con el PIN, poner apodo. → aparece en el lobby del PC.
3. Incógnito: entrar con **el mismo apodo** → debe entrar como "Nombre 2" (no expulsar al primero).
4. Empezar. En el móvil sale la pregunta con cuenta atrás; responde. → "¡Respuesta enviada!".
   **BUG GRAVE si sale "El servidor no aceptó tu respuesta"** — anota el mensaje EXACTO.
5. Revelar → clasificación → siguiente. Deja una pregunta SIN responder en un móvil → a ese le sale "Sin respuesta", no "Incorrecto".
6. Con puntuación **Kahoot** activada: el que responde más rápido gana más puntos. Responder tarde a propósito debe dar menos.
7. Terminar → podio en el PC, pantalla de final con su puesto en el móvil.
8. **Torturas** (cada una es un caso real de aula):
   - Móvil: bloquea la pantalla 20 s en plena pregunta, desbloquea → debe recuperarse solo.
   - Móvil: activa modo avión, responde, desactiva → "Respuesta guardada (sin red). Se enviará al reconectar" y al volver la red, llega.
   - Móvil: cierra el navegador y vuelve a entrar con el PIN → debe reconectar (mismo o nuevo apodo con sufijo) y poder seguir respondiendo.
   - PC: F5 al profe en plena partida → debe volver a la sala y poder seguir dirigiendo.

### 4b · Carrera libre — con Operaciones
- Igual, pero modo "🏁 Carrera libre": cada alumno avanza a su ritmo; el PC muestra
  barras de progreso y un cronómetro que AVANZA.
- Fallar una pregunta la re-encola (vuelve a salir al final). Corregirla debe contar.
- Terminar carrera → podio.

### 4c · Tablero compartido — con Ordena las Pelotas
- El PC ve el tablero de cada alumno moviéndose casi en vivo (refresco ≤ ~2 s).

### 4d · Abre Cajas / Ruleta en vivo
- "Pedir la palabra": un alumno pulsa su caja → al profe le sale quién pidió.
- El profe da los puntos A MANO. En el móvil del alumno debe decir
  **"¡Respuesta enviada! La valora tu profe"** — **bug si dice "Incorrecto"**.
- En la tabla del profe esa pregunta sale como "—", no como fallo.

### 4e · Informe post-partida
- Al cerrar: pestañas de tabla por alumno (✓/✗/—), ranking y análisis por pregunta.
- Los **tiempos** de respuesta deben ser creíbles (segundos de verdad, no todos 0.0 s).
- Exportar CSV y abrirlo.

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

---

## 7 · Lo feo a propósito (15 min — aquí viven los bugs buenos)

- [ ] Apodo con groserías al entrar a una sala → debe rechazarse con mensaje.
- [ ] Actividad con textos LARGUÍSIMOS (pega un párrafo entero como pregunta) → se ajusta, no revienta.
- [ ] Quiz de 1 sola pregunta · actividad con 30+ ítems.
- [ ] Denegar el fullscreen (botón atrás del móvil al pedirlo) → la app sigue, no pantalla roja.
- [ ] Dos pestañas del MISMO profe dirigiendo la misma sala → no debe corromperse.
- [ ] Girar el móvil repetidamente en cada pantalla clave.
- [ ] Volumen: botón de mute — y que el juego no suene tras cambiar de ruta.

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

**Prioridad si hay poco tiempo**: 4a (en vivo pregunta) → 5 (tareas con offline) →
2 en móvil vertical (sobre todo Emparejar y Operaciones) → 4b (carrera) → el resto.
