// Pure wheel logic — no DOM, fully testable. Extracted from player.js so the
// landing maths and the "remove after spin" handling can be verified in Node.
// Vive en core (barrido B3, 2026-09-02): pieza del BUCLE «pedir la palabra»
// (`rules.selector`), compartida por Ruleta y Abre Cajas — ver render.js.

import { azar } from '../azar.js';

const EMPTY = '(vacío)';

/** Clean entries to non-empty strings; never return an empty wheel. */
export function normalizeEntries(entries) {
  const out = (entries || []).map(e => String(e)).filter(e => e.trim());
  return out.length ? out : [EMPTY];
}

/** Random slice index in [0, count). `rnd` injectable for deterministic tests.
 *  Por defecto va por el PRIMITIVO (core/azar.js), no por `Math.random`: con el
 *  defecto anterior nadie inyectaba nunca (ni la ruleta ni Pregunta en vivo), así
 *  que sembrar el azar no llegaba aquí y la ruleta seguía siendo irreproducible
 *  para el arnés — un hueco legal en la ley, que es la peor clase de hueco. */
export function pickIndex(count, rnd = azar.random) {
  return Math.floor(rnd() * count);
}

/** Immutable remove; never collapses to an empty wheel. */
export function removeAt(entries, index) {
  const out = entries.filter((_, i) => i !== index);
  return out.length ? out : [EMPTY];
}

/** Slice label for the wheel face: truncate long text with an ellipsis. */
export function truncLabel(s, max = 16) {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
