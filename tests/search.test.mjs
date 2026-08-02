// EL BUSCADOR — el tramo por el que pasa TODA clase, y el que peor cubierto
// estaba (0,29 test/código; ver `docs/arquitectura-modulos.md`).
//
// La regla de producto está DECIDIDA (`docs/norte.md` §2b): **buscar es
// BINARIO**. El profe teclea el tema y en dos toques la actividad aparece o no
// aparece; si no aparece, se va a crear. Así que un falso negativo no es una
// molestia: es mandar al profe a crear, con la clase delante, algo que YA
// tenía. Cada test de aquí es un falso negativo que no puede volver.
//
// Run: node tests/search.test.mjs
import assert from 'node:assert';
import { fold, matches, haystackOf, searchActivities } from '../core/search.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const act = (id, title, extra = {}) => ({ id, title, template: 'quiz', ...extra });

const BIBLIOTECA = [
  act('a1', 'Puntos notables del triángulo', { tags: ['geometría', '5º'] }),
  act('a2', 'Matemáticas — fracciones', { subtitle: 'Sumar y restar' }),
  act('a3', 'La célula', {
    content: { items: [
      { q: '¿Qué orgánulo produce la energía?', a: 'La mitocondria' },
      { q: '¿Dónde está el ADN?', a: 'En el núcleo' },
    ] },
  }),
  act('a4', 'Repaso del tema 3', { template: 'match' }),
];

// ── 1. Sin tildes ni mayúsculas ────────────────────────────────────────────
// En una pizarra táctil se teclea rápido y mal. Un acento no puede decidir si
// el profe encuentra su actividad o se pone a rehacerla.
{
  assert.strictEqual(fold('Matemáticas'), 'matematicas');
  assert.ok(matches(BIBLIOTECA[1], 'matematicas'), 'sin tilde debe encontrar la que la lleva');
  assert.ok(matches(BIBLIOTECA[1], 'MATEMÁTICAS'), 'mayúsculas iguales');
  assert.ok(matches(BIBLIOTECA[0], 'triangulo'), 'triangulo → triángulo');
  assert.ok(matches(BIBLIOTECA[0], 'geometria'), 'también en los tags');
  ok('sin tildes ni mayúsculas: "matematicas" encuentra "Matemáticas"');
}

// ── 2. Por palabras y en cualquier orden (Y lógica) ────────────────────────
// El profe recuerda el TEMA, no el título literal.
{
  assert.ok(matches(BIBLIOTECA[0], 'notables puntos'), 'el orden no debe decidir');
  assert.ok(matches(BIBLIOTECA[0], 'puntos triangulo'), 'palabras separadas en el título');
  assert.ok(!matches(BIBLIOTECA[0], 'puntos fracciones'), 'una palabra que no está ⇒ no casa (es Y, no O)');
  ok('por palabras y en cualquier orden: "notables puntos" encuentra "Puntos notables…"');
}

// ── 3. También DENTRO del contenido ────────────────────────────────────────
// El tema muchas veces no está en el título, está en las preguntas.
{
  assert.ok(matches(BIBLIOTECA[2], 'mitocondria'), 'una respuesta del contenido');
  assert.ok(matches(BIBLIOTECA[2], 'adn nucleo'), 'dos ítems distintos, ambas palabras');
  assert.ok(!matches(BIBLIOTECA[2], 'fotosintesis'), 'lo que no está, no está');
  ok('busca dentro del contenido: "mitocondria" encuentra "La célula"');
}

// ── 3b. Genérico, sin `switch` por plantilla ───────────────────────────────
// Una plantilla nueva queda buscable sin tocar `core/search.js`. Se comprueba
// con las OTRAS colecciones que usan las 13 (pairs, words, passages…).
{
  const pares = act('p1', 'Sin título útil', { template: 'match', content: { pairs: [{ left: 'Corazón', right: 'Bombea la sangre' }] } });
  const sopa = act('w1', 'Sopa', { template: 'wordsearch', content: { words: ['esdrújula', 'aguda'] } });
  assert.ok(matches(pares, 'corazon'), 'content.pairs');
  assert.ok(matches(sopa, 'esdrujula'), 'content.words');
  ok('recorre cualquier colección de contenido (pairs · words · …) sin conocer la plantilla');
}

// ── 4. Las imágenes en data-URL no son texto ───────────────────────────────
// Una imagen inline son miles de caracteres base64: indexarla haría casar
// búsquedas por casualidad (un falso POSITIVO es igual de malo) y recorrerla en
// cada tecla congelaría la pizarra (ley §25: hasta 2 MB por actividad).
{
  const conFoto = act('i1', 'Mapa de España', {
    content: { items: [{ image: 'data:image/png;base64,' + 'AQIDBAUGBwgJ'.repeat(2000) }] },
  });
  const hay = haystackOf(conFoto);
  assert.ok(hay.includes('mapa'), 'el título sí se indexa');
  assert.ok(!hay.includes('base64'), 'la data-URL no entra en el índice');
  assert.ok(hay.length < 4200, `el índice está acotado (${hay.length} caracteres)`);
  ok('las imágenes inline no entran en el índice (ni falso positivo ni pizarra congelada)');
}

