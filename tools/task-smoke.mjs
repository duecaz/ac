// RED DE SEGURIDAD Nº6 — TAREAS / INFORMES de punta a punta, con el navegador.
//
// POR QUÉ EXISTE. Era el ÚNICO tramo del norte sin recorrido (§27 lo declaraba
// como deuda: ratio de test 0,34 y ningún viaje). Y es el tramo donde un fallo
// es SILENCIOSO: en clase el profe ve romperse las cosas en el acto; una tarea
// rota se descubre SEMANAS después, cuando los intentos de los alumnos ya no
// están o nunca se guardaron. Aquí no hay segunda oportunidad de reproducir.
//
// El viaje completo, tecleando y pulsando (quien decide es la app, §27):
//   profe crea la tarea → el alumno entra por el PIN en la página de alumno →
//   pone su nombre → juega el quiz de verdad → "¡Tarea enviada!" con su nota →
//   el TOPE de intentos le cierra el segundo intento (gate ANTES de jugar) →
//   el profe abre "Intentos" y ve nombre y puntaje.
//
//   node tools/task-smoke.mjs
//
// Requiere: python3 + el Chromium preinstalado (igual que los otros smokes).
// Backend local (localStorage compartido entre las dos páginas del MISMO
// contexto): prueba las COSTURAS de la app, no la red — PocketBase real lo
// cubren race-e2e/stress-live.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8493);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
// UN contexto, DOS páginas: el driver local vive en localStorage y ambas deben
// verlo (igual que el profe y el alumno compartirían la Pi en producción).
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|favicon/i;
const errs = [];
const vigilar = (page) => {
  page.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(m); });
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(m.text().split('\n')[0]); });
  return page.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
};

let pasos = 0;
const ok = (m) => { pasos++; console.log('  ✓', m); };
const fail = (m) => { throw new Error(m); };

