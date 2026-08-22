// NORMA EJECUTABLE — "un solo scorer por plantilla", también en el modo Individual.
//
// La norma llevaba tiempo escrita en CLAUDE.md y se cumplía en los MODOS (todos
// puntúan vía T.scoreSubmission), pero el PLAYER SOLO de cuatro plantillas
// llevaba su propia aritmética en paralelo: match (ppc·aciertos − ppw·fallos),
// diagram (copia de match), crossword (solvedIds × ppc, con el scorer real como
// stub jamás invocado) y memory (sin scorer, sumando con applyPoints). Dos
// verdades para la misma pregunta: el día que una cambie, Individual y VS/Equipos
// dan números distintos — exactamente el bug que QA reportó en Tildes/Comas.
//
// Aquí se fija: los PARÁMETROS de puntuación (pointsPerCorrect/pointsPerWrong) los
// lee el SCORER, nunca el player; y toda plantilla con scorer.js lo usa de verdad.
//
// Run: node tests/scoringSources.test.mjs
import assert from 'node:assert';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TPL = join(ROOT, 'templates');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const templates = readdirSync(TPL).filter(d => existsSync(join(TPL, d, 'template.js')));
assert.ok(templates.length >= 13, `se esperaban ≥13 plantillas, hay ${templates.length}`);

// Quita comentarios (una regla sobre CÓDIGO no debe dispararse por una nota).
const code = (p) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ── 1. Ningún player lee los parámetros de puntuación ────────────────────────
{
  const offenders = [];
  for (const t of templates) {
    for (const file of ['player.js', 'play.js']) {
      const p = join(TPL, t, file);
      if (!existsSync(p)) continue;
      const src = code(p);
      const hit = src.match(/pointsPer(Correct|Wrong)/);
      if (hit) {
        const line = src.slice(0, hit.index).split('\n').length;
        offenders.push(`templates/${t}/${file}:${line} — lee ${hit[0]}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    'los parámetros de puntuación los consume el SCORER (core/scoring), nunca el player:\n      ' + offenders.join('\n      '));
  ok(`${templates.length} plantillas: ningún player lee pointsPerCorrect/pointsPerWrong`);
}

// ── 2. Si la plantilla tiene scorer.js, su player lo usa ─────────────────────
// Excepciones DOCUMENTADAS (no silenciosas):
//   wheel / question-live — no puntúan: los puntos los da el docente a mano.
// (ballsort salió de la lista en C1: ya tiene player.js sobre el shell y usa su scorer.)
const NO_PLAYER_SCORING = new Set(['wheel', 'question-live']);
{
  const offenders = [];
  for (const t of templates) {
    if (NO_PLAYER_SCORING.has(t)) continue;
    if (!existsSync(join(TPL, t, 'scorer.js'))) continue;
    const p = join(TPL, t, 'player.js');
    if (!existsSync(p)) continue;
    const src = code(p);
    // Su propio scorer, o el de otra plantilla (globos reusa el de quiz), o el
    // runner compartido de texto (tildes/comas) que ya envuelve el scorer central.
    const usesScorer = /from\s+'\.\/scorer\.js'/.test(src)
      || /from\s+'\.\.\/[\w-]+\/scorer\.js'/.test(src)
      || /textCorrectionRound\.js'/.test(src);
    if (!usesScorer) offenders.push(`templates/${t}/player.js`);
  }
  assert.deepStrictEqual(offenders, [],
    'estas plantillas tienen scorer.js pero su player no lo usa (¿aritmética propia?):\n      ' + offenders.join('\n      '));
  ok('toda plantilla con scorer.js lo usa en su player (excepciones documentadas: ' + [...NO_PLAYER_SCORING].join(', ') + ')');
}

// ── 3. Los scorers salen de la fórmula común (core/scoring) ─────────────────
{
  const offenders = [];
  for (const t of templates) {
    const p = join(TPL, t, 'scorer.js');
    if (!existsSync(p)) continue;
    const src = code(p);
    // ballsort tiene una escala propia 0-1000 DELIBERADA (decisión P5 del
    // handoff de puntuación): se permite, pero debe seguir siendo la única.
    if (t === 'ballsort') continue;
    if (!/from\s+'\.\.\/\.\.\/core\/scoring/.test(src) && !/core\/textMarks\.js'/.test(src)) {
      offenders.push(`templates/${t}/scorer.js`);
    }
  }
  assert.deepStrictEqual(offenders, [],
    'estos scorers no derivan sus puntos de core/scoring:\n      ' + offenders.join('\n      '));
  ok('los scorers derivan los puntos de core/scoring (salvo la escala propia de ballsort, documentada)');
}

// ── 4. El techo (maxScore) no se recalcula con una fórmula paralela ─────────
// Un "X / max" solo es honesto si numerador y denominador salen del mismo sitio.
{
  const offenders = [];
  for (const t of templates) {
    const p = join(TPL, t, 'player.js');
    if (!existsSync(p)) continue;
    const src = code(p);
    // La firma del techo hecho a mano: multiplicar por 500 (bonus por velocidad) fuera
    // de core/scoring, o construir el máximo con speedBonusMax.
    if (/\*\s*500\b/.test(src) || /speedBonusMax/.test(src)) offenders.push(`templates/${t}/player.js`);
  }
  assert.deepStrictEqual(offenders, [],
    'estos players reimplementan la fórmula del bonus por velocidad para su techo:\n      ' + offenders.join('\n      '));
  ok('ningún player reimplementa la fórmula del bonus por velocidad para calcular su techo');
}

console.log(`\nscoringSources.test: ${passed} checks passed`);
