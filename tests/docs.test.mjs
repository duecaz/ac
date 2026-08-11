// LA DOCUMENTACIÓN QUE SE PUEDE VERIFICAR, SE VERIFICA.
//
// "Si es norma, es test" — y luego los cuadros de las normas se mantenían a
// mano. El de los bucles en vivo estaba copiado en CLAUDE.md, docs/leyes.md §26
// y docs/modos-de-juego.md §9.4, y los TRES decían que el tablero puntúa plano
// cuando Ordena las Pelotas tiene su propia escala 0-1000. Hubo que corregirlo
// en tres sitios (v1.51.354): eso es la definición de duplicación con coste.
//
// Ahora esos cuadros salen de su módulo dueño (`tools/docgen.mjs`) y aquí se
// comprueba que están al día. Igual que el mapa de módulos.
//
// Desde v1.51.374 los documentos también se ENLAZAN entre sí y saltan a
// secciones concretas (índice generado + tabla "ir a otro documento"). Un enlace
// roto no rompe la app, pero sí la confianza en la documentación — así que
// también se verifica: fichero Y ancla.
//
// Run: node tests/docs.test.mjs
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const run = (args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });

// ── 1. Los cuadros generados coinciden con el código ────────────────────────
{
  let out = '';
  try {
    out = run(['tools/docgen.mjs', '--check']);
  } catch (e) {
    assert.fail(`Cuadros desactualizados — corre \`node tools/docgen.mjs\`\n${e.stdout || ''}${e.stderr || ''}`);
  }
  assert.match(out, /coinciden con el código/);
  ok('los cuadros de CLAUDE.md · leyes.md · modos-de-juego.md salen del código y están al día');
}

// ── 2. Los marcadores siguen puestos (nadie borró un bloque al editar) ──────
// Sin marcadores, `docgen --check` pasaría trivialmente: no habría nada que
// comparar y la duplicación volvería sin que CI dijera nada.
{
  const EXPECTED = {
    'CLAUDE.md': ['bucles', 'modos'],
    'docs/leyes.md': ['bucles', 'nav'],
    'docs/modos-de-juego.md': ['bucles', 'modos', 'nav'],
    'docs/norte.md': ['nav'],
    'docs/decisiones-pendientes.md': ['nav'],
    'docs/testing.md': ['nav'],
    'docs/estudio-bucles-live.md': ['nav'],
  };
  for (const [file, blocks] of Object.entries(EXPECTED)) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const b of blocks) {
      assert.ok(src.includes(`<!-- GENERADO:${b} -->`) && src.includes(`<!-- /GENERADO:${b} -->`),
        `${file} perdió el bloque GENERADO:${b} — sin marcadores, el cuadro vuelve a mantenerse a mano`);
    }
  }
  const total = Object.values(EXPECTED).reduce((n, b) => n + b.length, 0);
  ok(`los ${total} bloques generados siguen declarados en sus ${Object.keys(EXPECTED).length} documentos`);
}

