// PocketBase (Pi 5). La dirección es PÚBLICA — aquí no hay secretos; la
// seguridad la ponen las reglas de colección de PocketBase.
//
// DOS NOMBRES PARA LA MISMA PI, y un interruptor para probar el nuevo sin
// cambiárselo a nadie. El motivo es de aula, no técnico: hoy la aplicación vive
// en `aulareto.com` y su servidor en `lanube.uno`, así que un colegio tiene que
// permitir DOS dominios, y el segundo no lo reconoce ningún filtro escolar. Un
// profe se quedó sin poder entrar por eso (2026-09-15: el filtro le sustituía el
// certificado de `pb.lanube.uno` y el navegador cortaba con
// `ERR_CERT_AUTHORITY_INVALID`, mientras la web cargaba sin problema). Con la
// API bajo el MISMO dominio que la web, permitir `aulareto.com` basta.
//
// ES UNA LISTA DE NOMBRES, NO UNA URL LIBRE, y esto no es un detalle: con un
// parámetro libre cualquiera podría mandarle a un profe un enlace que apunte la
// aplicación a un servidor falso y quedarse con su contraseña. Solo se aceptan
// los destinos que declara este fichero.
// Es un `Map` y no un objeto a propósito: con un objeto, `?pb=constructor` o
// `?pb=toString` encuentran algo en la cadena de prototipos; un `Map` solo
// conoce lo que se le ha puesto.
const SERVIDORES = new Map([
  ['actual', 'https://pb.lanube.uno'],     // el de siempre; lo comparten otros proyectos
  ['nuevo',  'https://api.aulareto.com'],  // el mismo PocketBase bajo el dominio de la web
]);
const POR_DEFECTO = 'actual';

function servidorElegido() {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('pb');
    const elegido = q ? SERVIDORES.get(q) : null;
    if (elegido) return elegido;
  } catch { /* sin `location` (Node, las suites): siempre el de siempre */ }
  return /** @type {string} */ (SERVIDORES.get(POR_DEFECTO));
}

export const PB_URL = servidorElegido();

// Client ID de OAuth de Google (PÚBLICO, no es secreto — el secret vive solo en
// PocketBase). Se usa para pedir permisos de Google Classroom bajo demanda vía
// Google Identity Services (autorización incremental), porque el token del login
// de PocketBase solo trae scopes básicos (email/perfil), no los de Classroom.
// Rellénalo con tu Client ID (…apps.googleusercontent.com). Vacío = el botón
// "Enviar a Classroom" avisará de que falta configurarlo.
// Ver docs/handoff-google-classroom.md (Fase B).
export const GOOGLE_CLIENT_ID = '12847638894-1e7kunkuvss2r530im0pdlkgg9crs5ql.apps.googleusercontent.com';
