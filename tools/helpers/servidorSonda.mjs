// EL SERVIDOR DE LAS SONDAS — uno, con puerto libre y garantía de que sirve
// ESTE árbol.
//
// POR QUÉ EXISTE. Doce herramientas de `tools/` levantan su propio
// `python3 -m http.server` para medir la app en un navegador, y cada una elegía
// su puerto a mano. Tres compartían el 8479 (`piezas`, `contrast-torture`,
// `hoja-smoke`), así que dos a la vez —o un zombi de una pasada anterior— y la
// segunda mide lo que sirve la primera. Nueve de esas doce corren dentro de
// `tools/preflight.mjs`, la puerta de ~100 s que CLAUDE.md declara no opcional:
// cualquiera de ellas podía, en principio, medir un árbol viejo y estampar un
// verde tranquilizador.
//
// La idea nació en `tools/opcion-sonda.mjs` (v1.51.601) —«una sonda que miente
// es peor que ninguna»— y se quedó encerrada en la única herramienta que nadie
// importa: el sitio donde no arregla nada. Aquí la usan todas.
//
// DOS GARANTÍAS, las dos comprobables:
//   1. PUERTO EFÍMERO. Se le pide al sistema uno libre y se suelta justo antes
//      de dárselo a python: lo que acaba de estar libre no tiene un zombi.
//   2. ES ESTE ÁRBOL. Antes de medir se pide `core/constants.js` por HTTP y se
//      compara su VERSION con la del disco. Si no coinciden, se para con un
//      error que lo dice — en vez de medir otra cosa y dar por bueno el commit.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const versionDe = (src) => src.match(/VERSION\s*=\s*'([^']+)'/)?.[1] ?? null;

/**
 * Levanta el servidor estático del repo y devuelve `{ base, cerrar }`.
 * `base` es la URL (`http://127.0.0.1:PUERTO`); `cerrar()` mata el proceso y
 * hay que llamarlo SIEMPRE, desde un `finally`.
 */
export async function abrirServidor() {
  const puerto = await new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
  const base = `http://127.0.0.1:${puerto}`;
  const proc = spawn('python3', ['-m', 'http.server', String(puerto), '--bind', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' });
  const cerrar = () => { try { proc.kill(); } catch { /* ya estaba muerto: nada que hacer */ } };

  // Esperar por CONDICIÓN, no por reloj: se reintenta la comprobación que de
  // todas formas hay que hacer, así que arrancar rápido no cuesta una siesta y
  // arrancar lento no da un ECONNREFUSED desconcertante.
  const enDisco = versionDe(await readFile(join(ROOT, 'core/constants.js'), 'utf8'));
  let porHttp = null;
  for (let i = 0; i < 40; i++) {
    try {
      porHttp = versionDe(await (await fetch(`${base}/core/constants.js`)).text());
      if (porHttp) break;
    } catch { /* aún no escucha: se reintenta abajo */ }
    await new Promise(r => setTimeout(r, 100));
  }
  if (!enDisco || enDisco !== porHttp) {
    cerrar();
    throw new Error(`el servidor sirve v${porHttp} y en disco hay v${enDisco} — no se mide sobre otro árbol`);
  }
  return { base, puerto, cerrar };
}
