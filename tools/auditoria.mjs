// AUDITORÍA MECÁNICA — los barridos DETERMINISTAS del skill /auditoria (§30).
//
// Este fichero hace solo lo que una máquina puede decidir sola; lo que pide
// criterio (¿esta excepción sigue haciendo falta?) lo dirige el skill
// probando a quitarla y corriendo su test. Tres barridos:
//
//   1. CITAS ROTAS — todo camino de fichero citado en CLAUDE.md y docs/*.md
//      tiene que existir. Nació de un caso real: CLAUDE.md prometió durante
//      versiones que el ritual de entrega vivía en `.claude/skills/entregar/`
//      y ese directorio NO estaba en el repo — el ritual vivía en la memoria.
//      (docs/historico/ queda fuera: es crónica congelada, sus citas describen
//      el pasado.)
//
//   2. EXPORTS MUERTOS — `tests/huerfanos.test.mjs` comprueba que cada MÓDULO
//      sea alcanzable; nadie comprobaba que cada EXPORT tuviera quien lo
//      nombre. Heurística deliberadamente conservadora: un export se da por
//      vivo si su nombre aparece en CUALQUIER otro fichero (import, uso o
//      comentario). Sobre-aproxima la vida → lo que marca como muerto lo está
//      de verdad, y un auditor que no grita en falso se puede obedecer.
//
//   3. INVENTARIO DE EXCEPCIONES — enumera las listas ALLOW/PUERTAS/EXCLUDED/
//      BASELINE/CONGELADO/EXCEPCIONES del repo con su tamaño, para que la
//      pasada humana sepa dónde probar a apretar. Este barrido INFORMA, no
//      falla: apretar un ratchet es decisión, no mecánica.
//
//   node tools/auditoria.mjs            # barridos 1+2 (fallan con basura) + 3
//   node tools/auditoria.mjs --listas   # solo el inventario de excepciones
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloListas = process.argv.includes('--listas');
let fallos = 0;
const ok = (m) => console.log('  ✅', m);
const mal = (m) => { fallos++; console.log('  ❌', m); };

/** Camina un directorio y devuelve rutas relativas que pasen el filtro. */
function walk(dir, filtro, acc = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`;
    if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, filtro, acc);
    else if (filtro(rel)) acc.push(rel);
  }
  return acc;
}
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── 1. CITAS ROTAS en los docs de entrada ───────────────────────────────────
// CRÓNICA declarada: menciones legítimas de ficheros que YA NO EXISTEN (la ley
// §30 cuenta los tumores que borró, testing.md enseña con un nombre de ejemplo,
// un handoff nombra una red PENDIENTE de construir). Cada entrada lleva motivo,
// y es un ratchet: si el fichero vuelve a existir, la entrada sobra y CI lo dice.
const CITAS_CRONICA = {
  'docs/leyes.md → views/sorteoView.js': 'tumor borrado — §30 cuenta la historia',
  'docs/leyes.md → core/tts.js': 'tumor borrado — §30',
  'docs/leyes.md → themes/colegios/skin.css': 'tumor borrado — §30',
  'docs/leyes.md → tools/test.html': 'tumor borrado — §30',
  'docs/leyes.md → kernel/contracts/realtimePort.js': 'tumor borrado — §30',
  'docs/leyes.md → styles/quiz.css': 'crónica §3b: la hoja quedó vacía al nacer opcion.css y se retiró',
  'docs/testing.md → tests/mifeature.test.mjs': 'nombre de EJEMPLO del patrón de suite',
  'docs/handoff-ia-contenido.md → tools/ia-smoke.mjs': 'red PENDIENTE de construir (el handoff la encarga)',
  'templates/HOW_TO_ADD.md → templates/miplantilla/scorer.js': 'nombre de EJEMPLO de la guía',
};
if (!soloListas) {
  const docs = ['CLAUDE.md',
    ...walk('docs', (p) => p.endsWith('.md') && !p.includes('historico')),
    // Los README que viven junto al código también prometen ficheros
    // (kernel/README.md citaba el realtimePort borrado como si siguiera vivo).
    ...walk('kernel', (p) => p.endsWith('.md')),
    ...walk('templates', (p) => p.endsWith('.md'))];
  // Caminos con pinta de fichero del repo, citados con `backticks` o enlace md.
  const RE_CITA = /[`(]((?:\.claude|core|views|kernel|adapters|templates|tools|tests|styles|themes|docs|qa)\/[\w./-]+\.[a-z0-9]{2,5})[`)#]/g;
  const rotas = [];
  for (const doc of docs) {
    const src = leer(doc);
    for (const m of src.matchAll(RE_CITA)) {
      const cita = `${doc} → ${m[1]}`;
      if (!existsSync(join(ROOT, m[1])) && !CITAS_CRONICA[cita]) rotas.push(cita);
    }
  }
  const unicas = [...new Set(rotas)];
  if (unicas.length) mal(`CITAS ROTAS (el doc promete un fichero que no existe):\n     ${unicas.join('\n     ')}`);
  else ok(`citas: todo camino citado en CLAUDE.md y docs/ existe (${docs.length} docs barridos, ${Object.keys(CITAS_CRONICA).length} crónicas declaradas)`);
  // Ratchet de la crónica: una excepción cuyo fichero EXISTE es una excepción muerta.
  const caducas = Object.keys(CITAS_CRONICA).filter(c => existsSync(join(ROOT, c.split(' → ')[1])));
  if (caducas.length) mal(`excepciones de crónica caducas (el fichero existe): ${caducas.join(' · ')}`);
}

// ── 2. EXPORTS MUERTOS ──────────────────────────────────────────────────────
// Exports que se quedan a propósito, con su motivo (ratchet: solo ENCOGE).
const EXPORTS_PERMITIDOS = {
  // (vacío — si un export muerto debe quedarse, decláralo 'modulo.js#nombre'
  // con el motivo al lado. Un export sin importador y sin motivo se BORRA.)
};
if (!soloListas) {
  const fuentes = ['main.teacher.js', 'main.student.js', 'main.embed.js'].filter(f => existsSync(join(ROOT, f)));
  for (const d of ['core', 'views', 'kernel', 'adapters', 'templates']) walk(d, (p) => p.endsWith('.js'), fuentes);
  // Los HTML de raíz también CONSUMEN: `test.html` importa `submitQaRound`
  // directamente y la primera pasada lo dio por muerto — un auditor que grita
  // en falso una vez ya no se le obedece a la segunda.
  const htmlRaiz = readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const consumidores = [...fuentes, ...htmlRaiz,
    ...walk('tools', (p) => p.endsWith('.mjs') || p.endsWith('.html')),
    ...walk('tests', (p) => p.endsWith('.mjs'))]
    .filter(f => existsSync(join(ROOT, f)));
  const textos = new Map(consumidores.map(f => [f, leer(f)]));
  const muertos = [];
  for (const f of fuentes) {
    const src = textos.get(f) ?? leer(f);
    const nombres = new Set();
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) nombres.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const parte of m[1].split(',')) {
        const alias = parte.trim().split(/\s+as\s+/).pop().trim();
        if (alias) nombres.add(alias);
      }
    }
    for (const n of nombres) {
      // NO `\b`: con nombres que no son "de palabra" (`$`, `$$`) el \b nunca
      // casa y el barrido los dio por muertos CON TRES VISTAS importándolos —
      // el falso positivo que tumbó la matriz en la primera pasada. Lookaround
      // sobre el nombre escapado: vale para cualquier identificador JS.
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![\\w$])${esc}(?![\\w$])`);
      const vivo = consumidores.some(c => c !== f && re.test(textos.get(c)));
      if (!vivo && !EXPORTS_PERMITIDOS[`${f}#${n}`]) muertos.push(`${f} → ${n}`);
    }
  }
  if (muertos.length) mal(`EXPORTS MUERTOS (nadie los nombra fuera de su fichero — §30, se borran):\n     ${muertos.join('\n     ')}`);
  else ok(`exports: ${fuentes.length} módulos barridos, ninguno exporta algo que nadie nombra`);
  // CONTRA-PRUEBA de los DOS detectores, sobre entrada sintética: un barrido
  // cuyo regex se rompa daría "todo limpio" para siempre, que es el peor verde.
  {
    const citaFalsa = 'ver `core/__fichero_que_no_existe.js` para el detalle';
    const RE = /[`(]((?:\.claude|core|views|kernel|adapters|templates|tools|tests|styles|themes|docs|qa)\/[\w./-]+\.[a-z0-9]{2,5})[`)#]/g;
    if (![...citaFalsa.matchAll(RE)].length) mal('CONTRA-PRUEBA rota: el detector de citas no ve una cita');
    const modFalso = "export function __muerto() {}\nexport const __tambien = 1;";
    const vistos = [...modFalso.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
    if (vistos.join(',') !== '__muerto,__tambien') mal('CONTRA-PRUEBA rota: el detector de exports no ve un export');
  }
}

