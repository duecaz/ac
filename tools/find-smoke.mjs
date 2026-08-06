// RED DE SEGURIDAD Nº5 — BUSCAR / CREAR de punta a punta, con el navegador.
//
// POR QUÉ EXISTE. Es el tramo por el que pasa TODA clase (`docs/norte.md` §1) y
// era el ÚNICO sin recorrido automático: la matriz cubre jugar, live-smoke cubre
// el vivo, race-e2e la carrera. Aquí no había nada — y se notó. En una misma
// semana aparecieron dos fallos que ninguna suite podía ver porque las dos vivían
// en la COSTURA entre piezas correctas:
//
//   · el buscador de la portada navegaba a `#/explore?q=…` y el router no
//     admitía la `?` → "Ruta no encontrada" al buscar. Ambas piezas, correctas
//     por separado; el enlace que la propia app generaba, roto.
//   · el badge de nº de páginas solo lo pedía "Mis actividades", así que faltaba
//     en la portada y en el perfil sin que ningún test lo notara.
//
// La regla que fija este archivo: **no se prueba una función, se camina el
// viaje** — se teclea en la caja real, se pulsa el botón real, y quien decide es
// la app. Un test que se salte la interfaz prueba otra cosa (ver race-e2e, que
// pasaba el veredicto ya masticado y por eso no vio la carrera rota).
//
//   node tools/find-smoke.mjs
//
// Requiere: python3 + el Chromium preinstalado (igual que matrix-smoke).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8489);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Ruido del sandbox (sin red saliente): el CDN de Bootstrap/confetti no carga.
const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|favicon/i;
const errs = [];
page.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(m); });
page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(m.text().split('\n')[0]); });
await page.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));

let pasos = 0;
const ok = (m) => { pasos++; console.log('  ✓', m); };
const fail = (m) => { throw new Error(m); };
const pantalla = async () => (await page.locator('#app').innerText()).replace(/\s+/g, ' ').trim();
const ir = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(450); };

// Teclear de verdad, letra a letra: el buscador de la home re-monta la vista en
// cada tecla y ha perdido el foco por eso más de una vez.
const teclear = async (sel, texto) => {
  await page.fill(sel, '');
  await page.type(sel, texto, { delay: 25 });
  await page.waitForTimeout(350);
};

