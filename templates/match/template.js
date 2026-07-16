// Match Up: two columns; tap left then right to pair. Solo + async.
import { BaseTemplate } from '../base.js';
import { renderMatchPlayer } from './player.js';
import { renderMatchEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { renderChoiceRound, shuffle } from '../../core/roundRender.js';
import { scoreMatchSubmission } from './scorer.js';
import { escapeHtml } from '../../core/html.js';
import { emptyHtml, STAGE_W, STAGE_H } from '../../core/previewKit.js';

export class MatchTemplate extends BaseTemplate {
  static meta = {
    name: 'match',
    label: 'Emparejar',
    icon: 'bi-link-45deg',
    color: 'info',
    contentModel: 'pairs',
    templateVersion: 1,
    instructions: 'Une cada elemento con su pareja arrastrando de uno al otro. Pulsa Enviar para corregir.',
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules: () => ({ timer: 0, randomize: true, livesPerMistake: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const id = () => 'p_' + Math.random().toString(36).slice(2, 8);
      return { pairs: [
        { id: id(), left: 'España',    right: 'Madrid' },
        { id: id(), left: 'México',    right: 'Ciudad de México' },
        { id: id(), left: 'Argentina', right: 'Buenos Aires' },
        { id: id(), left: 'Colombia',  right: 'Bogotá' },
      ]};
    }
  };
  static renderPlayer = renderMatchPlayer;
  static renderEditor = renderMatchEditor;
  static scoreSubmission = scoreMatchSubmission;

  // Preview de tarjeta: snapshot fiel de Emparejar — dos columnas de cuadros
  // 16/10 unidos por cuerdas (una recta + alguna cruzada).
  static previewHtml(act) {
    const pairs = (act.content?.pairs || [])
      .filter(p => (String(p.left || '').trim() || p.leftImage || p.image) &&
                   (String(p.right || '').trim() || p.rightImage))
      .slice(0, 4);
    if (!pairs.length) return emptyHtml(act);
    const N = pairs.length;
    const W = STAGE_W, H = STAGE_H, HEAD = 96, GAPY = 22;
    const cardH = Math.min(190, Math.floor((H - HEAD - 60 - (N - 1) * GAPY) / N));
    const cardW = Math.round(cardH * 16 / 10);
    const leftX = 150, rightX = W - 150 - cardW;
    const top0 = HEAD + 20;
    const cy = (i) => top0 + i * (cardH + GAPY) + cardH / 2;
    const card = (p, side, i) => {
      const x = side === 'L' ? leftX : rightX;
      const img  = side === 'L' ? (p.leftImage || p.image || null) : (p.rightImage || null);
      const text = side === 'L' ? (p.left || '') : (p.right || '');
      const dotX = side === 'L' ? x + cardW - 4 : x - 12;
      const inner = img
        ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" alt="">
           <span style="position:absolute;left:50%;bottom:9px;transform:translateX(-50%);background:rgba(17,24,39,.9);color:#fff;font-weight:700;font-size:1.05rem;padding:5px 16px;border-radius:999px;white-space:nowrap;max-width:88%;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(text)}</span>`
        : `<span style="font-weight:700;font-size:1.25rem;color:#1f2937;text-align:center;padding:6px;">${escapeHtml(text)}</span>`;
      return `<div style="position:absolute;left:${x}px;top:${top0 + i * (cardH + GAPY)}px;width:${cardW}px;height:${cardH}px;
          border:3px solid #c7d2fe;border-radius:13px;background:#fff;overflow:visible;
          display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.06);">
        ${inner}
        <span style="position:absolute;left:${dotX - x}px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:50%;background:#94a3b8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);"></span>
      </div>`;
    };
    const rights = [...pairs].reverse();
    const ROPES = ['#6366f1', '#0891b2', '#f59e0b', '#a855f7'];
    const links = [[0, 0], [1, 2], [2, 1], [3, 3]].filter(([l, r]) => l < N && r < N);
    const ropes = links.map(([l, r], i) => {
      const x1 = leftX + cardW, y1 = cy(l);
      const x2 = rightX,        y2 = cy(r);
      const mx = (x1 + x2) / 2, sag = 26;
      const col = ROPES[i % ROPES.length];
      return `<g filter="url(#mshadow)">
          <path d="M${x1},${y1} C${mx},${y1 + sag} ${mx},${y2 + sag} ${x2},${y2}" stroke="rgba(0,0,0,.2)" stroke-width="14" fill="none" stroke-linecap="round"/>
          <path d="M${x1},${y1} C${mx},${y1 + sag} ${mx},${y2 + sag} ${x2},${y2}" stroke="${col}" stroke-width="8" fill="none" stroke-linecap="round"/>
        </g>
        <circle cx="${x1}" cy="${y1}" r="9" fill="${col}"/><circle cx="${x2}" cy="${y2}" r="9" fill="${col}"/>`;
    }).join('');
    return `<div class="ww-match" style="position:absolute;inset:0;">
      <div style="position:absolute;left:40px;top:34px;background:#6c757d;color:#fff;font-weight:700;border-radius:8px;padding:4px 12px;font-size:1.05rem;">0 / ${N}</div>
      <svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
        <defs><filter id="mshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/></filter></defs>
        ${ropes}
      </svg>
      ${pairs.map((p, i) => card(p, 'L', i)).join('')}
      ${rights.map((p, i) => card(p, 'R', i)).join('')}
    </div>`;
  }

  // One pair = one matching round: prompt is the left side, options are the
  // right sides (the correct one + up to 3 distractors), shuffled. Answer-safe:
  // the payload never says which option is right.
  static getRoundPayload(activity, ctx) {
    const pairs = activity.content?.pairs || [];
    const item = pairs[ctx.itemIndex];
    if (!item || !item.right) return null;
    const answer = String(item.right);
    const others = pairs.map(p => String(p.right)).filter(r => r && r !== answer);
    const distractors = shuffle([...new Set(others)]).slice(0, 3);
    return { id: item.id, question: String(item.left), image: item.image || null,
             options: shuffle([answer, ...distractors]) };
  }

  // The matching round is a multiple-choice pick of the right side.
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  static migrateContent(content) { return content; }
}
