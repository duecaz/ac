// Construcción segura de filtros de PocketBase.
//
// Por qué existe: `encodeURIComponent` NO escapa la comilla simple, así que un
// valor con apóstrofo (un código, un id o un nombre pegado) rompía — o podía
// inyectar en — el filtro `field='valor'`. Antes esto se reimplementaba a mano
// (bien en realtime.js, mal/ausente en assignments.js). Centralizado aquí:
//
//   pbEscape(v)        → escapa comillas simples del VALOR.
//   pbFilterParam(expr)→ url-encodea la expresión COMPLETA para `?filter=`.
//
// Uso: `?filter=${pbFilterParam(`code='${pbEscape(code)}'`)}`

export const pbEscape = (v) => String(v ?? '').replace(/'/g, "\\'");

export const pbFilterParam = (expr) => encodeURIComponent(String(expr ?? ''));
