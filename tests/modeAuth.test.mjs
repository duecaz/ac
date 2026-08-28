// AUTORIDAD DE MODO — "avisar ANTES", corolario de la ley de confianza (§22).
//
// Por qué existe: con la fase de reglas live, ABRIR una sala o crear una tarea
// exige sesión de profe (el servidor solo distingue host de alumno por el token).
// Sin este test, el aviso vive en la UI y se cae en silencio de dos formas:
//   1) el botón se ofrece igual y el profe descubre el 403 con la clase delante;
//   2) alguien "arregla" el 403 ESCONDIENDO el modo, y el profe nunca sabe que
//      existe En vivo.
// Lo que se fija aquí: quién exige sesión se DERIVA de las reglas reales
// (HOST_ONLY_WRITES), hay UNA sola redacción para el aviso, la tarjeta lo pinta
// con candado (no lo esconde) y el router gatea las rutas que dirigen.
//
// Run: node tests/modeAuth.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerTemplate } from '../core/registry.js';
import { MODE_DEFS, modeNeedsAuth, modeAuthHint, lockedModes } from '../core/modes.js';
import { modeStripHtml } from '../core/activityCard.js';
import { HOST_ONLY_WRITES } from '../core/pbRules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const ok = (msg) => { passed++; console.log('  ✓', msg); };

registerTemplate({
  meta: { name: 'ma_full', label: 'Full', contentModel: 'qa', modes: { solo: true, live: true, async: true } },
  renderPlayer() {}, renderEditor() {},
  renderRound() {}, getRoundPayload() {}, scoreSubmission() { return { correct: true, points: 1 }; }
});
const ACT = { id: 'a1', template: 'ma_full', content: { items: [{ q: '1', a: '1' }, { q: '2', a: '2' }] } };

// ── 1. Quién exige sesión se DERIVA de las reglas, no de una lista paralela ──
assert.ok(modeNeedsAuth('live'), 'En vivo exige sesión (escribe live_sessions)');
assert.ok(modeNeedsAuth('task'), 'Tarea exige sesión (escribe assignments)');
for (const id of ['solo', 'vs', 'teams']) {
  assert.ok(!modeNeedsAuth(id), `${id} NO exige sesión (pizarra compartida, no persiste)`);
}
ok('modeNeedsAuth: solo Live/Tarea (los modos que abren sesión compartida)');

// Anti-divergencia en los DOS sentidos: cada colección host-only tiene su modo
// dueño del aviso, y ningún modo declara escribir en algo que no sea host-only.
const declared = MODE_DEFS.filter(m => m.writes).map(m => m.writes);
for (const coll of HOST_ONLY_WRITES) {
  assert.ok(declared.includes(coll),
    `HOST_ONLY_WRITES incluye "${coll}" pero ningún MODE_DEF declara writes:"${coll}" → nadie avisará al profe antes del 403`);
}
for (const m of MODE_DEFS.filter(m => m.writes)) {
  assert.ok(HOST_ONLY_WRITES.includes(m.writes),
    `el modo "${m.id}" declara writes:"${m.writes}", que ya NO es host-only en core/pbRules.js → el aviso pediría sesión sin motivo`);
}
ok('anti-divergencia: HOST_ONLY_WRITES ↔ MODE_DEFS.writes (en ambos sentidos)');

// ── 2. UNA sola redacción del aviso ─────────────────────────────────────────
for (const id of ['live', 'task']) {
  const hint = modeAuthHint(id);
  assert.match(hint, /^Inicia sesión para .+/, `el aviso de ${id} debe decir qué se va a hacer: ${JSON.stringify(hint)}`);
}
assert.strictEqual(modeAuthHint('solo'), '', 'un modo libre no tiene aviso de sesión');
assert.notStrictEqual(modeAuthHint('live'), modeAuthHint('task'), 'cada acto de profe se nombra por su nombre');
ok('modeAuthHint: frase concreta por modo (y vacía en los libres)');

assert.deepStrictEqual(lockedModes(false).map(m => m.id), ['live', 'task'], 'sin sesión se bloquean Live y Tarea');
assert.deepStrictEqual(lockedModes(true), [], 'con sesión no se bloquea ninguno');
ok('lockedModes(authed) refleja el estado de sesión');

// ── 3. La tarjeta lo PINTA con candado, no lo esconde ───────────────────────
const locked = modeStripHtml(ACT, { includeManage: true, authed: false });
assert.match(locked, /data-mode="live"/, 'sin sesión, En vivo SIGUE en la tira (esconderlo enseña que no existe)');
assert.match(locked, /data-mode="task"/, 'sin sesión, Tarea SIGUE en la tira');
assert.match(locked, /data-locked="1"/, 'el botón bloqueado se marca data-locked para que el handler lo intercepte');
assert.ok(locked.includes('bi-lock-fill'), 'el botón bloqueado muestra candado');
assert.ok(locked.includes(modeAuthHint('live')), 'el tooltip del botón lleva la MISMA frase que el modal');
// Los jugables no se tocan nunca.
for (const modo of ['solo', 'vs', 'teams']) {
  assert.ok(locked.includes(`data-mode="${modo}"`), `${modo} sigue disponible sin sesión (jugar es libre)`);
}
const strip = locked.split('data-mode="solo"')[1].split('data-mode="live"')[0];
assert.ok(!/data-locked/.test(strip), 'los modos jugables no llevan candado');

