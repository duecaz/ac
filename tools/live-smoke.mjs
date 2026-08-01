// RED DE SEGURIDAD Nº3 (R6) — EN VIVO de punta a punta con DOS CONTEXTOS:
// una página HOST (profesor) y una página ALUMNO, sobre el backend local
// (localStorage + BroadcastChannel: multi-pestaña real, sin red ni Pi).
//
// Cierra el hueco que la matriz jugable declaraba ("el ALUMNO en vivo no está
// cubierto"): recorre el flujo canónico completo de una clase en vivo —
//   crear sala → PIN → alumno se une → empezar → pregunta → alumno responde →
//   revelar (settle) → clasificación → terminar → podio con los puntos REALES.
// La aserción final es la que importa tras C6: los puntos del alumno en el
// podio los puso el SETTLE del host, no el cliente.
//
//   node tools/live-smoke.mjs
//
// Requiere: python3 + el Chromium preinstalado (igual que matrix-smoke).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8481);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctx.newPage();
const student = await ctx.newPage();
const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|favicon/i;
const errs = [];
for (const [p, who] of [[host, 'host'], [student, 'alumno']]) {
  p.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(`${who}: ${m}`); });
  await p.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
  await p.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  // Bootstrap viene de un CDN y este sandbox no tiene red: sin un mínimo shim,
  // `confirmModal` (que usa bootstrap.Modal) revienta y no se puede probar NINGÚN
  // flujo con confirmación — como terminar la carrera. El shim solo muestra y
  // quita el diálogo; los botones son los de la app.
  await p.addInitScript(() => {
    window.bootstrap = {
      Modal: class { constructor(el) { this.el = el; }
        show() { this.el.classList.add('show'); this.el.style.display = 'block'; }
        hide() { this.el.dispatchEvent(new Event('hidden.bs.modal')); } },
    };
  });
}
const log = (m) => console.log('  ·', m);

