#!/usr/bin/env node
// Test de aceptación de la DEUDA A (lost-update del join) contra el PocketBase
// REAL. El driver `local` no puede reproducir el bug (no hay concurrencia de red),
// así que la única prueba honesta es N joins simultáneos contra la Pi.
//
// Uso (el PROFESOR crea antes la sala en la web y pega su PIN):
//   node tools/stress-live.mjs <PIN> [nJugadores=30] [PB_URL]
//
// Verifica: se crearon N filas en live_players, 0 pisadas, apodos TODOS únicos
// (el índice único (session,name) + el retry de sufijo). NO escribe respuestas
// (eso ya lo cubre live_answers); mide solo la tormenta de entradas.

const PIN = (process.argv[2] || '').toUpperCase();
const CLEAN = process.argv[3] === 'clean';
const N = CLEAN ? 0 : Number(process.argv[3] || 30);
const PB = (process.argv[4] || 'https://pb.lanube.uno').replace(/\/$/, '');

if (!PIN) {
  console.error('Uso: node tools/stress-live.mjs <PIN> [nJugadores=30|clean] [PB_URL]');
  process.exit(2);
}

const q = (s) => encodeURIComponent(s);

async function findSession() {
  const r = await fetch(`${PB}/api/collections/live_sessions/records?filter=${q(`code='${PIN}'`)}`);
  const j = await r.json();
  const rec = j?.items?.[0];
  if (!rec) throw new Error(`Sala ${PIN} no encontrada (¿la creaste en la web y sigue abierta?)`);
  return rec.id;
}

// Une un jugador replicando la lógica del adaptador: reintenta con sufijo si el
// índice único rechaza el apodo. Cada "alumno" usa un user_id distinto.
async function join(sessionId, base, userId) {
  for (let n = 2; n <= 45; n++) {
    const name = n === 2 ? base : `${base} ${n}`;
    const r = await fetch(`${PB}/api/collections/live_players/records`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionId, name, user_id: userId }),
    });
    if (r.ok) return (await r.json()).name;
    if (r.status === 400) continue;                 // apodo ocupado → sufija
    throw new Error(`POST ${r.status}: ${await r.text()}`);
  }
  throw new Error('sin hueco de apodo tras 44 intentos');
}

async function cleanRows(sessionId) {
  const r = await fetch(`${PB}/api/collections/live_players/records?filter=${q(`session='${sessionId}'`)}&perPage=500`);
  const rows = (await r.json())?.items || [];
  for (const row of rows) await fetch(`${PB}/api/collections/live_players/records/${row.id}`, { method: 'DELETE' });
  console.log(`Borradas ${rows.length} filas de live_players de la sala ${PIN}.`);
}

(async () => {
  const sessionId = await findSession();
  if (CLEAN) { await cleanRows(sessionId); process.exit(0); }
  console.log(`Sala ${PIN} → ${sessionId}. Lanzando ${N} entradas SIMULTÁNEAS…`);

  // Mitad con apodos DISTINTOS, mitad TODOS "Alumno" (fuerza el índice único).
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: N }, (_, i) => {
      const base = i % 2 === 0 ? `Alumno${i}` : 'Alumno';
      return join(sessionId, base, `stress_${i}_${PIN}`);
    })
  );
  const ms = Date.now() - t0;

  const okNames = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const fails = results.filter(r => r.status === 'rejected');

  // Cuenta real de filas en el servidor.
  const rowsRes = await fetch(`${PB}/api/collections/live_players/records?filter=${q(`session='${sessionId}'`)}&perPage=500`);
  const rows = (await rowsRes.json())?.items || [];
  const uniqueNames = new Set(rows.map(r => r.name));

  console.log(`\n— Resultado (${ms}ms) —`);
  console.log(`  entradas OK:        ${okNames.length}/${N}`);
  console.log(`  fallidas:           ${fails.length}`);
  console.log(`  filas en servidor:  ${rows.length}`);
  console.log(`  apodos únicos:      ${uniqueNames.size}`);
  if (fails.length) console.log('  primeros errores:', fails.slice(0, 3).map(f => f.reason.message));

  const pass = okNames.length === N && rows.length === N && uniqueNames.size === N;
  console.log(`\n${pass ? '✅ PASA' : '❌ FALLA'}: ${N} entradas → ${rows.length} filas, ${uniqueNames.size} apodos únicos, 0 pisadas.`);
  if (!pass) console.log('   (si filas < N: hubo lost-update; si únicos < filas: colisión de apodo no resuelta)');

  console.log(`\nLimpieza (borra las filas de prueba): node tools/stress-live.mjs ${PIN} clean`);
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
