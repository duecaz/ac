// RED DE SEGURIDAD — EL AULA LENTA (§27, y el norte §1: pizarras de colegio).
//
// POR QUÉ EXISTE. El dueño abrió Tildes en un colegio, en una pizarra básica, y
// «se veía lenta»; el confeti del podio, peor. Ninguna red lo veía: la matriz
// comprueba que cada plantilla ARRANCA, no a cuántos fotogramas por segundo va,
// y todas las sondas corrían en un portátil headless a toda velocidad. Un juego
// que funciona pero va a 8 fps está roto para la clase que lo mira.
//
// Se mide con la CPU FRENADA (CDP) y en una pantalla GRANDE, porque los dos
// defectos que encontró esta sonda solo aparecen así:
//
//   · TILDES EN REPOSO — la barra de progreso animaba `width`, y animar el ancho
//     obliga a recalcular la MAQUETA en cada fotograma, todo el rato mientras
//     corre el reloj. Medido: 19 fps en 4K sin que el alumno tocara nada. Con
//     `transform: scaleX()` (compositor) → 60 fps. En un portátil 1080p el mismo
//     defecto daba 60 fps: por eso hacía falta medir en la pantalla del AULA.
//
//   · CONFETI DEL PODIO — el lienzo se creaba del tamaño de la pantalla, así que
//     en 4K eran 8,3 millones de píxeles borrados y recompuestos 60 veces por
//     segundo: 128 ms por fotograma (8 fps) mientras la clase mira el podio. Con
//     el lienzo TOPADO y la física escalada (se ve igual) → 31 ms.
//
// Los umbrales son GENEROSOS a propósito: esto no vigila milisegundos, vigila
// que no vuelva a colarse un defecto de ORDEN DE MAGNITUD. Un fallo aquí no es
// «va un poco justo», es «la clase lo nota».
//
//   node tools/perf-sonda.mjs
import { createRequire } from 'node:module';
import { abrirServidor } from './helpers/servidorSonda.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

// Pizarra grande + CPU frenada: el aparato del aula, no el de quien programa.
const PANTALLA = { width: 3840, height: 2160 };
const FRENO = 12;
// Techos de mediana por fotograma. 33 ms = 30 fps: por debajo de eso la clase ve
// tirones. El reposo se exige MÁS (25 ms) porque ahí no debería pasar NADA.
const TECHO_REPOSO = 25;
const TECHO_CONFETI = 60;

const { base: BASE, cerrar } = await abrirServidor();
const bye = (code) => { cerrar(); process.exit(code); };
process.on('SIGINT', () => bye(130));

const browser = await chromium.launch();
let fallos = 0;
const ok = (m) => console.log('  ✅', m);
const mal = (m) => { fallos++; console.log('  ❌', m); };

/** Abre la app en una pizarra grande, con la CPU frenada DESPUÉS de cargar (lo
 *  que se mide es jugar, no arrancar). */
async function abrirPizarra() {
  const page = await browser.newPage({ viewport: PANTALLA });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  return { page, frenar: () => cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO }) };
}

/** Mide fotogramas durante `ms` y devuelve la mediana y el p95. Se descartan los
 *  tres primeros: el primero siempre trae el coste de arrancar el bucle. */
const MEDIR = (ms) => `(async () => {
  const frames = []; let last = performance.now(), parar = false;
  (function m(){ const n = performance.now(); frames.push(n - last); last = n; if (!parar) requestAnimationFrame(m); })();
  await new Promise(r => setTimeout(r, ${ms}));
  parar = true;
  const o = frames.slice(3).sort((a, b) => a - b);
  if (o.length < 5) return { pocos: o.length };
  return { med: +o[o.length >> 1].toFixed(1), p95: +o[Math.floor(o.length * 0.95)].toFixed(1), n: frames.length };
})()`;

// ── 1. TILDES EN REPOSO ─────────────────────────────────────────────────────
// El alumno lee la frase y no toca nada. Si ESTO no va fluido, escribir encima
// tampoco irá: es el suelo de todo lo demás.
{
  const { page, frenar } = await abrirPizarra();
  await page.evaluate(async () => {
    const { getTemplate } = await import('/core/registry.js');
    const { save } = await import('/core/storage.js');
    const T = getTemplate('tildes');
    save({ id: 'perf-hoja', template: 'tildes', title: 'Sonda de rendimiento',
      content: T.meta.defaultContent(), rules: { ...(T.meta.defaultRules?.() || {}), timer: 60 },
      scoring: T.meta.defaultScoring?.() || {},
      presentation: { skin: 'default', background: 'none' }, updatedAt: new Date().toISOString() });
  });
  await page.evaluate(() => { location.hash = '#/play/perf-hoja'; });
  await page.waitForTimeout(900);
  await page.click('.ww-start-go').catch(() => {});
  await page.waitForSelector('.tc-round', { timeout: 15000 });
  // El RELOJ TIENE QUE ESTAR CORRIENDO o esto no mide nada: el defecto vivía en
  // la barra de progreso, que solo se mueve mientras queda tiempo.
  const hayReloj = await page.$('[data-progreso]');
  if (!hayReloj) mal('la hoja no pinta barra de progreso: la sonda mediría una pantalla quieta y daría verde gratis');
  await frenar();
  await page.waitForTimeout(400);
  const r = await page.evaluate(MEDIR(4000));
  if (r.pocos !== undefined) mal(`solo ${r.pocos} fotogramas medidos: la sonda no está midiendo`);
  else if (r.med <= TECHO_REPOSO) ok(`Tildes EN REPOSO en pizarra 4K con la CPU frenada ${FRENO}x: ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps)`);
  else mal(`Tildes EN REPOSO va a ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps, techo ${TECHO_REPOSO} ms). `
         + 'Algo repinta sin parar: mira si alguna animación toca ancho/alto/posición (eso recalcula la maqueta) '
         + 'en vez de `transform`/`opacity`.');
  await page.close();
}

