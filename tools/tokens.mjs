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
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssDeHtml, ficheros, ficherosDeTerceros, hojasDelRepo, leer, paginasDelRepo, ROOT }
  from '../tests/helpers/inventario.mjs';

const SALIDA = join(ROOT, 'docs/tokens.md');
const rel = (p) => p;

// `tests/` y `tools/` quedan fuera: el índice describe EL PRODUCTO. Un `--algo`
// de ejemplo dentro de una contra-prueba no es un token de la app, y colarlo
// ensucia justo la lista que hay que poder leer de una pasada. (Lo de terceros
// no se decide aquí: lo pone el inventario, que es su dueño.)
const MIO = (f) => !/^(docs|sounds|assets|tests|tools)\//.test(f);

// Un token INTERPOLADO (`var(--ww-shape-${i})`) llega al escáner partido por la
// mitad, como `--ww-shape-`. No es un token: es media cadena. Se descarta por
// forma —terminar en guion— en vez de por lista de nombres.
const esFragmento = (t) => t.endsWith('-');

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

  // Un `var()` cuenta igual lo escriba quien lo escriba: una hoja, una página o
  // un módulo. Se define UNA vez para que las dos mitades del contrato no
  // puedan discrepar (el respaldo `var(--x, algo)` es lo que salva a un token
  // de estar leído sobre la nada, así que aquí se decide qué es «leerlo»).
  const anotaVar = (txt, f) => {
    for (const m of txt.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
      anota(consume, m[1], f);
      if (m[2] === ',') conRespaldo.add(m[1]);
    }
  };

  // Las hojas propias Y los `<style>` de las PÁGINAS, derivadas del disco. Lo
  // segundo no es un extra: `embed.html` lee ahí `--ww-card-bg` y `--ww-fg`, y
  // `test.html` —la hoja de pruebas, que la lista escrita a mano de «las cuatro
  // páginas» ni siquiera incluía— declara y consume su propia familia `--qh-*`.
  // Con la ley de «declarado ⇒ consumido» eso no es un dato flojo: es una
  // instrucción de BORRAR tokens que sí se usan.
  for (const f of [...hojasDelRepo(), ...paginasDelRepo()]) {
    const bruto = leer(f);
    const css = sinComentarios(f.endsWith('.html') ? cssDeHtml(bruto) : bruto);
    for (const m of css.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) anota(declara, m[1], rel(f));
    anotaVar(css, rel(f));
  }

  // JS: `setProperty('--x', …)`, `style="--x: …"` dentro de plantillas literales
  // y las claves `'--x':` de los `cssVars` de cada skin.
  for (const f of ficheros('.', f => MIO(f) && /\.(js|mjs)$/.test(f))) {
    const js = sinComentarios(leer(f));
    for (const m of js.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) anota(declara, m[1], rel(f));
    for (const m of js.matchAll(/['"`](--[\w-]+)['"`]\s*:/g)) anota(declara, m[1], rel(f));
    for (const m of js.matchAll(/(?:^|[;{"'`\s])(--[\w-]+)\s*:\s*[^;'"`\s]/gm)) anota(declara, m[1], rel(f));
    anotaVar(js, rel(f));
    // Lectura por índice: `v['--ww-bg']`. Es como `core/skins.js` pinta la
    // miniatura de cada tema — sin esto, la base de toda la paleta salía como
    // "declarada y nunca consumida", que es exactamente lo contrario.
    for (const m of js.matchAll(/\[\s*['"`](--[\w-]+)['"`]\s*\]/g)) anota(consume, m[1], rel(f));
  }

  // QUIÉN LEE UN TOKEN NO ES LA MISMA PREGUNTA QUE DE QUIÉN ES EL TOKEN.
  // El índice describe NUESTROS tokens (por eso `vendor/` no aporta ninguno),
  // pero un token lo lee cualquiera a quien el navegador cargue — y Bootstrap
  // se carga. Al mezclar las dos preguntas en una sola frontera de carpetas,
  // los 16 `--bs-*` que `styles/theme.css` declara PARA Bootstrap salían como
  // «declarados y nunca consumidos», y hubo que taparlo con una exención; una
  // exención cuyo motivo («llega por CDN») caducó a la versión siguiente y se
  // quedó ahí con el cartel viejo. Separadas las preguntas, la exención sobra:
  // el consumidor es real y ahora se ve. Y el día que Bootstrap se sustituya
  // por CSS propio, esos tokens se quedan muertos SOLOS y la ley §3c los caza,
  // sin ningún cartel que actualizar.
  //
  // Se anota SOLO el consumo de tokens que declaramos nosotros: las variables
  // internas de un tercero no son asunto del índice.
  for (const f of ficherosDeTerceros('vendor', f => f.endsWith('.css'))) {
    const css = leer(f);
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (declara.has(m[1])) anota(consume, m[1], f);
    }
  }

  const todos = [...new Set([...declara.keys(), ...consume.keys()])].sort();
  return { declara, consume, conRespaldo, todos };
}

/** Familia de un token por su prefijo (`--ww-fg` → `ww`, `--math-cifra` → `math`). */
export const familiaDe = (t) => (t.match(/^--([a-z]+)-/i)?.[1] ?? 'suelto');

const lista = (mapa, t) => [...(mapa.get(t) || [])].sort().join(' · ') || '—';

/** `datos` se INYECTA para no recorrer el repo dos veces: quien ya escaneó
 *  (el test lo hace en su primera línea) pasa lo que tiene. */
export function generar(datos = escanear()) {
  const { declara, consume, conRespaldo, todos } = datos;
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

// Solo actúa cuando se le invoca a mano (`tests/tokenConectado.test.mjs` lo
// importa como librería y no quiere que le reescriban un doc por el camino).
// El idioma es el que ya usa `tools/stamp-assets.mjs`, no un `endsWith` propio.
if (import.meta.url === `file://${process.argv[1]}`) {
  const datos = escanear();          // UN solo recorrido, y de ahí sale todo
  const md = generar(datos);
  if (process.argv.includes('--check')) {
    let previo = '';
    try { previo = readFileSync(SALIDA, 'utf8'); } catch { previo = ''; }  // aún no existe
    if (previo !== md) {
      console.error('❌ docs/tokens.md NO está al día. Corre: node tools/tokens.mjs');
      process.exit(1);
    }
    console.log('✅ docs/tokens.md al día');
  } else {
    writeFileSync(SALIDA, md);
    console.log(`✅ escrito docs/tokens.md (${datos.todos.length} tokens)`);
  }
}
