// COLOREAR — el banco de láminas y el scorer.
//
// EL CONTRATO CAMBIÓ EN v1.51.704 y este fichero cambió con él. Antes cada SVG
// traía zonas cerradas (`data-zona` + `data-color`) porque se TOCABA una zona y
// se rellenaba sola; se comprobaba que no se solaparan, porque un dedo sobre el
// área compartida solo pintaba la de arriba.
//
// Ahora se pinta A MANO ALZADA sobre láminas de OpenMoji, que son línea pura
// (`fill="none"` + trazo) y no tienen ni una región rellenable. El solape deja
// de importar —se pinta donde está el dedo— y lo que hay que vigilar es otra
// cosa: que las 43 láminas existan en sus DOS variantes, que no pesen, que
// lleven su crédito (CC BY-SA obliga) y que ninguna se quede fuera de un tema
// declarado, porque el editor las ofrece agrupadas y una lámina sin tema sería
// invisible para el profe.
//
// El contrato de ZONAS no se ha perdido: se mudó con su banco a Rompecabezas,
// que sí lo necesita (`tests/puzzle.test.mjs` audita `dibujos/zonas/`).
//
// Run: node tests/colorear.test.mjs
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIBUJOS, TEMAS, dibujosDe, rutaDibujo } from '../core/bancoDibujos.js';
import { scoreColorearSubmission, LLENO, MINIMO } from '../templates/colorear/scorer.js';
import { escenaDe, escenaColorDe, TEMAS_CON_ESCENA, SUELO } from '../core/escenasDibujo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. LAS DOS VARIANTES DE CADA LÁMINA EXISTEN ──────────────────────────────
// `linea` es sobre lo que se pinta; `color` la ilustración terminada. Si falta
// una, el fallo aparece AL JUGAR y en silencio (una pantalla en blanco), que es
// justo la forma de romperse que este banco no puede permitirse.
{
  assert.ok(DIBUJOS.length >= 40, `el banco trae ${DIBUJOS.length} láminas; se esperaban 40+`);
  for (const d of DIBUJOS) {
    for (const v of /** @type {const} */ (['linea', 'color'])) {
      const ruta = rutaDibujo(d.nombre, v);
      assert.ok(ruta, `${d.nombre}: sin ruta para la variante ${v}`);
      assert.ok(existsSync(join(ROOT, ruta)), `${d.nombre}: falta ${ruta}`);
    }
  }
  ok(`las ${DIBUJOS.length} láminas tienen sus dos variantes (línea + color) en disco`);
}

// ── 2. EL CONTRATO DE CADA FICHERO ───────────────────────────────────────────
{
  for (const d of DIBUJOS) {
    for (const v of /** @type {const} */ (['linea', 'color'])) {
      const ruta = /** @type {string} */ (rutaDibujo(d.nombre, v));
      const svg = readFileSync(join(ROOT, ruta), 'utf8');
      const bytes = Buffer.byteLength(svg, 'utf8');
      assert.ok(bytes <= 16 * 1024, `${ruta}: ${bytes} bytes > 16 KB`);
      assert.ok(/^\s*<svg\b/.test(svg) && /<\/svg>\s*$/.test(svg), `${ruta}: no es un SVG completo`);
      assert.ok(/viewBox="0 0 100 100"/.test(svg), `${ruta}: el lienzo del banco es 0 0 100 100`);
      // Sin texto: el juego es para quien todavía no lee (norte §1c).
      assert.ok(!/<text\b/.test(svg), `${ruta}: no puede llevar texto dentro`);
      // CC BY-SA obliga a atribuir, y la atribución tiene que viajar CON el
      // fichero: un CREDITOS.md se queda atrás en cuanto alguien copia un SVG.
      assert.ok(/CC BY-SA/.test(svg) && /OpenMoji/.test(svg), `${ruta}: sin el crédito de la licencia dentro`);
    }
  }
  ok('cada fichero: lienzo 100×100, sin texto, bajo 16 KB y con su crédito dentro');
}

