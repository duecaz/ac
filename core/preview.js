import { getTemplate } from './registry.js';
import { activityItemCount } from './migrate.js';

const BS5 = {
  primary: '#0d6efd', success: '#198754', danger: '#dc3545',
  warning: '#ffc107', info:    '#0dcaf0', secondary: '#6c757d',
  dark:    '#212529', light:   '#adb5bd',
};

function hexDarken(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [16, 8, 0]
    .map(v => Math.max(0, Math.round(((n >> v) & 0xff) * (1 - t))).toString(16).padStart(2, '0'))
    .join('');
}

function clamp(text, max) {
  return text && text.length > max ? text.slice(0, max - 1) + '…' : (text || '');
}

function fillWrapped(ctx, text, x, y, maxW, lineH, maxLines = 2) {
  const words = String(text).split(' ');
  let line = '', lc = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = words[i]; y += lineH; lc++;
      if (lc >= maxLines - 1) {
        ctx.fillText(words[i] + (i < words.length - 1 ? '…' : ''), x, y);
        return;
      }
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Generates a 200×125 JPEG thumbnail drawn entirely on canvas —
// no uploaded images used; always looks consistent.
export function generatePreview(activity) {
  return new Promise(resolve => {
    const W = 200, H = 125;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const T     = getTemplate(activity.template);
    const hex   = BS5[T?.meta?.color || 'secondary'] || BS5.secondary;
    const dark  = hexDarken(hex, 0.42);
    const label = T?.meta?.label || activity.template || 'Actividad';
    const count = activityItemCount(activity);
    const c     = activity.content || {};
    const items = c.items || c.entries || c.pairs || c.words || [];

    // ── Background: gradient ──────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, hex);
    bg.addColorStop(1, dark);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Header bar ───────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, W, 22);

    ctx.font = 'bold 9px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(label.toUpperCase(), 7, 14);

    ctx.font = '9px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'right';
    ctx.fillText(`${count} elem.`, W - 7, 14);
    ctx.textAlign = 'left';

    // ── Title ────────────────────────────────────────────────────────
    ctx.font = 'bold 13px system-ui,sans-serif';
    ctx.fillStyle = '#fff';
    fillWrapped(ctx, activity.title || 'Sin título', 7, 40, W - 14, 16, 2);

    // ── First item content ───────────────────────────────────────────
    const first = items[0];
    if (first) {
      const q = first.question || first.text || first.term || first.front
             || (typeof first === 'string' ? first : '');
      if (q) {
        ctx.font = '9px system-ui,sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        fillWrapped(ctx, q, 7, 72, W - 14, 12, 2);
      }

      // Answer options as mini pills (quiz / multiple choice)
      const opts = first.options;
      if (Array.isArray(opts) && opts.length) {
        const cols = 2, pillH = 14, gap = 4;
        const pillW = (W - 14 - gap) / cols;
        opts.slice(0, 4).forEach((o, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const px = 7 + col * (pillW + gap);
          const py = 95 + row * (pillH + gap);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          roundRect(ctx, px, py, pillW, pillH, 3);
          ctx.fill();
          ctx.font = '8px system-ui,sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(clamp(o.text || o, 14), px + 4, py + 10);
        });
      }
    }

    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.65);
  });
}
