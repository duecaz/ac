// IMPORTAR LÁMINAS DE OPENMOJI AL BANCO — `node tools/importar-dibujos.mjs`
//
// POR QUÉ EXISTE. El banco eran ocho dibujos hechos a mano por un agente, y con
// las miniaturas puestas (v1.51.702) se vio lo que eran: «Gato» es un círculo
// con dos triángulos, «Mariposa» son cuatro óvalos. El dueño lo dijo en una
// palabra —«feísimo»— y decidió dos cosas: aceptar CC BY-SA, y que se pinte a
// mano alzada.
//
// LAS DOS DECISIONES SON LA MISMA. OpenMoji publica cada emoji en dos formas, y
// la de CONTORNO (`black/svg`) es `fill="none"` con trazo: línea pura, SIN
// regiones rellenables. Para tocar-y-rellenar no sirve ni una. Para pintar con
// el dedo son exactamente lo que hace falta — y por eso el trazo libre no es un
// adorno pedagógico: es lo que abre 4.000 láminas dibujadas por ilustradores
// sin convertir nada.
//
// (La variante en COLOR sí trae formas cerradas y se podría convertir a zonas
// automáticamente; se descartó para esta tanda porque el arte real solapa sus
// formas todo el rato y la regla de geometría del banco —pensada para el
// dibujo geométrico— las rechazaría una por una. Queda apuntado por si algún
// día se quiere volver al relleno por zonas.)
//
// LICENCIA: CC BY-SA 4.0. La atribución viaja en el propio fichero (un
// comentario XML, que el contrato no prohíbe) y en `assets/juegos/dibujos/
// CREDITOS.md`. La obra derivada —el SVG reescalado— se queda CC BY-SA, que es
// lo que el share-alike exige.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, no `.pathname`: en Windows —que es donde trabaja el dueño—
// una URL de fichero da «/C:/…» y ningún `join` lo arregla.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'assets/juegos/dibujos');
// DOS VARIANTES POR LÁMINA, porque el banco lo comparten DOS juegos:
//  · `linea`  (black/svg) → Colorear: contorno para pintar encima.
//  · `color`  (color/svg) → Rompecabezas: la ilustración terminada, que es lo
//    que se recompone. Antes el puzzle reconstruía el color leyendo `data-color`
//    de cada zona; sin zonas eso desaparece, y sin esta variante las piezas
//    habrían quedado en blanco. Se importan juntas para que nunca falte una.
const FUENTE = (cp, variante) =>
  `https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/${variante}/svg/${cp}.svg`;

// EL CATÁLOGO, POR TEMAS CERRADOS (lo pidió el dueño así): un tema se elige
// entero, no se rebusca emoji a emoji. Cada entrada es un dibujo que una criatura
// de inicial reconoce de un vistazo — nada de símbolos, banderas ni objetos
// que haya que explicar.
export const CATALOGO = [
  { tema: 'animales', items: [
    ['mariposa', 'Mariposa', '1F98B'], ['gato', 'Gato', '1F431'], ['perro', 'Perro', '1F436'],
    ['pez', 'Pez', '1F41F'], ['tortuga', 'Tortuga', '1F422'], ['abeja', 'Abeja', '1F41D'],
    ['elefante', 'Elefante', '1F418'], ['leon', 'León', '1F981'], ['rana', 'Rana', '1F438'],
    ['pinguino', 'Pingüino', '1F427'], ['caracol', 'Caracol', '1F40C'], ['buho', 'Búho', '1F989'],
  ]},
  { tema: 'frutas', items: [
    ['manzana', 'Manzana', '1F34E'], ['platano', 'Plátano', '1F34C'], ['fresa', 'Fresa', '1F353'],
    ['uvas', 'Uvas', '1F347'], ['zanahoria', 'Zanahoria', '1F955'], ['sandia', 'Sandía', '1F349'],
    ['pera', 'Pera', '1F350'], ['pina', 'Piña', '1F34D'],
  ]},
  { tema: 'naturaleza', items: [
    ['flor', 'Flor', '1F338'], ['arbol', 'Árbol', '1F333'], ['sol', 'Sol', '1F31E'],
    ['estrella', 'Estrella', '2B50'], ['hoja', 'Hoja', '1F341'], ['nube', 'Nube', '2601'],
    ['girasol', 'Girasol', '1F33B'], ['cactus', 'Cactus', '1F335'],
  ]},
  { tema: 'transporte', items: [
    ['coche', 'Coche', '1F697'], ['autobus', 'Autobús', '1F68C'], ['bicicleta', 'Bicicleta', '1F6B2'],
    ['avion', 'Avión', '2708'], ['tren', 'Tren', '1F682'], ['cohete', 'Cohete', '1F680'],
    ['barco', 'Barco', '26F5'], ['tractor', 'Tractor', '1F69C'],
  ]},
  // (El balón, U+26BD, se quitó tras verlo: sus pentágonos son NEGROS de
  //  diseño, así que como lámina para colorear es una mancha.)
  { tema: 'cosas', items: [
    ['casa', 'Casa', '1F3E0'], ['globo', 'Globo', '1F388'], ['regalo', 'Regalo', '1F381'],
    ['osito', 'Osito', '1F9F8'], ['camiseta', 'Camiseta', '1F455'],
    ['paraguas', 'Paraguas', '1F302'], ['reloj', 'Reloj', '23F0'],
  ]},
];

