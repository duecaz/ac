// RED DE SEGURIDAD — LA HOJA DE PRUEBAS SE PUEDE ENTREGAR (§27, recorrido).
//
// Por qué existe, con nombre y fecha: en la ronda 2026-08-17 el probador hizo
// las 11 pruebas en su móvil, las marcó todas… y el botón de entregar nunca se
// habilitó, porque exigía cuenta de profe y él no la tiene. Su ronda entera se
// perdió. No lo cazó ninguna suite porque ninguna abría la hoja SIN SESIÓN, que
// es justo como la abre quien nos hace el favor de probar.
//
// Recorre lo que toca el dedo: marca las pruebas, comprueba que la hoja AVISA
// de que aún no ha entregado, pulsa Entregar y verifica que el informe SALE por
// alguna vía. Y la contra-prueba: con sesión, sigue yendo al panel.
//
//   node tools/hoja-smoke.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8479);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
let fallos = 0;
const ok = (m) => console.log('  ✅', m);
const mal = (m) => { fallos++; console.log('  ❌', m); };

/** Abre la hoja y marca TODAS las pruebas como pasa (lo que hizo él). */
async function abrirYMarcar(page, { conSesion, conCompartir }) {
  await page.addInitScript(([sesion, share]) => {
    if (sesion) localStorage.setItem('ww.pb.auth', JSON.stringify({ token: 'TOK', record: { id: 'u1' } }));
    else localStorage.removeItem('ww.pb.auth');
    // El navegador de escritorio no tiene hoja de compartir; el móvil sí. Se
    // simulan los dos, porque el probador viene del móvil.
    if (share) {
      window.__compartido = null;
      navigator.share = async (d) => { window.__compartido = d; };
    } else { try { delete navigator.share; } catch {} }
    // El envío al panel no debe tocar PocketBase en esta prueba: se intercepta
    // el fetch para que responda como el servidor, sin red.
    window.__enviadoAlPanel = false;
    const real = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).includes('/api/collections/reports/records')) {
        window.__enviadoAlPanel = true;
        return new Response(JSON.stringify({ id: 'r1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return real(u, o);
    };
  }, [conSesion, conCompartir]);
  await page.goto(`${BASE}/test.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.qh-prueba', { timeout: 15000 });
  const n = await page.locator('.qh-prueba').count();
  for (let i = 0; i < n; i++) {
    // Se pulsa la ETIQUETA, que es lo que toca el dedo: el radio va oculto tras ella.
    await page.locator('.qh-prueba').nth(i).locator('.qh-veredicto label[data-v="pasa"]').click();
  }
  return n;
}

// ── 1 · SIN SESIÓN, EN EL MÓVIL — el caso que se perdió ──────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const n = await abrirYMarcar(page, { conSesion: false, conCompartir: true });
  console.log(`\n── sin sesión, en el móvil (${n} pruebas marcadas) ──`);

  const btn = page.locator('#qh-enviar');
  // Si el botón está muerto, se DICE y se para aquí: seguir pulsando solo
  // produce un volcado de Playwright, y un test rojo que se estrella explica
  // menos que uno que nombra el fallo.
  const vivo = await btn.count() > 0 && !(await btn.isDisabled());
  if (await btn.count() === 0) mal('no hay botón de entregar');
  else if (!vivo) mal('el botón de entregar está DESHABILITADO sin sesión (es el fallo de la ronda 2026-08-17: se pierde la ronda entera)');
  else ok('el botón de entregar está vivo sin cuenta de profe');

  const aviso = page.locator('#qh-pendiente');
  if (await aviso.isVisible()) ok(`la hoja avisa de que aún no ha entregado: «${(await aviso.textContent()).slice(0, 60)}…»`);
  else mal('marcó todas las pruebas y la hoja NO avisa de que sigue sin entregar');

  if (vivo) { await btn.click(); await page.waitForTimeout(400); }
  const compartido = await page.evaluate(() => window.__compartido);
  if (compartido?.text?.includes('Veredictos:')) ok('el informe SALE por la hoja de compartir del móvil (WhatsApp/correo)');
  else mal('pulsó Entregar y el informe no salió por ninguna vía');
  if (!(await aviso.isVisible())) ok('tras entregar, el aviso se retira');
  else mal('el aviso sigue puesto después de entregar');
  await ctx.close();
}

// ── 2 · SIN SESIÓN Y SIN HOJA DE COMPARTIR (PC) — el último escalón ─────────
{
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await abrirYMarcar(page, { conSesion: false, conCompartir: false });
  console.log('\n── sin sesión y sin compartir (PC) ──');
  if (await page.locator('#qh-enviar').isDisabled()) mal('el botón de entregar está DESHABILITADO sin sesión');
  else { await page.locator('#qh-enviar').click(); await page.waitForTimeout(400); }
  const salida = page.locator('#qh-salida');
  const texto = await salida.inputValue();
  if (await salida.isVisible() && texto.includes('Veredictos:')) ok('el informe queda A LA VISTA para copiar (último escalón)');
  else mal('sin compartir ni sesión, el informe no aparece por ningún lado');
  await ctx.close();
}

// ── 3 · CONTRA-PRUEBA: con sesión sigue yendo al panel ──────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await abrirYMarcar(page, { conSesion: true, conCompartir: true });
  console.log('\n── CONTRA-PRUEBA · con sesión de profe ──');
  if (await page.locator('#qh-enviar').isDisabled()) mal('el botón de entregar está deshabilitado incluso CON sesión');
  else { await page.locator('#qh-enviar').click(); await page.waitForTimeout(600); }
  const alPanel = await page.evaluate(() => window.__enviadoAlPanel);
  const compartido = await page.evaluate(() => window.__compartido);
  if (alPanel) ok('con sesión, el informe se guarda en el panel (la vía buena sigue siendo la primera)');
  else mal('con sesión, el informe NO llegó al panel');
  if (!compartido) ok('y no se cuela por la hoja de compartir teniendo cuenta');
  else mal('teniendo sesión, se fue por compartir en vez de guardarse');
  await ctx.close();
}

await browser.close();
console.log(fallos
  ? `\n❌ la hoja de pruebas tiene ${fallos} fallo(s) de entrega`
  : '\n✅ la hoja de pruebas SIEMPRE se puede entregar (con cuenta, con móvil, o copiando)');
bye(fallos ? 1 : 0);
