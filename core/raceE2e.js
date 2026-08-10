// CARRERA E2E contra el PocketBase REAL, desde el navegador (botón de #/admin).
//
// Es la versión de botón de `tools/race-e2e.mjs` (que necesita Node+Chromium en
// un PC): dos alumnos SIMULADOS corren una carrera entera en una sala
// desechable y se comprueba lo que a mano no se ve — puntos planos, gana quien
// terminó antes según el reloj del SERVIDOR, marcador = podio, y la trampa
// (falsear la hora de meta con la credencial propia) REBOTA.
//
// La receta es la de `core/stressTest.js` (la excepción sancionada de §21):
// los actos del PROFE van por el adaptador (`core/liveTransport.js`, dueño de
// las salas) y los del ALUMNO simulado por fetch crudo con su credencial
// §22-4 — que es justo lo que hay que probar. Crea datos `stress_*` y los
// borra al terminar, pase o falle.
import { rid } from './ids.js';
import { pbEscape, pbFilterParam } from './pbFilter.js';
import { signedFetch } from './pbHttp.js';
import { createRoom, setSessionState, endSession, leaderboard, listAnswers, listPlayers, fetchSessionBlob } from './liveTransport.js';
import { rowsFromLiveAnswers } from './answerRows.js';
import { buildSessionTable } from './sessionModel.js';

const N_ITEMS = 5;
// Ventaja del rápido sobre el lento. El settle deriva la hora de meta del
// `created` del servidor, así que la diferencia REAL debe reaparecer en el
// podio — con margen (mitad), que la Pi también tarda lo suyo en escribir.
const GAP_MS = 6000;