const ESCALA = (100 / 72).toFixed(5);   // OpenMoji dibuja en 72×72; el banco, en 100×100
const CREDITO = 'Dibujo de OpenMoji (openmoji.org) · CC BY-SA 4.0 · reescalado a 100×100';

/** Deja el SVG en el contrato del banco: viewBox 100×100, sin ids ajenos, con
 *  la atribución dentro y sin nada que no sea la línea.
 *  @param {string} svg @param {string} cp @returns {string} */
export function convertir(svg, cp) {
  const dentro = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    // Los `id` de OpenMoji («emoji», «line», «color») chocarían entre dos
    // láminas montadas a la vez; el juego no los usa para nada.
    .replace(/\s+id="[^"]*"/g, '')
    .trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<!-- ${CREDITO} · U+${cp} -->
<g transform="scale(${ESCALA})">
${dentro}
</g>
</svg>
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(DESTINO, { recursive: true });
  /** @type {{nombre:string,label:string,tema:string,archivo:string}[]} */
  const hechos = [];
  const fallos = [];
  for (const { tema, items } of CATALOGO) {
    for (const [nombre, label, cp] of items) {
      try {
        /** @type {Record<string,string>} */
        const salida = {};
        let malo = '';
        for (const [variante, sufijo] of [['black', ''], ['color', '-color']]) {
          const r = await fetch(FUENTE(cp, variante));
          if (!r.ok) { malo = `${variante}: HTTP ${r.status}`; break; }
          const out = convertir(await r.text(), cp);
          const n = Buffer.byteLength(out, 'utf8');
          if (n > 16 * 1024) { malo = `${variante}: ${n} B > 16 KB`; break; }
          salida[`${nombre}${sufijo}.svg`] = out;
        }
        if (malo) { fallos.push(`${nombre} (U+${cp}): ${malo}`); continue; }
        for (const [f, txt] of Object.entries(salida)) writeFileSync(join(DESTINO, f), txt, 'utf8');
        hechos.push({ nombre, label, tema, archivo: `${nombre}.svg` });
      } catch (e) {
        fallos.push(`${nombre} (U+${cp}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  console.log(`\n✅ ${hechos.length} láminas escritas en assets/juegos/dibujos/`);
  for (const { tema } of CATALOGO) {
    const n = hechos.filter(h => h.tema === tema);
    console.log(`   ${tema.padEnd(12)} ${String(n.length).padStart(2)}  (${n.map(x => x.nombre).join(', ')})`);
  }
  if (fallos.length) console.log(`\n⚠️  ${fallos.length} sin importar:\n   ` + fallos.join('\n   '));
  console.log('\n— Pega esto en core/bancoDibujos.js —\n');
  for (const { tema } of CATALOGO) {
    console.log(`  // ${tema}`);
    for (const h of hechos.filter(x => x.tema === tema)) {
      // Los CUATRO campos que tiene `Dibujo` y ni uno más: emitía un `tipo`
      // que el banco no tiene, y quien pegara la línea metía un campo muerto.
      console.log(`  { nombre: '${h.nombre}', label: '${h.label}', archivo: '${h.archivo}', tema: '${h.tema}' },`);
    }
  }
}
