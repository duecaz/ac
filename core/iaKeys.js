// DUEÑO DE `ia_config` (§21) — las claves de la IA, y quién puede tocarlas.
//
// Existe por la ley de datos: cada colección de PocketBase tiene UN módulo
// dueño, y quien necesite algo le pide un método en vez de hacer su propio
// `fetch`. `ia_config` se había quedado sin dueño —el panel hablaba con la
// colección a pelo— y en cuanto hubo que gestionar varias claves eso ya eran
// cinco llamadas sueltas en una vista.
//
// DOS COSAS QUE NO HACE, Y SON EL MOTIVO DE TODO EL MONTAJE:
//
//   · **No trae nunca la clave.** El listado se pide con `fields=`, que filtra
//     EN EL SERVIDOR: el secreto no llega al navegador ni con el token del
//     superadmin. La versión anterior se traía el registro entero solo para
//     sacarle el id.
//   · **No llama al proveedor.** Probar una clave lo hace la Pi
//     (`POST /api/ia/probar`), que es la única que la tiene. Aquí no hay con qué.
//
// Todo pide el token de SUPERADMIN de PocketBase: las cinco reglas de
// `ia_config` son `null`, así que ni un profe con sesión la ve. Eso es lo que
// hace segura a la colección, no un adorno.
import { PB_URL } from '../pocketbase.config.js';

// Lo único que se enseña de una clave: de quién es y si está encendida.
const CAMPOS_VISIBLES = 'id,proveedor,etiqueta,activa,created';
const COL = 'ia_config';

/** Mensaje accionable a partir de una respuesta que falló (R6). */
async function motivo(r, queHacia) {
  // 404 en esta colección es SIEMPRE «todavía no existe»: el «The requested
  // resource wasn't found» de PocketBase es cierto y no sirve de nada — deja
  // mirando la clave pensando que está mal escrita.
  if (r.status === 404) {
    return new Error('Todavía no existe la colección ia_config: pulsa «Crear colecciones» y vuelve a intentarlo.');
  }
  const cuerpo = await r.json().catch(() => ({}));
  return new Error(cuerpo?.message || `Error ${r.status} al ${queHacia}.`);
}

const cabeceras = (token, conCuerpo = false) => ({
  ...(conCuerpo ? { 'Content-Type': 'application/json' } : {}),
  Authorization: token,
});

/**
 * Las claves guardadas, de la más antigua a la más nueva. SIN la clave.
 * @returns {Promise<Array<{id,proveedor,etiqueta,activa,created}>>}
 */
export async function listarClaves(token) {
  const r = await fetch(`${PB_URL}/api/collections/${COL}/records?perPage=50&sort=created&fields=${CAMPOS_VISIBLES}`,
    { headers: cabeceras(token) });
  if (!r.ok) throw await motivo(r, 'leer las claves');
  return (await r.json()).items || [];
}

/**
 * AÑADE una clave; nunca pisa las que ya están.
 * Antes se sobrescribía la fila anterior «para no acumular claves viejas», y
 * eso convertía cambiar de clave en perder la que funcionaba: si la nueva no
 * valía, no había vuelta atrás. Ahora conviven y se apaga la que sobre.
 */
export async function anadirClave(token, { proveedor = 'gemini', clave, etiqueta = '' } = {}) {
  if (!clave) throw new Error('Pega la clave.');
  const r = await fetch(`${PB_URL}/api/collections/${COL}/records`, {
    method: 'POST',
    headers: cabeceras(token, true),
    body: JSON.stringify({ proveedor, clave, etiqueta, activa: true }),
  });
  if (!r.ok) throw await motivo(r, 'guardar la clave');
  return r.json();
}

/** Enciende o apaga una clave. Apagar NO es borrar: se puede volver. */
export async function cambiarEstado(token, id, activa) {
  const r = await fetch(`${PB_URL}/api/collections/${COL}/records/${id}`, {
    method: 'PATCH',
    headers: cabeceras(token, true),
    body: JSON.stringify({ activa: !!activa }),
  });
  if (!r.ok) throw await motivo(r, activa ? 'encender la clave' : 'apagar la clave');
}

/** La borra de la Pi. No se deshace: quien llama pregunta antes. */
export async function eliminarClave(token, id) {
  const r = await fetch(`${PB_URL}/api/collections/${COL}/records/${id}`, {
    method: 'DELETE',
    headers: cabeceras(token),
  });
  if (!r.ok) throw await motivo(r, 'eliminar la clave');
}

/**
 * ¿VALE? Lo comprueba la PI, con la llamada más barata del proveedor —su lista
 * de modelos—, que no genera nada: un «probar» que costara dinero sería un botón
 * que nadie pulsa. Devuelve el veredicto y qué modelos ofrece, nunca la clave.
 * @returns {Promise<{ok:boolean, motivo:string|null, modelos:string[]}>}
 */
export async function probarClave(token, id) {
  const r = await fetch(`${PB_URL}/api/ia/probar`, {
    method: 'POST',
    headers: cabeceras(token, true),
    body: JSON.stringify({ id }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Un 404 AQUÍ no es «no existe la colección»: es que el hook no está puesto
    // en la Pi. Son dos arreglos distintos y confundirlos cuesta una tarde.
    if (r.status === 404) throw new Error('El servidor no tiene instalado el asistente de IA (falta el hook en la Pi).');
    throw new Error(cuerpo?.message || `Error ${r.status} al probar la clave.`);
  }
  return { ok: !!cuerpo.ok, motivo: cuerpo.motivo || null, modelos: cuerpo.modelos || [] };
}