export async function runRaceE2e({ pbUrl, onLog = () => {} } = {}) {
  const PB = String(pbUrl || '').replace(/\/$/, '');
  const t0 = Date.now();
  const checks = [];
  const check = (cond, msg, detail = '') => { checks.push({ ok: !!cond, msg, detail: String(detail) }); };
  const report = { ok: false, checks, notes: [], ms: 0 };
  const jpost = (coll, body, extra) => fetch(`${PB}/api/collections/${coll}/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(body),
  });

  let room = null;
  try {
    onLog('Creando sala de carrera desechable…');
    const items = Array.from({ length: N_ITEMS }, (_, i) => ({
      id: 'q' + i, question: `${i}+1`, answer: String(i + 1), options: [String(i + 1), 'x'], points: 1,
    }));
    room = await createRoom({
      id: `stress_race_${rid()}`, template: 'quiz', title: 'Carrera e2e', rules: {},
      live: { pointsModel: 'kahoot', questionTimer: 20, speedBonusMax: 1000 },
      scoring: { pointsPerCorrect: 1 }, content: { items },
    });
    await setSessionState(room.id, {
      status: 'running', phase: 'race', current_item: 0,
      started_at: new Date().toISOString(), deadline: null, end_policy: 'all', loop: 'race',
    });

    // Dos alumnos SIMULADOS: fila propia + credencial de dispositivo (§22-4),
    // el mismo camino que sus móviles. No se usa joinSession: en UN navegador
    // los dos reconectarían como el MISMO jugador (anon id compartido).
    const mkPlayer = async (name) => {
      const r = await jpost('live_players', { session: room.id, name, user_id: `stress_${name}_${room.code}` });
      if (!r.ok) throw new Error(`no se pudo unir ${name} (HTTP ${r.status})`);
      const id = (await r.json()).id;
      const secret = `cl_stress_${name}_${rid()}`;
      const c = await jpost('live_claims', { session: room.id, player: id, secret });
      return { id, name, secret: c.ok ? secret : null };
    };
    const veloz = await mkPlayer('VELOZ');
    const tardon = await mkPlayer('TARDON');
    check(veloz.id !== tardon.id && veloz.secret && tardon.secret,
      'dos alumnos simulados, cada uno con su fila y su credencial (§22-4)');

    // Responder = upsert (índice único session·player·item): POST y, si choca,
    // PATCH de la fila propia — el mismo baile que hace `postAnswer` en el
    // adaptador. Fallar y corregir es lo que hace la carrera de verdad (un
    // fallo vuelve a la cola) y el caso que ROMPÍA la hora de meta.
    const answerRow = async (p, item, value) => {
      const hdr = p.secret ? { 'X-WW-Claim': p.secret } : undefined;
      const r = await jpost('live_answers',
        { session: room.id, player: p.id, item, value, ms: 300, scored: false, correct: false, points: 0 }, hdr);
      if (r.ok || r.status !== 400) return;
      const q = await fetch(`${PB}/api/collections/live_answers/records?filter=${pbFilterParam(`session='${pbEscape(room.id)}' && player='${pbEscape(p.id)}' && item=${item}`)}&perPage=1`);
      const row = (await q.json())?.items?.[0];
      if (row) await fetch(`${PB}/api/collections/live_answers/records/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(hdr || {}) },
        body: JSON.stringify({ value, ms: 500 }),
      });
    };

    onLog('VELOZ corre limpio…');
    for (let i = 0; i < N_ITEMS; i++) await answerRow(veloz, i, String(i + 1));
    onLog(`…${GAP_MS / 1000} s de carrera…`);
    await new Promise(r => setTimeout(r, GAP_MS));
    onLog('TARDON falla y corrige, tarde…');
    for (let i = 0; i < N_ITEMS; i++) { await answerRow(tardon, i, 'x'); await answerRow(tardon, i, String(i + 1)); }

    onLog('Cerrando la sala (settle del servidor)…');
    await endSession(room.id);

    const blob = await fetchSessionBlob(room.id).catch(() => null);
    let rows = [];
    for (let i = 0; i < N_ITEMS; i++) {
      rows.push(...rowsFromLiveAnswers(await listAnswers(room.id, i), i,
        { itemOpenedAt: blob?.itemOpenedAt, phase: blob?.loop === 'race' ? 'race' : blob?.phase }));
    }
    const names = new Map((await listPlayers(room.id)).map(p => [p.id, p.name]));
    rows = rows.map(r => ({ ...r, name: names.get(r.player) || r.player }));
    const table = buildSessionTable(rows, N_ITEMS, {});
    const [p1, p2] = table.players;

    check(blob?.loop === 'race', 'la sala GUARDÓ su bucle (§26)', `loop=${blob?.loop}`);
    check(p1 && p2, 'el podio tiene a los dos alumnos', `${table.players.length} en tabla`);
    check(p1?.marks === N_ITEMS && p2?.marks === N_ITEMS,
      'los dos terminan con TODAS bien (un fallo vuelve a la cola)', `${p1?.marks}/${p2?.marks}`);
    check(p1?.total === N_ITEMS && p2?.total === N_ITEMS,
      'puntos PLANOS: el puntaje ES el nº de aciertos (sin bonus)', `${p1?.total}/${p2?.total}`);
    check(p1?.name === 'VELOZ', 'gana quien terminó ANTES según el servidor', `ganó ${p1?.name}`);
    check(p2?.finishMs > (p1?.finishMs ?? 0) + GAP_MS / 2,
      'la hora de meta refleja el retraso REAL del lento', `${p1?.finishMs} ms vs ${p2?.finishMs} ms`);
    const lb = await leaderboard(room.id, 10);
    check(lb[0]?.name === p1?.name, 'el MARCADOR y el PODIO dan el mismo ganador',
      `marcador=${lb[0]?.name} · podio=${p1?.name}`);

    // La TRAMPA, con la partida YA liquidada: falsear la hora de meta ({ms:0})
    // con la credencial PROPIA. PocketBase responde 404 (no 403) cuando la
    // regla de UPDATE no casa; lo que NUNCA puede salir es 200.
    onLog('Probando la trampa…');
    const q = await fetch(`${PB}/api/collections/live_answers/records?filter=${pbFilterParam(`session='${pbEscape(room.id)}' && player='${pbEscape(veloz.id)}'`)}&perPage=1`);
    const row = (await q.json())?.items?.[0];
    let st = 'sin fila';
    if (row) {
      st = (await fetch(`${PB}/api/collections/live_answers/records/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-WW-Claim': veloz.secret || '' },
        body: JSON.stringify({ ms: 0 }),
      })).status;
    }
    check(st === 403 || st === 404, 'falsear la hora de meta REBOTA (§22-1)',
      st === 200 ? 'dio 200 — reglas SIN aplicar: corre "Crear colecciones" arriba' : `HTTP ${st}`);
  } catch (e) {
    report.notes.push(`Prueba interrumpida: ${e?.message || e}`);
  } finally {
    // Limpieza SIEMPRE (best-effort con motivo: lo que quede lo purga la
    // retención de §25; las live_claims quedan huérfanas A PROPÓSITO — la
    // regla §22-4 impide borrarlas para que nadie robe el puesto de un vivo).
    if (room?.id) {
      onLog('Borrando la sala de prueba…');
      const wipe = async (coll) => {
        try {
          const r = await fetch(`${PB}/api/collections/${coll}/records?filter=${pbFilterParam(`session='${pbEscape(room.id)}'`)}&perPage=500`);
          for (const row of (await r.json())?.items || []) {
            await signedFetch(`${PB}/api/collections/${coll}/records/${row.id}`, { method: 'DELETE' }).catch(() => {});
          }
        } catch { /* best-effort: sin red aquí, la retención §25 purga el resto */ }
      };
      await wipe('live_answers');
      await wipe('live_players');
      await signedFetch(`${PB}/api/collections/live_sessions/records/${room.id}`, { method: 'DELETE' }).catch(() => {});
    }
  }
  report.ms = Date.now() - t0;
  report.ok = checks.length > 0 && checks.every(c => c.ok);
  return report;
}
