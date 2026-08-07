// Tarjeta ÚNICA de actividad. TODA vista que lista actividades (Mis actividades,
// Portada, Explorar, Perfil del autor) pinta con ESTA función — no hay markup de
// tarjeta a mano en ningún sitio. El núcleo (preview + tira de modos + etiqueta +
// título + subtítulo + autor) es idéntico en todas; lo único que cambia son los
// "slots" de acciones (`topRight` en la esquina y `footer` al pie), que cada vista
// inyecta según su contexto. Los handlers siguen viviendo en cada vista (delegados
// en su raíz) y reutilizan las clases compartidas .act-play/.act-vs/.act-teams
// (+ .act-pin/.act-task solo en "Mis actividades", que son tuyas).
//
// Un solo sitio decide cómo es una tarjeta → cambiar el diseño o un modo se hace
// aquí una vez y aplica en las 4 páginas. Lo vigila tests/activityCard.test.mjs.
import { escapeHtml } from './html.js';
import { getTemplate } from './registry.js';
import { getMode, modeNeedsAuth, modeAuthHint } from './modes.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { homePreviewHtml, previewBgStyle } from './homePreview.js';
import { activityPageCount } from './migrate.js';

// Tira de modos. Por defecto solo los JUGABLES sobre cualquier actividad
// (Individual/VS/Equipos). `includeManage` añade Live/Tarea, que crean
// sesión/asignación y solo tienen sentido sobre TUS propias actividades
// ("Mis actividades") — en la biblioteca pública romperían sobre una ajena.
export function modeStripHtml(a, { includeManage = false, authed = true } = {}) {
  const T = getTemplate(a.template);
  const m = T?.meta?.modes || { solo: true };
  const teamsMode = getMode('teams');
  const canTeams = teamsMode.supportsTemplate(T) && teamsMode.isAvailable(a);
  const id = escapeHtml(a.id);
  // Modo host-only sin sesión: se muestra con CANDADO y su frase, no se esconde
  // ni se deja fallar al pulsar. `authed` lo aporta la vista (este módulo es
  // puro). Los modos jugables (Individual/VS/Equipos) nunca se bloquean.
  const hostBtn = (modeId, cls, icon, label) => {
    const locked = !authed && modeNeedsAuth(modeId);
    const title = locked ? modeAuthHint(modeId) : label;
    return `<button class="${cls} mode-${modeId === 'task' ? 'task' : 'live'}${locked ? ' is-locked' : ''}"`
      + ` data-id="${id}"${locked ? ' data-locked="1"' : ''} title="${escapeHtml(title)}">`
      + `<i class="bi ${locked ? 'bi-lock-fill' : icon}"></i></button>`;
  };
  return [
    m.solo            ? `<button class="act-play mode-solo"   data-id="${id}" title="Individual"><i class="bi bi-person-fill"></i></button>` : '',
    isVsCompatible(a) ? `<button class="act-vs mode-vs"       data-id="${id}" title="VS"><i class="bi bi-fire"></i></button>` : '',
    canTeams          ? `<button class="act-teams mode-teams" data-id="${id}" data-tpl="${escapeHtml(a.template)}" title="Equipos"><i class="bi bi-people-fill"></i></button>` : '',
    includeManage && m.live  ? hostBtn('live', 'act-pin',  'bi-broadcast',      'En vivo') : '',
    includeManage && m.async ? hostBtn('task', 'act-task', 'bi-clipboard-check', 'Tarea')  : '',
  ].filter(Boolean).join('');
}

// VARIANTES de tarjeta. Existen porque el componente era único pero la
// CONFIGURACIÓN estaba repartida: cada vista decidía con banderitas sueltas qué
// enseñaba, y divergieron sin que nadie lo viera — el badge de páginas solo lo
// pedía "Mis actividades", el subtítulo y las etiquetas faltaban en la portada y
// en el perfil del autor. Unificar el markup no sirve de nada si "qué muestra
// una tarjeta" se decide cuatro veces.
//
// La regla ahora: **una tarjeta enseña lo que la actividad TIENE**. Los campos
// informativos (subtítulo · etiquetas · autor · nº de páginas) van encendidos
// por defecto y se pintan solo si el dato existe. La vista elige su VARIANTE
// (qué modos ofrece y si el preview juega) y aporta sus slots.
//
//   'mine'    Mis actividades — es tuya: tira completa (incl. Live/Tarea).
//   'library' Portada · Explorar · Perfil — de otro: se juega, no se gestiona.
//   'plain'   sin tira de modos (listados donde jugar no toca).
const VARIANTS = {
  mine:    { modes: 'all',  playablePreview: false },
  library: { modes: 'play', playablePreview: true  },
  plain:   { modes: 'none', playablePreview: false },
  // Lista de actividades (rondas encadenadas): sin preview de juego (cabecera
  // propia con título) y con un único modo "Jugar lista". Era la última tarjeta
  // escrita a mano fuera del componente (views/home.js listCard).
  list:    { modes: 'none', pages: false, playablePreview: false },
};