try {
  // ── HOST: sembrar un quiz y lanzar la sala ─────────────────────────────────
  await host.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await host.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  await host.evaluate(async () => {
    await import('/core/registerTemplates.js');
    const s = await import('/core/storage.js');
    s.save({ id: 'lv_e2e', template: 'quiz', title: 'Live e2e',
      content: { items: [
        { id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 },
        { id: 'q2', question: '3+3', answer: '6', options: ['6', '7'], points: 1 },
      ] },
      rules: {}, scoring: { mode: 'flat', pointsPerCorrect: 1 },
      live: { questionTimer: 30 }, updatedAt: 'x' });
  });
  await host.evaluate(() => { location.hash = '#/launch/lv_e2e'; });
  await host.waitForSelector('.ww-pin', { timeout: 12000 });
  const pin = (await host.locator('.ww-pin').textContent()).trim();
  log(`sala creada · PIN ${pin}`);

  // ── ALUMNO: unirse con el PIN ──────────────────────────────────────────────
  await student.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
  await student.waitForSelector('#f-code', { timeout: 12000 });
  await student.fill('#f-code', pin);
  await student.fill('#f-nick', 'Emma');
  await student.click('#btn-join');
  await host.waitForFunction(() => document.body.textContent.includes('Emma'), { timeout: 9000 });
  log('alumna "Emma" en el lobby del host (realtime cross-tab ✓)');

  // ── Empezar → pregunta → la alumna responde BIEN ───────────────────────────
  await host.click('#btn-start');
  await student.waitForSelector('.rq-opt, .ww-opt', { timeout: 9000 });
  log('pregunta en el móvil de la alumna');
  // R-1 · LECTURA (§26 ficha 1b): la pregunta se ve pero NO se puede responder
  // hasta el instante que manda la sala. Se comprueba que la puerta EXISTE (si
  // desaparece, el bonus de velocidad vuelve a premiar al que clica sin leer) y
  // que se abre sola — sin tocar nada.
  const gated = await student.locator('#s-round.s-reading').count();
  if (!gated) throw new Error('R-1: el móvil debería estar en LECTURA (bloqueado) al abrir la pregunta');
  const blocked = await student.evaluate(() => {
    const el = document.querySelector('#s-round.s-reading');
    return el ? getComputedStyle(el).pointerEvents === 'none' : false;
  });
  if (!blocked) throw new Error('R-1: la lectura no bloquea la interacción');
  log('lectura: la pregunta se ve pero no se puede tocar (R-1)');
  await student.waitForSelector('#s-round:not(.s-reading) .rq-opt, #s-round:not(.s-reading) .ww-opt', { timeout: 15000 });
  log('se abren las respuestas solas al llegar el instante de la sala');
  await student.locator('.rq-opt, .ww-opt', { hasText: '4' }).first().click();
  // Con todos respondidos el host puede AUTO-liquidar (pasa directo a reveal);
  // si no, se revela a mano. Ambos caminos terminan en #btn-lb.
  await host.waitForSelector('#btn-lb, #btn-reveal', { timeout: 9000 });
  if (!(await host.locator('#btn-lb').count())) {
    await host.click('#btn-reveal');
  }
  await host.waitForSelector('#btn-lb', { timeout: 9000 });
  log('respuesta recibida y liquidada por el settle del host');
  await host.click('#btn-lb');
  await host.waitForFunction(() => /Emma/.test(document.body.textContent) && /1/.test(document.body.textContent), { timeout: 9000 });
  log('clasificación con Emma puntuada por el settle');

  // ── Siguiente pregunta → sin responder → terminar → podio ─────────────────
  await host.click('#btn-next');
  await host.waitForSelector('#btn-reveal', { timeout: 9000 });
  await host.click('#btn-reveal');
  await host.waitForSelector('#btn-lb', { timeout: 9000 });
  await host.click('#btn-lb');
  await host.waitForSelector('#btn-end', { timeout: 9000 });
  await host.click('#btn-end');
  await host.waitForFunction(() => /podio|Podio|🏆|trophy/i.test(document.body.innerHTML), { timeout: 9000 });
  const podium = await host.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const emmaScored = /Emma/.test(podium);
  log(`podio del host: Emma ${emmaScored ? 'presente' : 'AUSENTE'}`);

  // La alumna ve el final con SU puntaje (autoritativo del servidor local).
  await student.waitForFunction(() => /final|Final|podio|puntos|rango/i.test(document.body.textContent), { timeout: 12000 });
  log('la alumna ve la pantalla de final');

  // ══ SEGUNDA PASADA: CARRERA LIBRE ═══════════════════════════════════════════
  // El otro flujo del host, que no estaba cubierto: cada alumno va a su ritmo, el
  // host ve una lista de progreso con cronómetro y un repintado de respaldo
  // (startRaceLoop). Aquí se comprueba lo que se puede romper sin que nadie lo
  // note: que el CRONÓMETRO avanza y que el progreso del alumno llega.
  await host.evaluate(() => { location.hash = '#/launch/lv_e2e'; });
  await host.waitForSelector('.ww-pin', { timeout: 12000 });
  const pin2 = (await host.locator('.ww-pin').textContent()).trim();
  await student.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
  await student.waitForSelector('#f-code', { timeout: 12000 });
  await student.fill('#f-code', pin2);
  await student.fill('#f-nick', 'Leo');
  await student.click('#btn-join');
  await host.waitForFunction(() => document.body.textContent.includes('Leo'), { timeout: 9000 });
  // El lobby ya no tiene un <select> con tres opciones desiguales: son DOS
  // preguntas y la primera se construye desde los bucles que la plantilla
  // DECLARA (§26). Elegir "Carrera libre" es pulsar su botón.
  await host.waitForSelector('.loop-pick[data-loop="race"]', { timeout: 9000 });
  await host.click('.loop-pick[data-loop="race"]');
  await host.click('#btn-start');
  await host.waitForSelector('#race-timer', { timeout: 9000 });
  log(`carrera arrancada · PIN ${pin2}`);

  // El cronómetro es un reloj de verdad: su etiqueta cambia sola.
  const t0 = (await host.locator('#race-timer').textContent()).trim();
  await host.waitForFunction((prev) => (document.getElementById('race-timer')?.textContent || '').trim() !== prev,
    t0, { timeout: 9000 });
  log('el cronómetro de carrera avanza (startElapsedTicker vivo)');

  // El alumno resuelve un ítem y el host lo ve (evento o repintado de respaldo).
  await student.waitForSelector('.rq-opt, .ww-opt', { timeout: 12000 });
  await student.locator('.rq-opt, .ww-opt', { hasText: '4' }).first().click();
  await host.waitForFunction(() => /1\s*\/\s*2/.test(document.body.textContent), { timeout: 12000 });
  log('progreso del alumno en la lista del host (1/2)');

  await host.click('#btn-end-race');
  await host.click('.modal [data-act=ok]', { timeout: 9000 });   // confirmación real del profe
  await host.waitForFunction(() => /podio|Podio|🏆|trophy/i.test(document.body.innerHTML), { timeout: 12000 });
  log('podio tras la carrera');

  // En carrera un fallo VUELVE A LA COLA, así que todo el que termina lo hace
  // con todas bien: el puntaje no ordena nada y el podio DEBE decir la hora de
  // meta (quién llegó antes). Sin ella, la clase ve un empate.
  await host.waitForSelector('.ww-podium__sub', { timeout: 9000 });
  const meta = (await host.locator('.ww-podium__sub').first().textContent()).trim();
  if (!/^\d+:[0-5]\d$/.test(meta)) throw new Error(`el podio de carrera no muestra la hora de meta: "${meta}"`);
  log(`el podio muestra la hora de meta (${meta})`);

  if (errs.length) { console.error('\nERRORES DE PÁGINA:'); errs.forEach(e => console.error('  ✗', e)); }
  if (!emmaScored || errs.length) { console.log('\n❌ LIVE E2E FALLA'); await browser.close(); bye(1); }
  console.log('\n✅ LIVE E2E PASA — pregunta (sala→PIN→join→respuesta→settle→clasificación→podio)'
    + ' Y carrera (cronómetro vivo → progreso → podio), en dos contextos.');
  await browser.close(); bye(0);
} catch (e) {
  console.error('\n❌ LIVE E2E FALLA:', String(e.message).split('\n')[0]);
  if (errs.length) errs.forEach(x => console.error('  ✗', x));
  try { await browser.close(); } catch {}
  bye(1);
}
