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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8479);
const BASE = `http://127.0.0.1:${PORT}`;
const MIN = 3.0;
const verLista = process.argv.includes('--lista');

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on('pageerror', e => errores.push(String(e.message).split('\n')[0]));

await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!document.querySelector('#app'), { timeout: 20000 });

// Una actividad de quiz con su propio defaultContent: el quiz es la plantilla
// con más texto suelto (enunciado + 4 opciones + cabecera), que es lo que se
// juzga aquí.
const { skins, fondos } = await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { getTemplate } = await import('/core/registry.js');
  const { save } = await import('/core/storage.js');
  const { listSkins } = await import('/core/skins.js');
  const { BACKGROUNDS } = await import('/core/backgrounds.js');
  const T = getTemplate('quiz');
  save({
    id: 'tortura', template: 'quiz', title: 'Tortura de contraste',
    content: T.meta.defaultContent(), rules: T.meta.defaultRules?.() || {},
    scoring: T.meta.defaultScoring?.() || {},
    presentation: { skin: 'default', background: 'none' },
    updatedAt: new Date().toISOString(),
  });
  return {
    skins: listSkins().map(s => s.name),
    // `custom` fuera: su lienzo es una foto del profe, no se puede medir — por
    // eso justamente pide placa (y la placa SÍ se mide, con los tokens del tema).
    fondos: Object.keys(BACKGROUNDS).filter(n => n !== 'custom'),
  };
});

await page.evaluate(() => { location.hash = '#/play/tortura'; });
await page.waitForTimeout(900);
await page.click('.ww-start-go').catch(() => {});
await page.waitForSelector('.ww-q', { timeout: 15000 });

// El medidor. Igual que el de la matriz salvo en UN punto: cuando la pila de
// padres llega a un elemento con clase `bg-<nombre>` declarada, el lienzo es su
// `colorBase` en vez de «no medible».
const MEDIR = (colorBases, hayBootstrap) => {
  // Clases cuyo RELLENO lo pinta Bootstrap. Si su hoja no cargó (este entorno
  // sale a internet por un proxy que bloquea el CDN), esos elementos aparecen
  // con fondo transparente y medirlos daría un falso «1,0:1» — la pastilla gris
  // del contador saldría ilegible sobre papel cuando en un navegador real
  // contrasta 4,5:1. No se silencia: se cuentan y se dicen al final.
  const DE_BOOTSTRAP = ['bg-secondary', 'bg-primary', 'bg-info', 'bg-success', 'bg-danger', 'bg-warning', 'bg-dark', 'bg-light'];
  const rgba = (c) => {
    const m = String(c).match(/[\d.]+/g) || [];
    if (m.length < 3) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length >= 4 ? +m[3] : 1 };
  };
  const hexRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 1 });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const lienzoDe = (el) => {
    const capas = [];
    let base = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a === 1) { base = c; break; } }
      // El lienzo DECLARADO manda sobre el degradado que no se puede componer.
      for (const cls of n.classList) {
        const hex = colorBases[cls];
        if (hex) { base = hexRgb(hex); break; }
      }
      if (base) break;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   // textura ajena: no se juzga
    }
    if (!base) base = { r: 255, g: 255, b: 255 };
    for (let i = capas.length - 1; i >= 0; i--) {
      const c = capas[i];
      base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) };
    }
    return base;
  };
  const frame = document.querySelector('.ww-player-frame') || document.body;
  let peor = 21, texto = '', sinMedir = 0, sinBootstrap = 0, n = 0;
  for (const el of frame.querySelectorAll('*')) {
    const propio = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 1);
    if (!propio) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (!hayBootstrap && DE_BOOTSTRAP.some(c => el.classList.contains(c))) { sinBootstrap++; continue; }
    const fondo = lienzoDe(el);
    const tinta = rgba(cs.color);
    if (!fondo || !tinta) { sinMedir++; continue; }
    const l1 = lum(tinta), l2 = lum(fondo);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    n++;
    if (ratio < peor) { peor = ratio; texto = el.textContent.trim().slice(0, 28); }
  }
  return { peor, texto, sinMedir, sinBootstrap, n };
};

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

console.log(`\n🎨 TORTURA DE LEGIBILIDAD — ${skins.length} temas × ${fondos.length} fondos (umbral ${MIN}:1)\n`);
const fallos = [];
let medidas = 0, peorGlobal = { peor: 21 };
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
      const link = getSkin(s).stylesheet && document.getElementById(`skin-css-${s}`);
      if (link && !link.sheet) await new Promise(r => { link.addEventListener('load', r, { once: true }); setTimeout(r, 3000); });
    }, [skin, bg]);
    const m = await page.evaluate(`(${MEDIR})(${JSON.stringify(colorBases)}, ${hayBootstrap})`);
    medidas++;
    if (m.peor < peorGlobal.peor) peorGlobal = { ...m, skin, bg };
    if (m.peor < MIN) fallos.push({ skin, bg, ...m });
    fila.push(`${bg}=${m.peor.toFixed(1)}`);
  }
  if (verLista) console.log(`  ${skin.padEnd(10)} ${fila.join(' · ')}`);
}

await browser.close();
console.log(`  ${medidas} combinaciones medidas · el peor caso: ${peorGlobal.peor.toFixed(2)}:1 (${peorGlobal.skin} × ${peorGlobal.bg} · «${peorGlobal.texto}»)`);
if (!hayBootstrap) {
  console.log(`  ⚠️ Bootstrap NO cargó (el CDN está bloqueado en este entorno): ${peorGlobal.sinBootstrap || 0} elemento(s) por caja`);
  console.log('     con relleno suyo (pastillas .bg-*) quedan SIN JUZGAR. Lo que se mide aquí es el CSS del proyecto.');
}
if (errores.length) console.log(`  ⚠️ errores de página: ${[...new Set(errores)].join(' · ')}`);
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} combinación(es) por debajo de ${MIN}:1 — la clase no lo lee:`);
  for (const f of fallos) console.log(`   · tema ${f.skin} × fondo ${f.bg}: ${f.peor.toFixed(2)}:1 en «${f.texto}»`);
  bye(1);
}
console.log(`\n✅ ninguna combinación de tema × fondo deja texto por debajo de ${MIN}:1\n`);
bye(0);
