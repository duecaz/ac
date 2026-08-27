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

// Umbrales como los dejaría calibrar una pizarra real: punta 1,5 · dedo 6 ·
// trasera 14. Se derivan con la MISMA función que usa el panel, no a mano: unos
// umbrales inventados aquí probarían un aparato que no existe.
const THR = deriveThresholds({ penTip: 1.5, dedo: 6, trasera: 14 });

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
  return { ...v.cerrar(), pintadoProvisional: trazo.length };
}

// ── 1) EL DEFECTO: la basura inicial ya no decide ────────────────────────────
// El aparato reporta 1 (valor por defecto, no medida) en el primer evento y
// enseguida el tamaño real de la parte trasera del lápiz.
{
  const r = gesto([0.5, 14, 14.5, 13.8, 14.2, 14]);
  assert.strictEqual(r.accion, 'erase',
    'la trasera del lápiz tiene que BORRAR aunque el primer evento reporte basura');
  assert.strictEqual(r.confianza, 'alta', 'y con muestras limpias la confianza es alta');
  ok(`la basura inicial (0.5) no secuestra el veredicto: métrica ${r.metrica} → ${r.accion}`);
}

// ── 2) CONTRA-PRUEBA: el lápiz fino sigue dibujando ──────────────────────────
// Una regla que «borre más» se descubre con la clase delante y es igual de cara.
{
  const r = gesto([0.5, 1.4, 1.6, 1.5, 1.5]);
  assert.strictEqual(r.accion, 'draw', 'CONTRA-PRUEBA: la punta del lápiz DIBUJA');
  const dedo = gesto([0.5, 6, 6.2, 5.8, 6]);
  assert.strictEqual(dedo.accion, 'draw', 'CONTRA-PRUEBA: el dedo también dibuja');
  ok('CONTRA-PRUEBA: punta y dedo siguen dibujando (la regla no borra de más)');
}

// ── 3) EL TRAZO ES OPTIMISTA: se pinta desde el primer punto ─────────────────
// Si hubiera que esperar al veredicto, cada trazo saldría con retardo visible.
// Se comprueba que se pintó ANTES de decidir — y que se decide pronto, no al
// final del trazo.
{
  const r = gesto([0.5, 1.4, 1.6, 1.5, 1.5, 1.5, 1.5, 1.5]);
  assert.ok(r.pintadoProvisional >= 1,
    'tiene que pintarse desde el primer punto: esperar al veredicto es retardo en cada trazo');
  assert.ok(r.pintadoProvisional <= 6,
    `el veredicto tiene que llegar pronto, y tardó ${r.pintadoProvisional} eventos`);
  ok(`optimista: pinta desde el evento 1 y decide en el ${r.pintadoProvisional + 1}`);
}

// ── 4) EL TOQUE CORTO — la mecánica NORMAL de Tildes y Comas ─────────────────
// Marcar una tilde ES un toque, y puede durar menos que la ventana de descarte.
// Ahí no hay muestra limpia: no hay prueba. Se DIBUJA (nunca se borra sin
// pruebas) y se dice que la confianza es baja.
{
  const r = gesto([0.5, 12], { pasoMs: 8 });   // 16 ms en total: todo es basura
  assert.strictEqual(r.accion, 'draw',
    'sin muestras limpias NUNCA se borra: un borrado de más destruye lo que el alumno llevaba');
  assert.strictEqual(r.confianza, 'baja', 'y se dice que se decidió sin pruebas');
  assert.strictEqual(r.muestras, 0, 'porque no sobrevivió ninguna muestra a la ventana');
  ok('toque corto (marcar una tilde): dibuja y declara confianza baja, no borra a ciegas');
}

// ── 5) LA PALMA sigue mandando, y por CONTEO, no por tamaño ─────────────────
{
  const r = gesto([0.5, 9, 9.5, 9.2], { puntos: 3 });
  assert.strictEqual(r.tool, 'palm', 'tres contactos a la vez son una palma');
  assert.strictEqual(r.accion, 'erase', 'y la palma borra');
  // CONTRA-PRUEBA: el mismo tamaño con UN solo contacto no es palma.
  assert.notStrictEqual(gesto([0.5, 9, 9.5, 9.2], { puntos: 1 }).tool, 'palm',
    'CONTRA-PRUEBA: un contacto del mismo tamaño no puede ser palma');
  ok('la palma se decide por CONTEO de puntos (y un solo contacto igual de grande no lo es)');
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
// panel de verdad: que la trasera del lápiz borre YA demuestra que el lienzo no
// decide en el `pointerdown`, y que el panel mida la mediana de las muestras
// limpias demuestra que comparte ventana y estadístico con el veredicto.

console.log(`\npenVeredicto.test: ${passed} checks passed`);
