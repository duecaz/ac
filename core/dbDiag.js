// Diagnóstico de base de datos EN VIVO para la página Admin. Prueba la conexión
// real al backend activo (local / pocketbase / supabase) midiendo latencia y
// verificando un ciclo CRUD completo con un registro temporal que se borra al
// final. Pensado para confirmar, tras un deploy, que la BD responde y que
// lectura/escritura/borrado funcionan de extremo a extremo.
import { getRemoteStore, backendName } from '../adapters/index.js';
import { PB_URL } from '../pocketbase.config.js';
import { VERSION } from './constants.js';
import { probeActivitiesPayload } from './storage.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function pbDetail(e) {
  const pb = e?.pb;
  if (!pb) return '';
  const data = pb.data;
  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    const parts = Object.entries(data).map(([k, v]) =>
      `${k}: ${v?.message || v?.code || JSON.stringify(v)}`);
    return ' → ' + parts.join(' · ');
  }
  return ' · PB: ' + JSON.stringify(pb).slice(0, 400);
}

async function timed(fn) {
  const t0 = now();
  const value = await fn();
  return { ms: Math.round(now() - t0), value };
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}

function rttLabel(ms) {
  if (ms < 40)  return 'Excelente (<40 ms)';
  if (ms < 100) return 'Buena (<100 ms)';
  if (ms < 250) return 'Aceptable (<250 ms) — carga inicial puede verse lenta';
  return `Lenta (${ms} ms) — cada petición HTTP suma esta demora × veces`;
}

/**
 * Corre los chequeos de BD uno a uno. Por cada paso llama a onStep (streaming).
 * Cada paso: { name, pass, ms?, info? }.
 * @param {(step)=>void} [onStep]
 * @returns {Promise<Array>}
 */
