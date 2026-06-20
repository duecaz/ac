// Self-tests EJECUTABLES EN EL NAVEGADOR para la página Admin.
// Cubre todos los módulos de lógica pura del core + el motor de sesión.
// No necesita jsdom — corre en el browser real (localStorage, EventTarget
// y DOM disponibles). Los tests de Node (tests/*.mjs) son la suite CI
// completa; esto es humo en vivo que verifica que el deploy es correcto.
import { listTemplates, getTemplate } from './registry.js';
import { modesForTemplate } from './modes.js';
import { templateCapabilities } from './modeMatrix.js';
import { createSession, FORMATS, sessionItems, isVsCompatible } from '../kernel/session/engine.js';
import { createLiveRoom } from '../kernel/live/engine.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';
import { lsGet, lsSet, lsDel } from './ls.js';
import { html, escapeHtml } from './html.js';
import { migrate, normalize, activityItemCount, newActivityId } from './migrate.js';
import { isVowel, applyTilde, scoreMarks } from './textMarks.js';
import { mergeRemote } from './storageMerge.js';
import { compileRoute, matchRoute } from './routing.js';
import { emit, listen } from './events.js';
import { acquire } from './lifecycle.js';
import { normalizeCode, isPastDue, attemptsRemaining, assignmentGate } from './assignmentRules.js';

// ─── helpers ─────────────────────────────────────────────────────────────────
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
function deepEq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}

// Actividad quiz sintética (no toca storage) para las simulaciones.
function quizActivity() {
  return {
    id: 'selftest', template: 'quiz',
    scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 },
    live: { maxPlayers: 10, allowLateJoin: true, pointsModel: 'flat' },
    content: { items: [
      { id: 'q1', question: '2+2',  answer: '4', options: ['3', '4', '5'],    points: 1 },
      { id: 'q2', question: '3×3',  answer: '9', options: ['6', '9', '12'],   points: 2 },
      { id: 'q3', question: '10-4', answer: '6', options: ['5', '6', '7'],    points: 1 },
    ] },
  };
}
const wrongFor = (it) => it.options.find(o => o !== it.answer);

