// EL ANILLO DE ERRORES — lo que el informe de QA puede llegar a contar.
//
// POR QUÉ EXISTE ESTE FICHERO (ronda 2026-09-18). Un compañero probó la app y
// marcó Falla en el Rompecabezas con esta nota: «un bug muy feo es que ya no
// [está] el molde para poner las piezas. Failed to load resource: the server
// responded with a status of 404». Su informe, generado por nuestra propia
// hoja, decía en el pie: «últimos errores: (ninguno registrado)».
//
// Es decir: el probador VIO el 404 en la consola y el instrumento que le dimos
// para contarlo no lo recogió — ni la URL, que es lo único que habría dicho QUÉ
// fichero faltaba. Sin eso, una nota como esa no se puede accionar: el defecto
// no se reproduce aquí y no hay forma de saber si fue un asset ausente, una
// caché vieja o la red del colegio.
//
// Y no era un descuido del código: `window.addEventListener('error', fn)` en
// fase de burbuja NO ve los fallos de carga de recursos (<img>, <script>,
// <link>). Esos eventos no burbujean: solo pasan por la ventana en fase de
// CAPTURA. Un `fetch()` que devuelve 404 no dispara nada en absoluto, porque
// para `fetch` eso no es un error. Las dos vías por las que se rompe una
// pantalla por un fichero que falta eran justo las dos que el registro no veía.
//
// Run: node tests/errorLog.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

/** Un navegador de mentira: recoge los listeners CON sus opciones (la fase es
 *  el meollo) y un almacén que se puede leer al final. */
function navegadorFalso() {
  const listeners = [];
  const almacen = new Map();
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => { almacen.set(k, String(v)); },
    removeItem: (k) => { almacen.delete(k); },
  };
  globalThis.window = {
    addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }),
    dispatchEvent: () => true,
  };
  globalThis.location = { pathname: '/teacher.html', href: 'https://aulareto.com/teacher.html#/play/x' };
  return {
    listeners,
    /** Lanza un evento a los listeners de ese tipo que estén en la fase pedida. */
    lanzar(type, evento, { captura = false } = {}) {
      for (const l of listeners) {
        if (l.type !== type) continue;
        // `!!`, y no es cosmética: sin él `undefined && …` vale `undefined`, que
        // no es igual a `false`, y el listener de burbuja no se llamaba nunca —
        // un arnés que no llama a lo que prueba da un rojo falso (y, con la
        // comparación al revés, daría un verde falso).
        const enCaptura = l.opts === true || !!(l.opts && l.opts.capture === true);
        if (enCaptura === captura) l.fn(evento);
      }
    },
    anillo: () => JSON.parse(almacen.get('ww.errlog') || '[]'),
  };
}

const { installErrorHandlers, registrarFalloDeRed, clearErrors } = await (async () => {
  navegadorFalso();                       // el módulo se importa con navegador puesto
  return import('../core/errorLog.js');
})();

// ── 1. UN RECURSO QUE NO CARGA QUEDA REGISTRADO, CON SU URL ────────────────
// La prueba que habría convertido «Failed to load resource: 404» en un dato.
{
  const nav = navegadorFalso();
  clearErrors();
  installErrorHandlers('/teacher.html');

  const hayCaptura = nav.listeners.some(l => l.type === 'error'
    && (l.opts === true || (l.opts && l.opts.capture === true)));
  assert.ok(hayCaptura, 'un fallo de recurso NO burbujea: sin listener en captura no se ve nunca');

  nav.lanzar('error', {
    target: { tagName: 'IMG', src: 'https://aulareto.com/assets/juegos/dibujos/zonas/casa.svg' },
  }, { captura: true });

  const anillo = nav.anillo();
  assert.equal(anillo.length, 1, 'el fallo de carga entra en el anillo');
  assert.ok(anillo[0].message.includes('assets/juegos/dibujos/zonas/casa.svg'),
    `el registro NOMBRA el fichero que faltó («${anillo[0].message}»)`);
  ok('un recurso que no carga queda registrado, y con su URL');
}

// ── 2. CONTRA-PRUEBA: el error de JS de toda la vida sigue registrándose ───
// Endurecer la captura no puede costar lo que ya funcionaba.
{
  const nav = navegadorFalso();
  clearErrors();
  installErrorHandlers('/teacher.html');
  nav.lanzar('error', { message: 'TypeError: x is undefined', error: { stack: 'en algún sitio' } });
  const anillo = nav.anillo();
  assert.equal(anillo.length, 1, 'el error de script sigue entrando');
  assert.ok(anillo[0].message.includes('TypeError'), 'con su mensaje de siempre');
  ok('CONTRA-PRUEBA: el error de JS de siempre se sigue registrando igual');
}

// ── 3. UN 404 DE `fetch` TAMBIÉN SE CUENTA ────────────────────────────────
// `fetch` no lanza en 404: devuelve una respuesta y quien llama decide. El
// Rompecabezas decide bien (avisa en pantalla, R6) pero el informe no se
// enteraba. Hay una puerta para decirlo.
{
  const nav = navegadorFalso();
  clearErrors();
  installErrorHandlers('/teacher.html');
  registrarFalloDeRed('assets/juegos/dibujos/zonas/casa.svg', '404');
  const anillo = nav.anillo();
  assert.equal(anillo.length, 1, 'el 404 de fetch entra en el anillo');
  assert.ok(anillo[0].message.includes('casa.svg') && anillo[0].message.includes('404'),
    `el registro dice qué fichero y por qué («${anillo[0].message}»)`);
  ok('un 404 de `fetch` se puede registrar: fichero y motivo');
}

// ── 4. EL LÍMITE DE RITMO NO SE COME EL FALLO DE RED ──────────────────────
// `logClientError` deja pasar uno cada 2 s para no entrar en bucle. Con eso, un
// error de JS al montar la pantalla se tragaba el 404 que venía detrás — y el
// 404 es justo el que explica el pantallazo. Los ficheros que faltan se cuentan
// por URL (cada uno una vez), que acota igual sin perder ninguno.
{
  const nav = navegadorFalso();
  clearErrors();
  installErrorHandlers('/teacher.html');
  nav.lanzar('error', { message: 'TypeError: algo al montar' });
  registrarFalloDeRed('assets/a.svg', '404');
  registrarFalloDeRed('assets/b.svg', '404');
  registrarFalloDeRed('assets/a.svg', '404');   // repetida: no se cuenta dos veces
  const msgs = nav.anillo().map(e => e.message);
  assert.ok(msgs.some(m => m.includes('a.svg')), 'el primer fichero que falta se registra pese al ritmo');
  assert.ok(msgs.some(m => m.includes('b.svg')), 'y el segundo también: son datos distintos');
  assert.equal(msgs.filter(m => m.includes('a.svg')).length, 1, 'la MISMA URL no se repite en el anillo');
  ok('los ficheros que faltan no los silencia el límite de ritmo, y no se repiten');
}

// El navegador de mentira se DESMONTA: `run.mjs` importa las suites en el mismo
// proceso, y un `window` de pega que sobrevive hace que la siguiente crea que
// corre en un navegador (es como esta suite rompió `effects` la primera vez que
// se escribió un `document` falso, v1.51.729).
delete globalThis.window;
delete globalThis.localStorage;
delete globalThis.location;

console.log(`\n  ${passed} errorLog checks passed`);
