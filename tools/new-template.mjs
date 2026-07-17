#!/usr/bin/env node
// Generador de plantilla — crea templates/<name>/ cumpliendo el contrato desde
// el primer segundo (meta completa, previewHtml, editor sobre el shell, player
// sobre los shells de solo, CSS tokenizado, GameEvents cableados) y la registra
// en core/registerTemplates.js. Su honestidad la vigila tests/newTemplate.test.mjs:
// genera en un scratch y corre los MISMOS checkers del contrato/normas — si el
// contrato crece y este generador se queda viejo, CI falla aquí.
//
//   node tools/new-template.mjs globos --label "Explota Globos" --icon bi-balloon \
//        --color danger --model qa --shell sequential [--vs] [--live] [--dry-run]
//
// Flags:
//   --model   qa | pairs | words | items | textCorrection | ballsort | diagram
//             (DEBE existir en kernel/content/models.js; para un modelo nuevo,
//             regístralo primero — el generador te dice cómo.)
//   --shell   sequential (ítem a ítem, timer/avance del shell — lo típico arcade)
//             | freeform (tablero libre, tú llamas ctx.finish()). Def: sequential.
//   --vs      añade renderRound+getRoundPayload → la actividad se ofrece en
//             VS/Equipos-auto. SIN esta flag la plantilla nace SOLO-Individual:
//             una mecánica a medio hacer nunca aparece en modos multijugador.
//   --live    declara modes.live (implica getRoundPayload + scoreSubmission).
//   --out DIR genera en DIR en vez de templates/ (para el self-test; no toca el
//             registro). --dry-run lista sin escribir.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { listModelNames } from '../kernel/content/models.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (['vs', 'live', 'dry-run'].includes(k)) flags[k] = true;
    else flags[k] = argv[++i];
  } else pos.push(a);
}
const name = pos[0];
const fail = (m) => { console.error('✗ ' + m); process.exit(1); };
if (!name) fail('uso: node tools/new-template.mjs <name> [--label ..] [--model qa] [--shell sequential] [--vs] [--live]');
if (!/^[a-z][a-z0-9-]*$/.test(name)) fail(`nombre inválido "${name}" (minúsculas, dígitos y guiones; empieza por letra)`);

const MODELS = listModelNames().filter(m => m !== 'entries');   // entries está huérfano
const model = flags.model || 'qa';
if (!MODELS.includes(model)) fail(`modelo "${model}" no registrado. Válidos: ${MODELS.join(', ')}.\n  Para un modelo NUEVO: créalo en core/contentModels/, regístralo en kernel/content/models.js\n  y añádelo a la expectativa de tests/content.test.mjs — luego vuelve a correr el generador.`);
const shell = flags.shell || 'sequential';
if (!['sequential', 'freeform'].includes(shell)) fail(`--shell debe ser sequential|freeform`);
const wantVs = !!flags.vs, wantLive = !!flags.live;

// Contenido demo JUGABLE por modelo (como las 12 reales: nunca nacen vacías).
const DEMO = {
  qa: { items: [
    { id: 'q_demo1', question: '2 + 2', answer: '4', options: ['3', '4', '5'], points: 1, image: null, audio: null },
    { id: 'q_demo2', question: 'Capital de Francia', answer: 'París', options: ['París', 'Roma', 'Berlín'], points: 1, image: null, audio: null },
  ] },
  pairs: { pairs: [
    { id: 'p_demo1', left: 'Perro', right: 'Dog' },
    { id: 'p_demo2', left: 'Gato', right: 'Cat' },
  ] },
  words: { words: ['SOL', 'LUNA', 'MAR'] },
  items: { items: [
    { id: 'it_demo1', question: 'Entrada 1', image: null },
    { id: 'it_demo2', question: 'Entrada 2', image: null },
  ] },
  textCorrection: { passages: [{ id: 'ps_demo1', text: 'Hola como estas', marks: [{ pos: 6, kind: 'tilde' }] }] },
  ballsort: { level: 'classic', mode: 'moves', random: true, items: [] },
  diagram: { image: null, pins: [] },
};
if ((wantVs || wantLive) && !['qa', 'pairs', 'words', 'items'].includes(model)) {
  fail(`--vs/--live del generador solo siembra demo jugable para qa|pairs|words|items; para "${model}" añade el contenido demo a mano tras generar.`);
}

