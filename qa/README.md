# Hoja de pruebas (QA) — motor portable

Sistema de rondas de prueba manual: el probador abre una página en el móvil,
marca un **veredicto** por prueba (Pasa / Falla / No probado) con su nota, y al
final **genera un informe en texto** (para pegar donde sea) o lo **envía** con
un botón. Nació de la ronda de AulaReto del 2026-08-11, con su lección cosida:
una casilla de «hecho» no es un veredicto — dos fallos reales salieron
marcados [OK] y solo las notas los salvaron.

## En AulaReto

- **`test.html`** (→ aulareto.com/test.html): la página que usa el equipo.
  Autoincluye versión de la app y últimos errores registrados en cada informe.
- **`ronda-actual.json`**: la ronda vigente. Publicar una ronda nueva = editar
  este JSON y subir (el cache-bust va con la versión de la app).
- **Enviar** crea una fila `qa:<ronda>` en la colección `reports` (exige sesión
  de profe; la página lo dice antes). Se leen en **`#/moderar`** → «Rondas de
  prueba (QA)», desplegables y con el informe en texto tal cual.
- **Entregar NUNCA es un callejón** (lección del 2026-08-19: un probador marcó las
  11 pruebas y el botón, que exigía cuenta, no se habilitó jamás — se perdió la
  ronda). «Entregar informe» baja una escalera: **1)** con sesión, al panel;
  **2)** sin ella, la **hoja de compartir del móvil** (WhatsApp, correo…);
  **3)** si no hay ni eso, **copiado** y el texto a la vista. Y mientras no haya
  entregado, al terminar la hoja lo DICE. Vigilado por `tools/hoja-smoke.mjs`,
  que la recorre SIN SESIÓN, que es como la abre quien nos hace el favor.

## En cualquier otra aplicación

El motor es UN fichero sin dependencias: copia `hoja.js` a tu proyecto y ponle
una página de ~20 líneas:

```html
<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pruebas</title>
<div id="app"></div>
<script type="module">
  import { montarHoja } from './hoja.js';
  montarHoja(document.getElementById('app'), {
    ronda: {
      id: '2026-08-12', titulo: 'Mi app · pruebas', versionMin: '2.1.0',
      secciones: [{
        titulo: 'Parte 1',
        pruebas: [
          { n: 1, titulo: 'Login',
            ruta: ['PC', 'Panel', 'Pantalla de entrada'],   // DÓNDE se hace
            accion: 'Entra con tu usuario.',
            pasos: ['Abre el panel.', 'Escribe usuario y contraseña.'],  // opcional
            espera: 'llegas al panel sin error.', casillas: ['PC', 'Móvil'] },
        ],
      }],
    },
    // Opcionales:
    contexto: () => `app v2.1.0 · ${navigator.userAgent.slice(0, 60)}`,
    puedeEnviar: () => null,                       // o el motivo por el que no (se muestra ANTES)
    enviar: async ({ rondaId, texto, resumen }) => {
      const r = await fetch('/api/qa', { method: 'POST', body: JSON.stringify({ rondaId, texto }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);   // el motor lo muestra y deja el texto de respaldo
    },
  });
</script>
```

Sin `enviar` no hay botón de envío: queda solo el informe de texto, que no
necesita backend. El avance se guarda en `localStorage` por `ronda.id` (la
ronda se puede hacer en varios ratos). La ronda puede venir de un `fetch` a un
JSON en vez de inline — así las rondas son datos, no páginas.

## Reglas de diseño (por qué es así)

1. **Veredicto, no marca**: Pasa/Falla/No probado. «Lo probé» no dice si pasó.
2. **Lo que cruza varias pantallas va en PASOS numerados** (`pasos`): de once
   pruebas escritas en párrafo solo se hicieron tres — una prueba que exige
   montar sala, entrar con PIN y mirar dos relojes a la vez se abandona si hay
   que releerla; numerada, se sigue. Lo vigila `tests/qaRonda.test.mjs`.
3. **Cada prueba dice DÓNDE se hace** (`ruta`: aparato › actividad › modo ›
   pantalla). Va arriba del todo y también en el informe: sin ella, «la 3 falla»
   obliga a preguntar en qué pantalla miraba. En AulaReto lo vigila
   `tests/qaRonda.test.mjs` (ronda sin rutas = CI en rojo).
4. **El texto es el camino base**: funciona sin red, sin permisos y sin backend.
   El envío es un extra que decide el probador, nunca automático.
5. **Si no se puede enviar, se dice ANTES** (`puedeEnviar`), no al fallar.
6. **Un envío fallido se dice** y el texto queda como respaldo (R6 de AulaReto).
7. **El informe incluye lo NO probado**: dice hasta dónde llegó la ronda.
