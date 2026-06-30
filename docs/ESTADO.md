# Estado del proyecto — handoff para continuar

> Repo **duecaz/ac** · rama de trabajo **main** · versión actual **v1.31.4** · fecha 2026-06-15.
> JS vanilla (ES Modules), sin bundler, GitHub Pages + PocketBase. Este documento
> resume arquitectura, decisiones y lo pendiente para retomar en otro chat.
>
> ⚠️ **Snapshot antiguo:** Supabase fue **retirado** (backend ahora PocketBase) y la
> plantilla **Froggy eliminada**. Fuente de verdad actual: `CLAUDE.md`.

## Cómo trabajar (importante)
- El contenedor a veces clona un **mirror desfasado** → **antes de tocar nada**:
  `git fetch origin && git reset --hard origin/main`.
- Tests: `node tests/run.mjs` (23 suites de núcleo PURO; deben quedar verdes).
- Cambios **atómicos**: editar → test → commit → push a `main` → subir `VERSION` en `core/constants.js`.
- Verificar en navegador: **Ctrl+Shift+R** o botón 🔄 (recarga forzada; el banco
  compartido hace que limpiar caché ya NO pierda actividades).
- Panel admin: **#/admin**, contraseña **`fernando`** (candado cliente; la
  seguridad real es la RLS de Supabase).

## Arquitectura por capas
- **kernel/** = cerebro PURO sin DOM (testeable en Node): `session/engine` (vs·teams·solo),
  `session/memory`, `live/engine`, `content/` (models·convert·switch·qaAdapt), `contracts/`.
- **core/** = núcleo compartido (ver `core/README.md` para la agrupación por rol).
- **adapters/** = backend intercambiable (local · supabase · pocketbase) tras un contrato.
- **templates/** = plantillas-plugin autocontenidas (quiz, match, memory, tildes, comas, math, wheel).
- **views/** = UI; **styles/**; **supabase/** (migraciones + Edge Functions); **tests/**; **docs/**.

## Fuentes ÚNICAS de verdad (patrón estandarizado)
| Tema | Módulo |
|---|---|
| Modos (capacidad + disponibilidad) | `core/modes.js` |
| Datos del panel admin | `core/modeMatrix.js` |
| Chasis del editor | `core/editorShell.js` (+ `editorModes`) |
| Conversión de contenido | `kernel/content/{convert,switch,qaAdapt}.js` |
| Pantalla de fin | `core/resultScreen.js` |
| Equipos (colores/inputs) | `core/teams.js` |
| Puntuación acierto/fallo | `core/results.js` (applyPoints/trySaveResult) |
| Contrato de plantilla | `templates/base.js` + `kernel/contracts/template.js` |

## Decisiones clave
- **Banco compartido sin dueño**: actividades con `author_id = null`, lectura pública
  por RLS. Cualquiera ve/abre por URL sin login; NO dependen de la identidad del
  navegador → limpiar caché no las pierde (`sync()` repuebla). Caché local con
  **clave única** `ww.activities`.
- **Modos de juego**: Individual · VS · Equipos · En vivo · Tarea. Embebidos
  (solo/vs/equipos) corren dentro del escenario de la actividad; En vivo/Tarea
  abren su página. Gateo derivado en `core/modes.js` (dos niveles:
  `supportsTemplate` = capacidad de la clase; `isAvailable` = actividad concreta).
- **VS**: carrera (gana el PRIMERO en terminar); multitáctil (pointerdown);
  pantalla final centrada; feedback configurable (sonido/destello/confeti propio).
- **Conversión Matemáticas↔Quiz**: `adoptContent` por plantilla; math→quiz genera
  distractores didácticos (errores típicos por operación).
- **Cache-busting**: botón 🔄 (sin borrar datos) + entry con `?_=` al recargar.

## Hecho (resumen de la sesión)
Modos embebidos + contrato único · shell de editor compartido · panel admin con
tests ejecutables (alumnos virtuales VS/En vivo) · fix de identidad anónima +
banco compartido · conversión math↔quiz + editor blindado · confeti propio (sin
CDN) · 7 refactors de estandarización (resultScreen, applyPoints, teams, podio,
trySaveResult, adoptContent en contrato, limpieza banco) · docs vivos en docs/,
históricos en docs/historico/.

## Pendiente / próximos pasos
1. **Login con Google + migración** (privado): requiere activar en el panel de
   Supabase **Google provider** + **Manual linking** (Auth → Settings). Código ya
   listo (`core/auth.js linkIdentity`); el CTA "Entrar" está oculto hasta entonces.
   `openAuthModal/ensureAuthModal` quedan sin uso a propósito.
2. **Tests de DOM** (jsdom/Playwright): hoy solo hay smoke de builders puros
   (`tests/render.test.mjs`); el render real del editor/vistas se verifica a ojo.
   Requiere añadir package.json + deps. Habilitaría además la reorg física de core/.
3. **Reorg física de core/** en subcarpetas (documentada en `core/README.md`,
   no hecha por riesgo de imports sin test DOM).
4. **Distractores math→quiz** más didácticos (hoy: errores típicos básicos).
5. **Infra**: el entorno reclona un mirror viejo entre sesiones (revisar config web).

## Docs de referencia
`docs/modos-de-juego.md` (contrato de modos · ley) · `docs/panorama-actividades.md`
· `docs/identidad.md` (banco compartido + futuro login) · `docs/dev-local.md` ·
`templates/HOW_TO_ADD.md` · `core/README.md`.
