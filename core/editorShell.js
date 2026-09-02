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
import { html, escapeHtml, mount } from './html.js';
import { on } from './events.js';
import { getTemplate, listTemplates } from './registry.js';
import { modesForTemplate } from './modes.js';
import { renderModesTab, wireModesTab } from './editorModes.js';
import { listSkins, skinPreviewHtml, applySkin } from './skins.js';
import { scoringPanelHtml, wireScoringPanel, livePanelHtml, wireLivePanel } from './editorPanels.js';
import { listBackgrounds, backgroundPreviewHtml, applyBackground, readBackgroundImage, BG_IMAGE_MAX_BYTES } from './backgrounds.js';
import { abrirBuscadorImagenes } from './imageSearchModal.js';
import { revisarActividad, sinEscribirNada } from './activityCheck.js';
import { creditoTexto } from './imageSearch.js';
import { QUOTAS } from './quotas.js';
import { tiempoBloqueHtml, wireTiempoBloque } from './editorPrimitives.js';
import { iaSabeEscribir, fusionarContenido, MODELOS_IA } from './aiContent.js';
import { toast } from './toast.js';

function presentationHtml(a) {
  const cs = a.presentation?.skin || 'default';
  const cb = a.presentation?.background || 'none';
  return `
    <div class="mb-4">
      <div id="pres-preview" class="ww-player-frame rounded-3 p-3 d-flex align-items-center gap-2" style="height:72px;max-width:260px;">
        <div class="d-flex gap-1">
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-1)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-2)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-3)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-4)"></span>
        </div>
        <span class="small fw-semibold" style="color:var(--ww-fg)">Vista previa</span>
      </div>
    </div>
    <h6 class="mb-2">Skin (colores y sonidos)</h6>
    <div class="d-flex flex-wrap gap-3 mb-4">
      ${listSkins().map(s => `
        <div class="ww-skin-tile skin-pick ${cs === s.name ? 'is-active' : ''}" data-name="${s.name}" role="button">
          ${skinPreviewHtml(s.name)}
          <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
        </div>`).join('')}
    </div>
    <h6 class="mb-2">Fondo</h6>
    <div class="d-flex flex-wrap gap-3">
      ${listBackgrounds().map(b => b.name === 'custom'
        ? `<div class="ww-skin-tile bg-pick ${cb === 'custom' ? 'is-active' : ''}" data-name="custom" role="button" style="width:120px">
             ${backgroundPreviewHtml('custom', a.presentation?.backgroundImage || '')}
             <label class="btn btn-sm btn-outline-secondary w-100 mt-1" style="cursor:pointer" title="Máx 800 KB">
               <i class="bi bi-upload"></i> ${a.presentation?.backgroundImage ? 'Cambiar' : 'Subir'}
               <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="bg-custom-file" hidden>
             </label>
             <button type="button" class="btn btn-sm btn-outline-secondary w-100 mt-1" id="bg-custom-search">
               <i class="bi bi-search"></i> Buscar
             </button>
           </div>`
        : `<div class="ww-skin-tile bg-pick ${cb === b.name ? 'is-active' : ''}" data-name="${b.name}" role="button" style="width:120px">
             ${backgroundPreviewHtml(b.name)}
             <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
           </div>`).join('')}
    </div>
    <div class="text-danger small mt-2" id="bg-custom-err" hidden></div>`;
}

/** «ESCRIBIR CON IA» — una puerta más para llenar la actividad, junto al
 *  «+ Añadir» de siempre. Vive AQUÍ, en el chasis, y no en cada editor: la IA
 *  escribe por MODELO DE CONTENIDO, así que las once plantillas cuyo modelo sabe
 *  escribir lo heredan sin tocar ninguna (§0 · la plantilla DECLARA su modelo).
 *  Ordena las Pelotas genera sus tableros sola y Etiqueta el diagrama necesita
 *  una imagen: en esas dos no sale el botón, que es lo correcto — una opción que
 *  no puede funcionar no se ofrece. Plan: docs/handoff-ia-contenido.md */
function iaBotonHtml(T) {
  const modelo = T?.meta?.contentModel;
  if (!iaSabeEscribir(modelo)) return '';
  return `<div class="ww-ia-puerta mb-3">
    <button type="button" class="btn btn-primary" id="ww-ia-go"
            title="La IA propone ${escapeHtml(MODELOS_IA[modelo].etiqueta)}; tú decides si entran">
      <i class="bi bi-stars"></i> Escribir con IA
    </button>
    <span class="text-muted small">Escribe ${escapeHtml(MODELOS_IA[modelo].etiqueta)} sobre el tema que le digas.
      Lo verás antes de añadirlo y podrás quitar las que no quieras. Lo que ya has escrito no se toca.</span>
  </div>`;
}

/** El aviso de «aquí no hay nada todavía, empieza por esto». Se pinta SOLO con
 *  la actividad vacía; en cuanto hay un elemento, desaparece sin dejar hueco.
 *  Qué cuenta como «nada escrito» lo decide core/activityCheck.js: el editor y
 *  el jugador tenían cada uno su criterio y discrepaban. */
