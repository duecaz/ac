// Regresiones de SEGURIDAD (auditoría 2026-07).
// P0-4: un `backgroundImage` no confiable (JSON importado / actividad forkeada)
// no debe poder inyectar HTML/JS al pintarse en el navegador del profesor.
// Run: node tests/security.test.mjs
import assert from 'node:assert';
import { isSafeBgImage, backgroundPreviewHtml } from '../core/backgrounds.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const GOOD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA',
      GOOD_JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ',
      XSS_ATTR = `x')><img src=x onerror=alert(document.cookie)>`,
      XSS_JS = 'javascript:alert(1)',
      XSS_SVG = 'data:image/svg+xml,<svg onload="alert(1)"></svg>';

// ── isSafeBgImage: whitelist estricto ────────────────────────────────────────
{
  assert.ok(isSafeBgImage(GOOD), 'acepta data:image/png;base64');
  assert.ok(isSafeBgImage(GOOD_JPG), 'acepta data:image/jpeg;base64');
  assert.ok(!isSafeBgImage(XSS_ATTR), 'rechaza payload que rompe el atributo');
  assert.ok(!isSafeBgImage(XSS_JS), 'rechaza javascript:');
  assert.ok(!isSafeBgImage(XSS_SVG), 'rechaza SVG en texto (comillas/<> en el cuerpo)');
  assert.ok(!isSafeBgImage(''), 'rechaza cadena vacía');
  assert.ok(!isSafeBgImage(null), 'rechaza null');
  assert.ok(!isSafeBgImage('http://evil/x.png'), 'rechaza URL remota');
  ok('isSafeBgImage: solo data-URLs de imagen base64');
}

// ── backgroundPreviewHtml: sin inyección con un imageUrl malicioso ───────────
{
  const html = backgroundPreviewHtml('custom', XSS_ATTR);
  assert.ok(!html.includes('onerror'), 'el payload no aparece en el HTML');
  assert.ok(!html.includes('<img src=x'), 'no se coló un <img> inyectado');
  assert.ok(html.includes('bi-upload'), 'cae al affordance de subir (como si no hubiera imagen)');
  ok('backgroundPreviewHtml neutraliza un imageUrl malicioso');
}

// ── backgroundPreviewHtml: imagen válida se pinta con url() en comillas simples ─
{
  const html = backgroundPreviewHtml('custom', GOOD);
  assert.ok(html.includes(`url('${GOOD}')`), "usa url('…') en comillas simples (no rompe el style=\"\")");
  assert.ok(!html.includes(`url("${GOOD}")`), 'no usa comillas dobles anidadas');
  ok('backgroundPreviewHtml pinta la imagen válida sin romper el atributo');
}

console.log(`\nsecurity.test: ${passed} checks passed`);
