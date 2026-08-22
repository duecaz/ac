#!/usr/bin/env node
// RED DE SEGURIDAD Nº4 — LA CARRERA COMPLETA CONTRA POCKETBASE DE VERDAD.
//
//   node tools/race-e2e.mjs [PB_URL]
//   WW_EMAIL=profe@… WW_PASS=…  (nunca en la línea de comandos: van por entorno)
//
// POR QUÉ EXISTE. Entre v1.51.352 y v1.51.355 se colaron CUATRO fallos seguidos
// en el ranking de la carrera, y ninguno lo cazó la batería: todos vivían en la
// costura entre el settle, los autodate de PocketBase y el podio, que el driver
// local NO puede reproducir.
//   · el bonus de velocidad hacía ganar a quien acertaba 2 de 5;
//   · el tiempo lo ponía el móvil (y era el de la pregunta, no el de la carrera);
//   · el PATCH del settle pisaba `updated` y borraba la hora de meta de todos;
//   · el podio ordenaba por un campo que el alumno podía reescribir.
// Los descubrí con scripts de usar y tirar. Esto es aquello, pero como
// herramienta del repo: tres navegadores (tres dispositivos: con uno solo, los
// dos alumnos comparten id anónimo y reconectan como el MISMO jugador) que
// juegan una carrera entera y comprueban el resultado, incluida la trampa.
//
// Crea una sala DESECHABLE y la borra al terminar. No toca actividades reales.
// Requiere: Chromium preinstalado + python3 (igual que live-smoke).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8487);
const BASE = `http://127.0.0.1:${PORT}`;

// PB_URL por argumento, sin tocar el repo: se INTERCEPTA el módulo de config y
// se sirve otro. Editar `pocketbase.config.js` para probar en local es la vía
// rápida de commitear por accidente un apunte a 127.0.0.1 — y eso deja la web
// pública sin backend.
const PB = (process.argv[2] || '').replace(/\/$/, '')
  || (readFileSync(join(ROOT, 'pocketbase.config.js'), 'utf8').match(/PB_URL\s*=\s*'([^']+)'/) || [])[1];
