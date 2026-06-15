# Estrategia de plataforma — Actividades educativas interactivas (táctil de aula)

> Documento de arranque. Reúne (1) estudio de referentes del mercado, (2) análisis
> de lo que ya tenemos en `/ac` y `/play`, y (3) la estrategia de implementación
> propuesta. Fecha: 2026-06-05.

---

## 0. Resumen ejecutivo (TL;DR)

- **`/ac` (WW, v1.12.1) es la base ganadora.** Ya tiene la arquitectura correcta:
  plantillas pluggables que consumen *modelos de contenido* abstractos (`qa`, `pairs`,
  `groups`, `words`, `entries`, `diagram`), tres modos de juego (SOLO tipo Wordwall,
  LIVE tipo Kahoot con PIN/QR + realtime, ASYNC/tareas), scoring anti-trampa en
  Edge Functions, skins y fondos. Es justo el esqueleto que necesita una plataforma
  estilo Wordwall+Kahoot.
- **`/play` (EduPlay, v0.9.50) es la mina de features de aula** que `/ac` todavía no
  tiene: detección de **lápiz IR** para pizarras, **corrección sobre canvas**
  (textCorrection / tildes), **modo equipo por turnos**, **calibración** y
  **bloqueo por patrón**. Esto es nuestro diferenciador frente a Wordwall/Kahoot.
- **Plan:** consolidar sobre `/ac`, **portar selectivamente** lo valioso de `/play`
  como nuevas plantillas/capacidades, y completar el modelo Wordwall de
  **"crea una vez, cambia de formato con un clic"** que `/ac` ya tiene a medio camino.
- **No reescribir desde cero.** Ambos son vanilla JS + ES Modules + Supabase, misma
  filosofía. La fusión es viable y barata.

---

## 1. Estudio de referentes (Wordwall, Kahoot y alternativas)

### Dos familias + un tercer modelo
- **Quiz-céntricas** (el juego envuelve un cuestionario): **Kahoot**, **Quizizz**.
- **Juego-céntricas** (el quiz alimenta una mecánica propia): **Blooket** (mini-juegos
  + avatares coleccionables), **Gimkit** (economía y power-ups).
- **Fábrica de formatos**: **Wordwall** — un mismo contenido se reutiliza en decenas
  de plantillas. Este es el modelo más valioso a copiar.

### Otras referencias relevantes
| Plataforma | Idea a robar |
|---|---|
| **Quizizz** | Self-paced + live; variedad de tipos de pregunta; memes/feedback. |
| **Blooket / Gimkit** | Gamificación profunda: avatares, monedas, power-ups, mini-juegos como envoltorio. |
| **Genially** | Contenido interactivo animado (escape rooms, imágenes interactivas). |
| **Educaplay / LearningApps** | Muchos tipos de actividad; embed + export **SCORM**; biblioteca comunitaria. |
| **Baamboozle / Factile** | **Modo "una sola pantalla, por equipos"** para aulas sin dispositivos 1:1. Factile = tablero estilo Jeopardy + buzzers. |
| **Nearpod** | "Draw It" (dibujo a mano), matching pairs, dashboard en vivo. |

### La clave de Wordwall: **"crea una vez, cambia de plantilla con un clic"** (confirmado)
Lo logran con:
1. **Contenido como dato abstracto** (pares, ítems a ordenar, pregunta+opciones) — es
   la fuente de verdad, no un juego concreto.
2. **Modelos de contenido comunes** a varias plantillas (una "lista de pares" alimenta
   Match up, Matching pairs, Maze chase…).
3. **Motor de conversión** que mapea el contenido a todas las plantillas compatibles
   y degrada con gracia si falta algo.
4. **Plantilla (mecánica) + Tema (estética: gráficos/fuentes/sonidos) desacoplados.**

> **`/ac` ya tiene los cimientos de los puntos 1, 2 y 4.** Falta construir el punto 3
> (el switch de plantilla) y enriquecer el catálogo.

### Catálogo de plantillas Wordwall (para priorizar el nuestro)
- **Quiz:** Quiz, Gameshow, True/False, Image quiz.
- **Emparejar:** Match up, Matching pairs, Find the match.
- **Ordenar/clasificar:** Group sort, Rank order, Unjumble.
- **Completar/escribir:** Complete the sentence, Type the answer, Labelled diagram.
- **Palabras/letras:** Anagram, Crossword, Wordsearch, Hangman, Flash cards.
- **Arcade:** Spin the wheel, Open the box, Maze chase, Whack-a-mole, Balloon pop.

