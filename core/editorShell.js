// Shell de editor COMPARTIDO. Antes cada plantilla armaba a mano su barra de
// pestañas, y derivaban (una sin pestañas, otra sin "Modos", nombres distintos…).
// Aquí el chasis se renderiza UNA vez para todas: título/subtítulo + pestañas
//   Contenido · Puntuación · Modos (Individual + VS + Equipos + Tarea) · En vivo · Presentación
// y cada plantilla aporta SOLO sus paneles propios. Así es imposible que un
// editor "haga lo suyo" u olvide un modo: todos heredan el mismo esqueleto.
//
// spec = {
//   content:  { label, html(a), wire(root, a, ctx) }        // obligatorio
//   rules:    { label?, html(a), wire(root, a, ctx) } | null // sección Individual DENTRO de Modos
//   scoring:  { html(a), wire(root, a, ctx) } | null          // "Puntuación"
//   live:     { html(a), wire(root, a, ctx) } | null          // "En vivo" (si meta.modes.live)
//   presentation: bool (def. true)                            // skin + fondo
// }
// ctx = { onChange, repaint }  — repaint() re-renderiza todo (para alta/baja de ítems).
//
// El CHASIS y nada más: título/subtítulo, qué pestañas hay, qué panel va en cada
// una y el repintado. Los dos paneles que no son un formulario más viven aparte
// (core/editorPresentacion.js · core/editorIA.js), igual que Puntuación y En vivo
// (core/editorPanels.js) o el bloque de tiempo (core/editorPrimitives.js).
import { html, escapeHtml, mount } from './html.js';
import { on } from './events.js';
import { getTemplate } from './registry.js';
import { modesForTemplate } from './modes.js';
import { renderModesTab, wireModesTab } from './editorModes.js';
import { scoringPanelHtml, wireScoringPanel, livePanelHtml, wireLivePanel } from './editorPanels.js';
import { presentationHtml, wirePresentacion } from './editorPresentacion.js';
import { iaBotonHtml, wireIA } from './editorIA.js';
import { revisarActividad, sinEscribirNada } from './activityCheck.js';
import { tiempoBloqueHtml, wireTiempoBloque } from './editorPrimitives.js';
/**
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('./registry.js').PlantillaRegistrada} PlantillaRegistrada
 */

/**
 * Lo que el chasis le presta a cada panel de plantilla: avisar del cambio y
 * repintar el editor entero (alta/baja de ítems).
 * @typedef {Object} EditorCtx
 * @property {(activity: Activity) => void} onChange
 * @property {() => void} repaint
 */

/**
 * UN PANEL de plantilla dentro del chasis: su rótulo, su HTML y su cableado.
 * @typedef {Object} EditorPanel
 * @property {string} [label]
 * @property {(activity: Activity) => string} html
 * @property {(root: Element, activity: Activity, ctx: EditorCtx) => void} [wire]
 */

/**
 * LO QUE APORTA UNA PLANTILLA al chasis compartido. `content` es lo único
 * obligatorio; `scoring` y `live` los pone el chasis si la plantilla no los
 * declara, y `presentation: false` quita la pestaña de skin/fondo.
 * @typedef {Object} EditorSpec
 * @property {EditorPanel} content
 * @property {EditorPanel|null} [rules]
 * @property {EditorPanel|null} [scoring]
 * @property {EditorPanel|null} [live]
 * @property {boolean} [presentation]
 */

/**
 * Una pestaña del chasis, ya resuelta.
 * @typedef {Object} EditorTab
 * @property {string} id
 * @property {string} label
 * @property {string} [icon]
 * @property {() => string} body
 */

/** El aviso de «aquí no hay nada todavía, empieza por esto». Se pinta SOLO con
 *  la actividad vacía; en cuanto hay un elemento, desaparece sin dejar hueco.
 *  Qué cuenta como «nada escrito» lo decide core/activityCheck.js: el editor y
 *  el jugador tenían cada uno su criterio y discrepaban. */
/** @param {PlantillaRegistrada|null|undefined} T @param {Activity} a */
function primerPasoHtml(T, a) {
  const paso = T?.meta?.editor?.primerPaso;
  if (!paso) return '';
  // Con contenido GENERADO (Ordena las Pelotas) no hay «estado vacío» que
  // detectar: la plantilla siempre trae un tablero, así que la pista no marca
  // un principio sino que ORIENTA — qué se puede tocar aquí. Se queda puesta.
  if (!T?.meta?.editor?.generado && !sinEscribirNada(a)) return '';
  return `<div class="alert alert-info d-flex align-items-start gap-2 py-2">
    <i class="bi bi-lightbulb mt-1"></i><div>${escapeHtml(paso)}</div></div>`;
}

/** LO QUE FALTA, EN ROJO (decisión del dueño, 2026-08-14). Mientras la
 *  actividad no esté lista se ve AQUÍ, no al llegar a la clase y descubrir que
 *  no hay nada que arrastrar. Con el primer paso ya puesto (actividad recién
 *  empezada) no se repite el sermón: ahí la pista azul basta. */
