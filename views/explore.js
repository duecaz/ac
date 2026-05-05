// Public library. Browse activities with visibility=public. Fork to duplicate.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { getClient } from '../core/supabase.js';
import { getUser } from '../core/auth.js';
import { newActivityId } from '../core/migrate.js';
import { save } from '../core/storage.js';
import { navigate } from '../core/router.js';
import { getTemplate } from '../core/registry.js';

export async function renderExplore(rootSel) {
  mount(rootSel, html`
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0"><i class="bi bi-globe"></i> Explorar</h2>
      <div class="input-group" style="max-width:360px">
        <input id="exp-q" class="form-control" placeholder="Buscar por título o tag…">
        <select id="exp-lang" class="form-select" style="max-width:120px">
          <option value="">Todos</option>
          <option value="es" selected>Español</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="pt">Português</option>
        </select>
      </div>
    </div>
    <div id="exp-list">
      <div class="text-center py-5"><div class="spinner-border"></div></div>
    </div>
  `);

  let cache = [];
  async function load() {
    const sb = await getClient();
    let q = sb.from('activities').select('id, data, author_id, language, tags, updated_at')
      .eq('visibility', 'public').order('updated_at', { ascending: false }).limit(120);
    const lang = document.getElementById('exp-lang').value;
    if (lang) q = q.eq('language', lang);
    const { data, error } = await q;
    if (error) { document.getElementById('exp-list').innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`; return; }
    cache = data || [];
    paint();
  }

  function paint() {
    const term = document.getElementById('exp-q').value.trim().toLowerCase();
    const filtered = cache.filter(r => {
      if (!term) return true;
      const a = r.data || {};
      return (a.title || '').toLowerCase().includes(term)
          || (a.subtitle || '').toLowerCase().includes(term)
          || (r.tags || []).some(t => String(t).toLowerCase().includes(term));
    });
    const list = document.getElementById('exp-list');
    if (!filtered.length) { list.innerHTML = `<p class="text-muted text-center py-5">Sin resultados.</p>`; return; }
    list.innerHTML = `<div class="row g-3">${filtered.map(r => card(r)).join('')}</div>`;
  }

  function card(r) {
    const a = r.data || {};
    const T = getTemplate(a.template);
    const tags = (r.tags || []).slice(0, 4);
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || a.template)}</span>
              <small class="text-muted">${escapeHtml(r.language || 'es')}</small>
            </div>
            <h5 class="card-title mt-2">${escapeHtml(a.title || '')}</h5>
            <p class="card-text small text-muted">${escapeHtml(a.subtitle || '')}</p>
            <div>${tags.map(t => `<span class="badge bg-light text-dark border">${escapeHtml(t)}</span>`).join(' ')}</div>
          </div>
          <div class="card-footer d-flex gap-2">
            <button class="btn btn-success btn-sm flex-grow-1 exp-play" data-id="${escapeHtml(a.id)}"><i class="bi bi-play-fill"></i> Probar</button>
            <button class="btn btn-outline-primary btn-sm exp-fork" data-id="${escapeHtml(a.id)}"><i class="bi bi-files"></i> Duplicar</button>
          </div>
        </div>
      </div>`;
  }

  on(rootSel, 'input', '#exp-q', () => paint());
  on(rootSel, 'change', '#exp-lang', () => load());
  on(rootSel, 'click', '.exp-play', async (_, b) => {
    // Don't pollute local store with the foreign id; play it transient via
    // sessionStorage and a special preview route would be better, but for
    // simplicity we fork it ephemerally with a new id.
    const row = cache.find(r => r.data?.id === b.dataset.id);
    if (!row) return;
    const preview = { ...row.data, id: newActivityId(), forkOf: row.data.id, visibility: 'private' };
    save(preview);
    navigate(`#/play/${preview.id}`);
  });
  on(rootSel, 'click', '.exp-fork', async (_, b) => {
    const row = cache.find(r => r.data?.id === b.dataset.id);
    if (!row) return;
    const u = await getUser();
    const fork = {
      ...row.data,
      id: newActivityId(),
      title: row.data.title + ' (copia)',
      forkOf: row.data.id,
      visibility: 'private',
      author: { id: u?.id || null, signedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    save(fork);
    navigate(`#/edit/${fork.id}`);
  });

  load();
}
