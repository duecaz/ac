// EL RELOJ ES UNO, Y SE CONFIGURA EN UN SOLO SITIO.
//
// El dueño abrió a editar un Quiz y no encontró el reloj (2026-09-01): estaba,
// pero enterrado en la pestaña «Modos» y partido en dos —el temporizador por un
// lado y el cronómetro por otro, en «Puntuación»—, y solo 4 plantillas de 13
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
const { relojDe, unidadDeCuenta } = await import('../core/reloj.js');
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
    const compartido = T.meta.contentModel === 'textCorrection' ? leer('core/textCorrectionRound.js') : '';
    // Quien corre sobre el shell SECUENCIAL hereda la cuenta atrás: la monta el
    // shell (core/soloPlayer.js) y, si la plantilla no dice qué hacer al agotarse,
    // el shell registra el ítem sin respuesta y avanza.
    const enElShell = /runSequentialPlayer/.test(fuentes);
    // Y quien corre sobre el shell LIBRE (un tablero entero en una pantalla:
    // Emparejar, Diagrama, Memoria, Crucigrama) lo lee cuando DICE qué hacer al
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
      if (/createCountdown\s*\(|startElapsedTicker\s*\(/.test(leer(rel))) culpables.push(rel);
    }
  };
  barrer('core'); barrer('views'); barrer('templates');
  assert.deepStrictEqual(culpables, [],
    `montan su propio reloj de actividad en vez de usar core/reloj.js: ${culpables.join(', ')}`);
  ok('un solo módulo monta el reloj de la actividad (dos excepciones declaradas, con motivo)');
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

console.log(`\nreloj.test: ${passed} checks passed`);
