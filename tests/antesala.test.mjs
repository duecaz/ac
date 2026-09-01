// LA ANTESALA ES UNA (dueño 2026-09-01: «las actividades tienen looks distintos
// … debemos estandarizar»).
//
// Había cuatro pantallas de «antes de jugar» y cada una decidía por su cuenta lo
// mismo: Individual arrancaba con UN botón que siempre entra en pantalla
// completa; los modos embebidos con DOS (y el segundo era el que valía para el
// aula); la tarea con un formulario sin instrucciones, sin ambiente y sin
// pantalla completa. Lo que veías dependía de por dónde habías entrado.
//
// Esta suite fija las reglas ESCANEANDO — no comprobando una lista escrita a
// mano, que envejece con el primer modo nuevo:
//   1. nadie pinta su propio control de arranque fuera de la antesala;
//   2. la antesala pinta EXACTAMENTE UNO y siempre pide pantalla completa;
//   3. toda antesala de una ACTIVIDAD cuenta cómo se juega;
//   4. un ajuste, una casilla: el sonido tiene un solo dueño (§21b).
// Lo que se ve con el dedo (que el botón exista y se pueda tocar en las 13 ×
// modos) lo mide `tools/matrix-smoke.mjs`: aquí se vigila el CÓDIGO.
//
// Run: node tests/antesala.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const RAIZ = new URL('..', import.meta.url).pathname;
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');
const ANTESALA = 'views/antesala.js';

// ── 1. UN SOLO SITIO PINTA EL ARRANQUE ──────────────────────────────────────
// Descubierto por escaneo: cualquier vista que se pinte su propio botón de
// empezar rompe aquí, aunque sea un modo que hoy no existe.
{
  const sospechosos = [];
  const barrer = (dir) => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { barrer(rel); continue; }
      if (!e.name.endsWith('.js') || rel === ANTESALA) continue;
      const src = leer(rel);
      // El marcador del control de arranque. Se busca el ATRIBUTO (no una
      // clase): es lo que hace de contrato con las sondas del navegador.
      if (/data-ww-start/.test(src)) sospechosos.push(rel);
    }
  };
  barrer('views');
  barrer('core');
  barrer('templates');
  assert.deepStrictEqual(sospechosos, [],
    `pintan su propio control de arranque: ${sospechosos.join(', ')} — la antesala es la única (views/antesala.js)`);
  ok('nadie pinta su propio botón de empezar: el control de arranque tiene un dueño');
}

// ── 2. UNO, Y SIEMPRE A PANTALLA COMPLETA ───────────────────────────────────
// La regla que se busca fijar: «normal o pantalla completa» no es una decisión
// del que va a jugar. En el aula se proyecta SIEMPRE (y salir es Esc o el botón
// de la esquina del marco).
// No se comprueba con regex sobre la implementación —eso ata el test a CÓMO
// está escrito y rompe CI al reordenar una línea—: se comprueba que NADIE MÁS
// pide pantalla completa al arrancar. Que el botón exista, sea uno solo y se
// pueda tocar lo mide `tools/matrix-smoke.mjs` sobre el DOM montado, en las 13
// plantillas × modos, que es donde eso se puede saber de verdad.
{
  const src = leer(ANTESALA);
  assert.ok(/toggleFullscreen/.test(src), 'la antesala entra en pantalla completa al arrancar');
  // Quién más llama a toggleFullscreen: solo el botón de la esquina del marco
  // (`core/fullscreen.js`, que es su dueño) y quien lo cablea. Una VISTA que lo
  // llame por su cuenta es un segundo camino a pantalla completa.
  const otros = [];
  const barrer = (dir) => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { barrer(rel); continue; }
      if (!e.name.endsWith('.js') || rel === ANTESALA || rel === 'core/fullscreen.js') continue;
      if (/toggleFullscreen\s*\(/.test(leer(rel))) otros.push(rel);
    }
  };
  barrer('views'); barrer('core'); barrer('templates');
  assert.deepStrictEqual(otros, [],
    `piden pantalla completa por su cuenta: ${otros.join(', ')} — al arrancar la pide la antesala; `
    + 'el botón de la esquina es del marco (core/fullscreen.js)');
  ok('la antesala arranca a pantalla completa y nadie más abre un segundo camino');
}

