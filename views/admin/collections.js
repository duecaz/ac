// LA PANTALLA de «PocketBase — configuración de colecciones»: pide el
// superadmin, llama a quien aplica el esquema y pinta el parte.
//
// Lo que se aplica (el esquema) es DATO en `core/pbSchema.js`; aplicarlo —
// autenticar, crear, reparar, verificar— es de `core/pbProvision.js`. Aquí solo
// queda la pantalla; antes el fichero era el esquema, el aplicador y la vista a
// la vez, y por eso el test que lo cruza con `tools/check-pb.sh` tenía que
// rasparlo con `indexOf`.
import { escapeHtml, $input } from '../../core/html.js';
import { on } from '../../core/events.js';
import { VERSION } from '../../core/constants.js';
import { mensajeDe } from '../../core/frontera.js';
import { aplicarEsquemaPb } from '../../core/pbProvision.js';

/** @returns {{html: () => string, wire: (rootSel: string) => void}} */
export function createCollectionsSection() {
  return {
    html: () => `
      <h5 class="mt-4">PocketBase — configuración de colecciones</h5>
      <p class="small text-muted mb-2">Crea/actualiza TODAS las colecciones (activities, live_sessions, <code>live_players</code>, live_answers, assignments, results…) y aplica sus reglas de acceso. Append-only: añade lo que falte sin borrar datos. Re-córrelo tras cada actualización que toque el esquema (p.ej. reglas endurecidas). Necesita tu superadmin de PocketBase.</p>
      <div class="d-flex gap-2 align-items-end flex-wrap mb-1">
        <div>
          <label class="form-label small mb-1">Email admin PocketBase</label>
          <input id="pb-email" type="email" class="form-control form-control-sm" placeholder="admin@ejemplo.com" style="width:220px">
        </div>
        <div>
          <label class="form-label small mb-1">Contraseña admin</label>
          <input id="pb-pass" type="password" class="form-control form-control-sm" style="width:180px">
        </div>
        <button id="pb-setup" class="btn btn-warning btn-sm"><i class="bi bi-database-add"></i> Crear colecciones</button>
      </div>
      <div id="pb-setup-out" class="mt-2"></div>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#pb-setup', async () => {
        const email = $input('#pb-email')?.value?.trim();
        const pass  = $input('#pb-pass')?.value;
        const out   = document.getElementById('pb-setup-out');
        if (!out) return;
        if (!email || !pass) { out.innerHTML = '<div class="alert alert-warning py-1 px-2 small">Introduce email y contraseña de admin de PocketBase.</div>'; return; }

        out.innerHTML = '<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Autenticando…</div>';
        const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById('pb-setup'));
        if (btn) btn.disabled = true;

        try {
          const { PB_URL } = await import('../../pocketbase.config.js');
          const resultados = await aplicarEsquemaPb({
            pbUrl: PB_URL, email, pass,
            onProgreso: (nombre) => {
              out.innerHTML = `<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Configurando <code>${escapeHtml(nombre)}</code>…</div>`;
            },
          });
          const allOk = resultados.every(r => r.ok);
          out.innerHTML = `
            <div class="alert ${allOk ? 'alert-success' : 'alert-warning'} py-2 px-3 small">
              <div class="text-muted">Aplicado con la app v${VERSION} — si acabas de actualizar, recarga con Ctrl+F5 ANTES de aplicar (una página cacheada aplica DEFS viejos).</div>
              ${resultados.map(r => `<div>${r.ok ? '✓' : '✗'} <code>${escapeHtml(r.name)}</code> — ${escapeHtml(r.msg)}</div>`).join('')}
              ${allOk ? '<div class="mt-1 fw-semibold">Listo. Recarga la página para activar Live, actividades en nube y tareas.</div>' : ''}
            </div>`;
        } catch (e) {
          out.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(mensajeDe(e))}</div>`;
        } finally {
          if (btn) btn.disabled = false;
          const campoPass = $input('#pb-pass');
          if (campoPass) campoPass.value = '';
        }
      });
    },
  };
}
