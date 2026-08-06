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
  const el = document.querySelector(sel);
  if (!el) return 'ausente';
  const r = el.getBoundingClientRect();
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

const results = [];
const taps = [];
const hits = [];   // hit-testing de los controles críticos
const rounds = [];  // rondas JUGADAS con un toque real (cola #3)
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
          { nombre: 'pantalla completa', sel: '#ww-frame .ww-fs-btn--corner' },
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
      if (mode === 'vs' && status === 'ok') {
        const n = await page.evaluate(() => {
          const panel = document.querySelector('#vs-body-left') || document.querySelector('.vs-panel');
          return panel ? panel.querySelectorAll('[data-ww-submit]').length : -1;
        });
        taps.push({ t: t.name, label: t.label, declared: submitKind[t.name] ?? '(sin declarar)', found: n });

        // ── LA RONDA SE JUEGA, no solo se monta (cola #3 del norte) ──────────
        // Un toque REAL en el panel izquierdo y la vara es que el juego AVANCE
        // (la barra de progreso del lado se mueve, o el panel cambia). El
        // veredicto lo pone la app: para las mecánicas de elección se toca una
        // opción cualquiera (acierte o falle, el cursor de VS avanza); para el
        // teclado se teclea la respuesta DE LA SEMILLA — conocer tu propia
        // semilla no es darse el veredicto (§27), es saber qué sembraste.
        const jugada = await (async () => {
          const before = await page.evaluate(() => ({
            prog: document.getElementById('vs-prog-left')?.style.width || '',
            html: document.getElementById('vs-body-left')?.innerHTML || '',
          }));
          const tap = async (sel) => {
            const el = page.locator(`#vs-body-left ${sel}`).first();
            if (!await el.count()) return false;
            const box = await el.boundingBox();
            if (!box) return false;
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            return true;
          };
          let did = null;
          if (await tap('.rq-opt')) did = 'opción';
          else if (await tap('.gl-balloon')) did = 'globo';
          else if (await page.locator('#vs-body-left .tc-target').count()) {
            // Tildes/Comas: un TRAZO real del ratón sobre un objetivo (el canvas
            // de dibujo escucha pointer events del navegador, no clicks JS) y
            // luego "Listo". Marque bien o mal, el envío avanza el lado.
            const tg = await page.locator('#vs-body-left .tc-target').first().boundingBox();
            if (tg) {
              await page.mouse.move(tg.x + tg.width / 2 - 3, tg.y + tg.height / 2);
              await page.mouse.down();
              await page.mouse.move(tg.x + tg.width / 2 + 3, tg.y + tg.height / 2, { steps: 4 });
              await page.mouse.up();
              await page.waitForTimeout(150);
              await tap('.tc-done');
              did = 'trazo';
            }
          }
          else if (await page.locator('#vs-body-left .tube').count()) {
            // Ordena las Pelotas: TAP-TAP (coger del primer tubo, soltar en el
            // último, que la semilla trae vacío → movimiento legal seguro).
            const tubos = page.locator('#vs-body-left .tube');
            const n = await tubos.count();
            const a = await tubos.nth(0).boundingBox();
            const b = await tubos.nth(n - 1).boundingBox();
            if (a && b) {
              await page.mouse.click(a.x + a.width / 2, a.y + 10);
              await page.waitForTimeout(120);
              await page.mouse.click(b.x + b.width / 2, b.y + 10);
              did = 'tap-tap';
            }
          }
          else if (await page.locator('#vs-body-left .ww-key[data-k]').count()) {
            // Operaciones: la semilla es defaultContent() → primera pregunta '2 × 6' = '12'.
            for (const k of ['1', '2']) await tap(`.ww-key[data-k="${k}"]`);
            await tap('.ww-key[data-k="ok"]');
            did = 'teclado';
          }
          if (!did) return { did: 'sin driver' };   // mecánicas de trazo/arrastre: pendiente declarado
          await page.waitForTimeout(1100);          // flash + re-render del lado
          const after = await page.evaluate(() => ({
            prog: document.getElementById('vs-prog-left')?.style.width || '',
            html: document.getElementById('vs-body-left')?.innerHTML || '',
          }));
          const avanzo = (after.prog && after.prog !== before.prog) || after.html !== before.html;
          return { did, avanzo };
        })();
        if (jugada.did !== 'sin driver') {
          if (!jugada.avanzo) { status = 'error'; detail = `la ronda no AVANZA tras un toque real (${jugada.did})`; }
          rounds.push({ label: t.label, did: jugada.did, avanzo: !!jugada.avanzo });
        } else {
          rounds.push({ label: t.label, did: 'sin driver', avanzo: null });
        }
      }
    } catch (e) {
      status = 'fail';
      detail = bucket[0] || String(e.message).split('\n')[0].slice(0, 120);
    }
    results.push({ t: t.name, label: t.label, mode, status, detail });
  }
}

await browser.close();

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
if (rounds.length) {
  const jugadas = rounds.filter(r => r.avanzo !== null);
  const sinDriver = rounds.filter(r => r.avanzo === null).map(r => r.label);
  console.log(`\nRONDA JUGADA EN VS (toque real → la app juzga y avanza): ${jugadas.filter(r => r.avanzo).length}/${jugadas.length}`);
  if (sinDriver.length) console.log(`  · sin driver de gesto todavía (trazo/arrastre): ${sinDriver.join(' · ')}`);
}

const seedBad = seeded.filter(s => s.seedError);
if (seedBad.length) { console.log('\nSIEMBRA FALLIDA:'); seedBad.forEach(s => console.log(`  ❌ ${s.name} — ${s.seedError}`)); }

console.log(`\n✅ ok: ${results.filter(r => r.status === 'ok').length}` +
  ` · ❌ fallos: ${bad.length}` +
  ` · · no aplica: ${results.filter(r => r.status === 'n/a').length}`);
console.log('El ALUMNO en vivo lo cubre tools/live-smoke.mjs (dos contextos). Sin cubrir: Tarea e2e y carrera con 2 alumnos.');
bye(bad.length || seedBad.length || tapBad.length || hitBad.length ? 1 : 0);