// ── 2. EL CONFETI DEL PODIO ─────────────────────────────────────────────────
{
  const { page, frenar } = await abrirPizarra();
  await frenar();
  const r = await page.evaluate(async (medir) => {
    const { GameEvents, emitGame } = await import('/core/gameEvents.js');
    await import('/core/effects.js');
    const medida = eval(medir);
    emitGame(GameEvents.PODIUM, {});
    const out = await medida;
    const cv = document.querySelector('canvas');
    return { ...out, px: cv ? cv.width * cv.height : 0, ancho: cv ? cv.width : 0 };
  }, MEDIR(2500));
  if (r.pocos !== undefined) mal(`solo ${r.pocos} fotogramas medidos durante el confeti`);
  else if (r.med <= TECHO_CONFETI) ok(`confeti del podio en pizarra 4K frenada ${FRENO}x: ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps)`);
  else mal(`el confeti deja la pizarra a ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps, techo ${TECHO_CONFETI} ms)`);
  // Y la CAUSA, vigilada aparte: el lienzo no puede crecer con la pantalla. Sin
  // esto, alguien «arregla» los fps bajando partículas y el defecto vuelve en la
  // siguiente pizarra más grande.
  if (!r.ancho) mal('el confeti no pintó ningún lienzo: la medida de arriba no vale');
  else if (r.ancho < PANTALLA.width) ok(`y su lienzo NO crece con la pantalla: ${r.ancho} px de dibujo en una pizarra de ${PANTALLA.width} px`);
  else mal(`el lienzo del confeti mide ${r.ancho} px, lo mismo que la pantalla: el coste de pintarlo vuelve a crecer con el tamaño de la pizarra`);
  await page.close();
}

// ── 3. ESCRIBIR EN LA HOJA (la pizarra REAL del aula: 1080p) ────────────────
// El defecto que se arregló aquí era repintar el lienzo ENTERO en cada punto:
// escribir dejaba la pizarra en 12 fps. Ahora se pinta solo el trozo nuevo. Se
// mide en 1080p —la pantalla que de verdad hay en las aulas— y con el mismo
// freno: es el caso que el dueño tenía delante cuando dijo «se ve lenta».
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  await page.evaluate(async () => {
    const { getTemplate } = await import('/core/registry.js');
    const { save } = await import('/core/storage.js');
    const T = getTemplate('tildes');
    save({ id: 'perf-escribir', template: 'tildes', title: 'Sonda de escritura',
      content: T.meta.defaultContent(), rules: { ...(T.meta.defaultRules?.() || {}), timer: 60 },
      scoring: T.meta.defaultScoring?.() || {},
      presentation: { skin: 'default', background: 'none' }, updatedAt: new Date().toISOString() });
  });
  await page.evaluate(() => { location.hash = '#/play/perf-escribir'; });
  await page.waitForTimeout(900);
  await page.click('.ww-start-go').catch(() => {});
  await page.waitForSelector('.tc-round', { timeout: 15000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const cv = document.querySelector('.tc-canvas');
    if (!cv) return { sinLienzo: true };
    const box = cv.getBoundingClientRect();
    const frames = []; let last = performance.now(), parar = false;
    (function m(){ const n = performance.now(); frames.push(n - last); last = n; if (!parar) requestAnimationFrame(m); })();
    const ev = (t, x, y, id) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, isPrimary: true,
      bubbles: true, pointerType: 'pen', clientX: box.left + x, clientY: box.top + y, width: 12, height: 12 }));
    const esperar = (ms) => new Promise(r => setTimeout(r, ms));
    // Seis marcas seguidas, con el ritmo de eventos de una pizarra táctil (~125 Hz).
    for (let t = 0; t < 6; t++) {
      const x0 = 80 + t * 120;
      ev('pointerdown', x0, 60, t + 1);
      for (let i = 0; i < 30; i++) { ev('pointermove', x0 + i, 60 - i * 0.4, t + 1); await esperar(8); }
      ev('pointerup', x0 + 30, 48, t + 1);
      await esperar(60);
    }
    parar = true;
    const o = frames.slice(3).sort((a, b) => a - b);
    if (o.length < 5) return { pocos: o.length };
    return { med: +o[o.length >> 1].toFixed(1), p95: +o[Math.floor(o.length * 0.95)].toFixed(1) };
  });
  if (r.sinLienzo) mal('la hoja no montó su lienzo de tinta: no se ha medido escribir');
  else if (r.pocos !== undefined) mal(`solo ${r.pocos} fotogramas mientras se escribía`);
  else if (r.med <= TECHO_REPOSO) ok(`ESCRIBIR en la pizarra del aula (1080p, CPU frenada ${FRENO}x): ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps)`);
  else mal(`escribir deja la pizarra a ${r.med} ms/fotograma (${Math.round(1000 / r.med)} fps, techo ${TECHO_REPOSO} ms). `
         + '¿Se está repintando el lienzo ENTERO en cada punto en vez de añadir el trozo nuevo?');
  await page.close();
}

await browser.close();
console.log(fallos
  ? `\n❌ el aula lenta tiene ${fallos} problema(s): en la pizarra del colegio se notará`
  : '\n✅ la pizarra lenta aguanta: reposo fluido y la celebración no la hunde');
bye(fallos ? 1 : 0);
