// EL PRIMER TOQUE ES BASURA, Y NO PUEDE DECIDIR SI SE DIBUJA O SE BORRA.
//
// `tests/penDetector.test.mjs` prueba `classifyTool` AISLADA y está bien: dado
// un tamaño, sale la herramienta correcta. El defecto no vivía ahí. Vivía en la
// COSTURA — en la secuencia de eventos:
//
//   · la CALIBRACIÓN descartaba los primeros ms y se quedaba con la mediana;
//   · el DIBUJO decidía en el `pointerdown`, la muestra que la calibración tira,
//     y fijaba la acción para todo el trazo sin volver a mirar.
//
// En muchas pizarras el primer evento ni siquiera es una medida: `width`/`height`
// valen 1 por defecto. Métrica ~0,5 → punta fina → dibuja. El borrador trasero no
// disparaba nunca, por bien calibrado que estuviera, y ninguna suite podía verlo
// porque ninguna reproducía una secuencia.
//
// Esta suite reproduce GESTOS COMPLETOS con reloj falso. Cada caso es una queja
// que la pizarra produciría con la clase delante.
//
// Run: node tests/penVeredicto.test.mjs
import assert from 'node:assert';
import { crearVeredicto, deriveThresholds, mediana } from '../core/penDetector.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Umbrales como los dejaría calibrar una pizarra real: dedo 6 · palma 20, o sea
// frontera en 13. Se derivan con la MISMA función que usa el panel, no a mano:
// unos umbrales inventados aquí probarían un aparato que no existe.
const THR = deriveThresholds({ dedo: 6, palma: 20 });

/** Reproduce un gesto. `muestras` son los tamaños de contacto que reporta el
 *  aparato, uno por evento, con `pasoMs` entre ellos. Devuelve el veredicto tal
 *  y como lo vería el lienzo. */
function gesto(muestras, { pasoMs = 16, puntos = 1, thr = THR } = {}) {
  let t = 0;
  const v = crearVeredicto({ thr, ahora: () => t });
  const trazo = [];
  for (const tam of muestras) {
    // Un PointerEvent reporta el DIÁMETRO en width/height; pointerMetric saca el
    // radio medio. Se alimenta igual que lo haría el navegador.
    v.muestra({ width: tam * 2, height: tam * 2 }, puntos);
    if (!v.listo()) trazo.push(tam);          // mientras no hay veredicto, se pinta
    t += pasoMs;
  }
  return { ...v.cerrar(), eventosSinVeredicto: trazo.length };
}

// ── 1) EL DEFECTO: la basura inicial ya no decide ────────────────────────────
// El aparato reporta 1 (valor por defecto, no medida) en el primer evento y
// enseguida el tamaño real de la PALMA, que aquí llega como UN contacto grande —
// así la reportan muchas pizarras, y por eso el tamaño es una señal y no un lujo.
{
  const r = gesto([0.5, 20, 21, 19.5, 20.4, 20]);
  assert.strictEqual(r.accion, 'erase',
    'la palma tiene que BORRAR aunque el primer evento reporte basura');
  assert.strictEqual(r.confianza, 'alta', 'y con muestras limpias la confianza es alta');
  ok(`la basura inicial (0.5) no secuestra el veredicto: métrica ${r.metrica} → ${r.accion}`);
}

// ── 2) CONTRA-PRUEBA: todo lo más pequeño que la frontera escribe ────────────
// Una regla que «borre más» se descubre con la clase delante y es igual de cara.
{
  const r = gesto([0.5, 1.4, 1.6, 1.5, 1.5]);
  assert.strictEqual(r.accion, 'draw', 'CONTRA-PRUEBA: la punta del lápiz ESCRIBE');
  const dedo = gesto([0.5, 6, 6.2, 5.8, 6]);
  assert.strictEqual(dedo.accion, 'draw', 'CONTRA-PRUEBA: el dedo también escribe');
  // Y justo por debajo de la frontera (13) sigue escribiendo: es el borde, que es
  // donde una frontera mal puesta se nota.
  assert.strictEqual(gesto([0.5, 12, 12.4, 12, 12]).accion, 'draw',
    'CONTRA-PRUEBA: rozando la frontera por debajo, todavía escribe');
  ok('CONTRA-PRUEBA: punta, dedo y hasta el borde de la frontera siguen escribiendo');
}

// ── 3) EL VEREDICTO LLEGA DEPRISA, porque nada se pinta hasta que llega ─────
// La v1.51.609 pintaba de forma optimista y retiraba el trazo si había que
// borrar; con la palma en movimiento eso era un rastro de tinta visible (dueño,
// 2026-08-27). Ahora los puntos se guardan sin pintar, así que el retardo del
// veredicto ES el retardo de la tinta: tiene que ser de pocos eventos o habremos
// cambiado un defecto visible por otro.
// El rastro en píxeles y el retardo real se miden en `tools/lapiz-sonda.mjs`;
// aquí se fija el número de eventos, que es lo que el primitivo controla.
{
  const r = gesto([0.5, 1.4, 1.6, 1.5, 1.5, 1.5, 1.5, 1.5]);
  assert.ok(r.eventosSinVeredicto <= 2,
    `el veredicto tiene que llegar en 2 eventos o menos, y tardó ${r.eventosSinVeredicto}`);
  ok(`el veredicto se dicta tras ${r.eventosSinVeredicto} evento(s) sin pintar: la tinta no espera`);
}

