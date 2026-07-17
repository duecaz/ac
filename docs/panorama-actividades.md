# Panorama de actividades y features — catálogo de referencia

> **Qué hace cada actividad, en qué modos se juega y qué features transversales
> existen.** Verificado contra `templates/*/template.js` + `core/registry.js`.
> Documentos hermanos: modelo de contenido JSON → `docs/ESTRUCTURA.md` ·
> contrato de modos → `docs/modos-de-juego.md` · cómo se prueba → `docs/testing.md`.

## 1. Las 12 actividades de un vistazo

| Actividad | Modelo | Qué hace | `panelFit` | Solo | Tarea | En vivo | VS | Equipos |
|---|---|---|---|:--:|:--:|:--:|:--:|:--:|
| **Quiz** | `qa` | Pregunta + opciones, tocas la correcta | fill | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operaciones** (math) | `qa` | Resuelves la operación con teclado numérico | **block** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tildes** | `textCorrection` | Dibujas la tilde sobre las vocales que la llevan | fill | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Comas** | `textCorrection` | Dibujas la coma en el hueco que falta | fill | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Emparejar** (match) | `pairs` | Unes cada elemento con su pareja | fill | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Memoria** (memory) | `pairs` | Volteas cartas y encuentras parejas | fill | ✅ | ✅ | ❌ | ❌ | ✅ *(turnos nativos)* |
| **Sopa de Letras** (wordsearch) | `words` | Arrastras sobre las palabras ocultas | fill | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Crucigrama** (crossword) | `words` | Rellenas el crucigrama desde las pistas | fill | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Ordena las Pelotas** (ballsort) | `ballsort` | Mueves bolas hasta que cada tubo sea de un color | fill | ✅ | ✅ | ✅ *(tablero)* | ✅ *(carrera)* | ✅ *(carrera)* |
| **Ruleta** (wheel) | `items` | Gira y cae en una entrada al azar | fill | ✅ | — | ✅ *(manual)* | ❌ | ❌ |
| **Abre Cajas** (question-live) | `items` | El profe abre cajas; el alumno responde | fill | ✅ | — | ✅ *(manual)* | ❌ | ❌ |
| **Etiqueta el diagrama** (diagram) | `diagram` | Arrastras etiquetas a pines sobre una imagen | fill | ✅ | ✅ | ❌ | ❌ | ❌ |

Reglas de compatibilidad (derivadas, no configuradas — `core/modes.js`):
- **VS / Equipos-auto** necesitan `scoreSubmission` + `renderRound` (+ ≥2 ítems, o 1 si es tablero).
- **Memoria** entra en Equipos por su mecánica **nativa por turnos** (no por `renderRound`).
- **Ballsort** es `liveBoard`: un **único tablero compartido**; en VS/En vivo ambos lados resuelven el MISMO tablero y gana quien termina antes.
- **Ruleta / Abre Cajas** son de **corrección manual** del docente (declaran `scoreSubmission`/`getRoundPayload` como stub para pasar el registro, pero no se puntúan solos).

## 2. Cómo funciona cada actividad (mecánica)

- **Quiz** — rejilla estilo Kahoot; puntúa con velocidad si `pointsModel:'kahoot'`.
- **Operaciones** — teclado numérico (`core/roundRender.js`); `vsCanRetry` deja reintentar en VS hasta acertar. En VS es un **bloque** (no se estira).
- **Tildes / Comas** — el alumno **dibuja** la marca con lápiz/táctil sobre el texto (`core/textCorrectionDraw.js`), no la toca; el inicio del trazo dentro de la zona de una vocal/hueco la marca. Tildes en VS puntúa **1 punto por tilde buena** (las de más restan). Fase 2: calibración lápiz/borrador por tamaño de contacto (`core/penDetector.js`).
- **Emparejar** — emparejado libre; se corrige al pulsar Enviar. En sesión, cada par es una "pregunta de emparejado".
- **Memoria** — voltear/emparejar/turno (`kernel/session/memory.js`): aciertas y sigues, fallas y pasa el turno.
- **Sopa de Letras / Crucigrama** — tableros de palabras (`words`); wordsearch busca libremente, crossword rellena desde pistas.
- **Ordena las Pelotas** — puzzle de tubos; el progreso del tablero alimenta la cuerda del VS.
- **Ruleta / Abre Cajas** — herramientas de aula en vivo; el profe controla, valida verbalmente.
- **Etiqueta el diagrama** — imagen con pines a (x,y); arrastras cada etiqueta a su pin (motor de cuerdas compartido `core/connectRope.js`, el mismo de Emparejar). Editor: clic en la imagen coloca el pin.

