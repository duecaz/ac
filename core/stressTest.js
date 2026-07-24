// Test de CARGA end-to-end contra el PocketBase REAL: simula N alumnos entrando
// y respondiendo A LA VEZ (live) y N intentos de tarea concurrentes. Caza los
// bugs de concurrencia que el driver local NO puede reproducir (lost-update,
// throughput de la Pi, colisiones de apodo). Corre igual en el navegador (botón
// del panel #/admin) y en node (tools/stress-live.mjs) — solo usa fetch.
//
// Crea datos DESECHABLES (sesión/tarea de prueba con prefijo `stress_`) y los
// BORRA al terminar, pase o falle. No toca actividades ni salas reales.
import { pbEscape, pbFilterParam } from './pbFilter.js';

const filt = (parts) => pbFilterParam(parts.join(' && '));
const sessFilter = (id) => `filter=${filt([`session='${pbEscape(id)}'`])}`;
const rnd = () => Math.random().toString(36).slice(2, 8);

// Actividad mínima (quiz de 2 ítems) para la sala/tarea de prueba.
function miniActivity(code) {
  return {
    id: `stress_${code}`, template: 'quiz', title: 'Prueba de carga',
    content: { items: [
      { id: 'q1', question: '2+2', answer: '4', options: ['3', '4', '5'], points: 1 },
      { id: 'q2', question: 'Capital de Perú', answer: 'Lima', options: ['Lima', 'Quito', 'Cusco'], points: 1 },
    ] },
    rules: {}, scoring: { pointsPerCorrect: 1 }, live: { maxPlayers: 1000, allowLateJoin: true },
  };
}

// Nombres realistas: mitad únicos, mitad repetidos (fuerzan el índice único).
const FIRST = ['Ana', 'Beto', 'Caro', 'Dani', 'Eva', 'Fito', 'Gaby', 'Hugo', 'Ivo', 'Jime', 'Karla', 'Leo', 'Mica', 'Nico', 'Ori', 'Pau', 'Rai', 'Sofi', 'Tavo', 'Uma'];
const playerName = (i) => i % 2 === 0 ? `${FIRST[i % FIRST.length]}${i}` : 'Alumno';   // los "Alumno" chocan a propósito

