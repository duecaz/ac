#!/usr/bin/env node
// EL ÍNDICE DE TOKENS — quién DECLARA cada variable CSS y quién la CONSUME.
//
//   node tools/tokens.mjs           → escribe docs/tokens.md
//   node tools/tokens.mjs --check   → falla si el doc no está al día
//
// POR QUÉ EXISTE. La ley §3 dice «el skin cambia TOKENS, la actividad consume
// TOKENS». Eso convierte a los tokens en la INTERFAZ entre el tema y el juego —
// y hasta hoy esa interfaz no estaba escrita en ninguna parte: vivía repartida
// entre 33 hojas, 5 temas y un bloque de comentario en `core/skins.js` que se
// actualizaba a mano (y por tanto se quedaba viejo: al escribir esto tenía
// valores por defecto que ya no eran los del código).
//
// Un token es la misma clase de mando que un ajuste del panel, y sufre las
// mismas dos enfermedades:
//   · DECLARADO Y NUNCA CONSUMIDO — el tema pinta un mando que no manda nada.
//     Es el gemelo exacto de los siete ajustes desconectados que encontró
//     `tests/ajusteConectado.test.mjs`, y se descubre igual: escaneando.
//   · CONSUMIDO SIN DECLARAR NI RESPALDO — `var(--x)` sin fallback y sin nadie
//     que lo defina no es un color: es la nada. La propiedad se cae entera.
// Las dos las vigila `tests/tokenConectado.test.mjs`; este script es el MAPA
// que se lee cuando hay que tocar un tema.
//
// DÓNDE SE DECLARA UN TOKEN. No solo en CSS: `core/skins.js` los aplica con
// `setProperty` desde el `cssVars` de cada skin, y varios players los estampan
// en línea (el crucigrama sus columnas, los globos su vaivén). Por eso el
// escáner mira también el JS — si mirase solo las hojas, la mitad de la paleta
// saldría como "consumida sin declarar" y la red no serviría para nada.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(ROOT, 'docs/tokens.md');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

// `tests/` y `tools/` quedan fuera: el índice describe EL PRODUCTO. Un `--algo`
// de ejemplo dentro de una contra-prueba no es un token de la app, y colarlo
// ensucia justo la lista que hay que poder leer de una pasada.
const IGNORAR_DIR = ['node_modules', '.git', 'docs', 'sounds', 'assets', '.shots',
  'scratchpad', 'tests', 'tools', 'vendor'];