### UX táctil de aula (sin hover ni clic derecho)
- **Touch-first absoluto:** nada que dependa de hover o menú contextual.
- Interacciones que funcionan con el dedo: **drag-and-drop con drop-zones generosas y
  snap**, **tap para voltear/revelar**, **ruletas y "golpear"** (tolerantes a
  imprecisión), **dibujo/escritura a mano** con borrado por palma.
- **Targets grandes** (≥48px), feedback inmediato visual+sonoro.
- **Multi-touch** (las pizarras soportan ~10 toques) → habilita colaboración y modo
  equipos en una sola pantalla.

---

## 2. Lo que ya tenemos

### 2.1. `/ac` — "WW" (v1.12.1) — **proyecto actual, la base**
- **Stack:** vanilla JS (ES Modules), Bootstrap 5.3 CDN, Supabase (auth anón,
  realtime, Edge Functions), sin bundler, GitHub Pages.
- **Tres entrypoints:** `teacher.html`, `student.html`, `embed.html` (iframe sin chrome).
- **Tres modos:**
  - **SOLO** (Wordwall): un dispositivo, scoring local, frame fijo 1280×800 (16:10).
  - **LIVE** (Kahoot): sesión con PIN+QR, lobby → pregunta → reveal → leaderboard →
    podio, **scoring anti-trampa en Edge Function `settle-item`** con `activity_snap`.
  - **ASYNC**: tareas a ritmo del alumno.
- **6 plantillas pluggables:** quiz, memory, match, wheel, tildes, comas. Cada una es un
  módulo autocontenido (`template.js` + `player.js` + `editor.js` + `scorer.js`),
  auto-registrado en `core/registry.js`.
- **Modelos de contenido** (clave para el "switch"): `qa`, `pairs`, `groups`, `words`,
  `entries`, `diagram`.
- **Datos:** localStorage como fuente primaria + sync a Supabase (tabla `activities`,
  `data` JSONB). 12 migraciones SQL versionadas. RLS aún en modo `open_all` (fase 0).
- **Presentación:** skins (default/classroom/space/neon) + backgrounds + `touch.css`
  (sin delay 300ms, hover desactivado en táctil).
- **Roadmap propio (README):** v0.4 endurecer LIVE · v0.5 reportes/CSV · v0.6 tareas ·
  v1.0 auth real + explore + fork.
- **Debilidades:** RLS abierta (sin seguridad real), auth solo anónima, sin
  reconexión LIVE, "explore"/fork sin implementar, sin tests/build.

### 2.2. `/play` — "EduPlay" (v0.9.50) — **proyecto pasado, mina de features**
- **Stack:** vanilla JS (ES Modules), Bootstrap 5.3, Supabase REST (sin SDK),
  localStorage. Sin bundler. Deploy a GitHub Pages.
- **4 plantillas:** quiz, **textCorrection** (dibujo sobre canvas + detección de zonas),
  **tildes** (hereda de textCorrection, skin "notebook", quita tildes), **tildesEquipo**
  (3 rondas/alumnos, score de equipo).
- **Joyas que `/ac` NO tiene:**
  - **`libs/pen-detector.js`** — clasificación de herramienta de **lápiz IR** para
    pizarras (pen fino/grueso, borrador, palma). ~180 líneas.
  - **`views/calibration.js`** — calibración de umbrales del lápiz IR.
  - **Corrección sobre canvas** (`textCorrection.js`, 471 líneas + `tc-draw`, `tc-html`)
    con hit-detection de trazos vs zonas y borrado con la palma.
  - **`views/lockScreen.js`** — desbloqueo por **patrón 3×3** sincronizable entre PCs.
  - **`reviewController.js`** — revisión post-juego con 3 estrategias (itemList,
    frozenCanvas, aggregate).
  - **Modo equipo por turnos** (tildesEquipo).
- **`eduplay-standalone.html`** — versión monolítica de 1 archivo (solo Quiz, datos
  hardcoded). Útil como demo offline; desactualizada.
- **Estado:** maduro para su caso (aula táctil + IR pen) pero pre-producción.

### 2.3. Veredicto comparativo
| Dimensión | `/ac` (WW) | `/play` (EduPlay) |
|---|---|---|
| Arquitectura de plantillas | **Superior** (content models + pluggable) | Buena pero acoplada |
| Multijugador en vivo | **Sí** (PIN/QR + realtime + anti-trampa) | No |
| Tareas async | **Sí** | No |
| Lápiz IR / pizarra | No | **Sí** (diferenciador) |
| Corrección sobre canvas | No | **Sí** |
| Modo equipo | No (pendiente) | **Sí** |
| Madurez de backend | **Mayor** (12 migraciones, EF) | Menor (REST simple) |

→ **Base = `/ac`. Trasplante quirúrgico de features de `/play`.**

