// Capa de dibujo para Tildes/Comas: el alumno DIBUJA la marca (tilde / coma) con
// lápiz o táctil sobre el texto, en vez de tocar. El INICIO del trazo dentro de
// la zona de una vocal/hueco marca esa posición → mismo `value` (number[]) que el
// modo "tocar", así el scoring/solo/host no cambian.
//
// FASE 2 — detección por TAMAÑO de contacto (core/penDetector.js): lápiz punta y
// dedo DIBUJAN; lápiz parte trasera BORRA; palma (≥3 contactos) BORRA. Los
// umbrales se calibran con "Calibrar pizarra"; SIN calibrar todo dibuja salvo la
// palma (=Fase 1).
//
// FASE 2b — EL VEREDICTO SE APLAZA (v1.51.609). Antes la herramienta se decidía
// en el `pointerdown` y se fijaba para todo el trazo. Ese primer evento es
// justo el que la calibración DESCARTA por basura —en muchas pizarras ni
// siquiera es una medida: `width`/`height` valen 1 por defecto—, así que el
// borrador trasero casi no disparaba. Ahora se pinta desde el primer punto
// (optimista: el retardo se ve, retirar tinta recién puesta no) y el veredicto
// llega con muestras limpias; si dice BORRAR, se retira el trazo provisional y
// se borra por donde pasó. La lógica vive entera en `crearVeredicto`, que es
// también quien fija el estadístico que usa la calibración.
//
// Adaptado del enfoque de duecaz/play (zonas + trazos en canvas).

import { crearVeredicto, loadThresholds } from './penDetector.js';
import { observeResize } from './observeResize.js';