// ── 3. INVENTARIO DE EXCEPCIONES (informa, no falla) ────────────────────────
{
  const ficheros = [...walk('tests', (p) => p.endsWith('.mjs')), ...walk('core', (p) => p.endsWith('.js')),
                    ...walk('tools', (p) => p.endsWith('.mjs'))];
  const RE_LISTA = /(?:const|let)\s+((?:[A-Z][A-Z0-9_]*_)?(?:ALLOW|PUERTAS|EXCLUDED|BASELINE|CONGELADO|EXCEPCIONES|ESCRITORES)[A-Z0-9_]*)\s*=\s*(\[[^\]]*\]|\{)/g;
  const listas = [];
  for (const f of ficheros) {
    const src = leer(f);
    for (const m of src.matchAll(RE_LISTA)) {
      let n;
      if (m[2].startsWith('[')) n = (m[2].match(/'/g) || []).length / 2;
      else {
        // objeto: contar hasta el cierre de llaves al mismo nivel
        let depth = 0, i = src.indexOf(m[2], m.index), claves = 0;
        for (; i < src.length; i++) {
          if (src[i] === '{') depth++;
          if (src[i] === '}') { depth--; if (!depth) break; }
          if (depth === 1 && src[i] === ':') claves++;
        }
        n = claves;
      }
      listas.push({ f, nombre: m[1], n });
    }
  }
  listas.sort((a, b) => b.n - a.n);
  console.log(`\n  📋 ${listas.length} listas de excepción (la pasada humana prueba a APRETAR las gordas):`);
  for (const { f, nombre, n } of listas.filter(l => l.n > 0).slice(0, 15)) {
    console.log(`     ${String(n).padStart(3)}  ${nombre}  (${f})`);
  }
  const vacias = listas.filter(l => l.n === 0).length;
  if (vacias) console.log(`     …y ${vacias} ya en CERO (así se quedan).`);
}

if (!soloListas) {
  console.log(fallos ? `\n❌ auditoría mecánica: ${fallos} clase(s) de basura` : '\n✅ auditoría mecánica limpia');
  process.exit(fallos ? 1 : 0);
}
