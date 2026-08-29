// Capa de dibujo para Tildes/Comas: el alumno DIBUJA la marca (tilde / coma) con
// lápiz o táctil sobre el texto, en vez de tocar. El INICIO del trazo dentro de
// la zona de una vocal/hueco marca esa posición → mismo `value` (number[]) que el
// modo "tocar", así el scoring/solo/host no cambian.
//
// FASE 2 — DOS HERRAMIENTAS (core/penDetector.js): el dedo y todo lo más pequeño
// —la punta del lápiz, el ratón— DIBUJAN; la palma BORRA. Una sola frontera, que
// se calibra con "Calibrar pizarra"; SIN calibrar solo borra la palma detectada
// por CONTEO de contactos, que es el defecto seguro.
//
// FASE 2b — EL VEREDICTO SE APLAZA (v1.51.609). Antes la herramienta se decidía
// en el `pointerdown` y se fijaba para todo el trazo. Ese primer evento es
// justo el que la calibración DESCARTA por basura —en muchas pizarras ni
// siquiera es una medida: `width`/`height` valen 1 por defecto—, así que el
// borrador casi no disparaba. La lógica vive entera en `crearVeredicto`, que es
// también quien fija el estadístico que usa la calibración.
//
// FASE 2c — NADA SE PINTA ANTES DE DECIDIR (v1.51.611). La primera versión era
// OPTIMISTA: pintaba desde el primer punto y, si el veredicto decía «borrar»,
// retiraba el trazo. El razonamiento escrito era «el retardo se ve, retirar tinta
// recién puesta no» — y era FALSO, lo dijo el dueño probándolo: la palma se mueve
// deprisa, así que esos ~100 ms de trazo provisional son un RASTRO DE TINTA largo
// que aparece y desaparece justo antes de borrar.
//
// El arreglo no es disimular el rastro: es invertir el compromiso. No se pinta
// hasta tener veredicto, y a cambio el veredicto llega mucho antes — el descarte
// pasó de «60 ms» a «el `pointerdown`, que es el evento que de verdad miente»
// (ver VENTANA en core/penDetector.js). Los puntos se GUARDAN mientras tanto y se
// sueltan de golpe: para quien escribe, la tinta aparece un par de fotogramas
// después de tocar; para quien borra, no hay nada que retirar porque nunca se
// pintó.
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

  // UNA PINTADA POR FOTOGRAMA, NO POR EVENTO DE ENTRADA.
  //
  // `redraw()` se llamaba en cada `pointermove`, y una pizarra táctil los emite a
  // 100-240 Hz: con el dedo moviéndose, el lienzo entero (borrar + re-trazar
  // TODOS los trazos) se repintaba hasta diez veces DENTRO del mismo fotograma,
  // y solo el último se llegaba a ver. Medido escribiendo en una pizarra 4K con
  // la CPU frenada 12x: 12 fps. El JS era barato (0,34 ms por evento) — lo caro
  // era pintar y subir a la GPU un lienzo grande una y otra vez.
  //
  // Es el mismo defecto que ya arreglaron `observeResize` (rAF-debounced) y la
  // barra de progreso: trabajo proporcional al RITMO DE ENTRADA en vez de al
  // ritmo de la pantalla. Se acumula la petición y se pinta una vez por
  // fotograma; el indicador del borrador guarda su última posición, que es la
  // única que importa.
  let rafPendiente = 0, borradorPt = null, borradorR = 0;
  function redraw(eraserPt, eraserR) {
    borradorPt = eraserPt || null; borradorR = eraserR || 0;
    if (rafPendiente) return;
    rafPendiente = requestAnimationFrame(() => {
      rafPendiente = 0;
      pintar(borradorPt, borradorR);
      borradorPt = null; borradorR = 0;
    });
  }

  /** EL TROZO NUEVO, Y SOLO ÉL. Mientras el alumno escribe no hace falta borrar
   *  y re-trazar la hoja entera: el lienzo YA tiene lo anterior pintado, así que
   *  basta añadir el segmento que acaba de aparecer. El coste deja de depender
   *  del tamaño del lienzo y de cuántas marcas lleve hechas.
   *
   *  Medido en una pizarra 4K con la CPU frenada 12x: el lienzo del pasaje ocupa
   *  3074×1759 = 5,4 MILLONES de píxeles, y repintarlo entero dejaba la
   *  escritura en 12 fps. Antes probé a agrupar los repintados en un fotograma
   *  (rAF) y NO sirvió de nada —80 ms seguían siendo 78—: el problema no era
   *  cuántas veces se repintaba, era repintarlo ENTERO aunque fuera una vez.
   *  Se apunta porque la hipótesis equivocada costó una medición. */
  function trazarUltimo(s) {
    const n = s.pts.length;
    if (n < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 3.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(s.pts[n - 2].x, s.pts[n - 2].y);
    ctx.lineTo(s.pts[n - 1].x, s.pts[n - 1].y);
    ctx.stroke();
  }

  // El repintado COMPLETO sigue existiendo para lo que de verdad lo necesita:
  // borrar, cambiar de tamaño, limpiar y cerrar un trazo. Son gestos sueltos, no
  // el chorro continuo del dedo moviéndose.
  function pintar(eraserPt, eraserR) {
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
    // La palma por CONTEO sí se sabe ya: el número de punteros es fiable desde el
    // primer evento (el toque basura ensucia la MEDIDA, no cuántos dedos hay). La
    // palma por TAMAÑO no: esa espera muestras limpias, como todo lo demás.
    if (active.size >= loadThresholds().palma.minPuntos) {
      if (drawing) return;                  // un fantasma no secuestra un trazo en curso
      palmErase = true; cur = null;
      eraseAt(p); return;
    }
    if (palmErase) return;
    votos.set(e.pointerId, voto);
    // NO SE PINTA TODAVÍA: el punto se guarda. Si esto acaba siendo un borrado,
    // nunca habrá habido tinta que retirar (v1.51.611).
    voto.pendientes.push(p);
  };

  /** Dicta el veredicto de un puntero y suelta de golpe los puntos guardados:
   *  como TINTA si escribe, como BORRADO si borra. */
  function resolver(id) {
    const voto = votos.get(id);
    if (!voto) return pointerAction.get(id) || null;
    votos.delete(id);
    const { accion } = voto.veredicto();
    pointerAction.set(id, accion);
    const puntos = voto.pendientes;
    if (accion === 'erase') {
      for (const pt of puntos) eraseAt(pt);
      drawing = false; cur = null;
      return 'erase';
    }
    // ESCRIBE: el trazo nace ya con todo lo recorrido, así que el alumno ve la
    // línea completa desde el primer trozo, no un salto desde donde se decidió.
    drawing = true; cur = { pts: puntos.slice() }; strokes.push(cur);
    redraw();
    return 'draw';
  }
  const onMove = (e) => {
    if (frozen) return;
    if (palmErase) { e.preventDefault(); eraseAt(toCanvas(e)); return; }
    const p = toCanvas(e);
    // Mientras el veredicto no esté dictado, cada movimiento es una MUESTRA más:
    // son las que llegan ya limpias, pasado el toque basura.
    const voto = votos.get(e.pointerId);
    if (voto) {
      e.preventDefault();
      voto.muestra(e, active.size);
      voto.pendientes.push(p);          // se guarda, no se pinta
      if (!voto.listo()) return;        // …hasta que haya veredicto
      return void resolver(e.pointerId);
    }
    if (pointerAction.get(e.pointerId) === 'erase') { e.preventDefault(); eraseAt(p); return; }
    if (!drawing || !cur) return;
    e.preventDefault();
    cur.pts.push(p); trazarUltimo(cur);
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
      // Un repintado en vuelo pintaría sobre un lienzo ya desmontado (§23: la
      // vista se lleva sus relojes al salir).
      if (rafPendiente) cancelAnimationFrame(rafPendiente);
      canvas.remove();        // al quitar el canvas se van sus listeners
    },
  };
}