function primerPasoHtml(T, a) {
  const paso = T?.meta?.editor?.primerPaso;
  if (!paso) return '';
  // Con contenido GENERADO (Ordena las Pelotas) no hay «estado vacío» que
  // detectar: la plantilla siempre trae un tablero, así que la pista no marca
  // un principio sino que ORIENTA — qué se puede tocar aquí. Se queda puesta.
  if (!T.meta.editor.generado && !sinEscribirNada(a)) return '';
  return `<div class="alert alert-info d-flex align-items-start gap-2 py-2">
    <i class="bi bi-lightbulb mt-1"></i><div>${escapeHtml(paso)}</div></div>`;
}

/** LO QUE FALTA, EN ROJO (decisión del dueño, 2026-08-14). Mientras la
 *  actividad no esté lista se ve AQUÍ, no al llegar a la clase y descubrir que
 *  no hay nada que arrastrar. Con el primer paso ya puesto (actividad recién
 *  empezada) no se repite el sermón: ahí la pista azul basta. */
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
function refrescarFalta(root, a) {
  const caja = root.querySelector('#ww-falta');
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

export function renderEditorShell(root, a, onChange, spec) {
  const T = getTemplate(a.template);
  // PANELES POR DEFECTO (core/editorPanels.js). "Puntuación" existía en 5 de 13
  // plantillas y "En vivo" SOLO en Quiz, aunque SIETE declaran `modes.live` y
  // sus datos (`a.scoring.mode`, `a.live.*`) los leen el motor y el marcador en
  // todas por igual: era funcionalidad ausente, no un adorno. Ahora el chasis
  // los pone y la plantilla solo los DECLARA si necesita otra cosa.
  const paneles = {
    ...spec,
    scoring: spec.scoring || { html: scoringPanelHtml, wire: wireScoringPanel },
    live: spec.live || { html: livePanelHtml, wire: wireLivePanel },
  };
  spec = paneles;
  const liveOn = !!T?.meta?.modes?.live && !!spec.live;
  // "Modos" aparece si la plantilla soporta VS/Equipos/Tarea (En vivo va aparte)
  // O si hay un bloque Individual (spec.rules). Individual es la primera sección.
  const hasModes = modesForTemplate(T).some(m => ['vs', 'teams', 'task'].includes(m.id));
  const showModes = hasModes || !!spec.rules;
  const presOn = spec.presentation !== false;

  // Pestañas en orden fijo. id = el data-bs-target; cada una se incluye solo si
  // su contenido existe (Contenido y Presentación según spec).
  const tabs = [
    { id: 'tab-content', label: spec.content.label || 'Contenido',
      // EL ESTADO VACÍO ENSEÑA (R-D · plan del editor). Las actividades dejan de
      // nacer con contenido de muestra —había que borrarlo antes de empezar— y
      // lo que ocupa su sitio es la frase que la plantilla DECLARA en
      // `meta.editor.primerPaso`. Va aquí y no en cada editor: así las 13 dicen
      // qué hacer primero sin que ninguna se acuerde de ponerlo.
      body: () => primerPasoHtml(T, a) + iaBotonHtml(T) + '<div id="ww-falta">' + faltaHtml(a) + '</div>' + spec.content.html(a) },
    spec.scoring && { id: 'tab-scoring', label: 'Puntuación', body: () => spec.scoring.html(a) },
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
      const indiv = spec.rules ? `
        <section class="ww-mode-cfg" data-mode="individual">
          <h6 class="mb-1"><i class="bi bi-person-fill text-success"></i> ${escapeHtml(spec.rules.label || 'Individual')}</h6>
          ${spec.rules.html(a)}
        </section>` : '';
      const resto = hasModes ? renderModesTab(a, { yaHayTituloIndividual: !!spec.rules }) : '';
      return tiempo + indiv + resto;
    }},
    liveOn && { id: 'tab-live', label: 'En vivo', icon: 'bi-broadcast', body: () => spec.live.html(a) },
    presOn && { id: 'tab-pres', label: 'Presentación', icon: 'bi-palette', body: () => presentationHtml(a) },
  ].filter(Boolean);

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
    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    if (showModes) wireModesTab(root, a, onChange);
    if (presOn) {
      // Initialize the mini preview scoped to its own element — never touches the page.
      const prev = root.querySelector('#pres-preview');
      const applyPrevBg = () => {
        const p = root.querySelector('#pres-preview');
        if (p) applyBackground(a.presentation?.background || 'none', p, a.presentation?.backgroundImage);
      };
      if (prev) {
        applySkin(a.presentation?.skin || 'default', prev);
        applyPrevBg();
      }
      on(root, 'click', '.skin-pick', (_, b) => {
        (a.presentation = a.presentation || {}).skin = b.dataset.name; onChange(a);
        root.querySelectorAll('.skin-pick').forEach(x => x.classList.toggle('is-active', x === b));
        const p = root.querySelector('#pres-preview');
        if (p) applySkin(b.dataset.name, p);
      });
      on(root, 'click', '.bg-pick', (_, b) => {
        // The custom tile selects only once an image exists; otherwise its
        // "Subir" button (below) opens the file dialog and selects on success.
        if (b.dataset.name === 'custom' && !a.presentation?.backgroundImage) return;
        (a.presentation = a.presentation || {}).background = b.dataset.name; onChange(a);
        root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === b));
        applyPrevBg();
      });
      // Custom background upload — read → validate size → store in the activity.
      // SUBIR y BUSCAR terminan en el mismo sitio: la única diferencia es de
      // dónde sale el data-URL (y que la búsqueda trae además su crédito).
      const ponerFondo = (dataUrl, atribucion = null) => {
        a.presentation = a.presentation || {};
        a.presentation.backgroundImage = dataUrl;
        a.presentation.background = 'custom';
        // El crédito viaja CON el píxel (§24: campo declarado del contenido) o
        // se borra al cambiar de imagen — atribuir la foto anterior es peor que
        // no atribuir.
        if (atribucion) a.presentation.backgroundImageCredit = atribucion;
        else delete a.presentation.backgroundImageCredit;
        onChange(a);
        // Update the custom tile in place (avoid a full repaint that would
        // bounce the user off the Presentación tab).
        const tile = root.querySelector('.bg-pick[data-name="custom"]');
        const pv = tile?.querySelector('.ww-bg-preview');
        if (pv) { pv.style.background = `center/cover no-repeat url("${dataUrl}")`; pv.innerHTML = ''; }
        root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === tile));
        applyPrevBg();
        const errEl = root.querySelector('#bg-custom-err');
        if (errEl) {
          errEl.hidden = !atribucion;
          errEl.className = atribucion ? 'text-muted small mt-2' : 'text-danger small mt-2';
          errEl.textContent = atribucion ? `Imagen de ${creditoTexto(atribucion)}` : '';
        }
      };
      const bgFile = root.querySelector('#bg-custom-file');
      if (bgFile) bgFile.addEventListener('change', async (e) => {
        const errEl = root.querySelector('#bg-custom-err');
        try {
          ponerFondo(await readBackgroundImage(e.target.files[0]));
        } catch (err) {
          if (errEl) { errEl.className = 'text-danger small mt-2'; errEl.textContent = err.message; errEl.hidden = false; }
          e.target.value = '';
        }
      });
      root.querySelector('#bg-custom-search')?.addEventListener('click', async () => {
        const elegido = await abrirBuscadorImagenes({
          maxBytes: BG_IMAGE_MAX_BYTES, ladoMax: QUOTAS.canvasImageSide,
          consulta: a.title && a.title !== 'Sin título' ? a.title : '',
        });
        if (elegido) ponerFondo(elegido.url, elegido.atribucion);
      });
    }
    // «Escribir con IA» — misma mecánica que cualquier «+ Añadir»: se mete en
    // `a.content`, se avisa y se repinta. El diálogo se carga SOLO al tocarlo
    // (import dinámico): quien no lo use no paga su descarga, y el editor sigue
    // abriendo aunque ese módulo falle.
    on(root, 'click', '#ww-ia-go', async (_, b) => {
      b.disabled = true;
      try {
        const { abrirEscribirConIA } = await import('./aiContentModal.js');
        const nuevo = await abrirEscribirConIA({
          modelo: T?.meta?.contentModel,
          elemento: T?.meta?.editor?.elemento,
          tema: a.title || '',
          // Sopa de Letras guarda cadenas sueltas y Crucigrama fichas con pista:
          // se pide una vez (con pista) y se aplana aquí. Ver core/aiContent.js.
          palabrasComoTexto: getTemplate(a.template)?.meta?.iaPalabrasComoTexto === true,
        });
        if (!nuevo) return;                       // cerró sin aceptar
        // LA PLANTILLA REMATA LO QUE LA IA NO PUEDE SABER. `adoptContent` es el
        // mismo gancho que usa la conversión entre plantillas, y aquí hace falta
        // por lo mismo: el modelo escribe el CONTENIDO (`{palabra, pista}`) pero
        // no dónde va cada palabra en la rejilla del crucigrama. Sin este paso
        // el crucigrama decía «No hay palabras configuradas» con la lista llena.
        // El shell sigue sin conocer plantillas (§0): pregunta, no decide.
        const fusionado = fusionarContenido(a.content, nuevo);
        a.content = T?.adoptContent ? T.adoptContent(fusionado, T?.meta?.contentModel) : fusionado;
        onChange(a);
        repaint();
      } catch (e) {
        // R6: el botón no puede quedarse mudo. Si el módulo no carga (red, caché
        // a medias), se dice — no se deja al profe tocando algo que no responde.
        toast('No se pudo abrir el asistente: ' + e.message, 'danger', 6000);
      } finally { b.disabled = false; }
    });
    // Template-specific wiring.
    spec.content.wire?.(root, a, ctx);
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
    spec.rules?.wire?.(root, a, ctx);
    spec.scoring?.wire?.(root, a, ctx);
    if (liveOn) spec.live.wire?.(root, a, ctx);
  }

  render();
}

