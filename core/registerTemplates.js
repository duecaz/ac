// Registra TODAS las plantillas. Cada `index.js` se auto-registra vía
// registerTemplate() al importarse, así que importar este módulo (por efecto
// secundario) deja el registro completo listo.
//
// Punto ÚNICO para que main.teacher/student/embed no repitan la lista — y para
// que no se olvide ninguna: el embed antes registraba solo 6 de 11, así que
// incrustar una actividad de math/crossword/wordsearch/ballsort/question-live
// fallaba (getTemplate → undefined). Centralizado aquí se registran las 13.
import '../templates/quiz/index.js';
import '../templates/wheel/index.js';
import '../templates/match/index.js';
import '../templates/memory/index.js';
import '../templates/tildes/index.js';
import '../templates/comas/index.js';
import '../templates/math/index.js';
import '../templates/wordsearch/index.js';
import '../templates/crossword/index.js';
import '../templates/question-live/index.js';
import '../templates/ballsort/index.js';
import '../templates/diagram/index.js';
import '../templates/globos/index.js';
import '../templates/colorear/index.js';
import '../templates/tangram/index.js';
import '../templates/puzzle/index.js';
