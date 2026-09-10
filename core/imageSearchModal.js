// BUSCAR IMÁGENES — el diálogo (F6 del plan del editor, 2026-08-13).
//
// La parte que sabe de RED y de DOM. El qué se pide y cómo se normaliza vive en
// core/imageSearch.js (puro, testeado con respuestas de mentira); aquí solo se
// pinta la rejilla, se descarga lo elegido y se devuelve ya convertido en
// data-URL por core/upload.js — el MISMO camino que un archivo local, así que
// el tope de §25 se respeta solo y nadie tiene que acordarse de aplicarlo.
//
// R6 · SIN INTERNET SE DICE, NO SE CALLA. Buscar es una función ONLINE: el aula
// sin red sigue subiendo archivos y el buscador lo AVISA en el propio diálogo.
// Un fallo del proveedor se pinta con su motivo; nunca se disfraza de «no hay
// resultados» (esa mentira manda al profe a inventarse otra búsqueda).
//
// LA ATRIBUCIÓN VIAJA CON EL PÍXEL. Quien llama recibe `{ url, atribucion }` y
// la guarda junto a la imagen: con Creative Commons el crédito es la condición
// de uso, y los profes PUBLICAN sus actividades.
import { FUENTES, FUENTE_POR_DEFECTO, fuentesDisponibles, buscarImagenes, atribucionDe, creditoTexto } from './imageSearch.js';
import { uploadMedia } from './upload.js';
import { escapeHtml } from './html.js';
import { QUOTAS } from './quotas.js';
import { rid } from './ids.js';
import { abrirDialogoConFallback } from './modalFallback.js';

/** @typedef {import('../kernel/contracts/activity.js').ImageCredit} ImageCredit */
/** @typedef {import('./imageSearch.js').Imagen} Imagen */

// El nombre del archivo no se usa para nada salvo darle un tipo a uploadMedia.
/**
 * @param {string} url
 * @param {string} [tipo]
 */
function nombreDe(url, tipo) {
  const ext = (tipo || '').split('/')[1] || 'jpg';
  return `busqueda.${ext.replace('+xml', '')}`;
}

/**
 * Descarga la imagen elegida y la devuelve como data-URL comprimida.
 * Se hace aquí (y no en el núcleo) porque depende de fetch/File/canvas.
 * @param {string} url
 * @param {{maxBytes?: number, ladoMax?: number}} opts
 * @returns {Promise<string>}
 */
async function traerComoDataUrl(url, { maxBytes, ladoMax }) {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error(`No se pudo descargar la imagen (error ${r.status}).`);
  const blob = await r.blob();
  const file = new File([blob], nombreDe(url, blob.type), { type: blob.type });
  return uploadMedia(file, { maxBytes, ladoMax });
}

/**
 * Abre el buscador. Resuelve con `{ url, atribucion }` cuando el profe elige una
 * imagen, o con `null` si cierra el diálogo sin elegir.
 *
 * @param {{maxBytes?:number, ladoMax?:number, consulta?:string, disparador?:HTMLElement|null}} opts
 *   `disparador`: a quién devolver el foco al cerrar, para el caller que
 *   deshabilita su botón antes de llamar (ver core/modalFallback.js).
 * @returns {Promise<{url:string, atribucion:ImageCredit|null}|null>}
 */
