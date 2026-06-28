// Read-only mini board for the teacher's live dashboard. No deps.
function ballStyle(color) {
  if (color === 'white') return 'background:#fff;border:1px solid #000';
  return `background:${color}`;
}

export function renderMini(container, board) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini-tubes';
  const cap = board.tubeCapacity || 7;
  (board.tubes || []).forEach(tube => {
    const tubeEl = document.createElement('div');
    tubeEl.className = 'mini-tube';
    for (let i = 0; i < cap; i++) {
      const slot = document.createElement('div');
      slot.className = 'mini-ball';
      const ball = tube[i];
      if (ball) {
        slot.setAttribute('style', ballStyle(ball));
      } else {
        slot.classList.add('mini-ball--empty');
      }
      tubeEl.appendChild(slot);
    }
    wrap.appendChild(tubeEl);
  });
  container.appendChild(wrap);
}
