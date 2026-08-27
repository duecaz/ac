// DOS HERRAMIENTAS, UNA FRONTERA: el dedo (y todo lo más pequeño) DIBUJA, la
// palma BORRA. Decisión del dueño, 2026-08-27: «hagámoslo solo con dos opciones,
// dedo y palma… así simplificamos».
//
// Antes había CUATRO (lápiz punta · dedo · parte trasera del lápiz · palma) y por
// tanto TRES fronteras que calibrar. Cada frontera es una forma de equivocarse
// con la clase delante, y las dos de en medio no daban nada: punta y dedo hacían
// lo MISMO (dibujar), así que separarlas solo servía para colocar mal la tercera.
// Con una sola frontera, la calibración baja de cuatro recuadros a dos y lo que
// el profe tiene que entender cabe en una frase.
//
//   métrica = radio medio del área de contacto (px CSS).
//   clasificación: palma si hay ≥N contactos A LA VEZ **o** el contacto es más
//   grande que la frontera; en cualquier otro caso, dedo.
//
// DOS SEÑALES PARA LA PALMA, y son distintas a propósito. Unas pizarras reportan
// la palma como VARIOS punteros (ahí manda el conteo, fiable desde el primer
// evento) y otras como UN contacto enorme (ahí manda el tamaño, que necesita
// muestras limpias — ver `crearVeredicto`). Quedarse con una sola dejaba fuera
// la mitad de los aparatos.
//
// La frontera depende del aparato, así que se CALIBRA (core/penCalibration.js) y
// se guarda en sessionStorage con la MISMA clave que duecaz/play.

export const STORAGE_KEY = 'ep-pen-thresholds';

// SIN CALIBRAR, el tamaño NO borra (`min: 1e9`) y solo la palma por CONTEO lo
// hace. Es el defecto seguro: sin haber medido el aparato no hay forma de saber
// qué es «grande» ahí, y equivocarse por ese lado destruye lo que el alumno
// llevaba escrito. Al calibrar, `deriveThresholds` pone la frontera de verdad.
export const DEFAULT_THRESHOLDS = {
  palma: { min: 1e9, minPuntos: 3 },
};

export function loadThresholds() {
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { stored = null; }
  return { palma: { ...DEFAULT_THRESHOLDS.palma, ...stored?.palma } };
}

export function saveThresholds(thr) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(thr)); } catch {}
  return thr;
}


// Radio medio del contacto de un PointerEvent. `width`/`height` son el DIÁMETRO
// del área de contacto en px CSS (el ratón suele reportar ~1 → métrica ~0.5).
export function pointerMetric(e) {
  const w = e.width || 0, h = e.height || 0;
  return (w + h) / 4;   // (diámetro medio) / 2 = radio medio
}

/** Palma o dedo, y ya está. Por CONTEO de contactos o por TAMAÑO; cualquiera de
 *  las dos señales basta, porque cada aparato reporta la palma de una forma. */
export function classifyTool(metric, pointCount, thr = DEFAULT_THRESHOLDS) {
  if (pointCount >= thr.palma.minPuntos) return 'palma';
  if (metric >= thr.palma.min)           return 'palma';
  return 'dedo';
}

/** El dedo (y todo lo más pequeño: la punta del lápiz, el ratón) DIBUJA; solo la
 *  palma BORRA. Cualquier nombre que no sea `palma` dibuja, a propósito: si algún
 *  día se añade una herramienta y se olvida aquí, el defecto es no destruir nada. */
export function toolAction(tool) {
  return tool === 'palma' ? 'erase' : 'draw';
}

/** LA ÚNICA FRONTERA: el punto medio entre el dedo medido y la palma medida.
 *
 *  Hacen falta LAS DOS medidas y, si falta una, la frontera NO se pone (queda en
 *  1e9 y solo borra el conteo de contactos). Antes se adivinaba con una sola
 *  —`trasera - 1`—: una frontera inventada a partir de un único punto no describe
 *  ningún aparato, y el error se paga borrando lo que el alumno había escrito.
 *  Es mejor quedarse en el defecto seguro y que el profe toque los dos recuadros.
 *  @param {{dedo?: number, palma?: number}} measured */
export function deriveThresholds(measured = {}) {
  const thr = loadThresholds();
  const dedo = num(measured.dedo), palma = num(measured.palma);
  if (dedo != null && palma != null && palma > dedo) {
    thr.palma = { ...thr.palma, min: (dedo + palma) / 2 };
  }
  return thr;
}

function num(v) { return (typeof v === 'number' && Number.isFinite(v)) ? v : null; }

/** LA MEDIANA, con un dueño. La tenía copiada `penCalibration.js`: si la
 *  calibración resume el toque con un estadístico y el dibujo lo resume con
 *  otro, los umbrales calibrados no describen lo que el dibujo mide. */
