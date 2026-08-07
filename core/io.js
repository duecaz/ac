// Import / export activities as JSON. Used for backup, sharing between
// accounts, and seeding example libraries.
//
// Wire format (versioned at the wrapper level so we can evolve it):
//   { format: 'ww-activities', version: 1, exportedAt, activities: [Activity, ...] }
import { list, save, get } from './storage.js';
import { migrate, newActivityId } from './migrate.js';
import { isSafeBgImage } from './backgrounds.js';

const FORMAT = 'ww-activities';
const FORMAT_VERSION = 1;

export function exportActivities(ids = null) {
  const all = ids ? ids.map(id => get(id)).filter(Boolean) : list();
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    activities: all
  };
}

export function downloadActivitiesJson(ids = null, filename = null) {
  const payload = exportActivities(ids);
  const fname = filename || (ids?.length === 1
    ? `ww-${slug(payload.activities[0]?.title || 'actividad')}.json`
    : `ww-actividades-${dateTag()}.json`);
  const blob = new Blob(['﻿' + JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, fname);
}

// Reads a File or string, returns { ok, count, errors }.
// strategy: 'duplicate' (always new id), 'preserve' (keep id, may overwrite local).
export async function importActivitiesJson(input, { strategy = 'duplicate' } = {}) {
  const text = typeof input === 'string' ? input : await input.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON inválido: ' + e.message], count: 0 }; }

  // Rechaza un wrapper de una versión de formato FUTURA: su contenido podría
  // tener un esquema que `migrate` (forward-only) normalizaría mal en silencio.
  if (parsed?.format === FORMAT && Number(parsed.version) > FORMAT_VERSION) {
    return { ok: false, count: 0, errors: [`Formato v${parsed.version} más nuevo que el soportado (v${FORMAT_VERSION}). Actualiza la app.`] };
  }

  let activities = [];
  if (parsed?.format === FORMAT && Array.isArray(parsed.activities)) activities = parsed.activities;
  else if (Array.isArray(parsed)) activities = parsed;
  else if (parsed?.id && parsed?.template) activities = [parsed]; // single
  else return { ok: false, errors: ['Formato no reconocido.'], count: 0 };

  const errors = [];
  let count = 0, skipped = 0;
  for (const raw of activities) {
    try {
      const a = migrate(raw);
      if (strategy === 'duplicate') {
        a.id = newActivityId();
        a.updatedAt = new Date().toISOString();
      }
      // P1-5: en 'preserve' NO re-sellar updatedAt. Si ya existe una copia local
      // con updatedAt >= la importada, un backup VIEJO NO debe machacar lo nuevo:
      // se omite. (Con 'duplicate' siempre es copia nueva, no aplica.)
      if (strategy === 'preserve') {
        const existing = get(a.id);
        if (existing && (existing.updatedAt || '') >= (a.updatedAt || '')) { skipped++; continue; }
      }
      // Sanea un backgroundImage no confiable (JSON de terceros): si no es un
      // data-URL de imagen válido, lo descarta para no propagar el vector XSS.
      if (a.presentation?.backgroundImage && !isSafeBgImage(a.presentation.backgroundImage)) {
        a.presentation.backgroundImage = '';
        if (a.presentation.background === 'custom') a.presentation.background = 'none';
      }
      const { remote } = save(a, { keepUpdatedAt: strategy === 'preserve' });
      remote.catch(() => {}); // surfacing handled at caller level
      count++;
    } catch (e) {
      errors.push(`"${raw?.title || raw?.id || '?'}": ${e.message}`);
    }
  }
  return { ok: errors.length === 0, count, skipped, errors };
}

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'actividad';
}
function dateTag() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
/** Descarga un texto como fichero. El trío blob→<a>→click()→revokeObjectURL
 *  estaba copiado en cuatro sitios (io, hostLive, reports, assignments), cada
 *  uno con su propio retardo de revoke. Aquí una vez. */
export function downloadText(filename, mime, text, { bom = true } = {}) {
  triggerDownload(new Blob([(bom ? '\ufeff' : '') + text], { type: `${mime};charset=utf-8` }), filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Convenience: trigger a hidden file input and call onLoaded with parsed result.
export function pickAndImport({ strategy = 'duplicate' } = {}, onResult) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = await importActivitiesJson(f, { strategy });
    onResult?.(r);
  };
  input.click();
}
