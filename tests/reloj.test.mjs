// EL RELOJ ES UNO, Y SE CONFIGURA EN UN SOLO SITIO.
//
// El dueño abrió a editar un Quiz y no encontró el reloj (2026-09-01): estaba,
// pero enterrado en la pestaña «Modos» y partido en dos —el temporizador por un
// lado y el cronómetro por otro, en «Puntuación»—, y solo 4 plantillas
// ofrecían el temporizador. La causa no era el sitio: era que NADIE era el dueño
// del reloj. Había tres implementaciones (la cuenta atrás del shell secuencial,
// el cronómetro del HUD y el reloj propio de Tildes/Comas) y cada editor decidía
// si ofrecía el ajuste.
//
// Esta suite fija las dos mitades de la regla, y la segunda es la que faltaba en
// todo el proyecto: la red `ajusteConectado` vigila que lo que el EDITOR escribe
// alguien lo LEA; nadie vigilaba lo contrario — que lo que el JUEGO lee, el
// editor lo OFREZCA. Por ahí se coló un Quiz con 30 s por defecto y ninguna
// casilla que los tocara.
//
// Run: node tests/reloj.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const RAIZ = new URL('..', import.meta.url).pathname;
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const { relojDe, unidadDeCuenta, clasificarUnidad, alcanceDeReloj } = await import('../core/reloj.js');
// Solo las de VERDAD: otras suites registran plantillas de mentira en el mismo
// registro, y una regla del proyecto no se juzga con maniquíes.
const TS = listTemplates().filter(T => existsSync(join(RAIZ, 'templates', String(T.meta?.name || ''))));

// ── 1. QUÉ RELOJ TOCA: una sola regla, sin excepciones por plantilla ─────────
{
  assert.strictEqual(relojDe({ rules: { timer: 20 } }).tipo, 'cuenta', 'con límite manda la cuenta atrás');
  assert.strictEqual(relojDe({ template: 'wheel', rules: { timer: 20 } }).tipo, 'cuenta',
    'con límite manda la cuenta atrás, sea cual sea la plantilla');
  assert.strictEqual(relojDe({ rules: {} }).tipo, 'crono', 'sin límite, cronómetro');
  // Y quien no mide nada no lleva reloj — lo dice la PLANTILLA, no el que
  // prepara la clase: no es una preferencia, es si ese juego tiene algo que
  // cronometrar. Antes esto vivía en `rules.crono` (un ajuste del profe) y la
  // declaración de la plantilla solo la miraba el editor.
  const ruletaT = listTemplates().find(T => T.meta.name === 'wheel');
  assert.strictEqual(relojDe({ rules: {} }, ruletaT).tipo, 'ninguno', 'la Ruleta no mide nada: sin reloj');
  assert.strictEqual(relojDe({ template: 'wheel', rules: {} }).tipo, 'ninguno',
    'y se resuelve sola desde la actividad, sin que el llamante tenga que acordarse');
  assert.strictEqual(relojDe({ rules: { timer: 0 } }).tipo, 'crono', '0 = sin límite, no «cuenta atrás de 0»');
  ok('la regla del reloj vive en un solo sitio: límite → cuenta atrás · sin límite → cronómetro · sin nada que medir → nada');
}

// ── 2. LAS TRECE DECLARAN SU RELOJ ──────────────────────────────────────────
// Declararlo es lo que hace que el editor pueda ofrecerlo sin conocer plantillas
// (§0). Sin declaración no hay campo, y sin campo el profe no puede configurarlo.
{
  const sin = TS.filter(T => !T.meta?.play?.reloj).map(T => T.meta.name);
  assert.deepStrictEqual(sin, [], `plantillas sin declarar su reloj (meta.play.reloj): ${sin.join(', ')}`);
  ok(`las ${TS.length} plantillas declaran su reloj (unidad de cuenta atrás + si admiten cronómetro)`);
}