/** @param {Activity} a */
function faltaHtml(a) {
  const rev = revisarActividad(a);
  if (rev.vacia) return '';            // la pista azul del primer paso ya lo dice
  if (rev.listo) {
    return `<div class="alert alert-success d-flex align-items-center gap-2 py-2 mb-3">
      <i class="bi bi-check-circle-fill"></i><div>Lista para jugar.</div></div>`;
  }
  return `<div class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-3">
    <i class="bi bi-exclamation-triangle-fill mt-1"></i>
    <div><b>Falta${rev.problemas.length === 1 ? '' : 'n'} ${rev.problemas.length} dato${rev.problemas.length === 1 ? '' : 's'} para poder jugarla:</b>
      <ul class="mb-0 mt-1 ps-3">${rev.problemas.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    </div></div>`;
}

/** Repinta el panel de «lo que falta» y marca el título en rojo si está vacío.
 *  Se llama en cada tecla: la revisión es pura y barata (recorre el contenido
 *  en memoria), y un aviso que solo se actualiza al repintar miente justo
 *  mientras el profe escribe, que es cuando lo está mirando. */
/** @param {Element} root @param {Activity} a */
function refrescarFalta(root, a) {
  const caja = /** @type {HTMLElement|null} */ (root.querySelector('#ww-falta'));
  const nuevo = faltaHtml(a);
  // Solo se escribe si CAMBIA. Tecleando la palabra número 30 de la pregunta 12
  // el panel dice exactamente lo mismo, y reescribirlo reparsea su HTML y
  // ensucia el layout de toda la pestaña en cada letra.
  if (caja && caja.dataset.ww !== nuevo) { caja.innerHTML = nuevo; caja.dataset.ww = nuevo; }
  const titulo = root.querySelector('#f-title');
  // La regla del título la calcula el revisor: escrita otra vez aquí ya
  // discrepaba (sin `trim()`, « Sin título » pasaba por bueno).
  if (titulo) titulo.classList.toggle('is-invalid', revisarActividad(a).faltaTitulo);
}

/**
 * @param {Element} root
 * @param {Activity} a
 * @param {(activity: Activity) => void} onChange
 * @param {EditorSpec} spec
 */
