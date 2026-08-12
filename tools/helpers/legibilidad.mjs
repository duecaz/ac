// EL MEDIDOR DE LEGIBILIDAD — uno solo, para las dos redes que lo usan (§3c).
//
// Lo comparten `tools/matrix-smoke.mjs` (presupuesto §29: «se lee a 3 m») y
// `tools/contrast-torture.mjs` (las 70 combinaciones tema × fondo). Nació
// copiado: la tortura forkeó el medidor de la matriz para poder resolver el
// lienzo DECLARADO, y las dos copias empezaron a divergir el mismo día — la
// corrección se aplicaba a una y la otra seguía ciega. Aquí vive una vez.
//
// Se EXPORTA UNA FUNCIÓN, no un texto: cada herramienta la mete en su
// `page.evaluate` con `(${medirLegibilidad})(...)`, así que tiene que ser
// AUTOCONTENIDA — nada de imports ni de variables del módulo, porque al otro
// lado solo llega su código fuente.

/**
 * Mide, dentro de una raíz del DOM, el peor contraste y el texto más pequeño.
 *
 * @param {string} raizSel   dónde mirar el CONTRASTE (el marco entero: un texto
 *                           ilegible lo es igual si es del juego o del chrome).
 * @param {string|null} cajaSel  dónde mirar el TAMAÑO (la caja de la ronda), o
 *                           null si esta pasada no juzga tamaños.
 * @param {object} opts
 * @param {Record<string,string>} [opts.colorBases]  clase `bg-X` → hex del lienzo
 *   DECLARADO (`BACKGROUNDS[x].colorBase`). Es la pieza que faltaba: al subir por
 *   los padres, un degradado no tiene color computado, así que sin esto las 10
 *   texturas del proyecto se contaban como «no medibles» — los fondos llevaban
 *   meses sin vigilancia. Con el mapa, el lienzo se resuelve por lo declarado.
 * @param {boolean} [opts.hayBootstrap=true]  si su hoja NO cargó (aquí el CDN
 *   está bloqueado), los elementos cuyo relleno pinta Bootstrap salen
 *   transparentes y medirlos daría un falso ilegible. Se cuentan aparte y quien
 *   llama lo DICE, en vez de dar un veredicto sobre una página que no es la real.
 * @returns {{minPct:number, peorTexto:string, peorRatio:number, peorC:string,
 *            sinMedir:number, sinBootstrap:number, n:number}}
 */
export function medirLegibilidad(raizSel, cajaSel, opts) {
  const { colorBases = {}, hayBootstrap = true } = opts || {};
  const DE_BOOTSTRAP = ['bg-secondary', 'bg-primary', 'bg-info', 'bg-success', 'bg-danger', 'bg-warning', 'bg-dark', 'bg-light'];
  const raiz = document.querySelector(raizSel) || document.body;
  const caja = (cajaSel && document.querySelector(cajaSel)) || raiz;
  const alto = raiz.getBoundingClientRect().height || 800;

  const rgba = (c) => {
    const m = String(c).match(/[\d.]+/g) || [];
    if (m.length < 3) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length >= 4 ? +m[3] : 1 };
  };
  const hexRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  // EL LIENZO REAL. Dos cosas que la primera versión hacía mal y que la hacían
  // MENTIR — un medidor que miente es peor que no medir:
  //  · un fondo semitransparente (`rgba(16,185,129,.18)`) se tomaba como sólido:
  //    la palabra encontrada de la Sopa daba 1,0:1 cuando son 2,4:1. Ahora se
  //    COMPONE el alfa sobre lo que hay debajo.
  //  · un degradado o una imagen no tienen color computado: se caía al blanco y
  //    el título del Crucigrama —letra blanca sobre degradado OSCURO— salía como
  //    1,0:1. Ahora eso NO se juzga… salvo que el lienzo esté DECLARADO.
  const lienzoDe = (el) => {
    const capas = [];
    let base = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a === 1) { base = c; break; } }
      const declarado = [...n.classList].map(k => colorBases[k]).find(Boolean);
      if (declarado) { base = hexRgb(declarado); break; }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   // textura ajena: no se juzga
    }
    if (!base) base = { r: 255, g: 255, b: 255 };                             // el lienzo, si nadie más pinta
    for (let i = capas.length - 1; i >= 0; i--) {
      const c = capas[i];
      base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) };
    }
    return base;
  };
  // Solo NODOS DE TEXTO propios y visibles: el contenedor de un botón no cuenta,
  // cuenta el que pinta las letras.
  const conTexto = (raizEl) => [...raizEl.querySelectorAll('*')].filter((el) => {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) return false;
    const r = el.getBoundingClientRect();
    return !!(r.width && r.height);
  });

  let minPct = 100, peorTexto = '', peorRatio = 21, peorC = '', sinMedir = 0, sinBootstrap = 0, n = 0;
  // TAMAÑO: solo dentro de la caja de la ronda.
  if (cajaSel) {
    for (const el of conTexto(caja)) {
      const pct = ((parseFloat(getComputedStyle(el).fontSize) || 0) / alto) * 100;
      if (pct < minPct) { minPct = pct; peorTexto = el.textContent.trim().slice(0, 24); }
    }
  }
  // CONTRASTE: sobre TODO el texto visible del marco.
  for (const el of conTexto(raiz)) {
    if (!hayBootstrap && DE_BOOTSTRAP.some(c => el.classList.contains(c))) { sinBootstrap++; continue; }
    const fondo = lienzoDe(el);
    const tinta = rgba(getComputedStyle(el).color);
    if (!fondo || !tinta) { sinMedir++; continue; }
    const l1 = lum(tinta), l2 = lum(fondo);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    n++;
    if (ratio < peorRatio) { peorRatio = ratio; peorC = el.textContent.trim().slice(0, 28); }
  }
  return { minPct, peorTexto, peorRatio, peorC, sinMedir, sinBootstrap, n };
}
