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
import { citaDeFuente } from './helpers/fuente.mjs';

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

// ── 6. EL HAMBURGUESA SE CIERRA AL TOCAR FUERA ─────────────────────────────
// Se abría con un `onclick` en el HTML y solo se cerraba pulsándole otra vez o
// tocando una acción. Tocar fuera —lo que hace todo el mundo— no hacía nada y
// el desplegable tapaba la pantalla (dueño, 2026-08-15). Se comprueba
// EJECUTANDO el cableado con un DOM de juguete: los cuatro cierres que un
// usuario espera, y la contra-prueba de que sigue abriendo.
{
  const oyentes = { document: {}, window: {} };
  const nodo = (cls, padre = null) => {
    const n = {
      className: cls, dataset: {}, parentNode: padre, hijos: [], attrs: {},
      classList: {
        _s: new Set(cls.split(' ')),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        contains(c) { return this._s.has(c); },
        toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
      },
      setAttribute(k, v) { n.attrs[k] = v; },
      // La barra se MIDE (core/boot.js `medirBarra`): el mando de la hoja del
      // alumno descuenta su alto real, así que el doble tiene que devolver uno.
      getBoundingClientRect: () => ({ height: 56 }),
      addEventListener(t, f) { n['on_' + t] = f; },
      contains(o) { for (let p = o; p; p = p.parentNode) if (p === n) return true; return false; },
      closest(sel) {
        const c = sel.replace('.', '');
        for (let p = n; p; p = p.parentNode) if (p.classList.contains(c)) return p;
        return null;
      },
      querySelector(sel) { return n.hijos.find(h => h.classList.contains(sel.replace('.', ''))) || null; },
    };
    if (padre) padre.hijos.push(n);
    return n;
  };
  const bar = nodo('ww-topbar');
  const boton = nodo('ww-topbar__burger', bar);
  const acciones = nodo('ww-topbar__actions', bar);
  const fuera = nodo('otra-cosa');

  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.document = {
    documentElement: { style: { setProperty(k, v) { this[k] = v; } } },
    querySelector: (s) => (s === '.ww-topbar' ? bar : null),
    addEventListener: (t, f) => { oyentes.document[t] = f; },
    removeEventListener: (t) => { delete oyentes.document[t]; },
  };
  global.window = {
    addEventListener: (t, f) => { oyentes.window[t] = f; },
    removeEventListener: (t) => { delete oyentes.window[t]; },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};

  const { wireTopbarMenu } = await import('../core/boot.js');
  const soltar = wireTopbarMenu();

  const abrir = () => bar.on_click({ target: boton });
  abrir();
  assert.ok(bar.classList.contains('open'), 'el botón abre el menú');
  assert.strictEqual(bar.attrs['aria-expanded'], undefined, 'el aria vive en el botón, no en la barra');
  assert.strictEqual(boton.attrs['aria-expanded'], 'true', 'y el botón anuncia que está abierto');

  oyentes.document.click({ target: fuera });
  assert.ok(!bar.classList.contains('open'), 'UN TOQUE FUERA lo cierra (era el fallo)');
  assert.strictEqual(boton.attrs['aria-expanded'], 'false', 'y el aria se entera');

  abrir();
  oyentes.document.click({ target: boton });   // dentro de la barra: no cierra por "fuera"
  assert.ok(bar.classList.contains('open'), 'CONTRA-PRUEBA: tocar DENTRO no lo cierra por la espalda');

  bar.on_click({ target: acciones });
  assert.ok(!bar.classList.contains('open'), 'elegir una acción lo cierra');

  abrir();
  oyentes.document.keydown({ key: 'Escape' });
  assert.ok(!bar.classList.contains('open'), 'Escape lo cierra');

  abrir();
  oyentes.window.hashchange();
  assert.ok(!bar.classList.contains('open'), 'navegar lo cierra (no queda encima de la vista nueva)');

  assert.strictEqual(document.documentElement.style['--ww-topbar-h'], '56px',
    'el alto REAL de la barra se publica como dato (--ww-topbar-h), no se declara a mano');

  soltar();
  assert.ok(!oyentes.document.click && !oyentes.document.keydown,
    'el disposer suelta los oyentes globales (ley §23)');
  ok('el menú hamburguesa cierra al tocar fuera, con Escape, al elegir y al navegar');

  // Y el HTML ya no lleva el cableado a mano: dos copias de lo mismo derivan.
  for (const [f, src] of [['teacher.html', teacher], ['student.html', read('student.html')]]) {
    assert.ok(!/ww-topbar__burger[^>]*onclick/.test(src),
      `${f}: el hamburguesa no puede volver a cablearse con onclick en el HTML`);
  }
  ok('el cableado vive en core/boot.js, no repetido en cada HTML');

  delete global.document; delete global.window; delete global.localStorage;
  delete global.requestAnimationFrame; delete global.cancelAnimationFrame; delete global.ResizeObserver;
}

// ── 7. «Crear cuenta» es un BOTÓN, no una nota al pie ──────────────────────
// Quien abre el modal sin cuenta es un profe nuevo: su camino no puede ser el
// texto más pequeño de la pantalla (dueño, 2026-08-15).
{
  const lm = read('views/loginModal.js');
  citaDeFuente(lm, /class="login-modal__create"/, 'el alta tiene su propio botón', 'loginModal.js');
  citaDeFuente(lm, /href="#\/registro"/, 'y lleva al alta (#/registro)', 'loginModal.js');
  citaDeFuente(read('styles/home.css'), /\.login-modal__create\s*\{[^}]*border:/s,
    'con forma de botón (borde), no de enlace suelto', 'home.css');
  ok('«Crear mi cuenta» es un botón con su bloque propio en el modal de entrada');
}

console.log(`\n  ${passed} menu checks passed`);
