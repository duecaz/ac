// Background system. Independent axis from skins.
//   - skin = colors + sounds (per-activity, applied in player)
//   - background = visual texture (pizarra verde, corcho, …)
// The combo lets a textured canvas coexist with any skin's color palette.
// Backgrounds are CSS-only (class on body); no JS-rendered canvas — EXCEPT
// 'custom', whose image travels in the activity (presentation.backgroundImage)
// and is applied as an inline CSS var so it can be any teacher-uploaded photo.
//
// Heavier backgrounds (interactive whiteboard, IR pen) will live in
// optional modules under core/canvas/ that load lazily — this stays small.
import { uploadMedia } from './upload.js';
import { escapeHtml } from './html.js';
import { QUOTAS } from './quotas.js';

// Whitelist para la imagen de fondo. La ÚNICA fuente legítima es la subida
// (readBackgroundImage → data-URL base64 raster). Un JSON importado o una
// actividad pública forkeada puede traer un `backgroundImage` arbitrario; si se
// interpola en HTML/CSS sin validar, un payload como
//   x')><img src=x onerror=...>
// rompe el atributo `style` y ejecuta script en el navegador del PROFESOR (que
// tiene el token PB en localStorage). Este whitelist solo admite data-URLs de
// imagen base64 (sin comillas ni `<`/`>` posibles en el cuerpo), así que
// neutraliza la inyección de raíz. Rechaza SVG en texto (data:image/svg+xml,…)
// a propósito: su cuerpo es XML con comillas/`<` y rompería el atributo.
export function isSafeBgImage(url) {
  return typeof url === 'string'
    && /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(url);
}

// EL FONDO DECLARA SU LEGIBILIDAD (§3 · plan de temas y fondos, 2026-08-12).
// Un fondo pone el LIENZO; el tema pone la PALETA. Para que el texto suelto
// sobre el lienzo se lea sin que cada fondo invente su propio CSS, cada uno
// declara aquí:
//
//   ink        la tinta legible sobre su textura. Se aplica como `--ww-bg-ink`
//              (una sola regla en backgrounds.css la consume) en vez de un
//              `color: #f5f5dc` repetido por fondo. Ausente = el fondo NO manda
//              tinta y el texto se queda con la del tema.
//   colorBase  el sólido representativo de la textura, en su punto MÁS
//              desfavorable para `ink` (la parada más clara de un degradado
//              oscuro, y al revés). Existe para poder VERIFICAR el contraste:
//              sin él la comprobación headless no puede medir nada, porque un
//              degradado no tiene color computado (por eso la matriz llevaba
//              meses contando estos fondos como «no medibles»).
//   plate      true = sobre esta textura NINGUNA tinta plana es fiable, así que
//              el texto va sobre una PLACA con los tokens de tarjeta del tema.
//              Ausente = false: se declara solo quien la pide.
//              Hoy solo la foto del profe: es la única cuyo lienzo no podemos
//              conocer ni medir. Los demás tienen su ink verificada en CI
//              (`tests/contrast.test.mjs`).
//
// Un fondo nuevo que no declare (ink + colorBase) o plate rompe CI: la
// legibilidad se DECIDE al añadirlo, no se descubre con la clase delante.
export const BACKGROUNDS = {
  none:       { label: 'Ninguno',      description: 'Sin fondo.' },   // el lienzo es el del TEMA
  greenboard: { label: 'Pizarra verde',description: 'Pizarra escolar verde.',
                ink: '#f5f5dc', colorBase: '#1f5135' },
  grid:       { label: 'Cuadrícula',   description: 'Hoja cuadriculada.',
                ink: '#1f2937', colorBase: '#fafafa' },
  corkboard:  { label: 'Corcho',       description: 'Tablero de corcho.',
                ink: '#1f2937', colorBase: '#c8985a' },
  classroom:  { label: 'Aula',         description: 'Pared de aula cálida.',
                ink: '#1f2937', colorBase: '#efe2c4' },
  arena:      { label: 'Arena',        description: 'Escenario de concurso.',
                ink: '#e2e8f0', colorBase: '#0c1530' },
  custom:     { label: 'Mi imagen',    description: 'Sube tu propia foto.', plate: true }
};

const ALL_CLS = Object.keys(BACKGROUNDS).map(k => `bg-${k}`);

