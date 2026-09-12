// Auth facade. PocketBase email/password auth.
import { PB_URL } from '../pocketbase.config.js';
import { clock } from './clock.js';
import { lsGet, lsSet, lsDel, ssGet, ssSet, ssDel } from './ls.js';
import { mensajeDe } from './frontera.js';
/**
 * EL USUARIO tal y como lo devuelve PocketBase (`record` de la colección
 * `users`). No vive en `kernel/contracts/`: la sesión del PROFE es de la
 * plataforma, no del dominio de jugar, y este módulo es su dueño (§21).
 * `Role` con mayúscula es la tolerancia histórica del campo en la Pi.
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} [email]
 * @property {string} [name]
 * @property {string} [avatar]
 * @property {string} [role]
 * @property {string} [Role]
 * @property {boolean} [verified]
 * @property {string} [created]
 * @property {string} [updated]
 */

/**
 * Lo que se guarda en el almacén bajo `ww.pb.auth`. FRONTERA: sale de un
 * `JSON.parse`, así que se lee con `?.` en todos sus lectores.
 * @typedef {{token?: string, record?: AuthUser}} StoredAuth
 */

/**
 * Lo que Google devuelve a través de PocketBase (`meta` de auth-with-oauth2).
 * @typedef {Object} OAuthMeta
 * @property {string} [accessToken]
 * @property {string|null} [expiry]
 * @property {string} [avatarURL]
 * @property {string} [avatarUrl]
 * @property {string} [avatar]
 * @property {string} [picture]
 * @property {{picture?: string}} [rawUser]
 */

/**
 * La respuesta de los endpoints de auth de PocketBase.
 * @typedef {{token: string, record: AuthUser, meta?: OAuthMeta}} AuthResponse
 */

/**
 * Un proveedor OAuth habilitado en PB (`auth-methods`).
 * @typedef {Object} OAuthProvider
 * @property {string} name
 * @property {string} state
 * @property {string} codeVerifier
 * @property {string} authURL
 */

/**
 * El login de Google a medias, guardado en la sesión del navegador mientras se
 * va y se vuelve del consentimiento.
 * @typedef {Object} PendingOAuth
 * @property {string} provider
 * @property {string} state
 * @property {string} codeVerifier
 * @property {string} redirectUrl
 * @property {boolean} [link]
 * @property {string} [returnHash]
 */

/** @typedef {{user: AuthUser|null, profile: null}} AuthChange */

const STORE_KEY = 'ww.pb.auth';
/** @type {AuthUser|null} */
let _user = null;
/** @type {Set<(e: AuthChange) => void>} */
const listeners = new Set();

/** ¿ESTE TOKEN YA CADUCÓ? El token lleva la fecha DENTRO (es un JWT: su carga
 *  trae `exp`), así que se puede saber sin preguntarle a nadie.
 *
 *  Existe porque `authRefresh()` —que limpia la sesión muerta con un 401— pide
 *  RED, y mientras no contesta (o si el wifi del colegio no va) la app ya ha
 *  decidido que hay sesión: `getAuthUserId()` es SÍNCRONO y lo leen el gate de
 *  modos, la tarjeta y «a dónde te lleva terminar». Con la sesión vieja de un
 *  profe en la PC del aula, el siguiente que jugaba acababa en «Mis
 *  actividades» —la pantalla de OTRO— y con los mandos de profe abiertos.
 *  Reportado desde un colegio (v1.51.623) y reproducido: con un token caducado
 *  la app respondía `canHost: true` y `destino: #/mine`.
 *
 *  Prudente a propósito: si el token no es un JWT o su carga no se puede leer,
 *  NO se juzga (decide `authRefresh` cuando haya red). Solo se descarta lo que
 *  dice de sí mismo que está muerto. */
/** @param {string|null|undefined} token */
function tokenCaducado(token) {
  try {
    const carga = String(token || '').split('.')[1];
    if (!carga) return false;
    const json = /** @type {{exp?: unknown}} */ (
      JSON.parse(atob(carga.replace(/-/g, '+').replace(/_/g, '/'))));
    const exp = json?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
    // Margen de un minuto: un reloj local un poco adelantado no debe echar a
    // nadie de su sesión a mitad de clase.
    return exp * 1000 + 60000 <= clock.now();
  } catch { return false; }
}

