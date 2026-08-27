// RED DE SEGURIDAD — LÁPIZ Y BORRADOR SOBRE EL LIENZO DE VERDAD (§27, costura).
//
// POR QUÉ NO BASTA CON `tests/penVeredicto.test.mjs`. Esa suite prueba el
// PRIMITIVO con reloj falso, y está bien. Pero el defecto que cerró v1.51.609 no
// vivía en ningún primitivo: `classifyTool` era correcta aislada —tiene su suite
// desde hace versiones y pasaba— y el lienzo la llamaba en el peor momento
// posible, el `pointerdown`, que es justo la muestra que la calibración descarta
// por basura. Pieza correcta, costura rota. Eso solo se ve reproduciendo la
// SECUENCIA de eventos contra el lienzo montado.
//
// DOS HERRAMIENTAS desde v1.51.610: lo pequeño escribe, la palma borra. Reproduce
// tres gestos con `PointerEvent` reales, con el primer evento reportando el
// tamaño por defecto (1 → métrica 0,5), que es lo que hacen muchas pizarras:
//
//   · palma (un contacto grande) → tiene que BORRAR (antes de v1.51.609 dibujaba)
//   · dedo                       → tiene que ESCRIBIR (contra-prueba)
//   · toque corto                → tiene que ESCRIBIR (marcar una tilde ES un
//                                   toque, y borrar sin muestras limpias
//                                   destruiría trabajo)
//
// Las dos contra-pruebas no son adorno: sin ellas, un detector que borrara SIEMPRE
// pasaría el primer caso y dejaría al alumno sin poder marcar nada.
//
// Y comprueba el PANEL DE CALIBRACIÓN por lo que MIDE, no por cómo está escrito:
// que descarte el toque basura y resuma con la MEDIANA, igual que el veredicto.
// Esa pareja —misma ventana, mismo estadístico— es lo que hace que calibrar
// sirva de algo: si el panel resume el toque de una forma y el dibujo de otra,
// los umbrales medidos no describen lo que el dibujo va a medir. Estuvo escrito
// por separado (80 ms y una mediana privada aquí, 60 ms y otra allí).
//
//   node tools/lapiz-sonda.mjs
import { createRequire } from 'node:module';
import { abrirServidor } from './helpers/servidorSonda.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const { base: BASE, cerrar } = await abrirServidor();
const bye = (code) => { cerrar(); process.exit(code); };
process.on('SIGINT', () => bye(130));

const browser = await chromium.launch();
let fallos = 0;
const ok = (m) => console.log('  ✅', m);
const mal = (m) => { fallos++; console.log('  ❌', m); };

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e.message)));
await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });

const r = await page.evaluate(async () => {
  const { mountTcDraw } = await import('/core/textCorrectionDraw.js');
  const { deriveThresholds, saveThresholds } = await import('/core/penDetector.js');
  // Umbrales como los dejaría una pizarra calibrada de verdad. Se DERIVAN con la
  // misma función que usa el panel: unos inventados aquí probarían un aparato
  // que no existe.
  saveThresholds(deriveThresholds({ dedo: 6, palma: 20 }));   // frontera en 13

  const host = document.createElement('div');
  host.style.cssText = 'width:600px;height:200px;position:relative';
  host.innerHTML = '<span class="tc-target" data-pos="0" '
    + 'style="position:absolute;left:100px;top:80px;width:40px;height:40px;display:inline-block"></span>';
  document.body.appendChild(host);
  const api = mountTcDraw(host, { targets: host.querySelectorAll('.tc-target'), onChange() {} });
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

  const cv = host.querySelector('canvas');
  const caja = () => host.getBoundingClientRect();
  const ev = (tipo, x, y, tam, id) => cv.dispatchEvent(new PointerEvent(tipo, {
    pointerId: id, isPrimary: true, bubbles: true, pointerType: 'pen',
    clientX: caja().left + x, clientY: caja().top + y, width: tam * 2, height: tam * 2,
  }));
  const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

  /** Un gesto completo. El primer evento va con `basura` a propósito. */
  const gesto = async (tamReal, { pasos = 8, pasoMs = 20, id = 1 }) => {
    api.clear();
    ev('pointerdown', 120, 100, 0.5, id);
    for (let i = 0; i < pasos; i++) { await esperar(pasoMs); ev('pointermove', 120 + i * 3, 100, tamReal, id); }
    ev('pointerup', 120 + pasos * 3, 100, tamReal, id);
    return api.getMarked().length;
  };

  const palma = await gesto(20, { id: 1 });
  const dedo  = await gesto(6, { id: 2 });
  // Toque corto: baja y sube sin dar tiempo a una sola muestra limpia.
  api.clear();
  ev('pointerdown', 120, 100, 0.5, 3);
  ev('pointerup', 120, 100, 0.5, 3);
  const toque = api.getMarked().length;

  return { palma, dedo, toque };
});