// target=null applies globally (body); target=Element scopes the bg to that
// element only (e.g. the player frame). The two paths are independent — a
// scoped apply NEVER touches <body> and vice versa — so a textured embed can't
// leak its background onto the page chrome.
//
// imageUrl is only consulted for the 'custom' background: it's a data-URL (or
// any URL) painted via the --ww-bg-image inline var so each activity can carry
// its own photo without a dedicated CSS class.
export function applyBackground(name, target = null, imageUrl = null) {
  const valid = name in BACKGROUNDS ? name : 'none';
  const def = BACKGROUNDS[valid];
  const el = target || document.body;
  el.classList.remove(...ALL_CLS, 'bg-inked', 'bg-plated', 'bg-set');
  el.classList.add(`bg-${valid}`);
  // EL FONDO ELEGIDO GANA AL TEMA. Un tema puede pintar el lienzo (el estudio de
  // TV Show lo hace) y su hoja se carga DESPUÉS de backgrounds.css: con la misma
  // especificidad ganaba el tema y la textura que el profe había elegido no se
  // veía — pedías «Papel» y salía el plató. `bg-set` sube la especificidad de la
  // textura elegida por encima de la del tema, sin depender del orden de carga.
  // Con `none` NO se pone: ahí el lienzo ES el del tema, que es lo correcto.
  if (valid !== 'none') el.classList.add('bg-set');
  // La legibilidad sale del MANIFEST, no de una regla por fondo: `bg-inked`
  // enciende la tinta declarada y `bg-plated` el lienzo de placa. Así un fondo
  // nuevo elige su modo declarándolo y no escribiendo CSS.
  if (def.ink) {
    el.classList.add('bg-inked');
    el.style.setProperty('--ww-bg-ink', def.ink);
  } else {
    el.style.removeProperty('--ww-bg-ink');
  }
  if (def.plate) el.classList.add('bg-plated');
  if (valid === 'custom' && isSafeBgImage(imageUrl)) {
    el.style.setProperty('--ww-bg-image', `url("${imageUrl}")`);
  } else {
    el.style.removeProperty('--ww-bg-image');
  }
}

// Cap on uploaded background images. They travel inside the activity JSON
// (presentation.backgroundImage) as a data-URL, so keep it modest.
// El número vive en core/quotas.js (§25: los límites del sistema son UNO), donde
// lo comparte con el dibujo de «Etiqueta el diagrama» — el mismo tipo de uso.
export const BG_IMAGE_MAX_BYTES = QUOTAS.canvasImageBytes;

// Read a File into a data-URL. Va por core/upload.js (COMPRIME antes de
// rebotar): una foto de móvil entra reescalada; el fondo cubre el marco,
// así que su lado máximo es mayor que el de una imagen inline.
export async function readBackgroundImage(file) {
  if (!file) throw new Error('No se eligió ninguna imagen.');
  return uploadMedia(file, { maxBytes: BG_IMAGE_MAX_BYTES, ladoMax: QUOTAS.canvasImageSide });
}

export function listBackgrounds() {
  return Object.entries(BACKGROUNDS).map(([name, b]) => ({ name, ...b }));
}

// Tiny preview tile (used in the editor picker). For 'custom' it shows the
// uploaded image when present, otherwise an "upload" affordance.
export function backgroundPreviewHtml(name, imageUrl = '') {
  const b = BACKGROUNDS[name] || BACKGROUNDS.none;
  // El ALTO no va aquí: en línea gana a todo y dejaba el preview incrusteable
  // en cualquier rejilla (la página de jugar lo quiere a 16:10 y pequeño). El
  // valor de siempre vive ahora en styles/backgrounds.css, donde se puede
  // sobrescribir por contexto.
  const style = 'width:100%;border-radius:6px;border:1px solid #dee2e6';
  if (name === 'custom') {
    // url() en comillas SIMPLES: el atributo style va en comillas dobles, así que
    // anidar dobles rompía el atributo (bug de render además del de seguridad).
    // isSafeBgImage garantiza que `safe` no contiene comillas ni HTML.
    const safe = isSafeBgImage(imageUrl) ? imageUrl : '';
    const inner = safe
      ? `background:center/cover no-repeat url('${safe}')`
      : 'display:flex;align-items:center;justify-content:center;background:#f1f3f5;color:#868e96';
    return `<div class="ww-bg-preview bg-custom" style="${style};${inner}">${safe ? '' : '<i class="bi bi-upload"></i>'}</div>
            <small class="d-block text-center mt-1">${escapeHtml(b.label)}</small>`;
  }
  return `<div class="ww-bg-preview bg-${name}" style="${style}"></div>
          <small class="d-block text-center mt-1">${escapeHtml(b.label)}</small>`;
}
