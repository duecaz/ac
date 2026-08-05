// OPCIONES DE PARTIDA — lo que el profe decide AL LANZAR, no en el editor.
//
// Reportado en clase (Ordena las Pelotas): "no hay opción de elegir si se gana
// por tiempo o por movimientos; el docente debe decidir los dos modos que tiene
// esa actividad". La opción EXISTÍA, pero vivía en el editor: para cambiarla
// había que salir del juego, abrir la actividad, cambiarla, guardar y volver —
// con la clase esperando.
//
// LA DISTINCIÓN, que hasta ahora no existía:
//   · ajuste de CONTENIDO → el editor. Cambia la actividad y se guarda (§24: el
//     contenido es del usuario).
//   · ajuste de PARTIDA   → la pantalla de inicio. Vale para ESTA vez y no toca
//     la actividad guardada. Mañana, con otro grupo, el profe elige otra cosa.
//
// Cómo se declara (`meta.play.options`), en la PLANTILLA — ninguna vista conoce
// "ballsort" ni sabe dónde guarda su modo:
//
//   options: [{
//     id: 'mode', label: 'Cómo se gana',
//     values: [{ value:'moves', label:'Menos movimientos' },
//              { value:'time',  label:'Menos tiempo' }],
//     get: (a) => a.content?.mode || 'moves',
//     set: (a, v) => { … devuelve la actividad con el valor aplicado … },
//   }]
//
// `set` es PURO: recibe una actividad y devuelve otra. Así la elección se aplica
// sobre la copia de juego y jamás sobre lo guardado.
//
// Ojo con la restricción R2 del norte ("el profe no configura nada"): esto no la
// rompe porque la opción SIEMPRE viene ya elegida —lo que diga la actividad— y
// cambiarla es un toque opcional. Una plantilla que declarase seis opciones sí
// la rompería; por eso hay un tope y lo vigila el contrato.

import { escapeHtml } from './html.js';

/** Las opciones de partida que declara una plantilla (lista, nunca null). */
export function playOptionsOf(T) {
  const raw = T?.meta?.play?.options;
  return Array.isArray(raw) ? raw : [];
}

/** El valor vigente de cada opción: lo elegido para esta partida o, si no se
 *  ha tocado, lo que traiga la actividad. */
export function currentChoices(T, activity, chosen = {}) {
  const out = {};
  for (const o of playOptionsOf(T)) {
    const suyo = chosen[o.id];
    const valido = o.values?.some(v => v.value === suyo);
    out[o.id] = valido ? suyo : safeGet(o, activity);
  }
  return out;
}

function safeGet(o, activity) {
  try { return o.get?.(activity); } catch { return undefined; }
}

/**
 * Aplica las elecciones a una COPIA de la actividad. Nunca muta la original: lo
 * que se juega es una copia (`playActivity()`), y lo guardado no se toca.
 */
export function applyPlayOptions(T, activity, chosen = {}) {
  let out = activity;
  for (const o of playOptionsOf(T)) {
    const v = chosen[o.id];
    if (v === undefined || !o.values?.some(x => x.value === v)) continue;
    if (v === safeGet(o, out)) continue;         // ya lo trae: no se toca nada
    try { out = o.set?.(out, v) ?? out; } catch { /* una opción rota no impide jugar */ }
  }
  return out;
}

/**
 * El control, UNO para todas las pantallas de lanzamiento (inicio de Individual
 * y setup de VS/Equipos). Segmentado y con la elección vigente ya marcada: no es
 * un formulario que rellenar, es un interruptor que casi nunca se toca.
 * Devuelve '' si la plantilla no declara opciones — la mayoría.
 */
export function playOptionsHtml(T, activity, chosen = {}) {
  const opts = playOptionsOf(T);
  if (!opts.length) return '';
  const vigente = currentChoices(T, activity, chosen);
  return `<div class="ww-playopts">${opts.map(o => `
    <div class="ww-playopt" data-opt="${escapeHtml(o.id)}">
      <div class="ww-playopt-label">${escapeHtml(o.label || '')}</div>
      <div class="ww-playopt-values">${(o.values || []).map(v => `
        <button type="button" class="ww-playopt-btn${v.value === vigente[o.id] ? ' is-on' : ''}"
          data-opt="${escapeHtml(o.id)}" data-value="${escapeHtml(v.value)}"
          aria-pressed="${v.value === vigente[o.id]}">
          ${v.icon ? `<i class="bi ${escapeHtml(v.icon)}"></i> ` : ''}${escapeHtml(v.label || v.value)}
        </button>`).join('')}</div>
    </div>`).join('')}</div>`;
}

/** Cablea los botones del control. `onChange(id, value)` recibe la elección; el
 *  repintado es local (no re-monta la pantalla, que perdería el foco). */
export function wirePlayOptions(rootEl, onChange) {
  const root = typeof rootEl === 'string' ? document.querySelector(rootEl) : rootEl;
  for (const btn of root?.querySelectorAll('.ww-playopt-btn') || []) {
    btn.addEventListener('click', () => {
      const { opt, value } = btn.dataset;
      for (const b of root.querySelectorAll(`.ww-playopt-btn[data-opt="${opt}"]`)) {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
      onChange?.(opt, value);
    });
  }
}
