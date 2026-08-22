// RED DE SEGURIDAD Nº2 — matriz JUGABLE: monta CADA plantilla en CADA modo que
// declara soportar y comprueba que arranca sin errores.
//
// Por qué existe: QA probó 49 combinaciones plantilla×modo a mano y encontró
// crashes de primera pantalla ("Memoria por equipos NO ABRE"). Eso lo debe
// encontrar una máquina en cada commit, no una persona en una pizarra.
// Complementa a tests/moduleRefs.test.mjs (que caza los imports olvidados sin
// navegador): esto ejecuta el código de verdad y ve lo que el escáner no puede.
//
// Cada actividad se siembra con el defaultContent() DE LA PROPIA PLANTILLA, así
// que no hay fixtures que mantener: si una plantilla cambia su modelo, la matriz
// la sigue.
//
//   node tools/matrix-smoke.mjs            # todas · sale 1 si algo falla
//   node tools/matrix-smoke.mjs quiz math  # solo esas plantillas
//   PORT=8123 node tools/matrix-smoke.mjs
//
// Requiere: python3 (servidor estático) y el Chromium preinstalado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8477);
const BASE = `http://127.0.0.1:${PORT}`;
const only = process.argv.slice(2);
const { playRound, MECANICAS } = await import('./helpers/roundDrivers.mjs');
const { medirLegibilidad } = await import('./helpers/legibilidad.mjs');

// Modos que esta matriz sabe conducir hoy. `live` cubre el LADO DEL HOST (crear
// sala + lobby con PIN), que es donde vive la máquina de fases; el lado del alumno
// necesita un segundo contexto de navegador y queda para un runner aparte, igual
// que Tarea. No se silencian: se listan como "no cubierto" al final.
const DRIVERS = {
  solo:  { route: (id) => `#/play/${id}`,  start: '.ww-start-go',   ready: '#ww-player-widget *' },
  vs:    { route: (id) => `#/vs/${id}`,    start: '.ww-mode-start', ready: '.vs-panel, .vs-arena, .vs-board' },
  teams: { route: (id) => `#/teams/${id}`, start: '.ww-mode-start', ready: '.teams-arena, .memo-arena, .teams-card' },
  // El host navega solo de #/launch/:id a #/host/:code al crear la sala; no hay
  // botón "empezar" que pulsar hasta que entra un alumno, así que basta con que
  // el lobby aparezca (es donde monta la vista y arrancan sus relojes).
  live:  { route: (id) => `#/launch/${id}`, ready: '#btn-start' },
};
const MEMORY_TEAMS_ROUTE = (id) => `#/memory/${id}`;

// EL CONTROL DE ENVÍO QUE **ES** LA MECÁNICA — excepción DECLARADA al rol
// `edu-send` (docs/estilos-de-actividad.md §3b0). No es una lista de perdones:
// dice por qué sacar ese control a una franja propia EMPEORARÍA el juego, y sin
// motivo escrito no entra.
//
// Es UNA sola. Empezó siendo tres, con la Ruleta y Abre Cajas dentro «porque su
// botón es la mecánica» — pero esos dos no marcan NINGÚN control con
// `data-ww-submit`: su acción es un gesto, no un envío, así que la excepción
// nunca se aplicaba y el informe presumía de un control que no existe. Una
// excepción que no protege nada es una mentira mantenida.
const ENVIO_ES_MECANICA = {
  math: 'el ✓ es una TECLA del teclado — sacarlo suma un toque a cada respuesta (§29)',
};

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));

await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// TOCABLE, no solo presente. `querySelector` dice que el control existe; el dedo
// del profe dice otra cosa cuando algo se pinta encima (el marcador del duelo
// tapaba el botón de pantalla completa con z-index y NADIE lo vio: existía, se
// veía a medias y no se podía pulsar). Esta comprobación pregunta lo único que
// importa: si tocas el centro del control, ¿quién recibe el toque?
const TOCABLE = `(sel) => {
  // Un control puede tener DOS formas según la pantalla (pantalla completa: la
  // esquina del marco o el botón que aloja la barra de la ronda). Se comprueba
  // la que está PUESTA; si todas están retiradas, se cae a la primera y el
  // veredicto de abajo la declara invisible, que es lo correcto.
  const todos = [...document.querySelectorAll(sel)];
  const el = todos.find(e => {
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }) || todos[0];
  if (!el) return 'ausente';
  // Como haría cualquiera con el dedo: si el control cae fuera de la ventana
  // se BAJA hasta él antes de tocar (dueño, 2026-08-18 — la página de jugar
  // ganó una cabecera arriba del marco y el control quedaba a un scroll de
  // distancia; elementFromPoint en un punto fuera del viewport siempre
  // devuelve null, así que sin este scroll el veredicto sería "tapado por
  // nadie" aunque el control se vea y funcione perfectamente).
  let r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) {
    el.scrollIntoView({ block: 'center' });
    r = el.getBoundingClientRect();
  }
  if (!r.width || !r.height) return 'sin tamaño';
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return 'fuera de pantalla';
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return 'invisible';
  if (el.disabled) return 'deshabilitado';
  const top = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
  if (!top || !(el === top || el.contains(top) || top.contains(el))) {
    return 'tapado por ' + String(top?.className || top?.tagName || '?').slice(0, 40);
  }
  return 'ok';
}`;
const tocable = (sel) => page.evaluate(`(${TOCABLE})(${JSON.stringify(sel)})`);

// UN CHIP NO PISA TEXTO DEL JUEGO (ronda 2026-08-17: en la Sopa las pastillas
// tapaban las letras). El HUD no captura toques (pointer-events: none), así que
// el hit-testing no lo ve: el daño es LEGIBLE — texto del juego debajo de una
// pastilla. Se miden las LETRAS (Range), no la caja: un enunciado centrado
// tiene caja a todo el ancho y acusaría a Quiz/Globos sin tocar nada. Se pasa
// al montar, quieto: lo que se MUEVE por debajo (un globo) está permitido.
const FN_TAPADO = `() => {
  const w = document.querySelector('#ww-player-widget');
  const hud = w?.querySelector('.edu-hud');
  if (!hud) return null;
  const vis = (e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; };
  const chips = [...hud.querySelectorAll('.edu-hud__chip')].filter(c => !c.hidden && vis(c));
  const conTexto = [...w.querySelectorAll('*')].filter(e =>
    !hud.contains(e) && vis(e)
    && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  for (const c of chips) {
    const a = c.getBoundingClientRect();
    if (!a.width) continue;
    for (const e of conTexto) {
      for (const nodo of e.childNodes) {
        if (nodo.nodeType !== 3 || !nodo.textContent.trim()) continue;
        const rango = document.createRange();
        rango.selectNodeContents(nodo);
        for (const b of rango.getClientRects()) {
          const solape = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
                       * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (solape > 0.3 * a.width * a.height) {
            return '«' + c.textContent.trim() + '» pisa «' + e.textContent.trim().slice(0, 24) + '»';
          }
        }
      }
    }
  }
  return null;
}`;

