// v1.51.629: adminView se partió POR PANEL. Esta sección es «Palabras Live»:
// el diccionario de códigos de sala de 4 letras (core/liveWords.js, dueño
// único de la clave `ww.live_words`).
import { on } from '../../core/events.js';
import { confirmModal } from '../../core/toast.js';
import { DEFAULT_WORDS, getWordList, setWordList, resetWordList } from '../../core/liveWords.js';

export function createLiveWordsSection() {
  return {
    html: () => `
      <h5 class="mt-4">Palabras Live <small class="text-muted">(códigos de sala — 4 letras, se reciclan al cerrar la sesión)</small></h5>
      <p class="small text-muted mb-2">
        Los alumnos se unen con una <b>palabra de 4 letras</b> (ej. <code>GATO</code>) en vez de un PIN alfanumérico largo.
        Escribe las palabras separadas por comas o saltos de línea, en mayúsculas y sin tildes. Mínimo 4 palabras.
        Por defecto hay <b>${DEFAULT_WORDS.length}</b> palabras disponibles.
      </p>
      <div class="card border-0 bg-light p-3 mb-3" style="max-width:540px">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label small fw-bold mb-0">Lista activa <span id="lw-count" class="text-muted fw-normal"></span></label>
          <button id="lw-reset" class="btn btn-sm btn-outline-secondary">Restaurar por defecto</button>
        </div>
        <textarea id="lw-words" class="form-control font-monospace mb-2" rows="6"
          placeholder="${DEFAULT_WORDS.slice(0, 8).join(', ')}…"></textarea>
        <div class="d-flex gap-2">
          <button id="lw-save" class="btn btn-primary btn-sm"><i class="bi bi-floppy"></i> Guardar</button>
          <span id="lw-feedback" class="small align-self-center text-muted"></span>
        </div>
      </div>`,
    wire: (rootSel) => {
      // Live Words — populate textarea and wire buttons
      function paintLwEditor() {
        const list = getWordList();
        const ta = document.getElementById('lw-words');
        const cnt = document.getElementById('lw-count');
        if (ta) ta.value = list.join(', ');
        if (cnt) cnt.textContent = `(${list.length} palabras)`;
      }
      paintLwEditor();

      on(rootSel, 'click', '#lw-reset', async () => {
        const ok = await confirmModal(`¿Restaurar el diccionario por defecto (${DEFAULT_WORDS.length} palabras)?`, { okText: 'Restaurar' });
        if (!ok) return;
        resetWordList();
        paintLwEditor();
        const fb = document.getElementById('lw-feedback');
        if (fb) { fb.textContent = 'Restaurado.'; fb.className = 'small align-self-center text-success'; }
      });

      on(rootSel, 'click', '#lw-save', () => {
        const raw = document.getElementById('lw-words')?.value || '';
        const words = raw.split(/[\s,;]+/).map(w => w.trim().toUpperCase()).filter(w => /^[A-Z]{3,6}$/.test(w));
        const fb = document.getElementById('lw-feedback');
        if (words.length < 4) {
          if (fb) { fb.textContent = 'Mínimo 4 palabras válidas (3-6 letras A–Z).'; fb.className = 'small align-self-center text-danger'; }
          return;
        }
        setWordList(words);
        paintLwEditor();
        if (fb) { fb.textContent = `Guardadas ${words.length} palabras.`; fb.className = 'small align-self-center text-success'; }
      });
    },
  };
}
