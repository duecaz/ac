// EL VESTIDO DE ESTA PARTIDA: tema y fondo del marco de juego.
//
// Sale de views/playerView.js (Fase 6 del plan de simplificar): allí eran tres
// variables vivas, dos bloques de marcado y tres handlers mezclados con el
// montaje de modos y con la cabecera de la página. Aquí es UNA cosa — qué
// aspecto tiene el marco mientras se juega — con su estado, su marcado y sus
// handlers juntos.
//
// Lo elegido aquí NO se guarda en la actividad: es de ESTA partida (por eso
// `views/player/apariencia.js` está en la excepción declarada de la regla
// `imagen-buscable`, core/normsCheck.js — el fondo propio no es contenido).
import { escapeHtml, $$ } from '../../core/html.js';
import { on } from '../../core/events.js';
import { listSkins, applySkin, skinPreviewHtml } from '../../core/skins.js';
import { listBackgrounds, applyBackground, backgroundPreviewHtml, readBackgroundImage, BACKGROUNDS } from '../../core/backgrounds.js';
import { toast, TOAST_NORMAL } from '../../core/toast.js';
import { mensajeDe } from '../../core/frontera.js';

/** @typedef {import('../../kernel/contracts/activity.js').Activity} Activity */

/**
 * @typedef {Object} Apariencia
 * @property {string} skin
 * @property {string} background
 * @property {string} backgroundImage
 * @property {() => string} html            marcado del acordeón «Apariencia»
 * @property {() => void} aplicar           viste el marco con lo elegido
 * @property {(rootSel: string|Element) => void} wire
 */

/**
 * @param {Object} opts
 * @param {Activity['presentation']} [opts.presentation] lo guardado, como punto de partida
 * @param {() => HTMLElement|null} opts.marco  el marco al que se le pone el vestido
 * @param {() => void} [opts.onSkinChange] aviso de que el TEMA cambió (VS/Equipos re-montan)
 * @returns {Apariencia}
 */