// Errores del navegador durante el paso actual (se vacía entre combinaciones).
// Se ignoran los de RED: este sandbox no tiene salida a internet, así que una
// imagen o fuente que no carga es ruido del entorno, no un fallo de la app.
const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|favicon/i;
let bucket = [];
const note = (msg) => { const s = String(msg).split('\n')[0]; if (!NOISE.test(s)) bucket.push(s); };
page.on('pageerror', e => note(e.message));
page.on('console', m => { if (m.type() === 'error') note(m.text()); });

// El sandbox no tiene red saliente: el confetti viene de un CDN → lo sustituimos
// por un módulo vacío para que su fallo no contamine el informe.
await page.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));

await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });

// Siembra: una actividad por plantilla, hecha con SU PROPIO defaultContent().
// Los lienzos DECLARADOS por cada fondo (`BACKGROUNDS[x].colorBase`), para que
// el medidor pueda juzgar el texto sobre una textura: un degradado no tiene
// color computado y sin esto se contaba como «no medible».
const LIENZOS = await page.evaluate(async () => {
  const { BACKGROUNDS } = await import('/core/backgrounds.js');
  return Object.fromEntries(Object.entries(BACKGROUNDS)
    .filter(([, d]) => d.colorBase).map(([n, d]) => [`bg-${n}`, d.colorBase]));
});

const seeded = await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { listTemplates } = await import('/core/registry.js');
  const storage = await import('/core/storage.js');
  const out = [];
  for (const T of listTemplates()) {
    const m = T.meta;
    const a = {
      id: `mx_${m.name}`, template: m.name, title: `Matriz · ${m.label || m.name}`,
      content: m.defaultContent ? m.defaultContent() : {},
      rules: m.defaultRules ? m.defaultRules() : {},
      scoring: m.defaultScoring ? m.defaultScoring() : {},
      updatedAt: new Date().toISOString(),
    };
    if (T.migrateContent) { try { a.content = T.migrateContent(a.content) ?? a.content; } catch {} }
    try { storage.save(a); out.push({ name: m.name, label: m.label || m.name, id: a.id }); }
    catch (e) { out.push({ name: m.name, label: m.label || m.name, id: a.id, seedError: e.message }); }
  }
  return out;
});

// Modos que cada plantilla DECLARA soportar (misma fuente que el panel de modos).
const caps = await page.evaluate(async () => {
  const { templateCapabilities } = await import('/core/modeMatrix.js');
  return templateCapabilities().map(c => ({ name: c.name, modes: c.modes.map(m => ({ id: m.id, supported: m.supported })) }));
});

// Lo que cada plantilla DECLARA sobre su envío (`meta.play.submit`), para
// contrastarlo con el DOM real del panel VS.
const submitKind = await page.evaluate(async () => {
  const { listTemplates } = await import('/core/registry.js');
  return Object.fromEntries(listTemplates().map(T => [T.meta.name, T.meta.play?.submit]));
});

// Lo que cada plantilla DECLARA sobre su maquetación en el panel (`meta.panelFit`),
// para contrastarlo con el MARCO real (§0: la plantilla declara, la plataforma obedece).
const panelFitKind = await page.evaluate(async () => {
  const { listTemplates } = await import('/core/registry.js');
  return Object.fromEntries(listTemplates().map(T => [T.meta.name, T.meta.panelFit || 'fill']));
});

// PISTAS DE LA SEMILLA (no del veredicto, §27): la respuesta que el test sembró
// para el teclado, y las celdas de la primera palabra colocada en la sopa. Se
// las pide a la PROPIA plantilla con su defaultContent — el test no resuelve
// nada, solo sabe qué puso.
const hints = await page.evaluate(async () => {
  const { listTemplates } = await import('/core/registry.js');
  const out = {};
  for (const T of listTemplates()) {
    const m = T.meta;
    const a = { id: `mx_${m.name}`, template: m.name, content: m.defaultContent ? m.defaultContent() : {},
                rules: m.defaultRules ? m.defaultRules() : {}, scoring: m.defaultScoring ? m.defaultScoring() : {} };
    const h = {};
    const it = (a.content.items || [])[0];
    if (it && it.answer != null) h.answer = String(it.answer);
    try {
      const p = T.getRoundPayload?.(a, { itemIndex: 0, side: 'left' });
      const placed = p?.placed?.[0];
      if (placed?.cells) h.wordCells = placed.cells;
    } catch { /* la plantilla no tiene payload: sin pistas */ }
    out[m.name] = h;
  }
  return out;
});

