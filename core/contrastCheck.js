// CONTRATO DE LEGIBILIDAD — checker puro compartido (§3, plan de temas y fondos
// 2026-08-12). Mismo patrón que templateContract.js / skinContract.js: lo
// consumen DOS runners, la suite Node (`tests/contrast.test.mjs`) y el panel
// `#/admin` (grupo «Contraste»).
//
// Qué garantiza, y por qué en el ORIGEN y no solo al pintar:
//   · los colores de temas y fondos son hex conocidos → el ratio WCAG se puede
//     calcular sin navegador, al DECLARARLOS;
//   · la red headless (`tools/matrix-smoke.mjs`) mide lo pintado, pero es CIEGA
//     al lienzo: cuando encuentra un `background-image` (y las 10 texturas son
//     degradados) no puede componer el color y lo cuenta como «no medible». Los
//     fondos llevaban meses sin vigilancia por eso.
//
// Umbrales, con su motivo (no son gusto: son el papel de la ley):
//   · TEXTO CORRIDO → 4.5:1 (WCAG AA). Es el enunciado, el nombre del alumno.
//   · TEXTO GRANDE  → 3:1 (WCAG AA para ≥18.66px negrita). Es lo que hay en los
//     botones de opción y en las etiquetas: el MISMO umbral que ya usa la matriz
//     al medir «se lee a 3 m», para que no haya dos varas distintas.
import { ratio, ratioLegible, AA_TEXTO, AA_GRANDE } from './contrast.js';
import { listSkins } from './skins.js';
import { BACKGROUNDS } from './backgrounds.js';

// Pares TINTA sobre RELLENO que un tema debe garantizar. Solo se listan los que
// de verdad llevan texto encima: `--ww-accent`, `--ww-success` y `--ww-danger`
// son RELLENOS de botón que traen su propia tinta (blanca), así que compararlos
// contra el fondo de tarjeta mediría algo que nadie ve.
const PARES = [
  { tinta: '--ww-fg',        relleno: '--ww-bg',        min: AA_TEXTO,  que: 'texto de página' },
  { tinta: '--ww-fg',        relleno: '--ww-bg-soft',   min: AA_TEXTO,  que: 'texto sobre fondo suave' },
  { tinta: '--ww-card-fg',   relleno: '--ww-card-bg',   min: AA_TEXTO,  que: 'texto en tarjeta' },
  { tinta: '--ww-shape-1-fg', relleno: '--ww-shape-1',  min: AA_GRANDE, que: 'opción 1' },
  { tinta: '--ww-shape-2-fg', relleno: '--ww-shape-2',  min: AA_GRANDE, que: 'opción 2' },
  { tinta: '--ww-shape-3-fg', relleno: '--ww-shape-3',  min: AA_GRANDE, que: 'opción 3' },
  { tinta: '--ww-shape-4-fg', relleno: '--ww-shape-4',  min: AA_GRANDE, que: 'opción 4' },
];

/**
 * Verifica el contraste de UN tema.
 * @returns {string[]} problemas (vacío = cumple).
 */
export function checkSkinContrast(skin) {
  const v = skin?.cssVars || {};
  const issues = [];
  for (const p of PARES) {
    const r = ratio(v[p.tinta], v[p.relleno]);
    // Un token AUSENTE sí es un fallo (el contrato de skin exige el set
    // completo). Un token PRESENTE pero no medible —rgba, degradado— no se
    // juzga: tumbar CI por lo que no se puede medir contradiría la regla de
    // «no medir» que aplican el resto de redes. Queda para la tortura, que sí
    // ve el píxel.
    if (r == null) {
      if (v[p.tinta] == null || v[p.relleno] == null) issues.push(`${p.que}: falta ${v[p.tinta] == null ? p.tinta : p.relleno}`);
      continue;
    }
    if (r < p.min) issues.push(`${p.que}: ${ratioLegible(v[p.tinta], v[p.relleno])} (mínimo ${p.min}:1)`);
  }
  return issues;
}

/**
 * Verifica el contrato de UN fondo: o declara placa, o declara tinta + lienzo
 * medibles y con contraste suficiente.
 * @returns {string[]} problemas (vacío = cumple).
 */
export function checkBackgroundContrast(name, def) {
  const issues = [];
  if (!def) return [`fondo ${name} sin manifest`];
  if (def.plate) {
    // Con placa el texto va sobre los tokens de tarjeta del tema: el lienzo ya
    // no toca al texto, así que declarar tinta sería una promesa que nadie usa.
    if (def.ink) issues.push('con `plate:true` no debe declarar `ink` (el texto va sobre la placa)');
    return issues;
  }
  // `none` es el único sin lienzo propio: el fondo ES el del tema, que ya tiene
  // su par fg/bg verificado arriba.
  if (name === 'none') {
    if (def.ink || def.colorBase) issues.push('`none` no pinta lienzo: no debe declarar ink/colorBase');
    return issues;
  }
  if (!def.ink) issues.push('sin `ink` (o pide `plate:true`)');
  if (!def.colorBase) issues.push('sin `colorBase` (sin él no se puede medir su contraste)');
  if (def.ink && def.colorBase) {
    const r = ratio(def.ink, def.colorBase);
    if (r == null) issues.push(`ink/colorBase no medibles (${def.ink} · ${def.colorBase})`);
    else if (r < AA_TEXTO) issues.push(`tinta sobre lienzo: ${ratioLegible(def.ink, def.colorBase)} (mínimo ${AA_TEXTO}:1)`);
  }
  return issues;
}

/** Corre el contrato sobre TODOS los temas registrados. Solo los que fallan. */
export function checkAllSkinContrast() {
  return listSkins()
    .map(s => ({ name: s.name, issues: checkSkinContrast(s) }))
    .filter(r => r.issues.length);
}

/** Corre el contrato sobre TODOS los fondos. Solo los que fallan. */
export function checkAllBackgroundContrast() {
  return Object.entries(BACKGROUNDS)
    .map(([name, def]) => ({ name, issues: checkBackgroundContrast(name, def) }))
    .filter(r => r.issues.length);
}