// ── 3. NINGUNA LÁMINA SE QUEDA FUERA DE UN TEMA ──────────────────────────────
// El editor las ofrece agrupadas: una lámina con un tema que no existe no la ve
// nadie, y el banco no tendría forma de decírtelo.
{
  const ids = new Set(TEMAS.map(t => t.id));
  for (const d of DIBUJOS) assert.ok(ids.has(d.tema), `${d.nombre}: tema "${d.tema}" no declarado en TEMAS`);
  const sumados = TEMAS.reduce((n, t) => n + dibujosDe(t.id).length, 0);
  assert.strictEqual(sumados, DIBUJOS.length, 'hay láminas que no aparecen al agrupar por tema');
  for (const t of TEMAS) assert.ok(dibujosDe(t.id).length >= 5, `el tema "${t.id}" solo tiene ${dibujosDe(t.id).length} láminas`);
  assert.strictEqual(new Set(DIBUJOS.map(d => d.nombre)).size, DIBUJOS.length, 'nombre repetido en el banco');
  ok(`los ${TEMAS.length} temas cubren las ${DIBUJOS.length} láminas, sin huérfanas ni nombres repetidos`);
}

// ── 4. LA LÁMINA SOBRE LA QUE SE PINTA ES TRANSPARENTE ───────────────────────
// Es lo que hace que las capas funcionen: la tinta va DEBAJO y se ve por los
// huecos. Si una lámina llegara con el fondo relleno, taparía todo lo pintado y
// el juego parecería roto sin que ningún otro test se enterara.
{
  for (const d of DIBUJOS) {
    const svg = readFileSync(join(ROOT, /** @type {string} */ (rutaDibujo(d.nombre, 'linea'))), 'utf8');
    assert.ok(!/<rect[^>]*\bwidth="(100|72)"[^>]*\bheight="(100|72)"[^>]*fill="(?!none)/.test(svg),
      `${d.nombre}: la lámina trae un fondo relleno y taparía lo pintado`);
    assert.ok(/fill="none"/.test(svg), `${d.nombre}: una lámina de línea tiene que tener trazos sin relleno`);
  }
  ok('las 43 láminas de línea son transparentes: la pintura de debajo se ve');
}

// ── 5. rutaDibujo ────────────────────────────────────────────────────────────
{
  assert.strictEqual(rutaDibujo('gato'), 'assets/juegos/dibujos/gato.svg');
  assert.strictEqual(rutaDibujo('gato', 'color'), 'assets/juegos/dibujos/gato-color.svg');
  assert.strictEqual(rutaDibujo('unicornio-inventado'), null);
  assert.strictEqual(rutaDibujo(null), null);
  ok('rutaDibujo(): las dos variantes, y null para lo que no está en el banco');
}