const results = [];
const taps = [];
const hits = [];   // hit-testing de los controles críticos
const rounds = [];  // rondas JUGADAS con un toque real (cola #3)
const marcos = [];  // el marco del panel VS contra lo que declara meta.panelFit
const formaBad = [];  // piezas cuadradas que se deforman al cambiar la ventana
const presupuesto = [];
const roles = [];        // LOS CUATRO ROLES de la diagramación (edu-hud · edu-topbar · edu-sec · edu-send)
const legibilidad = [];   // §29 · informe de tamaño (no veredicto: ver el porqué abajo)
for (const t of seeded) {
  if (only.length && !only.includes(t.name)) continue;
  const cap = caps.find(c => c.name === t.name);
  for (const [mode, drv] of Object.entries(DRIVERS)) {
    const supported = mode === 'solo'
      ? (cap?.modes.find(m => m.id === 'solo')?.supported ?? true)
      : !!cap?.modes.find(m => m.id === (mode === 'live' ? 'live' : mode))?.supported;
    if (!supported) { results.push({ t: t.name, label: t.label, mode, status: 'n/a' }); continue; }

    bucket = [];
    const route = (mode === 'teams' && t.name === 'memory') ? MEMORY_TEAMS_ROUTE(t.id) : drv.route(t.id);
    let status = 'ok', detail = '';
    try {
      await page.evaluate(() => { location.hash = '#/mine'; });
      await page.waitForTimeout(120);
      await page.evaluate(h => { location.hash = h; }, route);
      if (drv.start) {
        // 1) La pantalla de arranque (inicio/setup) aparece.
        await page.waitForSelector(drv.start, { timeout: 9000 });
        // 2) Empezar → el juego se monta de verdad.
        await page.click(drv.start);
      }
      await page.waitForSelector(drv.ready, { timeout: 12000 });
      await page.waitForTimeout(350);   // deja correr timers/animaciones de entrada
      if (bucket.length) { status = 'error'; detail = bucket[0]; }
      // AUDITORÍA DE TOQUES (VS): cuántos controles de envío tiene la ronda de
      // verdad, contra lo que la plantilla DECLARA en `meta.play.submit`. El
      // reporte de clase fue "en VS son dos botones, el check y el enviar": sin
      // esta cuenta, esa pregunta solo se puede responder jugando.
      // PANTALLA COMPLETA, TOCABLE (no solo presente). El botón de la esquina
      // EXISTÍA en VS y aun así no se podía usar: el marcador del duelo
      // (`.vss-bar`, z-index 10) quedaba por encima. Un `querySelector` decía que
      // sí; el dedo del profe decía que no. Por eso aquí se comprueba con
      // hit-testing: quién recibe el toque en el centro del botón.
      if (['solo', 'vs', 'teams'].includes(mode) && status === 'ok') {
        // Los controles de los que depende una clase: si uno no se puede tocar,
        // el profe se queda parado con 33 críos mirando. Se comprueban DONDE
        // aparecen, no en abstracto.
        // `gateable`: el control PUEDE estar legítimamente deshabilitado en este
        // instante ("Revelar" no se activa hasta que el equipo elige respuesta).
        // Para esos, deshabilitado es correcto; lo que nunca es correcto —para
        // ninguno— es estar TAPADO, invisible o sin tamaño: eso es un fallo de
        // maquetación que el profe descubre pulsando y no pasando nada.
        const CONTROLES = [
          // Las DOS formas del mismo control: la esquina flotante del marco y,
          // cuando la ronda pinta su propia barra (Tildes/Comas), el botón que
          // esa barra aloja. Buscar solo la esquina daría «ausente» —y por tanto
          // verde— justo en las plantillas donde el dueño lo encontró mal puesto.
          { nombre: 'pantalla completa', sel: '#ww-frame .ww-fs-btn--corner, #ww-frame .tc-bar .ww-fs-btn' },
          ...(submitKind[t.name] === 'boton' ? [{ nombre: 'envío de la ronda', sel: '#ww-frame [data-ww-submit]' }] : []),
          ...(mode === 'teams' ? [{ nombre: 'revelar (Equipos)', sel: '#teams-reveal', gateable: true }] : []),
        ];
        for (const { nombre, sel, gateable } of CONTROLES) {
          const estado = await tocable(sel);
          // Un control que esta combinación no pinta no es un fallo: lo que no se
          // tolera es que ESTÉ y no se pueda tocar.
          if (estado === 'ausente') continue;
          const mal = estado !== 'ok' && !(gateable && estado === 'deshabilitado');
          if (mal) { status = 'error'; detail = `${nombre}: ${estado}`; }
          hits.push({ label: t.label, mode, control: nombre, estado, mal });
        }
      }
      // R2b (norte §6b, ley §28): quien toca la pizarra es UN ALUMNO sobre la
      // sesión del profe. Dentro del marco de juego no puede existir ningún
      // control destructivo ni de identidad — con un dedo curioso y la clase
      // mirando, "no debería tocarlo" no protege nada; que NO ESTÉ, sí. Por
      // selectores concretos y no por texto: el teclado numérico tiene un
      // "Borrar" (un dígito) totalmente legítimo.
      if (['solo', 'vs', 'teams'].includes(mode) && status === 'ok') {
        const peligros = await page.evaluate(() => {
          const PROHIBIDO = [
            ['borrar actividad', '.act-del, .icon-btn.del'],
            ['editar contenido', '.act-edit, .icon-btn.edit'],
            ['publicar/despublicar', '.pub-toggle'],
            ['papelera', '.bi-trash3, .bi-trash-fill'],
            ['sesión del profe', '#ww-auth-slot .ww-auth__menu:not([hidden])'],
          ];
          const frame = document.getElementById('ww-frame');
          if (!frame) return [];
          return PROHIBIDO.filter(([, sel]) => frame.querySelector(sel)).map(([que]) => que);
        });
        if (peligros.length) { status = 'error'; detail = `R2b: control(es) de profe DENTRO del juego: ${peligros.join(' · ')}`; }
      }
      // ── UNA SOLA TARJETA, Y EL MANDO DENTRO DE SU BARRA ─────────────────
      // Las dos correcciones del dueño (2026-08-15, con captura) en la ronda de
      // Tildes/Comas: «hay doble marco, es solo la hoja» y «el botón de pantalla
      // completa está fuera de la barra». Se miden con ESTILOS COMPUTADOS y con
      // la caja real del botón, no leyendo el CSS: la regla que aquieta el marco
      // usa `:has()` y ya perdió una vez por especificidad frente a
      // backgrounds.css — existía, estaba bien escrita, y no pintaba nada.
      if (status === 'ok') {
        const hoja = await page.evaluate(() => {
          const marco = document.getElementById('ww-frame');
          const round = marco?.querySelector('.tc-round');
          if (!marco || !round) return null;                  // otra plantilla
          const cs = getComputedStyle(marco);
          const esquinas = [...marco.querySelectorAll('.ww-fs-btn--corner')]
            .filter(b => getComputedStyle(b).display !== 'none').length;
          // Solo la ronda a pantalla entera aloja el botón (`.tc-bar--fs`); en
          // el duelo hay DOS rondas y el mando sigue siendo la esquina del marco.
          const barra = marco.querySelector('.tc-bar--fs');
          const fs = barra?.querySelector('.ww-fs-btn') || null;
          let dentro = false;
          if (fs && barra) {
            const b = fs.getBoundingClientRect(), r = barra.getBoundingClientRect();
            dentro = b.top >= r.top - 1 && b.bottom <= r.bottom + 1
                  && b.left >= r.left - 1 && b.right <= r.right + 1;
          }
          return {
            sombra: cs.boxShadow, radio: parseFloat(cs.borderTopLeftRadius) || 0,
            esquinas, aloja: !!barra, hayFs: !!fs, dentro,
            rondas: marco.querySelectorAll('.tc-round').length,
            switches: marco.querySelectorAll('.tc-switch').length,
          };
        });
        if (hoja) {
          const fallos = [];
          if (hoja.sombra && hoja.sombra !== 'none') fallos.push('el marco sigue proyectando sombra de tarjeta (doble marco)');
          if (hoja.radio > 0) fallos.push(`el marco conserva esquinas redondas (${hoja.radio}px): sigue leyéndose como una segunda tarjeta`);
          if (hoja.aloja) {
            if (hoja.esquinas) fallos.push('la esquina flotante de pantalla completa sigue puesta (dos mandos para lo mismo)');
            if (!hoja.hayFs) fallos.push('la barra no aloja el botón de pantalla completa');
            else if (!hoja.dentro) fallos.push('el botón de pantalla completa se sale de la caja de la barra');
          } else if (!hoja.esquinas) {
            fallos.push('sin barra que lo aloje (duelo), la esquina del marco tiene que seguir puesta');
          }
          if (hoja.switches !== hoja.rondas) fallos.push(`UN interruptor por ronda: ${hoja.rondas} ronda(s), ${hoja.switches} mando(s)`);
          if (fallos.length) { status = 'error'; detail = `hoja: ${fallos[0]}`; }
          hits.push({ label: t.label, mode, control: 'hoja (marco único + mando en barra)', estado: fallos.length ? fallos[0] : 'ok', mal: !!fallos.length });
        }
      }
      // ── LA RONDA SE JUEGA, no solo se monta (cola #3 del norte) ─────────
      // Un gesto REAL en los tres modos embebidos. La vara: que el juego
      // RESPONDA (progreso o re-render). Quien juzga es la app.
      if (['solo', 'vs', 'teams'].includes(mode) && status === 'ok') {
        // UN selector por modo (una coma aquí partiría el CSS: `.a, .b .rq-opt`
        // no es lo que parece — me costó cuatro falsos fallos descubrirlo).
        const CAJA = { solo: '#ww-player-widget', vs: '#vs-body-left', teams: '#teams-round' };
        // La Memoria por Equipos es una vista PROPIA (#/memory/:id, tablero
        // compartido): no hay #teams-round ni "Revelar" — voltear repinta.
        const memoTeams = mode === 'teams' && t.name === 'memory';
        const caja = memoTeams ? '.teams-arena' : CAJA[mode];
        const prog = mode === 'vs' ? '#vs-prog-left' : '';
        // En Equipos el gesto no avanza la ronda: HABILITA "Revelar" (el equipo
        // elige, el docente revela). Ahí se mira ese efecto, no el avance.
        const efecto = (mode === 'teams' && !memoTeams) ? '#teams-reveal' : '';
        // ⚖️ LEY §29 · PRESUPUESTO (norte §2b) — dos de los números con más peso,
        // medidos aquí porque es donde de verdad se juega una ronda:
        //  1. NINGÚN DIÁLOGO del navegador durante el juego. "Pasar a la
        //     siguiente pregunta: 1 toque, sin diálogos ni confirmaciones" es EL
        //     número que decide si el profe vuelve a usar la actividad, y un
        //     `confirm()` metido "por seguridad" lo dobla sin que nadie lo note.
        await page.evaluate(() => {
          window.__wwDialogos = [];
          for (const k of ['confirm', 'alert', 'prompt']) {
            window[k] = (...a) => { window.__wwDialogos.push(`${k}(${String(a[0] ?? '').slice(0, 40)})`); return true; };
          }
        });
        const r = await playRound(page, caja, { ...(hints[t.name] || {}), progressSel: prog, effectSel: efecto });
        const dialogos = await page.evaluate(() => window.__wwDialogos || []);
        if (dialogos.length) { status = 'error'; detail = `§29: la ronda abre diálogo(s) del navegador: ${dialogos.join(' · ')}`; }
        //  2. REVELAR NUNCA SOLO (Equipos). "La clase responde en voz alta
        //     primero; si la pantalla se adelanta, mata la participación." Se
        //     espera SIN TOCAR NADA y la respuesta no puede aparecer: el
        //     veredicto lo destapa el docente con su botón, o no se destapa.
        if (mode === 'teams' && status === 'ok' && r.mecanica) {
          await page.waitForTimeout(2600);
          const soloSeReveló = await page.evaluate(() => !!document.querySelector('.teams-answer'));
          if (soloSeReveló) { status = 'error'; detail = '§29: la respuesta se reveló SOLA (sin que el docente lo decidiera)'; }
          presupuesto.push({ label: t.label, mode, regla: 'revelar solo con el docente', ok: !soloSeReveló });
        }
        presupuesto.push({ label: t.label, mode, regla: 'jugar sin diálogos', ok: !dialogos.length });
        //  2b. LOS CUATRO ROLES DE LA DIAGRAMACIÓN (decisión del dueño,
        //     2026-08-17 · docs/estilos-de-actividad.md §3b0). Se comprueba
        //     MONTANDO, no leyendo el código: los roles son del DOM que ve el
        //     alumno. Tres reglas, todas descubiertas por escaneo:
        //       · UN `edu-hud` (los indicadores flotan; nadie pinta su franja)
        //       · al menos UNA sección de juego con nombre (`edu-sec`) — sin
        //         nombre no hay reparto posible (fue el caso de Memoria)
        //       · como mucho UN `edu-send`, y todo control de envío vive dentro
        //     La excepción es el control que ES la mecánica; va DECLARADA abajo
        //     con su motivo, nunca en silencio.
        if (mode === 'solo' && status === 'ok') {
          const rr = await page.evaluate(() => {
            const w = document.querySelector('#ww-player-widget');
            if (!w) return null;
            const vis = (e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; };
            const envios = [...w.querySelectorAll('[data-ww-submit]')].filter(vis);
            return {
              hud: w.querySelectorAll('.edu-hud').length,
              // CON NOMBRE: `edu-sec` a secas no identifica nada, y el caso que
              // originó la regla (la rejilla suelta de Memoria) volvería a pasar
              // en verde. Se exige el modificador.
              sec: w.querySelectorAll('[class*="edu-sec--"]').length,
              send: w.querySelectorAll('.edu-send').length,
              fuera: envios.filter(b => !b.closest('.edu-send')).length,
              // DÓNDE ESTÁ, no solo si está. Contar nodos daba verde a Pelotas
              // con el chip «Movs: 0» a 213 px del borde, en mitad del tablero:
              // el HUD se ancla a quien lo contiene, y si esa raíz no llena su
              // hueco, «la esquina» es la esquina de un trozo, no del marco.
              // Se mide el chip VISIBLE más alto y a la izquierda.
              esquina: (() => {
                const hud = w.querySelector('.edu-hud');
                if (!hud) return null;
                const chip = [...hud.querySelectorAll('.edu-hud__chip')].find(c => !c.hidden && vis(c));
                const r = (chip || hud).getBoundingClientRect();
                const rw = w.getBoundingClientRect();
                return { top: Math.round(r.top - rw.top), left: Math.round(r.left - rw.left) };
              })(),
              // UN CHIP NO PISA TEXTO DEL JUEGO (ronda 2026-08-17: en la Sopa
              // las pastillas tapaban las letras). El HUD no captura toques
              // (pointer-events: none), así que el hit-testing de arriba no lo
              // ve: el daño es LEGIBLE, no táctil — texto del juego debajo de
              // una pastilla. Se mide al montar: cada chip visible contra cada
              // nodo con texto propio fuera del HUD; solape >30 % del chip =
              // tapado. Al montar, no jugando: lo que se MUEVE por debajo (un
              // globo subiendo) está permitido por diseño.
            };
          });
          if (rr) rr.tapado = await page.evaluate(`(${FN_TAPADO})()`);
          // EN VERTICAL TAMBIÉN: a 1280×800 la rejilla centrada no llega arriba
          // y el solape que reportó el compañero (móvil/marco alto) no existe.
          // Se estrecha la ventana, se re-mide, y se restaura.
          // Tres geometrías: la de siembra (1280×800), un móvil en vertical y
          // un apaisado BAJO (donde a un tablero le falta alto, crece hasta el
          // borde y mete sus letras bajo los chips — el caso de la Sopa).
          for (const [w, h, nombre] of [[480, 900, 'en vertical'], [1100, 430, 'en apaisado bajo']]) {
            if (!rr || rr.tapado) break;
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(250);
            rr.tapado = await page.evaluate(`(${FN_TAPADO})()`);
            if (rr.tapado) rr.tapado += ` (${nombre})`;
          }
          if (rr) { await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150); }
          const exc = ENVIO_ES_MECANICA[t.name];
          // Sin widget no se puede escanear — y callarlo sería lo peor: la ley
          // §3b0 dejaría de vigilarse, en silencio, el día que un player cambie
          // de raíz. Se cuenta como fallo con su motivo.
          const medida = rr || { hud: 0, sec: 0, send: 0, fuera: 0 };
          const fallos = rr ? [] : ['sin #ww-player-widget: no se pudo escanear'];
          if (rr) {
            if (rr.hud !== 1) fallos.push(`edu-hud: ${rr.hud} (debe ser 1)`);
            if (rr.sec < 1) fallos.push('sin sección de juego con nombre (edu-sec--*)');
            if (rr.send > 1) fallos.push(`${rr.send} regiones edu-send (como mucho 1)`);
            if (rr.fuera > 0 && !exc) fallos.push(`${rr.fuera} control(es) de envío fuera de edu-send`);
            // El tope: el chip tiene que estar EN la esquina del marco. 48 px da
            // aire para el relleno del propio HUD (9-25 px según la plantilla)
            // y para el sangrado de la hoja de Tildes/Comas, y sigue estando
            // lejísimos de los 213 px con los que Pelotas pasaba en verde.
            const TOPE_ESQUINA = 48;
            if (rr.esquina && (rr.esquina.top > TOPE_ESQUINA || rr.esquina.left > TOPE_ESQUINA)) {
              fallos.push(`el HUD no está en la esquina: ${rr.esquina.top}px desde arriba, `
                + `${rr.esquina.left}px desde la izquierda (tope ${TOPE_ESQUINA}) — su raíz no llena el hueco`);
            }
            if (rr.tapado) fallos.push(`un chip del HUD pisa texto del juego: ${rr.tapado}`);
          }
          roles.push({ label: t.label, ...medida, exc, fallos });
          if (fallos.length) { status = 'error'; detail = `roles: ${fallos[0]}`; }
        }
        //  3. SE LEE DESDE EL FONDO DEL AULA (§29 · R1). Era la promesa más
        //     repetida del proyecto —«mirada a 3 m»— y la única sin ninguna red:
        //     §3 vigila que no haya px FIJOS, pero un `clamp()` con tope bajo
        //     cumple §3 y aun así se lee diminuto en una pizarra. Aquí se mide
        //     el tamaño COMPUTADO real y el contraste real de lo que el alumno
        //     tiene que leer. A diferencia de los tiempos (que dependen de la
        //     máquina y por eso NO se miden), esto sale igual aquí que en el aula.
        //
        //     El umbral: 2.2% de la altura del marco. En una pizarra de 55" a
        //     3 m equivale aproximadamente a lo que se lee sin esfuerzo; en el
        //     móvil del alumno, a un cuerpo normal de lectura. Es un PISO, no
        //     un objetivo — casi todo el texto de juego está muy por encima.
        if (['solo', 'vs', 'teams'].includes(mode) && status === 'ok') {
          // El MEDIDOR es compartido con tools/contrast-torture.mjs
          // (tools/helpers/legibilidad.mjs): estaba forkeado y las dos copias
          // divergieron el mismo día. Se le pasa el mapa de lienzos DECLARADOS,
          // así que los fondos con textura dejan de contarse como «no medibles».
          const leg = await page.evaluate(
            `(${medirLegibilidad})('#ww-frame', ${JSON.stringify(caja)}, ${JSON.stringify({ colorBases: LIENZOS })})`);
          if (leg.n >= 2) {
            // CONTRASTE — VEREDICTO. Está bien definido (todo texto visible
            // tiene color y fondo) y ya cazó dos fallos reales: el ámbar con
            // letra blanca en las opciones del quiz y en los globos, 2,4:1 los
            // dos. Umbral 3:1 = AA para texto grande, que es lo que hay aquí.
            presupuesto.push({ label: t.label, mode, regla: 'se lee a 3 m (contraste)', ok: leg.peorRatio >= 3.0,
              nota: `${leg.peorRatio.toFixed(1)}:1 · «${leg.peorC}»${leg.sinMedir ? ` · ${leg.sinMedir} sobre degradado (no medibles)` : ''}` });
            // TAMAÑO — INFORME, no veredicto, y con el motivo escrito: medir "el
            // texto más pequeño" mide el CHROME (el contador «1 / 2», el botón
            // «Girar», el título de la actividad), no lo que la clase lee. Con
            // ese ruido, un veredicto rojo se apaga a la semana. Para juzgarlo de
            // verdad hace falta que la PLANTILLA declare cuál es su texto de
            // lectura (un `data-ww-read`, §0: la plantilla declara, el motor
            // consume) — decisión de contrato sobre las 13, registrada como
            // pendiente en docs/leyes.md §29. Mientras tanto se PUBLICA el
            // número: se ve, se compara entre versiones, y no miente.
            legibilidad.push({ label: t.label, mode, pct: leg.minPct, texto: leg.peorTexto });
          }
        }
        // RATCHET de deuda conocida (mismo patrón que el ratchet de estilos): una
        // combinación rota Y DECLARADA no tumba la matriz, pero sale en el
        // informe con su motivo. Lo que no se tolera es una rotura NUEVA.
        const CONOCIDOS = {
          // (vacío — al declarar una combinación rota, poner el motivo y
          // registrar la deuda en CLAUDE.md; al arreglarla, QUITARLA de aquí)
        };
        const conocido = CONOCIDOS[`${t.name}|${mode}`];
        if (r.mecanica && r.avanzo === false && !conocido) {
          status = 'error'; detail = `la ronda no AVANZA tras un gesto real (${r.mecanica})`;
        }
        if (r.mecanica && r.avanzo === false && conocido) r.conocido = conocido;
        rounds.push({ label: t.label, mode, mecanica: r.mecanica, avanzo: r.avanzo, conocido: r.conocido });
      }
      if (mode === 'vs' && status === 'ok') {
        const n = await page.evaluate(() => {
          const panel = document.querySelector('#vs-body-left') || document.querySelector('.vs-panel');
          return panel ? panel.querySelectorAll('[data-ww-submit]').length : -1;
        });
        taps.push({ t: t.name, label: t.label, declared: submitKind[t.name] ?? '(sin declarar)', found: n });

        // LA FORMA DE LA PIEZA MANDA SOBRE LLENAR EL HUECO (dueño, 2026-08-22).
        // Una pieza cuadrada —una tecla, una carta, una casilla— no puede
        // deformarse para tapar el hueco: el sobrante es AIRE. Se midió con el
        // duelo montado en la ventana del dueño y las teclas de Operaciones
        // salían de 39×71 (proporción 0,55, casi el doble de altas que anchas)
        // porque el tope de alto se calibraba sobre el ancho del panel.
        // Se comprueba en TRES formas de ventana, no en una: la deformación
        // aparece cuando el panel se estrecha o se acorta, no en la de siembra.
        for (const [vw, vh, forma] of [[1280, 800, 'apaisada'], [900, 750, 'casi cuadrada'], [800, 1280, 'vertical']]) {
          if (formaBad.some(x => x.t === t.name)) break;   // ya cazada, no repetir
          await page.setViewportSize({ width: vw, height: vh });
          await page.waitForTimeout(250);
          const p2 = await page.evaluate(() => {
            const k = document.querySelector('#vs-body-left .ww-key, #vs-body-left .memo-card, #vs-body-left .ws-cell');
            if (!k) return null;
            const b = k.getBoundingClientRect();
            return b.width && b.height ? b.width / b.height : null;
          });
          if (p2 == null) break;                            // esta plantilla no tiene pieza cuadrada
          if (p2 < .85 || p2 > 1.15) formaBad.push({ t: t.name, label: t.label, forma, prop: p2 });
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(150);

        // EL AIRE VA FUERA DEL MARCO, NO DENTRO. El marco de colores lo pinta el
        // skin sobre `.vs-body`; cuánto ocupa lo decide `meta.panelFit`:
        //   fill  → el contenido llena, así que el marco llena la columna;
        //   block → la actividad es un bloque indivisible (la calculadora), el
        //           marco la ABRAZA y lo que sobra queda por fuera.
        // Se mide, no se mira: `.vs-body` llenaba SIEMPRE la columna porque era
        // la caja de medida (`container-type: size`, que no puede encogerse hasta
        // su contenido), y el sobrante se quedaba dentro del borde — el dueño lo
        // vio en la foto antes que ninguna suite («el aire debe estar por fuera
        // de las actividades, no por dentro»).
        const m = await page.evaluate(() => {
          const panel = document.querySelector('.vs-panel'), body = document.querySelector('#vs-body-left');
          if (!panel || !body) return null;
          const p = panel.getBoundingClientRect(), b = body.getBoundingClientRect();
          if (!p.height || !b.height) return null;
          return { llena: b.height / p.height };
        });
        if (m) marcos.push({ label: t.label, declared: panelFitKind[t.name], ...m });
      }
    } catch (e) {
      status = 'fail';
      detail = bucket[0] || String(e.message).split('\n')[0].slice(0, 120);
    }
    results.push({ t: t.name, label: t.label, mode, status, detail });
  }
}