try {
  // ── El profe llega SIN sesión: la portada es su entrada ────────────────────
  await page.goto(`${BASE}/teacher.html?backend=local#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#lp-q', { timeout: 20000 });

  // 1. Busca su tema desde la portada. Este es el paso que llevaba a un 404.
  await teclear('#lp-q', 'comas');
  await page.click('#lp-go');
  await page.waitForTimeout(700);
  const hash = await page.evaluate(() => location.hash);
  const txt1 = await pantalla();
  if (/Ruta no encontrada/i.test(txt1)) fail(`buscar desde la portada lleva a 404 (${hash})`);
  if (!/^#\/explore/.test(hash)) fail(`buscar desde la portada debía llevar a la biblioteca, fue a ${hash}`);
  ok(`portada → Buscar lleva a la biblioteca (${hash}), no a "Ruta no encontrada"`);

  // 2. …y llega con el término PUESTO: si no, hay que teclearlo dos veces.
  const puesto = await page.inputValue('#exp-q');
  if (puesto !== 'comas') fail(`la biblioteca perdió el término: "${puesto}"`);
  ok('la biblioteca hereda el término tecleado (no se teclea dos veces)');

  // 3. "No hay" no es un callejón: lleva a CREAR (norte §2b, buscar es binario).
  const crearEnBiblioteca = await page.locator('.home-empty a[href="#/new"]').count();
  if (!crearEnBiblioteca) fail('la biblioteca vacía no ofrece crear');
  ok('sin resultados en la biblioteca, la salida ofrecida es CREAR');

  // ── Entra como profe (misma llave que usa la app, no un truco) ─────────────
  await page.evaluate(() => localStorage.setItem('ww.pb.auth', JSON.stringify({
    token: 'smoke', record: { id: 'u_smoke', email: 'smoke@aulareto.test', name: 'Profe Smoke' },
  })));
  await page.evaluate(async () => {
    await import('/core/registerTemplates.js');
    const s = await import('/core/storage.js');
    const base = { rules: {}, scoring: { pointsPerCorrect: 1 }, presentation: {}, live: {}, updatedAt: '2026-08-01T00:00:00Z' };
    s.save({ ...base, id: 'f_tri', template: 'quiz', title: 'Puntos notables del triángulo', tags: ['geometría'],
      content: { items: [
        { id: 'i1', question: '¿Dónde se cortan las medianas?', answer: 'baricentro', options: ['baricentro', 'incentro'] },
        { id: 'i2', question: '¿Y las alturas?', answer: 'ortocentro', options: ['ortocentro', 'circuncentro'] },
      ] } });
    s.save({ ...base, id: 'f_cel', template: 'quiz', title: 'Repaso del tema 3',
      content: { items: [{ id: 'c1', question: '¿Qué orgánulo produce la energía?', answer: 'la mitocondria', options: ['la mitocondria', 'el núcleo'] }] } });
    s.save({ ...base, id: 'f_par', template: 'match', title: 'Partes de la planta',
      content: { pairs: [{ id: 'p1', left: 'Raíz', right: 'Absorbe agua' }, { id: 'p2', left: 'Hoja', right: 'Hace la fotosíntesis' }] } });
  });
  await ir('#/mine');
  await page.waitForSelector('.acard', { timeout: 12000 });
  const total = await page.locator('.acard').count();
  if (total !== 3) fail(`esperaba 3 actividades en Mis actividades, hay ${total}`);
  ok(`"Mis actividades" lista las 3 sembradas`);

  // 4. La tarjeta dice de cuántas HOJAS es antes de abrirla (v1.51.184: páginas,
  //    no elementos — Emparejar son 2 pares en UNA pantalla).
  const badges = await page.locator('.acard-pages').allInnerTexts();
  if (badges.length !== 3) fail(`el badge de páginas falta en ${3 - badges.length} tarjeta(s)`);
  const pares = await page.locator('.acard:has-text("Partes de la planta") .acard-pages').innerText();
  if (pares.trim() !== '1') fail(`Emparejar debería decir 1 página, dice "${pares}"`);
  ok(`las 3 tarjetas muestran sus páginas (Emparejar: 1 hoja con 2 pares, no 2)`);

  // 5. Busca por TEMA y SIN TILDE: en una pizarra se teclea rápido y mal.
  await teclear('#h-q', 'geometria');
  const trasTilde = await page.locator('.acard').count();
  if (trasTilde !== 1) fail(`"geometria" (sin tilde) debía dejar 1 actividad, dejó ${trasTilde}`);
  ok('busca sin tildes: "geometria" encuentra la etiquetada «geometría»');

  // 6. …y por lo que hay DENTRO del contenido (el tema suele estar ahí).
  await teclear('#h-q', 'mitocondria');
  const dentro = await page.locator('.acard-title').allInnerTexts();
  if (dentro.length !== 1 || !/Repaso del tema 3/.test(dentro[0])) {
    fail(`buscar dentro del contenido falló: ${JSON.stringify(dentro)}`);
  }
  ok('busca dentro del contenido: "mitocondria" encuentra «Repaso del tema 3»');

  // 7. Lo que no tiene: el vacío nombra el término y ofrece las DOS salidas.
  await teclear('#h-q', 'fotosintesis avanzada');
  const vacio = await pantalla();
  if (!/fotosintesis avanzada/i.test(vacio)) fail('el vacío no dice QUÉ no encontró');
  const salidas = await page.locator('.home-empty a').count();
  if (salidas < 2) fail(`el vacío ofrece ${salidas} salida(s); deben ser crear + biblioteca`);
  ok('el "no hay" nombra el término y ofrece crear · buscar en la biblioteca');

  // 8. Y CREAR de verdad funciona desde ese vacío: el bucle se cierra.
  await page.click('.home-empty a[href="#/new"]');
  await page.waitForTimeout(700);
  const sel = await pantalla();
  if (/Ruta no encontrada|Entra para crear/i.test(sel)) fail(`"Crear una" no llega a elegir plantilla: ${sel.slice(0, 80)}`);
  const plantillas = await page.locator('.tpl-pick[data-name]').count();
  if (plantillas < 13) fail(`la pantalla de crear ofrece ${plantillas} plantillas; deben ser 13+`);
  ok(`desde el vacío se llega a elegir plantilla (${plantillas} disponibles)`);

  // 9. Lo recién creado se ENCUENTRA buscándolo: sin esto, "crea la tuya" es un
  //    consejo hueco — el profe la crea y luego no la localiza.
  await page.evaluate(async () => {
    const { newActivity } = await import('/core/migrate.js');
    const s = await import('/core/storage.js');
    const a = newActivity('quiz');
    a.title = 'Fotosíntesis avanzada';
    a.updatedAt = '2026-08-02T00:00:00Z';
    s.save(a);
  });
  await ir('#/mine');
  await page.waitForSelector('#h-q', { timeout: 9000 });
  await teclear('#h-q', 'fotosintesis');
  const encontrada = await page.locator('.acard-title').allInnerTexts();
  if (!encontrada.some(t => /Fotos/i.test(t))) fail(`la recién creada no se encuentra: ${JSON.stringify(encontrada)}`);
  ok('lo recién creado se encuentra al buscarlo (el ciclo buscar→crear→buscar cierra)');

  if (errs.length) {
    console.error('\nERRORES DE PÁGINA:');
    errs.slice(0, 6).forEach(e => console.error('  ✗', e));
    fail(`${errs.length} error(es) de página durante el recorrido`);
  }

  console.log(`\n✅ BUSCAR/CREAR PASA — ${pasos} pasos del viaje real del profe`
    + ' (portada → buscar → biblioteca → mis actividades → filtrar → vacío → crear → volver a buscar).');
  await browser.close(); bye(0);
} catch (e) {
  console.error('\n❌ BUSCAR/CREAR FALLA:', String(e.message).split('\n')[0]);
  if (errs.length) errs.slice(0, 6).forEach(x => console.error('  ✗', x));
  try { await page.screenshot({ path: join(ROOT, 'find-smoke-fallo.png') }); console.error('  · captura: find-smoke-fallo.png'); } catch {}
  try { await browser.close(); } catch {}
  bye(1);
}
