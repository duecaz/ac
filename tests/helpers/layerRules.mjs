// LAS REGLAS DE CAPA — dueño único, dos consumidores.
//
// Las usa `tests/layers.test.mjs` (para hacerlas cumplir) y `tools/module-map.mjs`
// (para dibujar en el diagrama qué aristas son legítimas y cuáles excepción).
// Si vivieran en el test, el diagrama tendría que copiarlas — y la copia acaba
// mintiendo, que es justo lo que este mapa existe para evitar.

// A QUIÉN PUEDE IMPORTAR CADA CAPA (además de a sí misma). La dirección legítima
// es siempre hacia abajo: lo de arriba sabe de lo de abajo, nunca al revés.
export const ALLOWED = {
  contenido:   ['core', 'kernel'],          // utilidades puras (ids, clock) + contratos
  plantillas:  ['core', 'contenido', 'kernel'],
  kernel:      ['core', 'contenido', 'config'],
  core:        ['kernel', 'contenido', 'config'],
  adaptadores: ['core', 'kernel', 'contenido', 'config'],
  vistas:      ['core', 'kernel', 'contenido', 'plantillas', 'adaptadores', 'config'],
  config:      [],                          // datos: no importa nada
  arranque:    ['core', 'kernel', 'contenido', 'plantillas', 'adaptadores', 'vistas', 'config'],
};

// EXCEPCIONES SANCIONADAS — `fichero→destino`, con su motivo. Cada una es una
// decisión consciente o una deuda declarada; nada entra aquí sin explicación, y
// la lista solo debería encoger. En el diagrama salen como flechas punteadas.
export const EXCEPTIONS = new Map(Object.entries({
  // El MODO monta su vista con `import()` DINÁMICO dentro de runMode(): la capa
  // de modo no conoce la vista al cargarse (sigue siendo pura y testeable en
  // Node), solo sabe montarla cuando el usuario elige ese modo.
  'core/modes.js→views/vsView.js': 'runMode(): import() dinámico al montar el modo',
  'core/modes.js→views/memoryView.js': 'runMode(): import() dinámico al montar el modo',
  'core/modes.js→views/teamsView.js': 'runMode(): import() dinámico al montar el modo',
  'core/authWidget.js→views/loginModal.js': 'import() dinámico al abrir el modal de acceso',
  // La fachada de transporte: core habla con `adapters/index.js`, NUNCA con un
  // adaptador concreto (eso es lo que permitió retirar Supabase sin tocar core).
  'core/assignmentsTransport.js→adapters/index.js': 'fachada de transporte',
  'core/authGate.js→adapters/index.js': 'fachada de transporte',
  'core/dbDiag.js→adapters/index.js': 'fachada de transporte',
  'core/liveTransport.js→adapters/index.js': 'fachada de transporte',
  'core/results.js→adapters/index.js': 'fachada de transporte',
  'core/storage.js→adapters/index.js': 'fachada de transporte',
  // El auto-test del panel usa un scorer real como banco de pruebas.
  'core/selftest.js→templates/quiz/scorer.js': 'banco de pruebas del panel #/admin',
  // DEUDA: una plantilla no debería necesitar el motor de sesión. Aquí es solo
  // `sessionItems` (leer los ítems), que es utilidad de contenido mal ubicada.
  'templates/question-live/player.js→kernel/session/engine.js': 'DEUDA: sessionItems debería vivir en contenido',
}));