if (r.palma === 0) ok('la PALMA borra aunque el primer evento reporte basura (antes escribía)');
else mal(`la palma dejó ${r.palma} marca(s): está escribiendo en vez de borrar`);

if (r.dedo === 1) ok('CONTRA-PRUEBA: el dedo sigue marcando');
else mal(`CONTRA-PRUEBA rota: el dedo dejó ${r.dedo} marcas (debería dejar 1)`);

if (r.toque === 1) ok('CONTRA-PRUEBA: un toque corto (marcar una tilde) marca, no borra a ciegas');
else mal(`CONTRA-PRUEBA rota: el toque corto dejó ${r.toque} marcas (debería dejar 1)`);

// ── EL PANEL DE CALIBRACIÓN, MEDIDO ─────────────────────────────────────────
// Se le da un toque con basura al principio (0,5) y luego muestras limpias con
// un PICO espurio en medio. Tiene que salir la MEDIANA de las limpias: ni la
// basura inicial la arrastra, ni el pico la desplaza (eso haría la media).
const cal = await page.evaluate(async () => {
  const { openPenCalibration } = await import('/core/penCalibration.js');
  const { VENTANA, mediana } = await import('/core/penDetector.js');
  const panel = openPenCalibration();
  // DOS recuadros desde v1.51.610, ni uno más: si vuelven a ser cuatro, es que
  // alguien ha reintroducido fronteras que no hacen falta.
  const recuadros = document.querySelectorAll('.pcal-field').length;
  const pad = document.querySelector('.pcal-field[data-tool="dedo"] [data-pad]');
  const val = document.querySelector('.pcal-field[data-tool="dedo"] [data-val]');
  const ev = (tipo, tam) => pad.dispatchEvent(new PointerEvent(tipo, {
    pointerId: 9, isPrimary: true, bubbles: true, pointerType: 'pen',
    clientX: 10, clientY: 10, width: tam * 2, height: tam * 2,
  }));
  const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

  const limpias = [13, 14, 30, 14, 14];      // el 30 es un pico espurio
  ev('pointerdown', 0.5);                    // BASURA: el primer evento
  await esperar(VENTANA.ignoraMs + 25);      // se cruza la ventana de descarte
  for (const tam of limpias) { ev('pointermove', tam); await esperar(12); }
  ev('pointerup', 14);
  const medido = parseFloat(val.textContent);
  panel.close();
  return { medido, recuadros, esperado: mediana(limpias),
           media: limpias.reduce((a, b) => a + b, 0) / limpias.length };
});

if (Math.abs(cal.medido - cal.esperado) < 0.05) {
  ok(`el panel de calibración mide la MEDIANA de las muestras limpias (${cal.medido}), `
     + 'sin la basura inicial: misma ventana y mismo estadístico que el veredicto');
} else {
  mal(`el panel midió ${cal.medido} y la mediana de las muestras limpias es ${cal.esperado}: `
      + 'calibrar y dibujar están resumiendo el toque de formas distintas');
}
if (Math.abs(cal.medido - cal.media) > 0.05) ok(`CONTRA-PRUEBA: no es la media (${cal.media.toFixed(1)}) — un pico espurio la desplazaría`);
else mal(`el panel parece usar la MEDIA (${cal.media.toFixed(1)}): un solo pico espurio descalibra la pizarra`);

if (cal.recuadros === 2) ok('el panel de calibración pide DOS medidas (dedo y palma), no cuatro');
else mal(`el panel pide ${cal.recuadros} medidas: cada frontera de más es otra forma de equivocarse`);

if (errores.length) mal(`errores JS en la página: ${errores.join(' | ')}`);
else ok('sin errores JS');

await page.close();
await browser.close();
console.log(fallos
  ? `\n❌ el lápiz/borrador tiene ${fallos} fallo(s) sobre el lienzo real`
  : '\n✅ lápiz, borrador y toque corto hacen lo que deben sobre el lienzo real');
bye(fallos ? 1 : 0);
