// LA PUERTA «ESCRIBIR CON IA» DEL EDITOR: su botón y lo que pasa al aceptar lo
// que la IA propone.
//
// Vive en el chasis (core/editorShell.js) y no en cada editor: la IA escribe por
// MODELO DE CONTENIDO, así que las plantillas cuyo modelo sabe escribir la
// heredan sin tocar ninguna (§0 · la plantilla DECLARA su modelo). Aparte del
// chasis porque es una puerta ENTERA —botón, diálogo, fusión y remate de la
// plantilla—, no una fila más del formulario. Plan: docs/handoff-ia-contenido.md
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { getTemplate } from './registry.js';
import { iaSabeEscribir, fusionarContenido, MODELOS_IA } from './aiContent.js';
import { toast, TOAST_LARGO } from './toast.js';
import { mensajeDe } from './frontera.js';

/**
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('./registry.js').PlantillaRegistrada} PlantillaRegistrada
 */

/** El botón, solo donde la IA puede funcionar de verdad. Ordena las Pelotas
 *  genera sus tableros sola y Etiqueta el diagrama necesita una imagen: en esas
 *  dos no sale, que es lo correcto — una opción que no puede funcionar no se
 *  ofrece. */
/** @param {PlantillaRegistrada|null|undefined} T */
export function iaBotonHtml(T) {
  const modelo = T?.meta?.contentModel;
  if (!iaSabeEscribir(modelo ?? '')) return '';
  // `iaSabeEscribir` ya ha comprobado que la clave existe en MODELOS_IA.
  const ficha = MODELOS_IA[/** @type {keyof typeof MODELOS_IA} */ (modelo)];
  return `<div class="ww-ia-puerta mb-3">
    <button type="button" class="btn btn-primary" id="ww-ia-go"
            title="La IA propone ${escapeHtml(ficha.etiqueta)}; tú decides si entran">
      <i class="bi bi-stars"></i> Escribir con IA
    </button>
    <span class="text-muted small">Escribe ${escapeHtml(ficha.etiqueta)} sobre el tema que le digas.
      Lo verás antes de añadirlo y podrás quitar las que no quieras. Lo que ya has escrito no se toca.</span>
  </div>`;
}

/** Misma mecánica que cualquier «+ Añadir»: lo aceptado se mete en `a.content`,
 *  se avisa y se repinta. El diálogo se carga SOLO al tocarlo (import dinámico):
 *  quien no lo use no paga su descarga, y el editor sigue abriendo aunque ese
 *  módulo falle.
 * @param {Element} root
 * @param {Activity} a
 * @param {PlantillaRegistrada|null|undefined} T
 * @param {import('./editorShell.js').EditorCtx} ctx
 */
export function wireIA(root, a, T, ctx) {
  on(root, 'click', '#ww-ia-go', async (_, el) => {
    const b = /** @type {HTMLButtonElement} */ (el);
    b.disabled = true;
    try {
      // El botón solo se pinta si la plantilla declara un modelo que la IA
      // sabe escribir (`iaBotonHtml`), así que aquí siempre lo hay.
      const modelo = T?.meta?.contentModel;
      if (!modelo) return;
      const { abrirEscribirConIA } = await import('./aiContentModal.js');
      const nuevo = await abrirEscribirConIA({
        modelo,
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
      const fusionado = /** @type {import('../kernel/contracts/activity.js').ActivityContent} */ (
        fusionarContenido(a.content, nuevo) ?? a.content);
      // `adoptContent` puede decir «no tengo nada que rematar» (null): entonces
      // manda lo fusionado. Asignarlo tal cual dejaba el contenido en NULL.
      a.content = (T?.adoptContent ? T.adoptContent(fusionado, modelo) : null) ?? fusionado;
      ctx.onChange(a);
      ctx.repaint();
    } catch (e) {
      // R6: el botón no puede quedarse mudo. Si el módulo no carga (red, caché
      // a medias), se dice — no se deja al profe tocando algo que no responde.
      toast('No se pudo abrir el asistente: ' + (mensajeDe(e)), 'danger', TOAST_LARGO);
    } finally {
      // `b` estaba DESHABILITADO mientras el diálogo estuvo abierto (para que
      // no se pudiera hacer doble clic mientras cargaba el módulo): un botón
      // `disabled` no puede recibir foco, así que el `hidden.bs.modal` de
      // modalFallback.js (que se dispara ANTES de llegar aquí, dentro del
      // mismo cierre síncrono) no pudo devolvérselo — su intento fue un no-op.
      // Se reactiva primero y SOLO entonces se enfoca.
      b.disabled = false;
      b.focus();
    }
  });
}