// Un token INTERPOLADO (`var(--ww-shape-${i})`) llega al escáner partido por la
// mitad, como `--ww-shape-`. No es un token: es media cadena. Se descarta por
// forma —terminar en guion— en vez de por lista de nombres.
const esFragmento = (t) => t.endsWith('-');
function recorrer(dir, ext, out = []) {
  for (const f of readdirSync(dir)) {
    if (IGNORAR_DIR.includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) recorrer(p, ext, out);
    else if (ext.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}

// Los comentarios fuera: un token NOMBRADO en una explicación no es ni una
// declaración ni un consumo (styles/globos.css documenta `var(--ww-*)` en su
// cabecera, y sin esto entraba en el índice como un token llamado `--ww-`).
const sinComentarios = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre);

const anota = (mapa, token, fichero) => {
  if (esFragmento(token)) return;
  if (!mapa.has(token)) mapa.set(token, new Set());
  mapa.get(token).add(fichero);
};

export function escanear() {
  const declara = new Map();     // token → ficheros que le dan valor
  const consume = new Map();     // token → ficheros que lo leen con var()
  const conRespaldo = new Set(); // token leído con var(--x, algo) en algún sitio

  // Las hojas propias Y los `<style>` de las cuatro páginas. Lo segundo no es
  // un extra: `embed.html` lee ahí `--ww-card-bg` y `--ww-fg`, y sin mirarlo el
  // índice diría que nadie los consume. Con la ley de «declarado ⇒ consumido»
  // eso no es un dato flojo: es una instrucción de BORRAR un token que sí se usa.
  const inlineHtml = ['index.html', 'teacher.html', 'student.html', 'embed.html']
    .map(f => join(ROOT, f));
  for (const p of recorrer(join(ROOT, 'styles'), ['.css'])
    .concat(recorrer(join(ROOT, 'themes'), ['.css']))
    .concat(inlineHtml)) {
    const bruto = readFileSync(p, 'utf8');
    const css = sinComentarios(p.endsWith('.html')
      ? [...bruto.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
      : bruto);
    for (const m of css.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) anota(declara, m[1], rel(p));
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
      anota(consume, m[1], rel(p));
      if (m[2] === ',') conRespaldo.add(m[1]);
    }
  }

  // JS: `setProperty('--x', …)`, `style="--x: …"` dentro de plantillas literales
  // y las claves `'--x':` de los `cssVars` de cada skin.
  for (const p of recorrer(ROOT, ['.js', '.mjs'])) {
    const js = sinComentarios(readFileSync(p, 'utf8'));
    for (const m of js.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) anota(declara, m[1], rel(p));
    for (const m of js.matchAll(/['"`](--[\w-]+)['"`]\s*:/g)) anota(declara, m[1], rel(p));
    for (const m of js.matchAll(/(?:^|[;{"'`\s])(--[\w-]+)\s*:\s*[^;'"`\s]/gm)) anota(declara, m[1], rel(p));
    for (const m of js.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
      anota(consume, m[1], rel(p));
      if (m[2] === ',') conRespaldo.add(m[1]);
    }
    // Lectura por índice: `v['--ww-bg']`. Es como `core/skins.js` pinta la
    // miniatura de cada tema — sin esto, la base de toda la paleta salía como
    // "declarada y nunca consumida", que es exactamente lo contrario.
    for (const m of js.matchAll(/\[\s*['"`](--[\w-]+)['"`]\s*\]/g)) anota(consume, m[1], rel(p));
  }

  const todos = [...new Set([...declara.keys(), ...consume.keys()])].sort();
  return { declara, consume, conRespaldo, todos };
}

/** Familia de un token por su prefijo (`--ww-fg` → `ww`, `--math-cifra` → `math`). */
export const familiaDe = (t) => (t.match(/^--([a-z]+)-/i)?.[1] ?? 'suelto');

const lista = (mapa, t) => [...(mapa.get(t) || [])].sort().join(' · ') || '—';

export function generar() {
  const { declara, consume, conRespaldo, todos } = escanear();
  const familias = [...new Set(todos.map(familiaDe))].sort();
  const L = [];
  L.push('# Índice de tokens CSS — contrato GENERADO');
  L.push('');
  L.push('> **Tipo**: generado · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/tokenConectado.test.mjs`');
  L.push('');
  L.push('> **GENERADO** por `node tools/tokens.mjs` — no editar a mano.');
  L.push('> Lo vigila `tests/tokenConectado.test.mjs`: un token declarado que nadie');
  L.push('> consuma, o consumido sin declarar ni respaldo, rompe CI.');
  L.push('');
  L.push('Los tokens son la INTERFAZ entre el tema y el juego (ley §3: el skin');
  L.push('cambia tokens, la actividad los consume). Este es el contrato completo.');
  L.push('');
  L.push(`**${todos.length} tokens** en ${familias.length} familias.`);
  L.push('');
  for (const fam of familias) {
    const dela = todos.filter(t => familiaDe(t) === fam);
    L.push(`## \`--${fam}-*\` (${dela.length})`);
    L.push('');
    L.push('| Token | Lo DECLARA | Lo CONSUME |');
    L.push('|---|---|---|');
    for (const t of dela) {
      const resp = !declara.has(t) && conRespaldo.has(t) ? ' *(solo respaldo)*' : '';
      L.push(`| \`${t}\` | ${lista(declara, t)}${resp} | ${lista(consume, t)} |`);
    }
    L.push('');
  }
  return L.join('\n') + '\n';
}

// Solo actúa cuando se le invoca a mano: `tests/tokenConectado.test.mjs`
// importa `escanear()` y no quiere que se le reescriba un doc por el camino.
const invocadoDirecto = process.argv[1] && process.argv[1].endsWith('tokens.mjs');
if (!invocadoDirecto) { /* importado como librería */ }
else if (process.argv.includes('--check')) {
  const md = generar();
  let previo = '';
  try { previo = readFileSync(SALIDA, 'utf8'); } catch { previo = ''; }  // aún no existe
  if (previo !== md) {
    console.error('❌ docs/tokens.md NO está al día. Corre: node tools/tokens.mjs');
    process.exit(1);
  }
  console.log('✅ docs/tokens.md al día');
} else {
  const md = generar();
  writeFileSync(SALIDA, md);
  // La cuenta sale del propio doc: `escanear()` otra vez era recorrer el repo
  // entero por segunda vez para averiguar algo que ya está escrito.
  console.log(`✅ escrito ${rel(SALIDA)} (${md.match(/\*\*(\d+) tokens\*\*/)?.[1]} tokens)`);
}