// Pinta la tarjeta canónica. `opts`:
//   variant: 'mine' | 'library' | 'plain'   → el preajuste (ver arriba)
//   authed: bool                     → hay sesión de profe (false ⇒ Live/Tarea con candado)
//   topRight: html                   → esquina sup-der del cuerpo (like / iconos dueño / idioma…)
//   footer: html                     → pie del cuerpo (Jugar / Probar+Duplicar / ítems+likes…)
//   extraClass/previewClass: string  → clases extra opcionales
//   modes/pages/playablePreview/subtitle/author/tags → sobrescriben el preajuste
//                                    (excepción justificada, no la vía normal)
export function activityCardHtml(a, opts = {}) {
  const preset = VARIANTS[opts.variant] || {};
  const {
    modes = 'none', pages = true, playablePreview = false, authed = true,
    subtitle = true, author = true, tags = true,
    topRight = '', footer = '', extraClass = '', previewClass = '',
  } = { ...preset, ...opts };
  const T = getTemplate(a.template);
  const color = opts.variant === 'list' ? 'primary' : (T?.meta?.color || 'info');
  // Un JUEGO (§4c) se presenta por la HABILIDAD que entrena — es su eje de
  // catálogo y lo que le sirve al profe para elegir y justificar. Decidido AQUÍ
  // y no en cada vista: la misma tarjeta se ve igual en la estantería, en "Mis
  // actividades" y donde aparezca (la lección de las variantes: unificar el
  // markup sin unificar la decisión es como divergieron las tarjetas).
  const esJuego = T?.meta?.kind === 'juego';
  const esLista = opts.variant === 'list';
  const icon  = esLista ? 'bi-collection-play' : esJuego ? 'bi-controller' : (T?.meta?.icon || 'bi-puzzle');
  const label = esLista ? 'Lista' : esJuego ? (T?.meta?.skill || T?.meta?.label) : (T?.meta?.label || a.template);
  const bg = previewBgStyle(a.presentation);
  const id = escapeHtml(a.id);
  const strip = modes === 'none' ? '' : modeStripHtml(a, { includeManage: modes === 'all', authed });
  let pagesBadge = '';
  if (pages) {
    const p = activityPageCount(a);
    pagesBadge = `<span class="acard-pages" title="${p} ${p === 1 ? 'página' : 'páginas'}"><i class="bi bi-files"></i> ${p}</span>`;
  }
  // La LISTA no tiene juego que previsualizar: cabecera propia con el título
  // (y por eso el cuerpo no lo repite), y un único modo "Jugar lista".
  const head = esLista
    ? `<div class="acard-listhead">
        <i class="bi bi-collection-play-fill"></i>
        <div class="overflow-hidden">
          <div class="t text-truncate">${escapeHtml(a.title || 'Sin título')}</div>
          ${a.subtitle ? `<div class="s text-truncate">${escapeHtml(a.subtitle)}</div>` : ''}
        </div>
      </div>`
    : `<div class="acard-preview${previewClass ? ' ' + previewClass : ''}"${bg ? ` style="background:${bg}"` : ''}${playablePreview ? ` data-play="${id}" role="button" title="Jugar"` : ''}>
        ${homePreviewHtml(a)}
        ${pagesBadge}
      </div>`;
  const listStrip = `<button class="mode-list act-list" data-id="${id}" title="Jugar lista">
        <i class="bi bi-play-fill"></i> Jugar</button>`;
  return `
    <article class="acard${extraClass ? ' ' + extraClass : ''}" data-id="${id}">
      ${head}
      ${esLista ? `<div class="acard-modes">${listStrip}</div>` : (strip ? `<div class="acard-modes">${strip}</div>` : '')}
      <div class="acard-body">
        <div class="acard-toprow">
          <span class="tag tag--${color}"><i class="bi ${icon}"></i> ${escapeHtml(label)}</span>
          ${topRight}
        </div>
        ${esLista ? '' : `<h3 class="acard-title">${escapeHtml(a.title || 'Sin título')}</h3>`}
        ${!esLista && subtitle && a.subtitle ? `<p class="acard-sub">${escapeHtml(a.subtitle)}</p>` : ''}
        ${author && a.author?.id ? `<a class="lp-author" href="#/autor/${escapeHtml(a.author.id)}">por ${escapeHtml(a.author.name || 'Profesor')}</a>` : ''}
        ${tags && (a.tags || []).length ? `<div class="acard-tags">${a.tags.slice(0, 3).map(t => `<span class="t">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${footer}
      </div>
    </article>`;
}
