// Panel "Calibrar pizarra" — el profesor toca cada recuadro con la herramienta
// indicada (lápiz punta, dedo, lápiz parte trasera, palma) y se mide el tamaño
// de su contacto. Se IGNORAN los primeros ms del toque (error del primer punto,
// que suele venir con un tamaño espurio). Al guardar, se derivan los umbrales
// (core/penDetector.js) y se persisten en sessionStorage.

import { pointerMetric, saveThresholds, deriveThresholds, mediana, VENTANA } from './penDetector.js';

// LA MISMA VENTANA Y LA MISMA MEDIANA QUE EL DIBUJO (`core/penDetector.js`).
// Estaban por separado —80 ms aquí, 60 allí, y una `median()` privada— y esa es
// la grieta exacta que hacía inútil calibrar: si la calibración resume el toque
// con un estadístico y una ventana, y el dibujo lo resume con otros, los
// umbrales medidos no describen lo que el dibujo va a medir.
const IGNORE_MS = VENTANA.ignoraMs;

const TOOLS = [
  { key: 'penTip',  label: 'Lápiz (punta)',         hint: 'Dibuja', icon: 'bi-pencil-fill' },
  { key: 'dedo',    label: 'Dedo',                  hint: 'Dibuja', icon: 'bi-hand-index-fill' },
  { key: 'trasera', label: 'Lápiz (parte trasera)', hint: 'Borra',  icon: 'bi-eraser-fill' },
  { key: 'palma',   label: 'Palma',                 hint: 'Borra',  icon: 'bi-hand-thumbs-up-fill' },
];

export function openPenCalibration() {
  const measured = { penTip: null, dedo: null, trasera: null, palma: null };

  const overlay = document.createElement('div');
  overlay.className = 'pcal-overlay';
  overlay.innerHTML = `
    <div class="pcal-panel" role="dialog" aria-label="Calibrar pizarra">
      <div class="pcal-head">
        <h5 class="m-0"><i class="bi bi-sliders"></i> Calibrar pizarra</h5>
        <button type="button" class="btn-close" data-close aria-label="Cerrar"></button>
      </div>
      <p class="pcal-sub">Toca cada recuadro con la herramienta indicada y mantén el contacto un instante.
        Se ignoran los primeros ${IGNORE_MS} ms (error del primer toque). El número es el tamaño del contacto.</p>
      <div class="pcal-grid">
        ${TOOLS.map(t => `
          <div class="pcal-field" data-tool="${t.key}">
            <div class="pcal-pad" data-pad tabindex="0">
              <span class="pcal-pad-label"><i class="bi ${t.icon}"></i> ${t.label}</span>
              <span class="pcal-pad-action">${t.hint}</span>
              <span class="pcal-val" data-val>—</span>
            </div>
          </div>`).join('')}
      </div>
      <div class="pcal-foot">
        <button type="button" class="btn btn-outline-secondary" data-close>Cancelar</button>
        <button type="button" class="btn btn-primary" data-save><i class="bi bi-check2"></i> Guardar y cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.pcal-field').forEach((field) => {
    const key = field.dataset.tool;
    const pad = field.querySelector('[data-pad]');
    const valEl = field.querySelector('[data-val]');
    let capturing = false, t0 = 0, samples = [];

    const sample = (e) => {
      if (!capturing) return;
      if (performance.now() - t0 < IGNORE_MS) return;   // descarta el primer toque
      samples.push(pointerMetric(e));
      valEl.textContent = mediana(samples).toFixed(1);
    };
    const start = (e) => {
      e.preventDefault();
      capturing = true; t0 = performance.now(); samples = [];
      pad.classList.add('is-capturing');
      try { pad.setPointerCapture(e.pointerId); } catch {}
      sample(e);
    };
    const end = () => {
      if (!capturing) return;
      capturing = false; pad.classList.remove('is-capturing');
      if (samples.length) {
        const m = mediana(samples);
        measured[key] = m;
        valEl.textContent = m.toFixed(1);
        field.classList.add('is-set');
      }
    };
    pad.addEventListener('pointerdown', start);
    pad.addEventListener('pointermove', sample);
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  });

  const close = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-save]').addEventListener('click', () => {
    saveThresholds(deriveThresholds(measured));
    close();
  });

  return { close };
}
