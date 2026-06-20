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

function firstText(a) {
  const c = a.content || {};
  if (Array.isArray(c.items) && c.items.length) {
    const i = c.items[0];
    return i.question || i.text || i.term || i.front || '';
  }
  if (Array.isArray(c.entries) && c.entries.length)
    return typeof c.entries[0] === 'string' ? c.entries[0] : '';
  if (Array.isArray(c.pairs) && c.pairs.length)
    return c.pairs[0].term || c.pairs[0].front || '';
  return '';
}

function fillWrapped(ctx, text, x, y, maxW, lineH, maxLines = 2) {
  const words = text.split(' ');
  let line = '', lc = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = words[i]; y += lineH; lc++;
      if (lc >= maxLines - 1) {
        const more = i < words.length - 1;
        ctx.fillText(more ? `${words[i]}…` : words[i], x, y);
        return;
      }
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x, y);
}

// Generates a 480×300 JPEG thumbnail blob for the given activity.
export function generatePreview(activity) {
  return new Promise(resolve => {
    const W = 200, H = 125;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const T     = getTemplate(activity.template);
    const hex   = BS5[T?.meta?.color || 'secondary'] || BS5.secondary;
    const label = T?.meta?.label || activity.template || 'Actividad';
    const count = activityItemCount(activity);
    const first = firstText(activity);

    // Background: color → darker
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, hex);
    bg.addColorStop(1, hexDarken(hex, 0.38));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Bottom scrim for text contrast
    const scrim = ctx.createLinearGradient(0, H * 0.28, 0, H);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // Top-left: template label
    ctx.font = 'bold 9px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(label.toUpperCase(), 8, 16);

    // Top-right: item count
    ctx.font = '9px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`${count} elem.`, W - 8, 16);
    ctx.textAlign = 'left';

    // Title
    ctx.font = 'bold 16px system-ui,sans-serif';
    ctx.fillStyle = '#fff';
    fillWrapped(ctx, activity.title || 'Sin título', 8, 68, W - 16, 20, 2);

    // First-item excerpt
    if (first) {
      ctx.font = '9px system-ui,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      fillWrapped(ctx, first, 8, 106, W - 16, 13, 2);
    }

    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.65);
  });
}
