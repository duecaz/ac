// LOS PANELES DEL EDITOR SON DE TODAS LAS PLANTILLAS, NO DE QUIEN SE ACORDÓ.
//
// Los datos que editan se leen GLOBALMENTE: `a.scoring.mode` lo consume
// `core/scoring/award.js`; de `a.live` salen el timer de pregunta, la ventana de
// lectura, el modelo de puntos, el bonus de velocidad y el aforo de la sala.
// Pero los paneles los aportaba cada plantilla en su spec, y así quedó
// (auditoría v1.51.408): "Puntuación" en 5 de 13, y "En vivo" SOLO en Quiz
// mientras SIETE plantillas declaran `modes.live`. El profe de Tildes no tenía
// dónde tocar el timer de su propia sala: funcionalidad AUSENTE, no un adorno.
//
// Run: node tests/editorPanels.test.mjs
import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import '../core/registerTemplates.js';
import { listTemplates } from '../core/registry.js';
import { scoringPanelHtml, livePanelHtml } from '../core/editorPanels.js';
import { DEFAULT_LIVE } from '../core/constants.js';
import { newActivity } from '../core/migrate.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const TDIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const reales = new Set(readdirSync(TDIR).filter(n => { try { return statSync(join(TDIR, n)).isDirectory(); } catch { return false; } }));
const all = listTemplates().filter(T => reales.has(T.meta.name));

// ── 1. El chasis pone los paneles por defecto ──────────────────────────────
{
  const shell = readdirSync(join(TDIR, '..', 'core')).includes('editorShell.js');
  assert.ok(shell, 'falta core/editorShell.js');
  const src = readdirSync(join(TDIR, '..', 'core')).length && (await import('node:fs')).readFileSync(join(TDIR, '..', 'core', 'editorShell.js'), 'utf8');
  assert.match(src, /scoring:\s*spec\.scoring\s*\|\|/, 'el chasis debe poner "Puntuación" cuando la plantilla no lo declara');
  assert.match(src, /live:\s*spec\.live\s*\|\|/, 'y "En vivo" igual');
  ok('el chasis del editor aporta Puntuación y En vivo por defecto');
}

// ── 2. Los paneles pintan los campos que el motor LEE de verdad ────────────
// No basta con que exista la pestaña: si el panel no trae el campo, el dato
// sigue sin poder tocarse. Se comprueban los que consumen el motor y el
// marcador, no una lista decorativa.
{
  const a = newActivity('quiz');
  const live = livePanelHtml(a);
  for (const campo of ['l-qtimer', 'l-read', 'l-points', 'l-bonus', 'l-max', 'l-late', 'l-end']) {
    assert.ok(live.includes(campo), `el panel En vivo no trae el control «${campo}»`);
  }
  const sc = scoringPanelHtml(a);
  for (const campo of ['f-mode', 'f-ppc', 'f-ppw']) {
    assert.ok(sc.includes(campo), `el panel Puntuación no trae el control «${campo}»`);
  }
  ok('los paneles traen los campos que leen el motor y el marcador (timer · lectura · puntos · aforo)');
}

// ── 3. DEFAULT_LIVE llega DE VERDAD a toda plantilla ───────────────────────
// `defaultLive: () => ({})` es truthy, así que el `||` de core/migrate.js
// descartaba los valores por defecto para las 10 plantillas que devuelven un
// objeto vacío. Sobrevivían porque cada lector tenía su propio respaldo
// (`|| 20`, `?? 1000`, `|| 60`): el default estaba duplicado en tres módulos y
// el declarado no llegaba nunca. Ahora es merge, y esto lo fija.
{
  const sinDefaults = [];
  for (const T of all) {
    const a = newActivity(T.meta.name);
    for (const k of Object.keys(DEFAULT_LIVE)) {
      if (a.live?.[k] === undefined) sinDefaults.push(`${T.meta.name}.${k}`);
    }
  }
  assert.deepStrictEqual(sinDefaults, [],
    `estas plantillas nacen sin su valor por defecto de live: ${sinDefaults.slice(0, 8).join(' · ')}`);
  ok(`las ${all.length} plantillas nacen con los ${Object.keys(DEFAULT_LIVE).length} valores de DEFAULT_LIVE (merge, no reemplazo)`);
}

