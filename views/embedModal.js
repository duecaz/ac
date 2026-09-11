// "Embed" modal. Generates the <iframe> snippet for an activity, lets the
// user pick size + skin/bg/template overrides, shows a live preview.
//
// ESTADO: BETA declarada (norte §7c, v1.51.412). Embeber está FUERA DE LA
// ESCENA por ahora — el código pinta, pero nadie lo ha probado dentro de un
// blog ni de un LMS (cookies de terceros, fullscreen denegado en iframe,
// PocketBase desde otro origen). Se reabre solo si Google Classroom lo pide.
// Por eso el diálogo avisa: la puerta entornada se dice ANTES.
import { rid } from '../core/ids.js';
import { escapeHtml, $ as qs } from '../core/html.js';
import { abrirDialogoConFallback } from '../core/modalFallback.js';
import { listSkins } from '../core/skins.js';
import { listBackgrounds } from '../core/backgrounds.js';
import { compatibleTemplates, getTemplate } from '../core/registry.js';
import { toast, TOAST_NORMAL } from '../core/toast.js';

const SIZES = [
  { label: 'Responsive 100%', w: '100%', h: '480' },
  { label: '500 × 380',  w: '500',  h: '380' },
  { label: '700 × 500',  w: '700',  h: '500' },
  { label: '1280 × 800', w: '1280', h: '800' }
];

/** @param {import('../kernel/contracts/activity.js').Activity} activity */
export function openEmbedModal(activity) {
  const id = rid('ww-embed-modal-');
  const skins = listSkins();
  const bgs = listBackgrounds();
  const compat = [getTemplate(activity.template), ...compatibleTemplates(activity.template)].flatMap(t => t ? [t] : []);

  const isPublic = activity.visibility === 'public' || activity.visibility === 'unlisted';

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" id="${id}" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-code-square"></i> Compartir como embed</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-secondary small">
              <i class="bi bi-cone-striped"></i> <b>Función beta.</b> Está sin validar fuera de aulareto.com:
              dentro de un blog o un LMS pueden fallar la pantalla completa y el guardado de resultados.
              Úsalo para probar, no para una clase que dependa de ello.
            </div>
            ${isPublic ? '' : `
              <div class="alert alert-warning small">
                <i class="bi bi-eye-slash"></i> Esta actividad es <b>privada</b>. Para que el embed funcione fuera, cambia la visibilidad a <b>Pública</b> o <b>No listada</b> en el editor.
              </div>`}

            <div class="row g-2 mb-3">
              <div class="col-md-4">
                <label class="form-label small">Tamaño</label>
                <select id="${id}-size" class="form-select form-select-sm">
                  ${SIZES.map((s, i) => `<option value="${i}">${escapeHtml(s.label)}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label small">Tema</label>
                <select id="${id}-skin" class="form-select form-select-sm">
                  <option value="">— por defecto de la actividad —</option>
                  ${skins.map(s => `<option value="${s.name}">${escapeHtml(s.label)}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label small">Fondo</label>
                <select id="${id}-bg" class="form-select form-select-sm">
                  <option value="">— por defecto —</option>
                  ${bgs.map(b => `<option value="${b.name}">${escapeHtml(b.label)}</option>`).join('')}
                </select>
              </div>
              ${compat.length > 1 ? `
                <div class="col-md-12">
                  <label class="form-label small">Plantilla</label>
                  <select id="${id}-tpl" class="form-select form-select-sm">
                    ${compat.map(t => `<option value="${t.meta.name}" ${t.meta.name===activity.template?'selected':''}>${escapeHtml(t.meta.label)}</option>`).join('')}
                  </select>
                </div>` : ''}
            </div>

            <label class="form-label small fw-bold">Código a pegar</label>
            <textarea id="${id}-snippet" class="form-control font-monospace small" rows="3" readonly></textarea>

            <div class="d-flex gap-2 mt-2">
              <button id="${id}-copy" class="btn btn-primary btn-sm"><i class="bi bi-clipboard"></i> Copiar</button>
              <a id="${id}-open" target="_blank" class="btn btn-outline-secondary btn-sm"><i class="bi bi-box-arrow-up-right"></i> Abrir en pestaña nueva</a>
            </div>

            <hr>
            <label class="form-label small fw-bold">Vista previa</label>
            <div class="ratio ratio-16x9" style="max-width: 700px">
              <iframe id="${id}-preview" src="" frameborder="0" style="border:1px solid #dee2e6;border-radius:8px"></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const el = /** @type {HTMLElement|null} */ (wrap.firstElementChild);
  if (!el) return;
  document.body.appendChild(el);
  // Bootstrap llega de una CDN: el respaldo de core/modalFallback.js abre el
  // diálogo igual cuando no ha llegado (dueño único del global).
  const m = abrirDialogoConFallback(el);
  el.addEventListener('hidden.bs.modal', () => el.remove());

  /** @param {string} id2 @returns {HTMLElement|null} */
  const $ = (id2) => qs('#' + id2, el);
  /** @param {string} id2 @returns {HTMLSelectElement|null} */
  const $sel = (id2) => /** @type {HTMLSelectElement|null} */ ($(id2));
  /** @returns {HTMLTextAreaElement|null} */
  const $snippet = () => /** @type {HTMLTextAreaElement|null} */ ($(id + '-snippet'));
  function buildUrl() {
    const sIdx = +($sel(id + '-size')?.value || 0);
    const skin = $sel(id + '-skin')?.value || '';
    const bg = $sel(id + '-bg')?.value || '';
    const tpl = $sel(id + '-tpl')?.value || '';
    const base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'embed.html';
    const q = new URLSearchParams({ id: activity.id });
    if (skin) q.set('skin', skin);
    if (bg) q.set('bg', bg);
    if (tpl && tpl !== activity.template) q.set('template', tpl);
    return { url: `${base}?${q}`, size: SIZES[sIdx] };
  }
  function refresh() {
    const { url, size } = buildUrl();
    const iframe = `<iframe src="${url}" width="${size.w}" height="${size.h}" frameborder="0" allowfullscreen style="max-width:100%;border:0"></iframe>`;
    const snippet = $snippet();
    const preview = /** @type {HTMLIFrameElement|null} */ ($(id + '-preview'));
    const open = /** @type {HTMLAnchorElement|null} */ ($(id + '-open'));
    if (snippet) snippet.value = iframe;
    if (preview) preview.src = url;
    if (open) open.href = url;
  }
  ['-size','-skin','-bg','-tpl'].forEach(suf => $(id + suf)?.addEventListener('change', refresh));
  $(id + '-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($snippet()?.value || '');
      toast('Snippet copiado.', 'success');
    } catch {
      toast('No se pudo copiar; selecciónalo manualmente.', 'warning', TOAST_NORMAL);
    }
  });

  refresh();
  m.show();
}
