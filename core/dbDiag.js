// Diagnóstico de base de datos EN VIVO para la página Admin. Prueba la conexión
// real al backend activo (local / pocketbase / supabase) midiendo latencia y
// verificando un ciclo CRUD completo con un registro temporal que se borra al
// final. Pensado para confirmar, tras un deploy, que la BD responde y que
// lectura/escritura/borrado funcionan de extremo a extremo.
import { getRemoteStore, backendName } from '../adapters/index.js';
import { PB_URL } from '../pocketbase.config.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Extrae el detalle campo-a-campo de un error de PocketBase. El RemoteStore
// adjunta el cuerpo del error como `e.pb` ({ message, data: { campo: {message} } }).
// Sin esto solo se ve "Failed to create record" sin saber QUÉ campo falló.
function pbDetail(e) {
  const data = e?.pb?.data;
  if (data && typeof data === 'object') {
    const parts = Object.entries(data).map(([k, v]) => `${k}: ${v?.message || v?.code || JSON.stringify(v)}`);
    if (parts.length) return ' → ' + parts.join(' · ');
  }
  if (e?.pb?.message && e.pb.message !== e.message) return ' → ' + e.pb.message;
  return '';
}

// Ejecuta `fn` midiendo cuánto tarda (ms). Devuelve { ms, value }.
async function timed(fn) {
  const t0 = now();
  const value = await fn();
  return { ms: Math.round(now() - t0), value };
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

  step({ name: 'Backend activo', pass: true, info: name + (name === 'pocketbase' ? ` · ${PB_URL}` : '') });

  // 1. Salud del servidor (solo PocketBase tiene /api/health).
  if (name === 'pocketbase') {
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

  // 2. Cargar el adaptador del backend activo.
  let store;
  try {
    store = await getRemoteStore();
  } catch (e) {
    step({ name: 'Cargar adaptador', pass: false, info: e.message });
    return out;
  }

  // 3. Lectura: listar actividades (mide latencia + cuántas hay).
  try {
    const { ms, value } = await timed(() => store.listActivities());
    step({ name: 'Lectura (listActivities)', pass: true, ms, info: `${value.length} registros` });
  } catch (e) {
    step({ name: 'Lectura (listActivities)', pass: false, info: e.message });
  }

  // 4. Ciclo CRUD con un registro temporal (__diag__) que se borra al final.
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
    step({ name: 'Escritura (saveActivity)', pass: true, ms, info: 'registro temporal creado' });
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

  // 5. Lectura de la colección de resultados (no destructivo).
  try {
    const { ms, value } = await timed(() => store.listResults());
    step({ name: 'Lectura de resultados (listResults)', pass: true, ms, info: `${value.length} resultados` });
  } catch (e) {
    step({ name: 'Lectura de resultados (listResults)', pass: false, info: e.message + pbDetail(e) });
  }

  return out;
}
