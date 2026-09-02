// RED DE SEGURIDAD Nº3 (R6) — EN VIVO de punta a punta con DOS CONTEXTOS:
// una página HOST (profesor) y una página ALUMNO, sobre el backend local
// (localStorage + BroadcastChannel: multi-pestaña real, sin red ni Pi).
//
// Cierra el hueco que la matriz jugable declaraba ("el ALUMNO en vivo no está
// cubierto"): recorre el flujo canónico completo de una clase en vivo —
//   crear sala → PIN → alumno se une → empezar → pregunta → alumno responde →
//   revelar (settle) → clasificación → terminar → podio con los puntos REALES.
// La aserción final es la que importa tras C6: los puntos del alumno en el
// podio los puso el SETTLE del host, no el cliente.
//
//   node tools/live-smoke.mjs
//
// Requiere: python3 + el Chromium preinstalado (igual que matrix-smoke).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8481);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctx.newPage();
const student = await ctx.newPage();
const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|favicon/i;
const errs = [];
for (const [p, who] of [[host, 'host'], [student, 'alumno']]) {
  p.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(`${who}: ${m}`); });
  await p.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
  // Aquí vivía un SHIM de `bootstrap.Modal`: Bootstrap venía de un CDN, el
  // sandbox no tiene red, y sin él `confirmModal` reventaba y no se podía probar
  // ningún flujo con confirmación. Desde v1.51.594 Bootstrap es local
  // (`vendor/`), así que este viaje ejercita el diálogo DE VERDAD — que es lo
  // que ve el profe cuando termina una carrera, y lo que el shim nunca probó.
}
const log = (m) => console.log('  ·', m);