export function renderEditorShell(root, a, onChange, spec) {
  const T = getTemplate(a.template);
  // PANELES POR DEFECTO (core/editorPanels.js). "Puntuación" existía en 5 de 13
  // plantillas y "En vivo" SOLO en Quiz, aunque SIETE declaran `modes.live` y
  // sus datos (`a.scoring.mode`, `a.live.*`) los leen el motor y el marcador en
  // todas por igual: era funcionalidad ausente, no un adorno. Ahora el chasis
  // los pone y la plantilla solo los DECLARA si necesita otra cosa.
  /** @type {EditorSpec & {scoring: EditorPanel, live: EditorPanel}} */
  const paneles = {
    ...spec,
    scoring: spec.scoring || { html: scoringPanelHtml, wire: wireScoringPanel },
    live: spec.live || { html: livePanelHtml, wire: wireLivePanel },
  };
  // De aquí abajo manda `paneles`: el spec de la plantilla ya está completado.
  const liveOn = !!T?.meta?.modes?.live && !!paneles.live;
  // "Modos" aparece si la plantilla soporta VS/Equipos/Tarea (En vivo va aparte)
  // O si hay un bloque Individual (paneles.rules). Individual es la primera sección.
  const hasModes = modesForTemplate(T).some(m => ['vs', 'teams', 'task'].includes(m.id));
  const showModes = hasModes || !!paneles.rules;
  const presOn = paneles.presentation !== false;

  // Pestañas en orden fijo. id = el data-bs-target; cada una se incluye solo si
  // su contenido existe (Contenido y Presentación según spec).
  /** @type {EditorTab[]} */
  const tabs = /** @type {EditorTab[]} */ ([
    { id: 'tab-content', label: paneles.content.label || 'Contenido',
      // EL ESTADO VACÍO ENSEÑA (R-D · plan del editor). Las actividades dejan de
      // nacer con contenido de muestra —había que borrarlo antes de empezar— y
      // lo que ocupa su sitio es la frase que la plantilla DECLARA en
      // `meta.editor.primerPaso`. Va aquí y no en cada editor: así todas dicen
      // qué hacer primero sin que ninguna se acuerde de ponerlo.
      body: () => primerPasoHtml(T, a) + iaBotonHtml(T) + '<div id="ww-falta">' + faltaHtml(a) + '</div>' + paneles.content.html(a) },
    paneles.scoring && { id: 'tab-scoring', label: 'Puntuación', body: () => paneles.scoring.html(a) },
    showModes && { id: 'tab-modes', label: 'Juego', icon: 'bi-controller', body: () => {
      // UNA SOLA SECCIÓN «Individual». Aquí se pintaba el bloque de la plantilla
      // con su título y `renderModesTab` pintaba OTRO igual justo debajo: dos
      // rótulos idénticos, seguidos, sin nada que dijera en qué se diferencian.
      // Ahora el shell pone el título una vez y avisa a la pestaña de que ya está;
      // las opciones del modo en solitario caen dentro de esa misma sección.
      // EL TIEMPO, PRIMERO Y SIEMPRE. Lo pinta el SHELL a partir de lo que la
      // plantilla declara (`meta.play.reloj`), no cada editor: así el reloj
      // existe en TODAS las que lo admiten y en el mismo sitio. Antes lo ponía
      // quien se acordaba —4 de 13— y el cronómetro estaba en otra pestaña.
      const tiempo = tiempoBloqueHtml(a, getTemplate(a.template));
      const indiv = paneles.rules ? `
        <section class="ww-mode-cfg" data-mode="individual">
          <h6 class="mb-1"><i class="bi bi-person-fill text-success"></i> ${escapeHtml(paneles.rules.label || 'Individual')}</h6>
          ${paneles.rules.html(a)}
        </section>` : '';
      const resto = hasModes ? renderModesTab(a, { yaHayTituloIndividual: !!paneles.rules }) : '';
      return tiempo + indiv + resto;
    }},
    liveOn && { id: 'tab-live', label: 'En vivo', icon: 'bi-broadcast', body: () => paneles.live.html(a) },
    presOn && { id: 'tab-pres', label: 'Presentación', icon: 'bi-palette', body: () => presentationHtml(a) },
  ].filter(Boolean));

  function repaint() { render(); }
  const ctx = { onChange, repaint };

  function render() {
    // LA PESTAÑA ABIERTA SOBREVIVE AL REPINTADO. `repaint()` re-renderiza el
    // editor entero (es lo que permite dar de alta y baja ítems sin cablear
    // parches), y marcaba SIEMPRE activa la primera: añadir una pregunta desde
    // «Contenido» no se notaba, pero tocar cualquier cosa desde «Juego» o
    // «Presentación» te echaba a la primera pestaña. Se recuerda cuál estaba
    // abierta y se vuelve a ella; si esa pestaña ya no existe (una plantilla
    // que deja de ofrecer «En vivo»), manda la primera, como antes.
    const abierta = root.querySelector?.('.nav-link.active')?.getAttribute('data-bs-target');
    let activo = tabs.findIndex(t => `#${t.id}` === abierta);
    if (activo < 0) activo = 0;
    mount(root, html`
      <div class="ww-editor">
        <div class="row g-2 mb-3">
          <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title || '')}"></div>
          <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
        </div>
        <ul class="nav nav-tabs" role="tablist">
          ${tabs.map((t, i) => `<li class="nav-item"><button class="nav-link ${i === activo ? 'active' : ''}" data-bs-toggle="tab" data-bs-target="#${t.id}">${escapeHtml(t.label)}${t.icon ? ` <i class="bi ${t.icon}"></i>` : ''}</button></li>`).join('')}
        </ul>
        <div class="tab-content border border-top-0 p-3 rounded-bottom">
          ${tabs.map((t, i) => `<div class="tab-pane fade ${i === activo ? 'show active' : ''}" id="${t.id}">${t.body()}</div>`).join('')}
        </div>
      </div>`);

    // Common wiring (título/subtítulo, Modos, Presentación).
    on(root, 'input', '#f-title', (_, el) => { a.title = /** @type {HTMLInputElement} */ (el).value; onChange(a); });
    on(root, 'input', '#f-subtitle', (_, el) => { a.subtitle = /** @type {HTMLInputElement} */ (el).value; onChange(a); });
    if (showModes) wireModesTab(root, a, onChange);
    if (presOn) wirePresentacion(root, a, onChange);
    // «Escribir con IA»: el chasis solo le da sitio; la puerta es de core/editorIA.js.
    wireIA(root, a, T, ctx);
    // Template-specific wiring.
    paneles.content.wire?.(root, a, ctx);
    // «Lo que falta» se recalcula con CADA tecla y cada cambio del editor. Los
    // handlers de las plantillas llaman a onChange pero NO repintan (repintar
    // en cada letra movería el cursor), así que sin esto el panel rojo se
    // quedaría contando errores ya corregidos — que es peor que no tenerlo.
    // Por `on()` (core/events.js) y NO con addEventListener: `render()` se
    // re-ejecuta en cada repaint sobre la misma raíz, así que un listener crudo
    // se APILA —21 copias tras 20 «Añadir pregunta», y 21 revisiones por tecla—.
    // `on()` es idempotente por (raíz, evento, selector); para eso existe.
    on(root, 'input', () => refrescarFalta(root, a));
    on(root, 'change', () => refrescarFalta(root, a));
    refrescarFalta(root, a);
    wireTiempoBloque(root, a, ctx);
    paneles.rules?.wire?.(root, a, ctx);
    paneles.scoring?.wire?.(root, a, ctx);
    if (liveOn) paneles.live.wire?.(root, a, ctx);
  }

  render();
}

