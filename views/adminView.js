// Página ADMIN (protegida con usuario + contraseña). Reúne TODO en un sitio:
// detalles del sistema, la matriz de modos/compatibilidad (core/modeMatrix.js) y
// los self-tests EJECUTABLES (core/selftest.js, con simulación de alumnos
// virtuales VS y En vivo). El login es un candado simple del lado cliente
// (sessionStorage), no seguridad real — la protección de datos es la RLS.
//
// v1.51.629: SE PARTIÓ POR PANEL (cirugía mapeada en CLAUDE.md, corte 3/4 de
// la deuda condicionada — precedente: views/live/* en v1.51.628). Este
// fichero es solo el ENSAMBLADOR: `renderAdmin`/`renderGate` y el armazón de
// `renderPanel` (el HTML general de la página y el orden de las secciones).
// Cada sección <h5> del panel vive en su propio módulo `views/admin/*.js`
// como una fábrica que devuelve `{ html(), wire(rootSel) }` — la superficie
// pública (`renderAdmin`, la ruta `#/admin`, cómo se ve y se comporta el
// panel) no cambia un pixel.
import { html, mount } from '../core/html.js';
import { isAdmin } from '../core/auth.js';
import { buildAdminMatrix } from './admin/matrix.js';
import { createTeachersSection } from './admin/teachers.js';
import { createDataSystemSection } from './admin/dataSystem.js';
import { createCollectionsSection } from './admin/collections.js';
import { createAiSection } from './admin/ai.js';
import { createCapacitySection } from './admin/capacity.js';
import { createMaintenanceSection } from './admin/maintenance.js';
import { createLoadTestsSection } from './admin/loadTests.js';
import { createLiveTestsSection } from './admin/liveTests.js';
import { createErrorLogSection } from './admin/errorLog.js';
import { createTemplateCapacitySection } from './admin/templateCapacity.js';
import { createLiveWordsSection } from './admin/liveWords.js';
import { createVsAnimationsSection } from './admin/vsAnimations.js';

// Admin UNIFICADO (auth v2): el acceso es por ROL de Google (isAdmin), no por
// contraseña local. Solo un profe con role='admin' entra. La contraseña 'fernando'
// se retiró — había un candado paralelo que confundía (dos "admin" distintos).
export function renderAdmin(rootSel) {
  if (!isAdmin()) return renderGate(rootSel);
  renderPanel(rootSel);
}

function renderGate(rootSel) {
  mount(rootSel, html`
    <div class="auth-gate"><div class="auth-gate__card">
      <div class="auth-gate__icon"><i class="bi bi-shield-lock"></i></div>
      <h1 class="auth-gate__title">Panel de administración</h1>
      <p class="auth-gate__sub">Esta sección es solo para administradores. Inicia sesión con una cuenta con rol admin.</p>
      <div class="auth-gate__cta" id="admin-gate-slot"></div>
      <a href="#/" class="auth-gate__back"><i class="bi bi-arrow-left"></i> Volver a la portada</a>
    </div></div>`);
  import('../core/authWidget.js').then(m => m.mountAuthSlot('#admin-gate-slot').catch(() => {}));
}

function renderPanel(rootSel) {
  // Tablas de diagnóstico (capacidad/actividades/conversiones) → views/admin/matrix.js
  const { caps, acts, capRows, actRows, convRows } = buildAdminMatrix();
  // Dos secciones necesitan repintar el panel ENTERO tras su acción (borrar
  // todas las actividades cambia lo que muestran OTRAS secciones; limpiar el
  // registro de errores cambia lo que muestra la SUYA): un único cierre
  // compartido, en vez de que cada módulo reimporte este fichero (circular).
  const rerender = () => renderPanel(rootSel);

  // Fábricas → { html(), wire(rootSel) }. El ORDEN de la lista es el orden en
  // pantalla: Profesores · Datos+Sistema · PocketBase colecciones · IA ·
  // Capacidad §25 · Mantenimiento+BD · Pruebas contra servidor real ·
  // Tests en vivo · Errores recientes · Capacidad por plantilla+Tus
  // actividades+Conversiones · Palabras Live · Animaciones VS.
  const sections = [
    createTeachersSection(),
    createDataSystemSection({ caps, acts }),
    createCollectionsSection(),
    createAiSection(),
    createCapacitySection(),
    createMaintenanceSection({ rerender }),
    createLoadTestsSection(),
    createLiveTestsSection(),
    createErrorLogSection({ rerender }),
    createTemplateCapacitySection({ acts, capRows, actRows, convRows }),
    createLiveWordsSection(),
    createVsAnimationsSection(),
  ];

  mount(rootSel, html`
    <div class="container py-3">
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <a href="#/mine" class="btn btn-sm btn-link p-0"><i class="bi bi-arrow-left"></i> Inicio</a>
        <a href="#/moderar" class="btn btn-sm btn-outline-warning"><i class="bi bi-flag"></i> Moderación</a>
      </div>
      <h3><i class="bi bi-shield-lock"></i> Panel de administración</h3>
      ${sections.map(s => s.html()).join('')}
    </div>`);

  sections.forEach(s => s.wire(rootSel));
}
