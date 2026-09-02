// QUITAR LOS COMENTARIOS DE UN FUENTE JS — un solo dueño, porque el atajo de
// siempre MENTÍA.
//
// El truco vivía copiado en cuatro sitios (core/normsCheck.js y los tres
// barridos de costuras): dos expresiones regulares, una para `/* … */` y otra
// para `// …`. Y la primera se tragaba medio fichero: un comentario de línea
// que contenga `/*` —«los tests de Node (tests/*.mjs)», core/selftest.js:4—
// abre para la regex un bloque que no se cierra hasta el siguiente `*/` que
// haya, 300 líneas más abajo. Resultado: core/selftest.js era INVISIBLE para
// las reglas del proyecto (pb-dueno, ls-dueno, azar-primitivo, fallo-mudo…)
// desde que existe, y para los barridos B1 y B4. Lo cazó el barrido B3
// (2026-09-02), que echaba en falta un hallazgo que sabía que estaba.
//
// La forma correcta no es otra regex: es RECORRER el fuente sabiendo en qué
// estado se está —código, cadena, plantilla, comentario— y solo entonces decidir
// qué es un comentario. Se conservan los saltos de línea y la LONGITUD de cada
// línea (lo borrado se sustituye por espacios) para que los números de línea y
// columna de quien escanea no se corran. Las cadenas se dejan INTACTAS: los
// barridos leen literales (`'ww.nick'`, selectores, nombres de plantilla) y un
// `//` dentro de una URL es texto, no comentario.
//
// Lo que NO intenta: distinguir un literal regex (`/…/`) de una división. Un
// `/*` o `//` dentro de un regex literal se tomaría por comentario. En este
// repo no hay ninguno (comprobado al escribirlo); si aparece, la contra-prueba
// de tests/sinComentarios.test.mjs es el sitio donde añadir el caso.

/** @param {string} src  fuente JS
 *  @returns {string}    el mismo fuente con los comentarios en blanco */
export function sinComentarios(src) {
  const s = String(src || '');
  const out = [];
  const n = s.length;
  let i = 0;
  const copiar = (hasta) => { out.push(s.slice(i, hasta)); i = hasta; };
  const blanquear = (hasta) => { out.push(s.slice(i, hasta).replace(/[^\n]/g, ' ')); i = hasta; };
  const cerrarCadena = (q) => {
    // desde i (en la comilla de apertura) hasta la de cierre, respetando `\`
    let j = i + 1;
    while (j < n) {
      const c = s[j];
      if (c === '\\') { j += 2; continue; }
      if (c === q) return j + 1;
      if (q !== '`' && c === '\n') return j;   // cadena sin cerrar: no se come la línea
      j++;
    }
    return n;
  };
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '"' || c === "'" || c === '`') { copiar(cerrarCadena(c)); continue; }
    if (c === '/' && d === '/') {
      const fin = s.indexOf('\n', i);
      blanquear(fin < 0 ? n : fin);
      continue;
    }
    if (c === '/' && d === '*') {
      const fin = s.indexOf('*/', i + 2);
      blanquear(fin < 0 ? n : fin + 2);
      continue;
    }
    copiar(i + 1);
  }
  return out.join('');
}
