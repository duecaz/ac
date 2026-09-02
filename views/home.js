import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list, remove, get, save } from '../core/storage.js';
import { decidirVisibilidad } from '../core/activityCheck.js';
import { navigate } from '../core/router.js';
import { listTemplates, getTemplate } from '../core/registry.js';
import { confirmModal, toast, TOAST_ERROR, TOAST_NORMAL } from '../core/toast.js';
import { activityItemCount as itemCount } from '../core/migrate.js';
import { activityCardHtml } from '../core/activityCard.js';
import { searchActivities } from '../core/search.js';
import { buildSwitchOptions } from './switchTemplate.js';
import { canHost } from '../core/authGate.js';
import { wireActivityCard } from './activityCardWire.js';

let _filter = { q: '', template: '' };

export function renderHome(rootSel) {
  const all = list();
  const templates = listTemplates();

  function paint() {
    // El filtro NO se escribe aquí: es el mismo buscador que la biblioteca
    // (`core/search.js`), con sus reglas — sin tildes, por palabras y también
    // dentro del contenido. Estaba copiado en las dos vistas.
    const acts = searchActivities(all, _filter);

    mount(rootSel, html`
      <div class="home-wrap">
        <div class="home-head">
          <div>
            <h1>Mis actividades</h1>
            <p>Gestiona y comparte tus actividades con tus alumnos</p>
          </div>
          <!-- "+ Nueva" junto al título. Importar/Exportar/Admin viven en la barra
               superior (nav); "Nueva lista" en la página "Elige una plantilla". -->
          <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Nueva</a>
        </div>
        ${all.length === 0 ? '' : `
          <div class="home-tools">
            <div class="home-search">
              <i class="bi bi-search"></i>
              <input id="h-q" placeholder="Buscar por tema, título o tag…" value="${escapeHtml(_filter.q)}">
            </div>
            <details class="home-filter${_filter.template ? ' is-set' : ''}">
              <summary class="home-config" title="Filtrar por plantilla" aria-label="Filtrar por plantilla"><i class="bi bi-sliders2"></i></summary>
              <div class="home-filter-pop">
                <div class="home-filter-label">Filtrar por plantilla</div>
                <select id="h-tpl">
                  <option value="">Todas las plantillas</option>
                  ${templates.map(T => `<option value="${T.meta.name}" ${_filter.template===T.meta.name?'selected':''}>${escapeHtml(T.meta.label)}</option>`).join('')}
                </select>
              </div>
            </details>
          </div>
        `}
        ${acts.length === 0 ? (all.length === 0 ? `
          <div class="home-empty">
            <i class="bi bi-collection"></i>
            <p>Aún no hay actividades. Crea la primera.</p>
          </div>` : emptySearch()) : `
          <div class="home-grid">
            ${acts.map(card).join('')}
          </div>`}
      </div>
    `);

    const qEl = document.getElementById('h-q');
    // paint() re-monta toda la vista → el <input> se reemplaza. Hay que re-enfocar
    // el input NUEVO (no el viejo, ya desprendido) y restaurar el cursor, o el
    // buscador pierde el foco a la primera tecla.
    if (qEl) qEl.oninput = e => {
      _filter.q = e.target.value;
      const caret = e.target.selectionStart;
      paint();
      const q = document.getElementById('h-q');
      if (q) { q.focus(); try { q.setSelectionRange(caret, caret); } catch {} }
    };
    const tEl = document.getElementById('h-tpl');
    if (tEl) tEl.onchange = e => { _filter.template = e.target.value; paint(); };
  }

  // "No aparece" es un RESULTADO, no un callejón: buscar es binario (norte §2b)
  // — o está, o el profe se va a crearla. Así que el vacío ofrece las dos
  // salidas reales (crear · mirar en la biblioteca) en vez de dejarle mirando
  // "Sin resultados" con la clase esperando.
  function emptySearch() {
    const q = _filter.q.trim();
    return `<div class="home-empty">
      <i class="bi bi-search"></i>
      <p>${q ? `No tienes ninguna actividad sobre <b>${escapeHtml(q)}</b>.` : 'Ninguna actividad con ese filtro.'}</p>
      <div class="home-empty-actions">
        <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Crear una</a>
        <a href="#/explore" class="btn-ghost"><i class="bi bi-globe"></i> Buscar en la biblioteca</a>
      </div>
    </div>`;
  }

  function card(a) {
    if (a.template === 'list') return listCard(a);
    const n = itemCount(a);
    // Esquina sup-der (dueño): publicar/despublicar + editar + borrar.
    // §4c: un JUEGO no se publica (el contenido no es del profe) — sin botón
    // Publicar/Borrador en su tarjeta. Editar/borrar sí: la actividad es suya.
    const esJuego = getTemplate(a.template)?.meta?.kind === 'juego';
    // LO NORMAL NO SE ANUNCIA, LA EXCEPCIÓN SÍ (dueño 2026-09-01: «hay varios
    // que dicen Pública, es innecesario, casi todas lo son»). Publicar es el
    // caso corriente: se queda en un icono como los de editar y borrar —sigue
    // pulsándose para despublicar—, y la pastilla con palabra la lleva solo lo
    // que NO está publicado, que es lo que hay que ver de un vistazo en una
    // rejilla de treinta tarjetas.
    const topRight = `<div class="acard-icons">
        ${esJuego ? '' : a.visibility === 'public'
          ? `<button class="icon-btn pub act-unpublish" data-pub data-id="${a.id}" title="Publicada — clic para pasar a borrador" aria-label="Publicada"><i class="bi bi-globe"></i></button>`
          : `<button class="pub-toggle act-publish" data-pub data-id="${a.id}" title="Borrador — clic para publicar en la biblioteca"><i class="bi bi-eye-slash"></i> Borrador</button>`}
        <button class="icon-btn edit act-edit" data-id="${a.id}" title="Editar"><i class="bi bi-pencil-fill"></i></button>
        <button class="icon-btn del act-del" data-id="${a.id}" title="Eliminar"><i class="bi bi-trash3"></i></button>
        ${a._unsynced ? '<i class="bi bi-cloud-slash acard-unsync" title="No sincronizada"></i>' : ''}
      </div>`;
    // El gesto Wordwall a la vista: cuántos formatos hermanos puede jugar este
    // MISMO contenido (clic → editor, donde vive el selector de formato).
    const sibs = buildSwitchOptions(a).filter(o => o.valid);
    const footer = `<div class="acard-foot">
        <span title="Elementos"><i class="bi bi-collection"></i> ${n} ${n === 1 ? 'ítem' : 'ítems'}</span>
        ${sibs.length ? `<button class="acard-switch act-edit" data-id="${a.id}"
          title="Este contenido también funciona como: ${sibs.map(o => o.template.meta.label).join(' · ')}">
          <i class="bi bi-arrow-left-right"></i> ${sibs.length + 1} formatos</button>` : ''}
        <span title="Me gusta (próximamente)"><i class="bi bi-heart-fill heart"></i> ${a.likes ?? 0}</span>
      </div>`;
    // 'all' = incluye Live/Tarea (son actividades del dueño).
    // `authed`: sin sesión, Live/Tarea salen con CANDADO y su frase — dirigir una
    // sala o crear una tarea son actos de profe (ley §22). Avisar aquí, no con un
    // 403 a mitad de clase.
    return activityCardHtml(a, { variant: 'mine', authed: canHost(), topRight, footer });
  }

  // La tarjeta de LISTA también sale del componente único (variante 'list'):
  // era la última tarjeta escrita a mano y el escáner de
  // tests/activityCard.test.mjs la tenía como excepción declarada. La vista
  // solo aporta lo SUYO: los iconos de dueño y el pie con el nº de rondas.
  function listCard(a) {
    const rounds = (a.content?.items || []).length;
    const topRight = `<div class="acard-icons">
        <button class="icon-btn edit act-edit-list" data-id="${escapeHtml(a.id)}" title="Editar lista"><i class="bi bi-pencil-fill"></i></button>
        <button class="icon-btn del act-del" data-id="${escapeHtml(a.id)}" title="Eliminar"><i class="bi bi-trash3"></i></button>
        ${a._unsynced ? '<i class="bi bi-cloud-slash acard-unsync" title="No sincronizada"></i>' : ''}
      </div>`;
    const footer = `<div class="acard-foot" style="margin-top:8px">
        <span><i class="bi bi-collection"></i> ${rounds} rondas</span>
      </div>`;
    return activityCardHtml(a, { variant: 'list', topRight, footer });
  }

  // Los cinco modos (y su candado) los cablea el DUEÑO de la tarjeta: estaban
  // escritos aquí y copiados en portada, biblioteca, juegos y perfil, y por eso
  // Live/Tarea no podían salir fuera de esta vista.
  wireActivityCard(rootSel);
  on(rootSel, 'click', '.act-edit-list', (_, b) => navigate(`#/edit-list/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit', (_, b) => navigate(`#/edit/${b.dataset.id}`));
  // Publicar / despublicar (S2): alterna visibility unlisted↔public. Publicar la
  // mete en la biblioteca pública; borrador la saca. Guarda y re-pinta.
  const setVisibility = async (id, visibility, msg) => {
    const a = get(id);
    if (!a) return;
    // MISMA PUERTA QUE EL EDITOR. Este interruptor publicaba sin preguntar nada:
    // la Ruleta sin casillas que el dueño encontró en la biblioteca podía entrar
    // por aquí de un solo clic, sin pasar por el editor cuya guarda se cerró en
    // v1.51.605. La decisión la toma su dueño (§21) y aquí solo se obedece.
    const vis = decidirVisibilidad(a, visibility, 'accion');
    if (vis.aviso) toast(vis.aviso, 'warning', TOAST_ERROR);
    if (vis.rechaza) return;
    a.visibility = vis.visibility;
    const { remote } = save(a);
    remote.catch(() => {});
    toast(msg, 'success');
    renderHome(rootSel);
  };
  on(rootSel, 'click', '.act-publish', (_, b) => setVisibility(b.dataset.id, 'public', 'Publicada en la biblioteca.'));
  on(rootSel, 'click', '.act-unpublish', (_, b) => setVisibility(b.dataset.id, 'unlisted', 'Pasada a borrador (fuera de la biblioteca).'));
  on(rootSel, 'click', '.act-del', async (_, b) => {
    const ok = await confirmModal('¿Eliminar esta actividad?', { okText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await remove(b.dataset.id);
      toast('Eliminada.', 'success');
    } catch (e) {
      toast('Eliminada localmente; no se pudo borrar en el servidor: ' + e.message, 'warning', TOAST_NORMAL);
    }
    renderHome(rootSel);
  });

  paint();
}
