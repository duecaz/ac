// EL ESQUEMA DE LA Pi Y SU VERIFICADOR NO PUEDEN DIVERGIR.
//
// Hay DOS fuentes sobre qué debe existir en PocketBase:
//   · `views/adminView.js` → `DEFS`: el dueño del ESQUEMA (crea colecciones,
//     campos e índices desde el panel `#/admin`).
//   · `tools/check-pb.sh`: el smoke que el usuario corre contra la Pi real.
// El segundo era una lista ESCRITA A MANO y ya había divergido: comprobaba 8 de
// las 13 colecciones (auditoría v1.51.404). Las 5 que faltaban —live_sessions,
// live_keys, live_claims, assignments, assignment_attempts— son justo aquellas
// cuya ausencia la app degrada EN SILENCIO (cae al blob legado, o juega sin
// credencial de dispositivo). Un verificador incompleto es peor que ninguno:
// da un verde que no cubre lo que uno cree.
//
// Este test no habla con ningún servidor: cruza las DOS listas del repo.
//
// Run: node tests/pbSchema.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Las colecciones declaradas en DEFS (el dueño del esquema). Se leen del BLOQUE
// DEFS y no de todo el fichero, para no confundir menciones sueltas.
const admin = read('views/adminView.js');
const { camposQueFaltan } = await import('../core/pbSchema.js');   // el cálculo, para probarlo de verdad
const bloque = admin.slice(admin.indexOf('const DEFS = ['), admin.indexOf('const COLLECTIONS'));
const declaradas = [...bloque.matchAll(/\{\s*name:\s*'([a-z_]+)',\s*fields:/g)].map(m => m[1]);
const script = read('tools/check-pb.sh');

// ── 1. El verificador conoce TODAS las colecciones del esquema ─────────────
{
  assert.ok(declaradas.length >= 12, `solo se leyeron ${declaradas.length} colecciones de DEFS: el parser no está mirando bien`);
  const bucle = (script.match(/for c in ([^;]+); do/) || [])[1] || '';
  const comprobadas = new Set(bucle.trim().split(/\s+/));
  const faltan = declaradas.filter(c => !comprobadas.has(c));
  assert.deepStrictEqual(faltan, [],
    `tools/check-pb.sh no comprueba estas colecciones del esquema: ${faltan.join(' · ')}`);
  ok(`check-pb.sh comprueba las ${declaradas.length} colecciones que declara el panel`);
}

// ── 2. Los campos MUDOS están vigilados ────────────────────────────────────
// PocketBase IGNORA las claves desconocidas al escribir: si el campo no está en
// el servidor, el dato se pierde sin un solo error. Estos cuatro son los que
// cambian el resultado de una clase, así que el smoke los nombra uno a uno.
{
  const MUDOS = [
    ['live_answers.unscorable', 'un ítem sin clave se guardaría como fallo de toda la clase'],
    ['results.qid', 'un ACK perdido duplicaría el resultado'],
    ['assignment_attempts.qid', 'idem en tareas, gastando un intento del alumno'],
    ['assignment_attempts.answers', 'la analítica por ítem de las tareas se quedaría vacía'],
  ];
  for (const [campo, porqué] of MUDOS) {
    const nombre = campo.split('.')[1];
    assert.ok(script.includes(nombre), `check-pb.sh no vigila «${campo}» — ${porqué}`);
  }
  ok(`los ${MUDOS.length} campos cuya ausencia es MUDA se comprueban en la Pi`);
}

// ── 3. El TOPE de §25 se comprueba en el servidor, no solo en el cliente ────
// El panel es append-only: añade campos que faltan, pero NUNCA corrige los
// atributos de uno que ya existe. Cuando el tope bajó de 5 MB a 2 MB, el
// servidor se quedó en 5 y el límite de §25 pasó a ser un aviso de cliente sin
// que nada lo dijera.
{
  const { QUOTAS } = await import('../core/quotas.js');
  assert.ok(script.includes(String(QUOTAS.activityBytes)),
    `check-pb.sh debe comprobar el maxSize real de activities.data (${QUOTAS.activityBytes})`);
  assert.match(admin, /desvíos|AJUSTAR A MANO/,
    'el panel debe DECIR cuándo un atributo del servidor no coincide con el declarado (R6)');
  ok(`el tope de §25 (${QUOTAS.activityBytes} B) se verifica en el servidor y el panel avisa de la deriva`);
}

// ── 4. CONTRA-PRUEBA: el cruce detecta de verdad ───────────────────────────
{
  const comprobadas = new Set('users activities'.split(' '));
  const faltarían = ['activities', 'live_players'].filter(c => !comprobadas.has(c));
  assert.deepStrictEqual(faltarían, ['live_players'], 'el cruce no vería una colección sin comprobar');
  ok('CONTRA-PRUEBA: una colección nueva sin añadir a check-pb.sh sería cazada');
}

// ── REPARAR `created`/`updated`, no solo crearlos (§22-1) ───────────────────
// Comportamiento, no redacción: `camposQueFaltan` es puro, así que se comprueba
// con NOMBRES y no citando la línea del panel (tests/helpers/fuente.mjs).
// El fallo que lo motivó: `live_sessions` de la Pi se creó antes de que
// declaráramos los autodate y la reparación los excluía igual que en <0.23, así
// que se quedó sin `updated` PARA SIEMPRE. Sin ese dato el sello de apertura de
// la carrera ni se intentaba y el tiempo caía al que afirma el móvil, mudo.
{
  const deseados = [{ name: 'code' }, { name: 'state' },
    { name: 'created', type: 'autodate' }, { name: 'updated', type: 'autodate' }];
  const actuales = [{ name: 'id' }, { name: 'code' }, { name: 'state' }];   // la Pi
  const v23 = camposQueFaltan({ actuales, deseados, isV23: true }).map(f => f.name);
  assert.deepStrictEqual(v23, ['created', 'updated'], 'PB ≥0.23: los autodate que falten SE REPARAN');
  // CONTRA-PRUEBA: en <0.23 son campos de SISTEMA y declararlos revienta el PATCH.
  const viejo = camposQueFaltan({ actuales, deseados, isV23: false }).map(f => f.name);
  assert.deepStrictEqual(viejo, [], 'PB <0.23: no se tocan (son de sistema)');
  // `id` nunca, y lo que ya está no se duplica.
  assert.deepStrictEqual(
    camposQueFaltan({ actuales, deseados: [{ name: 'id' }, { name: 'code' }], isV23: true }), [],
    'ni `id` ni los campos que ya existen');
  ok('§22-1: el panel REPARA created/updated en colecciones que se crearon sin ellos');
}

console.log(`\n  ${passed} pbSchema checks passed`);