---

## 3. Estrategia de implementación

### Principios rectores
1. **Una sola base de código: `/ac`.** `/play` queda como repositorio de referencia
   del cual portamos código, no como rama viva.
2. **Contenido como dato** (modelo Wordwall). Toda actividad guarda solo datos
   abstractos según su `contentModel`. Las mecánicas (plantillas) y la estética (temas)
   son capas independientes.
3. **Touch-first, viewport 1280×800.** Diseñar para el dedo; verificar siempre en
   responsive de móvil para el docente.
4. **Local-first.** localStorage como fuente de verdad; Supabase como sync. Funciona
   offline; el backend (Supabase o PocketBase en la Pi5 `pb.lanube.com`) es
   intercambiable detrás de una capa de transporte.
5. **No romper lo que funciona.** Cada incorporación es una plantilla o capacidad
   nueva, aislada y registrada; nada de reescrituras grandes.

### Decisión técnica pendiente (a confirmar contigo)
- **Backend de desarrollo:** ¿seguimos con Supabase, o abstraemos un *data adapter*
  para poder apuntar a **PocketBase (`pb.lanube.com`)** o a un **modo 100% local
  (localStorage/IndexedDB)** sin tocar la app? Recomendación: **capa de transporte
  intercambiable** + por defecto **local** en desarrollo.

### Hoja de ruta por fases

**Fase A — Cimientos y fusión (semana 1-2)**
- A1. Documentar y congelar el contrato de `contentModel` y de plantilla (ya hay
  `templates/HOW_TO_ADD.md`); dejarlo como base estable.
- A2. Introducir una **capa de transporte/data-adapter** (`core/transport/*`) con
  drivers: `local` (default dev), `supabase`, `pocketbase`. Selección por config.
- A3. **Portar de `/play` a `/ac`:** `pen-detector.js` + calibración como módulo
  opcional `core/input/penIR` que emite eventos pointer normalizados.

**Fase B — El "switch de plantilla" Wordwall (semana 2-3)**
- B1. Motor de conversión: dado un activity, listar plantillas **compatibles** por
  `contentModel` y ofrecer cambio con un clic (con degradación elegante).
- B2. UI de "Cambiar plantilla" en el editor/home (panel lateral estilo Wordwall).
- B3. Verificar que las 6 plantillas actuales interoperan vía sus content models.

**Fase C — Nuevas plantillas de alto valor (semana 3-5)**
- C1. **Group sort / clasificar** (drag a categorías) — content model `groups`.
- C2. **Ordenar / Unjumble** y **Anagram** — content model `words`/`entries`.
- C3. **Spin the wheel** ya existe (pulir táctil) + **Open the box** (tap-revelar).
- C4. **textCorrection / tildes** portadas de `/play` como plantillas de pleno derecho
  (canvas + IR pen) + **modo equipo por turnos**.

**Fase D — Aula y gamificación (semana 5-7)**
- D1. **Modo "una pantalla por equipos"** (estilo Baamboozle/Factile) para aulas sin
  dispositivos 1:1: turnos, marcador de equipos, buzzers opcionales.
- D2. Capa de **gamificación reutilizable**: puntos, leaderboard, sonidos, animaciones,
  (avatares/insignias como extensión futura).
- D3. Portar **lockScreen** por patrón como modo "kiosco de aula" opcional.

**Fase E — Producción (semana 7+)**
- E1. **RLS real** en Supabase (cerrar `open_all`), auth real, perfiles.
- E2. **Reportes + export CSV/SCORM**, biblioteca pública **/explore** + clonar/fork.
- E3. Endurecer LIVE (timer en host, kick, reconexión, heartbeat ya existe).
- E4. Tests mínimos + (opcional) un build ligero si hace falta.

### Riesgos y mitigaciones
- **Acoplamiento de las plantillas de `/play`** (textCorrection muy ligada a su review):
  envolverlas con el contrato `BaseTemplate` de `/ac` antes de portar.
- **Seguridad:** hoy RLS abierta → priorizar E1 antes de cualquier uso real con datos
  de alumnos.
- **Backend dual (Supabase/PocketBase):** mitigar con el data-adapter de A2 para no
  duplicar lógica.

---

## 4. Próximos pasos inmediatos (propuestos)
1. Confirmar **backend de desarrollo** (local vs Supabase vs PocketBase) → define A2.
2. Confirmar **prioridad de plantillas nuevas** (¿clasificar/ordenar primero, o portar
   textCorrection+IR pen primero?).
3. Arrancar **Fase A** en esta rama (`arquitectura-plataforma-actividades-tactiles`).

> Este documento es vivo: se actualiza al cerrar cada fase.
