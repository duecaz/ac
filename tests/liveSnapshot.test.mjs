// §22-2 — LA CLAVE NO VIAJA EN LA SALA.
//
// `live_sessions` tiene lectura ABIERTA por necesidad (el alumno anónimo entra
// con el PIN), y ahí se guardaba la actividad ENTERA: cualquiera con el PIN —o
// listando salas— se leía todas las respuestas. R5 (payload de ronda sin
// solución) no protegía nada, porque el propio móvil se construía el payload en
// local desde ese snapshot.
//
// Aquí se fija que el snapshot de sala no contiene la solución de NINGUNA de las
// 13 plantillas, que aun así se puede JUGAR con él (contra-prueba: una sanitización
// demasiado agresiva rompe al alumno real) y que la excepción de la carrera libre
// está declarada, no escondida.
//
// Run: node tests/liveSnapshot.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { listTemplates, getTemplate } from '../core/registry.js';
import { studentSnapshot, visibleItem, isStudentSnapshot, needsClientKey } from '../core/liveSnapshot.js';
import { sessionItems, roundPayloadOf } from '../kernel/session/engine.js';
import { RULES } from '../core/pbRules.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Campos que el snapshot PUEDE llevar (whitelist del módulo) + los que añade.
const ALLOWED = new Set(['id', 'title', 'template', 'presentation', 'live', 'rules',
  'scoring', 'schemaVersion', 'payloads', 'content', 'itemCount', 'appVersion',
  // `sanitized`: la MARCA de "esto viene sin clave". El móvil la lee para saber
  // si puede juzgar en local; sin ella daba por fallada hasta una hoja perfecta.
  'sanitized']);

// Actividad de prueba por plantilla, con contenido en el campo que cada modelo usa.
function seed(name) {
  const T = getTemplate(name);
  const model = T?.meta?.contentModel;
  const base = { id: 'a1', template: name, title: 'T', live: { questionTimer: 20 }, presentation: {} };
  const byModel = {
    qa: { items: [
      { id: 'q_1', q: '¿2+2?', a: '4', options: ['4', '5', '6'], points: 1 },
      { id: 'q_2', q: '¿3+3?', a: '6', options: ['6', '7'], points: 1 },
    ] },
    pairs: { pairs: [
      { id: 'p_1', left: 'perro', right: 'dog' },
      { id: 'p_2', left: 'gato', right: 'cat' },
    ] },
    items: { items: [{ id: 'it_1', question: 'Pregunta 1' }, { id: 'it_2', question: 'Pregunta 2' }] },
    words: { words: [{ id: 'w_1', text: 'casa' }, { id: 'w_2', text: 'mesa' }] },
    textCorrection: { passages: [
      { id: 'ps_1', text: 'cafe con leche', marks: [{ at: 3, char: 'é' }] },
      { id: 'ps_2', text: 'mas o menos', marks: [{ at: 2, char: 'á' }] },
    ] },

  };
  return { ...base, content: byModel[model] || byModel.qa };
}

const deep = (v) => JSON.stringify(v ?? null);

// Normaliza para comparar payloads: algunas plantillas BARAJAN las opciones
// (Emparejar/Memoria), así que dos llamadas legítimas no son idénticas. Se
// ordenan los arrays para comparar CONTENIDO, no orden.
function stable(v) {
  if (Array.isArray(v)) return v.map(stable).sort((a, b) => (deep(a) < deep(b) ? -1 : 1));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])]));
  }
  return v;
}