// ── Informe ──────────────────────────────────────────────────────────────────
const ICON = { ok: '✅', error: '⚠️ ', fail: '❌', 'n/a': '· ' };
const modes = Object.keys(DRIVERS);
const width = Math.max(...results.map(r => r.label.length), 12);
console.log('\nMATRIZ JUGABLE — plantilla × modo\n');
console.log('  ' + 'Plantilla'.padEnd(width) + '  ' + modes.map(m => m.padEnd(7)).join(''));
const byTpl = [...new Set(results.map(r => r.t))];
for (const t of byTpl) {
  const row = results.filter(r => r.t === t);
  console.log('  ' + row[0].label.padEnd(width) + '  ' +
    modes.map(m => (ICON[row.find(r => r.mode === m)?.status || 'n/a'] + '     ').slice(0, 7)).join(''));
}
const bad = results.filter(r => r.status === 'fail' || r.status === 'error');
if (bad.length) {
  console.log('\nFALLOS:');
  for (const b of bad) console.log(`  ${ICON[b.status]} ${b.label} · ${b.mode} — ${b.detail}`);
}
// ── Toques para responder en VS: declarado vs REAL ──────────────────────────
// 'gesto' = el toque ES la respuesta (cero botones) · 'boton' = se construye y
// se confirma (EXACTAMENTE uno). Dos botones para una respuesta es un fallo de
// producto: en la pizarra responde un alumno con la clase mirando.
const tapBad = taps.filter(x => x.found !== (x.declared === 'boton' ? 1 : 0));
if (taps.length) {
  console.log('\nTOQUES PARA RESPONDER EN VS (declarado → real)\n');
  for (const x of taps) {
    const esperado = x.declared === 'boton' ? 1 : 0;
    console.log(`  ${x.found === esperado ? '✅' : '❌'} ${x.label.padEnd(width)}  ${String(x.declared).padEnd(7)} → ${x.found} control(es) de envío`);
  }
}
if (tapBad.length) {
  console.log('\nENVÍO QUE NO CUADRA CON LO DECLARADO:');
  for (const x of tapBad) console.log(`  ❌ ${x.label} — declara '${x.declared}' pero el panel tiene ${x.found} control(es) [data-ww-submit]`);
}
// ── La forma de la pieza manda sobre llenar el hueco ───────────────────────
if (formaBad.length) {
  console.log('\nPIEZAS CUADRADAS QUE SE DEFORMAN (tope ±15 %)\n');
  for (const x of formaBad) {
    console.log(`  ❌ ${x.label} · ventana ${x.forma} — proporción ${x.prop.toFixed(2)} (1,00 = cuadrada)`);
  }
  console.log('  La pieza declara su forma (aspect-ratio) y el sobrante queda como AIRE:');
  console.log('  llenar el hueco estirando la pieza no es responsive, es deformar.');
}