const open = modeStripHtml(ACT, { includeManage: true, authed: true });
assert.ok(!/data-locked/.test(open), 'con sesión no queda ningún candado');
assert.ok(open.includes('bi-broadcast'), 'con sesión, En vivo recupera su icono');
// EL DEFECTO ES FAIL-CLOSED (v1.51.623). Era «hay sesión», y entonces lo único
// que impedía que una vista olvidadiza pintara los mandos de profe ABIERTOS era
// una regex sobre el código de las vistas. Ahora olvidarlo pone un candado de
// más: se ve, se toca y se arregla — en vez de un 403 con la clase delante.
assert.match(modeStripHtml(ACT, { includeManage: true }), /data-locked="1"/,
  'por defecto (authed omitido) se bloquea: el olvido tiene que fallar del lado seguro');
ok('modeStripHtml: candado visible sin sesión, tira intacta con sesión');

// ── 4. El aviso está CABLEADO donde el profe pulsa ──────────────────────────
// DESCUBIERTO, no enumerado. Aquí se citaba SOLO views/home.js porque era la
// única vista con modos de profe; desde v1.51.621 la tarjeta los ofrece en toda
// la biblioteca. Que cada vista pase la sesión ya no hace falta vigilarlo
// leyendo su código: el defecto de `authed` es fail-CLOSED (comprobado arriba),
// así que una vista olvidadiza pinta candados de más, no mandos abiertos.
// Lo que sí se comprueba es que las que la pasan usen la MISMA condición que el
// router (`canHost`), y no una propia.
const { readdirSync } = await import('node:fs');
const VISTAS_TARJETA = readdirSync(new URL('../views', import.meta.url))
  .filter(f => f.endsWith('.js')).map(f => `views/${f}`)
  .filter(v => /activityCardHtml\(/.test(read(v)));
assert.ok(VISTAS_TARJETA.length >= 5, `solo ${VISTAS_TARJETA.length} vistas pintan tarjeta: ¿el escáner mira donde debe?`);
const conSesionPropia = VISTAS_TARJETA.filter(v => /\bauthed:/.test(read(v)) && !/canHost\(\)/.test(read(v)));
assert.deepStrictEqual(conSesionPropia, [],
  `estas vistas deciden la sesión por su cuenta en vez de con canHost(): ${conSesionPropia.join(', ')}`);
// Y el clic bloqueado lo intercepta el DUEÑO de los clics de la tarjeta, una
// vez, con la MISMA redacción que la barra de modos del reproductor.
const wire = read('views/activityCardWire.js');
assert.match(wire, /data\.locked|dataset\.locked/, 'el dueño de los clics debe interceptar un modo bloqueado');
const modal = read('views/loginModal.js');
assert.match(modal, /export function pedirCuentaParaModo/, 'la petición de cuenta por modo tiene UN dueño');

const player = read('views/playerView.js');
assert.match(player, /modeNeedsAuth\(m\) && !canHost\(\)/, 'views/playerView.js debe bloquear Live/Tarea sin sesión en la barra de modos');
assert.match(player, /pedirCuentaParaModo/, 'la barra de modos usa la MISMA petición de cuenta que la tarjeta');

// El router gatea las rutas que DIRIGEN (crear sala, reentrar, tareas) con
// requireHost: exige sesión en PocketBase y deja pasar en el backend `local`
// (dev offline / smokes headless), donde no hay servidor que distinga host de
// alumno. Eso es la contra-prueba de la ley: la regla no puede bloquear al
// legítimo — un gate que rompe la matriz jugable está mal puesto.
const main = read('main.teacher.js');
for (const [route, what] of [['#/launch/:id', 'crear la sala'], ['#/host/:code', 'reentrar a la sala'], ['#/tasks/:id', 'gestionar tareas']]) {
  const line = main.split('\n').find(l => l.includes(`route('${route}'`)) || '';
  assert.match(line, /requireHost/, `la ruta ${route} (${what}) debe gatearse con requireHost en el router`);
}
assert.match(main, /modeAuthHint\('live'\)/, 'el gate del router reutiliza la frase de core/modes.js (no la reescribe)');
const gate = read('core/authGate.js');
assert.match(gate, /backendName\(\) === 'local'/, 'requireHost debe dejar pasar el backend local (no hay servidor que gatear)');
assert.match(gate, /export function canHost/, 'canHost() debe existir para que botón y router usen la MISMA condición');
ok('cableado: tarjeta, barra de modos y router usan la misma política y frase');

console.log(`\nmodeAuth.test: ${passed} checks passed`);