// ── 1. El snapshot NO lleva más que payloads + metadatos ────────────────────
//
// Por qué así y no "buscar la respuesta como cadena": en una pregunta de opción
// múltiple la solución ES uno de los textos visibles, y en Emparejar las dos
// columnas se ven — el secreto es la ASOCIACIÓN, no un string. Lo que sí se puede
// fijar sin ambigüedad es que del contenido no viaja NADA salvo el payload de
// ronda, y que ese payload ya está probado libre de solución para las 13
// plantillas en tests/answerSafety.test.mjs. Esa es la cadena de garantía.
{
  const names = [];
  for (const T of listTemplates()) {
    const name = T.meta.name;
    const act = seed(name);
    // OJO: se cuenta ANTES de pedir el snapshot. Ordena las Pelotas NORMALIZA su
    // contenido al construir el payload (`ensureContent` genera el tablero), así
    // que pedirlo cambia el nº de ítems de la actividad. Por eso createRoom
    // calcula el snapshot y GUARDA esa misma actividad como clave: los dos lados
    // ven el mismo tablero.
    const n = sessionItems(act).length;
    const snap = studentSnapshot(act);

    for (const k of Object.keys(snap)) {
      assert.ok(ALLOWED.has(k), `${name}: el snapshot incluye "${k}", que no está en la whitelist → puede arrastrar contenido`);
    }
    // El contenido se suelta: solo quedan huecos para poder CONTAR ítems.
    assert.deepStrictEqual(snap.content, { items: Array.from({ length: n }, () => ({})) },
      `${name}: content debe quedar en huecos vacíos, no copiarse`);
    assert.strictEqual(snap.itemCount, n, `${name}: itemCount debe conservar el nº de ítems`);
    // Y los payloads son EXACTAMENTE los que ya audita answerSafety.
    for (let i = 0; i < n; i++) {
      assert.deepStrictEqual(stable(snap.payloads[i]), stable(roundPayloadOf(T, act, i, null) ?? null),
        `${name}: el payload ${i} del snapshot debe ser el mismo que audita answerSafety`);
    }
    names.push(name);
  }
  assert.ok(names.length >= 12, `deberían auditarse las 13 plantillas, se auditaron ${names.length}`);
  ok(`${names.length} plantillas: del contenido solo viaja el payload de ronda (+ whitelist)`);
}

// ── 1b. Casos donde la fuga SÍ es una cadena: que no aparezca ───────────────
{
  // Respuesta abierta (no está entre las opciones): el campo `a` no puede viajar.
  const act = { id: 'a1', template: 'quiz', title: 'T', live: {}, presentation: {},
    content: { items: [{ id: 'q_1', q: 'Capital de Francia', a: 'PARISSECRETO', points: 1 }] } };
  assert.ok(!deep(studentSnapshot(act)).includes('PARISSECRETO'),
    'la respuesta abierta de Quiz NO puede viajar en el snapshot');

  // Tildes/Comas: las marcas SON la solución (dónde va el acento).
  const act2 = { id: 'a2', template: 'tildes', title: 'T', live: {}, presentation: {},
    content: { passages: [{ id: 'ps_1', text: 'cafe con leche', marks: [{ at: 3, char: 'MARCASECRETA' }] }] } };
  assert.ok(!deep(studentSnapshot(act2)).includes('MARCASECRETA'),
    'las marcas de Tildes NO pueden viajar en el snapshot');
  ok('fugas comprobables como cadena (respuesta abierta, marcas de tildes): cerradas');
}

// ── 2. Contra-prueba: con el snapshot todavía se puede JUGAR ────────────────
{
  const act = seed('quiz');
  const snap = studentSnapshot(act);
  const T = getTemplate('quiz');
  assert.ok(isStudentSnapshot(snap), 'el snapshot se reconoce como saneado');
  // Cuenta de ítems (la vista del alumno numera preguntas y pinta cajas).
  assert.strictEqual(sessionItems(snap).length, sessionItems(act).length, 'el nº de ítems se conserva');
  // El payload de ronda sigue llegando — y es el MISMO que calcularía el host.
  const fromSnap = roundPayloadOf(T, snap, 0);
  const fromFull = roundPayloadOf(T, act, 0);
  assert.deepStrictEqual(stable(fromSnap), stable(fromFull), 'el alumno recibe el mismo payload de ronda que antes');
  assert.ok(fromSnap && Object.keys(fromSnap).length > 0, 'el payload no viene vacío (habría pantalla en blanco)');
  // Config y tema, que la vista del alumno necesita.
  assert.strictEqual(snap.live.questionTimer, 20, 'la config de live viaja');
  assert.strictEqual(snap.template, 'quiz', 'la plantilla viaja');
  ok('contra-prueba: con el snapshot saneado el alumno sigue pudiendo jugar');
}