// ── 3. LO QUE EL JUEGO LEE, EL EDITOR LO OFRECE ─────────────────────────────
// La mitad que faltaba. Se descubre por ESCANEO: si el player (o la ronda que
// use) consume `rules.timer`, su plantilla tiene que declarar la unidad — y el
// bloque «Tiempo» del editor aparece solo. Y al revés: declarar una unidad que
// nadie lee sería un mando que no manda.
{
  const LEE_TIMER = /rules[?.]*\.timer|activity\.rules\?\.timer|timerSecs/;
  const mudos = [], sobran = [];
  for (const T of TS) {
    const dir = join(RAIZ, 'templates', T.meta.name);
    if (!existsSync(dir)) continue;
    const fuentes = readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('editor'))
      .map(f => leer(`templates/${T.meta.name}/${f}`)).join('\n');
    // Tildes y Comas leen el tiempo en la ronda compartida, no en su carpeta.
    const compartido = T.meta.contentModel === 'textCorrection' ? leer('core/textCorrectionSolo.js') : '';
    // Quien corre sobre el shell SECUENCIAL hereda la cuenta atrás: la monta el
    // shell (core/soloPlayer.js) y, si la plantilla no dice qué hacer al agotarse,
    // el shell registra el ítem sin respuesta y avanza.
    const enElShell = /runSequentialPlayer/.test(fuentes);
    // Y quien corre sobre el shell LIBRE (un tablero entero en una pantalla:
    // Emparejar, Diagrama, Memoria) lo lee cuando DICE qué hacer al
    // agotarse — `ctx.alAgotarse(...)`. Sin eso el límite sería decorativo: el
    // número llegaría a cero y el juego seguiría abierto.
    const cierraAlAgotarse = /runFreeformPlayer/.test(fuentes) && /alAgotarse\s*\(/.test(fuentes);
    const lee = enElShell || cierraAlAgotarse || LEE_TIMER.test(fuentes) || LEE_TIMER.test(compartido);
    const declara = !!unidadDeCuenta(T);
    if (lee && !declara) mudos.push(T.meta.name);
    if (declara && !lee) sobran.push(T.meta.name);
  }
  assert.deepStrictEqual(mudos, [],
    `su juego USA el límite de tiempo y su editor no lo ofrece (declara meta.play.reloj.unidad): ${mudos.join(', ')}`);
  assert.deepStrictEqual(sobran, [],
    `ofrecen un límite de tiempo que su juego NO lee — un mando que no manda: ${sobran.join(', ')}`);
  ok('lo que el juego lee, el editor lo ofrece — y nada se ofrece sin que el juego lo lea');
}

// ── 3b. TODA UNIDAD DECLARADA ESTÁ CLASIFICADA ──────────────────────────────
// La unidad no es solo una palabra para el editor («Tiempo por frase»): decide
// qué pasa al REANUDAR. Si es de toda la partida, un F5 continúa con lo que
// quedaba; si es de la pieza que está en pantalla, la siguiente estrena su
// tiempo. Una palabra nueva sin clasificar caería en silencio del lado de la
// pieza —y un tablero de 180 s regalaría los 180 otra vez—, así que aquí se
// exige la decisión.
{
  const sinClasificar = TS
    .map(T => ({ n: T.meta.name, u: unidadDeCuenta(T) }))
    .filter(x => x.u && !clasificarUnidad(x.u))
    .map(x => `${x.n} (${x.u})`);
  assert.deepStrictEqual(sinClasificar, [],
    `unidades declaradas que nadie clasificó —¿su tiempo es de la partida o de la pieza?—: ${sinClasificar.join(', ')}`);
  // CONTRA-PRUEBA: el ratchet ve de verdad una palabra nueva.
  assert.strictEqual(clasificarUnidad('tablero'), null,
    'CONTRA-PRUEBA: una unidad que nadie ha clasificado se DELATA, no se supone');
  // Y el alcance sale de esa clasificación, no del nombre de la plantilla.
  assert.strictEqual(alcanceDeReloj({ template: 'memory', rules: { timer: 180 } }), 'partida',
    'un tablero entero: el límite es de la partida');
  assert.strictEqual(alcanceDeReloj({ template: 'quiz', rules: { timer: 30 } }), 'unidad',
    'una pregunta: el límite es de la pieza');
  assert.strictEqual(alcanceDeReloj({ template: 'wheel', rules: {} }), 'ninguno',
    'y quien no mide nada no tiene alcance que discutir');
  ok('cada unidad declarada dice si su tiempo es de la PARTIDA o de la PIEZA (y una nueva rompe CI)');
}

