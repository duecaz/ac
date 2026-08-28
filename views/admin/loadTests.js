// v1.51.629: adminView se partió POR PANEL. Esta sección agrupa las DOS
// pruebas contra el servidor REAL con alumnos simulados: «Prueba de carga»
// (N a la vez, live+tareas) y «Carrera e2e» (2 alumnos corren una carrera
// completa) — comparten el mismo tono (datos desechables `stress_*` que se
// borran solos) aunque no comparten estado.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { confirmModal } from '../../core/toast.js';
import { runStressTest } from '../../core/stressTest.js';
import { PB_URL } from '../../pocketbase.config.js';

export function createLoadTestsSection() {
  return {
    html: () => `
      <h5 class="mt-4">Prueba de carga <small class="text-muted">(N alumnos entrando y respondiendo A LA VEZ · live + tareas, contra el servidor real)</small></h5>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button id="admin-stress" class="btn btn-primary"><i class="bi bi-lightning-charge"></i> Simular carga</button>
        <select id="admin-stress-n" class="form-select form-select-sm" style="width:auto">
          <option value="10">10 alumnos</option>
          <option value="20" selected>20 alumnos</option>
          <option value="30">30 alumnos</option>
          <option value="50">50 alumnos</option>
          <option value="100">100 alumnos</option>
        </select>
        <small class="text-muted">Crea datos desechables (prefijo <code>stress_</code>) y los borra al terminar.</small>
      </div>
      <div id="admin-stress-out" class="mt-2"></div>

      <h5 class="mt-4">Carrera e2e <small class="text-muted">(2 alumnos simulados corren una carrera entera: puntos planos · gana el más rápido según el servidor · la trampa rebota)</small></h5>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button id="admin-race" class="btn btn-primary"><i class="bi bi-flag-fill"></i> Probar carrera</button>
        <small class="text-muted">Sala desechable (prefijo <code>stress_</code>), se borra al terminar. Tarda ~15 s (incluye 6 s de carrera real).</small>
      </div>
      <div id="admin-race-out" class="mt-2"></div>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-race', async () => {
        const box = document.getElementById('admin-race-out');
        const btn = document.getElementById('admin-race');
        const ok = await confirmModal('Se va a jugar una carrera completa con 2 alumnos simulados contra el servidor (crea y borra una sala de prueba, ~15 s). ¿Continuar?', { okText: 'Probar carrera' });
        if (!ok) return;
        btn.disabled = true;
        const log = [];
        const paint = () => {
          box.innerHTML = `<div class="d-flex align-items-center gap-2 mb-1 text-muted"><span class="spinner-border spinner-border-sm"></span><small>${escapeHtml(log[log.length - 1] || 'Preparando…')}</small></div>`;
        };
        paint();
        try {
          const { runRaceE2e } = await import('../../core/raceE2e.js');
          const r = await runRaceE2e({ pbUrl: PB_URL, onLog: (m) => { log.push(m); paint(); } });
          const notes = r.notes.length ? `<div class="alert alert-warning py-1 px-2 small mb-2">${r.notes.map(escapeHtml).join('<br>')}</div>` : '';
          box.innerHTML = `
            ${notes}
            <div class="alert ${r.ok ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small">
              <b>${r.ok ? '✅ La carrera se comporta' : '❌ La carrera NO se comporta'}</b> · ${r.ms} ms total${r.avisos ? ` · ${r.avisos} aviso(s)` : ''}
            </div>
            <ul class="list-group list-group-flush" style="font-size:.875rem">${r.checks.map(c => `
              <li class="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
                <span>${c.ok ? '<span class="text-success fw-semibold me-1">✓</span>'
                      : c.warn ? '<span class="text-warning fw-semibold me-1">⚠</span>'
                      : '<span class="text-danger fw-semibold me-1">✗</span>'}${escapeHtml(c.msg)}</span>
                <small class="text-muted">${escapeHtml(c.detail)}</small></li>`).join('')}</ul>`;
        } catch (e) {
          box.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
        } finally {
          btn.disabled = false;
        }
      });

      on(rootSel, 'click', '#admin-stress', async () => {
        const box = document.getElementById('admin-stress-out');
        const btn = document.getElementById('admin-stress');
        const n = Number(document.getElementById('admin-stress-n').value) || 30;
        const ok = await confirmModal(`Se van a simular ${n} alumnos golpeando el servidor A LA VEZ (live + tareas). Crea y borra datos de prueba. ¿Continuar?`, { okText: 'Simular carga' });
        if (!ok) return;
        btn.disabled = true;
        const log = [];
        const paint = (extra = '') => {
          box.innerHTML = `<div class="d-flex align-items-center gap-2 mb-1 text-muted"><span class="spinner-border spinner-border-sm"></span><small>${escapeHtml(log[log.length - 1] || 'Preparando…')}</small></div>${extra}`;
        };
        paint();
        try {
          const r = await runStressTest({ pbUrl: PB_URL, n, onLog: (m) => { log.push(m); paint(); } });
          const row = (label, pass, detail) =>
            `<li class="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
               <span>${pass ? '<span class="text-success fw-semibold me-1">✓</span>' : '<span class="text-danger fw-semibold me-1">✗</span>'}${escapeHtml(label)}</span>
               <small class="text-muted">${escapeHtml(detail)}</small></li>`;
          const L = r.live, T = r.tasks;
          const notRun = !L && !T;   // abortó antes de correr (faltan colecciones) ≠ se cayó
          const notes = r.notes.length ? `<div class="alert alert-warning py-1 px-2 small mb-2">${r.notes.map(escapeHtml).join('<br>')}</div>` : '';
          if (notRun) {
            box.innerHTML = `${notes}<div class="alert alert-secondary py-1 px-2 mb-0 small"><b>No ejecutado</b> — falta preparar el servidor (arriba: <i class="bi bi-database-add"></i> Crear colecciones). No es un fallo de carga.</div>`;
            return;
          }
          const items = [];
          if (L) {
            items.push(row(`Live · entradas simultáneas`, L.playerRows === n, `${L.playerRows}/${n} filas · ${L.uniqueNames} apodos únicos · ${L.joinMs} ms`));
            const errs = Object.entries(L.answerErrors || {});
            items.push(row(`Live · respuestas simultáneas`, L.answerRows === L.joinsOk * 2,
              `${L.answerRows} filas (esperadas ${L.joinsOk * 2}) · ${L.ansMs} ms`
              + (errs.length ? ` · rechazos: ${errs.map(([k, v]) => `${v}×HTTP ${k}`).join(', ')}` : '')));
          }
          if (T) items.push(row(`Tareas · intentos simultáneos`, T.pass, T.attemptRows != null ? `${T.attemptRows}/${n} filas · ${T.attMs} ms` : 'no ejecutado'));
          box.innerHTML = `
            ${notes}
            <div class="alert ${r.ok ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small">
              <b>${r.ok ? '✅ Aguanta' : '❌ Se cayó bajo carga'}</b> · ${n} alumnos concurrentes · ${r.ms} ms total
              ${r.ok ? '' : '<br>Con RECHAZOS (403/400) es el servidor diciendo que no: regla o credencial, no carga. Sin rechazos y filas &lt; N ⇒ lost-update o la Pi no da abasto. Apodos únicos &lt; filas ⇒ colisión sin resolver.'}
            </div>
            <ul class="list-group list-group-flush" style="font-size:.875rem">${items.join('')}</ul>`;
        } catch (e) {
          box.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
        } finally {
          btn.disabled = false;
        }
      });
    },
  };
}