/** @returns {StoredAuth|null} */
function loadStored() {
  try {
    const guardado = /** @type {StoredAuth|null} */ (JSON.parse(lsGet(STORE_KEY) || 'null'));
    if (guardado?.token && tokenCaducado(guardado.token)) {
      // Se BORRA, no solo se ignora: si se quedara, cada lectura volvería a
      // pagar el parseo y —peor— cualquier código que lea la clave a mano
      // seguiría viendo una sesión que no existe.
      clearStored(); _user = null;
      return null;
    }
    return guardado;
  } catch { return null; }
}

/**
 * @param {string} token
 * @param {AuthUser} record
 */
function saveStored(token, record) {
  lsSet(STORE_KEY, JSON.stringify({ token, record }));
}

function clearStored() {
  lsDel(STORE_KEY);
}

/** @returns {Promise<AuthUser|null>} */
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
  const rec = loadStored()?.record;
  return rec?.name || (rec?.email ? rec.email.split('@')[0] : null);
}
// Rol del profe (campo `role` del record de usuario en PB). 'admin' → puede
// moderar/editar/borrar cualquier actividad y ver los reportes (S3).
export function getAuthRole() {
  // Tolerante a la mayúscula del campo (role / Role): el CLIENTE funciona con
  // cualquiera. OJO: las REGLAS de PocketBase usan `@request.auth.role` (minúscula),
  // así que para que el servidor también te reconozca como admin el campo en PB
  // debe llamarse `role` en minúscula.
  const rec = loadStored()?.record;
  return rec?.role || rec?.Role || null;
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
    if (!r.ok) return stored.record ?? null; // error transitorio (red/5xx): conserva la sesión
    const data = /** @type {AuthResponse} */ (await r.json());
    _user = data.record;
    saveStored(data.token, data.record);
    notify();
    return data.record;
  } catch { return stored.record ?? null; /* sin red: conserva lo guardado */ }
}


/**
 * @param {string} path
 * @param {Record<string, unknown>} body
 * @returns {Promise<AuthResponse>}
 */
async function pbPost(path, body) {
  const r = await fetch(`${PB_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = /** @type {AuthResponse & {message?: string}} */ (
    await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
  return data;
}

// ALTA PÚBLICA por correo — REABIERTA por decisión del dueño (2026-08-11): no
// todos los profes tienen Google (o lo tienen capado por el colegio). U1 la
// había cerrado; ahora el createRule del servidor permite el alta anónima PERO
// prohíbe traer `role` en el cuerpo (nadie se registra como admin) — la regla
// vive en tools/setup-pocketbase.ps1 (Apply-Users) y hay que re-aplicarla.
// Crea la cuenta e INICIA sesión con ella (a diferencia de createTeacher).
/**
 * @param {string} email
 * @param {string} password
 * @param {string} [name]
 */
export async function signUp(email, password, name) {
  if (!password || password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  const r = await fetch(`${PB_URL}/api/collections/users/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordConfirm: password, name: name || email.split('@')[0] }),
  });
  const data = /** @type {{id?: string, message?: string, data?: Record<string, {message?: string}>}} */ (
    await r.json().catch(() => ({})));
  if (!r.ok) {
    // Los 400 de PB traen el detalle por campo; el del email repetido es el
    // que más va a salir y merece frase propia.
    const emailErr = data?.data?.email?.message || '';
    if (/unique|already/i.test(emailErr) || r.status === 400 && /email/i.test(JSON.stringify(data?.data || {})))
      throw new Error('Ya existe una cuenta con ese correo. Prueba a entrar, o recupera la contraseña.');
    throw new Error(data?.message || `No se pudo crear la cuenta (error ${r.status}).`);
  }
  await signIn(email, password);
  return { ok: true, id: data.id };
}