try {
  // ── EL PROFE: entra, siembra su quiz y crea la tarea ───────────────────────
  const profe = await ctx.newPage();
  await vigilar(profe);
  await profe.goto(`${BASE}/teacher.html?backend=local#/`, { waitUntil: 'domcontentloaded' });
  await profe.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  // La misma llave de sesión que usa la app (crear tareas exige sesión, §22).
  await profe.evaluate(() => localStorage.setItem('ww.pb.auth', JSON.stringify({
    token: 'smoke', record: { id: 'u_smoke', email: 'smoke@aulareto.test', name: 'Profe Smoke' },
  })));
  await profe.evaluate(async () => {
    await import('/core/registerTemplates.js');
    const s = await import('/core/storage.js');
    s.save({ id: 'tk_quiz', template: 'quiz', title: 'Repaso del sistema solar',
      rules: {}, scoring: { pointsPerCorrect: 1 }, presentation: {}, live: {},
      updatedAt: '2026-08-01T00:00:00Z',
      content: { items: [
        { id: 'i1', question: '¿Qué planeta es el rojo?', answer: 'Marte', options: ['Marte', 'Venus'] },
        { id: 'i2', question: '¿Y el de los anillos?', answer: 'Saturno', options: ['Saturno', 'Júpiter'] },
      ] } });
  });

  await profe.evaluate(() => { location.hash = '#/tasks/tk_quiz'; });
  await profe.waitForSelector('#t-create', { timeout: 9000 })
    .catch(() => fail('el profe CON sesión no llegó al panel de tareas (¿el gate de host lo paró?)'));
  ok('el profe con sesión entra al panel de tareas de su actividad');

  await profe.fill('#t-title', 'Tarea del sistema solar');
  await profe.fill('#t-max', '1');   // tope 1: el gate se prueba de verdad abajo
  await profe.click('#t-create');
  await profe.waitForSelector('.list-group-item code', { timeout: 9000 });
  const pin = (await profe.locator('.list-group-item code').first().innerText()).trim();
  if (!pin) fail('la tarea creada no muestra su PIN');
  ok(`tarea creada con PIN ${pin} y tope de 1 intento`);

  // ── EL ALUMNO: entra por el PIN, pone su nombre y JUEGA ────────────────────
  const alumno = await ctx.newPage();
  await vigilar(alumno);
  await alumno.goto(`${BASE}/student.html?backend=local#/task/${pin}`, { waitUntil: 'domcontentloaded' });
  await alumno.waitForSelector('#f-nick', { timeout: 9000 })
    .catch(() => fail('el enlace de la tarea no lleva a la pantalla de nombre'));
  await alumno.type('#f-nick', 'Vega', { delay: 20 });
  await alumno.click('#btn-go');
  await alumno.waitForSelector('#btn-start', { timeout: 9000 });
  await alumno.click('#btn-start');
  ok('el alumno entra por el PIN, pone su nombre y arranca la tarea');

  // Juega el quiz DE VERDAD: pulsa la opción correcta de cada pregunta (la
  // respuesta viene de la SEMILLA que sembró este test, no de mirar el veredicto).
  for (const resp of ['Marte', 'Saturno']) {
    await alumno.waitForSelector(`.ww-opt[data-value="${resp}"]`, { timeout: 9000 });
    await alumno.click(`.ww-opt[data-value="${resp}"]`);
    await alumno.waitForTimeout(1100);   // FEEDBACK_DELAY + avance
  }
  await alumno.waitForSelector('text=¡Tarea enviada!', { timeout: 9000 })
    .catch(() => fail('tras responder todo, no aparece "¡Tarea enviada!"'));
  const notaTxt = (await alumno.locator('#app').innerText()).replace(/\s+/g, ' ');
  if (!/Puntos:\s*2\s*\/\s*2/.test(notaTxt)) fail(`la nota mostrada no es 2 / 2: "${notaTxt.slice(0, 160)}"`);
  ok('juega el quiz completo y ve "¡Tarea enviada! · Puntos: 2 / 2"');

  // ── EL TOPE: el 2º intento se cierra ANTES de jugar (assignmentGate) ───────
  // El gate corta ANTES incluso de pedir el nombre (assignmentGate se consulta
  // primero): recargar el enlace debe llevar directo al aviso, sin formulario.
  await alumno.goto('about:blank');   // misma URL+hash sería navegación same-document (no recarga)
  await alumno.goto(`${BASE}/student.html?backend=local#/task/${pin}`, { waitUntil: 'domcontentloaded' });
  await alumno.waitForSelector('#app .alert', { timeout: 9000 })
    .catch(() => fail('con el tope agotado, no aparece el aviso del gate'));
  const gateTxt = (await alumno.locator('#app').innerText()).replace(/\s+/g, ' ');
  const hayStart = await alumno.locator('#btn-start').count();
  if (hayStart) fail('con el tope agotado, al alumno se le sigue ofreciendo "Comenzar"');
  if (!/intento/i.test(gateTxt)) fail(`el gate no explica por qué no puede entrar: "${gateTxt.slice(0, 160)}"`);
  ok('el 2º intento se cierra en la puerta y se le DICE el porqué (ley: avisar antes)');

  // ── EL PROFE: abre "Intentos" y ve a Vega con su nota ──────────────────────
  await profe.evaluate(() => { location.hash = '#/mine'; });
  await profe.waitForTimeout(300);
  await profe.evaluate(() => { location.hash = '#/tasks/tk_quiz'; });
  await profe.waitForSelector('a[href^="#/task/"]', { timeout: 9000 });
  await profe.click('a[href^="#/task/"]');
  await profe.waitForTimeout(800);
  const informe = (await profe.locator('#app').innerText()).replace(/\s+/g, ' ');
  if (!/Vega/.test(informe)) fail(`el informe de intentos no muestra al alumno: "${informe.slice(0, 200)}"`);
  if (!/2/.test(informe)) fail('el informe no muestra el puntaje');
  ok('el profe abre "Intentos" y ve a Vega con su puntaje — el ciclo se cierra');

  // ── INFORMES: las tres rutas que nadie caminaba ───────────────────────────
  // `#/reports` tiene botón propio en la barra y es el lunes por la mañana del
  // profe. Ninguna de sus tres rutas se abría en ningún test (auditoría
  // v1.51.401), y `#/reports/session/:id` compite con `#/reports/:id` en el
  // matcher: es justo donde un cambio de router rompe en silencio.
  await profe.evaluate(() => { location.hash = '#/reports'; });
  await profe.waitForTimeout(700);
  const informes = (await profe.locator('#app').innerText()).replace(/\s+/g, ' ');
  if (/Ruta no encontrada/i.test(informes)) fail('#/reports no resuelve');
  if (!/Informes/i.test(informes)) fail(`#/reports no pinta la portada de informes: "${informes.slice(0, 120)}"`);
  if (!/Repaso del sistema solar/.test(informes)) fail('la actividad del profe no aparece en informes');
  ok('#/reports lista las actividades del profe (y resuelve, que competía en el matcher)');

  // Y el detalle por actividad, que es el otro salto del matcher.
  await profe.click('a[href="#/reports/tk_quiz"]');
  await profe.waitForTimeout(700);
  const detalle = (await profe.locator('#app').innerText()).replace(/\s+/g, ' ');
  if (/Ruta no encontrada/i.test(detalle)) fail('#/reports/:id no resuelve');
  if (!/Repaso del sistema solar/.test(detalle)) fail('el informe de la actividad no la nombra');
  ok('#/reports/:id abre el informe de esa actividad');

  // §4c: un JUEGO no entra en informes de aprendizaje — no hay contenido del
  // profe del que informar. La derivación estaba escrita y sin aplicar.
  await profe.evaluate(async () => {
    const { newActivity } = await import('/core/migrate.js');
    const s = await import('/core/storage.js');
    const g = newActivity('ballsort');
    g.id = 'game_ballsort'; g.title = 'Ordena las Pelotas';
    s.save(g);
  });
  await profe.evaluate(() => { location.hash = '#/mine'; });
  await profe.waitForTimeout(200);
  await profe.evaluate(() => { location.hash = '#/reports'; });
  await profe.waitForTimeout(700);
  const conJuego = (await profe.locator('#app').innerText());
  if (/Ordena las Pelotas/.test(conJuego)) fail('§4c: un JUEGO no puede aparecer en los informes de aprendizaje');
  ok('§4c: el juego NO aparece en informes (un ranking de sudokus no dice nada de nadie)');

  if (errs.length) fail(`errores de página durante el viaje: ${errs[0]}`);
  console.log(`\n✅ TAREAS/INFORMES — ${pasos} pasos del viaje (tarea → PIN → jugar → tope → intentos → informes), sin errores de página.`);
  await browser.close();
  bye(0);
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  if (errs.length) console.error('   errores de página: ' + errs.slice(0, 3).join(' | '));
  await browser.close().catch(() => {});
  bye(1);
}
