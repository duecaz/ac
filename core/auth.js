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
// Nombre visible del profe (para sellar el autor de las actividades y mostrarlo).
export function getAuthName() {
  const rec = loadStored()?.record || {};
  return rec.name || (rec.email ? rec.email.split('@')[0] : null);
}
// Rol del profe (campo `role` del record de usuario en PB). 'admin' → puede
// moderar/editar/borrar cualquier actividad y ver los reportes (S3).
export function getAuthRole() {
  // Tolerante a la mayúscula del campo (role / Role): el CLIENTE funciona con
  // cualquiera. OJO: las REGLAS de PocketBase usan `@request.auth.role` (minúscula),
  // así que para que el servidor también te reconozca como admin el campo en PB
  // debe llamarse `role` en minúscula.
  const rec = loadStored()?.record || {};
  return rec.role || rec.Role || null;
}
export function isAdmin() {
  return getAuthRole() === 'admin';
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

// Crea una cuenta de profe SIN iniciar sesión como ella (la usa el admin para
// provisionar accesos de pizarra: correo + contraseña sencilla). No toca la sesión
// actual del admin. Como el createRule de `users` ahora es admin-only (U1), la
// petición se FIRMA con el token del admin logueado.
export async function createTeacher(email, password, name) {
  const token = getAuthToken();
  const r = await fetch(`${PB_URL}/api/collections/users/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify({
      email, password, passwordConfirm: password,
      name: name || email.split('@')[0],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
  return { ok: true, id: data.id };
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

// ── OAuth2 (Google) — flujo por redirección contra PocketBase, sin SDK ────────
// PB hace el intercambio del `code` con Google usando el client_secret guardado
// en el servidor (nunca viaja al navegador). El token de acceso de Google vuelve
// en `meta.accessToken` → base para enviar tareas a Google Classroom (Fase B).
const OAUTH_KEY = 'ww.oauth.pending';       // { provider, state, codeVerifier, redirectUrl }
const GOOGLE_TOKEN_KEY = 'ww.google.token'; // { accessToken, expiry } (para Classroom)

// Lista los proveedores OAuth habilitados en PB. Tolera el cambio de forma entre
// PB <0.23 (`authProviders`) y ≥0.23 (`oauth2.providers`).
export async function listOAuthProviders() {
  try {
    const r = await fetch(`${PB_URL}/api/collections/users/auth-methods`);
    if (!r.ok) return [];
    const data = await r.json();
    return data?.oauth2?.providers || data?.authProviders || [];
  } catch { return []; }
}

// El origen+ruta actual, sin query ni hash — debe coincidir EXACTAMENTE con una
// "Authorized redirect URI" registrada en Google Cloud.
export function oauthRedirectUrl() {
  return location.origin + location.pathname;
}

// Paso 1: pide a PB los datos del proveedor (authURL/state/codeVerifier), guarda
// lo necesario para el retorno y redirige al consentimiento de Google.
export async function startOAuthLogin(providerName = 'google', redirectUrl = oauthRedirectUrl()) {
  const provs = await listOAuthProviders();
  const p = provs.find(x => x.name === providerName);
  if (!p) throw new Error(`El proveedor "${providerName}" no está habilitado en PocketBase (Settings → Auth providers).`);
  sessionStorage.setItem(OAUTH_KEY, JSON.stringify({
    provider: providerName, state: p.state, codeVerifier: p.codeVerifier, redirectUrl,
  }));
  // authURL viene con `redirect_uri=` al final (sin valor); se lo añadimos.
  location.href = p.authURL + encodeURIComponent(redirectUrl);
}

export function pendingOAuth() {
  try { return JSON.parse(sessionStorage.getItem(OAUTH_KEY)); } catch { return null; }
}

// Paso 2 (al volver de Google con ?code&state): valida el state y canjea el code
// en PB. Deja la sesión iniciada y guarda el accessToken de Google si vino.
export async function completeOAuthLogin(code, returnedState) {
  const pending = pendingOAuth();
  sessionStorage.removeItem(OAUTH_KEY);
  if (!pending) throw new Error('No hay un login de Google en curso.');
  if (returnedState !== pending.state) throw new Error('Estado OAuth no coincide (posible CSRF); reintenta el login.');
  const r = await fetch(`${PB_URL}/api/collections/users/auth-with-oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: pending.provider,
      code,
      codeVerifier: pending.codeVerifier,
      redirectURL: pending.redirectUrl,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // "Failed to fetch OAuth2 token" = PB no pudo canjear el code con Google
    // (client_secret cambiado, redirect_uri no registrada, etc.). Volcamos TODO
    // a la consola para diagnosticar sin depender de los logs del servidor, y
    // añadimos cualquier detalle anidado que PB devuelva al mensaje visible.
    console.error('[oauth] auth-with-oauth2 falló', r.status, data, { redirectURL: pending.redirectUrl });
    const nested = data?.data && Object.keys(data.data).length ? ' — ' + JSON.stringify(data.data) : '';
    throw new Error((data?.message || `Error ${r.status} al completar el login con Google`) + nested);
  }
  _user = data.record;
  saveStored(data.token, data.record);
  if (data.meta?.accessToken) {
    try { sessionStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({ accessToken: data.meta.accessToken, expiry: data.meta.expiry || null })); } catch {}
  }
  notify();
  return data;
}

// Token de acceso de Google de la sesión actual (para llamar a la API de
// Classroom en Fase B). Null si no hay o no vino. Caduca ~1 h.
export function getGoogleAccessToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(GOOGLE_TOKEN_KEY));
    if (!t?.accessToken) return null;
    if (t.expiry && new Date(t.expiry).getTime() < Date.now()) return null;
    return t.accessToken;
  } catch { return null; }
}

// Compat: el botón "Entrar con Google" llama aquí.
export async function signInWithGoogle() {
  return startOAuthLogin('google');
}

export async function signOut() {
  _user = null;
  clearStored();
  try { sessionStorage.removeItem(GOOGLE_TOKEN_KEY); } catch {}
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
