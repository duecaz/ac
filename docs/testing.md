# Testeo — suites, cómo correrlas y cómo verificar lo visual

> El MD de referencia para probar el proyecto. Tres niveles: **suite Node** (pura,
> CI), **self-tests en navegador** (panel admin) y **verificación headless**
> (Playwright) para lo que la suite no puede ver (DOM, táctil, layout).
>
> Documentos hermanos: qué hace cada actividad y feature → **`docs/panorama-actividades.md`**
> (su §5 tiene una tabla "qué suite prueba qué área") · contrato de CSS de actividad
> (relativo + tokens de skin) → **`docs/estilos-de-actividad.md`**.

## 1. Suite Node (la de CI)

```bash
node tests/run.mjs          # todas las suites, aborta con exit≠0 al primer fallo
node tests/textMarks.test.mjs   # una suite individual (cualquiera se corre sola)
```

Sin framework: cada suite usa `node:assert` + un contador `ok(msg)` que imprime
`✓`. Un `AssertionError` no capturado corta la ejecución (CI-friendly). Solo se
testea **lógica pura** (sin DOM, sin red): motores, scorers, parsers, colas.

### Mapa de suites (qué protege cada una)

**Registro y modos**
| Suite | Protege |
|---|---|
| `registry` | El registro valida el contrato de plantilla y falla ruidosamente. |
| `modes` | La fuente única de gateo de modos (`core/modes.js`): qué modo se ofrece a qué actividad. |
| `modeMatrix` | La matriz del panel admin se deriva bien del registro (capacidad + métodos). |

**Contenido y puntuación**
| Suite | Protege |
|---|---|
| `content` | Modelos de contenido y conversores (`kernel/content/`). |
| `qaAdapt` | Conversión de contenido `qa` entre Quiz y Matemáticas. |
| `scoring` | Puntuación incremental compartida; piso en 0 en un solo sitio. |
| `textMarks` | Clave de respuesta de Tildes/Comas: parseo de acentos/comas, `scoreMarks`, `scoreMarksPerHit` (1 punto por tilde, anti-trampa). |
| `wheel` | Lógica pura de la ruleta (normalización, selección). |
| `ballsort` | Reglas del tablero (canMove/applyMove/isWin), generador reproducible, scorer y contrato live/VS. |
| `diagram` | Modelo de contenido (`newPin`/`newEmpty`/`validate`), `scoreDiagramSubmission` (etiqueta↔su pin) y contrato de plantilla. |

**Motores de sesión (sin DOM ni backend)**
| Suite | Protege |
|---|---|
| `sessionEngine` | TEAMS (turnos) y VS (duelo paralelo) sobre el motor unificado. |
| `live` | Máquina de fases LIVE + filtro de apodos. |
| `liveEngine` | Una partida LIVE completa simulada en memoria. |
| `liveLocal` | El driver realtime local a través de "pestañas" (KV + canal compartidos). |
| `liveText` | LIVE con plantilla NO-quiz (Tildes) de punta a punta — prueba la generalización. |
| `memory` | El bucle voltear/emparejar/turno de Memoria en Equipos. |
| `simPlay` | Alumnos VIRTUALES jugando VS y En vivo sobre el motor puro (ciclo completo). |

**Modo SOLO (Wordwall)**
| Suite | Protege |
|---|---|
| `solo` | La base no-DOM del modo un-solo-dispositivo. |
| `soloPlayer` | El SequentialShell (`core/soloPlayer.js`): bucle de ítems, submit idempotente, finish temprano. |
| `soloTimer` | El countdown único (`core/soloTimer.js`) con scheduler inyectado → ticks deterministas. |
| `render` | Constructores de HTML puros: markup bien formado, enlaces del final de actividad. |
| `presentation` | Invariante anti-fuga de temas: un apply con scope no pinta el body. |

**Infraestructura**
| Suite | Protege |
|---|---|
| `core` | Plumbing: enrutado de persistencia de resultados, bus pub/sub. |
| `routing` | Rutas puras (`core/routing.js`). |
| `adapters` | Contrato de los drivers de backend (local · pocketbase). |
| `storageMerge` | Regla de merge offline-first. |
| `stability` | Wrappers seguros de localStorage (`ls.js`), pureza del escapador HTML. |
| `offlineQueue` | Garantías anti-pérdida: dedupe al encolar, single-flight, reintento parcial. |
| `clock` | Reloj inyectable: congelar `clock.now` hace determinista la lógica de dominio. |
| `assignments` | Reglas puras de Tareas + flujo del driver local. |
| `penDetector` | Clasificación lápiz/dedo/borrador/palma por tamaño de contacto + derivación de umbrales de calibración. |
| `styles` | Ratchet anti-regresión del CSS de juego: sin `font-size` congelada ni color pintable a pelo (regla → `docs/estilos-de-actividad.md`). `math`/`quiz` limpios; deuda actual en un BASELINE que no puede crecer. |
| `templateContract` | El contrato de plantilla EJECUTABLE (`core/templateContract.js`): las 12 con meta completa (`instructions` obligatorio), `contentModel` registrado, `defaultContent` válido y jugable, scorer con forma `{correct, points}`, `migrateContent` idempotente, `previewHtml` (miniatura del home) y carpeta ↔ registro consistentes. Una plantilla NUEVA queda cubierta sola al registrarse. |
| `norms` | Normas transversales de CLAUDE.md como CI (`core/normsCheck.js`): nunca `new ResizeObserver` directo, nunca `filter=` PB con `encodeURIComponent`, `kernel/` determinista (sin `Date.now()`). Recorre TODO el JS del repo. |
| `skins` | Contrato de skin (`core/skinContract.js`): cada skin define el set COMPLETO de tokens pintables (los del skin `default`), sin apoyarse en el fallback silencioso de `theme.css :root`. Cazó 5 skins que no declaraban `--ww-success/danger/warning`. |
| `newTemplate` | Self-test del generador (`tools/new-template.mjs`): genera en un scratch y corre los checkers reales (contrato, normas, CSS) sobre lo emitido — si el contrato crece y el esqueleto se queda viejo, falla aquí. También guardas del CLI (no pisa carpetas, `--out` no muta el repo). |