try {
  // ── HOST: sembrar un quiz y lanzar la sala ─────────────────────────────────
  await host.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
  await host.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });
  await host.evaluate(async () => {
    await import('/core/registerTemplates.js');
    const s = await import('/core/storage.js');
    s.save({ id: 'lv_e2e', template: 'quiz', title: 'Live e2e',
      content: { items: [
        { id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 },
        { id: 'q2', question: '3+3', answer: '6', options: ['6', '7'], points: 1 },
      ] },
      rules: {}, scoring: { mode: 'flat', pointsPerCorrect: 1 },
      live: { questionTimer: 30 }, updatedAt: 'x' });
  });
  await host.evaluate(() => { location.hash = '#/launch/lv_e2e'; });
  await host.waitForSelector('.ww-pin', { timeout: 12000 });
  const pin = (await host.locator('.ww-pin').textContent()).trim();
  log(`sala creada · PIN ${pin}`);

  // ── ALUMNO: unirse con el PIN ──────────────────────────────────────────────
  await student.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
  await student.waitForSelector('#f-code', { timeout: 12000 });
  await student.fill('#f-code', pin);
  await student.fill('#f-nick', 'Emma');
  await student.click('#btn-join');
  await host.waitForFunction(() => document.body.textContent.includes('Emma'), { timeout: 9000 });
  log('alumna "Emma" en el lobby del host (realtime cross-tab ✓)');

  // ── Empezar → pregunta → la alumna responde BIEN ───────────────────────────
  await host.click('#btn-start');
  await student.waitForSelector('.rq-opt, .ww-opt', { timeout: 9000 });
  log('pregunta en el móvil de la alumna');
  // R-1 · LECTURA (§26 ficha 1b): la pregunta se ve pero NO se puede responder
  // hasta el instante que manda la sala. Se comprueba que la puerta EXISTE (si
  // desaparece, el bonus de velocidad vuelve a premiar al que clica sin leer) y
  // que se abre sola — sin tocar nada.
  const gated = await student.locator('#s-round.s-reading').count();
  if (!gated) throw new Error('R-1: el móvil debería estar en LECTURA (bloqueado) al abrir la pregunta');
  const blocked = await student.evaluate(() => {
    const el = document.querySelector('#s-round.s-reading');
    return el ? getComputedStyle(el).pointerEvents === 'none' : false;
  });
  if (!blocked) throw new Error('R-1: la lectura no bloquea la interacción');
  log('lectura: la pregunta se ve pero no se puede tocar (R-1)');
  await student.waitForSelector('#s-round:not(.s-reading) .rq-opt, #s-round:not(.s-reading) .ww-opt', { timeout: 15000 });
  log('se abren las respuestas solas al llegar el instante de la sala');

  // ── LA PANTALLA DEL ALUMNO CABE, Y EL EJERCICIO LLENA EL MARCO ────────────
  // Dos promesas de la maqueta, que solo se comprueban MIDIENDO:
  //   (a) SIN SCROLL. El marco lleva la proporción de la plantilla dentro de una
  //       página normal, y su ancho
  //       máximo se deduce del alto libre (styles/player.css) descontando la
  //       barra REAL (`--ww-topbar-h`). Si alguien vuelve a meter un alto
  //       absoluto —hubo cuatro intentos, todos con su resta equivocada— el
  //       documento crece más que la ventana y aquí se ve.
  //   (b) EL EJERCICIO LLENA SU MARCO. El escenario es una columna flex con
  //       `container-type:size`; si ese eslabón se rompe, el `flex:1` de la
  //       actividad no tiene contra qué crecer y la ronda se queda a media
  //       altura (pasó: marco 913px, hoja 436).
  // Ninguna suite de lógica puede ver esto: son píxeles, y el reparto atraviesa
  // varios ficheros de CSS.
  {
    const m = await student.evaluate(() => {
      const doc = document.documentElement;
      const marco = document.getElementById('ww-frame');
      const ronda = document.getElementById('s-round');
      return {
        sobra: doc.scrollHeight - window.innerHeight,
        marco: marco ? Math.round(marco.getBoundingClientRect().height) : 0,
        ronda: ronda ? Math.round(ronda.getBoundingClientRect().height) : 0,
      };
    });
    // 2px de holgura: el redondeo de un dvh fraccionario no es un fallo.
    if (m.sobra > 2) throw new Error(`la pantalla del alumno no cabe: sobran ${m.sobra}px de scroll`);
    if (!m.marco) throw new Error('el alumno juega sin marco');
    if (m.ronda < m.marco * 0.7) {
      throw new Error(`el ejercicio no llena el marco del alumno: ronda ${m.ronda}px de un marco de ${m.marco}px`);
    }
    log(`el alumno cabe en su pantalla (0 scroll) y el ejercicio la llena (${m.ronda}/${m.marco}px)`);

    // …Y EN OTRAS VENTANAS. Medir en UNA sola es lo que dejó pasar el fallo: el
    // tope de ancho por alto libre vivía dentro de un `@media (min-width:1100px)`
    // mientras la proporción se aplicaba siempre, así que a 1280x800 salía 0 y en
    // un móvil apaisado el documento desbordaba 227px. Tres ventanas de formas
    // distintas: teléfono de pie, teléfono tumbado y tableta.
    for (const [w, h] of [[390, 844], [844, 390], [912, 600]]) {
      await student.setViewportSize({ width: w, height: h });
      await student.waitForTimeout(250);
      const sobra = await student.evaluate(() =>
        document.documentElement.scrollHeight - window.innerHeight);
      if (sobra > 2) throw new Error(`la pantalla del alumno no cabe a ${w}x${h}: sobran ${sobra}px`);
    }
    await student.setViewportSize({ width: 1280, height: 800 });
    await student.waitForTimeout(250);
    log('y cabe también en 390x844, 844x390 y 912x600 (el tope por alto se aplica en todos los anchos)');

    // LA MISMA FORMA QUE VE SU PROFESOR. La proporción la DECLARA la plantilla
    // (`meta.aspectRatio`) y la plataforma obedece, juegue quien juegue (§0).
    // Hubo un 4:3 escrito a mano en el marco del alumno: servía para la tarea,
    // pero le daba otra forma que a su profe en 11 de las 13 plantillas — y a la
    // Ruleta, que pide un cuadrado, un rectángulo. El quiz de esta sala declara
    // 16/10, así que eso es lo que tiene que medir su marco.
    const forma = await student.evaluate(async () => {
      await import('/core/registerTemplates.js');
      const { getTemplate } = await import('/core/registry.js');
      return {
        marco: getComputedStyle(document.getElementById('ww-frame')).aspectRatio.replace(/\s/g, ''),
        declara: (getTemplate('quiz')?.meta?.aspectRatio || '').replace(/\s/g, ''),
      };
    });
    if (!forma.declara) throw new Error('la plantilla del quiz debería declarar su proporción');
    if (forma.marco !== forma.declara) {
      throw new Error(`el marco del alumno usa ${forma.marco} y su plantilla declara ${forma.declara}`);
    }
    log(`el marco del alumno lleva la proporción que DECLARA la plantilla (${forma.declara}), la misma que ve el profe`);
  }

  await student.locator('.rq-opt, .ww-opt', { hasText: '4' }).first().click();
  // Con todos respondidos el host puede AUTO-liquidar (pasa directo a reveal);
  // si no, se revela a mano. Ambos caminos terminan en #btn-lb.
  //
  // CARRERA COMPROBAR-LUEGO-ACTUAR (arreglada v1.51.609). Esto preguntaba «¿está
  // #btn-lb?» y, si no, pulsaba #btn-reveal — pero entre la pregunta y el clic la
  // auto-liquidación puede dispararse, quitar #btn-reveal del DOM y poner #btn-lb.
  // Playwright se quedaba 30 s esperando un botón que ya no vuelve: la red fallaba
  // ~2 de cada 3 pasadas SIN que hubiera nada roto en el producto. Una red que a
  // veces falla enseña a re-ejecutar hasta que salga verde, que es exactamente
  // como se cuela un fallo de verdad.
  // Lo que importa es LLEGAR a #btn-lb: se intenta revelar a mano y se tolera que
  // el botón ya se haya ido solo. La comprobación de verdad es la línea siguiente
  // —si el revelado hacía falta y no funcionó, #btn-lb no aparece y esto falla
  // ahí, con su mensaje—, así que tolerar el clic no tapa nada.
  await host.waitForSelector('#btn-lb, #btn-reveal', { timeout: 9000 });
  if (!(await host.locator('#btn-lb').count())) {
    await host.click('#btn-reveal', { timeout: 4000 }).catch(() => {});
  }
  await host.waitForSelector('#btn-lb', { timeout: 9000 });
  log('respuesta recibida y liquidada por el settle del host');
  await host.click('#btn-lb');
  await host.waitForFunction(() => /Emma/.test(document.body.textContent) && /1/.test(document.body.textContent), { timeout: 9000 });
  log('clasificación con Emma puntuada por el settle');

  // ── Siguiente pregunta → sin responder → terminar → podio ─────────────────
  await host.click('#btn-next');
  await host.waitForSelector('#btn-reveal', { timeout: 9000 });
  await host.click('#btn-reveal');
  await host.waitForSelector('#btn-lb', { timeout: 9000 });
  await host.click('#btn-lb');
  await host.waitForSelector('#btn-end', { timeout: 9000 });
  await host.click('#btn-end');
  await host.waitForFunction(() => /podio|Podio|🏆|trophy/i.test(document.body.innerHTML), { timeout: 9000 });
  const podium = await host.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const emmaScored = /Emma/.test(podium);
  log(`podio del host: Emma ${emmaScored ? 'presente' : 'AUSENTE'}`);

  // La alumna ve el final con SU puntaje (autoritativo del servidor local).
  await student.waitForFunction(() => /final|Final|podio|puntos|rango/i.test(document.body.textContent), { timeout: 12000 });
  log('la alumna ve la pantalla de final');

  // ══ SEGUNDA PASADA: CARRERA LIBRE ═══════════════════════════════════════════
  // El otro flujo del host, que no estaba cubierto: cada alumno va a su ritmo, el
  // host ve una lista de progreso con cronómetro y un repintado de respaldo
  // (startRaceLoop). Aquí se comprueba lo que se puede romper sin que nadie lo
  // note: que el CRONÓMETRO avanza y que el progreso del alumno llega.
  await host.evaluate(() => { location.hash = '#/launch/lv_e2e'; });
  await host.waitForSelector('.ww-pin', { timeout: 12000 });
  const pin2 = (await host.locator('.ww-pin').textContent()).trim();
  await student.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
  await student.waitForSelector('#f-code', { timeout: 12000 });
  await student.fill('#f-code', pin2);
  await student.fill('#f-nick', 'Leo');
  await student.click('#btn-join');
  await host.waitForFunction(() => document.body.textContent.includes('Leo'), { timeout: 9000 });
  // El lobby ya no tiene un <select> con tres opciones desiguales: son DOS
  // preguntas y la primera se construye desde los bucles que la plantilla
  // DECLARA (§26). Elegir "Carrera libre" es pulsar su botón.
  await host.waitForSelector('.loop-pick[data-loop="race"]', { timeout: 9000 });
  await host.click('.loop-pick[data-loop="race"]');
  await host.click('#btn-start');
  await host.waitForSelector('#race-timer', { timeout: 9000 });
  log(`carrera arrancada · PIN ${pin2}`);

  // ── EL FONDO DE LA ACTIVIDAD VA EN EL MARCO, NO EN LA PÁGINA ─────────────
  // La vista que se PROYECTA en la pared era la única sin marco: el tema y el
  // fondo se aplicaban al <body>, así que el cuaderno de la actividad se pintaba
  // por toda la web —barra del profe incluida— y el juego no tenía caja (dueño,
  // 2026-08-15, con captura). Se comprueba en la fase de JUEGO, que es cuando el
  // fondo está encendido: si vuelve a colgarse del body, aquí se ve.
  {
    const m = await host.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundImage,
      marco: !!document.getElementById('ww-frame'),
    }));
    if (!m.marco) throw new Error('el docente proyecta sin marco de juego');
    if (m.body !== 'none') throw new Error(`el fondo de la actividad se coló en la página del docente (${m.body})`);
    log('el docente juega DENTRO del marco y la página no lleva el fondo de la actividad');
  }

  // El cronómetro es un reloj de verdad: su etiqueta cambia sola.
  const t0 = (await host.locator('#race-timer').textContent()).trim();
  await host.waitForFunction((prev) => (document.getElementById('race-timer')?.textContent || '').trim() !== prev,
    t0, { timeout: 9000 });
  log('el cronómetro de carrera avanza (startElapsedTicker vivo)');

  // El alumno resuelve un ítem y el host lo ve (evento o repintado de respaldo).
  await student.waitForSelector('.rq-opt, .ww-opt', { timeout: 12000 });
  await student.locator('.rq-opt, .ww-opt', { hasText: '4' }).first().click();
  await host.waitForFunction(() => /1\s*\/\s*2/.test(document.body.textContent), { timeout: 12000 });
  log('progreso del alumno en la lista del host (1/2)');

  await host.click('#btn-end-race');
  await host.click('.modal [data-act=ok]', { timeout: 9000 });   // confirmación real del profe
  await host.waitForFunction(() => /podio|Podio|🏆|trophy/i.test(document.body.innerHTML), { timeout: 12000 });
  log('podio tras la carrera');

  // En carrera un fallo VUELVE A LA COLA, así que todo el que termina lo hace
  // con todas bien: el puntaje no ordena nada y el podio DEBE decir la hora de
  // meta (quién llegó antes). Sin ella, la clase ve un empate.
  await host.waitForSelector('.ww-podium__sub', { timeout: 9000 });
  const meta = (await host.locator('.ww-podium__sub').first().textContent()).trim();
  if (!/^\d+:[0-5]\d$/.test(meta)) throw new Error(`el podio de carrera no muestra la hora de meta: "${meta}"`);
  log(`el podio muestra la hora de meta (${meta})`);

  // ══ TERCERA PASADA: EL RELOJ DE CADA APARATO (§22-5) ═══════════════════════
  // El punto ciego que destapó la ronda del compañero: las seis redes corren en
  // UNA máquina con UN reloj, así que el desfase entre el PC del profe y el
  // Android del alumno era exactamente 0 y no podía verse. Aquí el alumno entra
  // con el reloj DESPLAZADO, como un móvil con la hora automática apagada.
  // Sin la hora común esto fallaba así (medido, docs/handoff-reloj-aparatos.md):
  //   −10 s → profe «Preparados… 9» / alumno «Preparados… 19»
  //   −25 s → al alumno no se le abren las respuestas NUNCA: la pregunta se
  //           liquida «sin respuesta · 0 puntos»
  //   +10 s → la ventana de lectura desaparece: responde antes de leer
  //
  // Se prueban las DOS defensas, que son distintas y hacen falta las dos:
  //   · CON hora de servidor (lo normal en producción: PocketBase la manda en la
  //     cabecera `Date` de cada respuesta) → PARIDAD: alumno y profe ven la
  //     misma cuenta atrás. Aquí se siembran muestras a mano porque el backend
  //     local no tiene servidor que las mande.
  //   · SIN hora de servidor (backend local, red caída, cabecera ilegible) → el
  //     CINTURÓN de core/liveGate.js: la espera se acota y la respuesta cuenta
  //     igual. Es lo que salva la clase el día que la corrección no está.
  for (const caso of [{ skew: -25000, servidor: true }, { skew: 10000, servidor: true }, { skew: -25000, servidor: false }]) {
    const { skew, servidor } = caso;
    const torcido = await ctx.newPage();
    torcido.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(`alumno-desfasado: ${m}`); });
    await torcido.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
    await torcido.addInitScript((ms) => {
      const real = Date.now;
      const RealDate = Date;
      Date.now = () => real() + ms;
      window.Date = class extends RealDate {
        constructor(...a) { if (!a.length) super(real() + ms); else super(...a); }
        static now() { return real() + ms; }
      };
      window.__wwSkew = ms;
    }, skew);

    // Sala con lectura de 6 s y ventana de 12 s: con −25 s de desfase, la
    // fórmula vieja abría al alumno DESPUÉS del cierre (el fallo de aula).
    await host.evaluate(async () => {
      const s = await import('/core/storage.js');
      const a = s.get('lv_e2e'); a.live = { ...(a.live || {}), questionTimer: 12, readSeconds: 6 }; s.save(a);
    });
    await host.evaluate(() => { location.hash = '#/launch/lv_e2e'; });
    await host.waitForSelector('.ww-pin', { timeout: 12000 });
    const pin3 = (await host.locator('.ww-pin').textContent()).trim();
    await torcido.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
    await torcido.waitForSelector('#f-code', { timeout: 12000 });
    if (servidor) {
      // El "servidor" está en hora; este móvil no. En producción esto lo hace
      // solo `core/pbHttp.js` con la cabecera `Date` de cada respuesta.
      await torcido.evaluate(async () => {
        const m = await import('/core/serverNow.js');
        for (let i = 0; i < 5; i++) {
          const t = Date.now();                       // hora (torcida) del móvil
          m.noteServerDate(new Date(t - window.__wwSkew).toUTCString(), { enviadoMs: t, recibidoMs: t });
        }
      });
    }
    await torcido.fill('#f-code', pin3);
    await torcido.fill('#f-nick', `D${servidor ? 'S' : 'N'}${Math.abs(skew / 1000)}`);
    await torcido.click('#btn-join');
    await host.waitForSelector('.loop-pick[data-loop="rounds"]', { timeout: 9000 });
    await host.click('.loop-pick[data-loop="rounds"]');   // la pasada anterior dejó elegida la carrera
    await host.click('#btn-start');

    await torcido.waitForSelector('#s-round', { timeout: 9000 });
    const leerCuenta = async (p) => {
      const t = await p.evaluate(() => document.body.textContent.match(/Preparados…\s*(\d+)/)?.[1] ?? null);
      return t === null ? null : Number(t);
    };
    // Las dos cuentas atrás se pintan en su primer tick (200-250 ms): se espera
    // a que existan antes de compararlas, y se leen SEGUIDAS para que el propio
    // tiempo de lectura no falsee la comparación.
    let nAlumno = null, nHost = null;
    for (let i = 0; i < 20 && (nAlumno === null || nHost === null); i++) {
      nHost = await leerCuenta(host);
      nAlumno = await leerCuenta(torcido);
      if (nAlumno === null || nHost === null) await host.waitForTimeout(150);
    }

    if (servidor) {
      // T1 · PARIDAD: la clase entera ve la misma cuenta atrás. Es la aserción
      // que faltaba: "que se abra" no basta — con +10 s se abría al INSTANTE.
      if (nAlumno === null || nHost === null) {
        throw new Error(`§22-5: con hora de servidor los dos deben estar en la ventana de lectura (host=${nHost}, alumno=${nAlumno})`);
      }
      if (Math.abs(nAlumno - nHost) > 1) {
        throw new Error(`§22-5: desfase ${skew / 1000}s → el profe ve «Preparados… ${nHost}» y el alumno «${nAlumno}»`);
      }
      log(`reloj desfasado ${skew / 1000}s CON hora de servidor: profe ${nHost} · alumno ${nAlumno} (misma cuenta atrás)`);
    } else {
      // El cinturón solo: puede empezar tarde, pero NUNCA esperar más de lo
      // configurado (antes pintaba «Preparados… 31» sobre una lectura de 6 s).
      if (nAlumno !== null && nAlumno > 7) {
        throw new Error(`§22-5 (cinturón): sin hora de servidor el alumno ve «Preparados… ${nAlumno}» sobre una lectura de 6 s`);
      }
      log(`reloj desfasado ${skew / 1000}s SIN hora de servidor: la espera queda acotada (${nAlumno ?? '0'} s)`);
    }

    // Y en los tres casos, lo que importa: el alumno LLEGA A RESPONDER y cuenta.
    await torcido.waitForSelector('#s-round:not(.s-reading) .rq-opt, #s-round:not(.s-reading) .ww-opt', { timeout: 15000 });
    if (servidor) {
      // T2 · PARIDAD también en la cuenta de RESPUESTA (reporte del compañero
      // 2026-08-09: «en el celular 30 s, en el ordenador 20, y cierra cuando el
      // celular marca 10»). Las dos pantallas leen el MISMO deadline de la
      // sala: si las cifras no coinciden, algún reloj no está en la hora común.
      const segundosDe = async (p, sel) => {
        const t = await p.evaluate(s => document.querySelector(s)?.textContent.match(/(\d+)\s*s/)?.[1] ?? null, sel);
        return t === null ? null : Number(t);
      };
      let aHost = null, aAlumno = null;
      for (let i = 0; i < 20 && (aHost === null || aAlumno === null); i++) {
        aHost = await segundosDe(host, '#time-left');
        aAlumno = await segundosDe(torcido, '#s-time');
        if (aHost === null || aAlumno === null) await host.waitForTimeout(150);
      }
      if (aHost === null || aAlumno === null || Math.abs(aHost - aAlumno) > 1) {
        throw new Error(`§22-5 (respuesta): desfase ${skew / 1000}s → el profe ve «${aHost}s» y el alumno «${aAlumno}s»`);
      }
      log(`   …y la cuenta de RESPUESTA coincide (profe ${aHost}s · alumno ${aAlumno}s)`);
      // R-3 · Y LA BARRA DEL PROFE MIDE ESA MISMA VENTANA. Con tiempo POR
      // PREGUNTA el cierre lo fija `itemWindowMs` y el denominador de la barra
      // se quedaba en el de la actividad: con un ítem de 30 s y actividad de 20
      // se quedaba LLENA los primeros 10 s y luego caía de golpe. El número era
      // correcto, así que la parida de arriba no lo veía — la barra mentía sola.
      // Se ESPERA a que la barra baje, no se mira en un instante cualquiera: al
      // abrirse la respuesta quedan 12 s de una ventana de 12 s, así que el 100%
      // es CORRECTO ahí. Mirarlo sin esperar hacía fallar esta red una vez de
      // cada dos —un guardián que grita en los sitios buenos es el que la gente
      // acaba apagando—. Lo que de verdad se comprueba es que la barra AVANCE
      // dentro de la ventana de ESTA pregunta.
      let ancho = 100;
      for (let i = 0; i < 30 && ancho >= 99.99; i++) {
        ancho = await host.evaluate(() => parseFloat(document.getElementById('time-bar')?.style.width) || 0);
        if (ancho >= 99.99) await host.waitForTimeout(200);
      }
      if (ancho >= 99.99) {
        throw new Error('R-3: la barra del profe sigue al 100% tras 6 s de espera — mide una ventana que no es la de esta pregunta');
      }
    }
    await torcido.locator('.rq-opt, .ww-opt', { hasText: '4' }).first().click();
    await torcido.waitForFunction(() => /Correcto|enviada|puntos/i.test(document.body.textContent), { timeout: 12000 });
    log(`   …y su respuesta CUENTA (no «sin respuesta · 0 puntos»)`);
    await torcido.close();
    await host.click('#btn-end').catch(() => {});
    await host.locator('.modal [data-act=ok]').click({ timeout: 3000 }).catch(() => {});
  }

  // ══ CUARTA PASADA: UN GESTO NO DESTRUYE LO QUE EL ALUMNO TIENE ENTRE MANOS
  // (docs/handoff-costuras.md §1 B7-d) ═══════════════════════════════════════
  // Con una marca de Tildes A MEDIAS (dibujada, sin pulsar "Listo"), el host
  // hace algo que NO cambia de FASE —pausa el cronómetro: la sala sigue en
  // 'question', solo cambia `deadline`— y se comprueba que la marca sigue
  // puesta. La clave de repintado de views/studentLive.js (`paint()`, línea
  // ~241: `status-phase-current_item-deadline-ql_open-…`) SÍ incluye
  // `deadline`, así que una pausa fuerza un repintado real; un jugador nuevo o
  // un latido del host no tocan esos campos y por eso nunca llegan a
  // repintar —ese caso no puede perder nada porque nunca se repinta, así que
  // no prueba lo que este B7 pide medir—. Aquí se elige el gesto que SÍ
  // repinta, que es el único que puede destruir algo.
  {
    await host.evaluate(async () => {
      await import('/core/registerTemplates.js');
      const { getTemplate } = await import('/core/registry.js');
      const s = await import('/core/storage.js');
      const T = getTemplate('tildes');
      s.save({ id: 'lv_tildes', template: 'tildes', title: 'Gestos en vivo',
        content: T.meta.defaultContent(), rules: T.meta.defaultRules(),
        scoring: T.meta.defaultScoring(), live: {}, updatedAt: 'x' });
    });
    await host.evaluate(() => { location.hash = '#/launch/lv_tildes'; });
    await host.waitForSelector('.ww-pin', { timeout: 12000 });
    const pin4 = (await host.locator('.ww-pin').textContent()).trim();
    await student.goto(`${BASE}/student.html?backend=local#/join`, { waitUntil: 'domcontentloaded' });
    await student.waitForSelector('#f-code', { timeout: 12000 });
    await student.fill('#f-code', pin4);
    await student.fill('#f-nick', 'Nora');
    await student.click('#btn-join');
    await host.waitForFunction(() => document.body.textContent.includes('Nora'), { timeout: 9000 });
    await host.waitForSelector('.loop-pick[data-loop="rounds"]', { timeout: 9000 });
    await host.click('.loop-pick[data-loop="rounds"]');
    await host.click('#btn-start');
    await student.waitForSelector('#s-round:not(.s-reading) .tc-target', { timeout: 15000 });
    log(`sala de Tildes arrancada · PIN ${pin4}`);

    // Un trazo corto sobre la primera vocal-objetivo — el canvas escucha
    // eventos de puntero de verdad (core/textCorrectionDraw.js), así que hace
    // falta mover/bajar/arrastrar/soltar, no un click sintético (mismo driver
    // que tools/helpers/roundDrivers.mjs usa para "trazo", sin el paso final
    // que pulsa «Listo»: aquí la marca se queda A MEDIAS a propósito).
    const trazar = async () => {
      const t = student.locator('#s-round .tc-target').first();
      const b = await t.boundingBox();
      const y = b.y + b.height / 2;
      await student.mouse.move(b.x + b.width / 2 - 3, y);
      await student.mouse.down();
      await student.mouse.move(b.x + b.width / 2 + 3, y, { steps: 4 });
      await student.mouse.up();
      await student.waitForTimeout(200);
    };
    const marcada = () => student.locator('#s-round .tc-target.tc-marked').count();

    await trazar();
    if (!(await marcada())) throw new Error('B7-d: el trazo no dejó marca — revisar el driver, no el hallazgo (views/live/studentRondas.js aún no entra en juego)');
    log('el alumno dibuja UNA tilde (sin pulsar «Listo»)');

    // AUTOCOMPROBACIÓN EN ROJO del instrumento (regla de docs/handoff-costuras.md
    // §1 B7): se sabotea EN MEMORIA —se quita `tc-marked` a mano, sin pasar por
    // la app— y se comprueba que el conteo (`marcada()`) lo nota ANTES de
    // fiarse de él para el caso real de abajo.
    await student.evaluate(() => document.querySelector('#s-round .tc-target.tc-marked')?.classList.remove('tc-marked'));
    if (await marcada()) throw new Error('B7-d INSTRUMENTO: quitar tc-marked a mano no bajó el conteo — el detector no es de fiar, se aborta');
    log('  instrumento comprobado en ROJO (se quita `tc-marked` a mano → el conteo lo detecta)');
    await trazar();
    if (!(await marcada())) throw new Error('B7-d: no se pudo re-dibujar la marca tras la autocomprobación');

    // El HOST pausa: NO cambia de fase (sigue 'question'), solo `deadline`.
    await host.click('#btn-pause');
    await host.waitForTimeout(1200);   // BroadcastChannel es casi inmediato; se da margen igual
    const siguePuesta = await marcada();
    if (!siguePuesta) {
      throw new Error('B7-d HALLAZGO: el host pausa el cronómetro (la sala NO cambia de fase) y la marca de'
        + ' Tildes del alumno DESAPARECE. views/studentLive.js:~241-244 incluye `deadline` en la clave de'
        + ' repintado, así que la pausa SÍ dispara paint() → rondas.paintQuestion(); y'
        + ' views/live/studentRondas.js:82-115 vuelve a `mount()` #s-round y a llamar `tpl.renderRound()'
        + ' entero en cada llamada, sin restaurar el trazo en curso — el mismo patrón que ya rompió el'
        + ' editor (v1.51.642), esta vez fuera de él.');
    }
    log('la marca de Tildes SIGUE PUESTA tras un repintado real que no cambia de fase (host pausa el cronómetro)');
    await host.click('#btn-pause');   // reanuda, deja la sala limpia
    await host.click('#btn-end').catch(() => {});
    await host.locator('.modal [data-act=ok]').click({ timeout: 3000 }).catch(() => {});
  }
  log('La TAREA (PIN, nombre, respuesta a medias) queda FUERA de este archivo: tiene su propia sonda en tools/task-smoke.mjs.');

  if (errs.length) { console.error('\nERRORES DE PÁGINA:'); errs.forEach(e => console.error('  ✗', e)); }
  if (!emmaScored || errs.length) { console.log('\n❌ LIVE E2E FALLA'); await browser.close(); bye(1); }
  console.log('\n✅ LIVE E2E PASA — pregunta (sala→PIN→join→respuesta→settle→clasificación→podio),'
    + ' carrera (cronómetro vivo → progreso → podio) y RELOJ DESFASADO (±: la lectura se acota'
    + ' y la respuesta del alumno cuenta), en dos contextos.');
  await browser.close(); bye(0);
} catch (e) {
  console.error('\n❌ LIVE E2E FALLA:', String(e.message).split('\n')[0]);
  if (errs.length) errs.forEach(x => console.error('  ✗', x));
  try { await browser.close(); } catch {}
  bye(1);
}
