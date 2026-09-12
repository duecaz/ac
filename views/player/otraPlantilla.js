// «OTRA PLANTILLA» — la fila de destinos a los que esta actividad se puede
// DUPLICAR, y qué pasa al elegir uno.
//
// Sale de views/playerView.js (Fase 6 del plan de simplificar): el cálculo de
// destinos, el aviso de lo que faltará, la puerta de la cuenta, el diálogo y la
// navegación posterior estaban repartidos entre `paint()` y `wireHandlers()`.
// Es una sola cosa: llevar esta actividad a otra mecánica sin tocarla.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { getAuthUserId } from '../../core/auth.js';
import { openLoginModal } from '../loginModal.js';
import { navigate } from '../../core/router.js';
import { toast, confirmModal, TOAST_NORMAL, TOAST_ERROR, TOAST_LARGO } from '../../core/toast.js';
import { buildSwitchOptions, duplicateAsTemplate, switchWillNeed } from '../../core/switchTemplate.js';

/** @typedef {import('../../kernel/contracts/activity.js').Activity} Activity */

/**
 * Los destinos OFRECIBLES, ya con lo que quedará por completar en cada uno.
 * @param {Activity} a
 */
function destinos(a) {
  // La lista COMPLETA, la misma que el editor: las del mismo modelo (juegan
  // el contenido tal cual) y las CONVERTIBLES (la máquina de
  // kernel/content/convert.js rellena lo que falta). Antes salían solo las
  // del mismo modelo, así que desde aquí no se podía llegar a media docena
  // de plantillas que sí admiten este contenido.
  return buildSwitchOptions(a).filter(o => o.valid)
    // Lo que quedará por completar en cada destino, calculado ANTES de
    // ofrecerlo: lo que el destino necesita y el origen no guarda no se
    // inventa, y eso se dice, no se descubre al llegar.
    .map(o => ({ ...o, faltara: switchWillNeed(a, o.template.meta.name) }));
}

/**
 * La tarjeta «Otra plantilla» (vacía si no hay ningún destino).
 * @param {Activity} a
 */
export function otraPlantillaHtml(a) {
  const compat = destinos(a);
  if (!compat.length) return '';
  return `
    <div class="pp-card mb-3">
      <h6 class="text-muted text-uppercase small mb-2">Otra plantilla</h6>
      <div class="d-flex flex-wrap gap-2">
        ${compat.map(o => `
          <button class="btn btn-outline-${o.template.meta.color || 'secondary'} btn-sm tpl-switch"
                  data-name="${o.template.meta.name}" data-kind="${o.kind}"
                  data-faltara="${escapeHtml((o.faltara || []).join(' · '))}"
                  title="${o.faltara.length ? escapeHtml('Habrá que completarla: ' + o.faltara[0])
                           : (o.kind === 'direct' ? 'Mismo contenido, tal cual' : 'Adapta el contenido a esta plantilla')}">
            <i class="bi ${o.template.meta.icon}"></i> ${escapeHtml(o.template.meta.label)}
            ${o.faltara.length ? '<i class="bi bi-pencil-fill ms-1 opacity-75"></i>'
              : (o.kind === 'convert' ? '<i class="bi bi-shuffle ms-1 opacity-50"></i>' : '')}
          </button>
        `).join('')}
      </div>
      <p class="text-muted small mb-0 mt-2">Se crea una copia; esta actividad no se toca.</p>
    </div>`;
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} a
 */
export function wireOtraPlantilla(rootSel, a) {
  // OTRA PLANTILLA = DUPLICAR, no convertir en el sitio (dueño 2026-08-18;
  // opción (b) de D2, docs/decisiones-pendientes.md). Antes esto solo
  // PREVISUALIZABA —cambiaba la plantilla en pantalla y no guardaba nada—, así
  // que el dueño hacía clic, veía el juego nuevo, salía de la página y volvía
  // a encontrarse Operaciones: «ya no los convierte». Ahora convierte de
  // verdad, pero sobre una COPIA: convertir en el sitio pierde lo que la
  // plantilla destino no usa, y desde la página de jugar se toca por
  // curiosidad. El editor conserva su «Cambiar formato» destructivo, que es
  // donde uno va a propósito.
  on(rootSel, 'click', '.tpl-switch', async (_, b) => {
    // LA PUERTA SE AVISA ANTES DE CRUZARLA, y «antes» es ANTES del diálogo: la
    // copia acaba en `#/edit/:id`, que exige sesión (`requireTeacher`),
    // mientras que esta página es pública. Sin cuenta se prometía el editor,
    // se preguntaba si crear la copia, se creaba… y lo que salía era el muro
    // de acceso. Preguntar primero y cerrar después es peor que no preguntar.
    // UNA SOLA FORMA DE PEDIR LA CUENTA: el motivo (que también entra en el
    // modal, para que no tenga que recordarlo) y qué SÍ funciona sin cuenta.
    if (!getAuthUserId()) {
      const razon = 'Inicia sesión para crear actividades';
      toast(`${razon}. Jugar y entrar con PIN no necesitan cuenta.`, 'info', TOAST_NORMAL);
      openLoginModal({ reason: razon });
      return;
    }
    const name = b.dataset.name || '';
    const label = (b.textContent || '').trim();
    const faltara = (b.dataset.faltara || '').split(' · ').filter(Boolean);
    const ok = await confirmModal(
      `Se creará una copia de "${a.title || 'esta actividad'}" con la plantilla “${label}”.`
      + (b.dataset.kind === 'convert' ? ' El contenido se adapta al formato nuevo y algunos datos podrían no trasladarse.' : '')
      + ' La actividad actual no se modifica.'
      // Lo que la conversión NO puede traer se dice AQUÍ, no al llegar a una
      // pantalla que avisa de que falta algo: lo que el destino necesita y el
      // origen no guarda no se inventa — inventarlo revelaría la respuesta.
      + (faltara.length ? `\n\nDespués tendrás que completarla en el editor: ${faltara[0]}`
          + (faltara.length > 1 ? ` (y ${faltara.length - 1} cosa${faltara.length > 2 ? 's' : ''} más).` : '') : ''),
      { title: 'Duplicar como otra plantilla', okText: 'Crear la copia', cancelText: 'Cancelar' });
    if (!ok) return;
    // R6 · fallar en silencio está prohibido: si no se pudo, se dice, y el
    // motivo viene como VALOR (no como excepción, que sería un embudo por
    // donde saldría cualquier fallo técnico a la cara del profe).
    const { actividad: copia, error } = duplicateAsTemplate(a, name);
    // `copia` y `error` son las dos caras de la MISMA respuesta (una u otra):
    // se mira la copia, que es lo que se va a usar, con el motivo que venga.
    if (!copia) { toast(error ?? '', 'danger', TOAST_ERROR); return; }
    // A DONDE HAY QUE IR: si la copia queda por completar, al EDITOR. Llevarla
    // a jugar la dejaba en la pantalla de «falta algo» que el diálogo acababa
    // de anunciar — mandar a alguien a una puerta cerrada que tú mismo le has
    // descrito es peor que no avisar.
    if (faltara.length) {
      toast(`Copia creada: “${copia.title}”. Complétala y ya se puede jugar.`, 'info', TOAST_LARGO);
      navigate(`#/edit/${copia.id}`);
    } else {
      toast(`Copia creada: “${copia.title}”. La original queda intacta.`, 'success', TOAST_NORMAL);
      navigate(`#/play/${copia.id}`);
    }
  });
}
