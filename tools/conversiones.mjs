// AUDITORÍA DE CONVERSIONES — qué pasa al llevar el contenido de cada plantilla
// a cada otra. Pedido por el dueño (2026-08-18) tras encontrar que
// «Operaciones → Explota Globos» salía vacía: si una conversión se OFRECE, hay
// que saber exactamente qué produce, no suponerlo.
//
// No inventa nada: usa el contenido real (`defaultContent()` de cada plantilla),
// el motor real (`switchOptions`/`applySwitch`) y el revisor real de la app
// (`revisarActividad`, el mismo que decide si una actividad se puede jugar).
//
//   node tools/conversiones.mjs           # cuadro por pantalla
//   node tools/conversiones.mjs --md      # en Markdown (para el doc generado)
import '../core/registerTemplates.js';
import { listTemplates, getTemplate } from '../core/registry.js';
import { switchOptions, applySwitch } from '../kernel/content/switch.js';
import { revisarActividad } from '../core/activityCheck.js';

const MD = process.argv.includes('--md');

/** Cuántas piezas de contenido tiene, sea cual sea el modelo. */
function piezas(content) {
  if (!content || typeof content !== 'object') return 0;
  for (const k of ['items', 'pairs', 'words', 'entries', 'groups', 'passages', 'pins']) {
    if (Array.isArray(content[k])) return content[k].length;
  }
  return 0;
}

/** Actividad de prueba con el contenido REAL de la plantilla. */
function actividadDe(T) {
  return {
    id: 'audit', template: T.meta.name, title: 'Auditoría',
    content: T.meta.defaultContent(),
    rules: T.meta.defaultRules?.() || {},
    scoring: T.meta.defaultScoring?.() || {},
    live: T.meta.defaultLive?.() || {},
  };
}

const todas = listTemplates().filter(T => typeof T.meta?.defaultContent === 'function');
const filas = [];
const problemas = [];
const pidenTrabajo = [];

for (const origen of todas) {
  const act = actividadDe(origen);
  const entran = piezas(act.content);
  const ofrecidas = switchOptions(act, listTemplates());
  for (const o of ofrecidas) {
    const destino = o.template;
    const conv = applySwitch(act, destino.meta.name, listTemplates());
    const salen = conv ? piezas(conv.content) : 0;
    const rev = conv ? revisarActividad(conv) : { jugable: false, listo: false, problemas: ['no se pudo convertir'] };

    // ¿La ronda del destino tiene con qué? Es la prueba que de verdad importa:
    // el modelo puede validar y la pantalla salir vacía igual (el caso Globos).
    let ronda = '—';
    if (conv && typeof destino.getRoundPayload === 'function') {
      try {
        const pl = destino.getRoundPayload(conv, { itemIndex: 0 });
        if (!pl) ronda = 'VACÍA';
        else if ('options' in pl) {
          const n = (pl.options || []).filter(x => String(x ?? '').trim() !== '').length;
          ronda = n >= 2 ? `${n} opciones` : `SOLO ${n}`;
        } else ronda = 'ok';
      } catch (e) { ronda = 'REVIENTA'; }
    }

    const fila = {
      de: origen.meta.label, a: destino.meta.label,
      tipo: o.kind === 'direct' ? 'directa' : 'conversión',
      modelos: o.from === o.to ? o.from : `${o.from}→${o.to}`,
      ofrecida: o.valid ? 'sí' : 'NO (se esconde)',
      piezas: `${entran}→${salen}`,
      jugable: rev.jugable ? 'sí' : 'NO',
      ronda,
      nota: rev.jugable ? '' : (rev.problemas?.[0] || ''),
    };
    filas.push(fila);
    // ROTO ≠ PIDE TRABAJO. Una ronda vacía o que revienta es un fallo del
    // conversor. Que falte una PISTA no lo es: Crucigrama la necesita y una
    // palabra suelta no la trae — inventarla revelaría la respuesta. Eso es
    // trabajo del profe, y lo que la app debe hacer es AVISARLO antes (lo hace
    // `switchWillNeed`, views/switchTemplate.js). Mezclarlos escondería un
    // fallo de verdad detrás de un aviso que ya está resuelto.
    fila.pideTrabajo = o.valid && !rev.jugable && ronda !== 'VACÍA' && ronda !== 'REVIENTA';
    if (o.valid && (ronda === 'VACÍA' || ronda === 'REVIENTA' || String(ronda).startsWith('SOLO'))) {
      problemas.push(`${fila.de} → ${fila.a}: ronda ${ronda}${fila.nota ? ' · ' + fila.nota : ''}`);
    }
    if (fila.pideTrabajo) pidenTrabajo.push(`${fila.de} → ${fila.a}: ${fila.nota}`);
    if (o.valid && salen < entran) {
      problemas.push(`${fila.de} → ${fila.a}: se PIERDEN piezas (${entran}→${salen})`);
    }
  }
}

