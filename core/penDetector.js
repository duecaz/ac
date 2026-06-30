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

export function isCalibrated() {
  try { return !!sessionStorage.getItem(STORAGE_KEY); } catch { return false; }
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
