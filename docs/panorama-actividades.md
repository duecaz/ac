# Panorama de actividades — qué hace cada una, compatibilidades y optimización

> Fecha: 2026-06-06. Base para decidir qué cablear a cada **formato de sesión**
> (Solo · VS · Equipos · En vivo · Tarea) y cómo optimizar. Datos verificados
> contra `templates/*/template.js` y `kernel/`.

---

## 0. El concepto clave: el "grano" de cada plantilla

Lo que decide a qué formato encaja una plantilla **no es el contenido, sino su
grano**: cómo se divide la jugada en unidades.

- **Secuencia de ítems** (1 pregunta = 1 ronda): se puede servir "un ítem a la
  vez" → encaja en **En vivo**, **VS** (paralelo) y **Equipos** (por turnos).
- **Tablero único** (toda la actividad es un puzzle en pantalla): no hay "ítems"
  separados → encaja en **VS como carrera** (dos tableros en paralelo) y a veces
  en **Equipos por turnos** (memoria), pero NO en el flujo pregunta→pregunta.
- **Herramienta** (no se puntúa): utilidad de aula, no compite.

---

## 1. Cuadro por plantilla

| Plantilla | Modelo | Qué hace | Grano | Puntúa hoy | Sirve 1 ítem | Modos hoy |
|---|---|---|---|---|---|---|
| **Quiz** | `qa` | Pregunta + opciones, elige la correcta | **Secuencia** | ✅ `scoreSubmission` | ✅ `getRoundPayload` | Solo · En vivo · Tarea |
| **Emparejar** (match) | `pairs` | Une izquierda↔derecha (todo el tablero) | **Tablero** | inline (solo) | ❌ | Solo · Tarea · Práctica |
| **Memoria** (memory) | `pairs` | Voltea y encuentra parejas | **Tablero**, por naturaleza **por turnos** | inline (solo) | ❌ | Solo · Tarea · Práctica |
| **Tildes** | `textCorrection` | Marca tildes faltantes en un texto | **Secuencia** (1 pasaje = 1 ronda) | inline (solo) vía `textMarks` | ⚠️ parcial | Solo · Tarea · Práctica |
| **Comas** | `textCorrection` | Coloca comas en un texto | **Secuencia** (1 pasaje = 1 ronda) | inline (solo) vía `textMarks` | ⚠️ parcial | Solo · Tarea · Práctica |
| **Ruleta** (wheel) | `entries` | Gira y elige al azar | **Herramienta** (no compite) | no puntúa | n/a | Solo · Tarea · Práctica |

> Nota: "Puntúa hoy = inline (solo)" significa que la lógica de acierto existe en
> el `player.js` de la plantilla, pero **no está extraída** como `scoreSubmission`
> puro. Para Tildes/Comas la lógica ya vive en `core/textMarks.js` (extraíble fácil).

---

## 2. Compatibilidad plantilla × formato de sesión

| Plantilla | Solo | Tarea | En vivo | **VS** (paralelo) | **Equipos** (turnos / juez) |
|---|:--:|:--:|:--:|:--:|:--:|
| **Quiz** | ✅ | ✅ | ✅ | ✅ *(listo: scorer + ≥2 ítems)* | ✅ auto **o** juez |
| **Tildes** | ✅ | ✅ | ✅ (host/alumno genéricos vía `renderRound`/`renderRoundHost`; Supabase requiere redeploy de Edge) | ✅ auto (tap-toggle) | ✅ auto **o** juez |
| **Comas** | ✅ | ✅ | ✅ ídem | ✅ auto (tap-toggle) | ✅ auto **o** juez |
| **Emparejar** | ✅ | ✅ | ❌ (no es secuencia) | ✅ **carrera** (2 tableros) tras adaptador | ⚠️ raro por turnos; sí como reto |
| **Memoria** | ✅ | ✅ | ❌ | ✅ **carrera** o tableros espejo | ✅ **natural por turnos** (volteo) |
| **Ruleta** | ✅ | ✅ | ❌ | ❌ | 🔧 utilidad: "gira para elegir equipo/turno" |

Leyenda: ✅ encaja · ⚠️ encaja con trabajo previo · ❌ no encaja · 🔧 como herramienta.

**Lectura rápida:**
- **Quiz** es el único 100% listo para VS y Equipos hoy → primer cliente.
- **Tildes/Comas** entran en **Equipos con juez docente ya mismo** (sin scorer),
  porque el docente marca ✓/✗. Para VS/auto hay que extraer el scorer (la lógica
  ya existe en `textMarks.js`).
- **Memoria** es el caso bonito para **Equipos por turnos** (mecánica nativa).
- **Emparejar/Memoria** en **VS** son **carreras de tablero** (no pregunta‑a‑pregunta).
- **Ruleta** no compite: es herramienta de aula (sorteo de turno/equipo).

---

## 3. Compatibilidad de contenido (el "cambia de formato en un clic")

Conversores existentes (`kernel/content/convert.js`):

```
qa ──▶ pairs        qa ──▶ entries
pairs ──▶ qa        pairs ──▶ entries
```

| Tienes contenido… | Puedes jugarlo como… |
|---|---|
| **qa** (quiz) | Quiz, Emparejar, Memoria (qa→pairs), Ruleta (qa→entries) |
| **pairs** (match/memory) | Emparejar, Memoria, Quiz (pairs→qa), Ruleta (pairs→entries) |
| **entries** (ruleta) | Ruleta (sin conversor de salida hoy) |
| **textCorrection** (tildes/comas) | Tildes, Comas (aislado; sin conversor a otros) |

