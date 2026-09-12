// LA MÁQUINA SSE de la sala en vivo — una cosa: mantener ABIERTO un flujo de
// eventos de PocketBase y traducir lo que llega a `RoomChange`.
//
// Vivía dentro de `realtime.js` (que además ensambla las cuatro secciones por
// colección). Aquí no hay ni una llamada REST ni una regla de negocio: solo
// conexión, reconexión con backoff, renovación preventiva (§23: el reloj va por
// su primitivo, `core/streamWatchdog.js`) y el reenvío de cambios.
//
// No toca fronteras de datos: quien LEE las colecciones sigue siendo la sección
// que las posee (§21); esto solo avisa de "algo cambió, re-lee".
import { PB_URL } from '../../pocketbase.config.js';
import { startStreamWatchdog } from '../../core/streamWatchdog.js';
import { setConnectionState } from '../../core/connection.js';
import { fila, texto } from '../frontera.js';

/**
 * @typedef {import('../../kernel/contracts/session.js').RoomChange} RoomChange
 */

// 80 s va por debajo del corte por inactividad más común en un intermediario
// (Cloudflare cierra a los 100 s).
//
// OJO con la premisa: escribí que «un flujo vivo nunca llega a 80 s porque el
// host sella `host_seen_at` cada ~10 s», y es FALSO en este adaptador —
// `pingHost()` es un no-op aquí. Así que en los tramos tranquilos (lobby,
// ventana de lectura, carrera sin envíos) la renovación NO es excepcional: es
// rutina, cada 80 s y en cada aparato. Eso es justo lo que evita el corte, pero
// cuesta un POST de suscripción y un `resync` por cliente.
//
// QUÉ HACER CON LA PESTAÑA OCULTA lo decide el PRIMITIVO (§23), no este
// adaptador: `pausarOculto` no gasta con la pantalla apagada y, al volver a
// primer plano, renueva solo si hubo silencio de verdad. Y `jitterMs` reparte
// las reconexiones: cuando el profe dice «sacad el móvil», 30 aparatos disparan
// `visibilitychange` en el mismo segundo y la Pi —que además sirve a otros dos
// proyectos— recibía las 30 de golpe. Aquí solo queda el UMBRAL, que es lo único
// de PocketBase.
const SILENCIO_MAX = 80000;

/**
 * Fábrica de `subscribeRoom` para el adaptador PocketBase.
 *
 * @param {object} deps
 * @param {string} deps.COLL  colección de la sala (`live_sessions`)
 * @param {string} deps.PLR   colección del roster (`live_players`)
 * @param {() => Promise<boolean>} deps.playersReady ¿existe `live_players`?
 * @returns {(sessionId: string, onChange: (change: RoomChange) => void) => (() => void)}
 */
