// Interactive tube/ball renderer with a FLIP move animation. No deps.
const COLOR_LETTERS = {
  red: 'R', blue: 'B', green: 'G', orange: 'O',
  pink: 'P', white: 'W', yellow: 'Y',
  purple: 'V', brown: 'M', cyan: 'C'
};

function ballStyle(color) {
  if (color === 'white') return 'background:#fff;border:2px solid #000';
  return `background:${color}`;
}

function topNonEmptyBall(tubeEl) {
  const balls = tubeEl.querySelectorAll('.ball:not(.ball--empty)');
  return balls.length ? balls[balls.length - 1] : null;
}

export function renderTubes(container, board, {
  interactive = false,
  selectedTube = null,
  lastMove = null,
  showLetters = false
} = {}) {
  // FLIP step 1: capture old position of source's top ball BEFORE we tear down
  let fromRect = null;
  if (lastMove) {
    const oldFromTube = container.querySelector(`.tube[data-index="${lastMove.from}"]`);
    if (oldFromTube) {
      const oldTop = topNonEmptyBall(oldFromTube);
      if (oldTop) fromRect = oldTop.getBoundingClientRect();
    }
  }

  container.innerHTML = '';
  container.dataset.count = String(board.tubes.length);

  board.tubes.forEach((tube, index) => {
    const tubeEl = document.createElement('div');
    tubeEl.className = 'tube';
    if (interactive) tubeEl.classList.add('tube--interactive');
    if (index === selectedTube) tubeEl.classList.add('tube--selected');
    tubeEl.dataset.index = String(index);

    for (let i = 0; i < board.tubeCapacity; i++) {
      const slot = document.createElement('div');
      slot.className = 'ball';
      const ball = tube[i];
      if (ball) {
        slot.setAttribute('style', ballStyle(ball));
        if (showLetters) {
          const lab = document.createElement('span');
          lab.className = 'ball__letter';
          lab.textContent = COLOR_LETTERS[ball] || ball.charAt(0).toUpperCase();
          slot.appendChild(lab);
        }
      } else {
        slot.classList.add('ball--empty');
      }
      tubeEl.appendChild(slot);
    }

    container.appendChild(tubeEl);
  });

  // FLIP step 2: animate the destination's new top from where the source was
  if (fromRect && lastMove) {
    const newToTube = container.querySelector(`.tube[data-index="${lastMove.to}"]`);
    if (newToTube) {
      const newTop = topNonEmptyBall(newToTube);
      if (newTop) {
        const toRect = newTop.getBoundingClientRect();
        const dx = fromRect.left - toRect.left;
        const dy = fromRect.top  - toRect.top;
        newTop.style.transition = 'none';
        newTop.style.transform  = `translate(${dx}px, ${dy}px)`;
        // Force reflow so the next transform animates
        void newTop.offsetWidth;
        newTop.style.transition = 'transform 180ms ease-out';
        newTop.style.transform  = '';
      }
    }
  }
}