Esto se combina con el cuadro §2: p. ej. un contenido `qa` puede ir a Quiz‑VS,
o convertirse a `pairs` y jugarse como Memoria‑Equipos.

---

## 4. El cuello de botella y cómo optimizar

**Problema raíz:** las plantillas de hoy son *"reproductores de actividad
completa"* (el `player.js` corre todo el bucle en el DOM), no *"reproductores de
un ítem"*. En vivo lo esquiva porque host y alumno son pantallas distintas. Pero
**VS y Equipos en una sola pantalla necesitan presentar un ítem a la vez**.

**Optimización propuesta — una interfaz mínima de "ronda" por plantilla:**

1. **`scoreSubmission(input) → {correct, points}`** puro (ya en Quiz; extraer para
   Tildes/Comas desde `textMarks.js`; para Match/Memory desde su `player.js`).
2. **`getRoundPayload(activity, {itemIndex}) → payload`** (ya en Quiz; trivial en
   Tildes/Comas: un pasaje por ronda).
3. **`renderRound(root, payload, { onSubmit })`** — pintar **un** ítem y reportar
   la respuesta (lo nuevo). Para tableros (Match/Memory) la "ronda" es el tablero
   entero y `onSubmit` se dispara al completarlo.

Con esa interfaz, **el motor de sesión ya hecho** sirve los ítems y cada formato
(VS/Equipos/En vivo) reutiliza el MISMO `renderRound` — sin duplicar lógica.

**Atajo que ya tenemos:** el **juez docente** del motor de Equipos no necesita
scorer ni `renderRound` de respuesta — el docente marca ✓/✗ sobre lo que se ve.
Eso permite jugar **Tildes/Comas/cualquier cosa en Equipos hoy**.

---

## 5. Plan por fases (estado)

- **F1 — VS Quiz** ✅ hecho: `views/vsView.js` (pantalla partida + tug-of-war con
  `standings()`), ruta `#/vs/:id`. Verificado en navegador.
- **F2 — Equipos** ✅ hecho: `views/teamsView.js` por turnos, marcador, modo
  **auto** (Quiz) y **juez docente ✓/✗** (cualquier contenido), ruta `#/teams/:id`.
- **F3 — interfaz `renderRound`** 🟢 hecho para Quiz + Tildes: contrato
  `renderRound(root, payload, {onSubmit})` (la plantilla pinta UN ítem y reporta
  la respuesta; el motor puntúa con `scoreSubmission`). VS y Equipos-auto usan
  `renderRound` genéricamente; `isVsCompatible` exige `renderRound`+scorer+≥2.
  **Quiz** (rejilla), **Tildes** (tocar vocales) y **Comas** (tocar huecos) ya
  juegan en VS y Equipos-auto; el scorer por-marcas se comparte (`scoreMarks` en
  `textMarks.js`). **Falta** Match/Memory (ver F4). Equipos-juez juega cualquier
  cosa.
- **F4 — Pares / tableros** 🟢 Match hecho: en vez de "carrera de tablero",
  **Emparejar** juega como *pregunta de emparejado* por par (prompt = izquierda,
  opciones = derechas + distractores), encajando en el motor por-ítem y
  reutilizando `renderChoiceRound`. Ya juega VS y Equipos-auto.
  **Memoria** ✅ con su mecánica nativa por turnos (voltear cartas): núcleo puro
  `kernel/session/memory.js` (acierto = punto y sigues; fallo = pasa el turno) +
  `views/memoryView.js`. Desde F6 el botón **Equipos** para Memoria la monta
  **embebida** en la página de actividad (la ruta `#/memory/:id` sigue como
  deep-link). Regla de fin de VS: ver `docs/modos-de-juego.md §9` (gana el
  primero en terminar; la carrera no espera al otro).
  **Ruleta / Sorteo** ✅ utilidad de aula independiente: `views/sorteoView.js`
  (ruta `#/sorteo`, enlace en la barra) — gira para elegir equipo/turno/alumno,
  lista editable, presets y "quitar al elegido" (sorteo sin repetición). Reutiliza
  la lógica pura de la ruleta y un dibujo SVG compartido (`templates/wheel/render.js`).
- **F5 — Barra de modos** ✅ hecho: `views/playerView.js` expone
  Individual · VS · Equipos · En vivo · Tarea, gateados por compatibilidad (§2).
- **F6 — Modos embebidos + contrato único** ✅ hecho: el gateo se unificó en un
  registro (`core/modes.js`, fuente única de verdad), y los modos de pantalla
  compartida (Individual · VS · Equipos · Memoria) ahora corren **dentro del
  escenario de la actividad** (mismo `#/play/:id`, mismo tema), no en páginas
  sueltas. En vivo y Tarea siguen abriendo su página propia (otro montaje
  físico) pero comparten barra y estética. Las pantallas de inicio comparten un
  andamiaje común (`views/modeSetup.js`) para que no se desincronicen. Las rutas
  `#/vs/:id`, `#/teams/:id`, `#/memory/:id` siguen vivas como deep-links.
  **Contrato y recetas (añadir modo / que una plantilla nueva ofrezca cada
  modo): `docs/modos-de-juego.md`.** Tests de gateo: `tests/modes.test.mjs`.
