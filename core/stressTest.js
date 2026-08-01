// Test de CARGA end-to-end contra el PocketBase REAL: simula N alumnos entrando
// y respondiendo A LA VEZ (live) y N intentos de tarea concurrentes. Caza los
// bugs de concurrencia que el driver local NO puede reproducir (lost-update,
// throughput de la Pi, colisiones de apodo). Corre igual en el navegador (botón
// del panel #/admin) y en node (tools/stress-live.mjs) — solo usa fetch.
//
// Crea datos DESECHABLES (sesión/tarea de prueba con prefijo `stress_`) y los
// BORRA al terminar, pase o falle. No toca actividades ni salas reales.
import { rid } from './ids.js';
import { pbEscape, pbFilterParam } from './pbFilter.js';
import { signedFetch } from './pbHttp.js';

const filt = (parts) => pbFilterParam(parts.join(' && '));
const sessFilter = (id) => `filter=${filt([`session='${pbEscape(id)}'`])}`;
const rnd = () => rid();

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
  // fetch CRUDO a propósito (sin token): replica lo que puede hacer un ALUMNO
  // anónimo — ese es el punto de la prueba de carga en live_*.
  const jpost = (coll, body, extraHeaders) => fetch(`${PB}/api/collections/${coll}/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) }, body: JSON.stringify(body),
  });
  // FIRMADO: crear/borrar la TAREA es acto del profe (ley de confianza §22 —
  // assignments exige sesión). El intento del alumno sigue yendo por jpost crudo.
  const jpostAuth = (coll, body) => signedFetch(`${PB}/api/collections/${coll}/records`, {
    method: 'POST', body: JSON.stringify(body),
  });
  // La LIMPIEZA es acto del profe: borrar filas de live_*/tareas exige sesión
  // desde la fase de reglas live (§22). Por eso va FIRMADO (el botón de #/admin
  // corre con el profe dentro). Las escrituras que simulan al ALUMNO siguen
  // crudas a propósito — son justo lo que hay que probar.
  const del = (coll, id) => signedFetch(`${PB}/api/collections/${coll}/records/${id}`, { method: 'DELETE' }).catch(() => {});
  // Borra en tandas de 15 para no reventar la Pi con 50 DELETE de golpe.
  const delMany = async (coll, ids) => { for (let i = 0; i < ids.length; i += 15) await Promise.all(ids.slice(i, i + 15).map(id => del(coll, id))); };
  const exists = async (coll) => { try { return (await fetch(`${PB}/api/collections/${coll}/records?perPage=1`)).status === 200; } catch { return false; } };

  const t0 = Date.now();
  const report = { n, ok: false, live: null, tasks: null, ms: 0, notes: [] };

  // ── Comprobar que las colecciones de la deuda A existen ────────────────────
  for (const c of ['live_sessions', 'live_players', 'live_answers', 'assignments', 'assignment_attempts']) {
    if (!(await exists(c))) {
      report.notes.push(`Falta la colección de base de datos "${c}". NO es una actividad: súbela con el botón "Crear colecciones" de esta misma página (sección PocketBase, arriba) — pide tu email y clave de superadmin de PocketBase. Es append-only, no toca nada existente.`);
      report.ms = Date.now() - t0;
      return report;
    }
  }

  // ── LIVE: crear sala → N joins → N×2 respuestas → verificar → limpiar ───────
  onLog(`Creando sala de prueba…`);
  const code = ('LOAD' + rnd()).toUpperCase();
  const activity = miniActivity(code);
  const state = { format: 'live', code, status: 'running', phase: 'question', currentItem: 0, players: [], answers: {}, _seq: 0 };
  const sessRes = await jpostAuth('live_sessions', { code, activity, state });   // crear sala = acto del profe (§22)
  const sessId = (await sessRes.json())?.id;
  if (!sessId) { report.notes.push('No se pudo crear la sala de prueba.'); report.ms = Date.now() - t0; return report; }

  // Join: replica joinSession (POST fila; el 400 del índice único → sufija) Y
  // REGISTRA LA CREDENCIAL DEL DISPOSITIVO (§22-4). Esto último faltaba: desde
  // que la regla de `live_answers` exige el secreto (`x_ww_claim`), un POST de
  // respuesta sin credencial es un 403 — la prueba de carga simulaba un alumno
  // que ya no existe y contaba 0 filas, culpando a la Pi de una regla.
  async function join(i) {
    const base = playerName(i);
    for (let s = 2; s <= 60; s++) {
      const name = s === 2 ? base : `${base} ${s}`;
      const r = await jpost('live_players', { session: sessId, name, user_id: `stress_${i}_${code}` });
      if (r.ok) {
        const id = (await r.json()).id;
        const secret = `cl_stress_${i}_${code}`;
        const c = await jpost('live_claims', { session: sessId, player: id, secret });
        return { id, secret: c.ok ? secret : null };
      }
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
  players.forEach((p, i) => {
    for (const item of [0, 1]) {
      const value = (i + item) % 3 === 0 ? '4' : 'Lima';   // mezcla de bien/mal
      answerCalls.push(jpost('live_answers',
        { session: sessId, player: p.id, item, value, ms: 100 + i, scored: false, correct: false, points: 0 },
        p.secret ? { 'X-WW-Claim': p.secret } : undefined)
        .then(r => r.ok ? true : r.status));
    }
  });
  const ansResults = await Promise.allSettled(answerCalls);
  const ansMs = Date.now() - tAns;
  // POR QUÉ falló, no solo cuántas: un 403 en todas es "la regla te rechaza"
  // (bug de la prueba o de las reglas) y no tiene NADA que ver con la carga; un
  // 0 filas mudo mandaba a mirar la Pi. Se cuenta cada estado por separado.
  const ansStatus = {};
  for (const r of ansResults) {
    const v = r.status === 'fulfilled' ? r.value : 'red';
    if (v !== true) ansStatus[v] = (ansStatus[v] || 0) + 1;
  }

  // Verificación server-side (cuenta real de filas).
  const lpRows = (await jget(`/api/collections/live_players/records?${sessFilter(sessId)}&perPage=500`))?.items || [];
  const laRows = (await jget(`/api/collections/live_answers/records?${sessFilter(sessId)}&perPage=1000`))?.items || [];
  const uniqNames = new Set(lpRows.map(r => r.name));
  report.live = {
    joinsOk: players.length, joinsFail: n - players.length, joinMs,
    playerRows: lpRows.length, uniqueNames: uniqNames.size,
    answersOk: ansResults.filter(r => r.status === 'fulfilled' && r.value === true).length, answerRows: laRows.length, ansMs,
    answerErrors: ansStatus,
    // PASA: 0 joins perdidos, apodos todos únicos, 2 respuestas por jugador que entró.
    pass: lpRows.length === n && uniqNames.size === n && laRows.length === players.length * 2,
    // La credencial del dispositivo (§22-4) es parte de "entrar": si no se pudo
    // registrar, las respuestas iban a ser rechazadas y hay que DECIRLO.
    claimsOk: players.filter(p => p.secret).length,
  };

  // Rechazo masivo por REGLA: no es carga, es que el cliente simulado no cumple
  // lo que el servidor exige. Se dice con nombre y apellido en vez de dejar un
  // "0 filas" que manda a mirar el hardware.
  const rejected = Object.entries(report.live.answerErrors || {});
  if (rejected.length && report.live.answerRows === 0) {
    report.notes.push(`Las ${players.length * 2} respuestas fueron RECHAZADAS por el servidor (${rejected.map(([k, v]) => `${v}×HTTP ${k}`).join(', ')}), no perdidas por carga.`
      + (report.live.claimsOk < players.length
        ? ' No se pudo registrar la credencial del dispositivo (live_claims): crea las colecciones desde este panel.'
        : ' Revisa las reglas de live_answers (§22-4 exige la cabecera X-WW-Claim).'));
  }

  onLog(`Limpiando sala de prueba…`);
  // OJO: `live_claims` de HOY no se puede borrar ni siendo profe (regla §22-4: si
  // se pudiera, se robaría el puesto de un jugador vivo). Las filas de la prueba
  // quedan huérfanas hasta la purga por retención (§25) — son inservibles sin su
  // sala, que sí se borra aquí.
  await delMany('live_answers', laRows.map(r => r.id));
  await delMany('live_players', lpRows.map(r => r.id));
  await del('live_sessions', sessId);

  // ── TAREAS: crear tarea → N intentos concurrentes → verificar → limpiar ────
  onLog(`Creando tarea de prueba y ${n} intentos simultáneos…`);
  const asgRes = await jpostAuth('assignments', { code: ('T' + rnd()).toUpperCase(), activity_id: activity.id, activity_snap: activity, title: 'Prueba de carga', status: 'open', max_attempts: 1 });
  const asgId = (await asgRes.json())?.id;
  if (asgId) {
    const tAtt = Date.now();
    const attempts = await Promise.allSettled(Array.from({ length: n }, (_, i) =>
      jpost('assignment_attempts', { assignment_id: asgId, activity_id: activity.id, user_id: `stress_${i}_${code}`, player_name: playerName(i), score_auto: i % 3, score_final: i % 3, max_score: 2, time_used: 10 + i, answers: [{ i: 0, v: '4', c: true, p: 1 }], attempt_no: 1, qid: `stress_q_${i}_${code}` })
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
    report.notes.push('No se pudo crear la tarea de prueba. Si las reglas L2 ya están aplicadas '
      + '(crear tarea exige sesión de profe), corre esta prueba desde #/admin con sesión iniciada.');
  }

  report.ms = Date.now() - t0;
  report.ok = !!(report.live?.pass && report.tasks?.pass);
  return report;
}
