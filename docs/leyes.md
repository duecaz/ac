# LEYES del proyecto — índice único (qué · dónde está escrito · qué test la vigila)

> "Si es norma, es test." Aquí está TODA la ley en un sitio, con el archivo donde se
> explica y el test que la hace fallar en CI si la rompes. Antes de dudar de una
> convención, mira aquí. Verificación de todo: `node tests/run.mjs` (y `#/admin` →
> "Ejecutar tests" corre el mismo escáner en el navegador).

## 1) Versión — en CADA commit y en CADA respuesta
- Sube `VERSION` en `core/constants.js` (patch: `x.y.z → x.y.z+1`), nunca hacia atrás.
- Indica la versión `(vX.Y.Z)` en la respuesta del chat; commit y respuesta deben coincidir.
- **Dónde**: `CLAUDE.md §1` · **Por qué**: caché + service worker dependen de que avance.

## 2) Todo a `main` (sirve la web)
- `main` es GitHub Pages → **aulareto.com** (CNAME). Cada commit se propaga a `main`
  (permiso permanente) y por legado a `ACTIVIDAD2`.
- **Dónde**: `CLAUDE.md §2`.

## 3) ⚖️ LEYES DE MAQUETACIÓN Y COLOR DEL JUEGO ("las leyes de los input")
Esto es lo que buscabas: el **contrato de estilos del PLAYER**.
- **NADA con tamaño fijo en el player**: todo relativo — unidades de contenedor (`cq*`),
  `%`, o cálculo JS (`fitLayout`/`fitPassage`). Prohibido `px`/`rem` que congelen el
  crecimiento. `max(12px, Xcqmin)` vale como PISO de legibilidad, nunca como techo.
  (El EDITOR sí puede usar `px`: es un formulario, no el juego.)
- **Colores pintables por token `var(--ww-*)`** para que los skins recoloreen — nunca
  `#hex` a pelo, salvo neutros (`#fff/#000`) y acierto/error (verde/rojo).
- **Dónde se explica**: `docs/estilos-de-actividad.md` (contrato completo + ejemplares
  `math.css`/`quiz.css`; §3b andamio de regiones ww-scaffold/rail/stage).
- **Test que lo vigila**: `tests/styles.test.mjs` (ratchet: una actividad nueva nace
  limpia; lista `GAME` = CSS de juego escaneado, `EXCLUDED` = chrome/paletas).

## 4) ResizeObserver → `observeResize()`
- Nunca `new ResizeObserver(cb)` directo si el callback muta layout: usa
  `observeResize()` (`core/observeResize.js`, rAF-debounced).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 5) Filtros PocketBase → `pbEscape`/`pbFilterParam`
- SIEMPRE `core/pbFilter.js`, NUNCA `encodeURIComponent` a pelo sobre el valor (no
  escapa la comilla simple de `campo='valor'`).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 6) `kernel/` sin `Date.now()` → `clock.now()`
- La lógica de dominio usa `core/clock.js` (`clock.now()`), inyectable → tests
  deterministas. (Pendiente: deadlines de hostLive/studentLive.)
- **Dónde**: `CLAUDE.md` deuda §2 · **Test**: `tests/norms.test.mjs` + `tests/clock.test.mjs`.

## 7) IDs con `rid()` (`core/ids.js`)
- Nunca `Math.random().toString(36)` a mano. Prefijos: `q_ p_ it_ w_ ps_ pin_`.
- **Dónde**: `CLAUDE.md` estándares.

## 8) Contrato de plantilla
- Cada plantilla: `meta.instructions` (obligatorio), modelo registrado, scorer que
  devuelve `{correct, points}`, `migrate` idempotente, carpeta↔registro. Plantillas con
  `modes.live` declaran `getRoundPayload`+`scoreSubmission`.
- **Dónde**: `docs/sistema-de-plantillas.md` · **Test**: `tests/templateContract.test.mjs`.
- **Generador**: `node tools/new-template.mjs <name> --model qa [--vs] [--live]` (nace
  cumpliendo el contrato) · Diagnóstico: `node tools/check-template.mjs`.

