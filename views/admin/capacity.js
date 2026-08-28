// v1.51.629: adminView se partió POR PANEL. Esta sección es «Capacidad»
// (§25 — el servidor es una Pi COMPARTIDA con otros proyectos): cuánto ocupo
// de actividades y qué salas en vivo caducaron (con su borrado bajo confirmación).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { list } from '../../core/storage.js';
import { QUOTAS, checkActivityCount, checkActivitySize, liveRetentionCutoff } from '../../core/quotas.js';
import { purgeOldLive } from '../../core/liveTransport.js';
import { clock } from '../../core/clock.js';
import { confirmModal } from '../../core/toast.js';

export function createCapacitySection() {
  return {
    html: () => `
      <h5 class="mt-4">Capacidad <small class="text-muted">(§25 · el servidor es una Pi COMPARTIDA con otros proyectos)</small></h5>
      <div id="admin-quota" class="mb-2"></div>
      <div class="d-flex gap-2 align-items-end flex-wrap">
        <button id="admin-purge-scan" class="btn btn-outline-secondary btn-sm"><i class="bi bi-search"></i> Ver qué salas caducaron</button>
        <span class="small text-muted">Salas en vivo de más de ${QUOTAS.liveRetentionDays} días. No toca resultados ni intentos de tarea.</span>
      </div>
      <div id="admin-purge-out" class="mt-2"></div>`,
    wire: (rootSel) => {
      // ── §25 CAPACIDAD — cuánto ocupo y qué salas caducaron ────────────────────
      // El aviso de nº de actividades es AVISO, no veredicto: una regla de PB no
      // sabe contar filas (§22 — se dice lo que se puede aplicar). El tope de
      // TAMAÑO sí lo aplica el servidor (maxSize del campo `data`).
      (function paintQuota() {
        const box = document.getElementById('admin-quota');
        if (!box) return;
        const acts = list();
        const cnt = checkActivityCount(acts.length);
        const sized = acts.map(a => ({ a, s: checkActivitySize(a) })).sort((x, y) => y.s.bytes - x.s.bytes);
        const heavy = sized.filter(x => x.s.level !== 'ok').slice(0, 5);
        const total = sized.reduce((n, x) => n + x.s.bytes, 0);
        const mb = (n) => (n / (1024 * 1024)).toFixed(1).replace('.', ',');
        const cls = { ok: 'secondary', warn: 'warning', over: 'danger' };
        box.innerHTML = `
          <div class="d-flex gap-3 flex-wrap align-items-center">
            <span class="badge bg-${cls[cnt.level]}">${cnt.count} / ${cnt.limit} actividades</span>
            <span class="badge bg-secondary">${mb(total)} MB en total</span>
            <span class="small text-muted">Máximo por actividad: ${mb(QUOTAS.activityBytes)} MB · por imagen: ${Math.round(QUOTAS.imageBytes / 1024)} KB</span>
          </div>
          ${cnt.msg ? `<div class="alert alert-${cls[cnt.level]} py-2 mt-2 mb-0 small">${escapeHtml(cnt.msg)}</div>` : ''}
          ${heavy.length ? `<div class="mt-2 small">
            <b>Las más pesadas:</b>
            <ul class="mb-0">${heavy.map(x => `<li><span class="text-${cls[x.s.level]}">${mb(x.s.bytes)} MB</span> · ${escapeHtml(x.a.title || x.a.id)}</li>`).join('')}</ul>
          </div>` : ''}`;
      })();
      on(rootSel, 'click', '#admin-purge-scan', async () => {
        const box = document.getElementById('admin-purge-out');
        const btn = document.getElementById('admin-purge-scan');
        btn.disabled = true;
        box.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Contando…';
        const cutoff = liveRetentionCutoff(clock.now());
        let r;
        try { r = await purgeOldLive(cutoff, { dryRun: true }); }
        catch (e) { box.innerHTML = `<div class="alert alert-danger py-2 mb-0">No se pudo consultar: ${escapeHtml(e.message)}</div>`; btn.disabled = false; return; }
        btn.disabled = false;
        if (!r.sessions) {
          box.innerHTML = `<div class="alert alert-success py-2 mb-0">Nada que limpiar: no hay salas anteriores al ${escapeHtml(cutoff.slice(0, 10))}.</div>`;
          return;
        }
        box.innerHTML = `
          <div class="alert alert-warning py-2">
            Caducaron <b>${r.sessions}</b> salas (anteriores al ${escapeHtml(cutoff.slice(0, 10))}), con
            <b>${r.answers}</b> respuestas, <b>${r.players}</b> jugadores y <b>${r.claims}</b> credenciales.
            <div class="small mt-1">Los resultados de tus alumnos (<code>results</code>) y los intentos de tarea NO se tocan.</div>
          </div>
          <button id="admin-purge-go" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i> Borrar esas ${r.sessions} salas</button>`;
        on(rootSel, 'click', '#admin-purge-go', async () => {
          const ok = await confirmModal(`¿Borrar ${r.sessions} salas caducadas y todo lo que cuelga de ellas?`, { okText: 'Borrar', danger: true });
          if (!ok) return;
          const go = document.getElementById('admin-purge-go');
          if (go) { go.disabled = true; go.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Borrando…'; }
          const done = await purgeOldLive(cutoff, { dryRun: false }).catch(e => ({ errors: [e.message] }));
          box.innerHTML = done.errors?.length
            ? `<div class="alert alert-warning py-2 mb-0">Se borró lo que se pudo (${done.sessions || 0} salas). Errores: ${escapeHtml(done.errors.slice(0, 3).join(' · '))}</div>`
            : `<div class="alert alert-success py-2 mb-0">Limpiado: ${done.sessions} salas, ${done.answers} respuestas, ${done.players} jugadores, ${done.claims} credenciales.</div>`;
        });
      });
    },
  };
}
