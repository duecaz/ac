import { html, mount } from '../../core/html.js';

export function renderQuestionLivePlayer(rootSel) {
  mount(rootSel, html`
    <div class="text-center py-5">
      <i class="bi bi-wifi display-1 text-warning"></i>
      <h3 class="mt-3">Solo disponible en modo En vivo</h3>
      <p class="text-muted">Únete a una sala con tu profesor para participar.</p>
    </div>
  `);
}
