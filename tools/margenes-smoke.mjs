// MÁRGENES DEL PANEL — R-A: ninguna pantalla del profe se pinta pegada al borde.
//
// Por qué es una red y no una revisión a ojo: los márgenes del editor, los
// reportes y el admin se PERDIERON sin que nadie lo notara. `#app` traía el
// `container py-3` de Bootstrap y lo perdió al rediseñar la home, que puso su
// propio envoltorio y quedó bien — las otras 15 pantallas se quedaron a ras del
// borde durante semanas, hasta que el dueño intentó crear una actividad y dijo
// «está ahogado». Ninguna suite podía verlo: es geometría, no lógica.
//
//   node tools/margenes-smoke.mjs
//
// Mide en PC (1280) y en móvil (390) la distancia del contenido al borde. Se
// juzga el contenido REAL de cada ruta, no un contenedor vacío.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8494);
const BASE = `http://127.0.0.1:${PORT}`;
const MIN_PC = 8;      // en pantalla ancha el contenido nunca toca el cristal
const MIN_MOVIL = 4;   // en el teléfono el aire es menor, pero existe

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (c) => { try { server.kill(); } catch {} process.exit(c); };
process.on('SIGINT', () => bye(130));
process.on('uncaughtException', (e) => { console.error('\n❌ ABORTADA:', e?.message || e); bye(1); });
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();

// Las rutas de CHROME del profe: formularios, tablas y paneles. El juego queda
// fuera a propósito — su marco tiene sus propias reglas (§3) y ahí el borde a
// borde es correcto.
const RUTAS = [
  { hash: '#/mine',        que: 'Mis actividades',   espera: '.home-wrap' },
  { hash: '#/new',         que: 'Elegir plantilla',  espera: '#app *' },
  { hash: '#/edit/mg_q',   que: 'Editor de quiz',    espera: '#ed-title, input' },
  { hash: '#/edit/mg_dg',  que: 'Editor de diagrama', espera: '#ed-title, input' },
  { hash: '#/reports',     que: 'Reportes',          espera: '#app *' },
  { hash: '#/explore',     que: 'Biblioteca',        espera: '#app *' },
  { hash: '#/juegos',      que: 'Estantería',        espera: '#app *' },
  { hash: '#/registro',    que: 'Alta de profe',     espera: 'input' },
];

async function medir(nombre, ctxOpts, minimo) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).split('\n')[0]));
  await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('#app'), { timeout: 20000 });
  await page.evaluate(async () => {
    await import('/core/registerTemplates.js');
    const { getTemplate } = await import('/core/registry.js');
    const s = await import('/core/storage.js');
    for (const [id, t] of [['mg_q', 'quiz'], ['mg_dg', 'diagram']]) {
      const T = getTemplate(t);
      s.save({ id, template: t, title: `Márgenes · ${t}`,
        content: T.meta.defaultContent ? T.meta.defaultContent() : {},
        rules: {}, scoring: {}, updatedAt: 'x' });
    }
  });

  const filas = [];
  for (const r of RUTAS) {
    // Ruta NEUTRA distinta de la que se va a medir: si se navega al mismo hash
    // no salta `hashchange` y se acabaría midiendo lo que hubiera pintado antes
    // (la primera fila daba un desbordamiento fantasma de 174px por esto).
    await page.evaluate(h => {
      location.hash = h === '#/juegos' ? '#/mine' : '#/juegos';
      location.hash = h;
    }, r.hash);
    await page.waitForSelector(r.espera, { timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      let izq = Infinity, der = Infinity, peor = '';
      // Lo que de verdad ve el profe: cajas visibles con contenido dentro de
      // #app. Se ignora lo que ocupa TODO el ancho a propósito (barras, hr).
      for (const el of document.querySelectorAll('#app *')) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const b = el.getBoundingClientRect();
        if (b.width < 40 || b.height < 12) continue;
        if (b.width > vw - 2) continue;                       // a sangre: no cuenta
        if (b.left < izq) { izq = b.left; peor = (el.textContent || el.tagName).trim().slice(0, 24); }
        der = Math.min(der, vw - b.right);
      }
      return { vw, izq: Math.round(izq), der: Math.round(der), peor,
               desbordaH: document.documentElement.scrollWidth > vw + 1 };
    });
    filas.push({ ...r, ...m, ok: m.izq >= minimo && m.der >= minimo && !m.desbordaH });
  }
  await page.close();
  return { filas, errs };
}

console.log(`\n📐 MÁRGENES DEL PANEL — ${RUTAS.length} rutas × 2 anchos\n`);
let fallos = 0;
for (const [nombre, opts, minimo] of [
  ['PC 1280', { viewport: { width: 1280, height: 900 } }, MIN_PC],
  ['móvil 390', devices['iPhone 12'], MIN_MOVIL],
]) {
  const { filas, errs } = await medir(nombre, opts, minimo);
  console.log(`  ${nombre} (mínimo ${minimo}px)`);
  for (const f of filas) {
    console.log(`    ${f.ok ? '✅' : '❌'} ${f.que.padEnd(20)} izq ${String(f.izq).padStart(4)}px · der ${String(f.der).padStart(4)}px`
      + `${f.desbordaH ? ' · DESBORDA a lo ancho' : ''}${f.ok ? '' : `  ← «${f.peor}»`}`);
    if (!f.ok) fallos++;
  }
  if (errs.length) console.log(`    ⚠️ errores de página: ${[...new Set(errs)].join(' · ')}`);
  console.log('');
}
await browser.close();

if (fallos) {
  console.log(`❌ ${fallos} pantalla(s) pegadas al borde. El aire lo pone «#app:not(.container)» en styles/home.css.\n`);
  bye(1);
}
console.log('✅ ninguna pantalla del profe toca el borde, ni en PC ni en móvil\n');
bye(0);
