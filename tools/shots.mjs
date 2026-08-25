// RED DE SEGURIDAD Nº3 — CAPTURAS: la misma pantalla, antes y después de tocar CSS.
//
// Por qué existe: la deuda de §3 ("el bloque keypad-fit está copiado en 3 sitios")
// no se podía cerrar porque unificar CSS sin ver el resultado es cómo se rompe una
// pizarra a mitad de clase. `tests/styles.test.mjs` vigila el CONTRATO (tokens, sin
// px fijos), pero no puede decir si el teclado sigue cabiendo. Esto sí.
//
//   node tools/shots.mjs before        # guarda en .shots/before/
//   node tools/shots.mjs after         # guarda en .shots/after/ y COMPARA con before
//
// La comparación es por PÍXEL (mismo Chromium, mismo viewport, animaciones
// congeladas). Se toleran hasta TOL_PX píxeles con diferencia pequeña: el borde
// del marco a veces redondea distinto entre procesos y no vale un falso positivo.
// Cualquier cambio de layout mueve miles de píxeles, así que el margen no tapa
// nada real.
//
// Requiere: python3 (servidor estático) y el Chromium preinstalado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8492);
const BASE = `http://127.0.0.1:${PORT}`;
const label = (process.argv[2] || 'before').replace(/[^\w-]/g, '');
const OUT = join(ROOT, '.shots', label);
mkdirSync(OUT, { recursive: true });