export async function diagnoseDb(onStep) {
  const out = [];
  const step = (r) => { out.push(r); onStep?.(r, out.length); return r; };
  const name = backendName();

  step({ name: 'Versión de la app', pass: true, info: `v${VERSION}` });
  step({ name: 'Backend activo', pass: true, info: name + (name === 'pocketbase' ? ` · ${PB_URL}` : '') });

  // ── 0. RTT: latencia pura de red (solo tiempo hasta la primera respuesta HTTP) ─
  if (name === 'pocketbase') {
    // Primer ping: incluye setup de conexión TCP/TLS. Puede ser más lento.
    let rtt1 = null;
    try {
      const { ms } = await timed(async () => {
        const r = await fetch(`${PB_URL}/api/health`);
        // Consumir cabeceras basta; body se descarta.
        await r.text();
      });
      rtt1 = ms;
    } catch {}

    // Segundo ping: conexión ya caliente (sin TCP handshake). Mide RTT real.
    let rtt2 = null;
    try {
      const { ms } = await timed(async () => {
        const r = await fetch(`${PB_URL}/api/health`);
        await r.text();
      });
      rtt2 = ms;
    } catch {}

    if (rtt2 !== null) {
      step({
        name: 'Latencia de red (RTT · 2.ª petición)',
        pass: rtt2 < 500,
        ms: rtt2,
        info: rttLabel(rtt2) + (rtt1 !== null ? ` · 1.ª petición: ${rtt1} ms (incluye setup TCP/TLS)` : ''),
      });
    } else if (rtt1 !== null) {
      step({ name: 'Latencia de red (RTT)', pass: rtt1 < 500, ms: rtt1, info: rttLabel(rtt1) });
    } else {
      step({ name: 'Latencia de red (RTT)', pass: false, info: 'No se pudo alcanzar el servidor' });
    }

    // ── 1. Salud del servidor ─────────────────────────────────────────────────
    try {
      const { ms, value } = await timed(async () => {
        const r = await fetch(`${PB_URL}/api/health`);
        const txt = await r.text();
        if (!r.ok) throw new Error('HTTP ' + r.status);
        try { return JSON.parse(txt); } catch { return { message: 'respuesta no-JSON' }; }
      });
      step({ name: 'Salud del servidor (/api/health)', pass: true, ms, info: value?.message || 'OK' });
    } catch (e) {
      step({ name: 'Salud del servidor (/api/health)', pass: false, info: e.message });
    }
  }

  // ── Cargar adaptador ──────────────────────────────────────────────────────
  let store;
  try {
    store = await getRemoteStore();
  } catch (e) {
    step({ name: 'Cargar adaptador', pass: false, info: e.message });
    return out;
  }

  // ── 2. Lectura con tamaño de payload (simula carga de la página de inicio) ─
  let listCount = 0;
  try {
    let payloadBytes = 0;
    const { ms, value } = await timed(async () => {
      // El TAMAÑO del payload lo mide el dueño de la colección (ley de datos §21):
      // este módulo es un diagnóstico, no el lector de `activities`.
      const probe = await probeActivitiesPayload();
      payloadBytes = probe.bytes || 0;
      return probe.items || [];
    });
    listCount = value.length;
    const throughput = payloadBytes > 0
      ? ` · ${fmtBytes(payloadBytes)} · ~${fmtBytes(Math.round(payloadBytes / (ms / 1000)))}/s`
      : '';
    const serverMs = name === 'pocketbase' && out.find(s => s.name.includes('RTT'))
      ? ` (red ~${out.find(s => s.name.includes('RTT')).ms} ms · procesamiento ~${Math.max(0, ms - out.find(s => s.name.includes('RTT')).ms)} ms)`
      : '';
    step({ name: 'Lectura (listActivities)', pass: true, ms, info: `${listCount} registros${throughput}${serverMs}` });
  } catch (e) {
    step({ name: 'Lectura (listActivities)', pass: false, info: e.message });
  }

  // ── 3. Ciclo CRUD completo ────────────────────────────────────────────────
  const tempId = 'diagtest' + Date.now().toString(36);
  const temp = {
    id: tempId, template: 'quiz', title: '__diag__',
    content: { items: [] }, visibility: 'unlisted', tags: ['__diag__'],
    language: 'es', updatedAt: new Date().toISOString(),
  };

  let wrote = false;
  try {
    const { ms } = await timed(() => store.saveActivity(temp));
    wrote = true;
    const hint = ms > 500 ? ' ⚠ escritura lenta — revisar modo WAL en PocketBase' : '';
    step({ name: 'Escritura (saveActivity)', pass: true, ms, info: `registro temporal creado${hint}` });
  } catch (e) {
    step({ name: 'Escritura (saveActivity)', pass: false, info: e.message + pbDetail(e) });
  }

  if (wrote) {
    try {
      const { ms, value } = await timed(() => store.getActivity(tempId));
      const ok = !!(value && value.id === tempId);
      step({ name: 'Lectura del registro (getActivity)', pass: ok, ms, info: ok ? 'round-trip OK' : 'no devolvió el registro' });
    } catch (e) {
      step({ name: 'Lectura del registro (getActivity)', pass: false, info: e.message });
    }
    try {
      const { ms } = await timed(() => store.deleteActivity(tempId));
      step({ name: 'Borrado (deleteActivity)', pass: true, ms, info: 'limpieza OK' });
    } catch (e) {
      step({ name: 'Borrado (deleteActivity)', pass: false, info: `no se pudo limpiar el registro temporal: ${e.message}` });
    }
  }

  // ── 4. Resultados ─────────────────────────────────────────────────────────
  try {
    const { ms, value } = await timed(() => store.listResults());
    step({ name: 'Lectura de resultados (listResults)', pass: true, ms, info: `${value.length} resultados` });
  } catch (e) {
    step({ name: 'Lectura de resultados (listResults)', pass: false, info: e.message + pbDetail(e) });
  }

  // ── 5. Resumen de latencia acumulada (simula carga real de la app) ─────────
  const rttStep = out.find(s => s.name.includes('RTT') && s.ms != null);
  const listStep = out.find(s => s.name.includes('listActivities') && s.ms != null);
  if (rttStep && listStep) {
    const rtt = rttStep.ms;
    // La página de inicio hace ~2 peticiones secuenciales (app boot + listActivities).
    // Total percibido ≈ latencias acumuladas.
    const estimated = rtt + listStep.ms;
    const feel = estimated < 400 ? 'rápida' : estimated < 800 ? 'notable' : 'lenta';
    step({
      name: 'Estimación carga página de inicio',
      pass: estimated < 1000,
      info: `≈ ${estimated} ms total percibido (red ${rtt} ms + datos ${listStep.ms} ms) · sensación: ${feel}`,
    });
  }

  return out;
}