const label = flags.label || name[0].toUpperCase() + name.slice(1);
const icon = flags.icon || 'bi-puzzle-fill';
const color = flags.color || 'primary';
// Prefijo CSS corto: iniciales de las partes del nombre ("balloon-pop"→bp) o 2 letras.
const parts = name.split('-');
const prefix = (parts.length > 1 ? parts.map(p => p[0]).join('') : name.slice(0, 2));
const Cls = parts.map(p => p[0].toUpperCase() + p.slice(1)).join('');
const fn = Cls;   // render<Cls>Player etc.
const collectionKey = Object.keys(DEMO[model])[Object.keys(DEMO[model]).length - 1]; // items/pairs/words/passages…

const outBase = flags.out ? resolve(flags.out) : join(ROOT, 'templates', name);
const isRepoTarget = !flags.out;
if (existsSync(outBase)) fail(`ya existe ${outBase} — el generador nunca pisa una carpeta`);
// Prefijo de import relativo desde la carpeta de la plantilla hasta la raíz del repo.
const REL = relative(outBase, ROOT).replaceAll('\\', '/') || '.';

const demoJson = JSON.stringify(DEMO[model], null, 2).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n');

// ── ficheros ─────────────────────────────────────────────────────────────────
const files = {};

files['template.js'] = `// ${label} — TODO: describe la mecánica en una línea.
import { BaseTemplate } from '${REL}/templates/base.js';
import { render${fn}Player } from './player.js';
import { render${fn}Editor } from './editor.js';
import { score${fn}Submission } from './scorer.js';
import { escapeHtml } from '${REL}/core/html.js';
import { emptyHtml } from '${REL}/core/previewKit.js';

export class ${Cls}Template extends BaseTemplate {
  static meta = {
    name: '${name}',
    label: '${label}',
    icon: '${icon}',              // bootstrap-icons
    color: '${color}',            // color bootstrap del botón/badge
    contentModel: '${model}',     // registrado en kernel/content/models.js
    templateVersion: 1,
    // OBLIGATORIO (contrato): frase corta de cómo se juega — la pantalla de inicio.
    instructions: 'TODO: explica en una frase cómo se juega.',
    panelFit: 'fill',             // panel VS: 'fill' (llena y escala) | 'block' | 'center'
    aspectRatio: '16/10',         // marco del player: '16/10' | '4/3' | '1/1' | 'auto'
    modes: { solo: true, live: ${wantLive}, async: true, practice: true },
    needsImageUpload: false,      // true si el editor sube imágenes (core/upload.js)
    needsAudioUpload: false,
    defaultRules:   () => ({ timer: 0, randomize: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive:    () => ({}),
    // Contenido DEMO jugable (nunca nace vacía — igual que las 12 reales).
    defaultContent: () => (${demoJson}),
  };

  static renderPlayer = render${fn}Player;
  static renderEditor = render${fn}Editor;
  static scoreSubmission = score${fn}Submission;
${wantVs || wantLive ? `
  // Payload de UNA ronda para VS/Equipos/Live — SIN la clave de respuesta.
  static getRoundPayload(activity, ctx) {
    const it = (activity.content?.${collectionKey} || [])[ctx.itemIndex];
    return it ? { ...it, answer: undefined } : null;
  }