// Qué NO se ofrece, y desde dónde (el silencio también es información).
const sinSalida = todas.filter(T => switchOptions(actividadDe(T), listTemplates()).filter(o => o.valid).length === 0);

if (MD) {
  console.log('| De | A | Tipo | Modelo | Piezas | Al terminar |');
  console.log('|---|---|---|---|---|---|');
  for (const f of filas.filter(f => f.ofrecida === 'sí')) {
    const estado = f.jugable === 'sí' ? 'lista para jugar' : `hay que completar: ${f.nota}`;
    console.log(`| ${f.de} | ${f.a} | ${f.tipo} | \`${f.modelos}\` | ${f.piezas} | ${estado} |`);
  }
  console.log(`\n> ${filas.filter(f => f.ofrecida === 'sí').length} conversiones · `
    + `${filas.filter(f => f.ofrecida === 'sí' && f.jugable === 'sí').length} salen listas · `
    + `${pidenTrabajo.length} piden completar algo (la app lo avisa ANTES de crear la copia).`);
  console.log(`>\n> Sin ninguna salida: ${sinSalida.map(T => T.meta.label).join(' · ') || '(ninguna)'}.`);
} else {
  const w = (s, n) => String(s).padEnd(n);
  console.log('\nCONVERSIONES OFRECIDAS (contenido real → motor real → revisor real)\n');
  console.log(w('DE', 22) + w('A', 22) + w('TIPO', 12) + w('MODELO', 20) + w('PIEZAS', 9) + w('JUGABLE', 9) + 'RONDA');
  console.log('─'.repeat(104));
  let deActual = '';
  for (const f of filas.filter(f => f.ofrecida === 'sí')) {
    if (f.de !== deActual) { if (deActual) console.log(''); deActual = f.de; }
    console.log(w(f.de, 22) + w(f.a, 22) + w(f.tipo, 12) + w(f.modelos, 20) + w(f.piezas, 9)
      + w(f.jugable === 'sí' ? '✅' : '✏️', 9) + f.ronda + (f.nota ? '  · ' + f.nota : ''));
  }
  const escondidas = filas.filter(f => f.ofrecida !== 'sí');
  if (escondidas.length) {
    console.log('\nOFRECIDAS PERO INVÁLIDAS (la app las esconde sola):');
    for (const f of escondidas) console.log(`  · ${f.de} → ${f.a} (${f.modelos})`);
  }
  console.log(`\nSIN NINGUNA SALIDA (su modelo no convierte a nada): ${sinSalida.length ? sinSalida.map(T => T.meta.label).join(' · ') : '(ninguna)'}`);
  if (pidenTrabajo.length) {
    console.log('\n✏️  PIDEN TRABAJO DEL PROFE (no es un fallo — la app lo avisa antes de crear la copia):');
    for (const t of pidenTrabajo) console.log('  ' + t);
  }
  console.log(`\nTOTAL: ${filas.filter(f => f.ofrecida === 'sí').length} conversiones ofrecidas · `
    + `${filas.filter(f => f.ofrecida === 'sí' && f.jugable === 'sí').length} salen listas para jugar · `
    + `${pidenTrabajo.length} piden completar algo · ${problemas.length} rotas`);
  if (problemas.length) {
    console.log('\n❌ PROBLEMAS:');
    for (const p of problemas) console.log('  ' + p);
  } else {
    console.log('✅ todas producen contenido jugable y sin pérdida de piezas');
  }
}

process.exit(problemas.length ? 1 : 0);