> **Los tres checkers de arriba también corren en el panel `#/admin`** ("Ejecutar
> tests", grupos *Contrato*, *Normas* y *Skins*): mismos módulos
> `core/templateContract.js`, `core/normsCheck.js` y `core/skinContract.js`, sin
> duplicar lógica. En el admin, Normas escanea por `fetch` los fuentes SERVIDOS
> (manifest + plantillas del registro) — humo del deploy; la autoridad exhaustiva
> es la suite Node.

### Añadir una suite
1. Crea `tests/mifeature.test.mjs` con el patrón estándar:
   ```js
   import assert from 'node:assert';
   let passed = 0;
   const ok = (m) => { passed++; console.log('  ✓', m); };
   // ... asserts ...
   console.log(`\nmifeature.test: ${passed} checks passed`);
   ```
2. Regístrala en `tests/run.mjs` (una línea `await import`).
3. Regla de oro: si el módulo toca DOM/red, **extrae la lógica pura** a `core/` o
   `kernel/` y testea eso (así nacieron `soloTimer`, `clock`, `penDetector`).

## 2. Self-tests en navegador (panel admin)

`#/admin` → botón **"Ejecutar tests"** corre `core/selftest.js` (`TOTAL_TESTS`
comprobaciones), incluida la simulación de alumnos virtuales VS/En vivo dentro
del navegador real. El mismo panel tiene **"Probar base de datos"**
(`core/dbDiag.js`): conexión, latencia y ciclo real lectura/escritura/borrado
contra el backend activo.

## 3. Verificación headless (layout, táctil, visual)

Lo que la suite Node no ve (¿el texto llena el marco?, ¿el trazo marca la
vocal?, ¿el panel VS se corta?) se verifica con Playwright + el Chromium
preinstalado. Receta que usamos en cada cambio visual:

```bash
# 1. Harness: un HTML mínimo que monta SOLO la pieza a probar
#    (importa el módulo real por ES modules + su CSS real).
# 2. Servir el repo (¡localhost, no 127.0.0.1 — el proxy lo intercepta!):
python3 -m http.server 8099 &
# 3. Script Playwright:
node - <<'EOF'
import('/opt/node22/lib/node_modules/playwright/index.mjs').then(async ({ chromium }) => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8099/_harness.html', { waitUntil: 'networkidle' });
  // medir: p.evaluate(() => ...clientHeight/scrollHeight/getComputedStyle...)
  // simular táctil: el.dispatchEvent(new PointerEvent('pointerdown', { pointerId, width, height, isPrimary, ... }))
  await p.screenshot({ path: 'out.png' });
  await b.close();
});
EOF
```

Trucos aprendidos (no re-descubrir):
- **Medir, no mirar**: `scrollHeight > clientHeight` detecta recortes que un
  screenshot pequeño esconde; `getComputedStyle(el).fontSize` verifica el fitter.
- **PointerEvent sintético** acepta `width/height` (tamaño de contacto) → sirve
  para probar el PenDetector y la palma (≥3 `pointerId` activos).
- **Multitáctil**: dos `pointerdown` con `pointerId` distintos en el mismo tick.
- Probar SIEMPRE en 2 tamaños: marco embebido (~720×450) y fullscreen (1280×800),
  y en vertical si el modo lo permite.
- **Salir de fullscreen = el resize más agresivo**: si un player observa su propio
  tamaño con `ResizeObserver` y el callback MUTA layout (redimensionar tarjetas,
  celdas…), usa `observeResize()` (`core/observeResize.js`, rAF-debounced) — un RO
  directo puede disparar el aviso "ResizeObserver loop…" justo ahí. Repro headless:
  cambiar `#ww-player-widget` de tamaño varias veces seguidas (simula
  fullscreen-enter/exit) y contar el evento `error` de window con ese mensaje.
- El harness es **temporal**: bórralo antes de commitear.

## 4. Qué NO está cubierto (y cómo se mitiga)

- **PocketBase real** (concurrencia del blob `state` en live): deuda documentada
  en CLAUDE.md; los tests usan el driver local.
- **Hardware táctil real** (pizarras que pierden `pointerup`): se simula el
  síntoma (punteros fantasma) en headless, pero la confirmación final es manual.
- **Audio/fullscreen**: requieren gesto de usuario; verificación manual.
