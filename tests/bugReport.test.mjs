// REPORTE DE UN TOQUE (core/bugReport.js) — lo que lleva y lo que NO puede llevar.
//
// El reporte existe para que "me salió un mensaje que no pude leer" llegue con
// versión, pantalla y el error de debajo. Y tiene un límite de LEY (R7, norte):
// dato mínimo — nada de alumnos, nada del aparato.
//
// Run: node tests/bugReport.test.mjs
import assert from 'node:assert';
import { buildBugReport, medidasPantalla } from '../core/bugReport.js';
import { VERSION } from '../core/constants.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. Lleva lo que hace reproducible un hallazgo ──────────────────────────
{
  const r = buildBugReport({
    href: 'https://aulareto.com/student.html#/task/ABC123',
    errors: [
      { at: '2026-08-07T10:00:00Z', message: 'TypeError: x is undefined', page: '/student.html' },
      { at: '2026-08-07T10:01:00Z', message: 'fallo al guardar', page: '/student.html' },
    ],
    now: new Date('2026-08-07T10:02:00Z'),
  });
  assert.ok(r.includes(`v${VERSION}`), 'cita la versión EXACTA (la regla nº1 del proyecto)');
  assert.ok(r.includes('#/task/ABC123'), 'cita la pantalla donde pasó');
  assert.ok(r.includes('TypeError: x is undefined'), 'lleva los errores del anillo local');
  assert.ok(r.includes('2026-08-07T10:02:00.000Z'), 'y la hora del reporte');
  assert.ok(r.includes('¿qué estabas haciendo'), 'termina pidiendo el contexto humano');
  ok('el reporte lleva versión · pantalla · errores · hora · pregunta de contexto');
}

// ── 2. R7: dato MÍNIMO — nada del aparato, y errores acotados ──────────────
{
  const r = buildBugReport({ href: 'x', errors: [], now: new Date(0) });
  assert.ok(!/userAgent|Android|iPhone|Mozilla/i.test(r), 'ni rastro del aparato (R7)');
  const muchos = Array.from({ length: 30 }, (_, i) => ({ at: 't', message: 'e' + i }));
  const r2 = buildBugReport({ href: 'x', errors: muchos, now: new Date(0) });
  assert.ok(!r2.includes('e24') && r2.includes('e29'), 'solo los ÚLTIMOS 5 errores (los recientes)');
  const largo = buildBugReport({ href: 'x', errors: [{ at: 't', message: 'A'.repeat(9000) }], now: new Date(0) });
  assert.ok(largo.length < 1500, 'un error gigante no hace el reporte impegable');
  ok('R7: sin datos del aparato · últimos 5 errores · mensajes acotados');
}

// ── 3. CONTRA-PRUEBA: sin errores registrados sigue siendo útil ────────────
{
  const r = buildBugReport({ href: 'https://aulareto.com/#/mine', errors: [], now: new Date(0) });
  assert.ok(r.includes('ninguno registrado'), 'dice explícitamente que no hay errores');
  assert.ok(r.includes(`v${VERSION}`) && r.includes('#/mine'), 'y aun así lleva versión y pantalla');
  ok('CONTRA-PRUEBA: sin errores, el reporte sigue diciendo versión y pantalla');
}

// ── LA MAQUETA VIENE MEDIDA ────────────────────────────────────────────────
// «Todavía tiene scroll, ¿o aún no se actualizó?» (dueño, 2026-08-15). Con
// versión y ruta solamente, esa pregunta no tiene respuesta, y la alternativa
// era pedirle que pegara código en la consola — que Chrome bloquea hasta
// escribir «allow pasting». Cinco números en el reporte la contestan solos.
{
  const r = buildBugReport({
    version: '9.9.9', errors: [], now: new Date('2026-01-01T00:00:00Z'),
    medidas: { ventana: '412x915', sobra: 72, barra: 56, barraVar: '56px', vh: 915, pagina: 859, marco: 913, ronda: 436 },
  });
  assert.match(r, /maqueta: ventana 412x915/, 'el reporte dice el tamaño de la ventana');
  assert.match(r, /scroll sobrante 72px/, 'y si sobra pantalla (la pregunta que no se podía responder)');
  assert.match(r, /barra 56px \(descontada 56px\)/, 'y si el marco descuenta la barra REAL');
  assert.match(r, /marco 913px · ejercicio 436px/, 'y si el ejercicio llena el marco');
  assert.match(r, /alto útil 915px/,
    'y el alto de maquetación real (sin esto, «la barra está bien y aun así sobra» no se puede distinguir)');
  // R7 intacto: son medidas de MAQUETA, no del aparato.
  assert.ok(!/userAgent|Android|iPhone|modelo/i.test(r), 'sigue sin datos del aparato');
  ok('el reporte trae la maqueta medida (ventana · scroll · barra · marco · ejercicio) sin datos del aparato');
}

// ── CONTRA-PRUEBA: sin DOM, el reporte no se rompe ─────────────────────────
// `medidasPantalla()` corre en Node (tests, herramientas) donde no hay document.
{
  assert.strictEqual(medidasPantalla(null, null), null, 'sin DOM no hay medidas');
  const r = buildBugReport({ version: '9.9.9', errors: [], medidas: null, now: new Date() });
  assert.ok(!/maqueta:/.test(r), 'y la línea simplemente no sale');
  assert.match(r, /REPORTE AulaReto v9\.9\.9/, 'el resto del reporte sigue entero');
  ok('CONTRA-PRUEBA: sin DOM no hay línea de maqueta y el reporte sigue válido');
}

console.log(`\n  ${passed} bugReport checks passed`);
