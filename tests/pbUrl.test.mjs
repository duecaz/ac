// EL SERVIDOR SE ELIGE DE UNA LISTA CERRADA, nunca de una URL libre.
//
// `pocketbase.config.js` deja apuntar la aplicación a otro nombre de la MISMA
// Pi con `?pb=nuevo`, para poder estrenar `api.aulareto.com` sin cambiárselo a
// todo el mundo el mismo día. Ese interruptor es cómodo y es peligroso: si
// aceptara una dirección cualquiera, bastaría con mandarle a un profe un enlace
// como `aulareto.com/teacher.html?pb=https://servidor-falso/` para que la
// pantalla de entrar —la de verdad, en el dominio de verdad— mandara su
// contraseña a otro sitio. Por eso solo valen los nombres declarados, y por eso
// esto es un test y no un comentario.
//
// Run: node tests/pbUrl.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

/** Importa el config con una `location` fingida. El módulo lee al cargarse, así
 *  que cada caso necesita su propia copia: se fuerza con un sufijo distinto. */
let n = 0;
async function conBusqueda(search) {
  const previo = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search }, configurable: true, writable: true });
  const mod = await import(`../pocketbase.config.js?caso=${++n}`);
  if (previo) Object.defineProperty(globalThis, 'location', previo);
  else delete /** @type {Record<string, unknown>} */ (globalThis).location;
  return mod.PB_URL;
}

// ── 1. Sin parámetro: el de siempre ───────────────────────────────────────
{
  const url = await conBusqueda('');
  assert.strictEqual(url, 'https://pb.lanube.uno', 'sin `?pb` se usa el servidor de siempre');
  ok('sin parámetro apunta al servidor de siempre');
}

// ── 2. El nombre declarado SÍ cambia el destino ───────────────────────────
// (contra-prueba del punto 3: la puerta legítima tiene que seguir abierta, o
// el interruptor no serviría para estrenar el dominio nuevo)
{
  const url = await conBusqueda('?pb=nuevo');
  assert.strictEqual(url, 'https://api.aulareto.com', '`?pb=nuevo` apunta al dominio de la web');
  ok('`?pb=nuevo` sí cambia al nombre nuevo de la MISMA Pi');
}

// ── 3. Cualquier otra cosa se IGNORA ──────────────────────────────────────
// Lo que de verdad protege: una URL en el parámetro no puede secuestrar la
// pantalla de entrar.
{
  for (const intento of [
    '?pb=https://servidor-falso.example',
    '?pb=//servidor-falso.example',
    '?pb=http://pb.lanube.uno',           // ni siquiera el mismo host sin cifrar
    '?pb=javascript:alert(1)',
    '?pb=constructor',                     // no se cuela por la cadena de prototipos
    '?pb=toString',
    '?pb=',
  ]) {
    const url = await conBusqueda(intento);
    assert.strictEqual(url, 'https://pb.lanube.uno',
      `«${intento}» debe ignorarse y caer al servidor de siempre, no apuntar a ${url}`);
  }
  ok('una dirección libre en el parámetro se ignora (7 intentos, incluidos `constructor` y `toString`)');
}

// ── 4. Los dos destinos son HTTPS y de dominios nuestros ──────────────────
// Si alguien añade un tercero por comodidad, que no pueda ser cualquier cosa.
{
  const src = (await import('node:fs')).readFileSync(new URL('../pocketbase.config.js', import.meta.url), 'utf8');
  const bloque = src.match(/const SERVIDORES = new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(bloque, 'pocketbase.config.js debe declarar SERVIDORES como Map');
  const destinos = [...bloque[1].matchAll(/'(https?:\/\/[^']+)'/g)].map(m => m[1]);
  assert.ok(destinos.length >= 2, `se esperaban al menos 2 destinos declarados, hay ${destinos.length}`);
  for (const d of destinos) {
    assert.ok(d.startsWith('https://'), `${d} no es HTTPS`);
    assert.ok(/\/\/[a-z0-9.-]*(lanube\.uno|aulareto\.com)$/.test(d), `${d} no es un dominio nuestro`);
  }
  ok(`los ${destinos.length} destinos declarados son HTTPS y de dominios nuestros`);
}

console.log(`\npbUrl.test: ${passed} checks passed`);