// ── 4. CONTRA-PRUEBA: una plantilla puede seguir declarando el SUYO ────────
// El defecto no puede convertirse en una jaula: si una plantilla necesita otro
// panel (una mecánica con puntuación propia), lo declara y gana el suyo.
{
  const { renderEditorShell } = await import('../core/editorShell.js');
  assert.strictEqual(typeof renderEditorShell, 'function');
  const src = (await import('node:fs')).readFileSync(join(TDIR, '..', 'core', 'editorShell.js'), 'utf8');
  assert.match(src, /spec\.scoring\s*\|\|\s*\{/, 'el spec de la plantilla debe GANAR sobre el panel por defecto');
  assert.match(src, /spec\.live\s*\|\|\s*\{/, 'idem para En vivo');
  ok('CONTRA-PRUEBA: una plantilla que declare su propio panel sigue ganando');
}

// ── ESCRIBIR NO PUEDE REPINTAR EL EDITOR ───────────────────────────────────
// El dueño escribió «30» en el campo de tiempo y el editor saltó de pestaña
// (2026-09-02): el cableado llamaba a `repaint()` en cada `input`, que
// re-renderiza el editor ENTERO — se pierde el foco, el cursor y la pestaña.
// Un repintado completo puede colgar de un clic o de un `change` (añadir un
// ítem, cambiar de nivel), NUNCA de una tecla. Se descubre por ESCANEO: vale
// para los 13 editores y para el que se escriba mañana.
{
  const fs = await import('node:fs');
  const RAIZ = join(TDIR, '..');
  const culpables = [];
  // Se acota CADA handler contando paréntesis: con una expresión regular
  // «hasta el próximo });» el bloque se comía los handlers de al lado y
  // señalaba a cuatro editores inocentes — una red que grita de más se acaba
  // ignorando igual que una que calla.
  const handlers = (src, evento) => {
    const out = [];
    const re = new RegExp(`on\\(\\s*root\\s*,\\s*'${evento}'`, 'g');
    let m;
    while ((m = re.exec(src))) {
      let prof = 0, i = m.index;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '(') prof++;
        else if (c === ')') { prof--; if (prof === 0) { i++; break; } }
      }
      out.push(src.slice(m.index, i));
    }
    return out;
  };
  const mirar = (rel) => {
    const src = fs.readFileSync(join(RAIZ, rel), 'utf8');
    for (const h of handlers(src, 'input')) {
      if (/repaint\s*\??\.?\s*\(/.test(h)) culpables.push(rel);
    }
  };
  mirar('core/editorPrimitives.js');
  mirar('core/editorShell.js');
  mirar('core/editorModes.js');
  mirar('core/editorPanels.js');
  for (const n of reales) {
    const rel = `templates/${n}/editor.js`;
    try { fs.statSync(join(RAIZ, rel)); } catch { continue; }
    mirar(rel);
  }
  assert.deepStrictEqual([...new Set(culpables)], [],
    `repintan el editor entero mientras el profe TECLEA (pierde foco y pestaña): ${[...new Set(culpables)].join(', ')}`);
  // CONTRA-PRUEBA: el repintado legítimo sigue vivo. Sin esto, la regla se
  // «cumpliría» borrando todos los repaint y el «+ Añadir» dejaría de pintar
  // la fila nueva.
  const porClic = handlers(fs.readFileSync(join(RAIZ, 'templates/match/editor.js'), 'utf8'), 'click')
    .filter(h => /repaint\s*\(/.test(h)).length;
  assert.ok(porClic > 0, 'CONTRA-PRUEBA: dar de alta o baja un ítem SÍ repinta (es un clic, no una tecla)');
  ok('ningún campo repinta el editor al teclear — la tecla es del que escribe (y el clic sí repinta)');
}

// ── Y CUANDO SÍ SE REPINTA, LA PESTAÑA ABIERTA SE QUEDA ────────────────────
// La otra mitad del mismo susto: `render()` marcaba activa SIEMPRE la primera
// pestaña, así que cualquier repintado legítimo hecho desde «Juego» o
// «Presentación» te devolvía a «Contenido».
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(join(TDIR, '..', 'core', 'editorShell.js'), 'utf8');
  assert.match(src, /nav-link\.active/, 'render() debe LEER qué pestaña estaba abierta antes de repintar');
  assert.ok(!/nav-link \$\{i === 0 \?/.test(src) && !/tab-pane fade \$\{i === 0 \?/.test(src),
    'y no puede volver a cablear la primera pestaña como activa');
  assert.match(src, /i === activo/, 'la pestaña activa sale de la que estaba abierta');
  ok('un repintado del editor conserva la pestaña abierta');
}

console.log(`\n  ${passed} editorPanels checks passed`);
