// RED DE SEGURIDAD — UNIDADES `cq` SIN CONTENEDOR (§3, y silenciosa).
//
// POR QUÉ EXISTE, con nombre y medida. `.bg-pick__cambiar` —el lápiz de «Mi
// imagen» del panel de apariencia— llevaba `font-size: max(9px, 11cqw)`. Ese
// panel vive FUERA del marco de juego y ningún ancestro suyo declara
// `container-type`, así que la unidad no cae a cero ni falla: **cae al
// viewport**. Medido a 1280×800, el icono se pintaba a 140,8 px dentro de un
// círculo de 26. Llevaba versiones así.
//
// Y es invisible POR CONSTRUCCIÓN, que es lo que la hace peligrosa: la página
// no se rompe, no hay error en consola, la suite sigue verde. Solo se ve si
// alguien abre esa pantalla concreta y le extraña el tamaño. Lo encontró el
// dueño mirando una captura, que es exactamente el método que este repo intenta
// no necesitar.
//
// NO SE PUEDE COMPROBAR EN ESTÁTICO. «¿Tiene este elemento un ancestro con
// `container-type`?» es un hecho del DOM, no del CSS: depende de en qué página
// se monte la regla y de bajo qué padre. Un heurístico por fichero tampoco
// vale — en este caso el CSS de chrome y el del juego estaban en el MISMO
// archivo (`player.css`). Hace falta el navegador, y el navegador ya está
// abierto en el preflight.
//
// CÓMO BARRE (y por eso DESCUBRE, no comprueba un caso):
//   1. recorre `document.styleSheets` —incluidas las reglas dentro de @media y
//      @container— y se queda con toda declaración que use `cq*`;
//   2. para cada una, `querySelectorAll(selector)` en la página montada;
//   3. por cada elemento encontrado, sube por `parentElement` preguntando
//      `getComputedStyle(el).containerType`. Si nadie es contenedor → SE CANTA.
// Sube desde el PADRE a propósito: una unidad `cq` se resuelve contra el
// contenedor ANCESTRO más cercano, nunca contra el propio elemento (declararse
// contenedor a uno mismo no da a `100cqi` el ancho propio).
//
// LO QUE NO CUBRE, dicho: solo barre las pantallas del PROFE. El alumno en vivo
// y la tarea montan el mismo marco (`core/gameFrame.js`, misma regla de esquina),
// pero llegar hasta ellas pide sala y PIN — eso ya lo caminan `live-smoke` y
// `task-smoke`. Si un día una regla `cq` vive SOLO en esas pantallas, este
// barrido no la verá.
//
//   node tools/cq-sonda.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { abrirServidor } from './helpers/servidorSonda.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── DEUDA CONGELADA, con motivo ──────────────────────────────────────────────
// Trinquete, como `TECHOS` en tests/styles.test.mjs: lo de aquí ya estaba y solo
// puede ENCOGER. Una entrada nueva no se añade: se arregla. La clave es
// `selector | propiedad` — sin el valor, para que retocar el número no la
// resucite con otro nombre.
const CONGELADO = new Set([
]);

const { base: BASE, cerrar } = await abrirServidor();
const bye = (code) => { cerrar(); process.exit(code); };
process.on('SIGINT', () => bye(130));

const browser = await chromium.launch();
let fallos = 0;
const ok = (m) => console.log('  ✅', m);
const mal = (m) => { fallos++; console.log('  ❌', m); };

/** EL BARRIDO, dentro de la página. Devuelve las declaraciones `cq` cuyo
 *  elemento no tiene NINGÚN ancestro contenedor, más el recuento de lo que
 *  miró (sin el recuento no se distingue «todo limpio» de «no miré nada»). */
