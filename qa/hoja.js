// HOJA DE PRUEBAS — motor PORTABLE (sin un solo import: se puede copiar este
// fichero a cualquier proyecto y funciona; ver qa/README.md).
//
// Nació de la ronda del 2026-08-11 en AulaReto, con su lección principal
// cosida dentro: la casilla de la primera hoja medía «lo probé», no «pasó» —
// dos fallos reales salieron marcados [OK] y solo las notas los salvaron. Por
// eso aquí cada prueba pide un VEREDICTO (Pasa / Falla / No probado), que es
// la misma distinción afirmación-vs-veredicto que AulaReto aplica al juego.
//
// Contrato:
//   montarHoja(rootEl, {
//     ronda,                  // ver qa/ronda-actual.json (id, titulo, versionMin, secciones[].pruebas[])
//     storageKey,             // clave de localStorage (por defecto deriva de ronda.id)
//     contexto (opcional),    // () => string — se añade al informe (versión, errores…)
//     enviar (opcional),      // async (payload) => void — si falta, no hay botón Enviar
//     puedeEnviar (opcional), // () => string|null — motivo por el que NO se puede (se dice ANTES)
//   })
// El informe de TEXTO existe siempre: es el respaldo que funciona sin red,
// sin permisos y sin backend. `enviar` solo corre cuando el probador pulsa
// su botón — nunca solo.

const CSS = `
.qh { max-width: 44rem; margin: 0 auto; padding: 0 1rem 4rem; font-size: 17px; line-height: 1.55; }
.qh h1 { font-size: 1.7rem; margin: 1.6rem 0 .4rem; }
.qh .qh-intro { color: var(--qh-soft, #566); margin: 0 0 1rem; }
.qh .qh-meta { display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; padding: .7rem 0; margin-bottom: 1rem;
  border-top: 1px solid var(--qh-line, #ddd); border-bottom: 1px solid var(--qh-line, #ddd);
  font-size: .87rem; color: var(--qh-soft, #566); }
.qh .qh-avance { margin-left: auto; font-variant-numeric: tabular-nums; }
.qh .qh-falla-n { color: var(--qh-mal, #b3402f); font-weight: 700; }
.qh h2 { font-size: 1.25rem; margin: 2rem 0 .3rem; }
.qh .qh-secnota { color: var(--qh-soft, #566); font-size: .93rem; margin: 0 0 .9rem; }
.qh .qh-prueba { border: 1px solid var(--qh-line, #ddd); border-radius: 4px; padding: .9rem 1rem;
  margin-bottom: .8rem; background: var(--qh-card, #fff); }
.qh .qh-prueba.qh-con-falla { border-left: 4px solid var(--qh-mal, #b3402f); }
.qh .qh-accion { margin: 0 0 .35rem; font-weight: 600; }
.qh .qh-num { opacity: .55; font-weight: 700; margin-right: .35rem; }
.qh .qh-espera { margin: 0 0 .7rem; color: var(--qh-soft, #566); font-size: .93rem; }
.qh .qh-veredicto { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: .55rem; }
.qh .qh-veredicto label { display: inline-flex; align-items: center; gap: .32rem; cursor: pointer;
  border: 1.5px solid var(--qh-line, #ccc); border-radius: 999px; padding: .28rem .8rem;
  font-size: .82rem; font-weight: 700; user-select: none; }
.qh .qh-veredicto input { position: absolute; opacity: 0; pointer-events: none; }
.qh .qh-veredicto label:has(input:checked)[data-v="pasa"] { background: var(--qh-bien-bg, #e4f2ea); border-color: var(--qh-bien, #1c7a4f); color: var(--qh-bien, #1c7a4f); }
.qh .qh-veredicto label:has(input:checked)[data-v="falla"] { background: var(--qh-mal-bg, #fbe9e5); border-color: var(--qh-mal, #b3402f); color: var(--qh-mal, #b3402f); }
.qh .qh-veredicto label:has(input:checked)[data-v="np"] { background: var(--qh-line, #eee); }
.qh .qh-veredicto label:has(input:focus-visible) { outline: 2px solid var(--qh-foco, #c9930c); outline-offset: 2px; }
.qh .qh-donde { display: flex; flex-wrap: wrap; gap: .4rem 1rem; margin-bottom: .5rem; font-size: .8rem; }
.qh .qh-donde label { display: inline-flex; align-items: center; gap: .3rem; cursor: pointer; font-weight: 600; color: var(--qh-soft, #566); }
.qh .qh-nota { width: 100%; border: none; border-bottom: 1px solid var(--qh-line, #ccc);
  background: transparent; color: inherit; font: inherit; font-size: .88rem; padding: .2rem .1rem; }
.qh .qh-nota:focus-visible { outline: 2px solid var(--qh-foco, #c9930c); outline-offset: 2px; }
.qh .qh-final { margin-top: 2rem; display: flex; flex-wrap: wrap; gap: .7rem; align-items: center; }
.qh button { font: inherit; font-size: .93rem; font-weight: 600; padding: .55rem 1.1rem;
  border-radius: 4px; cursor: pointer; border: 1px solid currentColor; background: transparent; color: inherit; }
.qh button.qh-primario { background: var(--qh-primario, #16202f); color: var(--qh-primario-fg, #fff); border-color: var(--qh-primario, #16202f); }
.qh button:disabled { opacity: .45; cursor: not-allowed; }
.qh button:focus-visible { outline: 2px solid var(--qh-foco, #c9930c); outline-offset: 2px; }
.qh .qh-estado { font-size: .88rem; font-weight: 600; }
.qh .qh-estado.qh-ok { color: var(--qh-bien, #1c7a4f); }
.qh .qh-estado.qh-err { color: var(--qh-mal, #b3402f); }
.qh .qh-salida { width: 100%; margin-top: .8rem; min-height: 15rem; resize: vertical;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .78rem; line-height: 1.5;
  border: 1px solid var(--qh-line, #ccc); border-radius: 4px; padding: .8rem;
  background: var(--qh-card, #fff); color: inherit; white-space: pre; overflow-x: auto; }
`;

