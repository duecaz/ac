// CÓMO SE JUEGA UNA RONDA, por MECÁNICA — el mismo gesto en todos los modos.
//
// La matriz comprobaba que cada plantilla × modo ARRANCA. "Arranca sin crash"
// es justo la vara que dejó pasar los bugs de juego de esta semana: el botón que
// no se podía tocar, la hoja perfecta que sonaba a error. Para ver esos hay que
// JUGAR — un gesto real del ratón y comprobar que la app juzga y avanza.
//
// Los drivers se declaran por MECÁNICA y no por plantilla, porque la mecánica es
// lo que se comparte: Quiz y Emparejar responden igual (tocar una opción),
// Tildes y Comas igual (trazo + Listo). Una plantilla nueva que reutilice una
// mecánica queda cubierta sola; una con mecánica nueva aparece en el informe
// como "sin driver" — declarada, no escondida.
//
// LO QUE NO HACE (ley §27): darse el veredicto a sí mismo. El gesto es real y
// quien decide es la aplicación. Donde hace falta conocer la respuesta —el
// teclado numérico, la sopa de letras— se lee de la PROPIA SEMILLA que el test
// sembró, que no es lo mismo que calcular el resultado: es saber qué pusiste.

/** Un toque real (pointer del navegador) en el centro del primer `sel`. */
async function tap(page, root, sel) {
  const el = page.locator(`${root} ${sel}`).first();
  if (!await el.count()) return false;
  const box = await el.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

/**
 * Los drivers, en orden de prueba. Cada uno: ¿está esta mecánica en pantalla?
 * → hazle el gesto. Devuelve el nombre de la mecánica jugada, o null.
 */
const DRIVERS = [
  // Elegir una opción (Quiz · Emparejar) — `.rq-opt` en VS/Equipos, `.ww-opt` en Individual.
  ['opción', async (page, root) => (await tap(page, root, '.rq-opt')) || (await tap(page, root, '.ww-opt'))],

  // Pinchar un globo (Explota Globos).
  ['globo', async (page, root) => tap(page, root, '.gl-balloon')],

  // Trazo sobre el texto + "Listo" (Tildes · Comas). El canvas escucha eventos
  // de puntero del NAVEGADOR, así que un click sintético no sirve: hay que
  // mover, bajar, arrastrar y soltar como un dedo.
  ['trazo', async (page, root) => {
    const t = page.locator(`${root} .tc-target`).first();
    if (!await t.count()) return false;
    const b = await t.boundingBox();
    if (!b) return false;
    const y = b.y + b.height / 2;
    await page.mouse.move(b.x + b.width / 2 - 3, y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 3, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    return tap(page, root, '.tc-done');
  }],

  // Coger y soltar en el tablero (Ordena las Pelotas): del primer tubo al
  // último, que la semilla trae vacío → movimiento siempre legal.
  ['tap-tap', async (page, root) => {
    const tubos = page.locator(`${root} .tube`);
    const n = await tubos.count();
    if (n < 2) return false;
    const a = await tubos.nth(0).boundingBox();
    const z = await tubos.nth(n - 1).boundingBox();
    if (!a || !z) return false;
    await page.mouse.click(a.x + a.width / 2, a.y + 10);
    await page.waitForTimeout(120);
    await page.mouse.click(z.x + z.width / 2, z.y + 10);
    return true;
  }],

  // Arrastrar sobre la rejilla (Sopa de Letras). Las celdas se localizan EN LA
  // PANTALLA: la rejilla se genera con azar, así que cada modo pinta una
  // colocación distinta y una lista precalculada no vale. Se lee la rejilla y la
  // lista de palabras del DOM y se busca la primera en las 8 direcciones — es
  // literalmente lo que hace el alumno; el veredicto sigue siendo de la app.
  ['arrastre', async (page, root) => {
    const cells = await page.evaluate((r) => {
      const grid = [...document.querySelectorAll(`${r} .ws-cell`)];
      if (!grid.length) return null;
      const pos = new Map(grid.map(el => [`${el.dataset.r},${el.dataset.c}`, el.textContent.trim().toUpperCase()]));
      const filas = Math.max(...grid.map(el => +el.dataset.r)) + 1;
      const cols = Math.max(...grid.map(el => +el.dataset.c)) + 1;
      const palabras = [...document.querySelectorAll(`${r} .ws-word`)]
        .filter(w => !w.classList.contains('is-found'))
        .map(w => (w.dataset.word || w.textContent).trim().toUpperCase());
      const DIRS = [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
      for (const w of palabras) {
        if (w.length < 2) continue;
        for (let r0 = 0; r0 < filas; r0++) for (let c0 = 0; c0 < cols; c0++) {
          for (const [dr, dc] of DIRS) {
            const out = [];
            let okDir = true;
            for (let i = 0; i < w.length; i++) {
              const rr = r0 + dr * i, cc = c0 + dc * i;
              if (pos.get(`${rr},${cc}`) !== w[i]) { okDir = false; break; }
              out.push({ r: rr, c: cc });
            }
            if (okDir) return out;
          }
        }
      }
      return null;
    }, root);
    if (!Array.isArray(cells) || cells.length < 2) return false;
    const punto = async (rc) => {
      const el = page.locator(`${root} .ws-cell[data-r="${rc.r}"][data-c="${rc.c}"]`).first();
      if (!await el.count()) return null;
      const b = await el.boundingBox();
      return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const p0 = await punto(cells[0]);
    const p1 = await punto(cells[cells.length - 1]);
    if (!p0 || !p1) return false;
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(p1.x, p1.y, { steps: 8 });
    await page.mouse.up();
    return true;
  }],

  // Cuerda entre los dos lados (Emparejar · Etiqueta el diagrama): coger la
  // primera tarjeta/etiqueta y soltarla sobre la primera del lado contrario.
  // La conexión puede salir bien o mal — quien la juzga es la app (§27); lo que
  // se comprueba es que el arrastre CONECTA (la cuerda se pinta y la ronda
  // responde). El bug de Emparejar-vertical que abrió esta rama vivía justo en
  // este gesto y ninguna red lo veía.
  ['cuerda', async (page, root) => {
    const LADOS = [
      ['.ww-card[data-side="L"]', '.ww-card[data-side="R"]'],   // Emparejar
      ['.dg-label', '.dg-pin'],                                  // Diagrama
    ];
    for (const [a, b] of LADOS) {
      const from = page.locator(`${root} ${a}`).first();
      const to = page.locator(`${root} ${b}`).first();
      if (!await from.count() || !await to.count()) continue;
      const f = await from.boundingBox();
      const t = await to.boundingBox();
      if (!f || !t) continue;
      await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
      await page.mouse.down();
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
      await page.mouse.up();
      return true;
    }
    return false;
  }],

  // Voltear una carta (Memoria) — `.mc` en Individual, `.mem-card` en Equipos.
  ['voltear', async (page, root) =>
    (await tap(page, root, '.mc:not([disabled])')) || (await tap(page, root, '.mem-card:not([disabled])'))],

  // Abrir una caja (Abre Cajas): el toque abre la pregunta.
  ['abrir', async (page, root) => tap(page, root, '.ab-box:not(.ab-done)')],

  // Girar la ruleta: el botón arranca la animación (la ronda responde girando).
  ['girar', async (page, root) => tap(page, root, '#btn-spin:not([disabled])')],

  // Escribir una letra (Crucigrama): tocar una casilla y teclear. La letra puede
  // no ser la correcta — la app la pinta igual y juzga al comprobar.
  ['letra', async (page, root) => {
    if (!await tap(page, root, '.cw-cell.cw-white')) return false;
    await page.waitForTimeout(120);
    await page.keyboard.type('A');
    return true;
  }],

  // Teclear el resultado y ✓ (Operaciones). La respuesta viene de la semilla.
  ['teclado', async (page, root, hints) => {
    if (!await page.locator(`${root} .ww-key[data-k]`).count()) return false;
    for (const d of String(hints?.answer ?? '')) {
      if (!await tap(page, root, `.ww-key[data-k="${d}"]`)) return false;
    }
    return tap(page, root, '.ww-key[data-k="ok"]');
  }],
];

/** Los nombres de las mecánicas cubiertas (lo usa el guardarraíl de §27). */
export const MECANICAS = DRIVERS.map(([n]) => n);

/**
 * Juega UNA ronda dentro de `root` y dice si el juego AVANZÓ.
 * @param {import('playwright').Page} page
 * @param {string} root  selector del contenedor de la ronda
 * @param {{answer?: string, wordCells?: {r,n}[], progressSel?: string}} hints
 *        datos de la semilla (no del veredicto) + dónde mirar el progreso
 * @returns {Promise<{mecanica: string|null, avanzo: boolean|null}>}
 */
export async function playRound(page, root, hints = {}) {
  const foto = () => page.evaluate(([r, p]) => ({
    cuerpo: document.querySelector(r)?.innerHTML || '',
    prog: p ? (document.querySelector(p)?.style.width || '') : '',
  }), [root, hints.progressSel || '']);

  // `effectSel`: dónde mirar cuando el gesto NO re-pinta la ronda. En Equipos por
  // TURNOS elegir la respuesta no avanza nada —y está bien: el equipo elige y el
  // DOCENTE revela—, lo que cambia es que "Revelar" se habilita. Medir "avanzó"
  // ahí sería exigirle a Equipos que se comporte como VS.
  const efecto = () => hints.effectSel
    ? page.evaluate((s2) => {
        const el = document.querySelector(s2);
        return el ? `${el.disabled}|${el.className}` : '';
      }, hints.effectSel)
    : Promise.resolve('');

  const antes = await foto();
  const efectoAntes = await efecto();
  let mecanica = null;
  // Hasta 3 pasadas con espera: la ronda puede entrar con cuenta atrás o
  // animación y a la primera no haber nada que tocar — el dedo también espera.
  // (Se vio de verdad: Emparejar VS fallaba solo cuando la Ruleta iba antes.)
  for (let intento = 0; intento < 3 && !mecanica; intento++) {
    if (intento) await page.waitForTimeout(900);
    for (const [nombre, fn] of DRIVERS) {
      if (await fn(page, root, hints)) { mecanica = nombre; break; }
    }
  }
  if (!mecanica) return { mecanica: null, avanzo: null };

  await page.waitForTimeout(1100);   // destello + re-render de la ronda
  const despues = await foto();
  // "Avanzó" = el juego RESPONDIÓ al gesto: la barra de progreso se movió o la
  // ronda se re-pintó. Se compara el cuerpo ENTERO y no su longitud: un tablero
  // que repinta los mismos nodos con la bola movida también cuenta.
  const efectoDespues = await efecto();
  const avanzo = (despues.prog && despues.prog !== antes.prog)
    || despues.cuerpo !== antes.cuerpo
    || (!!hints.effectSel && efectoDespues !== efectoAntes);
  return { mecanica, avanzo };
}