const BARRIDO = () => {
  const CQ = /\b[\d.]+cq(w|h|i|b|min|max)\b/;
  const decls = [];
  // OJO AL ORDEN: primero se MIDE la regla y después se baja a las hijas. Con el
  // `return` temprano de «si tiene cssRules, recursa», el barrido no medía NADA y
  // decía «0 declaraciones» tan tranquilo: en CSS anidado un CSSStyleRule TAMBIÉN
  // expone `cssRules`, así que toda regla normal se saltaba por la puerta de las
  // agrupadoras. Lo cazó la contra-prueba de abajo, que es para lo que está.
  const meter = (regla) => {
    if (regla.style && regla.selectorText) {
      for (const prop of regla.style) {
        const v = regla.style.getPropertyValue(prop);
        if (CQ.test(v)) decls.push({ selector: regla.selectorText, prop, valor: v.trim() });
      }
    }
    if (regla.cssRules) for (const r of regla.cssRules) meter(r);
  };
  for (const hoja of document.styleSheets) {
    // Una hoja de otro origen lanza al leer `cssRules`. Aquí todo es local, pero
    // callar el error dejaría el barrido midiendo menos hojas sin decirlo.
    try { for (const r of hoja.cssRules) meter(r); }
    catch { decls.push({ selector: '(hoja ilegible)', prop: '', valor: hoja.href || '?', ilegible: true }); }
  }
  const tieneContenedor = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ct = getComputedStyle(p).containerType;
      if (ct && ct !== 'normal') return true;
    }
    return false;
  };
  const sueltas = [], vistos = new Set();
  let elementos = 0, ilegibles = 0;
  for (const d of decls) {
    if (d.ilegible) { ilegibles++; continue; }
    // `::before` / `:hover` no se pueden consultar: se prueba el elemento base,
    // que es quien tiene (o no) el ancestro contenedor.
    const sel = d.selector.replace(/::?[a-z-]+(\([^)]*\))?/gi, m => /^::/.test(m) ? '' : m).trim();
    if (!sel) continue;
    let els = [];
    try { els = [...document.querySelectorAll(sel)]; } catch { continue; }
    if (!els.length) continue;                 // esa regla no se monta en esta página
    elementos += els.length;
    for (const el of els) {
      if (tieneContenedor(el)) continue;
      const clave = `${d.selector} | ${d.prop}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const cs = getComputedStyle(el);
      sueltas.push({ clave, selector: d.selector, prop: d.prop, valor: d.valor,
                     tag: el.tagName.toLowerCase(), calculado: cs.getPropertyValue(d.prop) });
    }
  }
  return { sueltas, decls: decls.length - ilegibles, elementos, ilegibles };
};

/** Siembra una actividad de cada tipo que necesitamos y devuelve sus ids. */
const SEMBRAR = async () => {
  await import('/core/registerTemplates.js');
  const { getTemplate } = await import('/core/registry.js');
  const s = await import('/core/storage.js');
  for (const [id, tpl] of [['cq_ws', 'wordsearch'], ['cq_quiz', 'quiz']]) {
    const T = getTemplate(tpl);
    s.save({ id, template: tpl, title: `Sonda ${tpl}`, content: T.meta.defaultContent(),
      rules: {}, scoring: {}, presentation: { skin: 'default', background: 'none' },
      updatedAt: '2026-01-01T00:00:00.000Z' });
  }
};

// LAS PANTALLAS QUE SE BARREN. No hace falta la app entera: hace falta cada
// SITIO donde conviven chrome y juego, que es donde la confusión ocurre. El
// panel de apariencia se ABRE a mano — estaba plegado en un `<details>`, y una
// regla que no se monta no se puede medir (el barrido la salta en silencio, que
// es correcto pero no gratis: por eso las pantallas se declaran aquí).
const PANTALLAS = [
  { id: 'portada', pagina: 'teacher.html', hash: '#/mine', espera: '.acard, .ww-empty, .home-empty' },
  { id: 'jugar',   pagina: 'teacher.html', hash: '#/play/cq_quiz', espera: '.pp-acc summary',
    antes: (p) => p.evaluate(() => document.querySelectorAll('.pp-acc').forEach(d => { d.open = true; })) },
  { id: 'editor',  pagina: 'teacher.html', hash: '#/edit/cq_ws', espera: '#editor-root' },
];

for (const pant of PANTALLAS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // El editor exige sesión (§22): sin esto la ruta gatea y la pantalla no se
  // barre — y un barrido que no llega a la pantalla decía «✅» igual.
  await page.addInitScript(() => {
    localStorage.setItem('ww.pb.auth', JSON.stringify({ token: 'TOK', record: { id: 'u1' } }));
  });
  await page.goto(`${BASE}/${pant.pagina}?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  await page.evaluate(SEMBRAR);
  await page.evaluate(h => { location.hash = h; }, pant.hash);
  try { await page.waitForSelector(pant.espera, { timeout: 9000 }); }
  catch { mal(`«${pant.id}»: no llegó a montar (${pant.espera}) — el barrido de esta pantalla NO se hizo`); await page.close(); continue; }
  if (pant.antes) await pant.antes(page);
  await page.waitForTimeout(400);

  const r = await page.evaluate(BARRIDO);
  if (r.ilegibles) mal(`«${pant.id}»: ${r.ilegibles} hoja(s) ilegibles — el barrido no las miró`);
  const nuevas = r.sueltas.filter(s => !CONGELADO.has(s.clave));
  if (nuevas.length) {
    for (const s of nuevas) {
      mal(`«${pant.id}» ${s.selector} { ${s.prop}: ${s.valor} } → sin ancestro contenedor `
        + `(<${s.tag}>, calculado ${s.calculado || '?'})`);
    }
  } else if (r.elementos) {
    ok(`«${pant.id}»: ${r.elementos} elementos con unidades cq, todos bajo un contenedor`);
  } else {
    // «Limpio» y «no he medido nada» NO son lo mismo, y decirlos con la misma
    // frase es cómo un barrido roto pasa por bueno: este mismo barrido dijo
    // «0 declaraciones, todas bajo un contenedor» cuando no estaba mirando NADA.
    ok(`«${pant.id}»: sin unidades cq montadas (nada que medir aquí; ${r.decls} declaraciones en las hojas)`);
  }
  await page.close();
}

