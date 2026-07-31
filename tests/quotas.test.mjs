// LEY §25 · CAPACIDAD — los límites existen, son UNO y el servidor aplica el
// que puede aplicar.
//
// Decisión D6 (docs/decisiones-pendientes.md): el servidor es una Raspberry Pi
// COMPARTIDA con otros proyectos y no había ningún tope — ni actividades por
// profe, ni tamaño real por actividad (200 KB por imagen, aviso a 1,5 MB… y el
// campo de PocketBase aceptando 5 MB), ni borrado de salas en vivo, que crecen
// para siempre. Aquí se fija que los números viven en UN sitio, que las tres
// copias del esquema (módulo · panel · script PowerShell) no divergen, y que la
// retención no puede llevarse por delante el registro del profe.
//
// Run: node tests/quotas.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { QUOTAS, activityBytes, checkActivitySize, checkActivityCount,
         liveRetentionCutoff, partitionByAge } from '../core/quotas.js';
import { ACTIVITY_SIZE_WARN_BYTES, activityTooLarge } from '../core/upload.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const ROOT = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// ── 1. Tamaño de actividad: aviso ANTES del tope, veredicto en el tope ──────
{
  const big = (bytes) => ({ id: 'a', pad: 'x'.repeat(Math.max(0, bytes - 20)) });
  assert.strictEqual(checkActivitySize(big(1000)).level, 'ok', 'una actividad pequeña pasa');
  const warn = checkActivitySize(big(Math.round(QUOTAS.activityBytes * 0.8)));
  assert.strictEqual(warn.level, 'warn', 'al 80% del tope se AVISA (antes de rebotar)');
  assert.ok(warn.msg.includes('MB'), 'y el aviso dice cuánto pesa');
  assert.ok(warn.ok, 'pero todavía se puede guardar');
  const over = checkActivitySize(big(QUOTAS.activityBytes + 5000));
  assert.strictEqual(over.level, 'over');
  assert.strictEqual(over.ok, false, 'pasado el tope, NO se puede guardar');
  assert.ok(/servidor NO/.test(over.msg), 'y se dice por qué: lo rechaza el servidor');
  assert.strictEqual(activityBytes('áé'), 4, 'los bytes son UTF-8 reales, no caracteres');
  ok('tamaño de actividad: ok → aviso → veredicto, con su frase');
}

// ── 1b. El aviso viejo de core/upload.js quedó DERIVADO, no copiado ─────────
{
  assert.strictEqual(ACTIVITY_SIZE_WARN_BYTES, QUOTAS.activityBytes * QUOTAS.activityWarnRatio,
    'el umbral de aviso se DERIVA del tope; si vuelve a ser un número suelto, divergirá');
  assert.strictEqual(activityTooLarge({ pad: 'x'.repeat(10) }), false);
  assert.strictEqual(activityTooLarge({ pad: 'x'.repeat(QUOTAS.activityBytes) }), true);
  const src = read('core/upload.js');
  assert.ok(!/200 \* 1024/.test(src), 'core/upload.js ya no lleva su propio 200 KB escrito a mano');
  ok('core/upload.js consume los números, no los declara');
}

// ── 2. Nº de actividades: AVISO declarado como aviso (§22) ─────────────────
{
  assert.strictEqual(checkActivityCount(3).level, 'ok');
  assert.strictEqual(checkActivityCount(Math.round(QUOTAS.activitiesPerTeacher * 0.9)).level, 'warn');
  const over = checkActivityCount(QUOTAS.activitiesPerTeacher + 1);
  assert.strictEqual(over.level, 'over');
  assert.ok(/compartido/.test(over.msg), 'el mensaje explica POR QUÉ hay tope (servidor compartido)');
  // Y está dicho en el módulo que el servidor no puede aplicarlo (honestidad §22).
  assert.match(read('core/quotas.js'), /AVISO, no un veredicto/,
    'el módulo declara que el nº de actividades no lo puede aplicar el servidor');
  ok('nº de actividades: aviso honesto (una regla de PB no sabe contar filas)');
}