` : ''}${wantVs ? `
  // Ronda interactiva (VS / Equipos-auto): pinta el ítem y llama onSubmit(value).
  static renderRound(root, payload, { onSubmit } = {}) {
    root.innerHTML = \`<div class="${prefix}-round"><p>\${escapeHtml(payload?.question ?? payload?.q ?? '')}</p>
      <button type="button" class="btn btn-primary ${prefix}-send">Responder</button></div>\`;
    root.querySelector('.${prefix}-send').addEventListener('click', () => onSubmit?.('TODO-valor'));
  }
` : ''}
  // Preview de tarjeta (miniatura del home) — OBLIGATORIO (contrato). Markup
  // estático de la primera pantalla; reusa los builders del player cuando puedas.
  static previewHtml(act) {
    const first = (act.content?.${collectionKey} || [])[0];
    if (!first) return emptyHtml(act);
    const text = typeof first === 'string' ? first : (first.question ?? first.q ?? first.left ?? first.text ?? '');
    return \`<div class="ww-player" style="display:flex;flex-direction:column;height:100%;justify-content:center;gap:1rem">
      <div class="fs-3 fw-bold text-center">\${escapeHtml(act.title || '${label}')}</div>
      <div class="fs-4 text-center" style="color:var(--ww-fg)">\${escapeHtml(String(text))}</div>
    </div>\`;
  }

  static migrateContent(content) { return content; }
}
`;

const playerSequential = `// ${label} — player SOLO sobre el SHELL SECUENCIAL (core/soloPlayer.js): el shell
// maneja bucle de ítems, timer, finish, trySaveResult y emite QUESTION_SHOWN/PODIUM.
// Este core solo pinta UN ítem y registra la respuesta con submit().
import { html, escapeHtml, mount } from '${REL}/core/html.js';
import { on } from '${REL}/core/events.js';
import { runSequentialPlayer } from '${REL}/core/soloPlayer.js';
import { GameEvents, emitGame } from '${REL}/core/gameEvents.js';
import { clock } from '${REL}/core/clock.js';
import { score${fn}Submission } from './scorer.js';

export async function render${fn}Player(rootSel, activity, opts = {}) {
  runSequentialPlayer(rootSel, activity, opts, {
    renderItem({ rootSel, item, idx, total, score, timerSecs, submit, startTimer }) {
      mount(rootSel, html\`
        <div class="ww-player ${prefix}-play">
          <div class="ww-phead d-flex justify-content-between align-items-center">
            <span class="badge bg-secondary">\${idx + 1} / \${total}</span>
            \${timerSecs > 0 ? \`<span class="badge bg-danger ww-timer-badge">⏱ \${timerSecs}</span>\` : ''}
            <span class="badge bg-primary">★ \${score}</span>
          </div>
          <div class="${prefix}-item">
            <p class="${prefix}-q">\${escapeHtml(item.question ?? item.q ?? item.left ?? String(item))}</p>
            <!-- TODO: tu mecánica. El botón de ejemplo registra un acierto. -->
            <button type="button" class="btn btn-success ${prefix}-ok">¡Lo tengo!</button>
          </div>
        </div>\`);

      const t0 = clock.now();
      startTimer({
        onTick: (remaining) => { const el = document.querySelector('.ww-timer-badge'); if (el) el.textContent = \`⏱ \${remaining}\`; },
        onTimeout: () => {
          emitGame(GameEvents.ANSWER_WRONG, { idx });   // ← sonidos/efectos gratis (bus)
          submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
        },
      });

      on(rootSel, 'click', '.${prefix}-ok', () => {
        const ms = clock.now() - t0;
        const r = score${fn}Submission({ value: 'TODO-valor', item, msTaken: ms, activity });
        if (r.correct) emitGame(GameEvents.ANSWER_CORRECT, { idx, points: r.points });
        else emitGame(GameEvents.ANSWER_WRONG, { idx });
        submit({ itemId: item.id, value: 'TODO-valor', correct: r.correct, points: r.points, msTaken: ms });
      });
    },
  });
}
`;

const playerFreeform = `// ${label} — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): tablero de
// una pantalla; cuando el alumno termina, llama ctx.finish({score, maxScore}).
// El shell garantiza pantalla de resultado + trySaveResult + PODIUM.
import { html, escapeHtml, mount } from '${REL}/core/html.js';
import { runFreeformPlayer } from '${REL}/core/soloPlayer.js';
import { GameEvents, emitGame } from '${REL}/core/gameEvents.js';

export async function render${fn}Player(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const total = (activity.content?.${collectionKey} || []).length || 1;

  mount(rootSel, html\`
    <div class="ww-player ${prefix}-play">
      <div class="fs-4 fw-bold text-center mb-3">\${escapeHtml(activity.title || '${label}')}</div>
      <!-- TODO: tu tablero. El botón de ejemplo termina con todo correcto. -->
      <div class="text-center"><button type="button" class="btn btn-success ${prefix}-done">Terminar</button></div>
    </div>\`);

  document.querySelector('.${prefix}-done')?.addEventListener('click', () => {
    emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: total });   // ← bus de sonidos/efectos
    ctx.finish({ title: '¡Perfecto!', lead: \`\${total} de \${total}\`, score: total, maxScore: total });
  });
}
`;

files['player.js'] = shell === 'sequential' ? playerSequential : playerFreeform;

files['scorer.js'] = `// Scorer PURO de ${label} — contrato: SIEMPRE {correct, points}.
// correct:null = ítem no puntuable (sin clave). Convención de puntos en
// core/scoreHelpers.js (puntos del ítem → config → 1; penalización con suelo).
import { basePoints, wrongPoints } from '${REL}/core/scoreHelpers.js';

export function score${fn}Submission({ value, item, msTaken, activity, mode = 'solo' }) {
  const ok = value != null;   // TODO: compara value contra la clave real del ítem
  if (ok === null) return { correct: null, points: 0 };
  const scoring = activity?.scoring || {};
  return ok
    ? { correct: true, points: basePoints(item, scoring) }
    : { correct: false, points: wrongPoints(scoring) };
}
`;

files['editor.js'] = `// Editor de ${label} — SIEMPRE sobre el SHELL (core/editorShell.js): las pestañas
// Contenido/Puntuación/Modos/En vivo/Presentación son del chasis; tú aportas
// SOLO el panel de contenido. Aquí SÍ se permiten px (es un formulario, no el juego).
import { escapeHtml } from '${REL}/core/html.js';
import { on } from '${REL}/core/events.js';
import { renderEditorShell } from '${REL}/core/editorShell.js';
import { rid } from '${REL}/core/ids.js';

export function render${fn}Editor(root, a, onChange) {
  renderEditorShell(root, a, onChange, {
    content: {
      label: 'Contenido',
      html: (act) => \`
        <p class="text-muted small">TODO: edita los ítems de tu actividad (modelo "${model}").</p>
        <pre class="bg-body-secondary p-2 rounded small">\${escapeHtml(JSON.stringify(act.content, null, 2))}</pre>
        <button type="button" class="btn btn-sm btn-outline-primary ${prefix}-add"><i class="bi bi-plus-lg"></i> Añadir ítem demo</button>\`,
      wire: (rootEl, act, ctx) => {
        on(rootEl, 'click', '.${prefix}-add', () => {
          // TODO: sustituye por tu alta real de ítems (usa rid('${collectionKey === 'pairs' ? 'p_' : collectionKey === 'passages' ? 'ps_' : collectionKey === 'words' ? 'w_' : 'it_'}')).
          ctx.onChange(act); ctx.repaint();
        });
      },
    },
  });
}
`;

files['index.js'] = `import { registerTemplate } from '${REL}/core/registry.js';
import { ${Cls}Template } from './template.js';
registerTemplate(${Cls}Template);
export { ${Cls}Template };
`;

// CSS tokenizado y relativo (contrato completo en docs/estilos-de-actividad.md).
files[`${name}.css`] = `/* ${label} — estilos del PLAYER. Contrato (docs/estilos-de-actividad.md):
   NADA con tamaño fijo (cq*/% o piso max(); un clamp con techo bajo CONGELA) y
   colores pintables por token var(--ww-*) para que los skins recoloreen. */

.${prefix}-play { display: flex; flex-direction: column; height: 100%; }
.${prefix}-item {
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2cqmin;
}
.${prefix}-q {
  font-weight: 700;
  font-size: max(1rem, 5cqmin);            /* piso legible; crece con el marco */
  color: var(--ww-card-fg, var(--ww-fg));  /* el skin lo recolorea */
  text-align: center;
}
`;

// ── escritura ────────────────────────────────────────────────────────────────
const cssTarget = isRepoTarget ? join(ROOT, 'styles', `${name}.css`) : join(outBase, `${name}.css`);
if (isRepoTarget && existsSync(cssTarget)) fail(`ya existe styles/${name}.css`);

console.log(`Plantilla "${name}" · modelo ${model} · shell ${shell}${wantVs ? ' · +VS' : ''}${wantLive ? ' · +Live' : ''}`);
const plan = Object.keys(files).filter(f => !f.endsWith('.css')).map(f => join(outBase, f));
plan.push(cssTarget);
if (flags['dry-run']) {
  console.log('— dry-run, no se escribe nada —');
  for (const p of plan) console.log('  ' + relative(ROOT, p));
  process.exit(0);
}

mkdirSync(outBase, { recursive: true });
for (const [f, content] of Object.entries(files)) {
  const target = f.endsWith('.css') ? cssTarget : join(outBase, f);
  writeFileSync(target, content);
  console.log('  ✓ ' + relative(ROOT, target));
}

if (isRepoTarget) {
  // Registro (punto único): añade el import a core/registerTemplates.js.
  const reg = join(ROOT, 'core', 'registerTemplates.js');
  const s = readFileSync(reg, 'utf8');
  if (!s.includes(`templates/${name}/index.js`)) {
    writeFileSync(reg, s.trimEnd() + `\nimport '../templates/${name}/index.js';\n`);
    console.log('  ✓ core/registerTemplates.js (import añadido)');
  }
}

console.log(`
Siguientes pasos (lo que no puedo automatizar):
  1. Añade '${name}' a la lista GAME de tests/styles.test.mjs (el ratchet lo exige).
  2. Enlaza el CSS: los HTML cargan styles/*.css — añade <link> de styles/${name}.css donde estén los demás.
  3. Rellena los TODO (mecánica del player, scorer real, editor de ítems, previewHtml fiel).
  4. node tests/run.mjs  → contrato + normas + estilos deben salir en verde.
  5. Menciona la actividad en docs/panorama-actividades.md y README.md.`);
