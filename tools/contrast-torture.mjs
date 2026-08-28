// TORTURA DE LEGIBILIDAD — cada TEMA × cada FONDO, midiendo lo que de verdad
// se pinta (§3, plan de temas y fondos 2026-08-12).
//
// Por qué existe, teniendo ya `tests/contrast.test.mjs`: aquel juzga lo que los
// manifests DECLARAN (hex contra hex, sin navegador). Esto mide la COMBINACIÓN,
// que es donde vive el hallazgo del compañero («algunos fondos son muy oscuros
// y no se ven las otras letras»): un tema puede tener todos sus pares perfectos
// y aun así poner texto claro sobre un lienzo claro cuando el fondo manda la
// tinta contraria.
//
// Y por qué no bastaba la matriz: al medir, `matrix-smoke` sube por los padres
// buscando un color de fondo y ABANDONA en cuanto encuentra un
// `background-image`. Las 10 texturas son degradados → los fondos llevaban
// meses contados como «no medibles», es decir, sin vigilancia. Aquí el lienzo se
// resuelve por el `colorBase` que el fondo DECLARA, que existe justo para esto.
//
//   node tools/contrast-torture.mjs             # todas las combinaciones
//   node tools/contrast-torture.mjs --lista     # además, la tabla completa
//
// Umbral 3:1 = AA para texto grande, el MISMO que usa la matriz: una sola vara.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { medirLegibilidad } from './helpers/legibilidad.mjs';
import { abrirServidor } from './helpers/servidorSonda.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 3.0;
const verLista = process.argv.includes('--lista');

// Servidor con puerto EFÍMERO y verificación de árbol (tools/helpers/servidorSonda.mjs).
// Las tres sondas que usaban este bloque compartían el puerto 8479 a mano: dos a
// la vez —o un zombi de una pasada anterior— y la segunda medía lo que servía la
// primera, callando.
const { base: BASE, cerrar } = await abrirServidor();
const bye = (code) => { cerrar(); process.exit(code); };
process.on('SIGINT', () => bye(130));
// Un fallo a mitad dejaba el servidor vivo y la pasada SIGUIENTE medía contra el
// repo viejo sin enterarse — un medidor que miente es peor que no medir (R6).
process.on('uncaughtException', (e) => { console.error('\n❌ TORTURA ABORTADA:', e?.message || e); bye(1); });
process.on('unhandledRejection', (e) => { console.error('\n❌ TORTURA ABORTADA:', e?.message || e); bye(1); });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on('pageerror', e => errores.push(String(e.message).split('\n')[0]));

await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!document.querySelector('#app'), { timeout: 20000 });
// SIN TRANSICIONES: esta tortura mide ESTADOS FINALES, no fotogramas. El
// interruptor del lápiz transiciona color y fondo 220 ms al cambiar de tema, y
// la medición leía el estilo computado A MITAD (índigo→amarillo pasa por un
// oliva que no existe en ningún tema): los fallos aparecían y desaparecían
// según el timing de la pasada — el peor tipo de rojo, y de verde. Apagarlas
// vale para TODO control animado futuro, no solo para este.
await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });

// Una actividad de quiz con su propio defaultContent: el quiz es la plantilla
// con más texto suelto (enunciado + 4 opciones + cabecera), que es lo que se
// juzga aquí.
const { skins, fondos } = await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { getTemplate } = await import('/core/registry.js');
  const { save } = await import('/core/storage.js');
  const { listSkins } = await import('/core/skins.js');
  const { BACKGROUNDS } = await import('/core/backgrounds.js');
  // DOS SUPERFICIES, NO UNA. Se torturaba solo Quiz, que se pinta sobre la
  // TARJETA del marco (`--ww-card-bg`). Tildes/Comas se pintan sobre una HOJA,
  // que es otra superficie con su propio par de tokens (`--ww-paper` /
  // `--ww-paper-ink`) — y por eso este barrido daba verde mientras el reloj de
  // la hoja salía a 1,07:1 en Jungla, invisible (captura del dueño, v1.51.615).
  // Una tortura de legibilidad que solo mira una de las dos superficies deja la
  // otra sin vigilar por completo.
  for (const [id, tpl] of [['tortura', 'quiz'], ['tortura-hoja', 'tildes']]) {
    const T = getTemplate(tpl);
    save({
      id, template: tpl, title: 'Tortura de contraste',
      content: T.meta.defaultContent(), rules: { ...(T.meta.defaultRules?.() || {}), timer: 30 },
      scoring: T.meta.defaultScoring?.() || {},
      presentation: { skin: 'default', background: 'none' },
      updatedAt: new Date().toISOString(),
    });
  }
  return {
    skins: listSkins().map(s => s.name),
    // `custom` fuera: su lienzo es una foto del profe, no se puede medir — por
    // eso justamente pide placa (y la placa SÍ se mide, con los tokens del tema).
    fondos: Object.keys(BACKGROUNDS).filter(n => n !== 'custom'),
  };
});

/** Monta una de las dos superficies y espera a que su juego esté en pantalla. */
async function montar(id, esperar) {
  await page.evaluate((h) => { location.hash = h; }, `#/play/${id}`);
  await page.waitForTimeout(900);
  await page.click('.ww-start-go').catch(() => {});
  await page.waitForSelector(esperar, { timeout: 15000 });
}
const SUPERFICIES = [
  { id: 'tortura',      espera: '.ww-q',      que: 'tarjeta (Quiz)' },
  { id: 'tortura-hoja', espera: '.tc-round',  que: 'hoja (Tildes)' },
];
await montar(SUPERFICIES[0].id, SUPERFICIES[0].espera);