// ── El marco obedece a meta.panelFit (§0) ──────────────────────────────────
// Los umbrales son HOLGADOS a propósito: no fijan un diseño, cazan el fallo que
// se vio —un marco que llena la columna con el bloque flotando dentro—. `fill`
// debe cubrir casi toda la columna; `block` debe DEJAR aire fuera (llenar menos
// del 95 %) y no acumularlo dentro (tope: 25 % de su propio alto).
const marcoMal = (x) => x.declared === 'block' ? x.llena > .95 : x.llena < .9;
const marcoBad = marcos.filter(marcoMal);
if (marcos.length) {
  console.log('\nEL MARCO OBEDECE A meta.panelFit (declarado → medido)\n');
  for (const x of marcos) {
    console.log(`  ${marcoMal(x) ? '❌' : '✅'} ${x.label.padEnd(width)}  ${x.declared.padEnd(5)} → el marco llena el ${Math.round(100 * x.llena)}% de la columna`);
  }
}
if (marcoBad.length) {
  console.log('\nMARCO QUE NO CUADRA CON LO DECLARADO:');
  for (const x of marcoBad) console.log(`  ❌ ${x.label} — declara '${x.declared}' y su marco llena el ${Math.round(100 * x.llena)}% de la columna (el aire debe quedar FUERA del marco, no dentro)`);
}

