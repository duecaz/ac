// Tarjeta ÚNICA de actividad. TODA vista que lista actividades (Mis actividades,
// Portada, Explorar, Perfil del autor) pinta con ESTA función — no hay markup de
// tarjeta a mano en ningún sitio. El núcleo (preview + tira de modos + etiqueta +
// título + subtítulo + autor) es idéntico en todas; lo único que cambia son los
// "slots" de acciones (`topRight` en la esquina y `footer` al pie), que cada vista
// inyecta según su contexto. Los CLICS de la tira los cablea un solo dueño
// (views/activityCardWire.js), no cada vista.
//
// Un solo sitio decide cómo es una tarjeta → cambiar el diseño o un modo se hace
// aquí una vez y aplica en las 4 páginas. Lo vigila tests/activityCard.test.mjs.
import { escapeHtml } from './html.js';
import { getTemplate } from './registry.js';
import { getMode, modeNeedsAuth, modeAuthHint } from './modes.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { homePreviewHtml, previewBgStyle } from './homePreview.js';
import { activityPageCount } from './migrate.js';

// Tira de modos. `includeManage` añade Live/Tarea, que crean sesión/asignación.
// Estuvieron RESERVADOS a "Mis actividades" con el motivo «en la biblioteca
// romperían sobre una ajena», y era falso: `#/launch` y `#/tasks` resuelven la
// actividad en la nube si no está en este navegador — dirigir en clase una
// actividad publicada por otro profe es justo para lo que existe la biblioteca.
// Esconderlos hacía lo contrario de lo que la app quiere: quien llega sin cuenta
// no llega a enterarse de que existe el modo en vivo. Ahora salen SIEMPRE y, sin
// sesión, con CANDADO y su frase (§22: avisar ANTES, nunca dejar que falle).
export function modeStripHtml(a, { includeManage = false, authed = false } = {}) {
  const T = getTemplate(a.template);
  const m = T?.meta?.modes || { solo: true };
  const teamsMode = getMode('teams');
  const canTeams = teamsMode.supportsTemplate(T) && teamsMode.isAvailable(a);
  const id = escapeHtml(a.id);
  // CADA BOTÓN DICE QUÉ MODO ES (`data-mode`), y de ahí sale su ruta.
  // Estuvieron identificados por CLASE (`act-play`/`act-vs`/`act-pin`…) y cada
  // vista traducía esa clase a una ruta escrita a mano: cinco copias, una de
  // ellas con nombre heredado —`act-pin` para «En vivo»— que había que traducir
  // mentalmente. Con el modo declarado, el dueño de los clics llama a
  // `rutaDeModo()` y un modo nuevo no obliga a tocar ninguna vista.
  const btn = (modeId, icon, label, { locked = false, tpl = false } = {}) =>
    `<button class="act-mode mode-${modeId}${locked ? ' is-locked' : ''}" data-mode="${modeId}"`
    + ` data-id="${id}"${tpl ? ` data-tpl="${escapeHtml(a.template)}"` : ''}${locked ? ' data-locked="1"' : ''}`
    + ` title="${escapeHtml(label)}"><i class="bi ${locked ? 'bi-lock-fill' : icon}"></i></button>`;
  // Modo host-only sin sesión: se muestra con CANDADO y su frase, no se esconde
  // ni se deja fallar al pulsar. `authed` lo aporta la vista (este módulo es
  // puro). Los modos jugables (Individual/VS/Equipos) nunca se bloquean.
  const hostBtn = (modeId, icon, label) => {
    const locked = !authed && modeNeedsAuth(modeId);
    return btn(modeId, icon, locked ? modeAuthHint(modeId) : label, { locked });
  };
  return [
    m.solo            ? btn('solo',  'bi-person-fill', 'Individual') : '',
    isVsCompatible(a) ? btn('vs',    'bi-fire',        'VS') : '',
    canTeams          ? btn('teams', 'bi-people-fill', 'Equipos', { tpl: true }) : '',
    includeManage && m.live  ? hostBtn('live', 'bi-broadcast',       'En vivo') : '',
    includeManage && m.async ? hostBtn('task', 'bi-clipboard-check', 'Tarea')   : '',
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
//   'mine'    Mis actividades — es tuya: además de jugarla, se edita/borra/publica.
//   'library' Portada · Explorar · Juegos · Perfil — de otro: se juega y se lleva
//             a clase, pero no se toca su contenido.
//   'plain'   sin tira de modos (listados donde jugar no toca).
//
// LOS CINCO MODOS SALEN EN LAS DOS (v1.51.621, decisión del dueño): la tarjeta
// no es el sitio donde se decide quién puede dirigir una sala — eso lo dice el
// candado, y lo vuelve a decir la ruta. Lo que cambia entre variantes es lo que
// de verdad depende de QUIÉN es la actividad: sus acciones de dueño.
//
// `modes` era un TRI-ESTADO ('all' · 'play' · 'none') y desde que la biblioteca
// ofrece los cinco, 'play' se quedó sin un solo llamante: dos booleanos disfrazados
// de tabla que había que leer para descubrir que ya daban igual.
const VARIANTS = {
  mine:    { strip: true,  playablePreview: false },
  library: { strip: true,  playablePreview: true  },
  plain:   { strip: false, playablePreview: false },
  // Lista de actividades (rondas encadenadas): sin preview de juego (cabecera
  // propia con título) y con un único modo "Jugar lista". Era la última tarjeta
  // escrita a mano fuera del componente (views/home.js listCard).
  list:    { strip: false, pages: false, playablePreview: false },
};

// Pinta la tarjeta canónica. `opts`:
//   variant: 'mine' | 'library' | 'plain'   → el preajuste (ver arriba)
//   authed: bool                     → hay sesión de profe (defecto FALSE ⇒ Live/Tarea
//                                      con candado). Fail-CLOSED a propósito: era `true`
//                                      y lo único que impedía que una vista olvidadiza
//                                      pintara los mandos de profe abiertos era una regex
//                                      sobre el código de las vistas. Olvidarlo ahora
//                                      pone un candado de más, que se ve y se arregla.
//   topRight: html                   → esquina sup-der del cuerpo (like / iconos dueño / idioma…)
//   footer: html                     → pie del cuerpo (iconos de dueño / ítems+likes…)
//   strip/pages/playablePreview/subtitle/author/tags → sobrescriben el preajuste
//                                    (excepción justificada, no la vía normal)
// Ya no hay `extraClass`/`previewClass`: eran dos vías para decorar la tarjeta
// DESDE FUERA (la portada se pintaba distinta con ellas) y quedaron sin llamante
// al unificar el diseño. Dejarlas en la firma es invitar a rehacerlo.
export function activityCardHtml(a, opts = {}) {
  const preset = VARIANTS[opts.variant] || {};
  const {
    strip: conModos = false, pages = true, playablePreview = false, authed = false,
    subtitle = true, author = true, tags = true, topRight = '', footer = '',
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
  // QUÉ MODOS OFRECE una actividad lo declara SU PLANTILLA (`meta.modes`), y
  // `modeStripHtml` ya lo obedece. Aquí hubo un `&& !esJuego` —«un juego no se
  // dirige ni se manda de deberes»— y era una segunda regla sobre lo mismo,
  // escrita peor: Ordena las Pelotas ES el bucle `board` del modo en vivo (§26,
  // la única plantilla que lo declara), así que le quitaba el botón de En vivo
  // hasta en «Mis actividades», donde funcionaba. Lo de «no se manda de
  // deberes» ya lo dice `modes.async: false` en la propia plantilla.
  const strip = conModos ? modeStripHtml(a, { includeManage: true, authed }) : '';
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
    : `<div class="acard-preview"${bg ? ` style="background:${bg}"` : ''}${playablePreview ? ` data-play="${id}" role="button" title="Jugar"` : ''}>
        ${homePreviewHtml(a)}
        ${pagesBadge}
      </div>`;
  const listStrip = `<button class="act-mode mode-list" data-mode="list" data-id="${id}" title="Jugar lista">
        <i class="bi bi-play-fill"></i> Jugar</button>`;
  return `
    <article class="acard" data-id="${id}">
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
