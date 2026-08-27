// Detección de herramienta por TAMAÑO de contacto, portado del enfoque de
// duecaz/play (libs/pen-detector.js). La idea: en una pizarra táctil el lápiz
// (punta) deja un contacto pequeño, el dedo uno mediano, la parte trasera del
// lápiz / borrador uno grande, y la palma varios puntos a la vez. Midiendo el
// "radio medio" del contacto podemos decidir si se DIBUJA o se BORRA.
//
//   métrica = radio medio del área de contacto (px CSS).
//   clasificación: palma (≥N puntos) → penThin → penThick → eraser → none.
//
// Los umbrales dependen del dispositivo, así que se CALIBRAN (core/penCalibration.js)
// y se guardan en sessionStorage con la MISMA clave que duecaz/play.

export const STORAGE_KEY = 'ep-pen-thresholds';

// Por defecto (SIN calibrar) todo lo que no sea palma DIBUJA: penThin y penThick
// cubren cualquier tamaño y el borrador por métrica queda deshabilitado (min muy
// alto). Así el comportamiento base = Fase 1 (dibujar + borrar con la palma).
// Tras calibrar, deriveThresholds fija los cortes reales y el lápiz trasero borra.
export const DEFAULT_THRESHOLDS = {
  penThin:  { min: 0,    max: 3      },   // lápiz punta  → dibujar
  penThick: { min: 3,    max: 1e9    },   // dedo         → dibujar
  eraser:   { min: 1e9,  max: 1e9    },   // lápiz trasero→ borrar (desactivado sin calibrar)
  palm:     { minPoints: 3            },  // palma        → borrar
};

export function loadThresholds() {
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { stored = null; }
  return {
    penThin:  { ...DEFAULT_THRESHOLDS.penThin,  ...stored?.penThin },
    penThick: { ...DEFAULT_THRESHOLDS.penThick, ...stored?.penThick },
    eraser:   { ...DEFAULT_THRESHOLDS.eraser,   ...stored?.eraser },
    palm:     { ...DEFAULT_THRESHOLDS.palm,     ...stored?.palm },
  };
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

// Clasifica por métrica y nº de contactos simultáneos. La palma se comprueba
// primero por conteo de puntos (igual que en duecaz/play).
export function classifyTool(metric, pointCount, thr = DEFAULT_THRESHOLDS) {
  if (pointCount >= thr.palm.minPoints)                              return 'palm';
  if (metric >= thr.penThin.min  && metric <= thr.penThin.max)       return 'penThin';
  if (metric >= thr.penThick.min && metric <= thr.penThick.max)      return 'penThick';
  if (metric >= thr.eraser.min   && metric <= thr.eraser.max)        return 'eraser';
  return 'none';
}

// Acción de cada herramienta: lápiz punta y dedo DIBUJAN; lápiz trasero y palma
// BORRAN. `none` (tamaño sin clasificar) dibuja, para no perder trazos.
export function toolAction(tool) {
  return (tool === 'eraser' || tool === 'palm') ? 'erase' : 'draw';
}

// Deriva umbrales a partir de las métricas medidas en la calibración. El orden
// natural por tamaño es: lápiz punta < dedo < lápiz trasero. Las fronteras se
// ponen en el punto medio entre herramientas contiguas medidas.
//   measured: { penTip, dedo, trasera, palma }  (number | null)
export function deriveThresholds(measured = {}) {
  const thr = loadThresholds();
  const tip = num(measured.penTip), dedo = num(measured.dedo), tras = num(measured.trasera);

  // Frontera lápiz punta ↔ dedo.
  if (tip != null && dedo != null) {
    const b1 = (tip + dedo) / 2;
    thr.penThin  = { min: 0,  max: b1 };
    thr.penThick = { min: b1, max: thr.penThick.max };
  } else if (tip != null) {
    thr.penThin  = { min: 0,  max: tip + 1 };
    thr.penThick = { min: tip + 1, max: thr.penThick.max };
  }

  // Frontera (lo que dibuja) ↔ lápiz trasero (borrador).
  const maxDraw = Math.max(tip ?? -Infinity, dedo ?? -Infinity);
  if (tras != null && Number.isFinite(maxDraw)) {
    const b2 = (maxDraw + tras) / 2;
    thr.penThick = { min: thr.penThick.min, max: b2 };
    thr.eraser   = { min: b2, max: 1e9 };
  } else if (tras != null) {
    thr.eraser   = { min: Math.max(0, tras - 1), max: 1e9 };
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
    if (tool === 'palm') {
      return { tool, accion: 'erase', metrica, muestras: limpias.length, confianza: 'alta' };
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