export function mediana(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── EL VEREDICTO SE APLAZA ───────────────────────────────────────────────────
//
// EL DEFECTO QUE CIERRA (dueño, 2026-08-27: «eliminar el primer toque basura
// para que no influya ni en la calibración ni en la escritura o el borrado»).
// La calibración YA descartaba los primeros ms y se quedaba con la MEDIANA…
// mientras el dibujo decidía la herramienta en el `pointerdown`, que es
// exactamente la muestra que la calibración tira. Y la fijaba ahí para todo el
// trazo: los `pointermove` siguientes traen el tamaño de verdad y nadie los
// miraba. En muchas pizarras el primer evento ni siquiera es una medida —
// `width`/`height` valen 1 por defecto—, así que la métrica salía ~0,5, se
// clasificaba como punta fina y el borrador trasero no disparaba nunca, por bien
// calibrado que estuviera. Ninguna suite lo veía: `classifyTool` es correcta
// aislada, y el fallo vive en la COSTURA (la secuencia de eventos).
//
// DOS DECISIONES, y son decisiones, no detalles:
//
//  1. EL TRAZO ES OPTIMISTA. Esperar a tener veredicto antes de pintar mete
//     retardo visible en CADA trazo, con la clase delante y en una pizarra que
//     ya va justa. Se pinta desde el primer punto y, si el veredicto acaba
//     diciendo «borrar», se RETIRA el trazo provisional y se borra por donde
//     pasó. Retirar tinta recién puesta no se nota; el retardo sí.
//
//  2. BORRAR PIDE PRUEBAS; DIBUJAR ES EL DEFECTO. Asimétrico a propósito: un
//     trazo de más se quita con el borrador, pero un borrado de más destruye lo
//     que el alumno llevaba hecho. Si el gesto se acaba sin muestras limpias
//     —un toque más corto que la ventana, que en Tildes y Comas es la mecánica
//     NORMAL (marcar es tocar)— se dibuja, y se dice que la confianza es baja.
//
/** @param {object} o
 *  @param {object} o.thr        umbrales (los de `loadThresholds()` por defecto)
 *  @param {number} o.ignoraMs   ms iniciales que se descartan (el toque basura)
 *  @param {number} o.ventanaMs  cuándo se decide como muy tarde
 *  @param {number} o.minMuestras muestras limpias que bastan para decidir antes
 *  @param {Function} o.ahora    reloj inyectable (los tests corren con tiempo falso) */
/** LA VENTANA, declarada UNA vez. La calibración la importa de aquí: si
 *  descartara MÁS ms que el dibujo, su mediana describiría un tramo distinto del
 *  toque y los umbrales calibrados no dirían nada sobre lo que el dibujo mide.
 *  Tenía 80 escrito a mano en `penCalibration.js` y 60 aquí. */
export const VENTANA = { ignoraMs: 60, ventanaMs: 140, minMuestras: 3 };

export function crearVeredicto({
  thr = DEFAULT_THRESHOLDS,
  ignoraMs = VENTANA.ignoraMs, ventanaMs = VENTANA.ventanaMs, minMuestras = VENTANA.minMuestras,
  ahora = () => performance.now(),
} = {}) {
  const t0 = ahora();
  const limpias = [];      // muestras posteriores a `ignoraMs`
  const todas = [];        // TODAS, incluida la basura (para el toque corto)
  let puntosMax = 0;
  let cerrado = null;

  const decidir = () => {
    const hayLimpias = limpias.length > 0;
    const metrica = hayLimpias ? mediana(limpias) : mediana(todas);
    const tool = classifyTool(metrica, puntosMax, thr);
    // DOS PRUEBAS DISTINTAS, y confundirlas costó un caso. El toque basura
    // ensucia el TAMAÑO del contacto, no el NÚMERO de contactos: apoyar la palma
    // se reconoce por conteo de punteros, que es fiable desde el primer evento y
    // no depende de ninguna medida. Así que la palma decide con confianza alta
    // aunque el gesto sea más corto que la ventana — que es justo como llega una
    // palma: de golpe. Exigirle muestras limpias dejaba a la palma dibujando.
    // La palma por CONTEO no necesita muestras limpias (el conteo es fiable desde
    // el primer evento); la palma por TAMAÑO sí, y cae en el caso general de
    // abajo. Confundir las dos pruebas dejaba a la palma dibujando.
    if (puntosMax >= thr.palma.minPuntos) {
      return { tool: 'palma', accion: 'erase', metrica, muestras: limpias.length, confianza: 'alta' };
    }
    // Para lo demás manda el TAMAÑO: con muestras limpias, su MEDIANA (el mismo
    // estadístico que calibró los umbrales). Sin ellas el gesto fue más corto que
    // la ventana: no hay prueba, así que se DIBUJA (regla 2) y se dice.
    return { tool, accion: hayLimpias ? toolAction(tool) : 'draw', metrica,
             muestras: limpias.length, confianza: hayLimpias ? 'alta' : 'baja' };
  };

  return {
    /** Una muestra por evento. `puntos` = punteros activos simultáneos. */
    muestra(e, puntos = 1) {
      if (cerrado) return;
      const m = pointerMetric(e);
      todas.push(m);
      if (puntos > puntosMax) puntosMax = puntos;
      if (ahora() - t0 >= ignoraMs) limpias.push(m);
    },
    /** ¿Hay ya con qué decidir? Por muestras limpias o porque se acabó el plazo. */
    listo() {
      return !!cerrado || limpias.length >= minMuestras || (ahora() - t0) >= ventanaMs;
    },
    /** El veredicto, calculado UNA vez y congelado (el trazo no cambia de idea
     *  a mitad: eso sería peor que decidir tarde). */
    veredicto() { return (cerrado ||= decidir()); },
    /** Cierra el gesto (pointerup) y fuerza el veredicto con lo que haya. */
    cerrar() { return this.veredicto(); },
    /** Lo que se hace MIENTRAS no hay veredicto (regla 1). */
    provisional: 'draw',
  };
}
