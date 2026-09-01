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
// UNA SONDA QUE MIENTE ES PEOR QUE NINGUNA — de eso se encarga
// `tools/helpers/servidorSonda.mjs`: puerto efímero (sin zombis) y comprobación
// de que lo servido es ESTE árbol. Nació aquí y se mudó allí en cuanto se vio
// que doce herramientas tenían el mismo problema y tres compartían puerto.
//
// DOS TRAMPAS DE MEDICIÓN que también aprendió, y por eso están escritas aquí:
// el ratón se queda donde cayó el último clic y deja un botón en `:hover` (su
// sombra sale distinta), y un `border-color` con grosor 0 no pinta nada, así
// que compararlo es ruido. Las dos están resueltas abajo.
import { createRequire } from 'node:module';
import { abrirServidor } from './helpers/servidorSonda.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const SALIDA = (n) => `.opcion-sonda.${n}.json`;

// --diff: compara las dos tomas y dice si el refactor movió algo.
if (process.argv.includes('--diff')) {
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

// A partir de aquí SÍ hace falta el navegador: `--diff` es comparar dos JSON y
// salía de este módulo antes de llegar, así que cargarlo arriba solo servía para
// que una máquina sin Playwright no pudiera ni comparar dos ficheros locales.
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const OUT = process.argv[2] || 'antes';
// Los temas, UNA vez: sembrar y medir tienen que recorrer la misma lista o la
// segunda pasada abre una actividad que la primera no guardó.
const TEMAS = ['default', 'tv-show', 'arcade'];
const { base: BASE, cerrar } = await abrirServidor();
let b;
try {
b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
await page.evaluate(async (temas) => {
  await import('/core/registerTemplates.js');
  const { getTemplate } = await import('/core/registry.js');
  const s = await import('/core/storage.js');
  const T = getTemplate('quiz');
  for (const skin of temas) {
    s.save({ id: `op_${skin}`, template: 'quiz', title: 'Sonda', content: T.meta.defaultContent(),
      rules: T.meta.defaultRules(), scoring: T.meta.defaultScoring(),
      presentation: { skin, background: 'none' }, updatedAt: 'x' });
  }
}, TEMAS);
const PROPS = ['fontSize','fontWeight','paddingTop','paddingLeft','borderTopWidth','borderTopStyle',
  'borderTopColor','borderRadius','backgroundColor','backgroundImage','color','boxShadow',
  'transitionProperty','transitionDuration','textAlign'];
const res = {};
for (const skin of TEMAS) {
  for (const [modo, ruta, boton, ready] of [
      ['solo', `#/play/op_${skin}`, '.ww-start-go', '.ww-opt'],
      ['vs', `#/vs/op_${skin}`, '[data-ww-start]', '.rq-opt']]) {
    await page.evaluate(() => { location.hash = '#/mine'; });
    await page.evaluate(h => { location.hash = h; }, ruta);
    await page.waitForSelector(boton, { timeout: 9000 });
    // SE PULSA SIN MOVER EL RATÓN. Con `page.click()` el puntero se queda donde
    // cayó y deja un botón en `:hover`: su sombra sale distinta y la comparación
    // canta un cambio que no existe. Antes se compensaba llevando el ratón a
    // (0,0) y esperando 400 ms a que la transición se deshiciera —seis veces por
    // pasada—; disparar el clic desde el DOM quita la causa en vez del síntoma.
    await page.$eval(boton, el => el.click());
    await page.waitForSelector(ready, { timeout: 9000 });
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
  // Se cierra SIEMPRE, también si la medición revienta.
  await b?.close();
  cerrar();
}