// ── 6. EL SCORER — cuánto se pintó, y el techo no premia emborronar ──────────
{
  const p = (pintado, trazos = 3) => scoreColorearSubmission({ value: { pintado, trazos } });

  assert.strictEqual(p(0).points, 0, 'sin pintar, cero puntos');
  assert.strictEqual(p(0).correct, false, 'sin pintar no está «bien hecho»');
  assert.strictEqual(p(LLENO).points, 100, 'al llegar a LLENO se da el máximo');

  // EL TECHO NO SUBE POR EMBORRONAR. Pintar el lienzo entero significa haberse
  // salido por todas partes; no puede puntuar más que colorearlo bien.
  assert.strictEqual(p(1).points, p(LLENO).points, 'cubrirlo TODO no puede dar más que LLENO');
  assert.strictEqual(p(0.9).points, 100);

  // Y crece de verdad por el medio: si no, «pintar más» no significaría nada.
  assert.ok(p(LLENO / 2).points > p(LLENO / 4).points, 'pintar más tiene que dar más puntos');
  assert.ok(p(LLENO / 4).points > 0, 'pintar poco ya suma algo');

  // El umbral de «esto no es colorear»: dos rayas no merecen «¡Bien hecho!».
  assert.strictEqual(p(MINIMO / 2).correct, false, 'por debajo del mínimo no cuenta como pintado');
  assert.strictEqual(p(MINIMO).correct, true, 'en el mínimo ya cuenta');

  // §22 · el cliente AFIRMA: un valor imposible no puede dar más que el techo.
  assert.strictEqual(p(999).points, 100, 'una cobertura imposible no rompe el techo');
  assert.strictEqual(p(-5).points, 0, 'una cobertura negativa no da puntos negativos');
  assert.strictEqual(scoreColorearSubmission({}).points, 0, 'sin value no revienta');
  assert.strictEqual(scoreColorearSubmission().points, 0, 'sin argumentos tampoco');

  // El contrato del scorer (tests/scoringSources.test.mjs lo exige igual).
  const r = p(0.2);
  for (const k of ['correct', 'points', 'hits', 'total']) assert.ok(k in r, `al scorer le falta "${k}"`);
  assert.strictEqual(r.total, 100, 'hits/total se enseñan como porcentaje');
  assert.ok(typeof r.lead === 'string' && r.lead.length > 0, 'el scorer dice qué pasó, en una frase');
  assert.match(p(0.2, 1).lead, /1 trazo\b/, 'un trazo, en singular');
  assert.match(p(0.2, 4).lead, /4 trazos\b/, 'varios trazos, en plural');
  ok('el scorer mide cobertura, tiene techo, y emborronar no puntúa más que colorear');
}

// ── 7. EL DECORADO ES LÍNEA, Y SE PINTA ──────────────────────────────────
// El dueño lo pidió así con una frase que es el contrato entero: «para que los
// alumnos pinten también, si no tendrían que pintar ese fondo blanco nada más».
// Un decorado ya coloreado, o hecho con degradados de CSS, dejaría al niño sin
// nada que hacer fuera de la figura — y es un error fácil de cometer al
// «mejorar» el fondo más adelante, porque se ve bonito en la captura.
{
  for (const t of TEMAS) {
    const esc = escenaDe(t.id);
    assert.ok(esc.trim(), `el tema "${t.id}" no tiene decorado`);
    // Trazo sin relleno: eso es lo que se puede colorear por debajo.
    assert.ok(/fill="none"/.test(esc), `la escena de "${t.id}" tiene que ser de línea`);
    assert.ok(!/gradient|opacity|<image\b/i.test(esc),
      `la escena de "${t.id}" usa relleno/degradado: dejaría de ser pintable`);
    // Todas apoyan en el MISMO suelo, o la figura quedaría flotando en unas y
    // hundida en otras.
    assert.ok(esc.includes(String(SUELO)), `la escena de "${t.id}" no usa el suelo común (${SUELO})`);
  }
  assert.deepStrictEqual([...TEMAS_CON_ESCENA].sort(), TEMAS.map(t => t.id).sort(),
    'hay temas sin escena o escenas de temas que ya no existen');
  // Un tema inventado no revienta: se colorea sobre la hoja limpia.
  assert.strictEqual(escenaDe('inventado'), '');
  assert.strictEqual(escenaDe(null), '');
  ok(`los ${TEMAS.length} temas tienen decorado de LÍNEA, pintable y apoyado en el mismo suelo`);
}

