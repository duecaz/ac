// Portada pública (S2). Cualquiera (sin sesión) ve las actividades DESTACADAS
// (mejor puntuadas) y puede jugarlas o explorar la biblioteca. Los profes
// logueados ven además accesos a "Mis actividades" y "Nueva". Crear/editar exige
// login (gate en las rutas de autoría).
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { activityCardHtml } from '../core/activityCard.js';
import { listPublicActivities } from '../core/storage.js';
import { computeFeatured } from '../core/ranking.js';
import { fetchLikeCounts, fetchMyLikes, toggleLike } from '../core/likes.js';
import { getUser } from '../core/auth.js';
import { mountAuthSlot } from '../core/authWidget.js';
import { toast } from '../core/toast.js';

export async function renderLanding(rootSel) {
  const user = await getUser();
  mount(rootSel, html`
    <div class="landing">
      <section class="landing-hero">
        <!-- §7c: la portada le habla AL PROFE — "aprende jugando · juega gratis"
             era lenguaje de sitio de alumnos. El alumno tiene su entrada discreta
             (PIN) más abajo, no el titular. -->
        <h1 class="landing-hero__title">Actividades para tu clase</h1>
        <p class="landing-hero__sub">Busca una lista para usar en la pizarra o crea la tuya en minutos: quiz, ruleta, emparejar, tildes y más. Tus alumnos participan sin cuenta.</p>
        <div class="landing-search">
          <i class="bi bi-search"></i>
          <input id="lp-q" placeholder="Buscar actividades…">
          <button class="btn-primary-solid" id="lp-go">Buscar</button>
        </div>
        <div class="landing-cta">
          ${user
            ? `<a href="#/mine" class="btn-ghost"><i class="bi bi-folder2-open"></i> Mis actividades</a>
               <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Nueva</a>`
            : `<span class="landing-cta__hint">¿Eres profe?</span><span id="lp-auth"></span>`}
          <a href="#/explore" class="btn-ghost"><i class="bi bi-globe"></i> Biblioteca</a>
          <a href="#/juegos" class="btn-ghost"><i class="bi bi-controller"></i> Juegos</a>
        </div>
        <p class="landing-hero__pin">¿Eres alumno y tu profe te dio un PIN?
          <a href="student.html#/join">Entra aquí</a></p>
      </section>

      <section class="landing-featured">
        <div class="landing-featured__head">
          <h2><i class="bi bi-stars"></i> Destacadas</h2>
          <a href="#/explore" class="landing-featured__all">Ver todas →</a>
        </div>
        <div id="lp-grid" class="home-grid">
          <div class="text-center py-5 w-100"><div class="spinner-border"></div></div>
        </div>
      </section>
    </div>
  `);
  if (!user) mountAuthSlot('#lp-auth').catch(() => {});

  let myLikes = new Set();

  // Guarda contra la carrera "navegué fuera antes de que resolviera el fetch":
  // si #lp-grid ya no está en el DOM, no toca nada (evita el null → red screen).
  const setGrid = (htmlStr) => { const g = document.getElementById('lp-grid'); if (g) g.innerHTML = htmlStr; };

  async function load() {
    let rows = [];
    try {
      // Al dueño de la colección (ley §21). computeFeatured ordena después por
      // likes/plays/updatedAt del propio contenido.
      rows = await listPublicActivities({ limit: 48 });
    } catch (e) {
      setGrid(`<p class="text-muted text-center py-4 w-100">Aún no hay actividades publicadas. ${user ? 'Crea la primera con <a href="#/new">Nueva</a>.' : 'Vuelve pronto.'}</p>`);
      return;
    }
    const [likeCounts, mine] = await Promise.all([fetchLikeCounts(), fetchMyLikes()]);
    myLikes = mine;
    const featured = computeFeatured(rows, likeCounts, {}, 8);
    if (!document.getElementById('lp-grid')) return; // navegó fuera
    if (!featured.length) { setGrid(`<p class="text-muted text-center py-4 w-100">Aún no hay actividades publicadas.</p>`); return; }
    setGrid(featured.map(a => card(a, likeCounts[a.id] || 0)).join(''));
  }

  function card(a, likes) {
    const liked = myLikes.has(a.id);
    const topRight = `<button class="lp-like ${liked ? 'is-liked' : ''}" data-like="${escapeHtml(a.id)}" title="Me gusta">
        <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i> <span class="lp-like__n">${likes}</span>
      </button>`;
    const footer = `<button class="btn-primary-solid w-100 lp-play" data-play="${escapeHtml(a.id)}"><i class="bi bi-play-fill"></i> Jugar</button>`;
    // modes:'play' = solo Individual/VS/Equipos (jugables sobre cualquier
    // actividad). Live/Tarea se quedan en "Mis actividades" (son tuyas).
    return activityCardHtml(a, {
      variant: 'library', extraClass: 'lp-card', previewClass: 'lp-card__pv', topRight, footer,
    });
  }

  function goSearch() {
    const q = (document.getElementById('lp-q')?.value || '').trim();
    navigate(q ? `#/explore?q=${encodeURIComponent(q)}` : '#/explore');
  }

  on(rootSel, 'click', '#lp-go', goSearch);
  on(rootSel, 'keydown', '#lp-q', (e) => { if (e.key === 'Enter') goSearch(); });
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));
  on(rootSel, 'click', '[data-like]', async (e, b) => {
    e.stopPropagation();
    try {
      const { liked } = await toggleLike(b.dataset.like);
      const icon = b.querySelector('i');
      const n = b.querySelector('.lp-like__n');
      b.classList.toggle('is-liked', liked);
      if (icon) icon.className = `bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`;
      if (n) n.textContent = String(Math.max(0, (parseInt(n.textContent, 10) || 0) + (liked ? 1 : -1)));
      if (liked) myLikes.add(b.dataset.like); else myLikes.delete(b.dataset.like);
    } catch (err) {
      toast(err.message || 'Inicia sesión para votar.', 'info', 4000);
    }
  });

  load();
}
