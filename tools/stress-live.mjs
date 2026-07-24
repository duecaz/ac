#!/usr/bin/env node
// Test de CARGA de la app (deuda A + live_answers + tareas) contra el PocketBase
// REAL. Simula N alumnos entrando y respondiendo A LA VEZ, y N intentos de tarea
// concurrentes — el driver local no puede reproducir estos bugs de concurrencia.
// El mismo módulo (core/stressTest.js) alimenta el botón del panel #/admin.
//
//   node tools/stress-live.mjs [N=30] [PB_URL]
//
// Crea datos DESECHABLES (prefijo stress_) y los borra al terminar. NO necesita
// una sala existente: se crea la suya. Requiere las colecciones ya creadas
// (#/admin → "Crear colecciones").
import { runStressTest } from '../core/stressTest.js';

const N = Number(process.argv[2] || 30);
const PB = process.argv[3] || 'https://pb.lanube.uno';

(async () => {
  console.log(`Prueba de carga: ${N} alumnos concurrentes contra ${PB}\n`);
  const r = await runStressTest({ pbUrl: PB, n: N, onLog: (m) => console.log('  ·', m) });

  if (r.notes.length) r.notes.forEach(n => console.log('  ⚠', n));
  if (r.live) {
    const L = r.live;
    console.log(`\nLIVE (${L.joinMs}ms join · ${L.ansMs}ms respuestas):`);
    console.log(`  entradas:  ${L.joinsOk}/${N} ok · ${L.playerRows} filas · ${L.uniqueNames} apodos únicos`);
    console.log(`  respuestas: ${L.answersOk} ok · ${L.answerRows} filas (esperadas ${L.joinsOk * 2})`);
    console.log(`  ${L.pass ? '✅' : '❌'} live ${L.pass ? 'PASA' : 'FALLA'}`);
  }
  if (r.tasks) {
    const T = r.tasks;
    console.log(`\nTAREAS${T.attMs != null ? ` (${T.attMs}ms)` : ''}:`);
    if (T.attemptRows != null) console.log(`  intentos:  ${T.attemptsOk}/${N} ok · ${T.attemptRows} filas`);
    console.log(`  ${T.pass ? '✅' : '❌'} tareas ${T.pass ? 'PASA' : 'FALLA'}`);
  }

  console.log(`\n${r.ok ? '✅ TODO PASA' : '❌ HAY FALLOS'} — ${r.ms}ms total.`);
  if (!r.ok) console.log('   (filas < N ⇒ lost-update / la Pi no aguanta la concurrencia; apodos únicos < filas ⇒ colisión sin resolver)');
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