// ── Controles críticos: presentes Y TOCABLES (no basta con querySelector) ───
const hitBad = hits.filter(x => x.mal);
if (hits.length) {
  const porControl = {};
  for (const h of hits) (porControl[h.control] ??= []).push(h);
  console.log(`\nCONTROLES TOCABLES (hit-testing real, no querySelector)\n`);
  for (const [c, lista] of Object.entries(porControl)) {
    const mal = lista.filter(x => x.mal).length;
    console.log(`  ${mal ? '❌' : '✅'} ${c.padEnd(20)} ${lista.length - mal}/${lista.length}`);
  }
  if (hitBad.length) {
    console.log('\nCONTROLES QUE NO SE PUEDEN TOCAR:');
    for (const x of hitBad) console.log(`  ❌ ${x.label} · ${x.mode} · ${x.control} — ${x.estado}`);
  }
}

// ── Rondas jugadas con un toque real ────────────────────────────────────────
// La deuda CONOCIDA no tumba la matriz (sale en el informe con su motivo); lo
// que la tumba es una rotura nueva.
const roundBad = rounds.filter(r => r.avanzo === false && !r.conocido);
if (rounds.length) {
  const jugadas = rounds.filter(r => r.avanzo !== null);
  console.log(`\nRONDA JUGADA (gesto real → la app juzga y responde): ${jugadas.filter(r => r.avanzo).length}/${jugadas.length}`);
  for (const m of ['solo', 'vs', 'teams']) {
    const del = rounds.filter(r => r.mode === m && r.avanzo !== null);
    if (del.length) console.log(`  ${del.every(r => r.avanzo) ? '✅' : '❌'} ${m.padEnd(6)} ${del.filter(r => r.avanzo).length}/${del.length}  (${[...new Set(del.map(r => r.mecanica))].join(' · ')})`);
  }
  const deuda = rounds.filter(r => r.conocido);
  if (deuda.length) {
    console.log('  · DEUDA CONOCIDA (no tumba la matriz, sigue siendo un fallo):');
    for (const d of deuda) console.log(`      ${d.label} · ${d.mode} — ${d.conocido}`);
  }
  const sin = rounds.filter(r => r.avanzo === null);
  if (sin.length) {
    const porModo = {};
    for (const r of sin) (porModo[r.mode] ??= []).push(r.label);
    console.log('  · sin driver de gesto: ' + Object.entries(porModo).map(([m, l]) => `${m}: ${[...new Set(l)].join(', ')}`).join(' | '));
  }
}

