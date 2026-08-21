// UN TEMA PINTA; NO DECIDE CUÁNTO MIDE EL JUEGO (§3).
//
// El dueño lo vio antes que nadie: «con el tema Arcade las columnas no llenan
// como estaba previsto… parece que esos temas tienen sus propias reglas y eso
// está mal». Tenía razón, y la medida estaba escrita en su CSS:
//
//   themes/arcade/skin.css    .vs-skin-arcade .vs-body  { max-width: 230px }
//   themes/tv-show/skin.css   .vs-skin-tv-show .vs-body { width: min(100%, 216px) }
//
// El ancho de la columna donde vive la actividad es de la PLATAFORMA —el modo
// decide cómo se reparte la pantalla—, no del skin. Cuando un tema lo recorta,
// el mismo juego se ve distinto según el color elegido: el profe cambia de tema
// buscando otro AMBIENTE y se encuentra otra maqueta, y ninguna pantalla dice
// por qué.
//
// LA LÍNEA, dicha de una vez para que no haya que discutirla cada vez:
//   · Un tema SÍ pinta: color, fondo, borde, sombra, tipografía, animación,
//     esquinas, y todo lo suyo propio (la marquesina, el medallón…).
//   · Un tema NO mide lo COMPARTIDO: ni ancho, ni alto, ni flex, ni rejilla
//     sobre los contenedores que son de todas las plantillas.
//
// Descubre por barrido: un tema nuevo queda cubierto el día que se escribe, y
// un contenedor nuevo se añade a CONTENEDORES_COMPARTIDOS.
//
// Run: node tests/temaSinMedidas.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Los contenedores que NO son del tema: los pone la plataforma o la plantilla, y
// los comparten los siete temas. Si un tema los mide, cambia el juego.
const CONTENEDORES_COMPARTIDOS = [
  'vs-body', 'vs-panel', 'vs-main', 'vs-arena', 'vs-stage', 'vs-grid',
  'ww-player', 'ww-player-frame', 'ww-student-stage', 'ww-play-page',
  'edu-sec', 'edu-hud', 'edu-topbar', 'edu-send',
  'teams-arena', 'ww-kahoot-grid', 'ww-keypad',
];
// Lo que MIDE. `padding` y `gap` quedan fuera a propósito: son respiración, y
// prohibirlos dejaría a los temas sin poder ajustar su propio aire.
const MIDEN = ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
  'flex', 'flex-basis', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
  // ALINEAR TAMBIÉN ES MAQUETAR, y se aprendió por las malas: quitados los
  // anchos, quedó `align-items: center` sobre el panel… que en una columna flex
  // encoge la caja al ancho de su contenido. El teclado de Operaciones se
  // convirtió en una tira de 30 px — dos lápices en la captura del dueño.
  'align-items', 'justify-content', 'align-self', 'justify-self', 'place-items', 'place-content',
  // Y `container-type`, que parece técnico y es la madre de todas las medidas:
  // decide contra QUÉ CAJA se resuelven las unidades que usan las 13 plantillas.
  // Los dos temas lo bajaban a `inline-size`, así que la actividad se
  // dimensionaba contra la arena entera en vez de contra su panel.
  'container-type'];

/** Bloques `selector { … }` de una hoja, sin comentarios. */
function bloques(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio)) !== null) out.push({ sel: m[1].trim(), cuerpo: m[2] });
  return out;
}

