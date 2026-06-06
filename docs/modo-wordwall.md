# Modo Wordwall (SOLO) — documentación del sistema

> El modo **SOLO** = una sola pantalla/dispositivo, sin red, puntuación local.
> Es el "Empezar" de Wordwall (frente al "PIN" tipo Kahoot, que es LIVE). Este
> documento describe cómo está construido el sistema detrás, ya cubierto por tests.

## 1. Idea central: contenido como dato

Una **actividad** es un objeto de datos normalizado (no un juego concreto). Su forma
canónica la fija `core/migrate.js → normalize()`:

```
{
  id, title, subtitle,
  template,            // qué mecánica la renderiza (quiz, match, memory, wheel, tildes, comas)
  templateVersion, schemaVersion,
  content,             // los datos abstractos según el contentModel de la plantilla
  rules, scoring, review, presentation, live,
  author, visibility, forkOf, tags, language, media,
  createdAt, updatedAt
}
```

El **contentModel** (`qa`, `pairs`, `entries`, `textCorrection`) describe la *forma* de
`content`. Varias plantillas comparten modelo → de ahí el "cambiar de formato en un clic"
(ver §6).

## 2. Anatomía de una plantilla (plugin)

Cada plantilla vive en `templates/<name>/` y es **autocontenida**:

| archivo | rol |
|---|---|
| `template.js` | clase `extends BaseTemplate`, declara `static meta` (name, contentModel, modes, defaults) y `renderPlayer`/`renderEditor` |
| `player.js`   | renderiza el juego SOLO (y student-LIVE) |
| `editor.js`   | UI para que el docente cree/edite el contenido |
| `scorer.js`   | (opcional) lógica de puntuación **pura** |
| `index.js`    | llama `registerTemplate(Clase)` |

El **registry** (`core/registry.js`) valida el contrato al registrar y **falla
ruidosamente** (p. ej. si declara `modes.live` sin `getRoundPayload`/`scoreSubmission`).
Añadir una plantilla **no toca el core**: se crea la carpeta y se importa en los `main.*`.

## 3. Flujo SOLO (qué pasa al "Empezar")

```
home (#/home)
  └─ "Empezar" → #/play/:id
       └─ views/playerView.js  (página estilo Wordwall: marco 16/10, skin, fondo,
          fila "cambiar plantilla", acciones compartir/editar/duplicar)
            └─ core/player.js → runPlayer(sel, activity)
                 └─ getTemplate(activity.template).renderPlayer(...)
                      └─ al terminar: saveResult(...) + opts.onFinish(...)
```

- **`core/player.js`** es una cáscara fina: aplica skin/fondo de la actividad, delega en
  la plantilla, y revierte la presentación al salir (vía `lifecycle`).
- La plantilla maneja su propio bucle (preguntas/fichas/zonas), emite eventos de juego
  (`GameEvents`) y, al acabar, persiste el resultado.

## 4. Puntuación (pura y compartida)

La puntuación del quiz es una función pura `templates/quiz/scorer.js`
(`scoreQuizSubmission`) — **la misma** que usa el servidor en LIVE. Soporta:
- **flat**: `item.points || scoring.pointsPerCorrect`; penalización si `pointsPerWrong<0`.
- **kahoot** (avanzado en SOLO o en LIVE): `base*500 + speedBonus*(tiempo restante)`.
- `correct === null` cuando el ítem no es puntuable (sin clave de respuesta).

Las demás plantillas puntúan dentro de su `player.js` (deuda conocida: extraer a
módulos puros, ver `docs/auditoria-solo.md`). La normalización de respuestas
(tildes/mayúsculas) vive en `core/contentModels/qa.js` (`isCorrect`) y la clave de
respuestas de tildes/comas en `core/textMarks.js` — ambas **testeadas**.

## 5. Persistencia offline-first

- **`core/storage.js`**: localStorage es la **fuente de verdad** para lectura; las
  escrituras se guardan local al instante y se sincronizan al backend en segundo plano.
  Si el backend falla, marca `_unsynced` y reintenta al volver la red.
- **Backend intercambiable**: storage no conoce Supabase; habla con un **RemoteStore**
  (`adapters/`: `local` por defecto en desarrollo, `supabase`, `pocketbase` stub). Ver
  `adapters/README.md`.
- **`core/storageMerge.js`**: regla de reconciliación **last-write-wins** (remoto gana si
  es ≥ por `updatedAt`; protege ediciones locales más nuevas). **Testeada.**
- **Resultados** (`core/results.js`) también pasan por el adapter (no Supabase directo).

## 6. "Cambia de formato en un clic" (lo distintivo de Wordwall)

Motor puro en `kernel/content/`:
- `models.js` — valida cada contentModel (`validate() → {ok, errors}`).
- `convert.js` — conversores con degradación elegante (`qa↔pairs`, `qa→entries`,
  `pairs→entries`).
- `switch.js` — `switchOptions(activity, templates)` lista los formatos compatibles
  (directos + por conversión) y `applySwitch(...)` produce la nueva actividad sin mutar
  la original.

UI: panel **"Cambiar formato"** en el editor (`views/editView.js` + `views/switchTemplate.js`).
Las conversiones piden confirmación porque pueden transformar el contenido.

## 7. Presentación (estética desacoplada)

`presentation.skin` + `presentation.background` se aplican **scoped al marco** del juego
(no a la página) en `playerView`. Skins y fondos viven en `core/skins.js` /
`core/backgrounds.js`. La estética es una capa independiente del contenido y la mecánica.

## 8. Diseño táctil (1280×800)

- Marco fijo 16/10 (= 1280×800 de una pizarra) por defecto; `aspectRatio` por plantilla.
- `styles/touch.css`: sin delay de 300ms, hover desactivado en `(hover: none)`, targets
  grandes. Sin dependencia de hover ni clic derecho.

## 9. Qué está probado (lo corre el agente en cada cambio: `node tests/run.mjs`)

registry · migrate/normalize · kernel/content (validar/convertir/switch) · adapters ·
results (vía adapter) · events · lifecycle · routing · storageMerge · scoring del quiz ·
textMarks (tildes/comas) · lógica de la ruleta.

Lo **no** automatizable aquí (sin navegador headless): el render DOM y la interacción
táctil de las plantillas — eso se verifica en navegador (`python3 -m http.server`).

## 10. Deuda conocida del modo SOLO
Ver `docs/auditoria-solo.md`: bugs por arreglar (quiz kahoot maxScore, frase sin marcas
inacabable en tildes/comas) y la tarea estructural de **extraer la lógica de
acierto/puntuación** de match/memory/tildes/comas a módulos puros testeables (como ya
se hizo con quiz y wheel).