// ── Ley §29 · PRESUPUESTO (norte §2b) ───────────────────────────────────────
const presuBad = presupuesto.filter(p => !p.ok);
if (presupuesto.length) {
  const porRegla = {};
  for (const p of presupuesto) (porRegla[p.regla] ??= []).push(p);
  console.log('\nPRESUPUESTO DE CONDUCCIÓN (ley §29 · el coste de llevar la clase)\n');
  for (const [regla, lista] of Object.entries(porRegla)) {
    const mal = lista.filter(x => !x.ok).length;
    console.log(`  ${mal ? '❌' : '✅'} ${regla.padEnd(30)} ${lista.length - mal}/${lista.length}`);
  }
  for (const p of presuBad) console.log(`  ❌ ${p.label} · ${p.mode} — ${p.regla}${p.nota ? ` (${p.nota})` : ''}`);
}

// §29 · INFORME de tamaño (no veredicto — ver el comentario junto a la medición).
if (legibilidad.length) {
  const orden = [...legibilidad].sort((a, b) => a.pct - b.pct).slice(0, 6);
  const media = legibilidad.reduce((n, x) => n + x.pct, 0) / legibilidad.length;
  console.log(`\nLEGIBILIDAD · tamaño del texto en la caja de la ronda (informe, no veredicto)`);
  console.log(`  media del menor texto: ${media.toFixed(1)}% del alto del marco · los 6 más pequeños:`);
  for (const x of orden) console.log(`    ${x.pct.toFixed(1)}%  ${x.label} · ${x.mode} — «${x.texto}»`);
  console.log('  (el mínimo suele ser CHROME —contadores, botones, títulos—, no lo que la clase lee:');
  console.log('   juzgarlo pide que la plantilla DECLARE su texto de lectura. Pendiente en leyes.md §29.)');
}