export async function runStressTest({ pbUrl, n = 30, onLog = () => {} } = {}) {
  const PB = String(pbUrl || '').replace(/\/$/, '');
  const jget = async (path) => (await fetch(`${PB}${path}`)).json();
  const jpost = (coll, body) => fetch(`${PB}/api/collections/${coll}/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const del = (coll, id) => fetch(`${PB}/api/collections/${coll}/records/${id}`, { method: 'DELETE' }).catch(() => {});
  // Borra en tandas de 15 para no reventar la Pi con 50 DELETE de golpe.
  const delMany = async (coll, ids) => { for (let i = 0; i < ids.length; i += 15) await Promise.all(ids.slice(i, i + 15).map(id => del(coll, id))); };
  const exists = async (coll) => { try { return (await fetch(`${PB}/api/collections/${coll}/records?perPage=1`)).status === 200; } catch { return false; } };

  const t0 = Date.now();
  const report = { n, ok: false, live: null, tasks: null, ms: 0, notes: [] };

  // ── Comprobar que las colecciones de la deuda A existen ────────────────────
  for (const c of ['live_sessions', 'live_players', 'live_answers', 'assignments', 'assignment_attempts']) {
    if (!(await exists(c))) {
      report.notes.push(`Falta la colección ${c} → corre "Crear colecciones" primero.`);
      report.ms = Date.now() - t0;
      return report;
    }
  }

  // ── LIVE: crear sala → N joins → N×2 respuestas → verificar → limpiar ───────
  onLog(`Creando sala de prueba…`);
  const code = ('LOAD' + rnd()).toUpperCase();
  const activity = miniActivity(code);
  const state = { format: 'live', code, status: 'running', phase: 'question', currentItem: 0, players: [], answers: {}, _seq: 0 };
  const sessRes = await jpost('live_sessions', { code, activity, state });
  const sessId = (await sessRes.json())?.id;
  if (!sessId) { report.notes.push('No se pudo crear la sala de prueba.'); report.ms = Date.now() - t0; return report; }

  // Join: replica joinSession (POST fila; el 400 del índice único → sufija).
  async function join(i) {
    const base = playerName(i);
    for (let s = 2; s <= 60; s++) {
      const name = s === 2 ? base : `${base} ${s}`;
      const r = await jpost('live_players', { session: sessId, name, user_id: `stress_${i}_${code}` });
      if (r.ok) return (await r.json()).id;
      if (r.status === 400) continue;   // apodo ocupado → sufija
      throw new Error(`join ${r.status}`);
    }
    throw new Error('sin hueco de apodo');
  }

  onLog(`Lanzando ${n} entradas simultáneas…`);
  const tJoin = Date.now();
  const joins = await Promise.allSettled(Array.from({ length: n }, (_, i) => join(i)));
  const players = joins.filter(j => j.status === 'fulfilled').map(j => j.value);
  const joinMs = Date.now() - tJoin;

  onLog(`Lanzando ${players.length * 2} respuestas simultáneas…`);
  const tAns = Date.now();
  const answerCalls = [];
  players.forEach((pid, i) => {
    for (const item of [0, 1]) {
      const value = (i + item) % 3 === 0 ? '4' : 'Lima';   // mezcla de bien/mal
      answerCalls.push(jpost('live_answers', { session: sessId, player: pid, item, value, ms: 100 + i, scored: false, correct: false, points: 0 })
        .then(r => r.ok));
    }
  });
  const ansResults = await Promise.allSettled(answerCalls);
  const ansMs = Date.now() - tAns;

  // Verificación server-side (cuenta real de filas).
  const lpRows = (await jget(`/api/collections/live_players/records?${sessFilter(sessId)}&perPage=500`))?.items || [];
  const laRows = (await jget(`/api/collections/live_answers/records?${sessFilter(sessId)}&perPage=1000`))?.items || [];
  const uniqNames = new Set(lpRows.map(r => r.name));
  report.live = {
    joinsOk: players.length, joinsFail: n - players.length, joinMs,
    playerRows: lpRows.length, uniqueNames: uniqNames.size,
    answersOk: ansResults.filter(r => r.status === 'fulfilled' && r.value).length, answerRows: laRows.length, ansMs,
    // PASA: 0 joins perdidos, apodos todos únicos, 2 respuestas por jugador que entró.
    pass: lpRows.length === n && uniqNames.size === n && laRows.length === players.length * 2,
  };

  onLog(`Limpiando sala de prueba…`);
  await delMany('live_answers', laRows.map(r => r.id));
  await delMany('live_players', lpRows.map(r => r.id));
  await del('live_sessions', sessId);

  // ── TAREAS: crear tarea → N intentos concurrentes → verificar → limpiar ────
  onLog(`Creando tarea de prueba y ${n} intentos simultáneos…`);
  const asgRes = await jpost('assignments', { code: ('T' + rnd()).toUpperCase(), activity_id: activity.id, activity_snap: activity, title: 'Prueba de carga', status: 'open', max_attempts: 1 });
  const asgId = (await asgRes.json())?.id;
  if (asgId) {
    const tAtt = Date.now();
    const attempts = await Promise.allSettled(Array.from({ length: n }, (_, i) =>
      jpost('assignment_attempts', { assignment_id: asgId, activity_id: activity.id, user_id: `stress_${i}_${code}`, player_name: playerName(i), score_auto: i % 3, score_final: i % 3, max_score: 2, time_used: 10 + i, answers: [{ i: 0, v: '4', c: true, p: 1 }] })
        .then(r => r.ok)));
    const attMs = Date.now() - tAtt;
    const aaRows = (await jget(`/api/collections/assignment_attempts/records?filter=${filt([`assignment_id='${pbEscape(asgId)}'`])}&perPage=500`))?.items || [];
    report.tasks = {
      attemptsOk: attempts.filter(r => r.status === 'fulfilled' && r.value).length, attemptRows: aaRows.length, attMs,
      pass: aaRows.length === n,
    };
    onLog(`Limpiando tarea de prueba…`);
    await delMany('assignment_attempts', aaRows.map(r => r.id));
    await del('assignments', asgId);
  } else {
    report.tasks = { pass: false };
    report.notes.push('No se pudo crear la tarea de prueba.');
  }

  report.ms = Date.now() - t0;
  report.ok = !!(report.live?.pass && report.tasks?.pass);
  return report;
}
