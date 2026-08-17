// A DÓNDE TE LLEVA TERMINAR — la política es un cuadro, y el cuadro es test.
//
// El fallo que lo motivó (dueño, 2026-08-17): «al terminar una actividad me
// lleva a las actividades de usuario aunque no estoy logueado». La pantalla de
// fin llevaba `#/home` escrito a mano → `#/mine`, que a quien juega sin cuenta
// no le pertenece; y en la app del ALUMNO esa ruta ni siquiera existe, así que
// `views/studentTask.js` ya se había escrito su propia pantalla para no caer en
// «ruta no encontrada». Un destino cableado, dos parches.
//
// Lo que se vigila aquí:
//   1. PARIDAD con `core/persistPolicy.js`: todo modo que persiste algo declara
//      también a dónde va al terminar (los dos cuadros hablan de lo mismo).
//   2. SIN SESIÓN, NADIE ACABA EN UNA PANTALLA QUE NO ES SUYA (`#/mine`) — que
//      es literalmente el fallo reportado.
//   3. DONDE HAY TOPE DE INTENTOS NO SE OFRECE REPETIR: un botón «jugar otra
//      vez» en una Tarea sería una trampa con forma de botón (§22-3).
//   4. ESCANEO: ninguna vista ni plantilla vuelve a escribir el destino a mano.
//
// Run: node tests/afterPlay.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { TRAS_JUGAR, DESTINO_DESCONOCIDO, destinoTrasJugar, puedeRepetir } from '../core/afterPlay.js';
import { PERSIST } from '../core/persistPolicy.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// 1 · Paridad de cuadros.
{
  const faltan = Object.keys(PERSIST).filter(m => !TRAS_JUGAR[m]);
  assert.deepStrictEqual(faltan, [],
    `modos que declaran QUÉ guardan pero no A DÓNDE llevan: ${faltan.join(', ')} — los dos cuadros describen el mismo modo`);
  for (const [modo, def] of Object.entries(TRAS_JUGAR)) {
    for (const rama of ['conSesion', 'sinSesion']) {
      assert.ok(def[rama]?.href?.startsWith('#/'),
        `${modo}.${rama} debe declarar una ruta de la app (#/…), no «${def[rama]?.href}»`);
      assert.ok(String(def[rama]?.label || '').trim(),
        `${modo}.${rama} sin texto de botón: nadie pulsa un botón sin nombre`);
    }
    assert.strictEqual(typeof def.repetir, 'boolean', `${modo} debe declarar \`repetir\` (sí o no, no «a veces»)`);
  }
  ok(`los ${Object.keys(TRAS_JUGAR).length} modos declaran destino con sesión, sin sesión y si se puede repetir`);
}

// 2 · EL FALLO REPORTADO: sin sesión, nunca a «Mis actividades».
{
  const malos = Object.keys(TRAS_JUGAR).filter(m => destinoTrasJugar(m, false).href === '#/mine');
  assert.deepStrictEqual(malos, [],
    `sin sesión estos modos llevan a #/mine (la pantalla de OTRO): ${malos.join(', ')}`);
  assert.strictEqual(destinoTrasJugar('solo', false).href, '#/explore',
    'quien juega sin cuenta y termina quiere MÁS actividades: va a la biblioteca');
  ok('sin sesión ningún modo acaba en «Mis actividades» (Individual va a la biblioteca)');
  // CONTRA-PRUEBA: con sesión SÍ es lo suyo — la regla no es «nunca #/mine».
  assert.strictEqual(destinoTrasJugar('solo', true).href, '#/mine',
    'con sesión, terminar sí devuelve a Mis actividades');
  ok('CONTRA-PRUEBA: con sesión el camino legítimo sigue llevando a Mis actividades');
}

// 3 · Repetir solo donde repetir es gratis.
{
  assert.strictEqual(puedeRepetir('async-tracked'), false,
    'la Tarea tiene tope de intentos (§22-3): ofrecer «jugar otra vez» sería mentir');
  assert.strictEqual(puedeRepetir('live-student'), false, 'el ritmo del en vivo lo manda el host, no el alumno');
  assert.strictEqual(puedeRepetir('solo'), true, 'en Individual repetir es gratis y es lo que quiere quien acaba de jugar');
  ok('«jugar otra vez» solo donde no hay tope (Individual/VS/Equipos sí · Tarea y Live no)');
}

// 4 · Un modo que nadie declaró va a la ENTRADA, que sabe decidir.
{
  assert.strictEqual(destinoTrasJugar('modo-inventado', false).href, DESTINO_DESCONOCIDO.href,
    'fail-safe: lo no declarado va a #/ (la entrada decide), nunca a una pantalla que pueda no ser tuya');
  ok('fail-safe: un modo sin declarar cae en la entrada');
}

// 5 · ESCANEO: nadie vuelve a escribir el destino a mano.
// `#/home` es una ruta de COMPATIBILIDAD que redirige a #/mine: escribirla en un
// enlace es exactamente el cableado que causó el fallo. Se permite donde se
// DEFINE (el router) y en el aviso de ruta no encontrada.
{
  const PERMITIDO = new Set(['main.teacher.js']);
  const dirs = ['views', 'templates', 'core', 'kernel'];
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith('.js')) files.push(join(d, e.name));
    }
  };
  dirs.forEach(walk);
  files.push('main.teacher.js', 'main.student.js', 'main.embed.js');
  const compat = files.filter(f => !PERMITIDO.has(f) && /href=["'`]#\/home/.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepStrictEqual(compat, [],
    `enlaces a #/home (ruta de compatibilidad) en: ${compat.join(', ')} — enlaza al destino REAL, no al alias`);

  // Y quien PINTA una pantalla de fin (importa el cuadro o la pantalla estándar)
  // no puede además escribir un destino a mano: sería la segunda verdad.
  const finales = files.filter(f => {
    if (f.startsWith('core/afterPlay') || f.startsWith('core/resultScreen')) return false;
    const src = readFileSync(join(ROOT, f), 'utf8');
    return /from '.*\/(afterPlay|resultScreen)\.js'/.test(src)
      && /href=["'`]#\/(mine|explore|join)/.test(src);
  });
  assert.deepStrictEqual(finales, [],
    `pantallas de fin con destino cableado: ${finales.join(', ')} — pídelo a destinoTrasJugar()`);
  ok(`escaneo: ninguno de los ${files.length} módulos cablea el destino de fin`);
  // CONTRA-PRUEBA: el escáner reconoce los dos patrones que busca.
  assert.ok(/href=["'`]#\/home/.test('<a href="#/home">x</a>'), 'el escáner debe cazar el alias');
  assert.ok(/href=["'`]#\/(mine|explore|join)/.test('<a href="#/mine">x</a>'), 'y el destino escrito a mano');
}

console.log(`\n  ${passed} afterPlay checks passed`);
