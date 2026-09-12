// UNA FRASE DE CORRECCIÓN, PINTADA: marcable, corregida o en mapa de calor, y
// ajustada al hueco que le toque.
//
// Es la hoja de la mecánica de Tildes y Comas (`core/textCorrectionRound.js` es
// su fachada): quien la juega es la ronda, quien la corrige es la revisión y
// quien la pagina es el runner; aquí solo se DIBUJA el texto.
//
//   kind 'tilde' → las VOCALES que pueden llevar tilde son los blancos.
//   kind 'coma'  → el HUECO entre dos palabras es el blanco.
import { escapeHtml } from './html.js';
import { isVowel, applyTilde } from './textMarks.js';
import { observeResize } from './observeResize.js';
import { heatClass } from './itemStats.js';

/** @typedef {import('../kernel/contracts/activity.js').TextMark} TextMark */
/** La marca que se corrige en esta hoja: `TextMark.kind`. @typedef {TextMark['kind']} Marca */
/** Lo que el alumno marcó y lo que la frase pedía (para pintar la corrección).
 *  @typedef {{got: Set<number>, want: Set<number>}} Reparto */

// Build the inline passage. `reveal` (optional) bakes correct/wrong/missed
// classes for a read-only answer review; otherwise targets are interactive.
// Los targets son spans limpios: solo el canvas los vuelve interactivos.
/**
 * @param {string} text
 * @param {Marca} kind
 * @param {Reparto} [reveal]
 * @returns {string}
 */
export function passageHtml(text, kind, reveal) {
  const chars = [...text];
  // ESPACIOS como texto crudo y rompible (antes era   = no-rompible, por eso
  // no cortaba la linea): las palabras quedan enteras y el texto envuelve al marco.
  /** @param {string} c */
  const ch = (c) => c === ' ' ? ' ' : `<span class="tc-ch">${escapeHtml(c)}</span>`;
  /** @param {number} pos */
  const stateCls = (pos) => {
    if (!reveal) return '';
    const got = reveal.got.has(pos), want = reveal.want.has(pos);
    if (got && want) return ' ok';
    if (got && !want) return ' bad';
    if (!got && want) return ' miss';
    return '';
  };

  if (kind === 'tilde') {
    return chars.map((c, i) => {
      if (!isVowel(c)) return ch(c);
      if (reveal) {
        const cls = stateCls(i);
        const show = (reveal.got.has(i) || reveal.want.has(i)) ? applyTilde(c) : c;
        return `<span class="tc-tap tc-vowel is-revealed${cls}">${escapeHtml(show)}</span>`;
      }
      // Modo DIBUJO: el target es un span de solo lectura; el canvas captura el
      // trazo y la zona de este span decide la marca (data-pos).
      return `<span class="tc-target tc-vowel" data-pos="${i}">${escapeHtml(c)}</span>`;
    }).join('');
  }
  // coma: el hueco existe SOLO en el límite fin-de-palabra (un carácter que no es
  // espacio y va seguido de un espacio), nunca entre letras de una palabra.
  /** @param {number} i */
  const isGap = (i) => i < chars.length - 1 && chars[i] !== ' ' && chars[i + 1] === ' ';
  return chars.map((c, i) => {
    // CORRECCIÓN: el texto tal cual (espacios normales) + la coma solo donde
    // participa (puesta o esperada). Deriva del MISMO texto+marcas: no se guarda
    // una segunda copia "con espacios/comas" que podría desincronizarse.
    if (reveal) {
      if (!isGap(i)) return ch(c);
      if (!reveal.got.has(i) && !reveal.want.has(i)) return ch(c);
      return ch(c) + `<span class="tc-tap tc-gap is-revealed${stateCls(i)}">,</span>`;
    }
    // JUEGO (dibujo): el DETECTOR es el ÚNICO separador entre palabras — se OMITE
    // el espacio literal (antes: detector + espacio = doble hueco, muy separado).
    // El detector es angosto (styles) y <wbr> conserva el corte de línea.
    if (c === ' ') return '';                          // el hueco lo aporta el detector
    if (!isGap(i)) return ch(c);                       // letra dentro de la palabra
    return ch(c) + `<span class="tc-target tc-gap" data-pos="${i}" aria-label="hueco"></span><wbr>`;
  }).join('');
}

