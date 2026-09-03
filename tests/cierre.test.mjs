// EL CIERRE COMPARTIDO ES UNO — sin salida.
//
// Medido el 2026-09-04: el podio (`podiumHtml`) ya era único, pero lo que lo
// RODEA en el fin de una partida a más de un bando —título, empate, ranking
// del 4º en adelante, botones— vivía copiado en CUATRO pantallas (duelo,
// lista, equipos/memoria, informe en vivo): cuatro cabeceras, cuatro pares de
// botones, cuatro criterios de empate. `cierreHtml` (core/podium.js) es ahora
// el dueño único; cada modo aporta solo `clase`/`resumen`/`extra`/`acciones`.
// Esta suite ejecuta el código real (nada de comparar strings de fixture).
import assert from 'node:assert/strict';
import { cierreHtml } from '../core/podium.js';

const ok = (m) => console.log(`  ✓ ${m}`);

// ── (a) Empate → «¡Empate!» y SIN nombre de ganador; ganador → su nombre en
//     `.ww-cierre__nombre` ──────────────────────────────────────────────────
{
  const empate = cierreHtml({ ranked: [{ name: 'Ana', score: 5 }, { name: 'Beto', score: 5 }] });
  assert.ok(empate.includes('¡Empate!'), 'mismo puntaje → título de empate');
  assert.ok(!empate.includes('ww-cierre__nombre'), 'un empate no anuncia ganador (nada de nombre)');

  const gana = cierreHtml({ ranked: [{ name: 'Ana', score: 8 }, { name: 'Beto', score: 3 }] });
  assert.ok(!gana.includes('¡Empate!'), 'con puntajes distintos no es empate');
  assert.ok(/class="ww-cierre__nombre">Ana</.test(gana), 'el nombre del ganador va en su propio nodo');
  ok('empate → «¡Empate!» sin nombre; ganador → su nombre en .ww-cierre__nombre');
}

// ── (b) Ranking del 4º en adelante aparece con ≥4 jugadores, no con 3 ───────
{
  const tres = cierreHtml({ ranked: [{ name: 'A', score: 9 }, { name: 'B', score: 7 }, { name: 'C', score: 5 }] });
  assert.ok(!tres.includes('ww-cierre__ranking'), 'con 3 (el podio entero) no hace falta ranking aparte');

  const cuatro = cierreHtml({
    ranked: [{ name: 'A', score: 9 }, { name: 'B', score: 7 }, { name: 'C', score: 5 }, { name: 'D', score: 2 }]
  });
  assert.ok(cuatro.includes('ww-cierre__ranking'), 'con 4 el 4º entra al ranking corto');
  assert.ok(cuatro.includes('4. D'), 'con SU puesto y nombre');
  ok('ranking del 4º en adelante: aparece con ≥4, no con 3');
}

// ── (c) resumen/extra/acciones van DENTRO y en ese orden ───────────────────
{
  const ranked = [{ name: 'Ana', score: 8 }, { name: 'Beto', score: 3 }];
  const html = cierreHtml({ ranked, resumen: '<p data-resumen>x</p>', extra: '<p data-extra>y</p>', acciones: '<button data-acciones>z</button>' });
  const iResumen = html.indexOf('data-resumen');
  const iExtra = html.indexOf('data-extra');
  const iAcciones = html.indexOf('data-acciones');
  assert.ok(iResumen > -1 && iExtra > -1 && iAcciones > -1, 'los tres slots están presentes');
  assert.ok(iResumen < iExtra && iExtra < iAcciones, 'y en ORDEN: resumen, extra, acciones');
  assert.ok(html.includes('<div class="ww-cierre__acciones">'), 'acciones va envuelto en su propio nodo');
  ok('resumen/extra/acciones: dentro y en orden fijo');
}

// ── (d) CONTRA-PRUEBA: carrera con puntos iguales pero `tie` distinto NO es
//     empate (la hora de meta desempata) ────────────────────────────────────
{
  const carrera = cierreHtml({
    ranked: [
      { name: 'Ana', score: 6, tie: 47000, sub: '0:47' },
      { name: 'Beto', score: 6, tie: 63000, sub: '1:03' },
    ]
  });
  assert.ok(!carrera.includes('¡Empate!'), 'mismo puntaje, distinta hora de meta → NO es empate');
  assert.ok(/class="ww-cierre__nombre">Ana</.test(carrera), 'gana quien llegó antes');

  // Y el `tie` explícito (criterio propio del modo, p.ej. el duelo) manda
  // sobre el cálculo por defecto aunque los puntos y el `tie` coincidan:
  const conTieExplicito = cierreHtml({
    ranked: [{ name: 'Ana', score: 6, tie: 1 }, { name: 'Beto', score: 6, tie: 1 }],
    tie: false,
  });
  assert.ok(!conTieExplicito.includes('¡Empate!'), 'un `tie` explícito a `false` gana al cálculo por defecto');
  ok('CONTRA-PRUEBA: mismo puntaje + `tie` distinto no es empate; `tie` explícito manda');
}

// ── Borde: sin jugadores no revienta (sala en vivo sin respuestas) ──────────
{
  const vacio = cierreHtml({ ranked: [] });
  assert.ok(!vacio.includes('¡Empate!') && vacio.includes('Nadie ha jugado'), 'sin jugadores no es un empate: la clase no debe leer «¡Empate!» sobre un podio vacío');
  ok('ranked vacío: no revienta, título neutro');
}

console.log('\ncierre.test: 5 checks passed');
