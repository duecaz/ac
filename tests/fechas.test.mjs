// LA HORA QUE SE MUESTRA ES LA DEL QUE MIRA (§, dueño 2026-08-21 con captura).
//
// El panel de moderación decía «2026-08-21 23:50» de una hoja entregada a las
// 18:50 de Lima: pintaba el sello de PocketBase EN CRUDO, que es UTC. Y donde
// solo se veía el día (`slice(0, 10)`), el error salta de hora a FECHA: lo hecho
// después de las 19:00 en Lima aparecía fechado al día siguiente.
//
// Run: node tests/fechas.test.mjs
import assert from 'node:assert';
import { fechaHora, fechaCorta } from '../core/fechas.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// La zona se PASA para que el veredicto no dependa de la máquina donde corra CI
// (en la app nunca se pasa: cada uno ve su hora).
const LIMA = { timeZone: 'America/Lima' };      // UTC-5, el caso del dueño
const TOKIO = { timeZone: 'Asia/Tokyo' };       // UTC+9, al otro lado

// ── EL CASO EXACTO DE LA CAPTURA ────────────────────────────────────────────
{
  // Lo que PocketBase guardó cuando el reloj de Lima marcaba las 18:50.
  const selloPB = '2026-08-21 23:50:12.345Z';
  assert.strictEqual(fechaHora(selloPB, LIMA), '21/08/2026, 18:50');
  // La prueba de que NO es un corte de cadena: el crudo dice otra cosa.
  assert.notStrictEqual(fechaHora(selloPB, LIMA), selloPB.slice(0, 16));
  ok('el sello de PB (UTC, con espacio) se pinta en la hora de quien mira: 23:50Z → 18:50 en Lima');
}

// ── EL ERROR DE DÍA, que era el peor porque no se nota ──────────────────────
{
  // 01:00 UTC del día 22 son las 20:00 del día 21 en Lima.
  const selloPB = '2026-08-22 01:00:00.000Z';
  assert.strictEqual(fechaCorta(selloPB, LIMA), '21/08/2026');
  assert.strictEqual(selloPB.slice(0, 10), '2026-08-22');   // lo que se veía antes
  // Y al revés, al otro lado del meridiano: ahí ya es el 22 por la mañana.
  assert.strictEqual(fechaCorta(selloPB, TOKIO), '22/08/2026');
  ok('cerca de medianoche acierta el DÍA en las dos direcciones (Lima 21 · Tokio 22)');
}

// ── FORMATO ISO NORMAL (el que usan las actividades) ────────────────────────
{
  assert.strictEqual(fechaHora('2026-08-21T23:50:00Z', LIMA), '21/08/2026, 18:50');
  assert.strictEqual(fechaHora(new Date('2026-08-21T23:50:00Z'), LIMA), '21/08/2026, 18:50');
  ok('acepta ISO con «T» y un Date ya construido');
}

// ── LO QUE NO SE ENTIENDE NO INVENTA UNA FECHA ──────────────────────────────
// Un sello vacío o roto debe dar cadena vacía, no «Invalid Date» ni la fecha de
// hoy: una fila sin fecha se lee como «no consta», y una fecha inventada miente.
{
  for (const malo of [null, undefined, '', '   ', 'ayer', '2026-13-45']) {
    assert.strictEqual(fechaHora(malo), '', `fechaHora(${JSON.stringify(malo)})`);
    assert.strictEqual(fechaCorta(malo), '', `fechaCorta(${JSON.stringify(malo)})`);
  }
  ok('un sello vacío o ilegible da cadena vacía — nunca «Invalid Date» ni la fecha de hoy');
}

// ── CONTRA-PRUEBA: sin zona, usa la del que mira (no fuerza ninguna) ────────
{
  const d = new Date('2026-08-21T23:50:00Z');
  const propia = fechaHora(d);
  const esperado = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
  assert.strictEqual(propia, esperado, 'sin timeZone debe salir la hora local del entorno');
  ok('CONTRA-PRUEBA: sin zona sale la hora LOCAL del navegador, no una zona cableada');
}

// ── LA NORMA, ESCANEANDO: nadie pinta un sello en CRUDO ─────────────────────
// No basta con arreglar los tres sitios de hoy: el atajo `created.slice(0, 16)`
// es cómodo y volverá. Se BARRE el código en vez de enumerar los culpables —
// una lista enumerada vigila el pasado.
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const CORTE = /\b(?:created|updated|updatedAt|createdAt|created_at|updated_at)\s*\|\|\s*''\)?\s*\.slice\(|\b(?:created|updated|updatedAt|createdAt)\s*\)?\.slice\(\s*0/;
  const culpables = [];
  for (const carpeta of ['views', 'core', 'templates']) {
    const pila = [join(ROOT, carpeta)];
    while (pila.length) {
      for (const e of readdirSync(pila.pop(), { withFileTypes: true })) {
        const p = join(e.parentPath || e.path, e.name);
        if (e.isDirectory()) { pila.push(p); continue; }
        if (!e.name.endsWith('.js')) continue;
        // El módulo DUEÑO puede nombrar el atajo: su comentario explica por qué
        // está prohibido. Es la única excepción, y es él mismo.
        if (p.endsWith(join('core', 'fechas.js'))) continue;
        readFileSync(p, 'utf8').split('\n').forEach((linea, i) => {
          if (CORTE.test(linea)) culpables.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
        });
      }
    }
  }
  assert.deepStrictEqual(culpables, [],
    'sellos de fecha pintados en CRUDO (son UTC: usa core/fechas.js):\n  ' + culpables.join('\n  '));
  ok('barrido: ninguna vista corta un sello de fecha a mano (todas pasan por core/fechas.js)');
}

console.log(`\nfechas.test: ${passed} checks passed`);