// Ajusta el tamaño de letra para que el texto LLENE el área (sin desbordar): el
// texto se ve grande en pantalla completa y se reajusta al cambiar de tamaño
// (fullscreen, rotación). Búsqueda binaria del font-size que cabe en ancho y alto.
// Devuelve una función para detener el observador (al congelar / cambiar de frase).
/**
 * @param {HTMLElement} areaEl
 * @param {HTMLElement} passageEl
 * @returns {() => void}
 */
export function fitPassage(areaEl, passageEl) {
  const fit = () => {
    const availW = areaEl.clientWidth, availH = areaEl.clientHeight;
    if (!availW || !availH) return;
    // MEDIDA TIPOGRÁFICA, no relleno. Dos correcciones del dueño con captura:
    // el tope a secas (220px) partía el texto del móvil en líneas de dos
    // palabras gigantes, y availW/12 seguía siendo enorme en PANTALLA COMPLETA
    // (el marco a 1900px daba 158px: tres líneas de borde a borde). Con
    // availW/18 la línea conserva ~30 letras — la maqueta de referencia ronda
    // las 40 por línea — y el piso de 26px mantiene el móvil marcable a dedo.
    let lo = 16, hi = Math.max(26, Math.min(200, availW / 18)), best = 16;
    for (let i = 0; i < 13; i++) {
      const mid = (lo + hi) / 2;
      passageEl.style.fontSize = mid + 'px';
      // Cabe si el contenido no desborda el área en ninguna dirección.
      if (passageEl.scrollWidth <= availW + 1 && passageEl.scrollHeight <= availH + 1) {
        best = mid; lo = mid;
      } else {
        hi = mid;
      }
    }
    passageEl.style.fontSize = best + 'px';
    // El canvas de dibujo observa passageEl y recalcula sus zonas solo.
  };
  // ANTI-TEMBLOR (dueño, con captura): al entrar en pantalla completa el marco
  // se agranda durante varios frames y cada uno re-ajustaba la letra — las
  // palabras se reordenaban en cascada, «como si temblara». El re-ajuste espera
  // a que el tamaño se ASIENTE (dos medidas iguales con 150 ms entre ellas) y
  // reflowea UNA vez. El primer ajuste sigue siendo inmediato: al abrir la
  // ronda no hay transición que esperar.
  /** @type {ReturnType<typeof setTimeout>|null} */
  let esperando = null;
  let ultimo = '';
  const asentado = () => {
    esperando = null;
    const ahora = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (ahora !== ultimo) { ultimo = ahora; esperando = setTimeout(asentado, 150); return; }
    fit();
  };
  const stopRo = observeResize(areaEl, () => {
    ultimo = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (esperando) clearTimeout(esperando);
    esperando = setTimeout(asentado, 150);
  });
  requestAnimationFrame(fit);
  return () => { if (esperando) clearTimeout(esperando); stopRo(); };
}

// Heatmap de analítica (M5): pinta el pasaje con cada marca REQUERIDA coloreada
// por el % de la clase que la acertó (verde ≥80 · ámbar 50-79 · rojo <50), con el
// % en pequeño. `parts` = itemStat.parts de esa frase ({key:pos, pctMarked}).
// Reutiliza applyTilde para mostrar la vocal acentuada / la coma en su sitio.
/**
 * @param {string} text
 * @param {Marca} kind
 * @param {Array<{key: string|number, pctMarked?: number}>|null|undefined} parts
 * @returns {string}
 */
export function textHeatmapHtml(text, kind, parts) {
  const byPos = new Map((parts || []).map(p => [Number(p.key), p]));
  const s = String(text || '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const p = byPos.get(i);
    if (!p) { out += escapeHtml(s[i]); continue; }
    const cls = heatClass(p.pctMarked ?? 0);
    const pct = Math.round((p.pctMarked ?? 0) * 100);
    const glyph = kind === 'tilde' ? escapeHtml(applyTilde(s[i])) : escapeHtml(s[i]) + '<b class="tc-heat__coma">,</b>';
    out += `<span class="tc-heat tc-heat--${cls}" title="${pct}% de la clase acertó">${glyph}<sup class="tc-heat__pct">${pct}%</sup></span>`;
  }
  return out;
}
