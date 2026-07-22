// PocketBase (Pi 5 @ pb.lanube.com). The URL is public — no secrets here.
// Security is enforced via PocketBase collection rules (API rules tab).
export const PB_URL = 'https://pb.lanube.uno';

// Client ID de OAuth de Google (PÚBLICO, no es secreto — el secret vive solo en
// PocketBase). Se usa para pedir permisos de Google Classroom bajo demanda vía
// Google Identity Services (autorización incremental), porque el token del login
// de PocketBase solo trae scopes básicos (email/perfil), no los de Classroom.
// Rellénalo con tu Client ID (…apps.googleusercontent.com). Vacío = el botón
// "Enviar a Classroom" avisará de que falta configurarlo.
// Ver docs/handoff-google-classroom.md (Fase B).
export const GOOGLE_CLIENT_ID = '';