// Las combinaciones que la deuda §3 pide verificar: los dos modos de pantalla
// compartida × los skins con CSS propio × las dos orientaciones.
//
// DOS PLANTILLAS, no una. Empezó solo con Operaciones (el teclado, que era lo que
// se estaba unificando) y con eso la red no cubría la mitad del trabajo: la
// TANDA 3 de la migración de temas es justo Quiz —las opciones que lee la clase—
// y se habría migrado a ciegas, que es como se rompió la barra del marcador
// (256k píxeles). Una red de capturas que no ve la pantalla que estás tocando no
// es una red.
const PLANTILLAS = [
  { id: 'math', titulo: 'Capturas · Operaciones' },
  { id: 'quiz', titulo: 'Capturas · Quiz' },
];
const SKINS = ['default', 'tv-show', 'arcade'];
const MODES = [
  { id: 'vs',    route: (id) => `#/vs/${id}`,    ready: '.vs-arena' },
  { id: 'teams', route: (id) => `#/teams/${id}`, ready: '.teams-card, .teams-arena' },
];
const SIZES = [
  { id: 'landscape', width: 1280, height: 800 },
  { id: 'portrait',  width: 800,  height: 1280 },
];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const shots = [];
let bootstrapVisto = false;   // ¿ha llegado alguna vez la hoja del CDN?

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  // Sin red saliente en el sandbox: el confetti (CDN) se sustituye por un módulo
  // vacío para que su fallo no ensucie la captura.
  await page.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
  // BOOTSTRAP: se DEJA cargar. Estuvo sustituido por vacío «para no depender de
  // la red», y con eso las capturas dejaron de parecerse a producción: sin él,
  // los botones caen a la fuente del navegador, y una comparación 24/24 idéntica
  // daba por bueno un cambio de tipografía que en el sitio real sí se habría
  // visto. Si no llega (sandbox sin salida), se AVISA en voz alta al final en vez
  // de fingir que la captura es la pantalla del profe.
  page.on('response', r => {
    if (/cdn\.jsdelivr\.net\/.*bootstrap.*\.css/.test(r.url()) && r.ok()) bootstrapVisto = true;
  });
  await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  // Animaciones y transiciones OFF: una captura no puede depender de en qué
  // fotograma se tomó.
  await page.addStyleTag({ content: `*, *::before, *::after {
    animation: none !important; transition: none !important; caret-color: transparent !important; }` });

  // Una actividad por plantilla y skin (el skin viaja en presentation).
  await page.evaluate(async ({ skins, plantillas }) => {
    await import('/core/registerTemplates.js');
    const { getTemplate } = await import('/core/registry.js');
    const storage = await import('/core/storage.js');
    for (const pl of plantillas) {
      const T = getTemplate(pl.id);
      for (const skin of skins) {
        storage.save({
          id: `shot_${pl.id}_${skin}`, template: pl.id, title: pl.titulo,
          content: T.meta.defaultContent ? T.meta.defaultContent() : {},
          // SIN BARAJAR. Quiz mezcla las opciones en cada montaje, así que dos
          // capturas de la MISMA versión salían con «Madrid» en sitios distintos
          // y la comparación cantaba 2.500 píxeles de cambio sin que nadie
          // hubiera tocado nada. Una red que da falsos positivos se acaba
          // ignorando, y entonces ya no protege de los verdaderos.
          rules: { ...(T.meta.defaultRules ? T.meta.defaultRules() : {}),
                   shuffleOptions: false, randomize: false },
          scoring: T.meta.defaultScoring ? T.meta.defaultScoring() : {},
          presentation: { skin, background: 'none' },
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      }
    }
  }, { skins: SKINS, plantillas: PLANTILLAS });

  for (const pl of PLANTILLAS) {
   for (const skin of SKINS) {
    for (const mode of MODES) {
      const name = `${mode.id}-${pl.id}-${skin}-${size.id}.png`;
      try {
        await page.evaluate(() => { location.hash = '#/mine'; });
        await page.waitForTimeout(120);
        await page.evaluate(h => { location.hash = h; }, mode.route(`shot_${pl.id}_${skin}`));
        await page.waitForSelector('.ww-mode-start', { timeout: 9000 });
        await page.click('.ww-mode-start');
        await page.waitForSelector(mode.ready, { timeout: 9000 });
        await page.waitForTimeout(700);        // que el fitLayout haga su pase
        await page.screenshot({ path: join(OUT, name) });
        shots.push(name);
      } catch (e) {
        console.log(`  ⚠ ${name}: ${String(e.message).split('\n')[0]}`);
      }
    }
   }
  }
  await page.close();
}
await browser.close();
// El servidor sigue vivo: la comparación carga los PNG por HTTP (un canvas no
// puede leer file:// sin origen). Lo cierra bye() al final.
console.log(`\n${shots.length} capturas en .shots/${label}/`);
if (!bootstrapVisto) {
  console.log('\n⚠  BOOTSTRAP NO CARGÓ (sin salida a la red): estas capturas NO son');
  console.log('   la pantalla de producción — los botones caen a la fuente del');
  console.log('   navegador. Sirven para comparar ENTRE ELLAS, no como verdad visual.');
}

// Comparación con `before` si estamos guardando otra tanda.
const TOL_PX = 8;          // píxeles sueltos tolerados (antialias del borde)
const TOL_DELTA = 12;      // y solo si su diferencia es pequeña
const REF = join(ROOT, '.shots', 'before');
if (label !== 'before' && existsSync(REF)) {
  const refs = readdirSync(REF).filter(f => f.endsWith('.png'));
  const cmpBrowser = await chromium.launch();
  const page = await cmpBrowser.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  let same = 0; const diff = [];
  for (const f of refs) {
    if (!existsSync(join(OUT, f))) { diff.push(`${f} (falta en ${label})`); continue; }
    const r = await page.evaluate(async ([pa, pb]) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('no carga ' + src)); i.src = src; });
      const [ia, ib] = await Promise.all([load(pa), load(pb)]);
      const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); return cx.getImageData(0, 0, img.width, img.height).data; };
      const da = px(ia), db = px(ib);
      if (da.length !== db.length) return { n: Infinity, maxd: 255 };
      let n = 0, maxd = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i+1] - db[i+1]), Math.abs(da[i+2] - db[i+2]));
        if (d > 2) { n++; if (d > maxd) maxd = d; }
      }
      return { n, maxd };
    }, [`${BASE}/.shots/before/${f}`, `${BASE}/.shots/${label}/${f}`]);
    if (r.n === 0 || (r.n <= TOL_PX && r.maxd <= TOL_DELTA)) { same++; if (r.n) console.log(`  ~ ${f}: ${r.n}px de ruido (δ${r.maxd})`); }
    else diff.push(`${f} — ${r.n} píxeles distintos (δ máx ${r.maxd})`);
  }
  await cmpBrowser.close();
  console.log(`\nIguales (dentro del margen): ${same}/${refs.length}`);
  if (diff.length) {
    console.log('CAMBIAN (míralas antes de dar por bueno el refactor):');
    for (const f of diff) console.log(`  · ${f}`);
    bye(1);
  }
  console.log('Sin cambios visuales.');
}
bye(0);
