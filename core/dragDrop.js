// Cross-input drag & drop using Pointer Events. Works the same on mouse,
// touch and pen — including interactive whiteboards. Lightweight: no canvas,
// no external libs. The "drag" is a floating clone of the source element
// that follows the pointer; on pointerup we hit-test against any element
// that has the chosen drop-target class.
//
// Usage:
//   makeDraggable(srcEl, { kind: 'tilde', dropTargetSel: '.tilde-zone',
//                          onDrop: (target, src, kind) => bool });
//
// Returns a teardown fn so callers (lifecycle ctx) can clean up.
//
// Note on touch: we set `touch-action: none` on the source so the browser
// doesn't try to scroll/zoom while the user is dragging.

export function makeDraggable(srcEl, opts) {
  const { kind, dropTargetSel, onDrop, onStart, onEnd, ghostFactory } = opts;
  if (!srcEl) return () => {};
  srcEl.style.touchAction = 'none';
  srcEl.style.cursor = 'grab';

  let ghost = null;
  let activePointerId = null;
  let lastTarget = null;

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // left/primary only
    activePointerId = e.pointerId;
    srcEl.setPointerCapture?.(e.pointerId);
    ghost = (ghostFactory ? ghostFactory(srcEl) : defaultGhost(srcEl));
    document.body.appendChild(ghost);
    moveGhost(e.clientX, e.clientY);
    onStart?.(srcEl);
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId !== activePointerId) return;
    moveGhost(e.clientX, e.clientY);
    // Highlight under the pointer.
    if (ghost) ghost.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest(dropTargetSel);
    if (target !== lastTarget) {
      lastTarget?.classList.remove('ww-drop-hover');
      target?.classList.add('ww-drop-hover');
      lastTarget = target || null;
    }
  }
  function onUp(e) {
    if (e.pointerId !== activePointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest(dropTargetSel);
    cleanup();
    if (target) {
      const ok = onDrop?.(target, srcEl, kind);
      if (ok === false) target.classList.add('ww-drop-fail');
      else target.classList.add('ww-drop-ok');
      setTimeout(() => target.classList.remove('ww-drop-ok', 'ww-drop-fail'), 600);
    }
    onEnd?.(srcEl, target || null);
  }
  function onCancel() { cleanup(); onEnd?.(srcEl, null); }
  function cleanup() {
    activePointerId = null;
    lastTarget?.classList.remove('ww-drop-hover');
    lastTarget = null;
    ghost?.remove();
    ghost = null;
  }
  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = (x - ghost._dx) + 'px';
    ghost.style.top  = (y - ghost._dy) + 'px';
  }

  srcEl.addEventListener('pointerdown', onDown);
  srcEl.addEventListener('pointermove', onMove);
  srcEl.addEventListener('pointerup', onUp);
  srcEl.addEventListener('pointercancel', onCancel);

  return () => {
    cleanup();
    srcEl.removeEventListener('pointerdown', onDown);
    srcEl.removeEventListener('pointermove', onMove);
    srcEl.removeEventListener('pointerup', onUp);
    srcEl.removeEventListener('pointercancel', onCancel);
  };
}

function defaultGhost(srcEl) {
  const rect = srcEl.getBoundingClientRect();
  const g = srcEl.cloneNode(true);
  g.style.position = 'fixed';
  g.style.left = rect.left + 'px';
  g.style.top = rect.top + 'px';
  g.style.width = rect.width + 'px';
  g.style.height = rect.height + 'px';
  g.style.pointerEvents = 'none';
  g.style.opacity = '0.85';
  g.style.transform = 'scale(1.15)';
  g.style.zIndex = '9999';
  g.style.boxShadow = '0 4px 16px rgba(0,0,0,.3)';
  g._dx = rect.width / 2;
  g._dy = rect.height / 2;
  return g;
}
