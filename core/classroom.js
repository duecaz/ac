// Google Classroom (S4 / Fase B). Enviar una tarea de AulaReto a Classroom como
// "tarea con enlace": el alumno la abre desde Classroom y cae en el flujo de tarea
// de siempre (student.html#/task/:code). Sin sincronizar listas ni notas todavía.
//
// El token con scopes de Classroom se obtiene por autorización incremental (GIS,
// core/classroomAuth.js), NO del login de PocketBase (que solo trae email/perfil).
import { getClassroomToken } from './classroomAuth.js';

const API = 'https://classroom.googleapis.com/v1';

async function gapi(path, opts = {}, { retryConsent = true } = {}) {
  const token = await getClassroomToken();
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Error ${r.status}`;
    // 401/403 por scopes: el token cacheado no vale (permisos revocados o cambió el
    // set de scopes). Se fuerza el consentimiento UNA vez y se reintenta.
    if ((r.status === 401 || r.status === 403) && retryConsent) {
      await getClassroomToken({ forceConsent: true });
      return gapi(path, opts, { retryConsent: false });
    }
    throw Object.assign(new Error(msg), { code: r.status });
  }
  return data;
}

// Cursos donde el profe puede crear tareas (activos, rol de profesor). Google ya
// filtra por lo que el token puede ver; pedimos solo ACTIVE.
export async function listCourses() {
  const data = await gapi('/courses?courseStates=ACTIVE&pageSize=100&teacherId=me');
  return (data.courses || []).map(c => ({ id: c.id, name: c.name, section: c.section || '' }));
}

// Crea una tarea (courseWork) con un enlace a la actividad. dueAt opcional (ISO).
export async function createCourseworkLink(courseId, { title, description, link, dueAt } = {}) {
  const body = {
    title: title || 'Actividad de AulaReto',
    description: description || 'Abre el enlace para hacer la actividad.',
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
    materials: [{ link: { url: link } }],
  };
  // Classroom quiere la fecha partida en dueDate (UTC) + dueTime.
  if (dueAt) {
    const d = new Date(dueAt);
    if (!isNaN(d)) {
      body.dueDate = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
      body.dueTime = { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
    }
  }
  const data = await gapi(`/courses/${courseId}/courseWork`, { method: 'POST', body: JSON.stringify(body) });
  return { id: data.id, link: data.alternateLink || null };
}