// ── 4) EL TOQUE CORTO — la mecánica NORMAL de Tildes y Comas ─────────────────
// Marcar una tilde ES un toque: dos eventos y fuera. Ahí solo queda UNA muestra
// limpia, y una muestra no es una medida, es un número. No basta para autorizar
// un borrado — que es destructivo — así que se ESCRIBE y se declara confianza
// baja. Este caso cazó el agujero que abrió acelerar el veredicto: al quitar el
// suelo de tiempo, ese único número pasó a valer como prueba y un toque con la
// palma borraba la hoja.
{
  const r = gesto([0.5, 20], { pasoMs: 8 });
  assert.strictEqual(r.accion, 'draw',
    'con una sola muestra NUNCA se borra: un borrado de más destruye lo que el alumno llevaba');
  assert.strictEqual(r.confianza, 'baja', 'y se dice que se decidió sin pruebas suficientes');
  assert.ok(r.muestras < 2, `solo sobrevivió ${r.muestras} muestra al descarte del primer evento`);
  // CONTRA-PRUEBA: un toque un pelín más largo —dos muestras limpias— SÍ borra.
  // Sin esto, «no borrar nunca en toques cortos» podría acabar tragándose la
  // palma que se apoya y se levanta enseguida.
  assert.strictEqual(gesto([0.5, 20, 20.5], { pasoMs: 8 }).accion, 'erase',
    'CONTRA-PRUEBA: con dos muestras limpias, una palma breve sí borra');
  ok('toque corto: escribe con confianza baja; una muestra más y la palma ya borra');
}

// ── 5) LAS DOS SEÑALES DE LA PALMA, que NO son la misma prueba ──────────────
// Por CONTEO: fiable desde el primer evento, así que decide aunque el gesto sea
// corto — que es justo como llega una palma, de golpe. Por TAMAÑO: necesita
// muestras limpias como todo lo demás.
{
  const r = gesto([0.5, 9, 9.5, 9.2], { puntos: 3 });
  assert.strictEqual(r.tool, 'palma', 'tres contactos a la vez son una palma…');
  assert.strictEqual(r.accion, 'erase', '…y borran');
  // CONTRA-PRUEBA: ese mismo tamaño (9, por debajo de la frontera 13) con UN solo
  // contacto NO es palma. Si lo fuera, apoyar dos dedos borraría la hoja.
  assert.strictEqual(gesto([0.5, 9, 9.5, 9.2], { puntos: 1 }).tool, 'dedo',
    'CONTRA-PRUEBA: un solo contacto de ese tamaño escribe, no borra');
  // Y la palma por CONTEO manda aunque el gesto sea demasiado corto para tener
  // muestras limpias: ahí el tamaño no sabría nada y el conteo sí.
  const golpe = gesto([0.5, 9], { pasoMs: 8, puntos: 3 });
  assert.strictEqual(golpe.accion, 'erase', 'una palma de golpe borra aunque no dé tiempo a medir');
  assert.strictEqual(golpe.confianza, 'alta', 'y con confianza alta: el conteo no depende de la medida');
  ok('las dos señales de palma: por conteo decide de golpe, por tamaño espera muestras limpias');
}

// ── 6) EL VEREDICTO NO CAMBIA DE IDEA A MITAD DEL TRAZO ──────────────────────
// Decidir tarde es malo; cambiar de herramienta a mitad es peor — el trazo se
// partiría en dibujo y borrado según cómo apoyara la mano.
{
  let t = 0;
  const v = crearVeredicto({ thr: THR, ahora: () => t });
  for (const tam of [0.5, 1.5, 1.5, 1.5]) { v.muestra({ width: tam * 2, height: tam * 2 }, 1); t += 20; }
  const primero = v.veredicto();
  // …y ahora el usuario apoya más: llegan muestras enormes.
  for (const tam of [15, 16, 15.5]) { v.muestra({ width: tam * 2, height: tam * 2 }, 1); t += 20; }
  assert.deepStrictEqual(v.veredicto(), primero,
    'una vez dictado, el veredicto se congela: un trazo no puede partirse en dibujo y borrado');
  ok('el veredicto se congela: apoyar más a mitad de trazo no lo convierte en borrado');
}

// ── 7) EL MISMO ESTADÍSTICO QUE LA CALIBRACIÓN ──────────────────────────────
// Si la calibración resume el toque con la mediana y el dibujo lo resume de otra
// forma, los umbrales calibrados no describen lo que el dibujo mide. Es la misma
// función, y esto lo fija.
{
  const tams = [13, 14, 30, 14, 14];          // un pico espurio en medio
  const r = gesto([0.5, ...tams]);
  assert.strictEqual(r.metrica, mediana(tams),
    'el veredicto tiene que salir de la MEDIANA de las muestras limpias, como la calibración');
  assert.notStrictEqual(r.metrica, tams.reduce((a, b) => a + b, 0) / tams.length,
    'CONTRA-PRUEBA: no es la media — un pico espurio la desplazaría');
  ok(`mediana (${r.metrica}) y no media: un pico de 30 no mueve el veredicto`);
}

// LO QUE ESTA SUITE NO COMPRUEBA, Y DÓNDE SE COMPRUEBA. Aquí estuvieron dos
// escaneos del TEXTO de `penCalibration.js` y `textCorrectionDraw.js` («¿usan el
// primitivo?»). Los quitó la regla del propio repo —`tests/citasFuente.test.mjs`:
// si se puede comprobar EJECUTANDO, no se cita la fuente— y hoy los dos se
// comprueban por COMPORTAMIENTO en `tools/lapiz-sonda.mjs`, sobre el lienzo y el
// panel de verdad: que la PALMA borre YA demuestra que el lienzo no
// decide en el `pointerdown`, y que el panel mida la mediana de las muestras
// limpias demuestra que comparte ventana y estadístico con el veredicto.

console.log(`\npenVeredicto.test: ${passed} checks passed`);