// ── 3. Pedir la palabra lee del PAYLOAD, no del contenido ──────────────────
{
  const act = seed('question-live');
  const snap = studentSnapshot(act);
  assert.strictEqual(visibleItem(snap, 1)?.question, 'Pregunta 2',
    'el enunciado de "pedir la palabra" sigue disponible desde el payload');
  assert.strictEqual(visibleItem(act, 1)?.question, 'Pregunta 2',
    'visibleItem funciona igual con la actividad completa (host)');
  ok('visibleItem: el enunciado sale del payload en ambos lados');
}

// ── 4. La excepción de la carrera está DECLARADA ───────────────────────────
{
  assert.strictEqual(needsClientKey('race'), true, 'la carrera libre necesita clave en el móvil (juzga en local)');
  for (const phase of ['question', 'reveal', 'question-live', 'lobby', 'podium', undefined]) {
    assert.strictEqual(needsClientKey(phase), false, `la fase ${phase} NO justifica mandar la clave`);
  }
  ok('needsClientKey: solo la carrera libre, y está dicho en el módulo');
}

// ── 4b. La sala lleva la VERSIÓN del profe y el alumno desfasado se recarga ──
// El bug real de la primera partida en producción: móviles con módulos JS
// cacheados (el F5 no refresca ES modules) + snapshot nuevo = pantalla muerta al
// pasar de lobby a pregunta. La sala declara la versión y el alumno se
// auto-recarga UNA vez si no coincide.
{
  const { VERSION } = await import('../core/constants.js');
  const snap = studentSnapshot({ id: 'a', template: 'quiz', content: { items: [] } });
  assert.strictEqual(snap.appVersion, VERSION, 'el snapshot declara la versión de la app del profe');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../views/studentLive.js', import.meta.url), 'utf8');
  assert.match(src, /activity\.appVersion !== VERSION/, 'studentLive compara su versión con la de la sala');
  assert.match(src, /ww\.vreload\./, 'y la recarga es UNA vez por sala (flag), no un bucle');
  // La recarga tiene que ser DURA: un reload/cache-buster de página no refresca
  // los ES modules (GitHub Pages: max-age=600) — hay que re-pedir cada módulo
  // con cache:'reload' ANTES de recargar (core/appRefresh.js), o el móvil vuelve
  // a arrancar con el mismo grafo mezclado (el bug de v1.51.335).
  assert.match(src, /refreshAppGraph/, 'la auto-actualización refresca el GRAFO (cache:reload), no solo la página');
  const refresher = readFileSync(new URL('../core/appRefresh.js', import.meta.url), 'utf8');
  assert.match(refresher, /cache:\s*'reload'/, 'refreshAppGraph re-pide con cache:reload (lo único que salta el max-age)');
  assert.match(refresher, /getEntriesByType/, 'y enumera los recursos realmente cargados por esta página');
  // Los botones "Borrar caché"/"Actualizar" de los HTML hacen lo mismo: antes
  // borraban CacheStorage (vacío) y dejaban intacta la caché HTTP real.
  for (const page of ['student.html', 'teacher.html']) {
    const htmlSrc = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.match(htmlSrc, /cache:\s*'reload'/, `${page}: el botón de limpiar caché re-pide los recursos con cache:reload`);
  }
  ok('versión de sala: la auto-actualización y los botones de caché refrescan el grafo de módulos de verdad');
}

// ── 5. La colección de la clave está CERRADA ───────────────────────────────
{
  const r = RULES.live_keys;
  assert.ok(r, 'live_keys debe estar declarada en core/pbRules.js');
  for (const k of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
    assert.ok(r[k] && r[k].includes('@request.auth.id'),
      `live_keys.${k} debe exigir sesión (vale ${JSON.stringify(r[k])}) — es donde vive la solución`);
  }
  // Y la sala sigue de lectura abierta a propósito (el alumno entra por PIN).
  assert.strictEqual(RULES.live_sessions.listRule, '', 'la sala sigue legible sin cuenta (PIN)');
  ok('live_keys cerrada a quien no tiene sesión; la sala sigue abierta por el PIN');
}

console.log(`\nliveSnapshot.test: ${passed} checks passed`);