// ── EMBED: la página que el profe pega en su blog ───────────────────────────
// `embed.html` era un HUECO TOTAL: ningún test la abría jamás (auditoría
// v1.51.401). Es el producto COMPARTIBLE — el iframe se queda meses en un
// Moodle y, si se rompe, no hay quien lo vea hasta que un colega se queja.
// Se abren dos plantillas y la rama sin `?id=` (que debe AVISAR, no quedarse en
// blanco: R6). El embed lee de `getRemote`, así que se siembra en el almacén
// remoto local del mismo modo que hace la app.
const embed = [];
{
  const page2 = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errs2 = [];
  page2.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs2.push(m); });
  page2.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errs2.push(m.text().split('\n')[0]); });
  await page2.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
  await page2.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  for (const name of ['quiz', 'math']) {
    errs2.length = 0;
    try {
      await page2.goto(`${BASE}/embed.html?backend=local&id=mx_${name}`, { waitUntil: 'domcontentloaded' });
      // La actividad la siembra la propia página (mismo almacén que usa getRemote).
      await page2.evaluate(async (n) => {
        await import('/core/registerTemplates.js');
        const { getTemplate } = await import('/core/registry.js');
        const { getRemoteStore } = await import('/adapters/index.js');
        const T = getTemplate(n);
        const rs = await getRemoteStore();
        await rs.saveActivity({ id: `mx_${n}`, template: n, title: `Embed · ${T.meta.label}`,
          visibility: 'public', content: T.meta.defaultContent(),
          rules: T.meta.defaultRules ? T.meta.defaultRules() : {},
          scoring: T.meta.defaultScoring ? T.meta.defaultScoring() : {}, updatedAt: new Date().toISOString() });
      }, name);
      await page2.reload({ waitUntil: 'domcontentloaded' });
      await page2.waitForFunction(() => window.__APP_READY__ === true, { timeout: 12000 });
      const pintado = await page2.evaluate(() => (document.querySelector('#ww-player-widget')?.children.length || 0) > 0);
      embed.push({ caso: `?id=mx_${name}`, ok: pintado && !errs2.length, detalle: errs2[0] || (pintado ? '' : 'el widget quedó vacío') });
    } catch (e) { embed.push({ caso: `?id=mx_${name}`, ok: false, detalle: String(e.message).slice(0, 90) }); }
  }
  // Sin `?id=`: tiene que DECIRLO (R6), no quedarse en blanco.
  errs2.length = 0;
  await page2.goto(`${BASE}/embed.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page2.waitForFunction(() => window.__APP_READY__ === true, { timeout: 9000 }).catch(() => {});
  const aviso = await page2.evaluate(() => document.body.innerText || '');
  embed.push({ caso: 'sin ?id= (debe avisar)', ok: /id=|no disponible|falta/i.test(aviso), detalle: aviso.slice(0, 60) });
  await page2.close();
}
const embedBad = embed.filter(e => !e.ok);
if (embed.length) {
  console.log('\nEMBED (la página que el profe pega en su blog)\n');
  for (const e of embed) console.log(`  ${e.ok ? '✅' : '❌'} ${e.caso}${e.detalle && !e.ok ? ' — ' + e.detalle : ''}`);
}

// Solo para pintar el ❌ del informe: un fallo de roles ya marcó la combinación
// como 'error', así que el código de salida sale de `bad` (no hay tercera vía).
const rolesBad = roles.filter(r => r.fallos.length);
void rolesBad;
if (roles.length) {
  console.log('\nLOS CUATRO ROLES DE LA DIAGRAMACIÓN (Individual)\n');
  const w2 = Math.max(...roles.map(r => r.label.length));
  for (const r of roles) {
    const marca = r.fallos.length ? '❌' : '✅';
    const envio = r.send ? 'edu-send'
      : r.fuera ? (r.exc ? 'la mecánica (excepción)' : `${r.fuera} suelto(s)`)
      : 'gesto';
    console.log(`  ${marca} ${r.label.padEnd(w2)}  hud:${r.hud} · secciones:${r.sec} · envío: ${envio}` +
      (r.fallos.length ? `  → ${r.fallos.join(' · ')}` : ''));
  }
}

const seedBad = seeded.filter(s => s.seedError);
if (seedBad.length) { console.log('\nSIEMBRA FALLIDA:'); seedBad.forEach(s => console.log(`  ❌ ${s.name} — ${s.seedError}`)); }

console.log(`\n✅ ok: ${results.filter(r => r.status === 'ok').length}` +
  ` · ❌ fallos: ${bad.length}` +
  ` · · no aplica: ${results.filter(r => r.status === 'n/a').length}`);
console.log('El ALUMNO en vivo lo cubre tools/live-smoke.mjs (dos contextos) y la Tarea tools/task-smoke.mjs. Sin cubrir: carrera con 2 alumnos.');
await browser.close();
bye(bad.length || seedBad.length || tapBad.length || hitBad.length || roundBad.length || presuBad.length || embedBad.length || marcoBad.length || formaBad.length ? 1 : 0);