## 9) Skins completos
- Cada skin define el set COMPLETO de tokens de `default` (sin caer al fallback `:root`).
- **Test**: `tests/skins.test.mjs` (+ `core/skinContract.js`).

## 10) Handlers delegados + `clearListeners(APP)`
- Las vistas montan en `#app` y registran con `on(APP, …)` (delegación). El router llama
  `clearListeners(APP)` en `setBeforeResolve` antes de cada ruta — NUNCA lo quites.
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/events.test.mjs`.

## 11) Pantalla de inicio obligatoria
- Todo modo Individual pasa por `views/startScreen.js` (título + instrucciones + Iniciar
  → fullscreen). El ejercicio queda oculto hasta Iniciar.

## 12) Registro único + arranque
- Las 13 plantillas se registran solo en `core/registerTemplates.js`; sonidos/efectos/
  versión/mute se cablean solo en `core/boot.js`. Los `main.*.js` no repiten ese wiring.

## 13) Gama baja `ww-lite` (`core/perf.js`)
- ≤4 núcleos o ≤2GB → `ww-lite` en `<html>`; sin bucles rAF continuos en reposo. El VS
  debe ir fluido en pizarras A55.

## 14) Puntos (`core/scoring/`)
- `basePoints`/`wrongPoints`/`useKahoot`. Tildes VS: 1 punto fijo por tilde buena
  (`scoreMarksPerHit`).

## ── LEYES DE DATOS / SEGURIDAD (biblioteca pública) ──────────────────────────

## 15) Solo PocketBase (Supabase RETIRADO)
- Backends válidos: `local` (dev) y `pocketbase` (prod, `PB_URL`). Nada de Supabase.
- **Dónde**: `CLAUDE.md` arquitectura · infra real en `docs/infraestructura-pb.md`.

## 16) `owner` (permiso) ≠ `author` (etiqueta) ≠ `profiles` (perfil)
- `owner` = columna PB de permisos (la pone `remoteStore`). `author = {id,name}` =
  etiqueta LIGERA dentro del JSON de la actividad (para las tarjetas). El **perfil rico**
  (colegio/frase/avatar) vive en la colección pública `profiles`, NO en la actividad.
- **Dónde**: `docs/infraestructura-pb.md` · `core/profile.js`.

## 17) Reglas PB endurecidas (U1)
- `activities`: crear exige sesión + ser tu owner; editar/borrar solo owner o admin;
  público lee lo `visibility='public'`. `users`/`profiles`/`likes`/`reports` con sus
  reglas (ver infra). Fuente en código: `views/adminView.js` DEFS = `setup-pocketbase.ps1`.
- **Verificación**: `bash tools/check-pb.sh` (incluye checks negativos: crear anónimo y
  signup DEBEN fallar). **Nunca** `sort=-updated/-created` sobre `activities` (rompe).
- **Dónde**: `docs/infraestructura-pb.md` · `docs/handoff-seguridad-pb.md`.

## 18) XSS: escapar SIEMPRE lo que viene de datos → `escapeHtml`
- Todo valor de la actividad/usuario que entra al DOM pasa por `escapeHtml`
  (`core/html.js`). La defensa del token en localStorage ES esta disciplina.
- **Test**: `tests/security.test.mjs`.

## 19) Credenciales de PocketBase/Pi — NUNCA en el chat
- Superadmin PB y contraseñas se teclean en la Pi con `read -rsp`; a Claude solo se le
  pega la SALIDA. Claude redacta los comandos, el usuario los ejecuta.
- **Dónde**: `docs/infraestructura-pb.md` (regla de oro).

## 20) OAuth redirect canónico
- `oauthRedirectUrl()` normaliza `/teacher` → `/teacher.html` (una sola URI autorizada en
  Google) y se preserva el `#hash` para volver a donde estabas.
- **Test**: `tests/oauth.test.mjs`.

---
### Cómo se auto-verifica todo
`node tests/run.mjs` corre TODAS las suites. Los escáneres compartidos
(`core/normsCheck.js` / `core/templateContract.js` / `core/skinContract.js`) corren
también en `#/admin` → "Ejecutar tests". Si añades una norma nueva: **escríbela como
test**, no solo en un MD.