// ── 3. SE CUENTA CÓMO SE JUEGA ──────────────────────────────────────────────
// `meta.instructions` es obligatorio por contrato de plantilla y hasta hoy lo
// leía UN modo de cuatro: el alumno de una tarea —el único que juega solo, sin
// nadie a quien preguntar— nunca lo veía.
{
  const src = leer(ANTESALA);
  assert.ok(/instruccionesDe\(activity\)/.test(src), 'la antesala deriva las instrucciones de la actividad');

  // Toda llamada que traiga una ACTIVIDAD tiene instrucciones: o las hereda
  // (no las apaga) o las pasa. Apagarlas es legítimo solo sin actividad única
  // —una lista encadenada—, y entonces tiene que declararlo.
  const llamantes = ['views/vsView.js', 'views/teamsView.js', 'views/memoryView.js', 'views/studentTask.js'];
  for (const f of llamantes) {
    const src2 = leer(f);
    assert.ok(/activity: a,|activity,/.test(src2), `${f}: no le pasa la actividad a la antesala (sin ella no hay instrucciones)`);
    assert.ok(!/instructions: ''/.test(src2), `${f}: apaga las instrucciones de una actividad`);
  }
  const lista = leer('views/listView.js');
  assert.ok(/instructions: ''/.test(lista),
    'CONTRA-PRUEBA: la lista encadenada SÍ puede apagarlas (no tiene una sola forma de jugarse) y lo declara');
  ok('las cuatro antesalas de una actividad cuentan cómo se juega; solo la lista lo apaga, y declarándolo');
}

// ── 4. UN AJUSTE, UNA CASILLA (§21b) ────────────────────────────────────────
// El duelo tenía su propio interruptor de sonido (`vsFeedback.sound`) además
// del silencio global: dos casillas para lo mismo, y ganaba la que el profe no
// había tocado. El dueño del sonido es `core/sounds.js`, cuyo `play()` ya
// respeta el silencio.
{
  for (const f of ['views/vsView.js', 'core/editorModes.js']) {
    const src = leer(f);
    assert.ok(!/\bsound: true\b/.test(src), `${f}: reaparece un interruptor de sonido propio del duelo`);
    assert.ok(!/fx\.sound/.test(src), `${f}: vuelve a decidir por su cuenta si suena`);
  }
  // CONTRA-PRUEBA: el duelo sigue sonando — se quitó la casilla, no el sonido.
  assert.ok(/playSound\(r\.correct \? 'correct' : 'wrong'\)/.test(leer('views/vsView.js')),
    'CONTRA-PRUEBA: el duelo sigue sonando al acertar y al fallar (lo gatea el silencio global)');
  ok('el sonido tiene UN dueño (core/sounds.js) y el duelo sigue sonando');
}

// ── 5. NINGUNA UTILIDAD DE BOOTSTRAP EN LA RAÍZ DEL JUEGO ───────────────────
// Las utilidades (`p-2`, `m-3`…) llevan `!important`: puestas en la raíz del
// player ganan a CUALQUIER regla del juego, incluida la reserva que el HUD pide
// cuando el reloj centrado está a la vista. Por eso el chip volvía a caer sobre
// «Nariz» en el Diagrama aunque la regla existía y era más específica — un
// defecto que no se ve leyendo el CSS, solo midiendo. El relleno de la raíz vive
// en la hoja de la plantilla, donde se puede razonar con él.
{
  const culpables = [];
  for (const e of readdirSync(join(RAIZ, 'templates'), { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    for (const f of readdirSync(join(RAIZ, 'templates', e.name))) {
      if (!f.endsWith('.js')) continue;
      const src = leer(`templates/${e.name}/${f}`);
      // La RAÍZ del juego: la que lleva el andamio o el player y, en la misma
      // clase, una utilidad de espaciado.
      const re = /class="[^"]*(?:ww-scaffold|ww-player)[^"]*\b(?:p|pt|py|m|mt|my)-[0-5]\b[^"]*"/g;
      for (const m of src.match(re) || []) culpables.push(`templates/${e.name}/${f}: ${m.slice(0, 60)}`);
    }
  }
  assert.deepStrictEqual(culpables, [],
    `utilidad de Bootstrap (con !important) en la raíz del juego: ${culpables.join(' · ')}`);
  ok('ninguna raíz de juego lleva una utilidad de Bootstrap que pise las reglas del propio juego');
}

console.log(`\nantesala.test: ${passed} checks passed`);