// ── 5. El filtro por plantilla, y el filtro vacío ──────────────────────────
{
  assert.strictEqual(searchActivities(BIBLIOTECA, {}).length, 4, 'sin término no filtra nada');
  assert.strictEqual(searchActivities(BIBLIOTECA, { q: '   ' }).length, 4, 'solo espacios tampoco filtra');
  assert.deepStrictEqual(searchActivities(BIBLIOTECA, { template: 'match' }).map(a => a.id), ['a4']);
  assert.deepStrictEqual(searchActivities(BIBLIOTECA, { q: 'repaso', template: 'quiz' }).map(a => a.id), [],
    'plantilla Y término: los dos tienen que casar');
  ok('filtro por plantilla + término vacío: se comportan como espera el profe');
}

// ── 6. El orden de la lista se CONSERVA ────────────────────────────────────
// La home ordena por fecha antes de filtrar. Un buscador que reordena movería
// las tarjetas bajo el dedo del profe mientras teclea.
{
  const r = searchActivities(BIBLIOTECA, { q: 'a' });
  const orden = BIBLIOTECA.filter(a => r.includes(a)).map(a => a.id);
  assert.deepStrictEqual(r.map(a => a.id), orden);
  ok('conserva el orden de entrada: las tarjetas no bailan mientras se teclea');
}

// ── 7. La biblioteca busca lo MISMO, con los datos donde los tiene ─────────
// En la biblioteca la actividad viaja dentro de `row.data` y los tags en la
// FILA. Estaba escrito dos veces, con dos criterios: ahora es el mismo módulo,
// y devuelve las FILAS originales (la vista necesita `row.language`, `row.id`…).
{
  const filas = [
    { id: 'r1', tags: ['ortografía'], language: 'es', data: act('a9', 'Tildes en palabras agudas') },
    { id: 'r2', tags: [], language: 'es', data: act('a8', 'Fracciones equivalentes') },
  ];
  const pick = (r) => ({ ...(r.data || {}), tags: r.tags || [] });
  assert.deepStrictEqual(searchActivities(filas, { q: 'agudas' }, pick).map(r => r.id), ['r1']);
  assert.deepStrictEqual(searchActivities(filas, { q: 'ortografia' }, pick).map(r => r.id), ['r1'],
    'los tags de la FILA cuentan (no están dentro del blob)');
  assert.strictEqual(searchActivities(filas, { q: 'agudas' }, pick)[0].language, 'es',
    'devuelve la fila entera, no la actividad extraída');
  ok('la biblioteca usa el mismo buscador con `pick`, y recupera sus filas enteras');
}

// ── 8. Actividades rotas o a medias no lo revientan ────────────────────────
// La lista viene de localStorage y de la red: hay actividades sin título, sin
// contenido, y contenido con ciclos si alguien lo construye mal. Un buscador
// que lanza excepción deja la home EN BLANCO.
{
  const cíclica = act('c1', 'Cíclica');
  cíclica.content = { items: [{ t: 'hola' }] };
  cíclica.content.items[0].self = cíclica.content.items[0];
  assert.doesNotThrow(() => searchActivities([{}, null, { id: 'x' }, cíclica], { q: 'hola' }));
  assert.deepStrictEqual(searchActivities([{}, null, { id: 'x' }, cíclica], { q: 'hola' }).map(a => a?.id), ['c1']);
  assert.strictEqual(searchActivities(null, { q: 'x' }).length, 0, 'lista nula → lista vacía, no excepción');
  ok('sin título, nulas o con contenido cíclico: filtra sin romper la home');
}

// ── 9. La memoización se invalida al EDITAR ────────────────────────────────
// El índice se cachea por `id:updatedAt` (el profe teclea letra a letra). Si no
// se invalidara al guardar, buscar por lo que acabas de escribir no lo
// encontraría — el peor falso negativo posible.
{
  const a = act('m1', 'Antes', { updatedAt: '2026-01-01T00:00:00Z' });
  assert.ok(matches(a, 'antes'));
  const editada = { ...a, title: 'Después', updatedAt: '2026-01-02T00:00:00Z' };
  assert.ok(matches(editada, 'despues'), 'el título nuevo se encuentra');
  assert.ok(!matches(editada, 'antes'), 'el viejo ya no: la caché no puede sobrevivir a la edición');
  ok('la caché se invalida con `updatedAt`: lo que acabas de escribir se encuentra');
}

console.log(`\n  ${passed} search checks passed`);