const EMAIL = process.env.WW_EMAIL || 'profe@test.local';
const PASS = process.env.WW_PASS || 'profe12345';

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const log = (m) => console.log('  ·', m);
const fails = [];
const check = (cond, msg, detail = '') => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`); fails.push(msg); }
};

console.log(`Carrera e2e contra ${PB}\n`);
const browser = await chromium.launch();

// Un CONTEXTO por dispositivo: id anónimo propio, localStorage propio (ahí vive
// la credencial de §22-4). Con un solo contexto, el 2º "alumno" reconectaría
// como el primero — que es el comportamiento correcto y arruinaría la prueba.
async function device(role) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => {
    const m = String(e.message).split('\n')[0];
    if (!/net::ERR_|Failed to load resource|favicon/i.test(m)) fails.push(`${role}: ${m}`);
  });
  await page.route('**/pocketbase.config.js', r =>
    r.fulfill({ contentType: 'application/javascript', body: `export const PB_URL = '${PB}';\n` }));
  await page.goto(`${BASE}/${role === 'host' ? 'teacher' : 'student'}.html?backend=pocketbase`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('#app'), { timeout: 20000 });
  await page.evaluate(() => import('/core/registerTemplates.js'));
  return page;
}

const host = await device('host');
const ok = await host.evaluate(async ([email, pass]) => {
  const { signIn } = await import('/core/auth.js');
  try { await signIn(email, pass); return true; } catch (e) { return String(e.message || e); }
}, [EMAIL, PASS]);
if (ok !== true) {
  console.error(`\n❌ No se pudo entrar como profe (${ok}).`);
  console.error('   Pasa las credenciales por ENTORNO: WW_EMAIL=… WW_PASS=… node tools/race-e2e.mjs');
  await browser.close(); bye(2);
}
log('profe con sesión');

// ── La sala: 5 preguntas, bucle CARRERA declarado en la sala (§26) ──────────
const room = await host.evaluate(async () => {
  const { createRoom, setSessionState } = await import('/core/liveTransport.js');
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: 'q' + i, question: `${i}+1`, answer: String(i + 1), options: [String(i + 1), 'x'], points: 1,
  }));
  const r = await createRoom({
    id: 'e2e_race', template: 'quiz', title: 'Carrera e2e', rules: {},
    live: { pointsModel: 'velocidad', questionTimer: 20, speedBonusMax: 1000 },
    scoring: { pointsPerCorrect: 1 }, content: { items },
  });
  await setSessionState(r.id, {
    status: 'running', phase: 'race', current_item: 0,
    started_at: new Date().toLocaleString('sv').replace(' ', 'T') + 'Z',
    deadline: null, end_policy: 'all', loop: 'race',
  });
  return r;
});
log(`sala creada · PIN ${room.code}`);

const enterRoom = (page, nick) => page.evaluate(async ([code, nick]) => {
  const { joinSession } = await import('/core/liveTransport.js');
  return await joinSession(code, nick);
}, [room.code, nick]);

const veloz = await device('veloz');
const tardon = await device('tardon');
const vId = await enterRoom(veloz, 'VELOZ');
const tId = await enterRoom(tardon, 'TARDON');
check(vId.playerId && tId.playerId && vId.playerId !== tId.playerId,
  'dos dispositivos = dos jugadores distintos');

// El alumno responde por el MISMO camino que su móvil (submitRaceAttempt), así
// que pasa por la credencial del dispositivo y por las reglas de PocketBase.
const answer = (page, pid, from, to, wrongFirst = false) => page.evaluate(async ([sid, pid, from, to, wrongFirst]) => {
  const { submitRaceAttempt } = await import('/core/liveTransport.js');
  for (let i = from; i < to; i++) {
    // Fallar y corregir: es lo que hace la carrera de verdad (un fallo vuelve a
    // la cola), y el caso que rompía la hora de meta (`created` = 1er intento).
    if (wrongFirst) await submitRaceAttempt(sid, pid, i, 'x', false, 0, 300);
    await submitRaceAttempt(sid, pid, i, String(i + 1), true, 1, 500);
  }
}, [room.id, pid, from, to, wrongFirst]);

await answer(veloz, vId.playerId, 0, 5);                 // limpio y ya
log('VELOZ terminó las 5');
await new Promise(r => setTimeout(r, 12000));            // …12 s de carrera…
await answer(tardon, tId.playerId, 0, 5, true);          // falla y corrige, tarde
log('TARDON terminó las 5 (fallando y corrigiendo) 12 s después');

// ── §22-4 · LA TRAMPA: falsear la hora de meta con la credencial propia ─────
// Antes de cerrar, y otra vez después: la fila la escribe el alumno, así que la
// regla es lo único que lo impide. Es el agujero que cerró v1.51.358.
const cheat = async () => veloz.evaluate(async ([pb, sid, pid]) => {
  const secret = localStorage.getItem(`ww.claim.${sid}`);
  const r = await fetch(`${pb}/api/collections/live_answers/records?filter=` +
    encodeURIComponent(`session='${sid}' && player='${pid}'`) + '&perPage=1');
  const row = (await r.json())?.items?.[0];
  if (!row) return { status: 'sin fila' };
  const p = await fetch(`${pb}/api/collections/live_answers/records/${row.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-WW-Claim': secret || '' },
    body: JSON.stringify({ ms: 0 }),
  });
  return { status: p.status, hadSecret: !!secret };
}, [PB, room.id, vId.playerId]);

// ── Cerrar: el settle liquida y escribe el tiempo del SERVIDOR ──────────────
const out = await host.evaluate(async ([id]) => {
  const { endSession, leaderboard, listAnswers, listPlayers, fetchSessionBlob } = await import('/core/liveTransport.js');
  const { rowsFromLiveAnswers } = await import('/core/answerRows.js');
  const { buildSessionTable } = await import('/core/sessionModel.js');
  await endSession(id);
  const blob = await fetchSessionBlob(id).catch(() => null);
  let rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push(...rowsFromLiveAnswers(await listAnswers(id, i), i,
      { itemOpenedAt: blob?.itemOpenedAt, phase: blob?.loop === 'race' ? 'race' : blob?.phase }));
  }
  const names = new Map((await listPlayers(id)).map(p => [p.id, p.name]));
  rows = rows.map(r => ({ ...r, name: names.get(r.player) || r.player }));
  const table = buildSessionTable(rows, 5, {});
  return {
    loop: blob?.loop,
    lb: await leaderboard(id, 10),
    podio: table.players.map(p => ({ name: p.name, marks: p.marks, total: p.total, finishMs: p.finishMs })),
  };
}, [room.id]);