export function crearSuscripcionSala({ COLL, PLR, playersReady }) {
  // PocketBase SSE realtime. Subscribes to the specific live_sessions record.
  // On any update, notifies the view with all three table types so it re-fetches
  // players, answers, and session state (all live in the same PB record).
  return function subscribeRoom(sessionId, onChange) {
    const topic = `${COLL}/${sessionId}`;
    let active = true;
    /** @type {EventSource|null} */
    let es = null;
    let retries = 0;          // consecutive failed connection attempts
    /** @type {ReturnType<typeof setTimeout>|null} */
    let retryTimer = null;
    /** @type {ReturnType<typeof startStreamWatchdog>|null} */
    let vigia = null;         // renovación preventiva (core/streamWatchdog.js)

    // Exponential backoff with jitter, capped at 30s. The native EventSource
    // reconnect hammers a downed server every ~3s; this backs off instead so
    // a PocketBase outage doesn't flood it with reconnects from every client.
    function backoffDelay() {
      const base = Math.min(30000, 1000 * 2 ** Math.min(retries, 5)); // 1,2,4,8,16,30…
      return base / 2 + Math.random() * (base / 2);                   // 50–100% jitter
    }

    function scheduleReconnect() {
      if (!active || retryTimer) return;
      const delay = backoffDelay();
      retries++;
      console.warn(`[realtime] reconnecting in ${Math.round(delay)}ms (attempt ${retries})`);
      // Surface the sticky "Reconectando…" banner (debounced inside connection.js
      // so brief blips during normal heartbeats don't flash it). After several
      // failed attempts, escalate to "Conexión perdida" so the user knows it's
      // not just a momentary blip.
      try { setConnectionState(retries >= 5 ? 'error' : 'reconnecting'); } catch {}
      retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
    }

    // Re-fetch all virtual tables. SSE only delivers CHANGES, so anything the
    // host changed while we were disconnected was never delivered; firing this
    // on every (re)connect makes a reconnecting student catch up instead of
    // staying stuck on a stale question.
    /** @param {string} reason */
    function resync(reason) {
      onChange({ table: 'sessions', eventType: reason });
      onChange({ table: 'players', eventType: reason });
      onChange({ table: 'answers', eventType: reason });
    }

    // Tear down an EventSource so a superseded source can't keep firing its
    // onerror and spawn a second reconnect stream (orphaned ES hammering a
    // downed server). Detaching onerror BEFORE close is the key step.
    /** @param {EventSource|null} src */
    function teardown(src) {
      if (!src) return;
      src.onerror = null;
      try { src.close(); } catch {}
    }

    // RENOVAR ANTES DE QUE LO CORTEN (propuesta del dueño, 2026-08-16: «si es
    // por inactividad debería tener un aviso antes de cumplirse la
    // inactividad»). El porqué y el matiz de SSE están en el primitivo
    // (core/streamWatchdog.js); aquí solo se elige el umbral (SILENCIO_MAX).
    function pararVigia() { if (vigia) { vigia.stop(); vigia = null; } }
    function renovar() {
      if (!active) return;
      // Si estamos en pleno backoff (sin flujo y con reintento pendiente), la
      // renovación ADELANTA ese reintento en vez de no hacer nada: volver a
      // mirar el móvil con la pantalla congelada y esperar otros 30 s era lo
      // contrario de lo que el alumno espera.
      if (!es) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; connect(); }
        return;
      }
      // Sin ruido y sin banner: esto NO es un fallo, es mantenimiento.
      teardown(es);
      es = null;
      retries = 0;
      connect();
    }
    function armarVigia() {
      pararVigia();
      vigia = startStreamWatchdog({
        silencioMs: SILENCIO_MAX,
        pausarOculto: true,
        jitterMs: 2000,
        onRenew: renovar,
      });
    }

    function connect() {
      if (!active) return;
      teardown(es);
      const self = new EventSource(`${PB_URL}/api/realtime`);
      es = self;

      self.addEventListener('PB_CONNECT', async (/** @type {MessageEvent} */ e) => {
        if (!active || es !== self) return;
        retries = 0; // a successful handshake resets the backoff
        armarVigia();
        try { setConnectionState('connected'); } catch {}
        try {
          const clientId = texto(fila(JSON.parse(e.data)).clientId);
          // Suscribe también a live_players (deuda A) para que el lobby del
          // profe vea entrar gente al instante: los joins ya NO PATCHean el blob
          // (dejarían de disparar el topic de la sesión). Solo si la colección
          // existe — sin ella, suscribir un topic inexistente podría dejar el
          // POST connected-but-deaf en despliegues pre-migración.
          const subs = [topic];
          if (await playersReady()) subs.push(PLR);
          const r = await fetch(`${PB_URL}/api/realtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, subscriptions: subs }),
          });
          if (!r.ok) throw new Error(`subscribe HTTP ${r.status}`);
          resync('reconnect');
        } catch (err) {
          // PB_CONNECT fires once per connection; a failed subscribe would
          // leave us connected-but-deaf forever (no events, no error). Force a
          // fresh reconnect cycle instead of waiting for a PB_CONNECT that
          // will never come again.
          console.warn('[realtime] subscription POST failed — forcing reconnect:', err);
          if (es === self) { teardown(self); es = null; scheduleReconnect(); }
        }
      });

      self.addEventListener(topic, (/** @type {MessageEvent} */ e) => {
        if (!active || es !== self) return;
        vigia?.touch();
        try {
          const action = texto(fila(JSON.parse(e.data)).action);
          // All state is in one record: fire all three virtual tables so views
          // that listen for 'sessions', 'players', or 'answers' all re-fetch.
          onChange({ table: 'sessions', eventType: action });
          onChange({ table: 'players', eventType: action });
          onChange({ table: 'answers', eventType: action });
        } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, texto(e?.data).slice(0, 120)); }
      });

      // live_players (deuda A): un alumno entró/salió → el profe re-lee la
      // lista. El topic es la colección ENTERA (filtramos por sesión al
      // re-fetch en listPlayers); a escala colegio el ruido entre salas es
      // despreciable. Payload ignorado a propósito: forzamos un re-fetch.
      self.addEventListener(PLR, (/** @type {MessageEvent} */ e) => {
        if (!active || es !== self) return;
        vigia?.touch();
        try { onChange({ table: 'players', eventType: texto(fila(JSON.parse(e.data)).action) }); }
        catch { onChange({ table: 'players', eventType: '*' }); }
      });

      self.onerror = (err) => {
        if (es !== self) return; // a superseded source firing late — ignore
        // Take over reconnection from the native EventSource: close it and
        // reconnect on an exponential backoff so a downed server isn't flooded.
        console.warn('[realtime] SSE connection error — backing off before reconnect:', err);
        teardown(self);
        es = null;
        scheduleReconnect();
      };
    }

    connect();
    return () => {
      active = false;
      pararVigia();
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      teardown(es);
      es = null;
    };
  };
}