// ── 8. LA MISMA ESCENA, COLOREADA PLANA (para el rompecabezas) ───────────────
// Una geometría, dos lecturas (§21b): la variante de color no puede redibujar
// nada — solo rellena cielo y suelo y pinta las formas que DECLARAN su color.
{
  for (const t of TEMAS) {
    const linea = escenaDe(t.id), color = escenaColorDe(t.id);
    assert.ok(color, `el tema "${t.id}" no tiene escena coloreada`);
    assert.match(color, /<rect x="0" y="0" width="100" height="100" fill="#[0-9a-f]{6}"\/>/, `${t.id}: sin cielo`);
    assert.ok(color.includes(`<rect x="0" y="${SUELO}" width="100"`), `${t.id}: el suelo relleno no apoya en SUELO`);
    // Las mismas formas: cada `d=`/`cx=` de la línea está en la coloreada.
    for (const m of linea.matchAll(/ d="[^"]*"| cx="[^"]*"| x="\d+" y="\d+" width/g)) {
      assert.ok(color.includes(m[0]), `${t.id}: la variante coloreada perdió una forma (${m[0].slice(0, 30)}…)`);
    }
    // Todo `data-fill` declarado se convirtió en `fill`, y al menos hay uno.
    const declarados = [...linea.matchAll(/data-fill="(#[0-9a-f]{6})"/g)].map(m => m[1]);
    assert.ok(declarados.length >= 1, `${t.id}: ninguna forma declara color`);
    for (const c of declarados) assert.ok(color.includes(`fill="${c}"`), `${t.id}: el color ${c} declarado no se aplicó`);
    assert.ok(!/fill="none"[^>]*data-fill=/.test(color), `${t.id}: queda una forma con data-fill sin aplicar`);
    // La de LÍNEA sigue sin relleno alguno (Colorear la necesita transparente).
    assert.ok(!/\sfill="#/.test(linea), `${t.id}: la escena de línea trae relleno`);
  }
  assert.strictEqual(escenaColorDe('inventado'), '');
  assert.strictEqual(escenaColorDe(null), '');
  ok(`los ${TEMAS.length} temas tienen su escena coloreada plana: mismas formas, cielo, suelo y los colores declarados`);
}

// ── 9. CADA ESQUINA TIENE LO SUYO (las piezas del rompecabezas se distinguen) ─
// Medido con la sonda de piezas 3×3 (v1.51.711): con el mismo prado a los dos
// lados, 49 de 51 dibujos daban dos piezas casi idénticas; con un elemento
// propio en cada esquina y algo a media altura en un lado, 51 de 51 se
// distinguen. Este test fija la CAUSA (dónde hay elementos), que es lo que se
// puede comprobar sin navegador; la sonda mide el EFECTO.
{
  /** Dónde ancla cada forma: el centro de un círculo, la esquina de un rect o
   *  el primer punto de un path. @param {string} esc @returns {[number, number][]} */
  const anclas = (esc) => {
    /** @type {[number, number][]} */
    const out = [];
    for (const m of esc.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"/g)) out.push([+m[1], +m[2]]);
    for (const m of esc.matchAll(/<rect[^>]*\sx="([\d.]+)"[^>]*\sy="([\d.]+)"/g)) out.push([+m[1], +m[2]]);
    for (const m of esc.matchAll(/<path[^>]*\sd="M([\d.]+) ([\d.]+)/g)) out.push([+m[1], +m[2]]);
    return out;
  };
  const REGIONES = {
    'arriba izquierda': (/** @type {number} */ x, /** @type {number} */ y) => x < 30 && y < 33,
    'arriba derecha':   (/** @type {number} */ x, /** @type {number} */ y) => x > 70 && y < 33,
    'abajo izquierda':  (/** @type {number} */ x, /** @type {number} */ y) => x < 30 && y > 67,
    'abajo derecha':    (/** @type {number} */ x, /** @type {number} */ y) => x > 70 && y > 67,
  };
  for (const t of TEMAS) {
    const pts = anclas(escenaDe(t.id));
    for (const [nombre, dentro] of Object.entries(REGIONES)) {
      assert.ok(pts.some(([x, y]) => dentro(x, y)), `escena "${t.id}": nada en la esquina ${nombre} — esa pieza saldría en blanco`);
    }
    // A media altura, en un lado al menos: una figura alta y estrecha (la piña)
    // deja los dos laterales del medio iguales si el decorado no pone nada ahí.
    assert.ok(pts.some(([x, y]) => (x < 30 || x > 70) && y >= 33 && y <= 67),
      `escena "${t.id}": nada a media altura en los laterales — las piezas 3 y 5 serían iguales`);
  }
  ok(`las ${TEMAS.length} escenas ponen algo propio en las cuatro esquinas y a media altura`);
}

console.log(`\ncolorear.test: ${passed} checks passed`);