// ── CONTRA-PRUEBA: el barrido tiene que SABER DISTINGUIR ─────────────────────
// Sin esto, un barrido que devolviera «nada» por cualquier motivo —selector mal
// recortado, `containerType` no soportado, cero hojas leídas— daría el mismo
// verde tranquilizador. Se le enseñan los dos casos a la vez, en la misma
// página: una regla `cq` bajo un contenedor de verdad (no debe cantarla) y otra
// exactamente igual colgando del `<body>` (debe cantarla).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  const r = await page.evaluate((barrido) => {
    const est = document.createElement('style');
    est.textContent = `.cq-cont { container-type: inline-size; }
      .cq-dentro { font-size: 5cqw; } .cq-fuera { font-size: 5cqw; }`;
    document.head.appendChild(est);
    const caja = document.createElement('div');
    caja.className = 'cq-cont';
    caja.innerHTML = '<span class="cq-dentro">a</span>';
    document.body.appendChild(caja);
    const suelto = document.createElement('span');
    suelto.className = 'cq-fuera';
    suelto.textContent = 'b';
    document.body.appendChild(suelto);
    const res = (new Function(`return (${barrido})`))()();
    const claves = res.sueltas.map(s => s.clave);
    return { canta: claves.includes('.cq-fuera | font-size'),
             calla: !claves.includes('.cq-dentro | font-size') };
  }, BARRIDO.toString());
  if (r.canta) ok('CONTRA-PRUEBA: una regla cq colgando del body SÍ se canta (el barrido mira de verdad)');
  else mal('CONTRA-PRUEBA: el barrido NO cantó una regla cq sin contenedor — no está midiendo nada');
  if (r.calla) ok('CONTRA-PRUEBA: y una regla cq bajo un contenedor NO se canta (no canta por cantar)');
  else mal('CONTRA-PRUEBA: el barrido cantó una regla que SÍ tiene contenedor — sería ruido y se ignoraría');
  await page.close();
}

// El trinquete solo puede encoger: una entrada congelada que ya nadie produce
// es una excepción viva para un defecto muerto, y mañana tapa uno nuevo.
if (CONGELADO.size) {
  console.log(`\n  (deuda congelada: ${CONGELADO.size} — solo puede bajar)`);
}

await browser.close();
console.log(fallos
  ? `\n❌ ${fallos} problema(s): hay unidades cq resolviéndose contra el VIEWPORT`
  : '\n✅ ninguna unidad cq se resuelve contra el viewport (§3)');
bye(fallos ? 1 : 0);
