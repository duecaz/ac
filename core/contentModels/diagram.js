// Diagram content model: una IMAGEN de fondo + PINES a coordenadas (x,y) sobre
// ella, cada uno con su etiqueta. El alumno arrastra cada etiqueta a su pin
// (estilo Wordwall "Etiqueta el diagrama"). x/y son FRACCIONES 0..1 de la imagen
// → responsive (la posición del pin no depende del tamaño en pantalla).
//   content: { image: 'data:…', pins: [{ id, label, x, y }] }

import { rid } from '../ids.js';
export function newPin(x = 0.5, y = 0.5) { return { id: rid('pin_'), label: '', x, y }; }

export function newEmpty() {
  return { image: null, pins: [] };
}

/** ¿ESTE PIN SE PUEDE JUGAR? El player descarta los que no tienen etiqueta; el
 *  revisor los reclama. Tienen que ser LA MISMA regla o el aviso miente. */
export function pinUsable(p) {
  return !!p && !!p.id && String(p.label ?? '').trim() !== '';
}

export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.pins)) errs.push('pins must be an array');
  return errs;
}