// ¿Cargó Bootstrap? Aquí sale a internet por un proxy que bloquea el CDN, así
// que su relleno no existe y sus pastillas medirían un falso ilegible. Se dice
// ANTES y se descuenta lo suyo, en vez de dar un veredicto sobre una página que
// no es la que ve el profe.
const hayBootstrap = await page.evaluate(() => {
  const s = document.createElement('span');
  s.className = 'badge bg-secondary'; s.style.position = 'absolute'; s.textContent = 'x';
  document.body.appendChild(s);
  const bg = getComputedStyle(s).backgroundColor;
  s.remove();
  return !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
});

const colorBases = await page.evaluate(async () => {
  const { BACKGROUNDS } = await import('/core/backgrounds.js');
  const out = {};
  for (const [name, def] of Object.entries(BACKGROUNDS)) if (def.colorBase) out[`bg-${name}`] = def.colorBase;
  return out;
});

console.log(`\n🎨 TORTURA DE LEGIBILIDAD — ${skins.length} temas × ${fondos.length} fondos`
  + ` × ${SUPERFICIES.length} superficies (umbral ${MIN}:1)\n`);
const fallos = [];
let medidas = 0, minMedidos = Infinity, peorGlobal = { peorRatio: 21 };
for (const sup of SUPERFICIES) {
if (sup !== SUPERFICIES[0]) await montar(sup.id, sup.espera);
if (verLista) console.log(`  — ${sup.que} —`);
for (const skin of skins) {
  const fila = [];
  for (const bg of fondos) {
    await page.evaluate(async ([s, b]) => {
      const { applySkin, getSkin } = await import('/core/skins.js');
      const { applyBackground } = await import('/core/backgrounds.js');
      const frame = document.querySelector('.ww-player-frame');
      applySkin(s, frame);
      applyBackground(b, frame);
      // ESPERAR A LA HOJA DEL TEMA o la primera medición MIENTE: `applySkin`
      // añade el <link> del tema y vuelve, así que sin esto se mide el estado
      // anterior y la fila sale limpia por accidente (pasó con tv-show: su
      // primera columna daba 4,1 y las otras nueve 2,2 — el mismo defecto).
      // Se sondea `link.sheet`, que es la condición REAL. Con el evento `load`
      // el tema arcade nunca lo recibía y agotaba el tope de 3 s con la hoja ya
      // lista: 3,4 s de los 3,9 s del bucle eran esa espera (medido).
      const link = getSkin(s).stylesheet && document.getElementById(`skin-css-${s}`);
      if (link && !link.sheet) {
        for (let i = 0; i < 300 && !link.sheet; i++) await new Promise(r => setTimeout(r, 10));
      }
    }, [skin, bg]);
    const m = await page.evaluate(`(${medirLegibilidad})('.ww-player-frame', null, ${JSON.stringify({ colorBases, hayBootstrap })})`);
    medidas++;
    if (m.n < minMedidos) minMedidos = m.n;
    if (m.peorRatio < peorGlobal.peorRatio) peorGlobal = { ...m, skin, bg, sup: sup.que };
    if (m.peorRatio < MIN) fallos.push({ skin, bg, sup: sup.que, ...m });
    fila.push(`${bg}=${m.peorRatio.toFixed(1)}`);
  }
  if (verLista) console.log(`  ${skin.padEnd(10)} ${fila.join(' · ')}`);
}
}

await browser.close();
console.log(`  ${medidas} combinaciones medidas · el peor caso: ${peorGlobal.peorRatio.toFixed(2)}:1 (${peorGlobal.sup || '?'} · ${peorGlobal.skin} × ${peorGlobal.bg} · «${peorGlobal.peorC}»)`);
if (!hayBootstrap) {
  console.log(`  ⚠️ Bootstrap NO cargó (el CDN está bloqueado en este entorno): ${peorGlobal.sinBootstrap || 0} elemento(s) por caja`);
  console.log('     con relleno suyo (pastillas .bg-*) quedan SIN JUZGAR. Lo que se mide aquí es el CSS del proyecto.');
}
if (errores.length) console.log(`  ⚠️ errores de página: ${[...new Set(errores)].join(' · ')}`);
// SIN MEDICIONES NO HAY VEREDICTO. `peorRatio` nace en 21, así que una pasada
// que no mida nada (la ruta cambió, el juego no montó) saldría verde diciendo
// que todo se lee. Se exige que cada combinación haya medido texto de verdad.
if (medidas === 0 || minMedidos < 3) {
  console.log(`\n❌ la pasada no midió lo suficiente (mínimo ${minMedidos} textos en una combinación): el verde seria falso.`);
  bye(1);
}
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} combinación(es) por debajo de ${MIN}:1 — la clase no lo lee:`);
  for (const f of fallos) console.log(`   · tema ${f.skin} × fondo ${f.bg}: ${f.peorRatio.toFixed(2)}:1 en «${f.peorC}»`);
  bye(1);
}
console.log(`\n✅ ninguna combinación de tema × fondo deja texto por debajo de ${MIN}:1\n`);
bye(0);
