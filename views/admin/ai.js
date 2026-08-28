// v1.51.629: adminView se partió POR PANEL. Esta sección es «IA que escribe
// contenido»: estado del hook, guardar/probar/apagar/borrar claves (viven en
// la Pi, nunca en el navegador — colección ia_config, dueño core/iaKeys.js).
import { escapeHtml } from '../../core/html.js';
import { fechaCorta } from '../../core/fechas.js';
import { on } from '../../core/events.js';

export function createAiSection() {
  return {
    html: () => `
      <h5 class="mt-4"><i class="bi bi-stars"></i> IA que escribe contenido <small class="text-muted">(la clave vive en la Pi, nunca en el navegador)</small></h5>
      <p class="small text-muted mb-2">
        La clave se guarda en la colección <code>ia_config</code>, que está cerrada a cal y canto: sus cinco
        reglas son <code>null</code>, así que <b>ni un profe con sesión puede leerla</b>. Quien la usa es el hook
        <code>pb_hooks/aulareto.pb.js</code> de la Pi, que al ser código de servidor se salta las reglas.
        Necesita tu superadmin de PocketBase (el mismo de arriba) y que el hook esté instalado —
        pasos en <code>docs/handoff-ia-contenido.md</code>.
      </p>
      <div class="d-flex gap-2 align-items-end flex-wrap mb-1">
        <div>
          <label class="form-label small mb-1">Proveedor</label>
          <select id="ia-prov" class="form-select form-select-sm" style="width:130px">
            <option value="gemini">Gemini</option>
            <option value="grok">Grok</option>
          </select>
        </div>
        <div>
          <label class="form-label small mb-1">Nombre <span class="text-muted">(para reconocerla)</span></label>
          <input id="ia-label" type="text" class="form-control form-control-sm" style="width:170px" placeholder="p. ej. la del cole" autocomplete="off">
        </div>
        <div>
          <label class="form-label small mb-1">Clave (API key)</label>
          <input id="ia-key" type="password" class="form-control form-control-sm" style="width:300px" placeholder="se guarda en la Pi, no aquí" autocomplete="off">
        </div>
        <button id="ia-save" class="btn btn-warning btn-sm"><i class="bi bi-plus-lg"></i> Añadir clave</button>
        <button id="ia-test" class="btn btn-outline-secondary btn-sm"><i class="bi bi-stars"></i> Probar generando</button>
      </div>
      <div id="ia-out" class="mt-2"></div>

      <!-- LA LISTA. Nunca trae la clave: se pide a PocketBase con el parámetro
           fields, que filtra EN EL SERVIDOR, así que el secreto no llega ni al
           navegador del dueño. De cada una se ve de quién es y si vale. -->
      <div class="d-flex align-items-center gap-2 mt-3 mb-1">
        <b class="small">Claves guardadas</b>
        <button id="ia-refresh" class="btn btn-outline-secondary btn-sm py-0"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>
        <span class="small text-muted">Se usa la primera ACTIVA; si esa no vale o se queda sin cuota, se baja a la siguiente.</span>
      </div>
      <div id="ia-lista" class="small text-muted">Pulsa «Actualizar» (pide el superadmin de arriba).</div>`,
    wire: (rootSel) => {
      // ESTADO DE LA IA AL ABRIR, sin tocar nada y sin gastar una generación. La
      // norma del proyecto es que la puerta cerrada se DIGA ANTES, no que se
      // descubra al chocar: aquí se ve de un vistazo si falta el hook, si falta la
      // clave, o si está todo puesto.
      (async function pintarEstadoIA() {
        const box = document.getElementById('ia-out');
        if (!box) return;
        try {
          const { PB_URL } = await import('../../pocketbase.config.js');
          const r = await fetch(`${PB_URL}/api/ia/estado`);
          if (r.status === 404) {
            box.innerHTML = '<div class="alert alert-warning py-1 px-2 small mb-0">'
              + '<b>El hook no está instalado en la Pi.</b> Copia <code>pb_hooks/aulareto.pb.js</code> '
              + '(y monta <code>./pb_hooks:/pb_hooks</code> si usas Docker). Pasos: <code>docs/handoff-ia-contenido.md §7</code>.</div>';
            return;
          }
          if (!r.ok) throw new Error(`estado ${r.status}`);
          const e = await r.json();
          box.innerHTML = e.configurado
            ? `<div class="alert alert-success py-1 px-2 small mb-0">Hook instalado y con clave de <b>${escapeHtml(e.proveedor || '?')}</b> (en ${escapeHtml(e.origen)}${e.via ? ', vía ' + escapeHtml(e.via) : ''}). Tope ${e.topeDiario}/día por profe.</div>`
            : (e.motivo
              ? `<div class="alert alert-danger py-1 px-2 small mb-0"><b>El hook no pudo leer la clave.</b> Motivo del servidor: <code>${escapeHtml(e.motivo)}</code></div>`
              : '<div class="alert alert-info py-1 px-2 small mb-0">Hook instalado, <b>falta la clave</b>: pégala aquí arriba y pulsa «Guardar clave».</div>');
        } catch (err) {
          // best-effort: es un informe, no una función. Si la Pi no contesta, el
          // resto del panel no se bloquea — pero se dice, no se calla (R6).
          box.innerHTML = `<div class="alert alert-secondary py-1 px-2 small mb-0">No se pudo consultar el estado de la IA: ${escapeHtml(err.message)}</div>`;
        }
      })();

      // ── IA: guardar la clave (en la Pi) y probar que el hook responde ──────────
      // Reutiliza el superadmin de PocketBase de la sección de arriba: es el único
      // que puede escribir en `ia_config`, y eso es justo lo que hace segura la
      // colección. El navegador toca la clave UNA vez —al escribirla— y nunca la
      // vuelve a leer: para eso están las reglas a null.
      async function tokenSuperadmin() {
        const email = document.getElementById('pb-email')?.value?.trim();
        const pass  = document.getElementById('pb-pass')?.value;
        if (!email || !pass) throw new Error('Pon el email y la contraseña de superadmin de PocketBase (sección de arriba).');
        const { PB_URL } = await import('../../pocketbase.config.js');
        for (const url of [`${PB_URL}/api/collections/_superusers/auth-with-password`, `${PB_URL}/api/admins/auth-with-password`]) {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password: pass }) });
          if (r.ok) return { token: (await r.json()).token, PB_URL };
          if (r.status !== 404) {
            const b = await r.json().catch(() => ({}));
            throw new Error(b.message || `Error de autenticación (${r.status})`);
          }
        }
        throw new Error('No se pudo autenticar como superadmin.');
      }
      const iaOut = (html) => { const o = document.getElementById('ia-out'); if (o) o.innerHTML = html; };

      // ── LA LISTA DE CLAVES ────────────────────────────────────────────────────
      // `fields=` filtra EN EL SERVIDOR: la clave no viaja al navegador ni siquiera
      // con el token de superadmin. La versión anterior traía el registro entero
      // para sacarle el id — el secreto acababa en la pestaña sin ninguna razón.
      const iaLista = (html) => { const o = document.getElementById('ia-lista'); if (o) o.innerHTML = html; };

      async function pintarClaves(msg = '') {
        const { token } = await tokenSuperadmin();
        const { listarClaves } = await import('../../core/iaKeys.js');
        const filas = await listarClaves(token);
        if (!filas.length) { iaLista('<div class="text-muted">No hay ninguna clave guardada todavía.</div>'); return; }
        // La primera ACTIVA es la que se usa: se dice, porque una lista de cuatro
        // claves sin saber cuál manda no explica nada de lo que va a pasar.
        const enUso = filas.find(f => f.activa !== false)?.id;
        iaLista(`${msg}<table class="table table-sm align-middle mb-0">
          <thead><tr><th>Proveedor</th><th>Nombre</th><th>Estado</th><th>Añadida</th><th></th></tr></thead>
          <tbody>${filas.map(f => `<tr data-id="${f.id}">
            <td>${escapeHtml(f.proveedor || 'gemini')}</td>
            <td>${escapeHtml(f.etiqueta || '—')}</td>
            <td>${f.activa === false
              ? '<span class="badge bg-secondary">apagada</span>'
              : (f.id === enUso ? '<span class="badge bg-success">en uso</span>' : '<span class="badge bg-primary-subtle text-primary">activa</span>')}
              <span class="ia-veredicto ms-1"></span></td>
            <td class="text-muted">${escapeHtml(fechaCorta(f.created))}</td>
            <td class="text-end">
              <button class="btn btn-outline-secondary btn-sm py-0 ia-probar" data-id="${f.id}">Probar</button>
              <button class="btn btn-outline-secondary btn-sm py-0 ia-toggle" data-id="${f.id}" data-activa="${f.activa === false ? '0' : '1'}">${f.activa === false ? 'Encender' : 'Apagar'}</button>
              <button class="btn btn-outline-danger btn-sm py-0 ia-borrar" data-id="${f.id}">Eliminar</button>
            </td></tr>`).join('')}</tbody></table>`);
      }

      const iaListaError = (e) => iaLista(`<div class="alert alert-danger py-1 px-2 small mb-0">${escapeHtml(e.message)}</div>`);

      on(rootSel, 'click', '#ia-refresh', async (_, btn) => {
        btn.disabled = true;
        iaLista('<span class="spinner-border spinner-border-sm me-1"></span>Leyendo…');
        try { await pintarClaves(); } catch (e) { iaListaError(e); } finally { btn.disabled = false; }
      });

      on(rootSel, 'click', '.ia-probar', async (_, btn) => {
        const id = btn.dataset.id;
        const celda = btn.closest('tr')?.querySelector('.ia-veredicto');
        btn.disabled = true;
        if (celda) celda.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
          const { token } = await tokenSuperadmin();
          // La prueba la hace la PI, no el navegador: aquí no hay clave con la que
          // llamar al proveedor, y ese es justo el punto de todo el montaje.
          const { probarClave } = await import('../../core/iaKeys.js');
          const d = await probarClave(token, id);
          if (celda) {
            celda.innerHTML = d.ok
              ? `<span class="badge bg-success-subtle text-success" title="${escapeHtml((d.modelos || []).join(', '))}">vale · ${(d.modelos || []).length} modelos</span>`
              : `<span class="badge bg-danger-subtle text-danger">no vale</span>`;
          }
          if (!d.ok && d.motivo) iaOut(`<div class="alert alert-warning py-1 px-2 small">${escapeHtml(d.motivo)}</div>`);
        } catch (e) {
          if (celda) celda.innerHTML = '<span class="badge bg-danger-subtle text-danger">?</span>';
          iaOut(`<div class="alert alert-danger py-1 px-2 small">${escapeHtml(e.message)}</div>`);
        } finally { btn.disabled = false; }
      });

      on(rootSel, 'click', '.ia-toggle', async (_, btn) => {
        btn.disabled = true;
        try {
          const { token } = await tokenSuperadmin();
          const { cambiarEstado } = await import('../../core/iaKeys.js');
          await cambiarEstado(token, btn.dataset.id, btn.dataset.activa === '0');
          await pintarClaves();
        } catch (e) { iaListaError(e); } finally { btn.disabled = false; }
      });

      on(rootSel, 'click', '.ia-borrar', async (_, btn) => {
        // Borrar una clave no se deshace, y la de al lado se parece: se pregunta.
        if (!confirm('¿Eliminar esta clave de la Pi? No se puede deshacer.')) return;
        btn.disabled = true;
        try {
          const { token } = await tokenSuperadmin();
          const { eliminarClave } = await import('../../core/iaKeys.js');
          await eliminarClave(token, btn.dataset.id);
          await pintarClaves('<div class="alert alert-success py-1 px-2 small">Clave eliminada.</div>');
        } catch (e) { iaListaError(e); } finally { btn.disabled = false; }
      });

      on(rootSel, 'click', '#ia-save', async (_, btn) => {
        const clave = document.getElementById('ia-key')?.value?.trim();
        const proveedor = document.getElementById('ia-prov')?.value || 'gemini';
        const etiqueta = document.getElementById('ia-label')?.value?.trim() || '';
        if (!clave) { iaOut('<div class="alert alert-warning py-1 px-2 small">Pega la clave.</div>'); return; }
        btn.disabled = true;
        iaOut('<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Guardando en la Pi…</div>');
        try {
          const { token } = await tokenSuperadmin();
          const { anadirClave } = await import('../../core/iaKeys.js');
          await anadirClave(token, { proveedor, clave, etiqueta });
          document.getElementById('ia-key').value = '';
          document.getElementById('ia-label').value = '';
          iaOut(`<div class="alert alert-success py-1 px-2 small">Clave de ${proveedor} guardada en la Pi. Pulsa «Probar» en su fila para comprobarla.</div>`);
          await pintarClaves();
        } catch (e) {
          // R6: el motivo, no un «algo falló» — cada uno se arregla distinto.
          iaOut(`<div class="alert alert-danger py-1 px-2 small">${escapeHtml(e.message)}</div>`);
        } finally { btn.disabled = false; }
      });

      on(rootSel, 'click', '#ia-test', async (_, btn) => {
        btn.disabled = true;
        iaOut('<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Pidiéndole 2 preguntas de prueba…</div>');
        try {
          const { PB_URL } = await import('../../pocketbase.config.js');
          const { pedirContenido } = await import('../../core/aiContent.js');
          const { getAuthToken } = await import('../../core/auth.js');
          // 1) ESTADO primero: es gratis y distingue los dos fallos que de otro modo
          //    se confunden — «el hook no está» vs «está pero sin clave». Sin esto,
          //    un 404 de PocketBase («The requested resource wasn't found») deja
          //    mirando la clave pensando que está mal escrita.
          const est = await fetch(`${PB_URL}/api/ia/estado`).catch(() => null);
          if (!est || est.status === 404) {
            throw new Error('El hook NO está instalado en la Pi: falta pb_hooks/aulareto.pb.js '
              + '(y montar ./pb_hooks:/pb_hooks si es Docker). Pasos en docs/handoff-ia-contenido.md §7.');
          }
          const estado = await est.json().catch(() => ({}));
          if (!estado.configurado) {
            // El MOTIVO viene del hook: «sin clave» a secas dejaba mirando la clave
            // recién guardada sin saber si el fallo era ella o la lectura.
            throw new Error(estado.motivo
              ? `El hook no pudo leer la clave de ia_config. Motivo del servidor: ${estado.motivo}`
              : 'El hook está instalado pero sin clave: guárdala aquí arriba.');
          }
          // 2) Ahora sí, una generación de verdad.
          const r = await pedirContenido({ modelo: 'qa', tema: 'los planetas del sistema solar',
            curso: '5.º de primaria', cantidad: 2, url: `${PB_URL}/api/ia/contenido`, token: getAuthToken() });
          if (r.error) throw new Error(r.error);
          iaOut(`<div class="alert alert-success py-1 px-2 small">Funciona con <b>${escapeHtml(estado.proveedor || '?')}</b>`
            + ` (clave en ${escapeHtml(estado.origen)}, tope ${estado.topeDiario}/día). ${r.piezas} pregunta(s):<ul class="mb-0 mt-1">`
            + r.content.items.map(i => `<li>${escapeHtml(i.question)} → <b>${escapeHtml(i.answer)}</b></li>`).join('')
            + '</ul></div>');
        } catch (e) {
          // AL FALLAR, ENSEÑAR EL CATÁLOGO. Un «(404)» a secas deja adivinando qué
          // nombre de modelo tiene esa clave, y la respuesta la sabe la propia API:
          // se le pide al hook (`?modelos=1`, que no gasta generación) y se pinta.
          let extra = '';
          try {
            const { PB_URL } = await import('../../pocketbase.config.js');
            const est = await fetch(`${PB_URL}/api/ia/estado?modelos=1`);
            const d = est.ok ? await est.json() : null;
            if (d?.modelos?.length) {
              extra = `<div class="mt-1">Modelos de esta clave: <code>${d.modelos.slice(0, 10).map(escapeHtml).join('</code>, <code>')}</code></div>`;
            } else if (d?.modelosError) {
              extra = `<div class="mt-1">Y la lista de modelos tampoco se pudo leer: ${escapeHtml(d.modelosError)}</div>`;
            }
          } catch (err2) {
            // best-effort: es información de apoyo. Si no se puede, el mensaje
            // principal ya está escrito y es el que importa.
            console.warn('IA: no se pudo pedir el catálogo de modelos', err2);
          }
          iaOut(`<div class="alert alert-danger py-1 px-2 small">${escapeHtml(e.message)}${extra}</div>`);
        } finally { btn.disabled = false; }
      });
    },
  };
}
