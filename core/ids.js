// Generación de IDs — ÚNICA fuente. Antes `Math.random().toString(36)` estaba
// copiado en ~17 sitios (cada editor/modelo con su `rid` local) con longitudes y
// prefijos dispares. Centralizado aquí:
//
//   rid('q_') → 'q_k3x9f2'   (prefijo + 6 chars base36)
//
// Convención de prefijos por modelo (vocabulario reservado, ver HOW_TO_ADD.md):
//   q_  ítem qa · p_ par · it_ ítem items · w_ palabra · ps_ pasaje · pin_ pin
//
// Módulo HOJA sin imports: lo pueden usar core/, kernel/ y templates/ sin ciclos.
// (Math.random es aceptable aquí: los IDs no necesitan ser deterministas en
// tests — la norma de kernel/ solo prohíbe el RELOJ no inyectable.)
export function rid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 8);
}