check(out.loop === 'race', 'la sala GUARDÓ su bucle (§26)', `loop=${out.loop}`);

const [p1, p2] = out.podio;
check(p1 && p2, 'el podio tiene a los dos alumnos');
check(p1?.marks === 5 && p2?.marks === 5, 'los dos terminan con las 5 bien (un fallo vuelve a la cola)');
check(p1?.total === 5 && p2?.total === 5, 'puntos PLANOS: el puntaje ES el nº de aciertos', `${p1?.total} / ${p2?.total}`);
check(p1?.name === 'VELOZ', 'GANA QUIEN TERMINÓ ANTES (con todas bien)', `ganó ${p1?.name}`);
check(p1?.finishMs > 0 && p1.finishMs < 10000, 'la meta del rápido es de la carrera, no de su última pregunta', `${p1?.finishMs} ms`);
check(p2?.finishMs > 10000, 'la meta del lento refleja sus 12 s de más', `${p2?.finishMs} ms`);
check(out.lb[0]?.name === p1?.name, 'el MARCADOR y el PODIO dan el mismo ganador',
  `marcador=${out.lb[0]?.name} podio=${p1?.name}`);

// La trampa se intenta con la partida YA LIQUIDADA, que es el caso que cerró
// v1.51.358: la fila lleva el tiempo del servidor y el alumno conserva su
// credencial. (Antes del settle no se prueba: el PATCH pisaría `updated`, de
// donde el settle deriva el tiempo, y contaminaría la medición.)
const cheatAfter = await cheat();
check(cheatAfter.hadSecret !== false, 'el alumno tiene su credencial de dispositivo (§22-4)');
// PocketBase responde 404 (no 403) cuando una regla de UPDATE no casa: no
// confirma que la fila exista. El simulador de `tests/liveRules.test.mjs` usa
// 403; contra el servidor real, rechazo = 403 o 404. Lo que NUNCA puede salir
// es 200.
check(cheatAfter.status === 403 || cheatAfter.status === 404,
  'falsear la hora de meta ({ms:0}, credencial propia) → rechazado (§22-1)',
  cheatAfter.status === 200
    ? 'dio 200 — ESTE PocketBase NO tiene las reglas al día: #/admin → "Crear colecciones"'
    : `dio ${cheatAfter.status}`);

// ── Limpieza: la sala de prueba no se queda en la base ──────────────────────
await host.evaluate(async ([pb, id]) => {
  const { signedFetch } = await import('/core/pbHttp.js');
  const del = async (coll, filter) => {
    const r = await fetch(`${pb}/api/collections/${coll}/records?filter=${encodeURIComponent(filter)}&perPage=500`);
    for (const row of (await r.json())?.items || []) {
      await signedFetch(`${pb}/api/collections/${coll}/records/${row.id}`, { method: 'DELETE' }).catch(() => {});
    }
  };
  await del('live_answers', `session='${id}'`);
  await del('live_players', `session='${id}'`);
  await signedFetch(`${pb}/api/collections/live_sessions/records/${id}`, { method: 'DELETE' }).catch(() => {});
}, [PB, room.id]).catch(() => {});
log('sala de prueba borrada');

await browser.close();
if (fails.length) {
  console.log(`\n❌ CARRERA E2E FALLA (${fails.length}):`);
  for (const f of fails) console.log('   ·', f);
  bye(1);
}
console.log('\n✅ CARRERA E2E PASA — puntos planos · gana quien terminó antes · meta del servidor · marcador = podio · la trampa rebota.');
bye(0);
