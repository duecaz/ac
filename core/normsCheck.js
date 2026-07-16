// Normas transversales EJECUTABLES — escáner puro de fuente JS que convierte
// las reglas de CLAUDE.md ("Estándares transversales") en checks de máquina:
//
//   · resize-observer : NUNCA `new ResizeObserver(` fuera de core/observeResize.js
//                       (un RO directo cuyo callback muta layout dispara el aviso
//                       "ResizeObserver loop…"; el helper rAF-debounced es la norma).
//   · pb-filter       : NUNCA construir `?filter=` de PocketBase con
//                       `encodeURIComponent` en la misma expresión (no escapa la
//                       comilla simple → inyección/rotura del filtro). La norma es
//                       pbEscape/pbFilterParam (core/pbFilter.js).
//   · kernel-puro     : kernel/** es el cerebro PURO y determinista: sin
//                       `Date.now()` ni `new Date()` (el reloj se inyecta vía
//                       core/clock.js; sin esto los tests dejan de ser deterministas).
//
// Lo consumen DOS runners (mismo patrón que core/templateContract.js):
//   · tests/norms.test.mjs — Node, recorre el filesystem COMPLETO (autoridad).
//   · core/selftest.js     — panel #/admin: humo del deploy sobre BROWSER_SCAN_FILES
//                            + los ficheros de plantilla derivados del registro.
const ALLOW = {
  'resize-observer': ['core/observeResize.js'],
  'pb-filter': ['core/pbFilter.js'],   // pbFilterParam usa encodeURIComponent legítimamente
  'kernel-puro': [],
};

// Comentarios fuera (mismo truco que tests/styles.test.mjs: se preservan los
// saltos de línea para que los números de línea no se corran).
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));

/**
 * Escanea UN fichero. `path` relativo a la raíz del repo (p.ej. "views/explore.js").
 * @returns {{path:string, line:number, rule:string, text:string}[]}
 */
export function scanNormsSource(path, source) {
  const out = [];
  const lines = blank(String(source || '')).split('\n');
  const allowed = (rule) => ALLOW[rule].some(a => path.endsWith(a));
  lines.forEach((ln, i) => {
    if (/new\s+ResizeObserver\s*\(/.test(ln) && !allowed('resize-observer')) {
      out.push({ path, line: i + 1, rule: 'resize-observer', text: ln.trim() });
    }
    if (/filter=/.test(ln) && /encodeURIComponent\s*\(/.test(ln) && !allowed('pb-filter')) {
      out.push({ path, line: i + 1, rule: 'pb-filter', text: ln.trim() });
    }
    if (path.startsWith('kernel/') && /(Date\.now\s*\(|new Date\s*\(\s*\))/.test(ln)) {
      out.push({ path, line: i + 1, rule: 'kernel-puro', text: ln.trim() });
    }
  });
  return out;
}

// Ficheros que el self-test del ADMIN alcanza por fetch (GitHub Pages no lista
// directorios). Los de plantilla NO van aquí: se derivan del registro en
// runtime (templates/<name>/{template,player,editor}.js). Esta lista es humo
// del deploy — la AUTORIDAD exhaustiva es tests/norms.test.mjs (recorre fs),
// así que un fichero nuevo queda cubierto por CI aunque no esté listado aquí.
export const BROWSER_SCAN_FILES = [
  'adapters/index.js',
  'adapters/local/assignments.js', 'adapters/local/realtime.js', 'adapters/local/remoteStore.js',
  'adapters/pocketbase/assignments.js', 'adapters/pocketbase/realtime.js', 'adapters/pocketbase/remoteStore.js',
  'kernel/session/engine.js', 'kernel/session/memory.js', 'kernel/live/engine.js',
  'views/adminView.js', 'views/assignments.js', 'views/editList.js', 'views/editView.js',
  'views/embedModal.js', 'views/explore.js', 'views/home.js', 'views/hostLive.js',
  'views/listView.js', 'views/memoryView.js', 'views/modeSetup.js', 'views/playerView.js',
  'views/reports.js', 'views/sorteoView.js', 'views/startScreen.js', 'views/studentLive.js',
  'views/studentTask.js', 'views/switchTemplate.js', 'views/teamsView.js',
  'views/templateSelector.js', 'views/vsView.js',
  'core/textCorrectionRound.js', 'core/textCorrectionDraw.js', 'core/activityThumb.js',
  'core/soloPlayer.js', 'core/connectRope.js', 'core/liveTransport.js',
];
