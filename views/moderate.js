// Moderación (S3) — solo para profes con role='admin' (Google). Ruta #/moderar.
// DOS cosas, no una:
//   · los REPORTES (alguien denunció una actividad) — borrar el reporte o la
//     actividad reportada;
//   · la BIBLIOTECA entera — buscar y limpiar lo que no debería estar publicado.
//
// La segunda la pidió el dueño (2026-09-01: «hay varias que usuarios crearon y
// son test»). Faltaba SOLO la pantalla: el servidor ya deja al admin borrar
// cualquier actividad (`deleteRule` de core/pbRules.js incluye el rol), pero la
// única forma de llegar a una era que alguien la hubiera REPORTADO antes —
// para lo demás había que entrar a PocketBase en la Pi.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { isAdmin } from '../core/auth.js';
import { listReports, deleteReport, esRondaQa, QA_PREFIX } from '../core/reports.js';
import { removeMany, listPublicActivities } from '../core/storage.js';
import { searchActivities } from '../core/search.js';
import { getTemplate } from '../core/registry.js';
import { toast, confirmModal } from '../core/toast.js';
import { fechaHora, fechaCorta } from '../core/fechas.js';

export async function renderModerate(rootSel) {
  if (!isAdmin()) {
    mount(rootSel, html`
      <div class="auth-gate"><div class="auth-gate__card">
        <div class="auth-gate__icon"><i class="bi bi-shield-lock"></i></div>
        <h1 class="auth-gate__title">Solo administradores</h1>
        <p class="auth-gate__sub">Esta sección es para moderadores. Si deberías tener acceso, pide que te asignen el rol admin.</p>
        <a href="#/" class="auth-gate__back"><i class="bi bi-arrow-left"></i> Volver a la portada</a>
      </div></div>`);
    return;
  }

  mount(rootSel, html`
    <div class="home-wrap">
      <div class="home-head"><div><h1><i class="bi bi-flag"></i> Moderación</h1>
        <p>Reportes de contenido y limpieza de la biblioteca pública</p></div></div>
      <div id="mod-list"><div class="text-center py-5"><div class="spinner-border"></div></div></div>
      <hr class="my-4">
      <div class="home-head"><div><h2 class="h4"><i class="bi bi-collection"></i> Biblioteca pública</h2>
        <p>Todo lo publicado, de cualquier profe. Borrar es definitivo.</p></div></div>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input id="mod-buscar" class="form-control" style="max-width:320px" placeholder="Buscar por título, tema o contenido…">
        <button id="mod-borrar-sel" class="btn btn-outline-danger" disabled>
          <i class="bi bi-trash3"></i> Borrar seleccionadas (<span id="mod-n">0</span>)
        </button>
      </div>
      <div id="mod-biblio"><div class="text-center py-4"><div class="spinner-border"></div></div></div>
    </div>`);

  async function load() {
    const todos = await listReports();
    // Las rondas de PRUEBA (test.html) viajan por la misma colección con el
    // prefijo `qa:` — se separan aquí para que no se mezclen con la moderación.
    const rondas = todos.filter(esRondaQa);
    const reports = todos.filter(r => !esRondaQa(r));
    const el = document.getElementById('mod-list');
    if (!el) return;
    const rondasHtml = !rondas.length ? '' : `
      <h4 class="mt-2 mb-2"><i class="bi bi-clipboard-check"></i> Rondas de prueba (QA)</h4>
      ${rondas.map(r => `
        <details class="mod-report d-block mb-2" data-report="${escapeHtml(r.id)}">
          <summary style="cursor:pointer">
            <b>${escapeHtml(String(r.activity).slice(QA_PREFIX.length))}</b>
            · ${escapeHtml(fechaHora(r.created))} · por ${escapeHtml(r.by || '—')}
            <button class="btn btn-sm btn-outline-secondary ms-2 mod-dismiss"><i class="bi bi-check2"></i> Descartar</button>
          </summary>
          <pre class="mt-2 mb-0 p-2" style="white-space:pre-wrap;font-size:.8rem;background:var(--bs-tertiary-bg,#f6f4ec);border-radius:6px">${escapeHtml(r.reason || '(vacío)')}</pre>
        </details>`).join('')}
      <hr class="my-3">`;
    if (!reports.length && !rondas.length) { el.innerHTML = `<p class="text-muted text-center py-5">No hay reportes. 🎉</p>`; return; }
    el.innerHTML = `${rondasHtml}${!reports.length ? '' : `<div class="mod-reports">${reports.map(r => `
      <div class="mod-report" data-report="${escapeHtml(r.id)}" data-activity="${escapeHtml(r.activity)}">
        <div class="mod-report__main">
          <div class="mod-report__act"><i class="bi bi-puzzle"></i> ${escapeHtml(r.activity)}</div>
          ${r.reason ? `<div class="mod-report__reason">${escapeHtml(r.reason)}</div>` : ''}
          <div class="mod-report__meta">Por: ${escapeHtml(r.by || '—')} · ${escapeHtml(fechaCorta(r.created))}</div>
        </div>
        <div class="mod-report__actions">
          <button class="btn btn-sm btn-outline-primary mod-play"><i class="bi bi-play-fill"></i> Ver</button>
          <button class="btn btn-sm btn-outline-secondary mod-dismiss" title="Descartar reporte"><i class="bi bi-check2"></i> Descartar</button>
          <button class="btn btn-sm btn-outline-danger mod-delact" title="Borrar la actividad"><i class="bi bi-trash3"></i> Borrar actividad</button>
        </div>
      </div>`).join('')}</div>`}`;
  }

  // ── LA BIBLIOTECA ENTERA ───────────────────────────────────────────────────
  // Se listan las PÚBLICAS: son las que ve todo el mundo y las que ensucian.
  // Lo privado de cada profe es suyo y no se toca desde aquí.
  let biblio = [];
  async function cargarBiblio() {
    biblio = await listPublicActivities({ limit: 200 });
    pintarBiblio();
  }
  function pintarBiblio() {
    const el = document.getElementById('mod-biblio');
    if (!el) return;
    const q = document.getElementById('mod-buscar')?.value || '';
    // El MISMO buscador que usa el profe (core/search.js): sin tildes, por
    // palabras y también dentro del contenido — un «test» suelto en una
    // pregunta encuentra la actividad de prueba aunque el título no lo diga.
    const vistas = searchActivities(biblio, { q });
    if (!biblio.length) { el.innerHTML = `<p class="text-muted text-center py-4">No hay actividades públicas.</p>`; return; }
    if (!vistas.length) { el.innerHTML = `<p class="text-muted text-center py-4">Nada coincide con «${escapeHtml(q)}».</p>`; return; }
    el.innerHTML = `
      <p class="text-muted small">${vistas.length} de ${biblio.length} actividades públicas</p>
      <div class="mod-reports">${vistas.map(a => {
        const T = getTemplate(a.template);
        return `
        <div class="mod-report" data-activity="${escapeHtml(a.id)}">
          <div class="mod-report__main d-flex align-items-center gap-2">
            <input type="checkbox" class="form-check-input mod-sel m-0" title="Seleccionar">
            <div>
              <div class="mod-report__act"><i class="bi ${escapeHtml(T?.meta?.icon || 'bi-puzzle')}"></i> ${escapeHtml(a.title || '(sin título)')}</div>
              <div class="mod-report__meta">${escapeHtml(T?.meta?.label || a.template || '—')}
                · ${escapeHtml(fechaCorta(a.updatedAt || ''))}
                ${a.author?.name ? `· por ${escapeHtml(a.author.name)}` : ''}</div>
            </div>
          </div>
          <div class="mod-report__actions">
            <button class="btn btn-sm btn-outline-primary mod-play"><i class="bi bi-play-fill"></i> Ver</button>
            <button class="btn btn-sm btn-outline-danger mod-delact"><i class="bi bi-trash3"></i> Borrar</button>
          </div>
        </div>`;
      }).join('')}</div>`;
    contarSel();
  }
  const seleccionadas = () => [...document.querySelectorAll('#mod-biblio .mod-sel:checked')]
    .map(c => c.closest('.mod-report')?.dataset.activity).filter(Boolean);
  function contarSel() {
    const n = seleccionadas().length;
    const btn = document.getElementById('mod-borrar-sel');
    const span = document.getElementById('mod-n');
    if (span) span.textContent = String(n);
    if (btn) btn.disabled = n === 0;
  }

  /** Borra y DICE lo que de verdad pasó. La cuenta la lleva `removeMany`
   *  (core/storage.js, con su test); aquí solo se redacta el aviso. Un
   *  «N borradas» cuando el servidor las rechazó dejaría la actividad publicada
   *  para la clase siguiente y a nadie mirándola. */
  async function borrar(ids) {
    const { hechas, fallos } = await removeMany(ids);
    if (fallos.length) {
      toast(`Se borraron ${hechas} de ${ids.length}. ${fallos.length} no se pudieron borrar: `
        + fallos.slice(0, 2).map(f => `${f.id}: ${f.error}`).join(' · '), 'warning', 9000);
    } else {
      toast(hechas === 1 ? 'Actividad borrada.' : `${hechas} actividades borradas.`, 'success');
    }
    return { hechas, fallos };
  }

  on(rootSel, 'input', '#mod-buscar', () => pintarBiblio());
  on(rootSel, 'change', '.mod-sel', () => contarSel());
  on(rootSel, 'click', '#mod-borrar-sel', async () => {
    const ids = seleccionadas();
    if (!ids.length) return;
    const ok = await confirmModal(`¿Borrar ${ids.length} actividad(es) de la biblioteca? No se puede deshacer.`,
      { okText: 'Borrar', danger: true });
    if (!ok) return;
    await borrar(ids);
    await cargarBiblio();
  });

  const rowOf = (b) => b.closest('.mod-report');
  on(rootSel, 'click', '.mod-play', (_, b) => navigate(`#/play/${rowOf(b).dataset.activity}`));
  on(rootSel, 'click', '.mod-dismiss', async (_, b) => {
    try { await deleteReport(rowOf(b).dataset.report); toast('Reporte descartado.', 'success'); load(); }
    catch (e) { toast('No se pudo: ' + e.message, 'danger', 5000); }
  });
  // El MISMO botón sirve a las dos listas (reporte y biblioteca): lo que cambia
  // es que un reporte, al borrarse la actividad, se descarta con ella.
  on(rootSel, 'click', '.mod-delact', async (_, b) => {
    const row = rowOf(b);
    const esReporte = !!row.dataset.report;
    const ok = await confirmModal(esReporte
      ? '¿Borrar la actividad reportada? (no se puede deshacer)'
      : '¿Borrar esta actividad de la biblioteca? No se puede deshacer.', { okText: 'Borrar', danger: true });
    if (!ok) return;
    const { hechas } = await borrar([row.dataset.activity]);
    // El reporte solo se descarta si la actividad SE BORRÓ de verdad: si no,
    // se quedaría un reporte huérfano de algo que sigue publicado.
    if (hechas && esReporte) await deleteReport(row.dataset.report).catch(() => {});
    if (esReporte) load();
    await cargarBiblio();
  });

  load();
  cargarBiblio();
}