// ── 3. El tope de TAMAÑO sí lo aplica el servidor, y sin copias ────────────
{
  const panel = read('views/adminView.js');
  assert.match(panel, /maxSize:\s*QUOTAS\.activityBytes/,
    'el panel #/admin toma el maxSize del campo `data` de core/quotas.js, no de un número escrito a mano');
  const ps1 = read('tools/setup-pocketbase.ps1');
  const m = ps1.match(/name="data";\s*type="json";\s*maxSize=(\d+)/);
  assert.ok(m, 'el script PowerShell declara el maxSize del campo data');
  assert.strictEqual(Number(m[1]), QUOTAS.activityBytes,
    `DIVERGENCIA: core/quotas.js dice ${QUOTAS.activityBytes} y setup-pocketbase.ps1 ${m[1]} — el mismo número en dos sitios`);
  ok('el tope de tamaño es el mismo en el módulo, el panel y el script');
}

// ── 4. Retención: qué es viejo se decide con reloj INYECTADO ───────────────
{
  const now = Date.UTC(2026, 0, 31);
  const cutoff = liveRetentionCutoff(now);
  const days = (now - Date.parse(cutoff)) / 86400000;
  assert.strictEqual(Math.round(days), QUOTAS.liveRetentionDays, 'el corte está a los días declarados');
  const iso = (d) => new Date(now - d * 86400000).toISOString();
  const { keep, purge } = partitionByAge([
    { id: 'vieja', created: iso(QUOTAS.liveRetentionDays + 1) },
    { id: 'justo', created: iso(QUOTAS.liveRetentionDays - 1) },
    { id: 'hoy', created: iso(0) },
    { id: 'sin-fecha' },
  ], cutoff);
  assert.deepStrictEqual(purge.map(r => r.id), ['vieja'], 'solo se purga lo anterior al corte');
  assert.deepStrictEqual(keep.map(r => r.id).sort(), ['hoy', 'justo', 'sin-fecha'],
    'una fila SIN fecha se conserva: ante la duda no se borra el dato del usuario (§24)');
  ok('retención: el corte es puro y testeable, y sin fecha no se borra');
}

// ── 5. La purga la ejecuta el DUEÑO (§21) y no toca el registro del profe ──
{
  for (const drv of ['adapters/pocketbase/realtime.js', 'adapters/local/realtime.js']) {
    const src = read(drv);
    assert.match(src, /async purgeOldLive\(/, `${drv} debe implementar purgeOldLive (contrato del puerto)`);
    assert.match(src, /dryRun/, `${drv}: la purga debe poder CONTAR sin borrar`);
  }
  const pb = read('adapters/pocketbase/realtime.js');
  const fn = pb.slice(pb.indexOf('async purgeOldLive('), pb.indexOf('async pingPresence('));
  for (const forbidden of ['results', 'assignment_attempts', 'activities']) {
    assert.ok(!new RegExp(`collections/${forbidden}`).test(fn),
      `la purga NUNCA debe tocar ${forbidden}: es el registro del profe sobre sus alumnos`);
  }
  // Y la vista no borra por su cuenta: se lo pide al transporte (ley de datos).
  const admin = read('views/adminView.js');
  assert.match(admin, /purgeOldLive\(cutoff/, 'el panel PIDE la purga al dueño');
  assert.ok(!/method:\s*'DELETE'/.test(admin), 'el panel no borra filas de PB por su cuenta');
  ok('la purga vive en el dueño de las colecciones y respeta results/intentos');
}

// ── 6. Las credenciales de HOY no se pueden borrar (robo de puesto) ────────
{
  const { RULES } = await import('../core/pbRules.js');
  const d = RULES.live_claims.deleteRule;
  assert.ok(d && d.includes('@request.auth.id'), 'borrar credenciales exige sesión de profe');
  assert.ok(d.includes('@todayStart'),
    'y solo las de días ANTERIORES: si se pudiera borrar la credencial viva de un jugador, se le robaría el puesto');
  for (const k of ['listRule', 'viewRule', 'updateRule']) {
    assert.strictEqual(RULES.live_claims[k], null, `live_claims.${k} sigue cerrada (§22-4)`);
  }
  ok('retención vs §22-4: se purgan credenciales viejas, nunca las de la partida en curso');
}

console.log(`\nquotas.test: ${passed} checks passed`);
