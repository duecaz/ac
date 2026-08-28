// RED DE SEGURIDAD Nº5 — ¿EDITAR EL CONTENIDO ROMPE LA CLAVE DE RESPUESTA?
//
// El bug que la motivó (v1.51.337, reportado jugando en VS): en Quiz, corregir
// una errata en el texto de la opción CORRECTA dejaba la pregunta sin respuesta
// (`answer: ''`) porque la marca de "correcta" se deducía comparando TEXTOS y el
// handler mutaba el texto antes de re-deducir. A partir de ahí, cualquier
// respuesta del alumno contaba como fallo — en TODOS los modos y sin avisar.
//
// El fallo es de una CLASE que puede repetirse en cualquier plantilla: la clave
// de respuesta guardada como texto (o como posición) y re-derivada después de
// mutar aquello de lo que depende. Esta herramienta la caza a lo bruto: para
// cada plantilla monta su editor con el contenido por defecto, TECLEA en todos
// sus campos de texto (lo que hace el docente al corregir) y vuelve a preguntar
// al SCORER —única verdad— si cada ítem sigue teniendo respuesta correcta.
//
//   node tools/edit-audit.mjs
//
// Lee "puntuables antes → después": si baja, editar texto rompió la clave.
// No se teclea en el campo que ES la respuesta (cambiarlo a mano no es perder
// la clave, es cambiarla): esos selectores están en ANSWER_FIELDS.
//
// Requiere: python3 + el Chromium preinstalado (igual que matrix-smoke).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8484);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const NOISE = /net::ERR_|Failed to load resource|ERR_TUNNEL|favicon/i;
const errs = [];
page.on('pageerror', e => { const m = String(e.message).split('\n')[0]; if (!NOISE.test(m)) errs.push(m); });
await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });

const rows = await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { listTemplates } = await import('/core/registry.js');
  const { sessionItems } = await import('/kernel/content/sessionItems.js');
  const { migrate } = await import('/core/migrate.js');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [];

  // ¿Cuántos ítems tienen respuesta correcta USABLE? Se le pregunta al scorer de
  // la plantilla (nunca a una fórmula paralela): un ítem cuenta si existe algún
  // valor que dé correct=true, o si declara correct=null — no puntuable POR
  // DISEÑO (Ruleta / Pregunta en Vivo: los puntos los pone el docente).
  // Los candidatos cubren las formas de valor de los 6 modelos de contenido.
  function scorable(T, act) {
    const items = sessionItems(act);
    let ok = 0, unscorable = 0, blind = 0;
    for (const it of items) {
      const cands = [];
      if (it?.answer != null) cands.push(...(Array.isArray(it.answer) ? it.answer : [it.answer]));
      if (it?.right != null) cands.push(it.right);          // parejas
      if (it?.word != null) cands.push(it.word);            // crucigrama
      if (it?.label != null) cands.push(it.label);
      if (typeof it === 'string') cands.push(it);           // sopa de letras
      if (Array.isArray(it?.marks)) cands.push(it.marks.map(m => m.pos));  // tildes/comas
      if (it?.id != null) cands.push(it.id);                // memoria / diagrama
      cands.push(null);   // último recurso: revela el "no puntuable por diseño"
      let hit = false, isNull = false, tried = false;
      for (const v of cands) {
        try {
          const r = T.scoreSubmission({ value: v, item: it, activity: act, mode: 'solo' });
          tried = true;
          if (r?.correct === true) { hit = true; break; }
          if (r?.correct === null) isNull = true;
        } catch { /* forma de valor que esta plantilla no acepta */ }
      }
      if (hit) ok++;
      else if (isNull) unscorable++;
      else if (!tried) blind++;   // la sonda no sabe construir un valor válido
    }
    return { total: items.length, ok, unscorable, blind };
  }

  for (const T of listTemplates()) {
    const name = T.meta.name;
    const act = migrate({ id: 'aud_' + name, template: name, title: 'Aud', schemaVersion: 4,
      content: JSON.parse(JSON.stringify(T.meta.defaultContent())) });
    const before = scorable(T, act);
    document.getElementById('app').innerHTML = '<div id="ed"></div>';
    let err = null, typed = 0;
    try {
      T.renderEditor(document.getElementById('ed'), act, () => {});
      await sleep(250);
      const fields = [...document.querySelectorAll('#ed input[type="text"], #ed input:not([type]), #ed textarea')];
      const ANSWER_FIELDS = ['.it-a', '.ws-ed-word', '.cw-word'];
      for (const f of fields) {
        if (!f.value || f.disabled) continue;
        if (ANSWER_FIELDS.some(sel => f.matches(sel))) continue;
        f.value = f.value + 'X';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        typed++;
        await sleep(5);
      }
      await sleep(200);
    } catch (e) { err = String(e.message).split('\n')[0]; }
    const after = scorable(T, act);
    out.push({ name, typed, err, before, after,
      roto: (after.ok + after.unscorable) < (before.ok + before.unscorable) });
  }
  return out;
});

const fmt = (s) => `${s.ok} con clave${s.unscorable ? ` +${s.unscorable} sin clave por diseño` : ''}/${s.total}`;
console.log('EDIT-AUDIT — ¿editar el texto del contenido pierde la respuesta correcta?\n');
let bad = 0, blind = 0;
for (const r of rows) {
  const mark = r.err ? '✗ ERROR' : (r.roto ? '✗ PIERDE LA CLAVE' : '✓');
  if (r.err || r.roto) bad++;
  if (r.after.blind) blind++;
  console.log(`  ${r.name.padEnd(15)} ${String(r.typed).padStart(3)} campos · ${fmt(r.before)} → ${fmt(r.after)}   ${mark}${r.err ? ' · ' + r.err : ''}`
    + (r.after.blind ? `   (${r.after.blind} ítem(s) que la sonda no sabe puntuar)` : ''));
}
if (errs.length) console.log('\n  errores de página:', [...new Set(errs)].slice(0, 5).join(' · '));
console.log(`\n  ${rows.length - bad}/${rows.length} plantillas conservan su clave tras editar el texto.`
  + (blind ? ` (${blind} con ítems que la sonda no puntúa: su clave no es texto — ver comentario)` : ''));
try { browser.close(); } catch {}
bye(bad ? 1 : 0);
