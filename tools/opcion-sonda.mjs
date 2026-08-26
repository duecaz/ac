#!/usr/bin/env node
// LA SONDA DE LA OPCIÓN — ¿este refactor de CSS cambia algo de verdad?
//
//   node tools/opcion-sonda.mjs antes    (con el código ORIGINAL)
//   …hacer el cambio…
//   node tools/opcion-sonda.mjs despues
//   node tools/opcion-sonda.mjs --diff
//
// Mide los ESTILOS COMPUTADOS de la opción de respuesta —la pastilla que el
// alumno pulsa— en Individual y en VS, con los tres temas: 6 contextos × 4
// botones × 15 propiedades. Es el instrumento que hacía falta para consolidar
// la pieza (v1.51.599) sin fiarse del ojo, porque `tools/shots.mjs` compara
// PÍXELES y hay cambios de cascada que no se ven y sí importan.
//
// Lo que cazó, y ninguno se veía mirando la pantalla:
//   · `.ww-opt-grid .btn` EMPATA en especificidad con `.ww-player .ww-opt` y le
//     ganaba por orden de carga: al tokenizar, el borde del Individual pasó de
//     2px a 1px y la transición cambió entera (24 propiedades).
//   · `styles/vs.css` declaraba `font-weight: 600` literal, que pisaba el token
//     y dejaba a tv-show sin su 800 SOLO en el duelo.
//   · un `font-weight: 500` en la base que nunca había ganado y que, al hacer
//     explícita la especificidad, habría adelgazado el Individual de golpe.
//
// UNA SONDA QUE MIENTE ES PEOR QUE NINGUNA. Este script lanza su propio
// servidor estático, y con un puerto FIJO un servidor zombi de una pasada
// anterior seguiría atendiendo: mediría el checkout VIEJO y luego imprimiría un
// «✅ IDÉNTICO» de lo más convencido — precisamente la evidencia que se cita en
// `tests/temaPorTokens.test.mjs` y en el mensaje del commit. Por eso el puerto
// se pide LIBRE al sistema, el servidor se mata en un `finally`, y antes de
// medir se comprueba que lo servido es ESTE árbol (se compara la VERSION que
// devuelve el HTTP con la del disco). Verificado inyectando una versión falsa:
// la comprobación para la medición en vez de dar un verde tranquilizador.
//
// DOS TRAMPAS DE MEDICIÓN que también aprendió, y por eso están escritas aquí:
// el ratón se queda donde cayó el último clic y deja un botón en `:hover` (su
// sombra sale distinta), y un `border-color` con grosor 0 no pinta nada, así
// que compararlo es ruido. Las dos están resueltas abajo.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const OUT = process.argv[2] || 'antes';
const SALIDA = (n) => `.opcion-sonda.${n}.json`;

// --diff: compara las dos tomas y dice si el refactor movió algo.
if (process.argv.includes('--diff')) {
  const { readFileSync } = await import('node:fs');
  const a = JSON.parse(readFileSync(SALIDA('antes'), 'utf8'));
  const b = JSON.parse(readFileSync(SALIDA('despues'), 'utf8'));
  // Un color de borde con GROSOR 0 no pinta: compararlo es ruido, no señal.
  const invisible = (o, p) => p === 'borderTopColor' && o.borderTopWidth === '0px';
  let dif = 0, tot = 0, omitidas = 0;
  for (const k of Object.keys(a)) a[k].forEach((btn, i) => {
    const otro = b[k]?.[i] || {};
    for (const p of Object.keys(btn)) {
      if (invisible(btn, p) && invisible(otro, p)) { omitidas++; continue; }
      tot++;
      if (btn[p] !== otro[p]) {
        dif++;
        console.log(`  ✗ ${k} btn${i + 1} ${p}\n      antes: ${btn[p]}\n      ahora: ${otro[p]}`);
      }
    }
  });
  console.log(dif
    ? `\n${dif} de ${tot} propiedades CAMBIAN — míralas antes de dar por bueno el refactor.`
    : `\n✅ IDÉNTICO: ${tot} propiedades computadas, 0 cambios (${omitidas} colores de borde con grosor 0 omitidos).`);
  process.exit(dif ? 1 : 0);
}
// Un puerto que el sistema acaba de dar por libre no puede tener un zombi.
const puertoLibre = await new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const BASE = `http://127.0.0.1:${puertoLibre}`;
const srv = spawn('python3', ['-m', 'http.server', String(puertoLibre)], { cwd: process.cwd(), stdio: 'ignore' });
let b;
try {
await new Promise(r => setTimeout(r, 1200));

// ¿Lo que sirve ese puerto es ESTE árbol? Si no, todo lo demás es ficción.
const enDisco = (await readFile('core/constants.js', 'utf8')).match(/VERSION = '([^']+)'/)?.[1];
const porHttp = (await (await fetch(`${BASE}/core/constants.js`)).text()).match(/VERSION = '([^']+)'/)?.[1];
if (!enDisco || enDisco !== porHttp) {
  throw new Error(`el servidor sirve v${porHttp} y en disco hay v${enDisco} — no se mide sobre otro árbol`);
}

b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { getTemplate } = await import('/core/registry.js');
  const s = await import('/core/storage.js');
  const T = getTemplate('quiz');
  for (const skin of ['default', 'tv-show', 'arcade']) {
    s.save({ id: `op_${skin}`, template: 'quiz', title: 'Sonda', content: T.meta.defaultContent(),
      rules: T.meta.defaultRules(), scoring: T.meta.defaultScoring(),
      presentation: { skin, background: 'none' }, updatedAt: 'x' });
  }
});
const PROPS = ['fontSize','fontWeight','paddingTop','paddingLeft','borderTopWidth','borderTopStyle',
  'borderTopColor','borderRadius','backgroundColor','backgroundImage','color','boxShadow',
  'transitionProperty','transitionDuration','textAlign'];
const res = {};
for (const skin of ['default', 'tv-show', 'arcade']) {
  for (const [modo, ruta, boton, ready] of [
      ['solo', `#/play/op_${skin}`, '.ww-start-go', '.ww-opt'],
      ['vs', `#/vs/op_${skin}`, '.ww-mode-start', '.rq-opt']]) {
    await page.evaluate(() => { location.hash = '#/mine'; });
    await page.waitForTimeout(150);
    await page.evaluate(h => { location.hash = h; }, ruta);
    await page.waitForSelector(boton, { timeout: 9000 });
    await page.click(boton);
    await page.waitForSelector(ready, { timeout: 9000 });
    // El ratón FUERA antes de medir: se quedaba donde cayó el último clic y
    // dejaba un botón en :hover, así que su sombra era la de hover y la
    // comparación cantaba un cambio que no existía.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    res[`${skin}/${modo}`] = await page.evaluate(({ sel, props }) => {
      return [...document.querySelectorAll(sel)].slice(0, 4).map(el => {
        const c = getComputedStyle(el);
        return Object.fromEntries(props.map(p => [p, c[p]]));
      });
    }, { sel: ready, props: PROPS });
  }
}
writeFileSync(SALIDA(OUT), JSON.stringify(res, null, 1));
console.log(`escrito ${SALIDA(OUT)} (${Object.keys(res).length} contextos × 4 botones × ${PROPS.length} props)`);
} finally {
  // El servidor se mata SIEMPRE, también si la medición revienta: si no, el
  // zombi se queda escuchando y la próxima pasada mide el árbol de ésta.
  await b?.close();
  srv.kill();
}