## 3. Cambiar de formato conservando el contenido

Conversores en `kernel/content/convert.js` (`adoptContent` opcional por plantilla):

```
qa ⇄ pairs        qa ──▶ items        pairs ──▶ items
```

| Tienes contenido… | Puedes jugarlo como… |
|---|---|
| **qa** (quiz/math) | Quiz, Operaciones, Emparejar/Memoria (qa→pairs), Ruleta/Abre Cajas (qa→items) |
| **pairs** (match/memory) | Emparejar, Memoria, Quiz (pairs→qa) |
| **words** (wordsearch/crossword) | Sopa de Letras, Crucigrama *(sin conversor entre sí aún — deuda)* |
| **textCorrection** (tildes/comas) | Tildes, Comas *(sin conversor entre sí aún — deuda)* |
| **items** (wheel/question-live) | Ruleta, Abre Cajas |

## 4. Features transversales (no son de una sola actividad)

| Feature | Dónde vive | Qué hace |
|---|---|---|
| **Pantalla de inicio** | `views/startScreen.js` | Todo modo Individual pasa por título + instrucciones + ajustes + **Iniciar → pantalla completa**. Oculta el ejercicio hasta empezar. |
| **`meta.panelFit`** | `views/vsView.js` + `styles/vs.css` | Cada actividad declara cómo se maqueta en el panel VS: `fill` (llena y escala) · `block` (bloque con tope, la calculadora) · `center`. |
| **Skins / temas** | `core/skins.js` + `themes/*/skin.css` | Paletas y layouts VS: default, aula, espacio, kahoot, retro, jungla, **colegios**, **tv-show**, **arcade** (recreativa de neón). Los skins definen **tokens**, no repiten reglas. |
| **Fondos** | `core/backgrounds.js` | Pizarra, cuaderno (rayado alineado al texto en Tildes), etc. |
| **Calibrar pizarra** | `core/penCalibration.js` | En Tildes/Comas: mide el tamaño de contacto de lápiz punta/dedo/trasero/palma para distinguir dibujar vs borrar. |
| **Animación de progreso (Solo)** | `core/soloAnimator.js` | Carril opcional sobre el ejercicio (la rana que salta), gated a modo Individual. |
| **Animación central (VS)** | `core/vsAnimations.js` | La "cuerda" tira según el marcador; **apagada por defecto en Tildes/Comas** (el texto necesita el ancho). |
| **Gama baja (`ww-lite`)** | `core/perf.js` | En pizarras A55 (≤4 núcleos / ≤2GB) apaga los bucles de animación en reposo → el teclado VS responde fluido. |
| **Sonidos / efectos** | `core/sounds.js` · `core/effects.js` | Enganchados al bus `GameEvents`; toggles en la pantalla de inicio. |
| **Ritmo de juego** | `core/timings.js` | Las pausas con nombre (destellos, celebración, confeti). |

## 5. Cómo se prueba

Cada capa tiene su suite pura en `tests/` y su verificación headless para lo
visual/táctil. El mapa completo (qué suite protege qué, receta Playwright) está
en **`docs/testing.md`**. Referencia rápida por área:

| Área | Suite Node | Verificación visual/táctil |
|---|---|---|
| Registro + gateo de modos | `modes`, `modeMatrix`, `registry` | panel `#/admin` |
| Motores de sesión (VS/Equipos/Live) | `sessionEngine`, `live*`, `simPlay` | 2 pestañas en localhost |
| Puntuación | `scoring`, `textMarks`, `qaAdapt`, `ballsort` | — |
| Tildes/Comas (dibujo + calibración) | `textMarks`, `penDetector`, `liveText` | headless: trazo sobre vocal, punteros fantasma |
| Modo SOLO (shells, timer) | `solo`, `soloPlayer`, `soloTimer`, `clock` | — |
| Etiqueta el diagrama | `diagram` | headless: pines↔etiquetas, `fitImageBox`, sin fugas de ResizeObserver |
| Maquetación de panel (`panelFit`, fitPassage) | — *(sin suite: es CSS/DOM)* | headless: `scrollHeight` vs área, 2 tamaños |
| CSS de actividad (relativo + tokens de skin) | `styles` (ratchet, ver `docs/estilos-de-actividad.md`) | — |
| Skins / tokens | — | headless: `getComputedStyle` por skin |