const V = { pasa: '[PASA] ', falla: '[FALLA]', np: '[  —  ]' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function montarHoja(root, { ronda, storageKey, contexto, enviar, puedeEnviar } = {}) {
  if (!root || !ronda) throw new Error('montarHoja: falta root o ronda');
  const KEY = storageKey || `qa.hoja.${ronda.id || 'ronda'}`;
  const pruebas = (ronda.secciones || []).flatMap(s => s.pruebas || []);

  if (!document.getElementById('qh-css')) {
    const st = document.createElement('style');
    st.id = 'qh-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  root.innerHTML = `<div class="qh">
    <h1>${esc(ronda.titulo || 'Hoja de pruebas')}</h1>
    ${ronda.intro ? `<p class="qh-intro">${esc(ronda.intro)}</p>` : ''}
    <div class="qh-meta">
      ${ronda.versionMin ? `<span>Versión mínima <b>${esc(ronda.versionMin)}</b></span>` : ''}
      <span class="qh-avance" id="qh-avance"></span>
    </div>
    ${(ronda.secciones || []).map(sec => `
      <h2>${esc(sec.titulo || '')}</h2>
      ${sec.nota ? `<p class="qh-secnota">${esc(sec.nota)}</p>` : ''}
      ${(sec.pruebas || []).map(p => `
        <div class="qh-prueba" data-n="${esc(p.n)}">
          <p class="qh-accion"><span class="qh-num">${esc(p.n)}</span>${esc(p.accion)}</p>
          ${p.espera ? `<p class="qh-espera">Tiene que pasar: ${esc(p.espera)}</p>` : ''}
          <div class="qh-veredicto" role="radiogroup" aria-label="Veredicto de la prueba ${esc(p.n)}">
            <label data-v="pasa"><input type="radio" name="qh-v-${esc(p.n)}" value="pasa">✓ Pasa</label>
            <label data-v="falla"><input type="radio" name="qh-v-${esc(p.n)}" value="falla">✗ Falla</label>
            <label data-v="np"><input type="radio" name="qh-v-${esc(p.n)}" value="np" checked>— No probado</label>
          </div>
          ${(p.casillas || []).length ? `<div class="qh-donde">${p.casillas.map((c, i) =>
            `<label><input type="checkbox" data-casilla="${i}">${esc(c)}</label>`).join('')}</div>` : ''}
          <input type="text" class="qh-nota" placeholder="${esc(p.notaPista || 'Nota (qué viste, en qué aparato)')}">
        </div>`).join('')}
    `).join('')}
    <div class="qh-final">
      <button type="button" class="qh-primario" id="qh-generar">Generar informe</button>
      ${enviar ? `<button type="button" id="qh-enviar">Enviar informe</button>` : ''}
      <button type="button" id="qh-copiar" hidden>Copiar</button>
      <span class="qh-estado" id="qh-estado" role="status"></span>
    </div>
    <textarea class="qh-salida" id="qh-salida" readonly hidden spellcheck="false" aria-label="Informe en texto"></textarea>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const fichas = [...root.querySelectorAll('.qh-prueba')];
  const datosDe = (f) => ({
    n: f.dataset.n,
    v: f.querySelector('.qh-veredicto input:checked')?.value || 'np',
    casillas: [...f.querySelectorAll('[data-casilla]')].map(c => c.checked),
    nota: f.querySelector('.qh-nota').value,
  });

  function pintar() {
    let pasa = 0, falla = 0;
    for (const f of fichas) {
      const v = datosDe(f).v;
      f.classList.toggle('qh-con-falla', v === 'falla');
      if (v === 'pasa') pasa++; else if (v === 'falla') falla++;
    }
    $('#qh-avance').innerHTML =
      `${pasa + falla} de ${fichas.length} con veredicto${falla ? ` · <span class="qh-falla-n">${falla} falla${falla === 1 ? '' : 'n'}</span>` : ''}`;
  }

  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(fichas.map(datosDe))); }
    catch { /* sin almacenamiento (incógnito): la hoja funciona igual, sin memoria */ }
  }
  try {
    const previo = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(previo)) for (const d of previo) {
      const f = fichas.find(x => x.dataset.n === String(d.n));
      if (!f) continue;
      const r = f.querySelector(`.qh-veredicto input[value="${d.v}"]`);
      if (r) r.checked = true;
      (d.casillas || []).forEach((v, i) => { const c = f.querySelector(`[data-casilla="${i}"]`); if (c) c.checked = !!v; });
      if (d.nota) f.querySelector('.qh-nota').value = d.nota;
    }
  } catch { /* dato ilegible: se empieza en limpio */ }

  root.addEventListener('change', () => { pintar(); guardar(); });
  root.addEventListener('input', guardar);
  pintar();

  function informe() {
    const lineas = [];
    let pasa = 0, falla = 0, np = 0;
    for (const f of fichas) {
      const d = datosDe(f);
      const p = pruebas.find(x => String(x.n) === d.n) || {};
      if (d.v === 'pasa') pasa++; else if (d.v === 'falla') falla++; else np++;
      let extra = '';
      if ((p.casillas || []).length) {
        extra = ' (' + p.casillas.map((c, i) => `${c}: ${d.casillas[i] ? 'sí' : 'no'}`).join(' · ') + ')';
      }
      lineas.push(`${V[d.v]} ${d.n} · ${p.titulo || p.accion || ''}${extra}`);
      if (d.nota.trim()) lineas.push(`        nota: ${d.nota.trim()}`);
    }
    const ahora = new Date();
    const cab = [
      `${(ronda.titulo || 'HOJA DE PRUEBAS').toUpperCase()} · ronda ${ronda.id || '?'}`,
      `Fecha: ${ahora.toLocaleDateString()} ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      `Veredictos: ${pasa} pasan · ${falla} fallan · ${np} sin probar`,
      '',
    ];
    const pie = contexto ? ['', '── contexto ──', String(contexto())] : [];
    return { texto: cab.concat(lineas, pie).join('\n'), resumen: { pasa, falla, np } };
  }

  const estado = (msg, cls) => { const e = $('#qh-estado'); e.textContent = msg; e.className = `qh-estado ${cls || ''}`; };

  $('#qh-generar').addEventListener('click', () => {
    $('#qh-salida').value = informe().texto;
    $('#qh-salida').hidden = false;
    $('#qh-copiar').hidden = false;
    estado('');
  });

  $('#qh-copiar').addEventListener('click', () => {
    const t = $('#qh-salida');
    t.select(); t.setSelectionRange(0, t.value.length);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t.value)
        .then(() => estado('Copiado', 'qh-ok'),
              () => estado('Seleccionado — copia con Ctrl+C', 'qh-ok'));
    } else estado('Seleccionado — copia con Ctrl+C', 'qh-ok');
  });

  if (enviar) {
    const btn = $('#qh-enviar');
    // Si hay un motivo por el que no se puede, se dice ANTES de pulsar — nunca
    // dejar que falle para explicarlo después.
    const motivo = puedeEnviar ? puedeEnviar() : null;
    if (motivo) { btn.disabled = true; btn.title = motivo; estado(motivo, ''); }
    btn.addEventListener('click', async () => {
      const { texto, resumen } = informe();
      btn.disabled = true; estado('Enviando…', '');
      try {
        await enviar({ rondaId: ronda.id, texto, resumen });
        estado('Informe enviado ✓', 'qh-ok');
      } catch (e) {
        // R6: un envío fallido se DICE, y el texto queda como respaldo.
        estado(`No se pudo enviar (${e?.message || e}). Usa «Generar informe» y cópialo.`, 'qh-err');
        btn.disabled = false;
      }
    });
  }

  return { informe: () => informe().texto };
}