export function crearApariencia({ presentation, marco, onSkinChange }) {
  let skin = presentation?.skin || 'default';
  let background = presentation?.background || 'none';
  let backgroundImage = presentation?.backgroundImage || '';

  // «MI IMAGEN» ES UNA TARJETA COMO LAS DEMÁS. Llevaba dentro un botón «Subir» de
  // ancho completo, y eso la dejaba 42 px MÁS ALTA que sus vecinas (medido a cinco
  // anchos): rompía la fila de la rejilla. El parche había sido encoger la letra
  // del botón —hasta 9,92 px reales, ilegible— con un comentario en player.css que
  // ya confesaba el problema. No cabe porque no tiene que estar: la tarjeta YA es
  // pulsable.
  //   · sin imagen  → la tarjeta ENTERA abre el selector;
  //   · con imagen  → la tarjeta selecciona ese fondo (como las otras) y para
  //     cambiarla hay un lápiz en su esquina.
  // Mira `backgroundImage` (lo VIVO), nunca `a.presentation` (lo guardado): con lo
  // guardado, la baldosa recién subida se quedaba en la variante «sin imagen».
  // La pintan DOS sitios con esta misma función —el render de abajo y el handler
  // de `#bg-custom-file`—; estaban escritos por separado y divergieron, que es de
  // donde salía el bug.
  const baldosaMia = () => backgroundImage
    ? `<div class="ww-pick-tile bg-pick bg-pick--mia ${background==='custom'?'is-active':''}" data-name="custom" role="button" title="${escapeHtml(BACKGROUNDS.custom?.description||'')}">
         ${backgroundPreviewHtml('custom', backgroundImage)}
         <label class="bg-pick__cambiar" title="Cambiar mi imagen (máx 800 KB)" aria-label="Cambiar mi imagen">
           <i class="bi bi-pencil-fill"></i>
           <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="bg-custom-file" hidden>
         </label>
       </div>`
    : `<label class="ww-pick-tile bg-pick bg-pick--mia" data-name="custom" title="${escapeHtml(BACKGROUNDS.custom?.description||'')} (máx 800 KB)">
         ${backgroundPreviewHtml('custom', '')}
         <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="bg-custom-file" hidden>
       </label>`;

  return {
    get skin() { return skin; },
    get background() { return background; },
    get backgroundImage() { return backgroundImage; },

    html() {
      // ACORDEÓN (pedido): se puede plegar cuando el tema ya está elegido. Nace
      // ABIERTO — plegado por defecto escondería los temas a quien entra por
      // primera vez y no sabe que están ahí.
      return `
        <details class="pp-card pp-acc" open>
          <summary class="pp-acc-summary">
            <span class="pp-appearance-title">Apariencia</span>
            <i class="bi bi-chevron-down pp-acc-chev"></i>
          </summary>
          <div class="pp-appearance-sections">
            <div>
              <h6 class="text-muted text-uppercase small mb-2">Tema</h6>
              <div class="pp-pick-grid">
                ${listSkins().map(s => `
                  <div class="ww-pick-tile skin-pick ${skin===s.name?'is-active':''}" data-name="${s.name}" role="button" title="${escapeHtml(s.description||'')}">
                    ${skinPreviewHtml(s.name)}
                  </div>
                `).join('')}
              </div>
            </div>
            <div>
              <h6 class="text-muted text-uppercase small mb-2">Fondo</h6>
              <div class="pp-pick-grid">
                ${listBackgrounds().map(b => b.name === 'custom'
                  ? baldosaMia()
                  : `<div class="ww-pick-tile bg-pick ${background===b.name?'is-active':''}" data-name="${b.name}" role="button" title="${escapeHtml(b.description||'')}">
                       ${backgroundPreviewHtml(b.name)}
                     </div>`).join('')}
              </div>
            </div>
          </div>
        </details>`;
    },

    // Scope skin + bg to the freshly-rendered frame so the page chrome
    // around the embed doesn't change when the user picks a theme.
    aplicar() {
      const frame = marco();
      applySkin(skin, frame);
      applyBackground(background, frame, backgroundImage);
    },

    wire(rootSel) {
      on(rootSel, 'click', '.skin-pick', (_, b) => {
        skin = b.dataset.name || 'default';
        applySkin(skin, marco());
        $$('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === skin));
        // VS/Equipos SÍ necesitan re-montar: su layout depende de la clase
        // vs-skin-<layout> del skin. Pero en Individual re-montar reinicia el juego
        // a la pantalla de inicio (el alumno tocaba un tema por curiosidad y perdía
        // el crucigrama/emparejar a medias). En solo basta el applySkin de arriba.
        onSkinChange?.();
      });
      on(rootSel, 'click', '.bg-pick', (_, b) => {
        // Custom selects only when an image exists; otherwise its upload button
        // (the label inside) opens the file dialog and selects on success.
        if (b.dataset.name === 'custom' && !backgroundImage) return;
        background = b.dataset.name || 'none';
        applyBackground(background, marco(), backgroundImage);
        $$('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === background));
      });
      on(rootSel, 'change', '#bg-custom-file', async (e) => {
        const input = /** @type {HTMLInputElement|null} */ (e.target);
        try {
          backgroundImage = await readBackgroundImage(input?.files?.[0]);
          background = 'custom';
          applyBackground(background, marco(), backgroundImage);
          // Se REPINTA la baldosa entera, no solo su preview: ahora hay imagen, así
          // que le toca la variante con lápiz. Los handlers están delegados en la
          // raíz, así que sobreviven al reemplazo.
          const tile = document.querySelector('.bg-pick[data-name="custom"]');
          if (tile) tile.outerHTML = baldosaMia();
          $$('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === 'custom'));
        } catch (err) {
          toast(mensajeDe(err), 'warning', TOAST_NORMAL);
          if (input) input.value = '';
        }
      });
    },
  };
}
