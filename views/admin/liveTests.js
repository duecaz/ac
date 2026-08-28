// v1.51.629: adminView se partió POR PANEL. Esta sección es «Tests en vivo»:
// el runner del panel (core/selftest.js) con barra de progreso y lista
// streaming — la misma suite que corre por CLI en `node tests/run.mjs`.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { runSelfTests, TOTAL_TESTS } from '../../core/selftest.js';

export function createLiveTestsSection() {
  return {
    html: () => `
      <h5 class="mt-4">Tests en vivo <small class="text-muted">(${TOTAL_TESTS} comprobaciones · la suite CI es <code>node tests/run.mjs</code>)</small></h5>
      <button id="admin-run" class="btn btn-success"><i class="bi bi-play-circle"></i> Ejecutar tests</button>
      <div id="admin-tests" class="mt-2"></div>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-run', async () => {
        const box = document.getElementById('admin-tests');
        const btn = document.getElementById('admin-run');
        btn.disabled = true;

        // Build streaming UI: progress bar + live list.
        box.innerHTML = `
          <div class="mb-2">
            <div class="d-flex justify-content-between mb-1">
              <small id="at-status" class="text-muted">Ejecutando…</small>
              <small id="at-count" class="text-muted">0 / ${TOTAL_TESTS}</small>
            </div>
            <div class="progress" style="height:6px">
              <div id="at-bar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                   role="progressbar" style="width:0%"></div>
            </div>
          </div>
          <ul id="at-list" class="list-group list-group-flush" style="font-size:.875rem"></ul>`;

        const bar   = document.getElementById('at-bar');
        const count = document.getElementById('at-count');
        const statusEl = document.getElementById('at-status');
        const ul    = document.getElementById('at-list');
        let failed  = 0;

        const results = await runSelfTests((r, done, total) => {
          if (!r.pass) failed++;
          // Update progress.
          const pct = Math.round(done / total * 100);
          if (bar)   bar.style.width   = pct + '%';
          if (count) count.textContent = `${done} / ${total}`;
          if (bar && failed > 0) bar.className = 'progress-bar bg-danger';
          // Append result row (streaming).
          if (ul) {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 px-2';
            li.innerHTML = `
              <span>
                <span class="badge bg-secondary me-1" style="font-size:.7rem">${escapeHtml(r.group)}</span>
                ${escapeHtml(r.name)}
              </span>
              <span class="ms-2 text-nowrap">
                ${r.pass
                  ? '<span class="text-success fw-semibold">✓</span>'
                  : `<span class="text-danger fw-semibold" title="${escapeHtml(r.error || '')}">✗ <small>${escapeHtml((r.error||'').slice(0, 60))}</small></span>`}
              </span>`;
            ul.appendChild(li);
            li.scrollIntoView({ block: 'nearest' });
          }
        });

        // Final summary banner above the list.
        const passed = results.filter(r => r.pass).length;
        const allOk  = passed === results.length;
        if (bar) {
          bar.className = `progress-bar ${allOk ? 'bg-success' : 'bg-danger'}`;
          bar.style.width = '100%';
        }
        if (statusEl) statusEl.className = allOk ? 'text-success fw-semibold' : 'text-danger fw-semibold';
        if (statusEl) statusEl.textContent = allOk ? `✓ Todos pasaron` : `✗ ${failed} fallaron`;

        const banner = document.createElement('div');
        banner.className = `alert ${allOk ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small`;
        banner.innerHTML = `<b>${passed} / ${results.length}</b> tests pasados ${allOk ? '✓' : '— revisa los detalles abajo'}`;
        box.insertBefore(banner, box.querySelector('div'));

        btn.disabled = false;
      });
    },
  };
}
