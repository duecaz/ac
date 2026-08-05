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
      if (mode === 'vs' && status === 'ok') {
        const n = await page.evaluate(() => {
          const panel = document.querySelector('#vs-body-left') || document.querySelector('.vs-panel');
          return panel ? panel.querySelectorAll('[data-ww-submit]').length : -1;
        });
        taps.push({ t: t.name, label: t.label, declared: submitKind[t.name] ?? '(sin declarar)', found: n });
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

const seedBad = seeded.filter(s => s.seedError);
if (seedBad.length) { console.log('\nSIEMBRA FALLIDA:'); seedBad.forEach(s => console.log(`  ❌ ${s.name} — ${s.seedError}`)); }

console.log(`\n✅ ok: ${results.filter(r => r.status === 'ok').length}` +
  ` · ❌ fallos: ${bad.length}` +
  ` · · no aplica: ${results.filter(r => r.status === 'n/a').length}`);
console.log('El ALUMNO en vivo lo cubre tools/live-smoke.mjs (dos contextos). Sin cubrir: Tarea e2e y carrera con 2 alumnos.');
bye(bad.length || seedBad.length || tapBad.length ? 1 : 0);
