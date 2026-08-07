// LA ENTRADA Y EL MENÚ (norte §7c) — EJECUTABLE.
//
// §7c es una sección CONFIRMADA, aplicada, y con las condiciones de cambio ya
// escritas ("un quinto botón: no; si algo entra, algo sale"). Su única defensa
// era un comentario en `teacher.html` — cualquiera podía añadir un botón, o uno
// llamado "Alumno", y CI seguía verde (auditoría v1.51.400). El norte dice que
// *"el menú es el norte hecho botones"*: entonces el menú se vigila como una ley.
//
// Run: node tests/menu.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const teacher = read('teacher.html');
const nav = (teacher.match(/<nav[\s\S]*?<\/nav>/) || [''])[0];
assert.ok(nav, 'teacher.html debe tener su barra <nav>');

// Enlaces de NAVEGACIÓN de la barra: los `<a>` con clase de botón. El de Admin
// nace `hidden` (solo para el rol admin) y el de "Borrar caché" es un <button>
// de acción, no un destino: ninguno de los dos ocupa plaza en el menú.
const enlaces = [...nav.matchAll(/<a\s+href="(#\/[^"]*)"([^>]*)>([\s\S]*?)<\/a>/g)]
  .filter(m => /ww-navbtn/.test(m[2]) && !/\bhidden\b/.test(m[2]))
  .map(m => ({ href: m[1], html: m[3], texto: m[3].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }));

// ── 1. CUATRO entradas, ni una más (§7c) ───────────────────────────────────
// "Con cinco ya nadie lee ninguno; si algo entra, algo sale." La quinta entrada
// no se discute por intuición: rompe CI y obliga a decidir cuál sale.
{
  assert.strictEqual(enlaces.length, 4,
    `la barra del profe tiene ${enlaces.length} entradas y §7c dice CUATRO: ${enlaces.map(e => e.texto).join(' · ')}`);
  assert.deepStrictEqual(enlaces.map(e => e.href), ['#/mine', '#/explore', '#/juegos', '#/reports'],
    'los destinos del menú son Mis actividades · Biblioteca · Juegos · Informes, en ese orden');
  ok(`el menú del profe son 4 entradas: ${enlaces.map(e => e.texto).join(' · ')}`);
}

// ── 2. Ninguna se llama "Alumno" (§7c) ─────────────────────────────────────
// Meter a otro público en la barra del profe es abrir por la puerta de atrás lo
// que §4d aplaza: alumnos jugando solos. El alumno tiene sus DOS entradas y son
// ajenas a este menú (PIN y enlace de tarea).
{
  for (const e of enlaces) {
    assert.ok(!/alumn/i.test(e.texto + e.href), `la barra del profe no puede tener una entrada "${e.texto}"`);
  }
  // Y la portada sí ofrece la entrada del alumno, que es donde le toca estar.
  assert.match(read('views/landing.js'), /landing-hero__pin|PIN/i,
    'la portada debe ofrecerle al alumno su entrada por PIN (no la barra del profe)');
  ok('ninguna entrada se llama "Alumno" · el alumno entra por PIN desde la portada');
}

// ── 3. UNA COSA, UN NOMBRE (§6e): se dice "Informes" ───────────────────────
// El norte nombra la cuarta entrada "Informes" y el botón decía "Reportes".
// Es justo la deriva que §6e existe para cerrar. OJO: "reportes" sigue siendo
// la palabra correcta para las DENUNCIAS de contenido (`views/moderate.js`) —
// son dos cosas distintas y por eso el chequeo mira la barra y la vista, no el
// repo entero.
{
  const cuarta = enlaces[3];
  assert.match(cuarta.texto, /Informes/, `la cuarta entrada se llama "${cuarta.texto}" y el norte §7c dice "Informes"`);
  assert.ok(!/>\s*Reportes\s*</.test(read('views/reports.js')),
    'la vista de informes tampoco puede titularse "Reportes" (§6e: una cosa, un nombre)');
  ok('la cuarta entrada se dice "Informes" en la barra y en la vista (§6e)');
}

// ── 4. La ENTRADA: el profe con sesión va a lo suyo (§7c) ──────────────────
// "El profe viene con prisa y a por su material; el escaparate es para quien
// llega de fuera." Si `#/` dejara de redirigir, el profe aterrizaría cada día
// en la portada de marketing.
{
  const main = read('main.teacher.js');
  assert.match(main, /route\('#\/'[\s\S]{0,220}navigate\('#\/mine'\)/,
    'con sesión, `#/` debe llevar a Mis actividades (§7c)');
  assert.match(main, /renderLanding/, 'y sin sesión, a la portada');
  ok('con sesión `#/` lleva a Mis actividades; sin sesión, a la portada');
}

// ── 5. CONTRA-PRUEBA: el escaneo detecta de verdad ─────────────────────────
// Si el filtro estuviera mal escrito, los 4 checks de arriba pasarían mirando a
// una lista vacía. Se le da una barra FABRICADA con un quinto botón y con uno
// llamado "Alumno", y tiene que verlos.
{
  const navFalso = `<nav class="ww-topbar">
    <a href="#/mine" class="ww-navbtn">Mis actividades</a>
    <a href="#/explore" class="ww-navbtn">Biblioteca</a>
    <a href="#/juegos" class="ww-navbtn">Juegos</a>
    <a href="#/reports" class="ww-navbtn">Informes</a>
    <a href="#/alumno" class="ww-navbtn">Alumno</a>
  </nav>`;
  const falsos = [...navFalso.matchAll(/<a\s+href="(#\/[^"]*)"([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(m => /ww-navbtn/.test(m[2]) && !/\bhidden\b/.test(m[2]))
    .map(m => ({ href: m[1], texto: m[3] }));
  assert.strictEqual(falsos.length, 5, 'el escaneo cuenta las entradas de verdad');
  assert.ok(falsos.some(e => /alumn/i.test(e.texto)), 'y ve la entrada prohibida');
  ok('CONTRA-PRUEBA: una barra con 5 entradas y una "Alumno" sería cazada');
}

console.log(`\n  ${passed} menu checks passed`);
