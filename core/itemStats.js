// M3 — Agregador PURO de la analítica por ítem/parte. Sin DOM, sin red → tests
// deterministas. Recibe `items` y `template` INYECTADOS (el llamador los resuelve
// con sessionItems/getTemplate), así este módulo no arrastra dependencias.
//
// Contrato OPCIONAL de plantilla (M1):
//   template.itemParts({ item, activity })  → [{ key, label, ok }]  (partes del ítem)
//   template.valueParts({ value, item, activity }) → [key…]         (partes que marcó una respuesta)
// Sin M1 → fallback genérico: 1 parte "Acierto" por ítem, marcada si la respuesta
// fue correcta. Así TODA plantilla tiene %acierto por ítem gratis.
import { dedupeRows } from './answerRows.js';

const asKeys = (arr) => new Set((arr || []).map(k => String(k)));

function partsOf(template, item, activity) {
  const p = template?.itemParts?.({ item, activity });
  if (Array.isArray(p) && p.length) return p.map(x => ({ key: String(x.key), label: x.label ?? String(x.key), ok: !!x.ok }));
  return null; // → fallback
}

function valueKeysOf(template, value, item, activity, hasParts) {
  if (hasParts && template?.valueParts) return asKeys(template.valueParts({ value, item, activity }));
  return null; // fallback usa `correct`, no las partes
}

function itemLabel(template, item, index) {
  if (template?.itemLabel) { try { const l = template.itemLabel(item); if (l) return l; } catch {} }
  return item?.question || item?.title || item?.prompt || `Ítem ${index + 1}`;
}

// aggregate({ items, template, rows, activity })
//  → { nPlayers, items: [{ index, label, n, nCorrect, pctCorrect,
//        parts: [{ key, label, ok, nMarked, pctMarked }], extras }] }
export function aggregate({ items = [], template = null, rows = [], activity = null } = {}) {
  const deduped = dedupeRows(rows);
  const byItem = new Map();
  for (const r of deduped) {
    if (!byItem.has(r.itemIndex)) byItem.set(r.itemIndex, []);
    byItem.get(r.itemIndex).push(r);
  }
  const nPlayers = new Set(deduped.map(r => r.player)).size;

  const outItems = items.map((item, index) => {
    const ans = byItem.get(index) || [];
    const n = ans.length;
    const nCorrect = ans.filter(a => a.correct === true).length;
    // Nombres por veredicto (estilo Kahoot): quién acertó y quién falló este ítem.
    const nameOf = (a) => a.name || a.player || '?';
    const correctNames = ans.filter(a => a.correct === true).map(nameOf);
    const wrongNames = ans.filter(a => a.correct === false).map(nameOf);
    const parts = partsOf(template, item, activity);

    if (!parts) {
      // Fallback genérico: una sola "parte" = acierto del ítem.
      return {
        index, label: itemLabel(template, item, index), n, nCorrect,
        pctCorrect: n ? nCorrect / n : 0,
        parts: [{ key: 'ok', label: 'Acierto', ok: true, nMarked: nCorrect, pctMarked: n ? nCorrect / n : 0 }],
        extras: 0, correctNames, wrongNames,
      };
    }

    const partKeys = new Set(parts.map(p => p.key));
    const marked = new Map(parts.map(p => [p.key, 0]));
    let extras = 0;
    for (const a of ans) {
      const vk = valueKeysOf(template, a.value, item, activity, true) || new Set();
      for (const k of vk) {
        if (partKeys.has(k)) marked.set(k, marked.get(k) + 1);
        else extras++;
      }
    }
    const partStats = parts.map(p => ({
      key: p.key, label: p.label, ok: p.ok,
      nMarked: marked.get(p.key), pctMarked: n ? marked.get(p.key) / n : 0,
    }));
    return {
      index, label: itemLabel(template, item, index), n, nCorrect,
      pctCorrect: n ? nCorrect / n : 0, parts: partStats, extras, correctNames, wrongNames,
    };
  });

  return { nPlayers, items: outItems };
}

// Umbrales del heatmap (verde/ámbar/rojo) — compartidos por la vista y los tests,
// no números mágicos. Un pct 0..1 → clase de color.
export const HEAT = { good: 0.8, warn: 0.5 };
export function heatClass(pct) { return pct >= HEAT.good ? 'ok' : pct >= HEAT.warn ? 'warn' : 'bad'; }
