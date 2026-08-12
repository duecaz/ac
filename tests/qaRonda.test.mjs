// LA RONDA DE PRUEBAS ES DATO: si está mal, el probador prueba otra cosa.
//
// `qa/ronda-actual.json` lo lee `test.html` (aulareto.com/test.html) y no lo
// valida nadie más — un typo o un campo olvidado no rompe ninguna pantalla del
// producto: rompe la RONDA, y eso se descubre cuando el compañero ya perdió la
// tarde. Aquí se comprueba lo que hace que una prueba se pueda ejecutar sin
// preguntar nada:
//
//   · `ruta` — DÓNDE se hace (aparato › actividad › modo › pantalla). La pidió el
//     dueño el 2026-08-11: «que no quede ninguna confusión». Sin ella, «la 3
//     falla» obliga a preguntar en qué pantalla miraba.
//   · `accion` y `espera` — el cuándo y el entonces (§ Gherkin de leyes.md: el
//     comportamiento no se cuenta en prosa, se escribe ejecutable o verificable).
//   · `n` único — es el identificador con el que se reporta.
//
// Run: node tests/qaRonda.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ronda = JSON.parse(readFileSync(join(ROOT, 'qa/ronda-actual.json'), 'utf8'));
const pruebas = (ronda.secciones || []).flatMap(s => s.pruebas || []);

{
  assert.ok(ronda.id && ronda.titulo, 'la ronda necesita id y título (el id nombra su clave de guardado y la fila del envío)');
  assert.ok(pruebas.length >= 3, `una ronda con ${pruebas.length} prueba(s) no es una ronda`);
  const ns = pruebas.map(p => p.n);
  assert.strictEqual(new Set(ns).size, ns.length, `números repetidos: ${ns.join(', ')} — el informe los usa como identificador`);
  ok(`ronda «${ronda.id}»: ${pruebas.length} pruebas con número único`);
}

{
  const sinRuta = pruebas.filter(p => !Array.isArray(p.ruta) || p.ruta.length < 2).map(p => p.n);
  assert.deepStrictEqual(sinRuta, [],
    `pruebas sin RUTA (o con menos de dos tramos): ${sinRuta.join(', ')} — la ruta dice DÓNDE se hace (aparato › actividad › modo › pantalla)`);
  const vacios = pruebas.filter(p => (p.ruta || []).some(t => !String(t || '').trim())).map(p => p.n);
  assert.deepStrictEqual(vacios, [], `rutas con tramos vacíos: ${vacios.join(', ')}`);
  ok(`las ${pruebas.length} pruebas dicen dónde se hacen (ruta de ${Math.min(...pruebas.map(p => p.ruta.length))}-${Math.max(...pruebas.map(p => p.ruta.length))} tramos)`);
}

{
  const incompletas = pruebas
    .filter(p => !String(p.accion || '').trim() || !String(p.espera || '').trim() || !String(p.titulo || '').trim())
    .map(p => p.n);
  assert.deepStrictEqual(incompletas, [],
    `pruebas sin título, acción o «tiene que pasar»: ${incompletas.join(', ')} — sin el ESPERA no hay veredicto posible, solo opinión`);
  ok('cada prueba trae título, acción (cuándo) y espera (entonces)');
}

{
  // CONTRA-PRUEBA: el validador distingue de verdad una ronda rota.
  const rota = [{ n: 1, titulo: 'x', accion: 'y', espera: 'z', ruta: ['PC'] }];
  assert.strictEqual(rota.filter(p => !Array.isArray(p.ruta) || p.ruta.length < 2).length, 1,
    'una ruta de un solo tramo debe contarse como incompleta');
  ok('CONTRA-PRUEBA: una ronda mal escrita sería cazada');
}

console.log(`\n  ${passed} qaRonda checks passed`);
