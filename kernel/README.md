# kernel/

Núcleo estable y pequeño de la plataforma. Define **contratos** (interfaces) que
desacoplan lo enchufable (plantillas, modos, temas, inputs, backend) del resto.

## contracts/
Solo declaraciones de forma con JSDoc `@typedef` — **cero runtime**. Importarlas es
gratis y nunca cambian el comportamiento. Habilita `// @ts-check` en un módulo para
obtener checkeo en editor/CI contra estos contratos sin necesidad de build.

- `template.js` — `TemplateContract` (lo que toda plantilla debe cumplir; el
  `core/registry.js` lo valida al registrar y falla ruidosamente).
- `contentModel.js` — `ContentModelContract` (validación + conversión entre modelos;
  base del "cambiar de plantilla en un clic").
- `dataPort.js` — `DataPort` (persistencia de actividades, sin backend concreto).
- `realtimePort.js` — `RealtimePort` (juego LIVE, sin backend concreto).

## content/ (motor de contenido — columna vertebral del "switch")
Núcleo puro y testeable en Node (sin DOM ni backend):
- `models.js` — registro normalizado de modelos (`qa`, `pairs`, `entries`,
  `textCorrection`) con `newEmpty()` y `validate() → {ok, errors}`. Envuelve los
  módulos hoja `core/contentModels/*` sin moverlos.
- `convert.js` — conversores de alta confianza entre modelos con degradación
  elegante (`qa↔pairs`, `qa→entries`, `pairs→entries`).
- `switch.js` — `switchOptions(activity, templates)` y `applySwitch(...)`: la lógica
  Wordwall "cambia de formato en un clic". Desacoplado del registry (recibe la lista
  de plantillas) para poder testearse en Node.

Pruebas: `node tests/run.mjs` (registry + content).

## session/ (motor de sesión unificado)
Un único cerebro puro (sin DOM ni backend, estado JSON-serializable e hidratable)
que conduce **todos** los formatos de juego, para que el flujo y la puntuación
vivan en un solo sitio (y en paridad con las Edge Functions de Supabase):

- `engine.js` — `createSession(activity, { format, ... })` con `FORMATS`:
  - **live** — sala estilo Kahoot: muchos jugadores, flujo sincronizado
    question→reveal→leaderboard, scoring anti-trampa en `settle()`. Idéntico al
    antiguo `createLiveRoom` (que ahora es un alias delgado en `live/engine.js`).
  - **teams** — una sola pantalla, por **turnos** (estilo Baamboozle/Factile):
    los equipos responden por turnos rotatorios. Puntuación `auto` (scorer de la
    plantilla) o **`judge`** (el docente marca ✓/✗) → así *cualquier* contenido se
    juega en equipos aunque la plantilla no tenga scorer. `award()` para bonus.
  - **vs** — duelo 1‑contra‑1: dos lados corren la **misma** secuencia en
    **paralelo**, auto‑puntuados al responder; `standings()` da la diferencia en
    vivo para la animación central de "quién va ganando". Requiere scorer y ≥2
    ítems (`isVsCompatible`).
  - **solo** — participante único autocronometrado (cursor puntuado sobre los ítems).

Pruebas: `node tests/sessionEngine.test.mjs` (teams + vs) y `liveEngine`/`liveLocal`
(formato live sin regresión).

## Estado de la migración (ruta de viaje)
- **F0 (hecho):** contratos + `jsconfig.json` + validación estricta en el registry.
- **F1:** mover Supabase a `adapters/` detrás de `DataPort`/`RealtimePort`; `core/storage`
  y `core/transport` pasan a consumir los Ports. Adapter `local` (IndexedDB) por defecto
  en desarrollo.
- **F2:** motor de contenido (validación + conversores) y UI "Cambiar plantilla".

Detalle completo en `../ESTRATEGIA.md` y en el plan de la rama.
