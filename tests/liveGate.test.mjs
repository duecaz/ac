// T2 · EL CINTURÓN DE LA PUERTA — un aparato con el reloj torcido puede llegar
// tarde, pero NUNCA quedarse fuera de la pregunta.
//
// El caso real (ronda del compañero, docs/handoff-reloj-aparatos.md): con el
// Android 25 s atrasado, al alumno no se le abrían las respuestas NUNCA — el
// móvil pintaba «Preparados… 34» sobre una lectura de 10 s mientras el profe
// liquidaba la pregunta «sin respuesta · 0 puntos». La corrección de verdad es
// la hora común (§22-5, core/serverNow.js); esto es la defensa en profundidad
// para el día que la corrección no esté: sin servidor, con la cabecera ilegible
// o con un móvil que derive a mitad de partida.
//
// Run: node tests/liveGate.test.mjs
import assert from 'node:assert';
import { questionGate } from '../core/liveGate.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const S = 1000;
const AHORA = 1_700_000_000_000;

// ── 1. El caso normal, intacto (contra-prueba de que no rompemos lo de hoy) ──
{
  const g = questionGate({ openAtMs: AHORA + 7 * S, deadlineMs: AHORA + 27 * S, now: AHORA, readMs: 10 * S });
  assert.strictEqual(g.reading, true, 'antes del instante de apertura se LEE');
  assert.strictEqual(g.waitMs, 7 * S, 'y se espera exactamente lo que falta');
  const g2 = questionGate({ openAtMs: AHORA - 1 * S, deadlineMs: AHORA + 19 * S, now: AHORA, readMs: 10 * S });
  assert.strictEqual(g2.reading, false, 'pasado el instante, la pregunta es jugable');
  assert.strictEqual(g2.waitMs, 0);
  ok('reloj en hora: la ventana de lectura se comporta exactamente igual que antes');
}

// ── 2. EL TOPE: la espera nunca supera la lectura configurada ────────────────
{
  // Móvil 25 s atrasado: cree que faltan 35 s para una lectura de 10 s.
  const g = questionGate({ openAtMs: AHORA + 35 * S, deadlineMs: AHORA + 55 * S, now: AHORA, readMs: 10 * S });
  assert.strictEqual(g.waitMs, 10 * S, 'la espera se ACOTA a la ventana de lectura declarada');
  assert.strictEqual(g.reading, true, 'sigue habiendo lectura: se acorta, no se anula');
  ok('un reloj atrasado ya no puede encerrar al alumno: espera 10 s como mucho, y juega');
}

// ── 3. Pregunta ya CERRADA: no se hace leer a nadie ──────────────────────────
{
  const g = questionGate({ openAtMs: AHORA + 30 * S, deadlineMs: AHORA - 1 * S, now: AHORA, readMs: 10 * S });
  assert.strictEqual(g.closed, true, 'el cierre se REPORTA (la vista decide qué pintar)');
  assert.strictEqual(g.reading, false, 'y no se espera a leer una pregunta que ya no admite respuesta');
  ok('pregunta vencida: la puerta no deja a nadie esperando por nada');
}

// ── 4. Sin ventana declarada y sin instantes: los bordes ─────────────────────
{
  assert.strictEqual(questionGate({ openAtMs: 0, now: AHORA, readMs: 10 * S }).reading, false,
    'sin `answers_open_at` (sala vieja, sin R-1) se juega directamente');
  assert.strictEqual(questionGate({ openAtMs: AHORA + 5 * S, now: AHORA, readMs: 0 }).reading, false,
    'lectura configurada a 0 = sin ventana: no se bloquea aunque el instante sea futuro');
  assert.strictEqual(questionGate({ openAtMs: AHORA + 5 * S, deadlineMs: 0, now: AHORA, readMs: 10 * S }).reading, true,
    'sin deadline (sala sin cierre) la lectura sigue valiendo');
  ok('bordes: sala sin R-1, lectura 0 y sala sin cierre se comportan como toca');
}

// ── 5. CONTRA-PRUEBA: sin el tope, el fallo de aula reaparece ────────────────
// Lo que hacía la vista antes, escrito aquí para que se vea la diferencia.
{
  const viejo = (openAtMs, now) => ({ reading: openAtMs > now, waitMs: openAtMs - now });
  const v = viejo(AHORA + 35 * S, AHORA);
  assert.strictEqual(v.waitMs, 35 * S, 'la resta cruda daba 35 s de espera sobre una lectura de 10 s');
  const nuevo = questionGate({ openAtMs: AHORA + 35 * S, deadlineMs: AHORA + 20 * S, now: AHORA, readMs: 10 * S });
  assert.strictEqual(nuevo.waitMs, 10 * S, 'con tope se espera la lectura, no la resta torcida');
  // Y esto es LO QUE SALVA LA CLASE: la pregunta cierra dentro de 20 s. Con la
  // fórmula vieja el alumno habría empezado a poder responder a los 35 s — 15 s
  // DESPUÉS del cierre, es decir, nunca. Con el tope llega a los 10 s y le
  // quedan otros 10 para contestar.
  assert.ok(AHORA + v.waitMs > AHORA + 20 * S, 'la espera vieja caía DESPUÉS del cierre: respuesta imposible');
  assert.ok(AHORA + nuevo.waitMs < AHORA + 20 * S, 'la acotada cae ANTES del cierre: el alumno llega a responder');
  ok('CONTRA-PRUEBA: la fórmula anterior abría al alumno DESPUÉS del cierre — por eso salía «sin respuesta · 0 puntos»');
}

console.log(`\n  ${passed} liveGate checks passed`);