// «Olvidé mi contraseña»: PB envía el correo de restablecimiento… si el servidor
// tiene SMTP configurado. Responde 204 igual (no filtra si el correo existe),
// así que el mensaje al usuario debe ser honesto sobre la espera.
/** @param {string} email */
export async function requestPasswordReset(email) {
  const r = await fetch(`${PB_URL}/api/collections/users/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!r.ok && r.status !== 204) throw new Error(`No se pudo pedir el restablecimiento (error ${r.status}).`);
  return true;
}

// Crea una cuenta de profe SIN iniciar sesión como ella (la usa el admin para
// provisionar accesos de pizarra: correo + contraseña sencilla). No toca la sesión
// actual del admin. Como el createRule de `users` ahora es admin-only (U1), la
// petición se FIRMA con el token del admin logueado.
/**
 * @param {string} email
 * @param {string} password
 * @param {string} [name]
 */
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
  const data = /** @type {{id?: string, message?: string}} */ (
    await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
  return { ok: true, id: data.id };
}

/**
 * @param {string} email
 * @param {string} password
 */
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
/** @returns {Promise<OAuthProvider[]>} */
export async function listOAuthProviders() {
  try {
    const r = await fetch(`${PB_URL}/api/collections/users/auth-methods`);
    if (!r.ok) return [];
    const data = /** @type {{oauth2?: {providers?: OAuthProvider[]}, authProviders?: OAuthProvider[]}} */ (
      await r.json());
    return data?.oauth2?.providers || data?.authProviders || [];
  } catch { return []; }
}

// LA URI DE VUELTA — una sola, y SIEMPRE `teacher.html`.
//
// Google exige que coincida EXACTAMENTE con una "Authorized redirect URI"
// registrada en su consola; cualquier otra cosa da el error 400
// `redirect_uri_mismatch` en su propia página, donde la app ya no puede
// explicar nada. Por eso aquí se fija UNA:
//   · `/teacher` → `/teacher.html`: GitHub Pages sirve la misma página con y sin
//     extensión, y entrar por la corta mandaba una URI no registrada.
//   · desde CUALQUIER otra página (index.html, student.html) se vuelve también
//     a teacher.html — que además es la ÚNICA que sabe canjear el código: sin
//     esto, un botón de entrar en otra página mandaría una URI que ni está
//     registrada ni completaría el login.
// El hash (#/edit-new/quiz) nunca viaja a Google; se guarda aparte y se
// restaura al volver.
export function oauthRedirectUrl() {
  const dir = location.pathname.replace(/\/teacher\/?$/, '/').replace(/[^/]*$/, '');
  return location.origin + dir + 'teacher.html';
}

// Paso 1: pide a PB los datos del proveedor (authURL/state/codeVerifier), guarda
// lo necesario para el retorno y redirige al consentimiento de Google.
/**
 * @param {string} [providerName]
 * @param {string} [redirectUrl]
 * @param {{link?: boolean}} [opts]
 */
async function startOAuthLogin(providerName = 'google', redirectUrl = oauthRedirectUrl(), { link = false } = {}) {
  const provs = await listOAuthProviders();
  const p = provs.find(x => x.name === providerName);
  if (!p) throw new Error(`El proveedor "${providerName}" no está habilitado en PocketBase (Settings → Auth providers).`);
  ssSet(OAUTH_KEY, JSON.stringify({
    provider: providerName, state: p.state, codeVerifier: p.codeVerifier, redirectUrl,
    // `link`: VINCULAR Google a la cuenta ya iniciada (los que entraron por
    // correo/clave) en vez de crear/entrar. Al volver, se firma el intercambio con
    // el token actual → PB asocia el proveedor a ESE usuario.
    link: !!link,
    // Dónde estaba el profe (ruta hash) para devolverlo ahí tras el login — Google
    // no preserva el #hash en el retorno, así que lo guardamos nosotros.
    returnHash: location.hash || '',
  }));
  // authURL viene con `redirect_uri=` al final (sin valor); se lo añadimos.
  location.href = p.authURL + encodeURIComponent(redirectUrl);
}

// Vincular Google a la cuenta actual (correo/clave). Requiere sesión iniciada.
export async function linkGoogle() {
  if (!getAuthToken()) throw new Error('Inicia sesión primero.');
  return startOAuthLogin('google', oauthRedirectUrl(), { link: true });
}

/** @returns {PendingOAuth|null} */
function pendingOAuth() {
  try { return /** @type {PendingOAuth|null} */ (JSON.parse(ssGet(OAUTH_KEY) || 'null')); } catch { return null; }
}

// Paso 2 (al volver de Google con ?code&state): valida el state y canjea el code
// en PB. Deja la sesión iniciada y guarda el accessToken de Google si vino.
/**
 * @param {string} code
 * @param {string|null|undefined} returnedState
 */
export async function completeOAuthLogin(code, returnedState) {
  const pending = pendingOAuth();
  ssDel(OAUTH_KEY);
  if (!pending) throw new Error('No hay un login de Google en curso.');
  if (returnedState !== pending.state) throw new Error('Estado OAuth no coincide (posible CSRF); reintenta el login.');
  // VINCULAR (los que entraron por correo): firmamos el intercambio con el token
  // actual → PB asocia Google a ESE usuario en vez de crear otro. Sin `link`, es
  // un login normal (sin Authorization).
  const linkToken = pending.link ? getAuthToken() : null;
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json' };
  if (linkToken) headers.Authorization = linkToken;
  const r = await fetch(`${PB_URL}/api/collections/users/auth-with-oauth2`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: pending.provider,
      code,
      codeVerifier: pending.codeVerifier,
      redirectURL: pending.redirectUrl,
    }),
  });
  const data = /** @type {AuthResponse & {message?: string, data?: Record<string, unknown>}} */ (
    await r.json().catch(() => ({})));
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
    ssSet(GOOGLE_TOKEN_KEY, JSON.stringify({ accessToken: data.meta.accessToken, expiry: data.meta.expiry || null }));
  }
  // Sella nombre + foto de Google en la colección pública `profiles` (merge, no
  // pisa colegio/frase). PB devuelve la URL de la foto en meta.avatarURL/avatarUrl.
  try {
    const avatar = data.meta?.avatarURL || data.meta?.avatarUrl || data.meta?.avatar || data.meta?.picture || data.meta?.rawUser?.picture || '';
    const name = data.record?.name || (data.record?.email ? data.record.email.split('@')[0] : '');
    if (data.record?.id && (avatar || name)) {
      const { saveProfile } = await import('./profile.js');
      saveProfile(data.record.id, { ...(name ? { name } : {}), ...(avatar ? { avatar } : {}) })
        .catch(e => console.warn('[auth] no se pudo sellar el perfil público:',
          mensajeDe(e)));
    }
  } catch (e) {
    // Best-effort DECLARADO (R6): que falle el sello del perfil NO puede tumbar
    // un login que ya está hecho — pero se dice, o el profe se pregunta por qué
    // sale sin foto y no hay ni rastro de por qué.
    console.warn('[auth] perfil público no sellado tras el login de Google:',
      mensajeDe(e));
  }
  notify();
  return { ...data, returnHash: pending.returnHash || '' };
}

// Token de acceso de Google de la sesión actual (para llamar a la API de
// Classroom en Fase B). Null si no hay o no vino. Caduca ~1 h.
export function getGoogleAccessToken() {
  try {
    const t = /** @type {{accessToken?: string, expiry?: string|null}|null} */ (
      JSON.parse(ssGet(GOOGLE_TOKEN_KEY) || 'null'));
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
  ssDel(GOOGLE_TOKEN_KEY);
  notify();
}


// Cambia la contraseña del profe. PB exige la actual (`oldPassword`). Al cambiarla
// PB revoca el token, así que re-autenticamos con la nueva para no cerrar sesión.
/**
 * @param {string} oldPassword
 * @param {string} newPassword
 */
export async function changePassword(oldPassword, newPassword) {
  const u = await getUser();
  if (!u) throw new Error('Inicia sesión primero.');
  if (!u.email) throw new Error('Esta cuenta no tiene correo (entró por Google). Pon una contraseña desde tu proveedor.');
  if (!newPassword || newPassword.length < 8) throw new Error('La contraseña nueva debe tener al menos 8 caracteres.');
  const stored = loadStored();
  const r = await fetch(`${PB_URL}/api/collections/users/records/${u.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(stored?.token ? { Authorization: stored.token } : {}) },
    body: JSON.stringify({ oldPassword, password: newPassword, passwordConfirm: newPassword }),
  });
  const data = /** @type {{message?: string}} */ (await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(data?.message || (r.status === 400 ? 'La contraseña actual no es correcta.' : `Error ${r.status}`));
  // Re-autentica con la nueva clave → token fresco (PB revocó el anterior).
  await signIn(u.email, newPassword);
  return true;
}


/** @param {(e: AuthChange) => void} fn */
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { for (const fn of listeners) fn({ user: _user, profile: null }); }