// ─── test cases ──────────────────────────────────────────────────────────────
const TESTS = [

  // ── ls.js ──────────────────────────────────────────────────────────────────
  { group: 'ls', name: 'lsGet/lsSet/lsDel round-trip', fn: () => {
    lsSet('_st_rw', 'hello');
    eq(lsGet('_st_rw'), 'hello', 'lsGet recupera el valor');
    lsDel('_st_rw');
    eq(lsGet('_st_rw'), null, 'lsDel borra la clave');
  } },
  { group: 'ls', name: 'lsGet usa fallback en clave ausente', fn: () => {
    eq(lsGet('__no_existe__', 'fb'), 'fb', 'fallback si no existe');
    eq(lsGet('__no_existe__'), null, 'null si no hay fallback');
  } },

  // ── html.js ────────────────────────────────────────────────────────────────
  { group: 'HTML', name: 'tagged html: valores, null/false, arrays, cero', fn: () => {
    eq(html`a${1}b`, 'a1b', 'interpolación básica');
    eq(html`x${null}y${false}z`, 'xyz', 'null/false = vacío');
    eq(html`${['a', 'b']}`, 'ab', 'arrays se concatenan');
    eq(html`${0}`, '0', 'cero no es vacío');
  } },
  { group: 'HTML', name: 'escapeHtml: entidades, null, número', fn: () => {
    eq(escapeHtml('<b>"a"&\''), '&lt;b&gt;&quot;a&quot;&amp;&#39;', '5 entidades');
    eq(escapeHtml(null), '', 'null → cadena vacía');
    eq(escapeHtml(42), '42', 'número → string');
  } },

  // ── migrate.js ─────────────────────────────────────────────────────────────
  { group: 'Migrate', name: 'newActivityId: formato y unicidad', fn: () => {
    const id = newActivityId();
    assert(id.startsWith('act_'), 'comienza con act_');
    eq(id.length, 14, 'longitud correcta (act_ + 10)');
    assert(newActivityId() !== newActivityId(), 'IDs únicos');
  } },
  { group: 'Migrate', name: 'normalize: defaults para template desconocido', fn: () => {
    const n = normalize({ id: 'x', template: '_unknown_', createdAt: 'c', updatedAt: 'u' });
    eq(n.id, 'x', 'id preservado');
    eq(n.schemaVersion, 4, 'schemaVersion 4');
    assert(Array.isArray(n.tags), 'tags es array');
    assert(typeof n.rules === 'object', 'rules rellenado');
  } },
  { group: 'Migrate', name: 'activityItemCount: lee items/passages/etc.', fn: () => {
    eq(activityItemCount({ content: { items: [1, 2, 3] } }), 3, 'items');
    eq(activityItemCount({ content: { passages: ['a', 'b'] } }), 2, 'passages');
    eq(activityItemCount({ content: { pairs: [{}, {}] } }), 2, 'pairs');
    eq(activityItemCount({ content: {} }), 0, 'vacío → 0');
  } },
  { group: 'Migrate', name: 'migrate: sube de v1 a v4 en cadena', fn: () => {
    const old = { id: 'v1act', template: 'quiz', items: [{ answer: 'x' }] };
    const a = migrate(old);
    eq(a.schemaVersion, 4, 'sube hasta v4');
    assert(Array.isArray(a.content.items), 'content.items migrado');
    assert(typeof a.live === 'object', 'live añadido');
  } },

  // ── textMarks.js ───────────────────────────────────────────────────────────
  { group: 'TextMarks', name: 'isVowel y applyTilde', fn: () => {
    assert(isVowel('a') && isVowel('e') && isVowel('o') && isVowel('u') && isVowel('i'), 'vocales');
    assert(isVowel('A') && isVowel('E'), 'vocales mayúsculas');
    assert(!isVowel('b') && !isVowel('n'), 'consonantes → false');
    eq(applyTilde('a'), 'á', 'a → á');
    eq(applyTilde('E'), 'É', 'E → É');
    eq(applyTilde('o'), 'ó', 'o → ó');
  } },
  { group: 'TextMarks', name: 'scoreMarks: exacto / falta / extra', fn: () => {
    const p = { text: 'cancion', marks: [{ pos: 4, kind: 'tilde' }] };
    const act = { scoring: { pointsPerCorrect: 1 } };
    const ok = scoreMarks([4], p, ['tilde'], act);
    assert(ok.correct && ok.points === 1, 'marca exacta → acierto');
    assert(!scoreMarks([], p, ['tilde'], act).correct, 'sin marcar → fallo');
    assert(!scoreMarks([2, 4], p, ['tilde'], act).correct, 'marca extra → fallo');
  } },

  // ── storageMerge.js ────────────────────────────────────────────────────────
  { group: 'StorageMerge', name: 'remote más nuevo gana', fn: () => {
    const local  = { a1: { id: 'a1', updatedAt: '2025-01-01' } };
    const remote = [{ id: 'a1', data: { id: 'a1', updatedAt: '2025-06-01', title: 'remoto' } }];
    const m = mergeRemote(local, remote, x => x);
    eq(m.a1.title, 'remoto', 'remote más nuevo sobrescribe');
  } },
  { group: 'StorageMerge', name: 'local más nuevo gana', fn: () => {
    const local  = { a1: { id: 'a1', updatedAt: '2026-01-01', title: 'local' } };
    const remote = [{ id: 'a1', data: { id: 'a1', updatedAt: '2025-01-01' } }];
    const m = mergeRemote(local, remote, x => x);
    eq(m.a1.title, 'local', 'local más nuevo no es sobreescrito');
  } },
  { group: 'StorageMerge', name: 'row remoto nuevo se añade', fn: () => {
    const local  = {};
    const remote = [{ id: 'b1', data: { id: 'b1', title: 'nuevo' } }];
    const m = mergeRemote(local, remote, x => x);
    eq(m.b1.title, 'nuevo', 'fila nueva de remote se incorpora');
  } },

  // ── routing.js ─────────────────────────────────────────────────────────────
  { group: 'Routing', name: 'compileRoute + matchRoute extraen params', fn: () => {
    const toRoute = (p) => { const c = compileRoute(p); return { ...c, handler: () => p }; };
    const routes = ['#/home', '#/edit/:id', '#/play/:id'].map(toRoute);
    const hit = matchRoute('#/edit/act_abc', routes);
    assert(hit !== null, 'encuentra la ruta');
    eq(hit.params.id, 'act_abc', 'extrae :id correctamente');
    assert(matchRoute('#/nope', routes) === null, 'ruta desconocida → null');
    assert(matchRoute('#/home', routes) !== null, 'ruta estática #/home');
  } },

  // ── events.js ──────────────────────────────────────────────────────────────
  { group: 'Events', name: 'emit/listen y unsubscribe limpio', fn: () => {
    let received = null;
    const off = listen('_selftest_bus', d => { received = d; });
    emit('_selftest_bus', { v: 42 });
    eq(received?.v, 42, 'listener recibe el detail');
    off();
    emit('_selftest_bus', { v: 99 });
    eq(received?.v, 42, 'tras unsubscribe no recibe más');
  } },

  // ── lifecycle.js ───────────────────────────────────────────────────────────
  { group: 'Lifecycle', name: 're-acquire dispone el batch anterior', fn: () => {
    const log = [];
    const ctx = acquire('_selftest_lc1');
    ctx.add(() => log.push('disposed'));
    acquire('_selftest_lc1');
    assert(log.includes('disposed'), 'disposer ejecutado al re-adquirir');
  } },
  { group: 'Lifecycle', name: 'un disposer que lanza no bloquea los demás', fn: () => {
    const log = [];
    const ctx = acquire('_selftest_lc2');
    ctx.add(() => log.push('after'));
    ctx.add(() => { throw new Error('boom'); });
    acquire('_selftest_lc2'); // LIFO: boom primero, after segundo
    assert(log.includes('after'), '"after" se ejecutó a pesar del boom');
  } },

  // ── assignmentRules.js ─────────────────────────────────────────────────────
  { group: 'Assignments', name: 'normalizeCode, isPastDue, attemptsRemaining', fn: () => {
    eq(normalizeCode(' ab12 '), 'AB12', 'trim + mayúsculas');
    assert(isPastDue('2000-01-01T00:00:00Z'), 'fecha pasada → vencida');
    assert(!isPastDue('2099-01-01T00:00:00Z'), 'fecha futura → vigente');
    assert(!isPastDue(null), 'sin fecha → siempre vigente');
    eq(attemptsRemaining(3, 2), 1, '3 max − 2 = 1');
    eq(attemptsRemaining(3, 3), 0, 'agotado → 0');
    eq(attemptsRemaining(3, 5), 0, 'nunca negativo');
  } },
  { group: 'Assignments', name: 'assignmentGate: notFound/closed/pastDue/noAttempts', fn: () => {
    eq(assignmentGate(null, 0).reason, 'notFound', 'null → notFound');
    eq(assignmentGate({ status: 'closed', max_attempts: 3 }, 0).reason, 'closed', 'cerrado');
    eq(assignmentGate({ due_at: '2000-01-01', max_attempts: 3 }, 0).reason, 'pastDue', 'vencido');
    eq(assignmentGate({ max_attempts: 2 }, 2).reason, 'noAttemptsLeft', 'sin intentos');
    assert(assignmentGate({ max_attempts: 3 }, 1).allowed, 'normal → allowed');
  } },

  // ── Registro ───────────────────────────────────────────────────────────────
  { group: 'Registro', name: 'hay plantillas registradas', fn: () => {
    assert(listTemplates().length > 0, 'registro vacío');
  } },
  { group: 'Registro', name: 'quiz tiene todos los modos', fn: () => {
    const T = getTemplate('quiz');
    assert(T, 'quiz no registrado');
    const ids = modesForTemplate(T).map(m => m.id);
    for (const need of ['solo', 'vs', 'teams', 'live', 'task'])
      assert(ids.includes(need), `quiz no ofrece ${need}`);
  } },

  // ── Panel ──────────────────────────────────────────────────────────────────
  { group: 'Panel', name: 'la matriz de capacidad es coherente', fn: () => {
    const caps = templateCapabilities();
    assert(caps.length > 0, 'matriz vacía');
    const q = caps.find(c => c.name === 'quiz');
    assert(q?.modes.find(m => m.id === 'vs')?.supported, 'quiz debería soportar VS en la matriz');
  } },

  // ── Scorer ─────────────────────────────────────────────────────────────────
  { group: 'Scorer', name: 'quiz puntúa acierto y fallo correctamente', fn: () => {
    const it = { answer: '4', options: ['3', '4'], points: 1 };
    const ok = scoreQuizSubmission({ value: '4', item: it, activity: { scoring: {} } });
    const ko = scoreQuizSubmission({ value: '3', item: it, activity: { scoring: {} } });
    assert(ok.correct === true && ok.points >= 1, 'acierto mal puntuado');
    assert(ko.correct === false, 'fallo mal puntuado');
  } },

  // ── VS ─────────────────────────────────────────────────────────────────────
  { group: 'VS', name: 'ambos lados completan; gana más puntos', fn: () => {
    const a = quizActivity();
    assert(isVsCompatible(a), 'quiz debe ser VS-compatible');
    const items = sessionItems(a);
    const s = createSession(a, { format: FORMATS.VS, left: 'Ana', right: 'Beto' });
    s.start();
    let guard = 0;
    while (!s.standings().finished && guard++ < 50) {
      const st = s.standings();
      if (!st.left.done)  s.answer('left',  items[st.left.cursor].answer);
      if (!st.right.done) s.answer('right', wrongFor(items[st.right.cursor]));
    }
    const fin = s.standings();
    eq(s.status, 'ended', 'duelo terminó');
    eq(fin.leader, 'left', 'gana Ana');
    eq(fin.left.cursor,  items.length, 'Ana completó todos sus ítems');
    eq(fin.right.cursor, items.length, 'Beto también completó sus ítems');
    eq(fin.right.score, 0, 'Beto falló todo → 0 puntos');
  } },

  // ── En vivo ────────────────────────────────────────────────────────────────
  { group: 'En vivo', name: '3 alumnos virtuales — ranking final correcto', fn: () => {
    const a = quizActivity();
    const items = sessionItems(a);
    const room = createLiveRoom(a, { code: 'SELFT1' });
    const studs = [
      { p: room.join('u-a', 'Ana'),  skill: () => true },
      { p: room.join('u-b', 'Bea'),  skill: (i) => i === 0 },
      { p: room.join('u-c', 'Caro'), skill: () => false },
    ];
    room.dispatch('start');
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      studs.forEach((s, k) => room.submit(s.p.id, i, s.skill(i) ? it.answer : wrongFor(it), 300 + k * 50));
      room.dispatch('reveal');
      if (i < items.length - 1) { room.dispatch('leaderboard'); room.dispatch('next'); }
      else room.dispatch('next');
    }
    assert(room.phase === 'ended', 'la partida no terminó');
    const order = room.leaderboard().map(r => `${r.name}:${r.score}`).join(',');
    eq(order, 'Ana:4,Bea:1,Caro:0', 'ranking final inesperado: ' + order);
  } },
];

/**
 * Ejecuta los tests uno a uno. Por cada resultado llama a onResult si se
 * proporcionó (para streaming en vivo en la UI). Devuelve el array completo.
 * @param {(r:{group,name,pass,error?})=>void} [onResult]
 */
export async function runSelfTests(onResult) {
  const out = [];
  for (const t of TESTS) {
    let r;
    try {
      await t.fn();
      r = { group: t.group, name: t.name, pass: true };
    } catch (e) {
      r = { group: t.group, name: t.name, pass: false, error: e.message };
    }
    out.push(r);
    onResult?.(r, out.length, TESTS.length);
  }
  return out;
}

export const TOTAL_TESTS = TESTS.length;
