// Memory: face-down grid; flip 2 cards; if same pair.id, stay; else flip back.
// Reuses the 'pairs' content model. The two cards of a pair show left and right.
import { BaseTemplate } from '../base.js';
import { renderMemoryPlayer } from './player.js';
import { renderMemoryEditor } from './editor.js';
import { scoreMemorySubmission } from './scorer.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { escapeHtml } from '../../core/html.js';
import { emptyHtml } from '../../core/previewKit.js';

export class MemoryTemplate extends BaseTemplate {
  static meta = {
    name: 'memory',
    label: 'Memoria',
    icon: 'bi-shuffle',
    color: 'primary',
    contentModel: 'pairs',
    templateVersion: 1,
    instructions: 'Encuentra las parejas: voltea dos cartas; si coinciden, se quedan descubiertas.',
    aspectRatio: '1/1',
    modes: { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'turns', live: 'none' },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ revealMs: 900, columns: 4 }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const id = () => 'p_' + Math.random().toString(36).slice(2, 8);
      return { pairs: [
        { id: id(), left: 'grande',   right: 'pequeño' },
        { id: id(), left: 'rápido',   right: 'lento'   },
        { id: id(), left: 'caliente', right: 'frío'    },
        { id: id(), left: 'alto',     right: 'bajo'    },
        { id: id(), left: 'bonito',   right: 'feo'     },
        { id: id(), left: 'día',      right: 'noche'   },
      ]};
    }
  };
  static renderPlayer = renderMemoryPlayer;
  static renderEditor = renderMemoryEditor;
  // Memoria no tiene renderRound (su modo Equipos usa su propio motor), pero SÍ
  // declara scorer: es la única fuente de puntos, la use el player o una ronda.
  static scoreSubmission = scoreMemorySubmission;
  static migrateContent(content) { return content; }

  // Preview de tarjeta: snapshot "partida en curso" — un par emparejado (verde),
  // una carta volteada (blanca) y el resto boca abajo con dorso de color.
  static previewHtml(act) {
    const pairs = (act.content?.pairs || [])
      .filter(p => String(p.left || '').trim() && String(p.right || '').trim());
    if (!pairs.length) return emptyHtml(act);
    const BACK = ['#e74c3c', '#e67e22', '#d4ac0d', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#c0392b'];
    const shown = pairs.slice(0, 6);
    const cards = shown.flatMap((p, i) => [{ text: p.left, pair: i }, { text: p.right, pair: i }]);
    const cols = Math.min(6, Math.max(3, act.rules?.columns || 4));
    const matched = new Set([0, 1]), open = new Set([2]);
    const sq = `aspect-ratio:1;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:800;text-align:center;padding:6px;overflow:hidden;box-sizing:border-box;`;
    const txt = `font-size:clamp(.8rem,4.5cqmin,1.7rem);line-height:1.1;overflow:hidden;`;
    const tile = (c, idx) => {
      if (matched.has(idx)) return `<div style="${sq}background:#198754;color:#fff;box-shadow:0 4px 12px rgba(25,135,84,.35)"><span style="${txt}">${escapeHtml(c.text)}</span></div>`;
      if (open.has(idx))    return `<div style="${sq}background:#fff;color:#212529;border:4px solid #6610f2;box-shadow:0 4px 12px rgba(0,0,0,.12)"><span style="${txt}">${escapeHtml(c.text)}</span></div>`;
      return `<div style="${sq}background:${BACK[idx % BACK.length]};color:rgba(255,255,255,.92);font-size:clamp(1.6rem,9cqmin,3.4rem);box-shadow:0 4px 12px rgba(0,0,0,.18)">?</div>`;
    };
    return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;gap:1.2rem;justify-content:center">
      <div class="fs-3 fw-bold text-center">${escapeHtml(act.title || 'Memoria')}</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;max-width:820px;margin:0 auto;width:100%">${cards.map(tile).join('')}</div>
    </div>`;
  }
}
