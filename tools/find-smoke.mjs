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

  // 9. ELEGIR PLANTILLA → EL EDITOR MONTA. Aquí se paraba este recorrido, y
  //    detrás quedaba el tramo más usado después de jugar: `views/editView.js`
  //    no lo montaba NADIE (ni test ni smoke), así que "Guardar" podía romperse
  //    con el preflight en verde.
  await page.click('.tpl-pick[data-name="quiz"]');
  await page.waitForSelector('#f-title', { timeout: 9000 })
    .catch(() => fail('elegir plantilla no abre el editor (#f-title no aparece)'));
  const hashEd = await page.evaluate(() => location.hash);
  if (!/^#\/edit-new\/quiz/.test(hashEd)) fail(`elegir plantilla debía ir a #/edit-new/quiz, fue a ${hashEd}`);
  ok('elegir plantilla abre el editor de contenido (#/edit-new/quiz)');

  // 10. ESCRIBIR y GUARDAR: el gesto por el que el profe existe en esta app.
  await teclear('#f-title', 'Fotosíntesis avanzada');
  await teclear('.it-q', '¿Qué gas absorbe la planta?');

  // 10b. A MEDIAS NO SE JUEGA (v1.51.475). Con la pregunta escrita pero SIN
  //      respuesta correcta marcada, «Probar» tiene que negarse y DECIR por qué:
  //      así se jugaba antes, y todo contaba como fallo hasta el podio. Se mide
  //      aquí, en el editor, que es donde el profe lo vive.
  await page.click('#btn-test');
  await page.waitForTimeout(600);
  const avisoRojo = await page.locator('#ww-falta .alert-danger').count();
  const hashTrasProbar = await page.evaluate(() => location.hash);
  if (/#\/play\//.test(hashTrasProbar)) fail('«Probar» dejó jugar una actividad sin respuesta correcta marcada');
  if (!avisoRojo) fail('falta el aviso ROJO de lo que le falta a la actividad');
  ok('a medias NO se juega: «Probar» se niega y el editor dice EN ROJO qué falta');

  // 10c. …y en cuanto se completa, deja de estorbar (contra-prueba: un guardián
  //      que nunca abre la puerta es tan inútil como no tenerlo).
  await teclear('.it-opt[data-i="0"][data-k="0"]', 'Dióxido de carbono');
  await teclear('.it-opt[data-i="0"][data-k="1"]', 'Helio');
  await page.click('.it-correct[data-i="0"][data-k="0"]');
  await page.waitForTimeout(400);
  if (await page.locator('#ww-falta .alert-danger').count()) {
    fail('el aviso rojo sigue puesto con la actividad ya completa');
  }
  ok('al marcar la respuesta el aviso rojo desaparece solo (sin repintar la pestaña)');

  await page.click('#btn-save-draft');
  await page.waitForTimeout(900);
  const estado = await page.locator('#save-state').innerText();
  if (!/Guardado/i.test(estado)) fail(`tras "Guardar borrador" el estado dice «${estado.trim()}»`);
  ok(`escribir título y pregunta + Guardar borrador deja el estado en «${estado.trim()}»`);

  // 11. Lo recién creado se ENCUENTRA buscándolo: sin esto, "crea la tuya" es un
  //    consejo hueco — el profe la crea y luego no la localiza. Y ahora se busca
  //    lo que se TECLEÓ en el editor, no una actividad sembrada por el test:
  //    el ciclo entero (buscar → crear → editar → guardar → buscar) es real.
  await ir('#/mine');
  await page.waitForSelector('#h-q', { timeout: 9000 });
  await teclear('#h-q', 'fotosintesis');
  const encontrada = await page.locator('.acard-title').allInnerTexts();
  if (!encontrada.some(t => /Fotos/i.test(t))) fail(`la recién creada no se encuentra: ${JSON.stringify(encontrada)}`);
  ok('lo recién creado se encuentra al buscarlo (el ciclo buscar→crear→buscar cierra)');

  // 12. ⚖️ LEY §29 · PRESUPUESTO — "de la lista a la actividad en pantalla:
  //     ≤ 3 toques". Es el momento en que la clase ESTÁ ESPERANDO, y el número
  //     que el norte (§2b) declaraba "medible o no es nada" sin medirlo nunca.
  //     Se cuentan toques REALES: se pulsa lo que pulsaría el profe y se para
  //     en cuanto el juego está montado.
  await ir('#/mine');
  await page.waitForSelector('.acard', { timeout: 9000 });
  let toques = 0;
  const tocar = async (sel) => { await page.click(sel); toques++; await page.waitForTimeout(500); };
  await tocar('.acard [data-mode="solo"]');  // 1 · el modo Individual de su tarjeta
  await page.waitForSelector('.ww-start-go', { timeout: 9000 });
  await tocar('.ww-start-go');               // 2 · Iniciar
  await page.waitForSelector('#ww-player-widget *', { timeout: 12000 });
  if (toques > 3) fail(`de la lista a jugar hacen falta ${toques} toques; el presupuesto del norte §2b son 3`);
  ok(`§29 · de "Mis actividades" a la actividad jugándose: ${toques} toques (presupuesto: 3)`);

  // 13. LISTAS de actividades — 3 rutas y ~350 líneas con entrada visible desde
  //     dos sitios, y cobertura CERO hasta la auditoría v1.51.401. Un profe de
  //     idiomas vive de las listas de vocabulario encadenadas.
  await ir('#/new-list');
  await page.waitForSelector('#list-title', { timeout: 9000 })
    .catch(() => fail('#/new-list no abre el editor de listas'));
  await teclear('#list-title', 'Repaso del viernes');
  const añadibles = await page.locator('.list-add').count();
  if (!añadibles) fail('el editor de listas no ofrece actividades que encadenar');
  await page.click('.list-add');
  await page.waitForTimeout(400);
  await page.click('#list-save');
  await page.waitForTimeout(700);
  await ir('#/mine');
  // La caja de búsqueda conserva lo tecleado antes (es lo correcto: el profe
  // vuelve y sigue donde estaba), así que se limpia para ver la lista entera.
  await teclear('#h-q', '');
  const enMisActividades = (await page.locator('#app').innerText());
  if (!/Repaso del viernes/.test(enMisActividades)) fail('la lista guardada no aparece en Mis actividades');
  ok('listas: crear → encadenar una actividad → guardar → aparece en Mis actividades');

  // Y se puede JUGAR, que es para lo que existe.
  await page.click('.mode-list');
  await page.waitForTimeout(800);
  const jugandoLista = await page.evaluate(() => location.hash);
  if (!/^#\/list\//.test(jugandoLista)) fail(`"Jugar lista" no lleva a #/list/:id, fue a ${jugandoLista}`);
  const pantallaLista = (await page.locator('#app').innerText());
  if (/Ruta no encontrada/i.test(pantallaLista)) fail('#/list/:id no resuelve');
  ok(`la lista se juega: "Jugar" lleva a ${jugandoLista} y monta`);

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
