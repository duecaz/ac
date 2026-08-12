// §30b · TODA RUTA TIENE UNA DECISIÓN ESCRITA.
//
// `views/sorteoView.js` no fue un accidente aislado: fue una PANTALLA ENTERA que
// vivió meses con su ruta registrada, sin un enlace que llevara a ella y sin que
// el dueño del proyecto supiera que existía («eso no lo tenemos, ¿te confundes
// con la actividad Ruleta?»). Se borró, y §30 · ALCANZABLE cerró la mitad del
// agujero: caza el módulo que nadie importa y la ruta que nadie enlaza.
//
// Pero queda la otra mitad, que es la que de verdad lo dejó nacer: **una ruta
// puede estar perfectamente enlazada y aun así no responder a ninguna decisión
// de producto**. El sorteo tenía enlace el día que se escribió; lo perdió
// después, y nadie se enteró porque nunca hubo una línea en el norte que dijera
// qué pintaba ahí.
//
// LA REGLA: cada ruta del router tiene su fila en `DECIDIDA_EN` (abajo) citando
// la SECCIÓN del norte que la justifica y qué pinta ahí — y esa sección tiene
// que existir de verdad. Nada nace sin decisión escrita.
//
// Esto NO es burocracia: es lo que convierte «¿por qué existe esta pantalla?» en
// una pregunta con respuesta, en vez de en arqueología.
//
// Run: node tests/rutasNorte.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(ROOT, f), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// CADA RUTA, DÓNDE SE DECIDE. La sección del norte que la justifica y la frase
// que resume qué pinta ahí. No se exige que el norte escriba `#/mine` —el norte
// habla de PANTALLAS, no de URLs, y llenarlo de almohadillas lo haría ilegible—:
// se exige que alguien haya tenido que ESCRIBIR aquí de dónde sale, y que la
// sección citada exista de verdad.
//
// Añadir una ruta sin añadir su fila rompe CI. Esa es toda la ley.
const DECIDIDA_EN = {
  // — El profe —
  '#/':            ['§7c', 'la raíz decide a dónde va cada quien: con sesión, a Mis actividades; sin ella, la portada'],
  '#/home':        ['§7c', 'alias histórico de «Mis actividades» (la casa del profe)'],
  '#/mine':        ['§7c', 'Mis actividades: la casa del profe, primera entrada del menú'],
  '#/explore':     ['§7c', 'Biblioteca: lo de otros profes, para reutilizar'],
  '#/juegos':      ['§4c', 'la estantería de los juegos, dentro del mismo catálogo'],
  '#/reports':     ['§7c', 'Informes: después de clase, cuarta entrada del menú'],
  '#/reports/session': ['§7', 'el informe de UNA sala, al terminar el tramo en vivo'],
  '#/autor':       ['§7c', 'perfil del autor: el aliciente para armar bien las actividades (como Wordwall)'],
  '#/moderar':     ['§7c', 'denuncias de la biblioteca pública; solo admin'],
  '#/registro':    ['§7c', 'alta de profe por correo (decisión 2026-08-11): no todo profe tiene Google, y sin cuenta no hay creación ni salas'],
  '#/admin':       ['§3b', 'el panel del dueño: colecciones, tests, capacidad. No es del profe de aula'],
  // — Crear y editar (tramo buscar/crear) —
  '#/new':         ['§1b', 'crear la actividad: la vía (c) del ANTES'],
  '#/edit':        ['§1b', 'editar contenido propio: el editor del tramo buscar/crear'],
  '#/edit-new':    ['§1b', 'el editor estrenando actividad; misma pantalla que #/edit'],
  '#/new-list':    ['§7b', 'listas de actividades: encadenar varias para una clase'],
  '#/edit-list':   ['§7b', 'editar una lista ya creada'],
  '#/list':        ['§7b', 'jugar una lista encadenada'],
  // — Jugar (los cinco modos de §3b/§7b) —
  '#/play':        ['§7b', 'modo Individual: la actividad en pantalla completa'],
  '#/vs':          ['§7b', 'modo VS (duelo) en la misma pantalla'],
  '#/teams':       ['§7b', 'modo Equipos en la misma pantalla'],
  '#/memory':      ['§7b', 'Memoria monta su propio Equipos (rejilla compartida): es el modo, no una pantalla nueva'],
  '#/launch':      ['§7b', 'abrir una sala En vivo (PIN + QR)'],
  '#/host':        ['§7b', 'la pantalla del profe DENTRO de una sala ya abierta'],
  '#/tasks':       ['§7b', 'crear y gestionar Tareas de una actividad'],
  '#/task':        ['§7b', 'los intentos de una tarea (informe del profe)'],
  // — El alumno: dos entradas, y ninguna es del menú (§7c) —
  '#/join':        ['§7c', 'la entrada del alumno por PIN, desde su móvil'],
  '#/play/:code':  ['§7c', 'el alumno jugando en la sala en vivo'],
};