const temas = readdirSync(join(ROOT, 'themes'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);
assert.ok(temas.length >= 2, 'el barrido tiene que encontrar los temas con hoja propia');

const infracciones = [];
for (const tema of temas) {
  const ruta = join('themes', tema, 'skin.css');
  let css;
  try { css = readFileSync(join(ROOT, ruta), 'utf8'); } catch { continue; }
  for (const { sel, cuerpo } of bloques(css)) {
    // ¿El selector TERMINA en un contenedor compartido? Que aparezca por el
    // camino no basta: `.vs-skin-arcade .vs-body .mi-marquesina` mide algo del
    // tema, y eso es legítimo.
    // Un `::before` es un elemento que CREA el tema: la marquesina de la máquina
    // recreativa es suya y puede medir lo que quiera. Lo que no puede es medir
    // la caja donde vive la actividad.
    const ultimo = sel.split(',').map(s => s.trim().split(/\s+|>/).filter(Boolean).pop() || '')
      .filter(u => !u.includes('::'));
    const tocaCompartido = ultimo.some(u =>
      CONTENEDORES_COMPARTIDOS.some(c => u === `.${c}` || u.startsWith(`.${c}.`) || u.startsWith(`.${c}:`)));
    if (!tocaCompartido) continue;
    for (const prop of MIDEN) {
      const re = new RegExp(`(^|;)\\s*${prop}\\s*:`, 'i');
      if (re.test(cuerpo)) infracciones.push(`${ruta} · ${sel.replace(/\s+/g, ' ')} → ${prop}`);
    }
  }
}

assert.deepStrictEqual(infracciones, [],
  'un tema está midiendo un contenedor compartido (§3: el tema pinta, la plataforma mide):\n  '
  + infracciones.join('\n  '));
ok(`los ${temas.length} temas con hoja propia pintan sin medir lo compartido`);

// CONTRA-PRUEBA: el barrido ve de verdad. Si el parser se rompiera, daría cero
// infracciones siempre — que es exactamente como se ve un test inútil.
{
  const falso = '.vs-skin-x .vs-body { max-width: 230px; color: red; }';
  const b = bloques(falso);
  assert.strictEqual(b.length, 1, 'el parser separa el bloque');
  assert.match(b[0].cuerpo, /max-width/, 'y ve la propiedad que se persigue');
  const ultimo = b[0].sel.split(/\s+/).pop();
  assert.strictEqual(ultimo, '.vs-body', 'y sabe cuál es el contenedor final');
  ok('CONTRA-PRUEBA: el barrido caza una medida sobre un contenedor compartido');
}

// Y LOS TEMAS SIGUEN PUDIENDO PINTAR. Una regla demasiado cerrada se descubre
// con la clase delante: si esto llegara a prohibir el color, el arreglo habría
// sido peor que el fallo.
{
  let pinta = 0;
  for (const tema of temas) {
    const css = readFileSync(join(ROOT, 'themes', tema, 'skin.css'), 'utf8');
    for (const { sel, cuerpo } of bloques(css)) {
      if (/\.(vs-body|vs-panel|ww-player)\b/.test(sel) && /(^|;)\s*(color|background|border|box-shadow)\s*:/i.test(cuerpo)) pinta++;
    }
  }
  assert.ok(pinta > 0, 'los temas tienen que seguir pintando los contenedores compartidos');
  ok(`y siguen pintándolos: ${pinta} reglas de color/fondo/borde sobre ellos`);
}

// ── LAS PAREJAS SE TOCAN ENTERAS ────────────────────────────────────────────
// El segundo hallazgo del dueño, con captura: con el tema Arcade los dos
// cuadernos salían EN BLANCO, sin una letra. No era el fondo ni la fuente: el
// tema pintaba `.tc-passage { color: #eafcff }` —tinta casi blanca— sobre el
// papel crema que pinta la hoja de Tildes (`--ww-paper`). 1,04:1.
//
// El fallo no fue el color, fue tocar UNA MITAD de una pareja. Una superficie y
// su tinta se declaran juntas: quien quiera hoja negra declara las dos y su
// contraste se conserva; quien toque solo la tinta la deja al azar del papel.
{
  // Superficie → tinta. Se amplía el día que otra plantilla declare la suya.
  const PAREJAS = [
    { elementos: ['.tc-passage', '.tc-mark'], papel: '--ww-paper', tinta: '--ww-paper-ink' },
  ];
  /** La regla, aparte y aplicable a cualquier hoja: así se puede EJECUTAR sobre
   *  casos inventados en vez de comprobarse mirando un fichero concreto. */
  const tintaSuelta = (css, donde) => {
    const out = [];
    for (const { sel, cuerpo } of bloques(css)) {
      if (!/(^|;)\s*color\s*:/i.test(cuerpo)) continue;
      const finales = sel.split(',').map(x => x.trim().split(/\s+|>/).filter(Boolean).pop() || '');
      for (const par of PAREJAS) {
        if (!finales.some(f => par.elementos.includes(f))) continue;
        // Declarar la pareja entera SÍ vale — es la forma correcta de tener una
        // hoja distinta. Lo que no vale es la tinta sola.
        const pareja = new RegExp(`${par.tinta}\\s*:`).test(css) && new RegExp(`${par.papel}\\s*:`).test(css);
        if (!pareja) out.push(`${donde} · ${sel.replace(/\s+/g, ' ')} pone la tinta sin declarar ${par.papel}`);
      }
    }
    return out;
  };

  const sueltos = temas.flatMap(t =>
    tintaSuelta(readFileSync(join(ROOT, 'themes', t, 'skin.css'), 'utf8'), `themes/${t}/skin.css`));
  assert.deepStrictEqual(sueltos, [],
    'un tema toca la tinta de una superficie sin declarar la superficie:\n  ' + sueltos.join('\n  '));
  ok('ningún tema cambia la tinta de una hoja sin cambiar también el papel');

  // La regla, ejecutada sobre los dos casos que la definen.
  assert.strictEqual(tintaSuelta('.x .tc-passage { color: #eafcff; }', 'inventado').length, 1,
    'caza la tinta suelta: es la que dejó los dos cuadernos en blanco');
  assert.strictEqual(
    tintaSuelta('.x { --ww-paper: #000; --ww-paper-ink: #fff; } .x .tc-passage { color: #fff; }', 'inventado').length, 0,
    'CONTRA-PRUEBA: con la pareja declarada pasa — un tema PUEDE tener su hoja negra');
  ok('CONTRA-PRUEBA: la regla distingue tocar media pareja de declararla entera');
}

console.log(`\ntemaSinMedidas.test: ${passed} checks passed`);
