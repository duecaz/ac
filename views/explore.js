// Biblioteca pública. Explora actividades con visibility=public. Se juegan por la
// tira de modos; editar/borrar viven en "Mis actividades", moderar en #/moderar.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { activityCardHtml } from '../core/activityCard.js';
import { listPublic } from '../core/storage.js';
import { searchActivities } from '../core/search.js';
import { getTemplate } from '../core/registry.js';

// `q0` = término que llega EN LA URL (`#/explore?q=comas`). Es como aterriza el
// profe desde el buscador de la portada: si la vista no lo leyera, llegaría a la
// biblioteca con la caja vacía y tendría que teclearlo otra vez — dos toques
// tirados justo en el tramo por el que pasa toda clase (norte §2b).
export async function renderExplore(rootSel, q0 = '') {
  mount(rootSel, html`
    <div class="home-wrap">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 class="mb-0"><i class="bi bi-globe"></i> Explorar</h2>
        <div class="input-group" style="max-width:360px">
          <input id="exp-q" class="form-control" placeholder="Buscar por tema, título o tag…" value="${escapeHtml(q0)}">
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
    </div>
  `);

  let cache = [];
  async function load() {
    const lang = document.getElementById('exp-lang').value;
    // La colección `activities` tiene UN dueño (ley §21): se le PIDE la lista, no
    // se consulta a mano. El filtro, el escapado, el orden por `updatedAt` del
    // contenido y la migración del modelo viven ahí, una sola vez.
    try {
      cache = await listPublic({ language: lang, limit: 120 });
      // §4c: un JUEGO no se publica — viene con la app y vive en la estantería
      // #/juegos. Las filas viejas de juegos publicadas antes de la distinción
      // se filtran aquí para no enseñar duplicados de lo que la estantería ya da.
      cache = cache.filter(r => getTemplate(r.data?.template)?.meta?.kind !== 'juego');
    } catch (e) {
      document.getElementById('exp-list').innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
      return;
    }
    paint();
  }

  function paint() {
    const term = document.getElementById('exp-q').value.trim();
    // Mismo buscador que "Mis actividades" (`core/search.js`): sin tildes, por
    // palabras y también dentro del contenido. Los tags reales viven en la FILA
    // (r.tags), fuera del blob → se los damos a la actividad al mirarla.
    const filtered = searchActivities(cache, { q: term }, r => ({ ...(r.data || {}), tags: r.tags || [] }));
    const list = document.getElementById('exp-list');
    // Buscar es binario (norte §2b): si no está, la salida es CREARLA, no un
    // "sin resultados" que deja al profe parado delante de la clase.
    if (!filtered.length) {
      list.innerHTML = `<div class="home-empty">
        <i class="bi bi-search"></i>
        <p>${term ? `Nadie ha publicado nada sobre <b>${escapeHtml(term)}</b>.` : 'La biblioteca está vacía.'}</p>
        <div class="home-empty-actions">
          <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Crear una</a>
        </div>
      </div>`;
      return;
    }
    list.innerHTML = `<div class="home-grid">${filtered.map(r => card(r)).join('')}</div>`;
  }

  function card(r) {
    // Los tags e id "reales" viven en la fila PB (r.tags / r.id), fuera del blob
    // data → los normalizamos DENTRO de la actividad para la tarjeta compartida.
    const a = { ...(r.data || {}), id: r.data?.id || r.id, tags: r.tags || [] };
    const topRight = `<small class="text-muted">${escapeHtml(r.language || 'es')}</small>`;
    // Sin pie de acciones: jugar se hace por la tira de modos (Individual/VS/
    // Equipos) o clic en el preview. Editar/borrar viven SOLO en "Mis
    // actividades" (son tuyas); para moderar como admin está la vista #/moderar.
    return activityCardHtml(a, { variant: 'library', topRight });
  }

  on(rootSel, 'input', '#exp-q', () => paint());
  on(rootSel, 'change', '#exp-lang', () => load());
  // Jugar: preview clicable + tira de modos (Individual/VS/Equipos).
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));

  load();
}