/** Rutas del router, leídas del código (no de una lista). */
function rutasDelRouter() {
  const mains = readdirSync(ROOT).filter(f => /^main\.[a-z]+\.js$/.test(f));
  const out = new Set();
  for (const m of mains) {
    for (const r of leer(m).matchAll(/route\('([^']+)'/g)) out.add(r[1].split('/:')[0]);
  }
  return out;
}

// ── 1. Ninguna ruta sin decisión escrita ───────────────────────────────────
{
  const rutas = rutasDelRouter();
  assert.ok(rutas.size >= 20, `solo se leyeron ${rutas.size} rutas: el parser no está mirando bien`);
  const huerfanas = [...rutas].filter(r => !(r in DECIDIDA_EN));
  assert.deepStrictEqual(huerfanas, [],
    `rutas SIN decisión escrita: ${huerfanas.join(' · ')}\n` +
    '   → añade su fila en DECIDIDA_EN citando la sección del norte que la justifica, o borra la ruta.');
  ok(`${rutas.size} rutas del router: todas citan la sección del norte que las decide`);
}

// ── 2. Las secciones citadas EXISTEN en el norte ───────────────────────────
// Sin esto, la tabla se convertiría en un trámite: cualquiera pone "§9" y pasa.
{
  const norte = leer('docs/norte.md');
  const secciones = new Set([...norte.matchAll(/^## (\d+[a-z]?)\./gm)].map(m => '§' + m[1]));
  const inventadas = [...new Set(Object.values(DECIDIDA_EN).map(([sec]) => sec))].filter(sec => !secciones.has(sec));
  assert.deepStrictEqual(inventadas, [],
    `DECIDIDA_EN cita secciones que no existen en el norte: ${inventadas.join(' · ')}`);
  ok(`las ${secciones.size} secciones del norte son reales: ninguna ruta cita una inventada`);
}

// ── 3. La tabla no puede pudrirse ──────────────────────────────────────────
// Una fila que ya no corresponde a ninguna ruta es un permiso fantasma: queda
// ahí, nadie la borra, y el día que alguien crea una ruta con ese nombre nace
// justificada sin que nadie lo haya decidido.
{
  const rutas = rutasDelRouter();
  const muertas = Object.keys(DECIDIDA_EN).filter(r => !rutas.has(r) && !r.includes('/:'));
  assert.deepStrictEqual(muertas, [],
    `DECIDIDA_EN describe rutas que ya no existen: ${muertas.join(' · ')} — quítalas`);
  ok('sin fichas fantasma: cada fila corresponde a una ruta viva');
}

// ── 4. CONTRA-PRUEBA: el sorteo de esta semana no habría pasado de aquí ────
{
  const cazada = ['#/sorteo'].filter(r => !(r in DECIDIDA_EN));
  assert.deepStrictEqual(cazada, ['#/sorteo'],
    'una ruta nueva sin ficha SÍ se caza (si esto falla, el guardián no guarda nada)');
  ok('CONTRA-PRUEBA: la pantalla huérfana que borramos no habría llegado a existir');
}

console.log(`\n  ${passed} rutasNorte checks passed`);
