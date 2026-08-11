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
  // `warn: true` = AVISO, no veredicto: algo va peor de lo ideal pero la
  // propiedad que decide la carrera se mantiene. Pintarlo en rojo entrenaría a
  // ignorar la luz (que es como se pierden los avisos que sí importan).
  const check = (cond, msg, detail = '', { warn = false } = {}) => {
    checks.push({ ok: !!cond, warn: warn && !cond, msg, detail: String(detail) });
  };
  const report = { ok: false, checks, notes: [], ms: 0 };
  const jpost = (coll, body, extra) => fetch(`${PB}/api/collections/${coll}/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(body),
  });

  let room = null;
  // El adaptador AVISA por consola cuando el sello no entra (R6). Se recogen
  // esos avisos durante la prueba para poder DECIR el motivo — si no, habría
  // que pedirle al profe que abra la consola en mitad de una clase.
  const avisos = [];
  const warnOriginal = console.warn;
  console.warn = (...a) => {
    try { avisos.push(a.map(x => (x && x.message) || (x && x.pb && JSON.stringify(x.pb)) || String(x)).join(' ')); } catch { /* nada */ }
    warnOriginal.apply(console, a);
  };
  let selloTrasAbrir = null;
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
    // El sello se mira DOS veces —justo aquí y al cerrar— porque distingue las
    // dos causas posibles sin adivinar: si no está ya, el PATCH del sello no
    // entra; si está ahora y falta al final, algo lo PISA después.
    selloTrasAbrir = (await fetchSessionBlob(room.id).catch(() => null))?.itemOpenedAt?.race ?? null;

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

    // Responder: MISMO cuerpo y mismos campos que `submitRaceAttempt` del
    // adaptador (upsert por el índice único session·player·item; al reintentar
    // se PATCHea `{value, correct}` y NUNCA `ms` — el tiempo es veredicto del
    // servidor, §22-1, y la regla rechaza la fila entera si el alumno lo manda.
    // Copiar ese detalle importa: mandarlo hacía que la corrección del TARDÓN
    // rebotara y el podio saliera 5/0 (cazado en la Pi, v1.51.433).
    const answerRow = async (p, item, value, correct) => {
      const hdr = p.secret ? { 'X-WW-Claim': p.secret } : undefined;
      const r = await jpost('live_answers', {
        session: room.id, player: p.id, item, value, ms: 300,
        scored: false, correct: !!correct, points: 0, v0: value, c0: !!correct,
      }, hdr);
      if (r.ok) return true;
      if (r.status !== 400) return false;                 // rechazo de regla: se ve en el check
      const q = await fetch(`${PB}/api/collections/live_answers/records?filter=${pbFilterParam(`session='${pbEscape(room.id)}' && player='${pbEscape(p.id)}' && item=${item}`)}&perPage=1`);
      const row = (await q.json())?.items?.[0];
      if (!row || !correct || row.correct === true || row.scored) return false;
      const pr = await fetch(`${PB}/api/collections/live_answers/records/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(hdr || {}) },
        body: JSON.stringify({ value, correct: true }),
      });
      return pr.ok;
    };

    onLog('VELOZ corre limpio…');
    let escrituras = 0, rechazos = 0;
    const anota = (ok) => { escrituras++; if (!ok) rechazos++; };
    for (let i = 0; i < N_ITEMS; i++) anota(await answerRow(veloz, i, String(i + 1), true));
    onLog(`…${GAP_MS / 1000} s de carrera…`);
    await new Promise(r => setTimeout(r, GAP_MS));
    onLog('TARDON falla y corrige, tarde…');
    for (let i = 0; i < N_ITEMS; i++) {
      anota(await answerRow(tardon, i, 'x', false));
      anota(await answerRow(tardon, i, String(i + 1), true));
    }
    // Si el SERVIDOR rechazó escrituras del alumno, el podio que salga después
    // es basura: se dice aquí en vez de dejar que aparezca como "no terminó".
    check(rechazos === 0, 'el servidor aceptó las respuestas de los dos alumnos',
      `${escrituras - rechazos}/${escrituras} escrituras`);

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
    // §22-1 · EL SELLO. Sin él, el tiempo de la carrera cae al `ms` que AFIRMA
    // el móvil — el podio dejaría de ser verificable. Se comprueba aparte
    // porque es la CAUSA: cuando falta, la hora de meta sale igual para todos
    // y el fallo aparece dos líneas más abajo, lejos de su motivo.
    const sello = blob?.itemOpenedAt?.race ?? null;
    const motivo = avisos.filter(a => a.includes('§22-1')).join(' · ');
    // ¿Tiene la colección los autodate? En PocketBase ≥0.23 `created`/`updated`
    // son campos declarados, no de sistema: si `live_sessions` se creó antes de
    // que los declaráramos, NO están, la respuesta del PATCH no trae `updated`
    // y el sello ni se intenta (silencio total). Se mira sobre la fila real de
    // la sala — sin superadmin y sin mandar a nadie al panel de PocketBase.
    let faltaCampo = null;
    try {
      const rec = await (await fetch(`${PB}/api/collections/live_sessions/records/${room.id}`)).json();
      if (rec && rec.id) faltaCampo = !('updated' in rec);
    } catch { /* sin lectura: se omite este dato, el resto del aviso vale igual */ }
    check(!!sello, 'el servidor SELLÓ la apertura de la carrera (§22-1)',
      sello ? String(sello)
        : `sin sello (tras abrir: ${selloTrasAbrir ? 'SÍ estaba → algo lo pisa después' : 'tampoco'})`
          + (faltaCampo === true
              ? ' · CAUSA: la colección live_sessions NO tiene el campo `updated` → corre «Crear colecciones» arriba (v1.51.438 o más) y vuelve a probar'
              : faltaCampo === false
                ? ' · la colección SÍ tiene `updated`, así que la causa es otra: avísame con esta línea'
                : '')
          + (motivo ? ` · motivo: ${motivo}` : '')
          + ' · mientras tanto los tiempos se miden desde la PRIMERA respuesta (el orden sigue siendo del servidor)',
      { warn: true });
    const caidoAlCliente = p1?.finishMs === 300 && p2?.finishMs === 300;
    check(p2?.finishMs > (p1?.finishMs ?? 0) + GAP_MS / 2,
      'la hora de meta refleja el retraso REAL del lento',
      caidoAlCliente ? 'los dos con el ms del cliente (300): no se midió en el servidor'
                     : `${p1?.finishMs} ms vs ${p2?.finishMs} ms`);
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
    console.warn = warnOriginal;   // la consola vuelve a ser de quien era
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
  // Los AVISOS no tumban la prueba: lo que decide es el veredicto.
  report.ok = checks.length > 0 && checks.every(c => c.ok || c.warn);
  report.avisos = checks.filter(c => c.warn).length;
  return report;
}
