// PUERTAS DEL EDITOR — R-B/R-D: cada plantilla tiene una puerta VISIBLE para
// añadir y dice qué hacer primero cuando aún no hay nada.
//
// Por qué es una red: 11 de 13 editores tenían su «+ Añadir …» y el diagrama no
// —sus pines se ponían clicando la imagen, escrito en una línea gris—, así que
// el dueño no encontró cómo poner la segunda etiqueta. Una lista enumerada
// vigila el pasado: aquí se recorre el REGISTRO, de modo que una plantilla nueva
// sin puerta o sin primer paso sale roja sola.
//
//   node tools/editor-puertas.mjs
//
// Se monta cada editor con el contenido VACÍO, que es como lo ve quien acaba de
// crear la actividad — y de paso comprueba que ninguno revienta ahí (tres lo
// hacían: leían `content.items.length` antes de pintar nada).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8499);
const web = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
process.on('uncaughtException', (e) => { console.error('\n❌ ABORTADA:', e?.message || e); try { web.kill(); } catch {} process.exit(1); });
await new Promise(r=>setTimeout(r,700));
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1280,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).split('\n')[0]));
await p.goto(`http://127.0.0.1:${PORT}/teacher.html?backend=local`,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!document.querySelector('#app'));

const r = await p.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { listTemplates } = await import('/core/registry.js');
  const s = await import('/core/storage.js');
  const out = [];
  for (const T of listTemplates()) {
    const m = T.meta;
    // VACÍA a propósito: es el estado que tiene que enseñar.
    const a = { id:'e_'+m.name, template:m.name, title:'x', content:{}, rules:{}, scoring:{}, updatedAt:'x' };
    s.save(a);
    const host = document.createElement('div'); host.id='ed'; 
    document.getElementById('app').innerHTML=''; document.getElementById('app').appendChild(host);
    let err = null;
    try { T.renderEditor(host, a, ()=>{}); } catch (e) { err = e.message.split('\n')[0]; }
    const txt = host.textContent || '';
    out.push({
      name: m.name,
      elemento: m.editor?.elemento || (m.editor?.generado ? '(generado)' : null),
      // El estado vacío: ¿aparece la frase declarada?
      enseña: !!m.editor?.primerPaso && txt.includes(m.editor.primerPaso.slice(0, 30)),
      // ¿Hay una puerta VISIBLE para añadir/generar?
      puerta: !!host.querySelector('button, .btn') &&
        // La PUERTA no siempre se llama «Añadir»: en el diagrama lo primero es
        // subir el dibujo y en Ordena las Pelotas se GENERA el tablero. Lo que
        // se exige es que exista una y sea visible, no una palabra concreta.
        /Añadir|Generar|Subir/.test([...host.querySelectorAll('button,.btn,label')].map(x=>x.textContent).join(' ')),
      // UN AJUSTE, UNA CASILLA. `templates/tildes/editor.js` pintaba «Puntos por
      // acierto» y «Puntos por error» en su panel de Modos… y el panel compartido
      // de Puntuación los pintaba OTRA VEZ, en otra pestaña, escribiendo el mismo
      // `a.scoring.pointsPerCorrect`. El profe veía el número en dos sitios y solo
      // uno recalculaba el «máximo de esta actividad» de al lado. Lo cazó el dueño
      // en dos capturas (v1.51.613).
      // Se comparan las ETIQUETAS visibles: es lo que el profe ve, y no depende de
      // cómo se llamen los `id` por dentro.
      duplicados: (() => {
        const vistas = new Map();
        for (const l of host.querySelectorAll('label')) {
          const t = l.textContent.trim().replace(/\s+/g, ' ');
          // Las casillas de verificación repiten su etiqueta por ÍTEM (una por
          // frase, una por pregunta): eso es una lista, no un ajuste duplicado.
          if (!t || t.length < 6 || l.closest('[data-i], .card')) continue;
          vistas.set(t, (vistas.get(t) || 0) + 1);
        }
        return [...vistas].filter(([, n]) => n > 1).map(([t, n]) => `${t} ×${n}`);
      })(),
      err,
    });
  }
  return out;
});
await b.close(); web.kill();
console.log('\n🚪 PUERTAS DEL EDITOR — las 13 con el contenido vacío\n');
console.log('  plantilla        elemento        enseña  puerta');
for (const x of r) console.log(`  ${x.name.padEnd(16)} ${String(x.elemento).padEnd(14)} ${x.enseña?'  ✅  ':'  ❌  '}  ${x.puerta?'✅':'❌'}${x.err?' · ERROR: '+x.err:''}`);
const dobles = r.filter(x => x.duplicados?.length);
for (const x of dobles) console.log(`  ⚠ ${x.name}: el mismo ajuste sale dos veces → ${x.duplicados.join(' · ')}`);
const mal = r.filter(x=>!x.enseña || !x.puerta || x.err || x.duplicados?.length);
console.log(mal.length ? `\n❌ ${mal.length} plantilla(s) sin estado vacío, sin puerta de añadir, o con un ajuste duplicado`
                       : `\n✅ las ${r.length}: estado vacío que enseña + puerta visible para añadir`);
console.log(errs.length ? 'errores de página: '+[...new Set(errs)].join(' · ') : '');
process.exit(mal.length?1:0);
