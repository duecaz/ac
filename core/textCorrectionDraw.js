// Capa de dibujo para Tildes/Comas: el alumno DIBUJA la marca (tilde / coma) con
// lápiz o táctil sobre el texto, en vez de tocar. El INICIO del trazo dentro de
// la zona de una vocal/hueco marca esa posición → mismo `value` (number[]) que el
// modo "tocar", así el scoring/solo/host no cambian.
//
// FASE 2 — detección por TAMAÑO de contacto (core/penDetector.js): cada puntero
// se clasifica al bajar → lápiz punta/dedo DIBUJAN; lápiz parte trasera BORRA;
// palma (≥3 contactos) BORRA. Los umbrales se calibran con "Calibrar pizarra" y
// se guardan en sessionStorage; SIN calibrar todo dibuja salvo la palma (=Fase 1).
//
// Adaptado del enfoque de duecaz/play (zonas + trazos en canvas).

import { pointerMetric, classifyTool, toolAction, loadThresholds } from './penDetector.js';

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
  const pointerAction = new Map(); // pointerId → 'draw' | 'erase' (clasificado al bajar)
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
    zones = tg.map(el => {
      const r = el.getBoundingClientRect();
      // padTop generoso: la tilde se dibuja ARRIBA de la vocal (los spans inline
      // tienen un rect ~1em, así que ampliamos la zona hacia arriba).
      const padX = Math.max(8, r.width * 0.5), padTop = Math.max(16, r.height * 0.9);
      return {
        pos: +el.dataset.pos, el,
        x: (r.left - pr.left - padX) * dpr,
        y: (r.top  - pr.top  - padTop) * dpr,
        w: (r.width  + padX * 2) * dpr,
        h: (r.height + padTop) * dpr,
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
    active.add(e.pointerId);
    const tool = classifyTool(pointerMetric(e), active.size, loadThresholds());
    if (tool === 'palm') {                  // palma → borrar
      palmErase = true; drawing = false; cur = null;
      e.preventDefault(); eraseAt(toCanvas(e)); return;
    }
    if (palmErase) return;
    e.preventDefault();
    const action = eraserMode ? 'erase' : toolAction(tool);
    pointerAction.set(e.pointerId, action);
    const p = toCanvas(e);
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (action === 'erase') { eraseAt(p); drawing = false; return; }   // lápiz trasero / borrador
    drawing = true; cur = { pts: [p] }; strokes.push(cur);
    redraw();
  };
  const onMove = (e) => {
    if (frozen) return;
    if (palmErase) { e.preventDefault(); eraseAt(toCanvas(e)); return; }
    const p = toCanvas(e);
    if (pointerAction.get(e.pointerId) === 'erase') { e.preventDefault(); eraseAt(p); return; }
    if (!drawing || !cur) return;
    e.preventDefault();
    cur.pts.push(p); redraw();
  };
  const onUp = (e) => {
    active.delete(e.pointerId);
    const action = pointerAction.get(e.pointerId);
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

  const ro = new ResizeObserver(() => resize());
  ro.observe(passageEl);
  requestAnimationFrame(resize);

  return {
    getMarked,
    setEraser(on) { eraserMode = !!on; canvas.style.cursor = on ? 'cell' : 'crosshair'; },
    clear() { strokes = []; recalcHits(); redraw(); },
    freeze() { frozen = true; canvas.style.pointerEvents = 'none'; },
    destroy() {
      ro.disconnect();
      canvas.remove();        // al quitar el canvas se van sus listeners
    },
  };
}