export function abrirBuscadorImagenes(opts = {}) {
  const { maxBytes = QUOTAS.imageBytes, ladoMax = QUOTAS.canvasImageSide, consulta = '', disparador } = opts;
  const id = rid('ww-imgsearch-');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" id="${id}" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-search"></i> Buscar una imagen</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex gap-2 flex-wrap mb-2">
              <input id="${id}-q" class="form-control" style="min-width:200px;flex:1"
                     placeholder="Qué buscas (p. ej. «corazón humano»)" value="${escapeHtml(consulta)}">
              <select id="${id}-src" class="form-select" style="max-width:220px">
                ${fuentesDisponibles().map(([k, f]) =>
                  `<option value="${k}" ${k === FUENTE_POR_DEFECTO ? 'selected' : ''}>${escapeHtml(f.etiqueta)}</option>`).join('')}
              </select>
              <button id="${id}-go" class="btn btn-primary"><i class="bi bi-search"></i> Buscar</button>
            </div>
            <p id="${id}-nota" class="text-muted small mb-2">${escapeHtml(FUENTES[FUENTE_POR_DEFECTO]?.nota || '')}</p>
            <div id="${id}-aviso"></div>
            <div id="${id}-res" class="d-flex flex-wrap gap-2"></div>
          </div>
          <div class="modal-footer">
            <small class="text-muted me-auto">
              <i class="bi bi-info-circle"></i> Se guarda el crédito (autor y licencia) junto a la imagen.
            </small>
            <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
          </div>
        </div>
      </div>
    </div>`;

  const el = /** @type {HTMLElement} */ (wrap.firstElementChild);
  document.body.appendChild(el);
  const m = abrirDialogoConFallback(el, { disparador });
  // El diálogo lo acaba de escribir esta misma función: si un nodo suyo no
  // está, es un fallo de programación y se dice, no se disimula.
  /** @param {string} suf @returns {HTMLElement} */
  const $ = (suf) => {
    const n = el.querySelector('#' + id + suf);
    if (!n) throw new Error(`Buscador de imágenes: falta #${id}${suf}`);
    return /** @type {HTMLElement} */ (n);
  };
  /** @param {string} suf @returns {HTMLInputElement} */
  const $in = (suf) => /** @type {HTMLInputElement} */ ($(suf));
  /** @param {string} suf @returns {HTMLSelectElement} */
  const $sel = (suf) => /** @type {HTMLSelectElement} */ ($(suf));
  /** @param {string} suf @returns {HTMLButtonElement} */
  const $btn = (suf) => /** @type {HTMLButtonElement} */ ($(suf));

  /** @type {Imagen[]} */
  let resultados = [];
  /** @type {{url: string, atribucion: ImageCredit|null}|null} */
  let elegido = null;

  /** @param {string} html @param {string} [tipo] */
  const aviso = (html, tipo = 'warning') => {
    $('-aviso').innerHTML = html
      ? `<div class="alert alert-${tipo} py-2 small">${html}</div>` : '';
  };

  // R6 · la puerta cerrada se dice ANTES de tocarla.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    aviso('<i class="bi bi-wifi-off"></i> <b>Sin conexión.</b> Buscar necesita internet; puedes subir una imagen desde el dispositivo.');
  }

  function pintar() {
    if (!resultados.length) { $('-res').innerHTML = ''; return; }
    $('-res').innerHTML = resultados.map((r, i) => `
      <button type="button" class="btn p-1 border rounded ww-is-pick" data-i="${i}"
              style="width:130px" title="${escapeHtml(r.titulo)}">
        <img src="${escapeHtml(r.miniatura)}" alt="" loading="lazy"
             style="width:100%;height:90px;object-fit:contain;background:#f8f9fa;border-radius:4px">
        <small class="d-block text-truncate mt-1">${escapeHtml(r.titulo)}</small>
        <small class="d-block text-muted text-truncate" style="font-size:.7rem">${escapeHtml(creditoTexto(atribucionDe(r)))}</small>
      </button>`).join('');
  }

  async function buscar() {
    const q = $in('-q').value.trim();
    if (!q) { aviso('Escribe qué quieres buscar.', 'secondary'); return; }
    aviso('');
    $btn('-go').disabled = true;
    $('-res').innerHTML = '<div class="text-muted small p-2"><i class="bi bi-hourglass-split"></i> Buscando…</div>';
    try {
      resultados = await buscarImagenes(q, { fuente: $sel('-src').value });
      pintar();
      if (!resultados.length) aviso(`No se encontró nada para «${escapeHtml(q)}». Prueba con otras palabras o cambia de fuente.`, 'secondary');
    } catch (e) {
      // El motivo REAL, no un «no hay resultados» que mandaría a buscar otra cosa.
      resultados = []; $('-res').innerHTML = '';
      aviso(`<i class="bi bi-exclamation-triangle"></i> ${escapeHtml(e instanceof Error ? e.message : String(e))} Comprueba tu conexión o sube la imagen desde el dispositivo.`, 'danger');
    } finally {
      $btn('-go').disabled = false;
    }
  }

  $('-go').addEventListener('click', buscar);
  $('-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
  $('-src').addEventListener('change', () => {
    $('-nota').textContent = FUENTES[$sel('-src').value]?.nota || '';
    if (resultados.length) buscar();
  });

  $('-res').addEventListener('click', async (e) => {
    const t = /** @type {HTMLElement|null} */ (e.target);
    const btn = /** @type {HTMLElement|null} */ (t?.closest?.('.ww-is-pick') ?? null);
    if (!btn) return;
    const img = resultados[Number(btn.dataset.i)];
    if (!img) return;
    el.querySelectorAll('.ww-is-pick').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
    aviso('<i class="bi bi-download"></i> Descargando la imagen…', 'secondary');
    try {
      const url = await traerComoDataUrl(img.imagen, { maxBytes, ladoMax });
      elegido = { url, atribucion: atribucionDe(img) };
      m.hide();
    } catch (err) {
      el.querySelectorAll('.ww-is-pick').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
      aviso(`<i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err instanceof Error ? err.message : String(err))}`, 'danger');
    }
  });

  return new Promise((resolve) => {
    el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(elegido); });
    m.show();
    setTimeout(() => $in('-q').focus(), 250);
    if (consulta.trim()) buscar();
  });
}
