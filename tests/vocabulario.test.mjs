// §6e DEL NORTE — UNA COSA, UN NOMBRE, en el texto que el profe LEE.
//
// La interfaz llamaba a lo mismo de tres maneras: sala · sesión · partida para
// el MISMO objeto (el encuentro en vivo con su PIN). Eso no es cosmética: el
// profe aprende un nombre, el código usa otro y la documentación un tercero, y
// cada uno arrastra su malentendido. La decisión ya estaba tomada en §6e; lo que
// faltaba era aplicarla y que no volviera a derivar.
//
// OJO con el falso positivo: "iniciar sesión" es OTRA cosa (autenticación) y se
// queda. Por eso la norma se escribe sobre las palabras que SÍ tienen sustituto
// decidido — `partida` y `entrega` — y no sobre `sesión` a secas.
//
// Run: node tests/vocabulario.test.mjs
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Palabra desterrada → con qué se sustituye y por qué.
const DESTERRADAS = [
  ['partida', 'sala', 'el encuentro en vivo con su PIN se llama SALA (§6e)'],
  ['entrega', 'intento', 'lo que el alumno manda de una tarea es un INTENTO: uno de varios (§6e)'],
];

/** Las líneas de texto que el usuario LEE: cadenas y HTML, sin comentarios. */
function visibles(src) {
  return src.split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))          // fuera comentarios
    .map(l => l.replace(/\/\/.*$/, ''))                  // y el comentario final
    .filter(l => /['"`>]/.test(l));
}

// ── 1. Ninguna vista usa una palabra desterrada en texto visible ────────────
{
  const malos = [];
  for (const f of readdirSync(join(ROOT, 'views')).filter(n => n.endsWith('.js'))) {
    const src = readFileSync(join(ROOT, 'views', f), 'utf8');
    for (const l of visibles(src)) {
      for (const [mala, buena] of DESTERRADAS) {
        if (new RegExp(`[^\\w]${mala}s?[^\\w]`, 'i').test(l)) {
          malos.push(`views/${f}: «${mala}» → di «${buena}»  ${l.trim().slice(0, 70)}`);
        }
      }
    }
  }
  assert.deepStrictEqual(malos, [],
    `VOCABULARIO (§6e) — el profe debe aprender UN nombre:\n  ${malos.join('\n  ')}`);
  ok(`ninguna vista dice ${DESTERRADAS.map(d => `«${d[0]}»`).join(' ni ')} en texto visible`);
}

// ── 2. CONTRA-PRUEBA: "iniciar sesión" sigue siendo legítimo ───────────────
// Una norma demasiado ancha se descubre con la clase delante. `sesión` de
// autenticación NO se toca: renombrarlo sería confundir dos cosas distintas por
// aplicar una regla a ciegas.
{
  const login = readFileSync(join(ROOT, 'views/loginModal.js'), 'utf8');
  assert.match(login, /[Ii]nicia(r)? sesión/, 'el texto de autenticación debe seguir diciendo "iniciar sesión"');
  const seguirian = visibles(login).filter(l => /[^\w]partidas?[^\w]/i.test(l));
  assert.deepStrictEqual(seguirian, [], 'y no por eso puede colarse "partida"');
  ok('CONTRA-PRUEBA: "iniciar sesión" (autenticación) sigue intacto — es otra cosa');
}

// ── 3. La palabra que manda está ESCRITA donde se consulta ─────────────────
{
  const norte = readFileSync(join(ROOT, 'docs/norte.md'), 'utf8');
  assert.match(norte, /UNA COSA, UN NOMBRE/, '§6e debe seguir en el norte');
  for (const [mala] of DESTERRADAS) {
    assert.ok(new RegExp(`~~${mala}~~|«?${mala}»?`, 'i').test(norte),
      `§6e debe listar «${mala}» como palabra desterrada`);
  }
  ok('§6e sigue siendo la fuente: cada palabra desterrada está escrita ahí');
}

console.log(`\n  ${passed} vocabulario checks passed`);
