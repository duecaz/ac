// Auth facade. PocketBase email/password auth.
import { PB_URL } from '../pocketbase.config.js';

const STORE_KEY = 'ww.pb.auth';
let _user = null;
const listeners = new Set();

function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}

function saveStored(token, record) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ token, record }));
}

function clearStored() {
  localStorage.removeItem(STORE_KEY);
}

export async function getUser() {
  if (_user !== null) return _user;
  const stored = loadStored();
  if (stored?.record) { _user = stored.record; return _user; }
  return null;
}

// Lectores SÍNCRONOS del token/usuario almacenado (los usa remoteStore para
// firmar las escrituras de actividades con el token del profe — Fase 0 de la
// seguridad PB). Devuelven null si no hay sesión.
export function getAuthToken() {
  return loadStored()?.token || null;
}
export function getAuthUserId() {
  return loadStored()?.record?.id || null;
}

// Refresca el token en el arranque (equivale a pb.authRefresh del SDK): valida y
// renueva el token guardado. Si PB responde 401 (sesión realmente expirada), se
// limpia la sesión para forzar re-login en vez de arrastrar un token muerto.
export async function authRefresh() {
  const stored = loadStored();
  if (!stored?.token) return null;
  try {
    const r = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: stored.token },
    });
    if (r.status === 401 || r.status === 403) { clearStored(); _user = null; notify(); return null; }
    if (!r.ok) return stored.record; // error transitorio (red/5xx): conserva la sesión
    const data = await r.json();
    _user = data.record;
    saveStored(data.token, data.record);
    notify();
    return data.record;
  } catch { return stored.record; /* sin red: conserva lo guardado */ }
}

export async function getProfile() {
  const u = await getUser();
  if (!u) return null;
  return { display_name: u.name || u.email?.split('@')[0] || null };
}

async function pbPost(path, body) {
  const r = await fetch(`${PB_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
  return data;
}

export async function signUp(email, password, displayName) {
  await pbPost('/api/collections/users/records', {
    email, password, passwordConfirm: password,
    name: displayName || email.split('@')[0],
  });
  return signIn(email, password);
}

export async function signIn(email, password) {
  const data = await pbPost('/api/collections/users/auth-with-password', {
    identity: email, password,
  });
  _user = data.record;
  saveStored(data.token, data.record);
  notify();
  return data;
}

export async function signInWithGoogle() {
  throw new Error('OAuth de Google no está configurado en este servidor PocketBase.');
}

export async function signOut() {
  _user = null;
  clearStored();
  notify();
}

export async function updateProfile(patch) {
  const u = await getUser();
  if (!u) throw new Error('not signed in');
  const stored = loadStored();
  const r = await fetch(`${PB_URL}/api/collections/users/records/${u.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(stored?.token ? { Authorization: `Bearer ${stored.token}` } : {}),
    },
    body: JSON.stringify({ name: patch.display_name ?? patch.name }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || 'Error al actualizar perfil');
  _user = data;
  saveStored(stored?.token, data);
  notify();
  return { display_name: data.name };
}

export function isAnonymous(user) {
  return !user || !user.email;
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { for (const fn of listeners) fn({ user: _user, profile: null }); }
