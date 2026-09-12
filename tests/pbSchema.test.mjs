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

// Las colecciones declaradas en DEFS (el dueño del esquema). Ya NO se raspan del
// fichero de la vista con `indexOf`: desde la Fase 6 el esquema es DATO en
// `core/pbSchema.js`, así que se IMPORTA. Un raspado se queda mudo el día que
// alguien reordena el fichero; una importación falla en rojo.
const { camposQueFaltan, DEFS, nombresDeColecciones } = await import('../core/pbSchema.js');
const declaradas = nombresDeColecciones();
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
  ok(`el tope de §25 (${QUOTAS.activityBytes} B) se verifica en el servidor`);
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

// ── APLICAR EL ESQUEMA: se EJECUTA, con el servidor fingido ─────────────────
// `core/pbProvision.js` recibe el `fetch`, así que la R6 («un atributo del
// servidor que no coincide con el declarado se DICE») se comprueba corriéndola,
// no citando la palabra «desvíos» en un fichero. Antes era una regex sobre la
// vista: sobrevivía a que el aviso dejara de funcionar.
{
  const { aplicarEsquemaPb } = await import('../core/pbProvision.js');
  const { QUOTAS } = await import('../core/quotas.js');

  /** Un PocketBase 0.23 de mentira con UNA colección, `activities`, cuyo
   *  `data.maxSize` es el que se le diga (y que NO cambia al PATCHear: es el
   *  caso real de la Pi, donde el atributo se quedó en 5 MB). */
  const servidor = (maxSizeEnPi) => {
    /** @type {string[]} */
    const vistas = [];
    const col = {
      id: 'c1', name: 'activities',
      fields: [
        { name: 'data', type: 'json', maxSize: maxSizeEnPi },
        { name: 'visibility', type: 'text' }, { name: 'tags', type: 'json' },
        { name: 'language', type: 'text' }, { name: 'owner', type: 'text' },
        { name: 'created', type: 'autodate' }, { name: 'updated', type: 'autodate' },
      ],
      indexes: [],
    };
    const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
    /** @type {typeof fetch} */
    const falso = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('_superusers/auth-with-password')) return json({ token: 'T' });
      if (u.endsWith('/api/collections/activities')) { vistas.push('find'); return json(col); }
      if (u.endsWith('/api/collections/c1')) return json(col);   // lectura y relectura
      if (u.endsWith('/api/collections')) return json({}, false, 400);
      return json({}, false, 404);
    };
    return { falso, vistas };
  };

  const { falso } = servidor(5242880);
  const res = await aplicarEsquemaPb({
    pbUrl: 'http://x', email: 'a@b.c', pass: 'x', fetchFn: falso,
    defs: DEFS.filter(d => d.name === 'activities'),
  });
  assert.strictEqual(res.length, 1);
  assert.ok(res[0].ok, `debería aplicar: ${res[0].msg}`);
  assert.match(res[0].msg, /AJUSTAR A MANO/, 'R6: un maxSize que el servidor NO cambió debe DECIRSE');
  assert.ok(res[0].msg.includes(String(QUOTAS.activityBytes)),
    'el aviso debe llevar el valor que hay que poner (§25)');

  // CONTRA-PRUEBA: con el servidor YA en el tope correcto, ni un aviso.
  const bien = await aplicarEsquemaPb({
    pbUrl: 'http://x', email: 'a@b.c', pass: 'x', fetchFn: servidor(QUOTAS.activityBytes).falso,
    defs: DEFS.filter(d => d.name === 'activities'),
  });
  assert.ok(bien[0].ok && !/AJUSTAR A MANO/.test(bien[0].msg),
    'el camino legítimo no debe gritar: ' + bien[0].msg);
  assert.match(bien[0].msg, /verificado: 5 campos/, 'la relectura cuenta los campos que HAY');
  ok('R6 ejecutado: la deriva de un atributo declarado se dice, y sin falsos avisos');
}

// ── El esquema es DATO, y cada colección declara algo ───────────────────────
{
  for (const d of DEFS) {
    assert.ok(Array.isArray(d.fields) && d.fields.length, `${d.name} sin campos`);
    for (const f of d.fields) assert.ok(f.name && f.type, `${d.name}: campo sin nombre/tipo`);
  }
  const dup = declaradas.filter((n, i) => declaradas.indexOf(n) !== i);
  assert.deepStrictEqual(dup, [], 'colección declarada dos veces');
  // El ORDEN importa: la regla de live_answers hace join a live_claims y
  // PocketBase valida las reglas AL GUARDARLAS (fallo real en la Pi).
  assert.ok(declaradas.indexOf('live_claims') < declaradas.indexOf('live_answers'),
    'live_claims debe declararse ANTES que live_answers');
  ok(`las ${DEFS.length} colecciones del DEFS están bien formadas y en orden aplicable`);
}

console.log(`\n  ${passed} pbSchema checks passed`);