export function mountTcDraw(passageEl, { targets, onChange } = {}) {
  passageEl.style.position = 'relative';
  passageEl.style.touchAction = 'none';

  const canvas = document.createElement('canvas');
  canvas.className = 'tc-canvas';
  passageEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const tg = [...(targets || [])];
  let zones = [];               // { pos, el, x, y, w, h, hit }
  let strokes = [];             // [{ pts:[{x,y}] }]
  const active = new Set();     // pointerIds activos (para detectar palma)
  const pointerAction = new Map(); // pointerId → 'draw' | 'erase' (YA dictaminado)
  const votos = new Map();         // pointerId → veredicto en curso (aún sin dictaminar)
  let drawing = false, palmErase = false, eraserMode = false, frozen = false, cur = null, dpr = 1;

  function resize() {
    const r = passageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.max(1, Math.round(r.width  * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    recalcZones();
    redraw();
  }

  function recalcZones() {
    const pr = passageEl.getBoundingClientRect();
    const prevHit = new Map(zones.map(z => [z.pos, z.hit]));
    const fontPx = parseFloat(getComputedStyle(passageEl).fontSize) || 16;
    zones = tg.map(el => {
      const r = el.getBoundingClientRect();
      // Dos geometrías según DÓNDE se dibuja la marca:
      //  · TILDE (vocal): ARRIBA de la letra → zona alta con mucho margen superior.
      //  · COMA (hueco): el span está vacío (rect de alto ~0, en la línea base) y la
      //    coma se dibuja EN/BAJO la línea → banda centrada en la base, con margen
      //    abajo. Ancho mínimo relativo al font (el hueco no tiene ancho de texto).
      const isGap = el.classList.contains('tc-gap');
      const padX = Math.max(8, (r.width || fontPx * 0.6) * 0.5);
      const padTop    = isGap ? fontPx * 0.40 : Math.max(16, r.height * 0.9);
      const padBottom = isGap ? fontPx * 0.55 : 0;
      const baseH = isGap ? 0 : r.height;
      return {
        pos: +el.dataset.pos, el,
        x: (r.left - pr.left - padX) * dpr,
        y: (r.top  - pr.top  - padTop) * dpr,
        w: (r.width  + padX * 2) * dpr,
        h: (baseH + padTop + padBottom) * dpr,
        hit: prevHit.get(+el.dataset.pos) || false,
      };
    });
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width),
             y: (e.clientY - r.top)  * (canvas.height / r.height) };
  }
  // Zona que contiene el punto; si varias se solapan (vocales contiguas í/ó),
  // gana aquella cuyo CENTRO está más cerca → marca la vocal correcta.
  function zoneAt(p) {
    let best = null, bestD = Infinity;
    for (const z of zones) {
      if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) {
        const dx = p.x - (z.x + z.w / 2), dy = p.y - (z.y + z.h / 2);
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = z; }
      }
    }
    return best;
  }

  function recalcHits() {
    zones.forEach(z => { z.hit = false; });
    for (const s of strokes) { const z = zoneAt(s.pts[0]); if (z) z.hit = true; }
    zones.forEach(z => z.el.classList.toggle('tc-marked', z.hit));
    onChange?.(getMarked());
  }

  function eraseAt(p) {
    const rad = 26 * dpr, r2 = rad * rad;
    const before = strokes.length;
    strokes = strokes.filter(s => !s.pts.some(pt => (pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 <= r2));
    if (strokes.length !== before) recalcHits();
    redraw(p, rad);
  }

  function redraw(eraserPt, eraserR) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 3.2 * dpr;
    for (const s of strokes) {
      if (!s.pts.length) continue;
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
      if (s.pts.length === 1) ctx.lineTo(s.pts[0].x + 0.1, s.pts[0].y);
      ctx.stroke();
    }
    if (eraserPt) {              // indicador del borrador
      ctx.beginPath(); ctx.arc(eraserPt.x, eraserPt.y, eraserR, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  const getMarked = () => zones.filter(z => z.hit).map(z => z.pos).sort((a, b) => a - b);

  // ── Pointer handlers (Fase 2: dibuja/borra según el tamaño del contacto) ──────
  const onDown = (e) => {
    if (frozen) return;
    // Las pizarras táctiles a veces PIERDEN el pointerup/pointercancel → quedan
    // pointerIds "fantasma" en `active`; al sumar ≥3 un trazo legítimo se confunde
    // con PALMA y se borra ("deja de detectar las tildes"). isPrimary=true ⇒ es el
    // ÚNICO puntero activo según el SO → reseteamos el conteo y salimos de borrado.
    if (e.isPrimary) { active.clear(); palmErase = false; }
    active.add(e.pointerId);
    e.preventDefault();
    const p = toCanvas(e);
    try { canvas.setPointerCapture(e.pointerId); } catch {}

    // El BOTÓN de borrador del alumno no se vota: lo ha pulsado él a propósito y
    // ninguna medida puede contradecirlo.
    if (eraserMode) { pointerAction.set(e.pointerId, 'erase'); eraseAt(p); drawing = false; return; }

    const voto = crearVeredicto({ thr: loadThresholds() });
    voto.muestra(e, active.size);
    // La PALMA sí se sabe ya: se decide por CONTEO de punteros, no por tamaño, y
    // el conteo es fiable desde el primer evento (el toque basura ensucia la
    // medida, no cuántos dedos hay).
    if (voto.listo() && voto.veredicto().tool === 'palm') {
      if (drawing) return;                  // un fantasma no secuestra un trazo en curso
      palmErase = true; cur = null;
      eraseAt(p); return;
    }
    if (palmErase) return;
    votos.set(e.pointerId, voto);
    // OPTIMISTA: se pinta ya. Si el veredicto acaba diciendo «borrar», este trazo
    // se retira en `resolver()` y se borra por donde pasó.
    drawing = true; cur = { pts: [p] }; strokes.push(cur);
    redraw();
  };

  /** Dicta el veredicto de un puntero y aplica lo que diga: si es BORRAR, retira
   *  el trazo provisional que se había ido pintando y borra por su recorrido. */
  function resolver(id) {
    const voto = votos.get(id);
    if (!voto) return pointerAction.get(id) || null;
    votos.delete(id);
    const { accion } = voto.veredicto();
    pointerAction.set(id, accion);
    if (accion !== 'erase') return accion;
    // Retirar la tinta provisional y borrar por donde pasó: el alumno quiso
    // borrar desde el principio, así que el gesto entero cuenta como borrado.
    const trazo = cur;
    if (trazo) {
      const i = strokes.indexOf(trazo);
      if (i >= 0) strokes.splice(i, 1);
      drawing = false; cur = null;
      for (const pt of trazo.pts) eraseAt(pt);
    }
    return 'erase';
  }
  const onMove = (e) => {
    if (frozen) return;
    if (palmErase) { e.preventDefault(); eraseAt(toCanvas(e)); return; }
    const p = toCanvas(e);
    // Mientras el veredicto no esté dictado, cada movimiento es una MUESTRA más:
    // son las que llegan ya limpias, pasado el toque basura.
    const voto = votos.get(e.pointerId);
    if (voto) {
      voto.muestra(e, active.size);
      if (voto.listo() && resolver(e.pointerId) === 'erase') { e.preventDefault(); eraseAt(p); return; }
    }
    if (pointerAction.get(e.pointerId) === 'erase') { e.preventDefault(); eraseAt(p); return; }
    if (!drawing || !cur) return;
    e.preventDefault();
    cur.pts.push(p); redraw();
  };
  const onUp = (e) => {
    active.delete(e.pointerId);
    // Un gesto que se levanta sin veredicto (más corto que la ventana: marcar una
    // tilde ES un toque) se cierra con lo que haya. `crearVeredicto` nunca borra
    // sin muestras limpias, así que un toque corto siempre DIBUJA.
    const action = votos.has(e.pointerId) ? resolver(e.pointerId) : pointerAction.get(e.pointerId);
    pointerAction.delete(e.pointerId);
    if (palmErase) { if (active.size < 3) { palmErase = false; redraw(); } return; }
    if (action === 'erase') { redraw(); return; }     // limpiar el indicador del borrador
    if (!drawing) return;
    drawing = false; cur = null;
    recalcHits(); redraw();
  };
  // up/cancel en el canvas (con setPointerCapture los eventos llegan aquí aunque
  // el puntero salga) → sin fugas de listeners en window al re-renderizar frases.
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);

  const stopRo = observeResize(passageEl, resize);   // rAF-debounced (evita "RO loop…")
  requestAnimationFrame(resize);

  return {
    getMarked,
    setEraser(on) { eraserMode = !!on; canvas.style.cursor = on ? 'cell' : 'crosshair'; },
    clear() { strokes = []; recalcHits(); redraw(); },
    freeze() { frozen = true; canvas.style.pointerEvents = 'none'; },
    destroy() {
      stopRo();
      canvas.remove();        // al quitar el canvas se van sus listeners
    },
  };
}
