// Autorización incremental para Google Classroom (S4). El token del login de
// PocketBase solo trae scopes básicos (email/perfil), así que para llamar a la API
// de Classroom pedimos un token ESPECÍFICO con los scopes de Classroom usando
// Google Identity Services (GIS), sin pasar por PocketBase. El client_id es público
// (GOOGLE_CLIENT_ID en pocketbase.config.js); el client_secret nunca se usa aquí.
//
// Flujo: la primera vez que el profe pulsa "Enviar a Classroom" Google muestra el
// consentimiento de esos permisos; luego el token se cachea en sessionStorage (~55
// min). Ver docs/handoff-google-classroom.md.
import { GOOGLE_CLIENT_ID } from '../pocketbase.config.js';
import { ssGet, ssSet } from './ls.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CACHE_KEY = 'ww.classroom.token'; // { accessToken, expiry }
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
].join(' ');

let _gisLoading = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (_gisLoading) return _gisLoading;
  _gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar Google Identity Services (¿sin conexión?).'));
    document.head.appendChild(s);
  });
  return _gisLoading;
}

function cached() {
  try {
    const t = JSON.parse(ssGet(CACHE_KEY));
    if (t?.accessToken && (!t.expiry || t.expiry > Date.now())) return t.accessToken;
  } catch {}
  return null;
}

// Devuelve un access token con scopes de Classroom, pidiéndolo a Google si hace
// falta (muestra el consentimiento la primera vez). Lanza con mensaje claro si
// falta el client_id o el usuario cancela.
export async function getClassroomToken({ forceConsent = false } = {}) {
  if (!forceConsent) { const c = cached(); if (c) return c; }
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Falta el Client ID de Google (GOOGLE_CLIENT_ID en pocketbase.config.js) para usar Classroom.');
  }
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      prompt: forceConsent ? 'consent' : '',
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        const expiry = Date.now() + (Number(resp.expires_in || 3300) - 300) * 1000; // margen 5 min
        ssSet(CACHE_KEY, JSON.stringify({ accessToken: resp.access_token, expiry }));
        resolve(resp.access_token);
      },
    });
    try { client.requestAccessToken(); }
    catch (e) { reject(e); }
  });
}