// ── 2b. NAVEGACIÓN: cada enlace relativo lleva a un sitio que EXISTE ────────
// Ahora los documentos se enlazan entre sí y saltan a secciones concretas
// (`leyes.md#22--confianza`). Un enlace roto en un MD no rompe nada… salvo la
// confianza en la documentación: el que lo sigue acaba en un 404 de GitHub y
// deja de usar el índice. Se comprueban las DOS mitades del enlace: el fichero
// y el ancla. Las anclas se calculan con el MISMO `anchorOf` que las genera.
{
  const { anchorOf, DOC_MAP } = await import('../tools/docmap.mjs');
  const NAVEGABLES = ['CLAUDE.md', 'docs/README.md', ...DOC_MAP.map(d => `docs/${d[1]}`)];
  const anchors = (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    return new Set([...src.matchAll(/^#{1,6} +(.+)$/gm)].map(m => anchorOf(m[1].trim().replace(/\*\*/g, ''))));
  };
  const cache = new Map();
  const anchorsOf = (f) => (cache.has(f) ? cache.get(f) : (cache.set(f, anchors(f)), cache.get(f)));

  // Solo enlaces markdown a un .md del repo (con o sin ancla). Los http(s) y
  // las rutas a código no son cosa de este test.
  const scan = (files) => {
    const broken = [];
    for (const file of files) {
      const dir = dirname(file);
      const src = readFileSync(join(ROOT, file), 'utf8');
      for (const m of src.matchAll(/\]\((?!https?:)([^)\s#]*\.md)(#[^)\s]*)?\)/g)) {
        const target = join(dir, m[1]).split('\\').join('/');
        let exists = true;
        try { readFileSync(join(ROOT, target), 'utf8'); } catch { exists = false; }
        if (!exists) { broken.push(`${file}: fichero inexistente → ${m[1]}`); continue; }
        if (m[2] && !anchorsOf(target).has(m[2].slice(1))) {
          broken.push(`${file}: ancla inexistente → ${m[1]}${m[2]}`);
        }
      }
    }
    return broken;
  };

  const broken = scan(NAVEGABLES);
  assert.deepStrictEqual(broken, [],
    'ENLACES ROTOS EN LA DOCUMENTACIÓN:\n  ' + broken.join('\n  ') + '\n\n'
    + '  El fichero o la sección a la que apuntan ya no existe (renombrada, movida\n'
    + '  o mal escrita). Corrige el enlace, o el encabezado que lo sostenía.');
  ok(`navegación: todos los enlaces .md (fichero + ancla) de los ${NAVEGABLES.length} documentos navegables resuelven`);

  // CONTRA-PRUEBA: un comprobador que no puede fallar no protege de nada. Se
  // fabrican las dos roturas posibles (fichero y ancla) y se exige que las vea.
  {
    const { writeFileSync } = await import('node:fs');
    const file = join(ROOT, 'docs/README.md');
    const original = readFileSync(file, 'utf8');
    try {
      writeFileSync(file, original + '\n[roto](norte.md#seccion-que-no-existe) y [peor](no-existe.md)\n');
      cache.delete('docs/README.md');
      const found = scan(['docs/README.md']);
      assert.strictEqual(found.length, 2, `debía cazar 2 roturas, cazó ${found.length}: ${found.join(' | ')}`);
      ok('CONTRA-PRUEBA: un ancla inventada y un fichero inexistente rompen la comprobación');
    } finally {
      writeFileSync(file, original);
    }
  }
}

// ── 3. CONTRA-PRUEBA: si el código cambia y el MD no, CI lo dice ────────────
// Un generador que no puede fallar no protege de nada. Se simula el cambio
// EDITANDO el cuadro (equivalente a que el código diga otra cosa) y se
// comprueba que `--check` lo detecta; luego se restaura.
{
  const file = join(ROOT, 'CLAUDE.md');
  const original = readFileSync(file, 'utf8');
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, original.replace('| `board` · Tablero |', '| `board` · Tablero MENTIRA |'));
    let detected = false;
    try { run(['tools/docgen.mjs', '--check']); } catch { detected = true; }
    assert.ok(detected, 'un cuadro tocado a mano DEBE romper CI');
    ok('CONTRA-PRUEBA: editar un cuadro a mano rompe la comprobación');
  } finally {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, original);
  }
}

// ── CIFRAS A MANO: si un documento cuenta algo, tiene que salir la cuenta ───
// La auditoría v1.51.402 encontró tres respuestas distintas a "¿cuántas leyes
// hay?" (8 / 10 / 10) y tres a "¿cuántas suites?" (84 / 87 / 89). Son cifras
// escritas a mano en prosa: envejecen calladas, y un documento que se equivoca
// en lo comprobable pierde autoridad en lo que no lo es. Las que hablan del
// PREFLIGHT sí se pueden derivar del código, así que se derivan.
{
  const NUM = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  const pre = readFileSync(join(ROOT, 'tools/preflight.mjs'), 'utf8');
  const redes = (pre.match(/cmd:\s*'[^']+'/g) || []).length;      // suites + recorridos
  const recorridos = redes - 1;                                    // …sin la suite de lógica pura
  const PAT = /\b(\d+|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(redes|recorridos)\b/gi;
  const malas = [];
  for (const rel of ['docs/leyes.md', 'docs/testing.md', 'CLAUDE.md']) {
    const src = readFileSync(join(ROOT, rel), 'utf8').split('\n');
    src.forEach((ln, i) => {
      // Solo las frases que hablan del preflight: "dos redes" en otro contexto
      // (p. ej. las dos que cubren los crashes de primera pantalla) es correcto.
      if (!/preflight/i.test(ln)) return;
      for (const m of ln.matchAll(PAT)) {
        const n = NUM[m[1].toLowerCase()] ?? Number(m[1]);
        const esperado = m[2].toLowerCase() === 'redes' ? redes : recorridos;
        if (n !== esperado) malas.push(`${rel}:${i + 1} dice "${m[0]}" y el preflight tiene ${esperado}`);
      }
    });
  }
  assert.deepStrictEqual(malas, [],
    `cifras del preflight desactualizadas en los docs:\n  ${malas.join('\n  ')}\n`);
  ok(`las cifras del preflight en los docs cuadran con el código (${redes} redes · ${recorridos} recorridos)`);
}

// ── 4. CLAUDE.md es el MAPA, no el diario (dieta del 2026-08-11) ────────────
// La crónica de deuda resuelta lo había llevado a 821 líneas: cada sesión
// añadía su bloque «✅ RESUELTO» y nadie los retiraba — un doc de entrada que
// hay que scrollear entrena a no leerlo. Lo resuelto vive en
// docs/historico/deuda-resuelta.md; aquí se fija que no vuelva a acumularse.
{
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const resueltos = [...claude.matchAll(/^#{3,4} .*(?:✅|RESUELTO|RESUELTA)/gm)].map(m => m[0]);
  assert.deepStrictEqual(resueltos, [],
    `CLAUDE.md acumula deuda RESUELTA (muévela a docs/historico/deuda-resuelta.md):\n  ${resueltos.join('\n  ')}`);
  // PRESUPUESTO de tamaño, no ratchet: CLAUDE.md crece legítimamente con
  // estándares nuevos — pero pasar el tope obliga a PODAR algo o a subir esta
  // constante A CONCIENCIA (con el porqué en el commit), nunca sin darse cuenta.
  const PRESUPUESTO = 560;
  const lineas = claude.split('\n').length;
  assert.ok(lineas <= PRESUPUESTO,
    `CLAUDE.md tiene ${lineas} líneas (presupuesto: ${PRESUPUESTO}) — poda (lo resuelto va a historico) o sube el presupuesto a conciencia`);
  ok(`CLAUDE.md sin bloques resueltos y dentro de presupuesto (${lineas}/${PRESUPUESTO} líneas)`);
}

// ── 5. FICHA y ÁRBOL: cada doc dice qué es y desde dónde se llega ───────────
// Convención del 2026-08-11 (dueño): todo doc vivo lleva una FICHA en su
// cabecera — Tipo (mapa·norma·decisión·guía·plan·generado) + «Sube a» (el
// enlace hijo→padre del árbol) + quién lo Vigila — y es ALCANZABLE desde la
// raíz (CLAUDE.md o docs/README.md lo nombran): el §30 de los docs. Lo
// histórico queda fuera: está congelado a propósito.
{
  const docs = readdirSync(join(ROOT, 'docs')).filter(f => f.endsWith('.md'));
  const TIPOS = /^> \*\*Tipo\*\*: (mapa|norma|decisión|guía|plan|generado)\b/m;
  const raiz = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8') + readFileSync(join(ROOT, 'docs/README.md'), 'utf8');
  const sinFicha = [], sinArbol = [];
  for (const f of docs) {
    const src = readFileSync(join(ROOT, 'docs', f), 'utf8');
    const cabeza = src.split('\n').slice(0, 6).join('\n');
    if (!TIPOS.test(cabeza) || !cabeza.includes('**Sube a**') || !cabeza.includes('**Vigila**')) sinFicha.push(f);
    if (f !== 'README.md' && !raiz.includes(f)) sinArbol.push(f);
  }
  assert.deepStrictEqual(sinFicha, [],
    `docs sin FICHA (> **Tipo**: … · **Sube a**: … · **Vigila**: … en las primeras líneas): ${sinFicha.join(' · ')}`);
  assert.deepStrictEqual(sinArbol, [],
    `docs que NADIE enlaza desde la raíz (CLAUDE.md / docs/README.md) — el árbol tiene ramas sueltas: ${sinArbol.join(' · ')}`);
  // CONTRA-PRUEBA: la ficha exige un tipo VÁLIDO, no cualquier blockquote.
  assert.ok(!TIPOS.test('> **Tipo**: diario · **Sube a**: x · **Vigila**: y'), 'un tipo inventado no pasa');
  assert.ok(TIPOS.test('> **Tipo**: guía · **Sube a**: x · **Vigila**: y'), 'y uno válido sí');
  ok(`ficha y árbol: los ${docs.length} docs declaran qué son y cuelgan de la raíz`);
}

console.log(`\n  ${passed} docs checks passed`);