// ── 4. UN SOLO MÓDULO MONTA RELOJES DE ACTIVIDAD ────────────────────────────
// Los primitivos (§23) siguen siendo los de siempre; lo que no puede volver a
// pasar es que cada player los orqueste por su cuenta, que es como acabamos con
// tres relojes y un ajuste en cuatro plantillas.
{
  const DUENOS = new Set(['core/reloj.js', 'core/soloTimer.js', 'core/deadlineTicker.js', 'core/normsCheck.js']);
  // Excepciones DECLARADAS, con su motivo:
  //  · views/hostLive.js — la sala en vivo cuenta contra un instante del SERVIDOR
  //    (otro reloj, otro dueño: startDeadlineTicker).
  //  · templates/ballsort/play.js — su tablero muestra su propio tiempo como
  //    parte de la mecánica, y por eso declara `reloj: { crono: false }`.
  const EXCEPCIONES = new Set(['views/hostLive.js', 'templates/ballsort/play.js']);
  const culpables = [];
  const barrer = (dir) => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { barrer(rel); continue; }
      if (!e.name.endsWith('.js') || DUENOS.has(rel) || EXCEPCIONES.has(rel)) continue;
      const src = leer(rel);
      // (`startDeadlineTicker` NO entra: es el primitivo de LIVE, que cuenta
      //  contra un instante del servidor — otra frontera, otro dueño.)
      if (/createCountdown\s*\(|startElapsedTicker\s*\(/.test(src)) culpables.push(rel);
      // G9 · Y EL RELOJ DE SOLO TIENE UN SOLO DUEÑO: el SHELL. `montarReloj` es
      // el orquestador, no una utilidad pública: si un runner puede llamarlo,
      // puede haber dos cuentas atrás escribiendo el mismo chip — pasó, y en la
      // corrección de Tildes una repintaba el número que la otra había apagado.
      // La necesidad real (una cuenta POR FRASE) la declara la plantilla
      // (`meta.play.reloj.unidad`) y se pide al shell, no se construye aparte.
      else if (/\bmontarReloj\s*\(/.test(src) && rel !== 'core/soloPlayer.js') culpables.push(rel);
      // …ni por la puerta de atrás: apagar el reloj del shell para traer el
      // propio es la misma cosa con otro nombre.
      if (/runFreeformPlayer\s*\([^)]*\breloj\s*:/.test(src)) culpables.push(`${rel} (apaga el reloj del shell)`);
      // Y AL REVÉS: quien usa el shell libre tiene que DECIR cuándo existe su
      // superficie (`ctx.listo()`), o su reloj no arranca nunca y la pantalla se
      // queda sin él en silencio — que es peor que el defecto que arreglamos.
      // …y se cuenta por LLAMADA, no por fichero: `question-live` monta DOS
      // players (cajas y ruleta) y con un `.listo()` suelto el fichero pasaba
      // entero aunque una de las dos variantes se quedara sin reloj.
      // (el propio shell queda fuera: ahí `runFreeformPlayer(` es su definición
      //  y su ejemplo de uso en la cabecera, no una llamada)
      const usos = rel === 'core/soloPlayer.js' ? 0 : (src.match(/\brunFreeformPlayer\s*\(/g) || []).length;
      const listos = (src.match(/\.listo\s*\(\s*\)/g) || []).length;
      if (usos > listos) {
        culpables.push(`${rel} (${usos} player(s) del shell libre y ${listos} ctx.listo(): alguno no dice cuándo existe su superficie)`);
      }
    }
  };
  barrer('core'); barrer('views'); barrer('templates');
  assert.deepStrictEqual(culpables, [],
    `montan su propio reloj de actividad en vez de usar core/reloj.js: ${culpables.join(', ')}`);
  ok('G9 · el reloj de la actividad tiene UN dueño: los primitivos en core/reloj.js y el montaje en el SHELL');
}

// ── 5. EL EDITOR NO TIENE DOS SITIOS PARA EL TIEMPO (§21b) ──────────────────
// Lo que pasó: el temporizador en «Modos» y el cronómetro en «Puntuación». El
// bloque se pinta desde el shell, y ningún editor puede volver a poner el suyo.
{
  const bloque = leer('core/editorPrimitives.js');
  assert.ok(/export function tiempoBloqueHtml/.test(bloque), 'el bloque «Tiempo» existe como primitivo único');
  assert.ok(/tiempoBloqueHtml\(a, getTemplate\(a\.template\)\)/.test(leer('core/editorShell.js')),
    'y lo pinta el SHELL del editor, que es quien lo puede garantizar en las 13');
  const copias = [];
  for (const e of readdirSync(join(RAIZ, 'templates'), { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = `templates/${e.name}/editor.js`;
    if (!existsSync(join(RAIZ, f))) continue;
    const src = leer(f);
    if (/f-timer|f-crono|tiempoBloqueHtml/.test(src)) copias.push(f);
  }
  assert.deepStrictEqual(copias, [], `editores con su propio campo de tiempo: ${copias.join(', ')}`);
  ok('el bloque «Tiempo» se pinta en UN sitio y ningún editor tiene copia');
}

// ── 6. UN SOLO MANDO, Y CONTRA-PRUEBA DE QUE NO SOBRA NI FALTA ─────────────
// El bloque tenía DOS mandos —los segundos y una casilla «Mostrar cronómetro»
// marcada y en gris— y eso se lee como «hay dos relojes a la vez». No los
// había, pero el formulario decía otra cosa, y el formulario es lo que se lee.
{
  const { tiempoBloqueHtml } = await import('../core/editorPrimitives.js');
  const quiz = TS.find(T => T.meta.name === 'quiz');
  const html = tiempoBloqueHtml({ rules: { timer: 30 } }, quiz);
  assert.ok(/Tiempo por pregunta/.test(html), 'el Quiz lleva su cuenta atrás, con SU palabra');
  assert.ok(!/f-crono|checkbox/.test(html), 'y NADA de una segunda casilla: el mando es uno');
  assert.strictEqual((html.match(/<input/g) || []).length, 1, 'literalmente un campo');
  // Con 0 el mando sigue siendo el mismo y lo que cambia es lo que EXPLICA.
  const sinLimite = tiempoBloqueHtml({ rules: { timer: 0 } }, quiz);
  assert.ok(/cronómetro/.test(sinLimite), 'con 0 se dice que lo que se ve es el cronómetro');
  assert.ok(/se corrige/.test(html), 'y con límite, que al llegar a cero se corrige');
  // CONTRA-PRUEBA: la que no mide nada no recibe bloque — un mando que no manda
  // es peor que ninguno.
  const ruleta = TS.find(T => T.meta.name === 'wheel');
  assert.strictEqual(tiempoBloqueHtml({ rules: {} }, ruleta), '',
    'CONTRA-PRUEBA: la Ruleta no mide nada y el editor no le pinta el bloque');
  const memoria = TS.find(T => T.meta.name === 'memory');
  assert.ok(/Tiempo por partida/.test(tiempoBloqueHtml({ rules: {} }, memoria)),
    'CONTRA-PRUEBA: un TABLERO entero sí lo lleva, con SU unidad');
  ok('el bloque «Tiempo» es UN mando (los segundos) y solo aparece donde hay algo que medir');
}


// ════════════════════════════════════════════════════════════════════════════
// LAS NUEVE PUERTAS DEL LIFECYCLE (docs/handoff-reloj-lifecycle.md §5)
//
// La ley: restaurar el estado y su ORIGEN → montar la superficie estable →
// arrancar el reloj desde ese origen → pintar el contenido. Y su mitad más
// importante: lo que MUESTRA el reloj y lo que se guarda como `timeUsed` son dos
// lecturas del MISMO tiempo.
//
// EL ARNÉS ES PARTE DE LA PRUEBA, y tiene dos trampas que costaron un verde
// falso al medir (v1.51.728):
//   · `montarReloj` no monta sin `document` — hay que declarar uno de mentira;
//   · una raíz que entregue el chip del reloj DESDE EL PRIMER INSTANTE esconde
//     justo el defecto: en el navegador, la cabecera todavía NO existe cuando el
//     reloj pinta por primera vez. Aquí la raíz no entrega nada hasta que
//     alguien MONTA, igual que el DOM de verdad.
// ════════════════════════════════════════════════════════════════════════════
{
  const { runSequentialPlayer, runFreeformPlayer } = await import('../core/soloPlayer.js');
  const { clock } = await import('../core/clock.js');
  const { noteServerDate, serverNow } = await import('../core/serverNow.js');
  const { startElapsedTicker } = await import('../core/deadlineTicker.js');
  // LA CELEBRACIÓN, CALLADA. Terminar una partida emite PODIUM y el confeti
  // CACHEA su lienzo en el módulo: con el `document` de mentira de aquí, ese
  // lienzo muerto se quedaba guardado y la suite de efectos —que corre después,
  // en el mismo proceso— no volvía a pintar ninguno. Un arnés no puede dejar
  // rastro en el módulo de al lado.
  const { setEffectsMuted, isEffectsMuted } = await import('../core/effects.js');
  const fxAntes = isEffectsMuted();

  const docReal = globalThis.document;
  const siReal = global.setInterval, ciReal = global.clearInterval, stReal = global.setTimeout;
  const nowReal = clock.now;
  try {
    // El `document` de mentira: lo justo para que el reloj se monte (su guard
    // pregunta por él) y para que la celebración del final se dé por vencida
    // —`lienzo()` sin contexto 2D no pinta— en vez de reventar la suite.
    globalThis.document = /** @type {any} */ ({
      createElement: () => ({ style: {}, getContext: () => null }),
    });
    setEffectsMuted(true);
    // Los temporizadores falsos CANCELAN de verdad: con un `clearInterval` que
    // no hacía nada, el tick de un reloj ya parado seguía pintando y la prueba
    // del rearme medía a un zombi en vez de al reloj nuevo.
    /** @type {Map<number, () => void>} */
    const cola = new Map();
    let idTimer = 0;
    global.setInterval = /** @type {any} */ ((fn) => { cola.set(++idTimer, fn); return idTimer; });
    global.clearInterval = /** @type {any} */ ((id) => { cola.delete(Number(id)); });
    global.setTimeout = /** @type {any} */ ((fn) => {
      const id = ++idTimer;
      cola.set(id, () => { cola.delete(id); fn(); });   // de un solo disparo
      return id;
    });
    global.clearTimeout = /** @type {any} */ ((id) => { cola.delete(Number(id)); });
    // Se recorre la cola VIVA: lo que se cancele a mitad del propio tic (un
    // avance que para el reloj del ítem anterior) ya no dispara.
    const tic = () => { for (const id of [...cola.keys()]) cola.get(id)?.(); };
    // Drena hasta que no quede nada pendiente (los avances encadenan timeouts).
    const drenar = () => { for (let v = 0; v < 20 && cola.size; v++) tic(); };
    const mem = new Map();
    global.localStorage = /** @type {any} */ ({
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    });
    let ahora = 1_000_000;
    clock.now = () => ahora;

    /** LA RAÍZ DE MENTIRA. No entrega chips hasta que alguien monta: si los
     *  diera antes, un reloj que pinta demasiado pronto saldría verde. */
    const hacerRaiz = () => {
      /** @type {string[]} */
      const pintadas = [];
      const chip = { hidden: true, querySelector: () => ({ set textContent(v) { pintadas.push(String(v)); } }) };
      const ronda = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      return {
        pintadas, ronda, montado: false, html: '',
        get innerHTML() { return this.html; },
        set innerHTML(v) { this.html = String(v); this.montado = true; },
        /** @param {string} sel */
        querySelector(sel) {
          if (!this.montado) return null;               // la cabecera aún no existe
          if (sel === '[data-round]') return this.ronda;
          if (sel === '[data-hud="tiempo"]') return chip;
          return null;
        },
        querySelectorAll: () => [],
      };
    };

    const quiz = (rules = {}) => ({ id: 'g_seq', template: 'quiz', updatedAt: 'u1', rules, scoring: {},
      content: { items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }] } });
    const tablero = (rules = {}) => ({ id: 'g_libre', template: 'memory', updatedAt: 'u1', rules, scoring: {},
      content: { pairs: [{ id: 'p1', left: 'a', right: 'b' }] } });

    // ── G1 · SECUENCIAL NUEVO: el primer valor se ve YA ────────────────────
    // Defecto que demuestra: el tic perdido. El cronómetro se creaba ANTES de
    // montar el marco, así que su primer número caía en un sitio que todavía no
    // existía y la pantalla se quedaba vacía hasta el segundo siguiente.
    {
      mem.clear();
      const raiz = hacerRaiz();
      runSequentialPlayer(raiz, quiz(), { mode: 'solo' }, { renderItem() {} });
      assert.ok(raiz.pintadas.length > 0,
        'G1: el cronómetro pinta su primer valor EN la cabecera, sin esperar un segundo');
      assert.strictEqual(raiz.pintadas[0], '0:00', 'G1: y ese primer valor es 0:00');
      ok('G1 · secuencial nuevo: el primer valor del reloj se ve ya');
    }

    // ── G2 · SECUENCIAL F5: la página y el ORIGEN llegan antes ─────────────
    // Defecto: el marco se montaba con «1 / 3» y el reloj arrancaba desde cero,
    // aunque el avance guardado dijera otra cosa. La corrección llegaba un
    // instante después, por `hudSet` — el alumno veía el número equivocado.
    {
      mem.clear();
      const act = quiz();
      runSequentialPlayer(hacerRaiz(), act, { mode: 'solo' }, {
        renderItem({ idx, item, submit }) { if (idx === 0) submit({ itemId: item.id, correct: true, points: 1 }); },
      });
      tic();
      ahora += 37_000;                       // 37 s fuera de la partida (F5 incluido)
      const raiz = hacerRaiz();
      // Se ATRAVIESA el `finish()` de verdad: responder los dos ítems que
      // quedan y leer el `timeUsed` que el shell entrega. Calcularlo a mano en
      // la prueba comprobaría mi aritmética, no la del shell.
      /** @type {{timeUsed?: number}|null} */
      let cierre = null;
      /** @type {number|null} */
      let primerIdx = null;
      runSequentialPlayer(raiz, act,
        { mode: 'solo', onFinish: (r) => { cierre = r; } }, {
          renderItem({ idx, item, submit }) {
            if (primerIdx === null) primerIdx = idx;
            ahora += 2_500;   // lo que el alumno tarda en cada uno
            submit({ itemId: item.id, correct: true, points: 1 });
          },
        });
      assert.ok(raiz.html.includes('2 / 3'),
        'G2: la cabecera NACE con la página restaurada, no con «1 / 3» corregido después');
      assert.strictEqual(raiz.pintadas[0], '0:37',
        'G2: el primer valor del reloj sale del origen guardado, no de cero');
      drenar();
      assert.strictEqual(cierre?.timeUsed, 42,
        'G2: y el `timeUsed` que ENTREGA el shell mide desde ese mismo origen (37 + 5)');
      assert.strictEqual(primerIdx, 1, 'G2: (retomó por el ítem 2, no por el primero)');
      ok('G2 · secuencial F5: página y origen restaurados ANTES de montar y de arrancar el reloj');
    }

    // ── G3 · LIBRE NUEVO: el primer valor aterriza en la cabecera del player ─
    // En el shell libre el marco es del PLAYER, así que el shell no puede saber
    // por su cuenta cuándo existe la superficie: hace falta que el player lo
    // diga. Sin esa fase, el reloj pintaba contra el vacío.
    {
      mem.clear();
      const raiz = hacerRaiz();
      const ctx = runFreeformPlayer(raiz, tablero(), { mode: 'solo' });
      raiz.innerHTML = '<div class="tablero"></div>';   // el player monta lo suyo
      /** @type {any} */ (ctx).listo?.();               // …y lo DICE
      assert.ok(raiz.pintadas.length > 0,
        'G3: el reloj del shell libre no pinta hasta que hay superficie, y entonces pinta YA');
      assert.strictEqual(raiz.pintadas[0], '0:00', 'G3: y su primer valor es 0:00');
      ok('G3 · libre nuevo: el primer valor se ve al montar el player');
    }

    // ── G4 · LIBRE F5: el origen se restaura ANTES de arrancar el reloj ─────
    // Medido en v1.51.728: HUD 0:00 mientras `timeUsed` decía 42 s. Dos lecturas
    // del mismo tiempo con orígenes distintos.
    {
      mem.clear();
      const act = tablero();
      const c1 = runFreeformPlayer(hacerRaiz(), act, { mode: 'solo' });
      c1.saveProgress({ hecho: 1 });
      ahora += 37_000;
      c1.saveProgress({ hecho: 2 });
      const raiz = hacerRaiz();
      const c2 = runFreeformPlayer(raiz, act, { mode: 'solo', onFinish: () => {} });
      const snap = c2.loadProgress();               // el player restaura su estado…
      raiz.innerHTML = '<div class="tablero"></div>';  // …monta…
      /** @type {any} */ (c2).listo?.();               // …y lo dice
      assert.deepStrictEqual(snap, { hecho: 2 }, 'G4: (el snapshot se restaura)');
      assert.strictEqual(raiz.pintadas[0], '0:37',
        'G4: el cronómetro continúa la partida original, no empieza de cero');
      ahora += 5_000;
      const fin = c2.finish({ score: 1, maxScore: 1 });
      assert.strictEqual(fin?.timeUsed, 42, 'G4: y `timeUsed` comparte ese origen');
      ok('G4 · libre F5: estado y origen antes del reloj; HUD y timeUsed continúan la partida');
    }

    // ── G5 · EL DESFASE DEL SERVIDOR no cambia una duración local ───────────
    // Individual mide una duración en UN aparato: es `clock.now()` de punta a
    // punta (§22-5 reserva la hora común para instantes ENTRE aparatos). Con
    // +10 s de desfase, 30 s jugados son 30 s — ni 40 (traducir mal el origen)
    // ni 0 (no restaurarlo).
    {
      mem.clear();
      noteServerDate(new Date(ahora + 10_000).toUTCString(), { enviadoMs: ahora, recibidoMs: ahora });
      assert.strictEqual(serverNow() - clock.now(), 10_000, 'G5: (hay desfase de +10 s)');
      const act = tablero();
      const c1 = runFreeformPlayer(hacerRaiz(), act, { mode: 'solo' });
      c1.saveProgress({ hecho: 1 });
      ahora += 30_000;                       // 30 s REALES
      const raiz = hacerRaiz();
      const c2 = runFreeformPlayer(raiz, act, { mode: 'solo', onFinish: () => {} });
      c2.loadProgress();
      raiz.innerHTML = '<div></div>';
      /** @type {any} */ (c2).listo?.();
      assert.strictEqual(raiz.pintadas[0], '0:30',
        'G5: el HUD dice 30 s — el desfase del servidor no se cuela en una duración local');
      assert.strictEqual(c2.finish({ score: 0, maxScore: 1 })?.timeUsed, 30, 'G5: y `timeUsed` también');
      // CONTRA-PRUEBA: el primitivo SIGUE midiendo con hora común por defecto —
      // es lo que Live necesita, y arreglar Solo no puede tocarlo.
      const vistos = [];
      startElapsedTicker({ since: serverNow() - 20_000, onTick: ({ label }) => vistos.push(label) }).stop();
      assert.strictEqual(vistos[0], '0:20',
        'G5 · CONTRA-PRUEBA: sin decirle nada, el ticker mide con la hora COMÚN (Live intacto)');
      noteServerDate(new Date(ahora).toUTCString(), { enviadoMs: ahora, recibidoMs: ahora });
      noteServerDate(new Date(ahora).toUTCString(), { enviadoMs: ahora, recibidoMs: ahora });
      noteServerDate(new Date(ahora).toUTCString(), { enviadoMs: ahora, recibidoMs: ahora });
      ok('G5 · el desfase del servidor no cambia una duración Individual, y Live conserva la hora común');
    }

    // ── G6 · CUENTA ATRÁS POR ÍTEM: se rearma, y empieza tras el ítem ───────
    // GUARDA, no defecto: esto ya estaba bien y el arreglo no puede romperlo.
    {
      mem.clear();
      const raiz = hacerRaiz();
      /** @type {string[]} */
      const orden = [];
      runSequentialPlayer(raiz, quiz({ timer: 30 }), { mode: 'solo' }, {
        renderItem({ idx, item, submit }) {
          orden.push(`ítem ${idx}`);
          if (idx === 0) submit({ itemId: item.id, correct: true, points: 1 });
        },
      });
      const primeros = raiz.pintadas.slice();
      assert.strictEqual(primeros[0], '30', 'G6: el ítem estrena su límite completo');
      tic();   // avanza al ítem 1
      assert.strictEqual(raiz.pintadas[raiz.pintadas.length - 1], '30',
        'G6: y el ítem siguiente REARMA la cuenta, porque el límite es por ítem');
      assert.deepStrictEqual(orden.slice(0, 2), ['ítem 0', 'ítem 1'], 'G6: (avanzó de ítem)');
      ok('G6 · cuenta atrás por ÍTEM: cada ítem estrena su límite');
    }

    // ── G7 · CUENTA ATRÁS DE PARTIDA: F5 NO regala el límite entero ─────────
    // Decisión del dueño (2026-09-18): una cuenta cuya unidad es TODA la
    // ejecución (partida · diagrama · sopa) continúa el presupuesto de ESA
    // partida tras un F5. Medido antes: Memoria con 180 s volvía con 180.
    // Y el número no se calcula UNA vez: sale del mismo origen local que
    // `timeUsed`, para que no puedan divergir.
    {
      mem.clear();
      const act = tablero({ timer: 180 });
      const c1 = runFreeformPlayer(hacerRaiz(), act, { mode: 'solo' });
      c1.saveProgress({ hecho: 1 });
      ahora += 60_000;                       // juega 60 s
      c1.saveProgress({ hecho: 2 });
      const raiz = hacerRaiz();
      const c2 = runFreeformPlayer(raiz, act, { mode: 'solo', onFinish: () => {} });
      c2.loadProgress();
      raiz.innerHTML = '<div></div>';
      /** @type {any} */ (c2).listo?.();
      assert.strictEqual(raiz.pintadas[0], '120',
        'G7: tras el F5 quedan los segundos que quedaban, no el límite entero');
      ok('G7 · cuenta atrás de PARTIDA: el F5 conserva lo consumido');
    }
    // ── G10 · EL AGOTAMIENTO NO SE PUEDE PERDER ────────────────────────────
    // Caso terminal: se guarda progreso en una Memoria de 180 s y se vuelve
    // PASADO el límite. El reloj anclado al origen expira en su primer tic, que
    // es SÍNCRONO dentro de `listo()` — y el player registra su `alAgotarse`
    // después, como hace Memoria. El aviso llegaba a un `null`: el ticker
    // quedaba terminado, nadie cerraba la partida y el alumno se quedaba con el
    // tablero abierto en 0. Un evento terminal no puede depender del orden
    // casual de dos llamadas, así que el shell lo RETIENE hasta que haya quien
    // lo escuche.
    {
      mem.clear();
      const act = tablero({ timer: 180 });
      const c1 = runFreeformPlayer(hacerRaiz(), act, { mode: 'solo' });
      c1.saveProgress({ hecho: 1 });
      ahora += 200_000;                      // se acabó el tiempo estando fuera
      const raiz = hacerRaiz();
      const c2 = runFreeformPlayer(raiz, act, { mode: 'solo', onFinish: () => {} });
      c2.loadProgress();
      raiz.innerHTML = '<div></div>';
      let cerrada = false;
      /** @type {any} */ (c2).listo();        // …aquí expira, en el primer tic
      c2.alAgotarse(() => { cerrada = true; });   // …y esto llega DESPUÉS
      assert.strictEqual(cerrada, true,
        'G10: el agotamiento que ocurre antes de registrar el aviso no se pierde');
      ok('G10 · volver con el tiempo ya agotado cierra la partida, no la deja abierta en 0');
    }

    // ── G11 · PARAR NO ES REINICIAR ────────────────────────────────────────
    // Tildes y Comas con `timer: 0` llevan CRONÓMETRO, que es de la partida. Al
    // entregar una frase, el runner pide parar —«esta frase ya está entregada:
    // su tiempo no corre»— y con el guard viejo eso era un no-op para un reloj
    // de partida: el cronómetro seguía vivo y, al segundo siguiente, `relojSet`
    // volvía a ENCENDER el chip que la corrección acababa de apagar. Parar es
    // dejar de pintar; volver a arrancar NO reinicia el origen.
    {
      mem.clear();
      const raiz = hacerRaiz();
      const ctx = runFreeformPlayer(raiz, tablero(), { mode: 'solo', onFinish: () => {} });
      raiz.innerHTML = '<div></div>';
      /** @type {any} */ (ctx).listo();
      ahora += 20_000; tic();
      assert.strictEqual(raiz.pintadas[raiz.pintadas.length - 1], '0:20', 'G11: (el cronómetro corre)');
      const cuantas = raiz.pintadas.length;
      ctx.pararReloj();
      ahora += 5_000; tic(); ahora += 5_000; tic();
      assert.strictEqual(raiz.pintadas.length, cuantas,
        'G11: parado NO pinta — y por eso la corrección no vuelve a encender el chip');
      ctx.rearmarReloj();
      assert.strictEqual(raiz.pintadas[raiz.pintadas.length - 1], '0:30',
        'G11: al volver, continúa desde el MISMO origen (30 s), no desde cero');
      ok('G11 · parar el reloj deja de pintarlo; rearmar no reinicia el origen de la partida');
    }

  } finally {
    setEffectsMuted(fxAntes);
    globalThis.document = docReal;
    global.setInterval = siReal; global.clearInterval = ciReal; global.setTimeout = stReal;
    clock.now = nowReal;
    delete global.localStorage;
  }
}

console.log(`\nreloj.test: ${passed} checks passed`);
