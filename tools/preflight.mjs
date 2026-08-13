#!/usr/bin/env node
// PREFLIGHT — lo que hay que pasar antes de tocar `main` (que sirve la web).
//
//   node tools/preflight.mjs
//
// POR QUÉ EXISTE. Las redes de seguridad ya existían… pero cada una nació
// DESPUÉS de su propio incendio y ninguna se corría sola. `node tests/run.mjs`
// verifica PIEZAS —las suites de lógica pura— y los bugs que la clase encontró
// esta semana no vivían en ninguna pieza: vivían en la COSTURA entre piezas
// correctas. El enlace que la app generaba contra el router que lo leía. El
// veredicto que calculaba el móvil contra el snapshot que le dio el servidor. El
// botón contra el marcador que se pintaba encima.
//
// Ninguno de esos tres se ve sin abrir un navegador y CAMINAR el viaje. Por eso
// el preflight incluye los recorridos, no solo la suite: un cambio en vistas,
// CSS o router puede dejar la suite verde y la app rota.
//
// Todas juntas tardan ~2 min. Ese es el precio de no enterarse con 33 críos
// delante.
//
// Fuera del preflight a propósito:
//   · tools/race-e2e.mjs   → necesita PocketBase REAL y credenciales (manual).
//   · tools/stress-live.mjs → prueba de carga contra la Pi (manual).
//   · tools/shots.mjs      → comparación visual antes/después (manual, por diseño).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloRapido = process.argv.includes('--rapido');

// Orden deliberado: primero lo BARATO. Si la lógica pura está rota, no tiene
// sentido gastar 40 s levantando navegadores para verlo otra vez.
const PASOS = [
  { id: 'suites',  cmd: 'tests/run.mjs',        que: 'lógica pura (contrato · normas · leyes · scorers)', rapido: true },
  { id: 'matriz',  cmd: 'tools/matrix-smoke.mjs', que: 'cada plantilla × cada modo arranca, un gesto de envío, fullscreen tocable' },
  { id: 'colores', cmd: 'tools/contrast-torture.mjs', que: 'cada tema × cada fondo: ningún texto por debajo de 3:1 (la combinación, no cada eje por su lado)' },
  { id: 'margenes', cmd: 'tools/margenes-smoke.mjs', que: 'ninguna pantalla del profe pegada al borde, en PC y en móvil' },
  { id: 'puertas', cmd: 'tools/editor-puertas.mjs', que: 'las 13 tienen puerta visible para añadir y dicen qué hacer con la actividad vacía' },
  { id: 'buscar',  cmd: 'tools/find-smoke.mjs',   que: 'el viaje buscar/crear (portada → biblioteca → elegir plantilla → EDITAR → guardar → buscarla)' },
  { id: 'editar',  cmd: 'tools/edit-audit.mjs',   que: 'teclear en los 13 editores sin que la actividad pierda su respuesta correcta' },
  { id: 'vivo',    cmd: 'tools/live-smoke.mjs',   que: 'el viaje en vivo con dos pantallas (sala → PIN → responder → podio)' },
  { id: 'tareas',  cmd: 'tools/task-smoke.mjs',   que: 'el viaje de tareas (crear → PIN → jugar → tope de intentos → informe)' },
];

const correr = (cmd) => new Promise((res) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [cmd], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ code, out, secs: Math.round((Date.now() - t0) / 1000) }));
});

const pasos = soloRapido ? PASOS.filter(p => p.rapido) : PASOS;
console.log(`\n🛫 PREFLIGHT — ${pasos.length} red(es) antes de tocar main\n`);

const resultados = [];
for (const paso of pasos) {
  const r = await correr(paso.cmd);
  resultados.push({ ...paso, ...r });
  console.log(`  ${r.code === 0 ? '✅' : '❌'} ${paso.id.padEnd(7)} ${String(r.secs + 's').padStart(4)}  ${paso.que}`);
  // Al primer fallo se para y se enseña SU salida: buscarla en 4 informes
  // encadenados es lo que hace que la gente deje de correr el preflight.
  if (r.code !== 0) {
    console.log(`\n${'─'.repeat(70)}\n${r.out.trimEnd()}\n${'─'.repeat(70)}`);
    console.log(`\n❌ PREFLIGHT FALLA en «${paso.id}». No subas a main.`);
    console.log(`   Reproduce con:  node ${paso.cmd}\n`);
    process.exit(1);
  }
}

const total = resultados.reduce((n, r) => n + r.secs, 0);
console.log(`\n✅ PREFLIGHT LIMPIO — ${resultados.length}/${resultados.length} en ${total}s.`);
if (soloRapido) console.log('   (modo --rapido: solo la suite; los recorridos NO se han corrido)');
else console.log('   Sin cubrir aquí: PocketBase real (race-e2e), carga (stress-live) y lo visual (shots).');
console.log('');
