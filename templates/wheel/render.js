// Shared SVG wheel drawing — used by the wheel player and the standalone Sorteo
// classroom tool, so the wheel face lives in one place. Pure string builder.
import { escapeHtml } from '../../core/html.js';
import { truncLabel } from './logic.js';

const PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

/** Returns the spinning <svg> (slices + hub) rotated to `rotation` degrees. */
export function wheelSvg(entries, { rotation = 0, dur = 4000, spinning = false, size = 400 } = {}) {
  const r = 180, cx = 200, cy = 200;
  // Empty wheel (all options drawn): just the rim + central hub point.
  if (!entries || entries.length === 0) {
    return `<svg width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#dee2e6" stroke-width="2" stroke-dasharray="6 6"/>
      <circle cx="${cx}" cy="${cy}" r="20" fill="#fff" stroke="#000" stroke-width="2"/>
    </svg>`;
  }
  // Single option left: a full-circle arc path degenerates (start === end and
  // draws nothing), so render a solid disc that fills 100% of the wheel.
  if (entries.length === 1) {
    return `<svg width="${size}" height="${size}" style="transform:rotate(${rotation}deg);transition:transform ${spinning ? dur : 0}ms cubic-bezier(.17,.67,.21,.99)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE[0]}" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${cy - r * 0.45}" fill="#fff" font-weight="700" font-size="18" text-anchor="middle">${escapeHtml(truncLabel(entries[0]))}</text>
      <circle cx="${cx}" cy="${cy}" r="20" fill="#fff" stroke="#000" stroke-width="2"/>
    </svg>`;
  }
  const arc = (2 * Math.PI) / entries.length;
  const slices = entries.map((e, i) => {
    const a0 = -Math.PI / 2 + i * arc;
    const a1 = a0 + arc;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = arc > Math.PI ? 1 : 0;
    const labelA = a0 + arc / 2;
    const lx = cx + (r * 0.65) * Math.cos(labelA);
    const ly = cy + (r * 0.65) * Math.sin(labelA);
    const deg = (labelA * 180 / Math.PI);
    return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="2"/>
            <text x="${lx}" y="${ly}" fill="#fff" font-weight="700" font-size="14" text-anchor="middle" transform="rotate(${deg + 90} ${lx} ${ly})">${escapeHtml(truncLabel(e))}</text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" style="transform:rotate(${rotation}deg);transition:transform ${spinning ? dur : 0}ms cubic-bezier(.17,.67,.21,.99)">
    ${slices}
    <circle cx="${cx}" cy="${cy}" r="20" fill="#fff" stroke="#000" stroke-width="2"/>
  </svg>`;
}
