// RED DE SEGURIDAD Nº5 — TECLEAR EN EL EDITOR: ¿ROMPE ALGO?
//
// Dos preguntas, las dos medidas tecleando de verdad en los 13 editores y en
// TODAS sus pestañas:
//   1. ¿editar el contenido pierde la clave de respuesta? (el bug de 2026-07)
//   2. ¿teclear destruye lo que el profe está tocando? (el de 2026-09-02: el
//      campo de tiempo repintaba el editor entero, se perdía el foco y la
//      pestaña saltaba a la primera)
//
// ── 1 · ¿EDITAR EL CONTENIDO ROMPE LA CLAVE DE RESPUESTA?
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
// ── 2 · ¿TECLEAR DESTRUYE LO QUE EL PROFE ESTÁ TOCANDO?
//
// Un `repaint()` colgado de un `input` re-renderiza el editor entero: el campo
// pierde el foco a mitad de palabra y la pestaña vuelve a la primera. Cada
// pieza funcionaba; el defecto vivía en la costura, así que se MIDE —foco y
// pestaña antes y después de cada tecla, incluida una espera larga para el
// repintado diferido—. La red se comprobó en las dos direcciones: con los tres
// defectos reales puestos otra vez, 10 de 13 plantillas salen en rojo.
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
    const roba = [], salta = [];
    try {
      T.renderEditor(document.getElementById('ed'), act, () => {});
      await sleep(250);
      // Los NUMÉRICOS entran también. Quedaban fuera del barrido, y el defecto
      // que abrió esta segunda mitad vivía justo ahí: el campo «Tiempo por
      // pregunta» es `type="number"`. Una red que no mira donde pasó no es red.
      const SEL = '#ed input[type="text"], #ed input[type="number"], #ed input:not([type]), #ed textarea';
      const ANSWER_FIELDS = ['.it-a', '.ws-ed-word', '.cw-word'];
      // Teclear en un numérico es teclear un DÍGITO: pegarle una «X» lo deja en
      // blanco (el navegador rechaza el valor) y la sonda mediría otra cosa.
      const teclear = (f) => { f.value = f.type === 'number' ? String((+f.value || 0) * 10 % 1000 || 3) : f.value + 'X'; };
      const editable = (f) => f.value && !f.disabled && !ANSWER_FIELDS.some(sel => f.matches(sel));
      // LA SEGUNDA PREGUNTA DE ESTA SONDA (2026-09-02): teclear no puede
      // DESTRUIR lo que el profe está tocando. Escribir «30» en el campo de
      // tiempo repintaba el editor entero: el campo perdía el foco y la pestaña
      // saltaba a la primera.
      //
      // Y SE RECORREN TODAS LAS PESTAÑAS. La primera versión de esta red se
      // quedó en «Contenido» —la que ya está abierta— y dio verde con el
      // defecto puesto a propósito: un campo de una pestaña oculta no coge el
      // foco, y volver a la primera pestaña no se nota si nunca saliste de
      // ella. Medir donde no pasó el fallo es no medir.
      const pestana = () => document.querySelector('#ed .nav-link.active')?.getAttribute('data-bs-target') || '';
      const marca = (f) => f.id ? `#${f.id}` : (f.className || f.tagName).split(' ')[0];
      const solapas = [...document.querySelectorAll('#ed .nav-link')];
      for (const solapa of solapas.length ? solapas : [null]) {
        if (solapa) { solapa.click(); await sleep(60); }
        const mia = pestana();
        const fields = [...document.querySelectorAll(SEL)]
          .filter(f => !mia || f.closest('.tab-pane')?.id === mia.slice(1));
        for (const f of fields) {
          if (!editable(f)) continue;
          f.focus();
          const teniaFoco = document.activeElement === f;
          teclear(f);
          f.dispatchEvent(new Event('input', { bubbles: true }));
          typed++;
          await sleep(5);
          if (teniaFoco && (!f.isConnected || document.activeElement !== f)) roba.push(marca(f));
          if (pestana() !== mia) { salta.push(marca(f)); solapa?.click(); await sleep(60); }
        }
        // Y EL REPINTADO TARDÍO, que es el mismo defecto medio segundo después
        // (la Sopa esperaba 600 ms «para no interrumpir» y entonces te movía la
        // pestaña, cuando ya nadie lo relaciona con la tecla).
        const uno = fields.find(editable);
        if (uno) {
          uno.focus();
          const teniaFoco = document.activeElement === uno;
          teclear(uno);
          uno.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(900);
          if (teniaFoco && (!uno.isConnected || document.activeElement !== uno)) roba.push(marca(uno) + ' (tarde)');
          if (pestana() !== mia) salta.push(marca(uno) + ' (tarde)');
        }
      }
      await sleep(200);
    } catch (e) { err = String(e.message).split('\n')[0]; }
    const after = scorable(T, act);
    out.push({ name, typed, err, before, after,
      roba: [...new Set(roba)], salta: [...new Set(salta)],
      roto: (after.ok + after.unscorable) < (before.ok + before.unscorable) });
  }
  return out;
});

const fmt = (s) => `${s.ok} con clave${s.unscorable ? ` +${s.unscorable} sin clave por diseño` : ''}/${s.total}`;
console.log('EDIT-AUDIT — ¿editar el texto del contenido pierde la respuesta correcta?\n');
let bad = 0, blind = 0;
for (const r of rows) {
  const mal = r.roba.length || r.salta.length;
  const mark = r.err ? '✗ ERROR' : (r.roto ? '✗ PIERDE LA CLAVE' : (mal ? '✗ TECLEAR DESTRUYE' : '✓'));
  if (r.err || r.roto || mal) bad++;
  if (r.after.blind) blind++;
  console.log(`  ${r.name.padEnd(15)} ${String(r.typed).padStart(3)} campos · ${fmt(r.before)} → ${fmt(r.after)}   ${mark}${r.err ? ' · ' + r.err : ''}`
    + (r.after.blind ? `   (${r.after.blind} ítem(s) que la sonda no sabe puntuar)` : ''));
  if (r.roba.length) console.log(`      ↳ pierden el foco al teclear: ${r.roba.join(', ')}`);
  if (r.salta.length) console.log(`      ↳ cambian de pestaña al teclear: ${r.salta.join(', ')}`);
}
if (errs.length) console.log('\n  errores de página:', [...new Set(errs)].slice(0, 5).join(' · '));
console.log(`\n  ${rows.length - bad}/${rows.length} plantillas conservan su clave —y el foco y la pestaña— al editar el texto.`
  + (blind ? ` (${blind} con ítems que la sonda no puntúa: su clave no es texto — ver comentario)` : ''));
try { browser.close(); } catch {}
bye(bad ? 1 : 0);
