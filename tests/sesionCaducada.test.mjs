// UNA SESIÓN CADUCADA NO ES UNA SESIÓN.
//
// Reportado desde un colegio (v1.51.623): «cuando termino una actividad me manda
// a la página del propietario COMO SI TUVIERA SU SESIÓN, pero no la tengo».
// Reproducido: con un token vencido guardado en la PC del aula, la app respondía
// `getAuthUserId()` con el id del profe, `canHost: true` y, al terminar de
// jugar, «Mis actividades» — la pantalla de OTRO, con sus mandos abiertos.
//
// La limpieza existía (`authRefresh()` borra la sesión con un 401), pero pide
// RED: hasta que contesta —y en el wifi de un colegio eso tarda, o no llega— la
// app ya ha decidido. Y los lectores que deciden son SÍNCRONOS: el gate de
// modos, la tarjeta y «a dónde te lleva terminar» no pueden esperar.
//
// El token lleva su fecha DENTRO (JWT `exp`): saber que está muerto no necesita
// preguntarle a nadie. Esta suite fija esa regla y —igual de importante— sus
// límites: lo que NO se puede juzgar no se toca.
//
// Run: node tests/sesionCaducada.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// localStorage de mentira, como en tests/pbAuth.test.mjs.
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
global.fetch = async () => { throw new Error('sin red: esta suite NO puede depender del servidor'); };

const jwt = (payload) => `cabecera.${Buffer.from(JSON.stringify(payload)).toString('base64')}.firma`;
const AHORA = Date.now();
const sembrar = (token) => {
  store.clear();
  store.set('ww.pb.auth', JSON.stringify({ token, record: { id: 'u_profe', email: 'profe@cole.es' } }));
};

const auth = await import('../core/auth.js');

// ── 1. EL CASO DEL AULA: token vencido → no hay sesión, y se BORRA ───────────
{
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) - 86400 }));   // caducó ayer
  assert.strictEqual(auth.getAuthUserId(), null, 'un token vencido NO da identidad de profe');
  assert.strictEqual(auth.getAuthToken(), null, 'ni token para firmar escrituras');
  assert.strictEqual(await auth.getUser(), null, 'ni usuario');
  assert.strictEqual(store.get('ww.pb.auth'), undefined,
    'y la sesión muerta se BORRA del almacén: si se quedara, quien lea la clave a mano seguiría viéndola');
  ok('token vencido: ni id, ni token, ni usuario — y la sesión muerta se limpia sola, sin red');
}

// ── 2. CONTRA-PRUEBA: la sesión VIVA no se toca ─────────────────────────────
// Una regla que eche a los profes de su propia sesión es peor que el defecto que
// arregla: pasa a mitad de clase y no hay forma de saber por qué.
{
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) + 3600 }));    // vence en una hora
  assert.strictEqual(auth.getAuthUserId(), 'u_profe', 'CONTRA-PRUEBA: la sesión viva sigue siendo sesión');
  assert.ok(store.get('ww.pb.auth'), 'y no se borra nada');
  ok('CONTRA-PRUEBA: una sesión todavía válida no se toca');
}

// ── 3. LO QUE NO SE PUEDE JUZGAR, NO SE JUZGA ───────────────────────────────
// Prudencia deliberada: un token que no es un JWT, o cuya carga no se puede
// leer, o sin `exp`, se CONSERVA — de eso decide `authRefresh()` cuando haya
// red. Inventarse que está muerto dejaría sin sesión a quien la tiene.
{
  for (const [caso, token] of [
    ['un token opaco (sin puntos)', 'TOK123'],
    ['una carga ilegible', 'a.@@@no-es-base64@@@.c'],
    ['un JWT sin exp', jwt({ id: 'u_profe' })],
    ['un exp que no es número', jwt({ id: 'u_profe', exp: 'mañana' })],
  ]) {
    sembrar(token);
    assert.strictEqual(auth.getAuthUserId(), 'u_profe', `${caso}: se conserva (lo juzga authRefresh con red)`);
  }
  ok('lo que no dice de sí mismo que está muerto se conserva: opaco · ilegible · sin exp · exp no numérico');
}

// ── 4. EL MARGEN DEL RELOJ TORCIDO ──────────────────────────────────────────
// La pizarra del aula puede tener la hora un poco adelantada. Un token que
// acaba de vencer según ESTE reloj no echa a nadie: hay un minuto de gracia.
{
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) - 5 }));       // venció hace 5 s
  assert.strictEqual(auth.getAuthUserId(), 'u_profe',
    'con 5 s de vencimiento manda el margen: un reloj local adelantado no cierra la sesión');
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) - 3600 }));    // venció hace una hora
  assert.strictEqual(auth.getAuthUserId(), null, 'una hora de vencimiento ya no admite excusa de reloj');
  ok('margen de un minuto para el reloj torcido, y ni uno más');
}

// ── 5. LA CONSECUENCIA QUE SE VIO EN EL AULA ────────────────────────────────
// El defecto no se notó en `getAuthUserId()`: se notó en A DÓNDE TE LLEVA
// terminar de jugar. Se comprueba el efecto, no solo la causa.
{
  const { destinoTrasJugar } = await import('../core/afterPlay.js');
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) - 86400 }));
  assert.strictEqual(destinoTrasJugar('solo').href, '#/explore',
    'con la sesión caducada, terminar lleva a la BIBLIOTECA — nunca a «Mis actividades», que es de otro');
  sembrar(jwt({ id: 'u_profe', exp: Math.floor(AHORA / 1000) + 3600 }));
  assert.strictEqual(destinoTrasJugar('solo').href, '#/mine',
    'CONTRA-PRUEBA: con sesión viva sigue llevando a lo tuyo');
  ok('terminar de jugar ya no te deja en la pantalla del profe anterior');
}

console.log(`\nsesionCaducada.test: ${passed} checks passed`);
