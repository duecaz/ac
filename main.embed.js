// Embed entrypoint. Reads activity id + presentation overrides from query
// string, fetches the activity from Supabase (only public/unlisted ones
// are visible to anon thanks to RLS), and renders the player into the
// full-viewport frame. No navbar, no auth UI, no extra chrome — designed
// to live inside an external <iframe>.
//
// Query params:
//   id        required   activity id
//   skin      optional   override presentation.skin
//   bg        optional   override presentation.background
//   template  optional   render with a different (compatible) template

import { getRemote } from './core/storage.js';
import { ensureAuth } from './core/supabase.js';
import { applySkin } from './core/skins.js';
import { applyBackground } from './core/backgrounds.js';
import { runPlayer } from './core/player.js';
import { getTemplate } from './core/registry.js';

// Templates: same set as the main app. Lazy splitting can come later.
import './templates/quiz/index.js';
import './templates/wheel/index.js';
import './templates/match/index.js';
import './templates/memory/index.js';
import './templates/tildes/index.js';
import './templates/comas/index.js';

import './core/sounds.js';
import './core/effects.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const skinOverride = params.get('skin');
const bgOverride = params.get('bg');
const templateOverride = params.get('template');

(async function boot() {
  if (!id) {
    document.body.innerHTML = '<div class="alert alert-warning m-4">Falta <code>?id=</code> en la URL.</div>';
    window.__APP_READY__ = true;
    return;
  }
  try {
    await ensureAuth();
    const a = await getRemote(id);
    if (!a) {
      document.body.innerHTML = '<div class="alert alert-warning m-4">Actividad no disponible. Tal vez sea privada.</div>';
      window.__APP_READY__ = true;
      return;
    }
    // If the override template is incompatible (different contentModel),
    // ignore it and fall back to the activity's own.
    const T = templateOverride ? getTemplate(templateOverride) : null;
    const original = getTemplate(a.template);
    const useTemplate = (T && T.meta?.contentModel === original?.meta?.contentModel) ? templateOverride : a.template;

    const skin = skinOverride || a.presentation?.skin || 'default';
    const bg = bgOverride || a.presentation?.background || 'none';
    const frame = document.getElementById('ww-embed-frame');
    applySkin(skin, frame);
    applyBackground(bg, frame);

    // Title in the host page tab.
    document.title = `${a.title} · WW`;

    runPlayer('#ww-player-widget', { ...a, template: useTemplate }, { skipChrome: true });
    window.__APP_READY__ = true;
  } catch (e) {
    console.error(e);
    document.body.innerHTML = `<div class="alert alert-danger m-4"><pre>${e.stack || e.message}</pre></div>`;
    window.__APP_READY__ = true;
  }
})();
