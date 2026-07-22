// Selector de curso de Classroom (overlay ligero). Devuelve el id del curso
// elegido o null si se cancela. Sin dependencias — mismo patrón que loginModal.
import { escapeHtml } from './html.js';

export function pickCourse(courses) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'login-modal';
    host.innerHTML = `
      <div class="login-modal__backdrop" data-cancel></div>
      <div class="login-modal__card" role="dialog" aria-modal="true">
        <button class="login-modal__x" data-cancel title="Cerrar"><i class="bi bi-x-lg"></i></button>
        <h2 class="login-modal__title"><i class="bi bi-google"></i> Enviar a Classroom</h2>
        <p class="login-modal__sub">Elige el curso donde publicar la tarea.</p>
        <select id="cp-sel" class="login-modal__inp">
          ${courses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.section ? ' — ' + escapeHtml(c.section) : ''}</option>`).join('')}
        </select>
        <button class="login-modal__submit mt-2" id="cp-ok">Publicar tarea</button>
      </div>`;
    document.body.appendChild(host);
    const done = (v) => { host.remove(); resolve(v); };
    host.querySelectorAll('[data-cancel]').forEach(el => el.addEventListener('click', () => done(null)));
    host.querySelector('#cp-ok').addEventListener('click', () => done(host.querySelector('#cp-sel').value || null));
  });
}
