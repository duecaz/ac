# Revisión humana de la pasada de tipos (v1.51.673 → v1.51.679)

GENERADO desde `git diff -U0 fc4755a b1861cd` quitando JSDoc, comentarios y líneas
vacías: lo que queda es lo que EJECUTA distinto. Orden: primero donde un error
cuesta puntos o cierra una sala. Los casts de tipo `/** @type {X} */ (v)` no
ejecutan nada pero se dejan para leer el contexto.

## Veredicto de la lectura (2026-09-11)

Leído ENTERO el nivel A (28 ficheros, 441 líneas +) y la lista de coerciones de
los niveles A y B. Lo que se encontró y qué se hizo:

- `core/scoring/award.js` `itemPoints`: el tipado dejaba a 0 un `points` que
  llegara como TEXTO («5», contenido importado), que antes valía 5. **Corregido**
  (v1.51.680) y fijado con contra-prueba en `tests/scoring.test.mjs`.
- `core/liveEnd.js`: `Math.min(n ?? DEFAULT_FIRST_N, players)` — antes `n`
  indefinido daba `NaN`. Mejora, no regresión.
- `adapters/pocketbase/realtimeRooms.js` `noteItemOpened`: `Number(patch.current_item)`
  ya estaba así antes de tipar (no es cambio).
- `adapters/pocketbase/assignments.js` `recordAttempt` ya no devuelve el registro
  (alineado con el local): ningún llamante lo usaba.
- Todo lo demás del nivel A son estrechamientos equivalentes (`fila()`/`texto()`
  sobre filas que PocketBase siempre trae completas) o guardas de `null` que antes
  lanzaban.

El nivel C (146 ficheros: editores, admin, herramientas) NO se leyó línea a
línea: lo cubren la matriz, los recorridos del preflight y la lista de
coerciones de abajo. Si un bug aparece en clase, este documento dice en qué
línea cambió el valor.

## Resumen

| Nivel | Ficheros | Líneas + | Líneas − |
|---|---|---|---|
| A · puntos, sala y datos | 28 | 441 | 287 |
| B · el juego y el alumno | 63 | 859 | 579 |
| C · editores, panel del profe, admin y herramientas | 146 | 1694 | 1054 |

## Coerciones y guardas nuevas (lo que cambia un VALOR)

Cada línea añadida que cae en `?? 0`, `?? ''`, `Number()`, `String()`, `|| null`, `if (!x) return`, `typeof … === 'function'`, `Array.isArray`. Léelas preguntando: ¿el valor de antes podía ser otro?

### A · puntos, sala y datos

- `adapters/frontera.js:22` export const esFila = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
- `adapters/frontera.js:32` return Array.isArray(items) ? items.filter(esFila) : [];
- `adapters/frontera.js:64` export const mensajeDe = (e) => (e instanceof Error ? e.message : String(e));
- `adapters/local/assignments.js:45` const uid = () => (typeof userId === 'function' ? userId() : userId) || 'local-anon';
- `adapters/local/assignments.js:46` const mios = () => (typeof identities === 'function' ? identities() : identities) || [uid()];
- `adapters/local/assignments.js:56` return Array.isArray(l) ? /** @type {AssignmentAttempt[]} */ (l) : [];
- `adapters/local/realtime.js:152` for (let i = 0; i < (kv.length ?? 0); i++) {
- `adapters/local/realtime.js:204` if ('ql_open' in patch) ql().open = patch.ql_open ?? null;
- `adapters/local/realtime.js:205` if ('ql_question' in patch) ql().question = patch.ql_question ?? null;
- `adapters/local/realtime.js:206` if ('ql_image' in patch) ql().image = patch.ql_image ?? null;
- `adapters/local/realtime.js:207` if ('ql_by' in patch) ql().by = patch.ql_by ?? null;
- `adapters/local/realtime.js:208` if ('ql_by_name' in patch) ql().byName = patch.ql_by_name ?? null;
- `adapters/local/realtime.js:329` if (kv) { for (let i = 0; i < (kv.length ?? 0); i++) { const k = kv.key?.(i); if (k?.startsWith(PREFIX)) codes.push(k.slice(PREFIX.length));
- `adapters/local/realtime.js:407` return out.slice(0, Number(limit) || 500);
- `adapters/local/remoteStore.js:73` return Array.isArray(l) ? /** @type {ResultRecord[]} */ (l) : [];
- `adapters/local/remoteStore.js:93` .filter(([, data]) => !owner || (data.owner || '') === owner)
- `adapters/pocketbase/assignments.js:70` const uid = () => (typeof userId === 'function' ? userId() : userId) || 'local-anon';
- `adapters/pocketbase/assignments.js:71` const mios = () => (typeof identities === 'function' ? identities() : identities) || [uid()];
- `adapters/pocketbase/realtime.js:91` const transient = fila(e).timeout === true || estado === 0 || (estado ?? 0) >= 500;
- `adapters/pocketbase/realtimeAnswers.js:173` return filasRespuesta(res)[0] || null;
- `adapters/pocketbase/realtimeAnswers.js:210` const lista = byItem.get(it) ?? [];
- `adapters/pocketbase/realtimeAnswers.js:407` itemIndex: Number(r.item), value: r.value,
- `adapters/pocketbase/realtimeRooms.js:65` const idx = ('current_item' in patch) ? Number(patch.current_item) : s.currentItem;
- `adapters/pocketbase/realtimeRooms.js:120` if ('ql_open' in patch) { out.open = patch.ql_open ?? null; touched = true; }
- `adapters/pocketbase/realtimeRooms.js:121` if ('ql_question' in patch) { out.question = patch.ql_question ?? null; touched = true; }
- `adapters/pocketbase/realtimeRooms.js:122` if ('ql_image' in patch) { out.image = patch.ql_image ?? null; touched = true; }
- `adapters/pocketbase/realtimeRooms.js:123` if ('ql_by' in patch) { out.by = patch.ql_by ?? null; touched = true; }
- `adapters/pocketbase/realtimeRooms.js:124` if ('ql_by_name' in patch) { out.byName = patch.ql_by_name ?? null; touched = true; }
- `adapters/pocketbase/realtimeRooms.js:278` if (!bruta) return null;
- `adapters/pocketbase/realtimeRooms.js:295` started_at: rec.state?.startedAt ?? null,
- `adapters/pocketbase/realtimeRooms.js:473` if ('deadline' in patch) s.deadline = patch.deadline ?? null;
- `adapters/pocketbase/realtimeRooms.js:478` if ('answers_open_at' in patch) s.answersOpenAt = patch.answers_open_at ?? null;
- `adapters/pocketbase/realtimeRooms.js:479` if ('read_secs' in patch) s.readSecs = patch.read_secs ?? null;
- `adapters/pocketbase/realtimeRooms.js:487` if ('loop' in patch) s.loop = patch.loop ?? null;
- `adapters/pocketbase/realtimeRooms.js:488` if ('end_policy' in patch) s.endPolicy = patch.end_policy ?? null;
- `adapters/pocketbase/realtimeRooms.js:489` if ('end_n' in patch) s.endN = patch.end_n ?? null;
- `adapters/pocketbase/realtimeRooms.js:490` if ('started_at' in patch) s.startedAt = patch.started_at ?? null;
- `adapters/pocketbase/remoteStore.js:195` tags: Array.isArray(row.tags) ? row.tags.map(t => texto(t)) : [],
- `core/liveEnd.js:34` const pedida = String(session?.end_policy ?? '');
- `core/liveLoops.js:193` if (typeof puntuar !== 'function') return row.correct === true;
- `core/raceResume.js:32` const ms = Number(r.ms);
- `core/scoring/award.js:92` const remain = Math.max(0, 1 - (msTaken || 0) / itemWindowMs(activity ?? null, item));
- `core/scoring/marks.js:22` return Array.isArray(m) ? /** @type {TextMark[]} */ (m) : [];
- `core/textCorrectionRound.js:53` return Array.isArray(c?.passages) ? c.passages : [];
- `core/textCorrectionRound.js:95` <div class="tc-passage">${passageHtml(passages[0]?.text || '', kind)}</div>
- `core/textCorrectionRound.js:588` && num(guardado.idx) < passages.length && Array.isArray(guardado.results)) {
- `core/textCorrectionRound.js:634` if (!body) return;
- `core/textCorrectionRound.js:635` const ronda = renderTextCorrectionRound(body, passages[idx] || null, {
- `core/textCorrectionRound.js:681` if (!prev) return null;
- `core/textCorrectionRound.js:685` over += (rr.over ?? 0) - prev.over;
- `core/textCorrectionRound.js:702` if (!p) return;
- `core/textCorrectionRound.js:709` score += r.points; hits += r.hits; misses += miss; over += (r.over ?? 0);
- `core/textCorrectionRound.js:712` passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: (r.over ?? 0), total: r.total, correct: !!r.perfect, points: r.points 
- `core/textCorrectionRound.js:716` reveal(value, { hits: r.hits, over: (r.over ?? 0), misses: miss, total: r.total, correct: !!r.perfect });
- `core/textCorrectionRound.js:726` if (!p) return;
- `core/textCorrectionRound.js:826` const i = Number(hoja?.dataset.hoja);
- `core/textCorrectionRound.js:829` if (!set) return;
- `core/textCorrectionRound.js:886` const cls = heatClass(p.pctMarked ?? 0);
- `core/textCorrectionRound.js:887` const pct = Math.round((p.pctMarked ?? 0) * 100);
- `kernel/session/liveMachine.js:116` const limpio = f.ok ? f.value : String(nickname ?? '').trim();
- `kernel/session/score.js:103` if (Array.isArray(pre)) return pre[itemIndex] ?? respaldo;
- `kernel/session/teamsMachine.js:146` const member = { id: 'p' + (++state._seq), userId, name: f.ok ? f.value : String(nickname ?? '').trim() };
- `kernel/session/teamsMachine.js:218` const pts = Number.isFinite(points) ? Number(points) : (correct ? basePoints(item, activity?.scoring) : 0);
- `kernel/session/vsMachine.js:215` hits: acc.hits + (d.hits || 0),
- `kernel/session/vsMachine.js:216` over: acc.over + (d.over || 0),
- `kernel/session/vsMachine.js:217` total: acc.total + (d.total || 0),

### B · el juego y el alumno

- `core/editorShell.js:130` if (!iaSabeEscribir(modelo ?? '')) return '';
- `core/editorShell.js:334` const pv = /** @type {HTMLElement|null} */ (tile?.querySelector('.ww-bg-preview') ?? null);
- `core/editorShell.js:351` const msg = err instanceof Error ? err.message : String(err);
- `core/editorShell.js:376` if (!modelo) return;
- `core/editorShell.js:403` toast('No se pudo abrir el asistente: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_LARGO);
- `core/modes.js:80` return c && typeof c === 'object' && 'pairs' in c && Array.isArray(c.pairs) ? c.pairs : [];
- `core/modes.js:121` : sessionItems(a ?? null).length >= 1,
- `core/playOptions.js:129` if (!root) return;
- `core/roundRender.js:26` const opts = Array.isArray(payload?.options) ? payload.options : [];
- `core/roundRender.js:49` onSubmit?.(btn.dataset.value ?? '');
- `core/roundRender.js:91` const k = btn.dataset.k ?? '';
- `core/soloPlayer.js:144` return saved && typeof saved === 'object' && !Array.isArray(saved)
- `core/soloPlayer.js:322` const source = /** @type {I[]} */ (Array.isArray(contenido.items) ? contenido.items : []);
- `core/soloPlayer.js:345` && Number.isInteger(saved.idx) && Number(saved.idx) > 0 && Number(saved.idx) < items.length) {
- `core/soloPlayer.js:346` state.idx = Number(saved.idx);
- `core/soloPlayer.js:347` state.score = Number(saved.score) || 0;
- `kernel/content/convert.js:41` const crudos = 'items' in content && Array.isArray(content.items) ? content.items : [];
- `kernel/content/convert.js:54` return 'pairs' in content && Array.isArray(content.pairs) ? content.pairs : [];
- `kernel/content/convert.js:90` ...(nonEmpty(p.left) ? [{ id: rid('it_'), question: String(p.left), image: p.leftImage ?? p.image ?? null }] : []),
- `kernel/content/convert.js:91` ...(nonEmpty(p.right) ? [{ id: rid('it_'), question: String(p.right), image: p.rightImage ?? null }] : []),
- `kernel/content/models.js:44` return Array.isArray(v) ? v : null;
- `kernel/content/qaAdapt.js:37` return 'items' in content && Array.isArray(content.items)
- `kernel/content/sessionItems.js:33` if (v != null) return Array.isArray(v) ? v : [];
- `templates/ballsort/player.js:42` const host = /** @type {HTMLElement|null} */ (raiz?.querySelector('#bs-solo-host') ?? null);
- `templates/ballsort/player.js:43` if (!host) return;   // la ruta cambió mientras se montaba (§23)
- `templates/ballsort/template.js:97` const i = ctx?.itemIndex || 0;
- `templates/ballsort/template.js:111` if (!board) return null;
- `templates/colorear/player.js:76` if (!hex) return;
- `templates/crossword/player.js:32` const dentro = (sel) => /** @type {HTMLElement|null} */ (raiz()?.querySelector(sel) ?? null);
- `templates/crossword/player.js:34` const todos = (sel) => [...(raiz()?.querySelectorAll(sel) ?? [])].map(el => /** @type {HTMLElement} */ (el));
- `templates/diagram/player.js:27` const idDe = (el) => /** @type {HTMLElement} */ (el).dataset.id ?? '';
- `templates/diagram/player.js:37` const image = contenido?.image || null;
- `templates/diagram/player.js:76` if (!cuerdas.layer) return;
- `templates/diagram/player.js:141` const label = destino?.closest?.('.dg-label') ?? null;
- `templates/diagram/player.js:142` const pin   = destino?.closest?.('.dg-pin') ?? null;
- `templates/diagram/player.js:147` if (!dotEl) return;
- `templates/diagram/player.js:284` const w = Number(c?.imageW) || 0, h = Number(c?.imageH) || 0;
- `templates/diagram/scorer.js:13` const correct = String(value) === String(pin?.id ?? '');
- `templates/globos/player.js:74` racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
- `templates/globos/player.js:87` if (!root) return;
- `templates/globos/template.js:92` ${balloonFieldHtml(Array.isArray(payload?.options) ? payload.options : [])}
- `templates/match/player.js:44` return t && typeof t.closest === 'function' ? /** @type {HTMLElement|null} */ (t.closest(sel)) : null;
- `templates/match/player.js:70` const lefts  = quizaBarajar(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
- `templates/match/player.js:71` const rights = quizaBarajar(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));
- `templates/match/player.js:99` if (!capa) return;
- `templates/match/player.js:152` const id = c.dataset.id ?? '';
- `templates/match/player.js:252` (l, r) => scoreMatchSubmission({ value: byId.get(r)?.right ?? '', item: byId.get(l), activity }));
- `templates/match/player.js:255` const id = c.dataset.id ?? '', side = c.dataset.side;
- `templates/match/scorer.js:17` const correct = String(value) === String(par?.right ?? '');
- `templates/math/player.js:32` if (!roundEl) return;
- `templates/memory/player.js:68` const deckIds = Array.isArray(saved?.deckIds) ? saved.deckIds.map(String) : null;
- `templates/memory/player.js:69` const lockedIds = Array.isArray(saved?.locked) ? saved.locked.map(String) : null;
- `templates/memory/player.js:95` state.score = Number(saved.score) || 0;
- `templates/memory/player.js:96` state.matched = Number(saved.matched) || 0;
- `templates/memory/player.js:97` state.mistakes = Number(saved.mistakes) || 0;
- `templates/memory/player.js:98` state.flips = Number(saved.flips) || 0;
- `templates/memory/player.js:99` state.locked = new Set(lockedIds ?? []);
- `templates/memory/player.js:132` if (!cardId) return;
- `templates/memory/scorer.js:16` const correct = !!par?.id && String(value) === String(par.id);
- `templates/puzzle/player.js:150` const pieza = /** @type {HTMLElement|null} */ (destino?.closest('.pu-piece') ?? null);
- `templates/puzzle/scorer.js:22` const hits = Math.max(0, Math.min(total, v.encajadas ?? 0));
- `templates/question-live/player.js:29` return { question: it.question ?? it.q ?? '', image: it.image || null };
- `templates/question-live/player.js:93` <h4 class="card-title text-center">${escapeHtml(abierta.item.question || '')}</h4>
- `templates/question-live/player.js:106` const i = Number(b.dataset.i);
- `templates/question-live/player.js:193` const btn = /** @type {HTMLButtonElement|null} */ (rootEl()?.querySelector('#ab-spin') ?? null);
- `templates/quiz/player.js:53` racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
- `templates/quiz/template.js:87` return (it?.options || []).map(o => ({ key: String(o), label: String(o), ok: String(o) === String(it?.answer) }));
- `templates/quiz/template.js:95` static itemLabel(item) { return comoQaItem(item)?.question || ''; }
- `templates/quiz/template.js:118` const counts = opts.map(o => answers.filter(a => String(valorRespondido(a)) === String(o)).length);
- `templates/quiz/template.js:121` <h3 class="text-center mb-3">${escapeHtml(it?.question || '')}</h3>
- `templates/quiz/template.js:122` <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(it?.answer ?? ''))}</p>
- `templates/quiz/template.js:125` const isOk = String(o) === String(it?.answer);
- `templates/quiz/template.js:138` <h2 class="text-center my-4">${escapeHtml(it?.question || '')}</h2>
- `templates/quiz/template.js:162` if (Array.isArray(content.items)) {
- `templates/quiz/template.js:193` if (Array.isArray(it.answerIdx) && it.answerIdx.length) {
- `templates/quiz/template.js:196` .map(k => String(opciones[k] ?? ''))
- `templates/quiz/template.js:198` const lost = Array.isArray(it.answer)
- `templates/quiz/template.js:199` ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
- `templates/quiz/template.js:200` : String(it.answer ?? '').trim() === '';
- `templates/quiz/template.js:203` if (!Array.isArray(it.answerIdx)) {
- `templates/quiz/template.js:206` const hit = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
- `templates/tangram/player.js:173` const svgOpt = /** @type {SVGSVGElement|null} */ (root?.querySelector('.ta-svg') ?? null);
- `templates/tangram/player.js:174` const capaOpt = root?.querySelector('.ta-piezas') ?? null;
- `templates/tangram/player.js:237` const g = /** @type {SVGElement|null} */ (destino?.closest('.ta-pieza') ?? null);
- `templates/tangram/player.js:240` if (!n) return;
- `templates/tildes/template.js:28` const esTextCorrection = (c) => esObjeto(c) && Array.isArray(/** @type {{passages?: unknown}} */ (c).passages);
- `templates/wordsearch/player.js:64` ln.setAttribute('x1', String(ra.left + ra.width / 2 - sr.left));
- `templates/wordsearch/player.js:65` ln.setAttribute('y1', String(ra.top  + ra.height / 2 - sr.top));
- `templates/wordsearch/player.js:66` ln.setAttribute('x2', String(rb.left + rb.width / 2 - sr.left));
- `templates/wordsearch/player.js:67` ln.setAttribute('y2', String(rb.top  + rb.height / 2 - sr.top));
- `templates/wordsearch/player.js:69` ln.setAttribute('stroke-width', String(Math.max(5, ra.width * 0.7)));
- `templates/wordsearch/player.js:71` ln.setAttribute('opacity', String(opacity));
- `templates/wordsearch/player.js:93` const gridN    = SIZE_MAP[rules.gridSize ?? ''] || 15;
- `templates/wordsearch/player.js:156` function getCell(r, c) { return cellMap.get('${r},${c}') ?? null; }
- `templates/wordsearch/player.js:162` return { r: +el.dataset.r, c: +(el.dataset.c ?? 0) };
- `templates/wordsearch/player.js:309` if (!Array.isArray(grid)) return;
- `templates/wordsearch/player.js:350` return el?.dataset?.r ? { r: +el.dataset.r, c: +(el.dataset.c ?? 0) } : null;
- `templates/wordsearch/template.js:30` return (c?.words || []).map(w => (typeof w === 'string' ? w : (w?.word || ''))).filter(Boolean);
- `templates/wordsearch/template.js:80` return { ...c, words: ws.map(w => String((typeof w === 'string' ? w : w?.word) || '')).filter(Boolean) };
- `templates/wordsearch/template.js:97` const n = SIZE_MAP[rules.gridSize ?? ''] || 15;
- `views/live/hostInforme.js:143` if (!out) return;   // el hueco acaba de montarse: sin él no hay informe que cablear
- `views/live/hostInforme.js:158` } catch (e) { out.innerHTML = '<div class="alert alert-warning">No se pudo cargar: ${escapeHtml(e instanceof Error ? e.message : String(e))}
- `views/live/hostLobby.js:138` if (readEl) readEl.onchange = () => { rt.readSecs = Math.max(0, Math.min(READ_SECONDS_MAX, Math.round(+readEl.value || 0))); };
- `views/live/hostLobby.js:166` on(rt.rootSel, 'click', '.kick', (_, b) => kickPlayer(rt.sessionId, b.dataset.id || ''));
- `views/live/hostPalabra.js:99` const points    = Number(btn.dataset.pts);
- `views/live/hostRondas.js:45` const idx = rt.session.current_item ?? 0;
- `views/live/hostRondas.js:196` toast('Error al revelar: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL);
- `views/live/hostRondas.js:203` const idx = rt.session.current_item ?? 0;
- `views/live/hostRondas.js:289` const idx = rt.session.current_item ?? 0;
- `views/live/studentCarrera.js:42` if (typeof tpl?.renderRound !== 'function' || typeof tpl.scoreSubmission !== 'function') {
- `views/live/studentCarrera.js:141` if (!payload) return;   // índice fuera del snapshot: no hay ronda que pintar
- `views/live/studentCarrera.js:166` if (!hueco) return;
- `views/live/studentPalabra.js:103` on(rt.rootSel, 'click', '.ql-sbox:not([disabled])', (_, btn) => qlOpenQuestion(Number(btn.dataset.idx)));
- `views/live/studentPalabra.js:159` const btn = /** @type {HTMLButtonElement|null} */ (rootEl()?.querySelector('#ql-spin') ?? null);
- `views/live/studentRondas.js:67` const idx = rt.session.current_item ?? 0;
- `views/live/studentRondas.js:143` if (!payload) return;
- `views/live/studentRondas.js:180` if (!hueco) return;
- `views/live/studentRondas.js:228` const idx = rt.session.current_item ?? 0;
- `views/live/studentTablero.js:80` if (!hueco) return;
- `views/memoryView.js:47` c && typeof c === 'object' && 'pairs' in c && Array.isArray(c.pairs) ? c.pairs : []);
- `views/memoryView.js:83` const names = campos.map((el, i) => (el.value || '').trim() || 'Equipo ${i + 1}');
- `views/memoryView.js:149` const r = game.flip(btn.dataset.id || '');
- `views/playerView.js:248` if (!widget) return null;
- `views/playerView.js:459` toast(err instanceof Error ? err.message : String(err), 'warning', TOAST_NORMAL);
- `views/playerView.js:491` const name = b.dataset.name || '';
- `views/playerView.js:492` const label = (b.textContent || '').trim();
- `views/playerView.js:511` if (!copia) { toast(error ?? '', 'danger', TOAST_ERROR); return; }
- `views/playerView.js:528` on(rootSel, 'click', '.ww-mode-locked', (_, b) => pedirCuentaParaModo(b.dataset.lock || ''));
- `views/studentLive.js:118` err.textContent = e instanceof Error ? e.message : String(e);
- `views/studentLive.js:148` mount(rootSel, html'<div class="alert alert-danger m-3">${escapeHtml(e instanceof Error ? e.message : String(e))}</div>'); return;
- `views/studentTask.js:43` pastDue:         ['danger',    'Esta tarea venció el ${escapeHtml(new Date(t.due_at ?? '').toLocaleString())}.'],
- `views/studentTask.js:46` const msg = motivos[gate.reason ?? ''] || ['warning', 'Esta tarea no está disponible.'];
- `views/studentTask.js:144` const answers = packAnswers(Array.isArray(state.answers) ? state.answers : []);
- `views/studentTask.js:164` .catch(e => console.warn('record failed', e instanceof Error ? e.message : String(e)));
- `views/teamsView.js:87` const usesGenericRound = ['turns', 'board'].includes(T?.meta?.play?.teams ?? '');
- `views/teamsView.js:145` const names = entradas.map((el, i) => (el.value || '').trim() || 'Equipo ${i + 1}');
- `views/teamsView.js:281` return it.question || it.text || it.prompt || it.left || '';
- `views/teamsView.js:287` if (Array.isArray(it.marks)) return applyMarks(it.text || '', it.marks); // textCorrection
- `views/teamsView.js:288` if (it.answer != null) return Array.isArray(it.answer) ? it.answer.join(' / ') : String(it.answer);
- `views/teamsView.js:289` if (it.right != null) return String(it.right); // pairs
- `views/vsView.js:83` function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), '') || ''; }
- `views/vsView.js:252` errEl.textContent = err instanceof Error ? err.message : String(err);
- `views/vsView.js:271` const left  = (campo('#vs-name-left')?.value  || '').trim() || 'Alumno 1';
- `views/vsView.js:272` const right = (campo('#vs-name-right')?.value || '').trim() || 'Alumno 2';
- `views/vsView.js:468` if (scoreEl) scoreEl.textContent = String(session.standings()[side].score);

### C · editores, panel del profe, admin y herramientas

- `core/activityCard.js:147` const preset = VARIANTS[opts.variant || ''] || {};
- `core/activityCheck.js:70` const empezados = (lista) => (Array.isArray(lista) ? lista : [])
- `core/activityCheck.js:262` const faltaTitulo = vacio(a?.title) || String(a?.title ?? '').trim() === 'Sin título';
- `core/activityCheck.js:274` const revisor = POR_MODELO[T?.meta?.contentModel ?? ''];
- `core/aiContent.js:109` const lista = Array.isArray(datos) ? datos : (Array.isArray(sueltas) ? sueltas : null);
- `core/aiContent.js:125` const brutas = Array.isArray(posibles) ? posibles : [];
- `core/aiContent.js:243` const clave = ['items', 'pairs', 'words', 'passages'].find(k => Array.isArray(c[k]));
- `core/aiContent.js:245` return (clave && Array.isArray(lista)) ? { clave, lista } : null;
- `core/aiContent.js:259` const previas = Array.isArray(antes) ? antes : [];
- `core/aiContentModal.js:37` <span class="ia-pieza__b">${(Array.isArray(x.options) ? x.options : []).map(o =>
- `core/aiContentModal.js:83` Array.isArray(p.marks) ? p.marks : []);
- `core/aiContentModal.js:240` modelo, tema, curso: $sel('curso').value, cantidad: Number($in('n').value),
- `core/aiContentModal.js:241` url: EXTREMO(), token: getAuthToken() || '', fetchFn, palabrasComoTexto,
- `core/aiContentModal.js:253` aviso(e instanceof Error ? e.message : String(e));
- `core/aiContentModal.js:268` const b = /** @type {HTMLElement|null} */ (t?.closest?.('.ia-quitar') ?? null);
- `core/answerDetail.js:18` c: /** @type {boolean|null} */ ((a.c ?? a.correct) ?? null),
- `core/answerDetail.js:19` p: Number(a.p ?? a.points ?? 0),
- `core/assignmentsTransport.js:20` if (typeof fn !== 'function') throw new Error('assignments backend no soporta "${method}"');
- `core/attemptQueue.js:81` const estadoDe = (e) => (e && typeof e === 'object' && 'status' in e ? Number(e.status) : null);
- `core/attemptQueue.js:83` const motivo = (e) => (e instanceof Error ? e.message : String(e));
- `core/auth.js:162` return rec?.role || rec?.Role || null;
- `core/auth.js:180` if (!r.ok) return stored.record ?? null; // error transitorio (red/5xx): conserva la sesión
- `core/auth.js:186` } catch { return stored.record ?? null; /* sin red: conserva lo guardado */ }
- `core/auth.js:420` e instanceof Error ? e.message : String(e)));
- `core/auth.js:427` e instanceof Error ? e.message : String(e));
- `core/authWidget.js:18` if (!encontrado) return;
- `core/authWidget.js:61` if (!t || typeof t.closest !== 'function') return;
- `core/boot.js:51` return !!(el && typeof el.closest === 'function' && el.closest(sel));
- `core/bugReport.js:67` '  - [${e?.at || '?'}] ${String(e?.message || '').slice(0, 200)}${e?.page ? ' (${e.page})' : ''}')
- `core/classroom.js:35` const msg = (err && typeof err === 'object' && 'message' in err ? String(err.message) : '')
- `core/classroom.js:52` const cursos = Array.isArray(data.courses) ? data.courses : [];
- `core/classroom.js:54` ({ id: String(c.id ?? ''), name: String(c.name ?? ''), section: String(c.section ?? '') }));
- `core/classroom.js:81` return { id: String(data.id ?? ''), link: data.alternateLink ? String(data.alternateLink) : null };
- `core/classroomAuth.js:28` const gis = () => /** @type {GisGlobal|undefined} */ (Reflect.get(globalThis, 'google')) || null;
- `core/classroomAuth.js:79` resolve(String(resp.access_token || ''));
- `core/contentModels/items.js:70` if (Array.isArray(entries) && !Array.isArray(content?.items)) {
- `core/contentModels/items.js:71` return { items: entries.map(e => newItem(String(e))) };
- `core/contentModels/items.js:74` if (!Array.isArray(previos)) return /** @type {ItemsContent} */ (content);
- `core/contentModels/qa.js:88` lista.splice(donde, 0, lista.shift() ?? '');
- `core/coursePicker.js:29` host.querySelector('#cp-ok')?.addEventListener('click', () => done(sel?.value || null));
- `core/dbDiag.js:29` const motivo = (e) => (e instanceof Error ? e.message : String(e));
- `core/dbDiag.js:35` if ('message' in v && v.message) return String(v.message);
- `core/dbDiag.js:36` if ('code' in v && v.code) return String(v.code);
- `core/dbDiag.js:129` step({ name: 'Salud del servidor (/api/health)', pass: true, ms, info: String(value?.message || 'OK') });
- `core/dbDiag.js:160` const redMs = pasoRtt?.ms ?? 0;
- `core/dbDiag.js:216` const rtt = rttStep.ms ?? 0;
- `core/dbDiag.js:219` const estimated = rtt + (listStep.ms ?? 0);
- `core/dbDiag.js:224` info: '≈ ${estimated} ms total percibido (red ${rtt} ms + datos ${listStep.ms ?? 0} ms) · sensación: ${feel}',
- `core/duelSummary.js:48` const denom = (Number.isFinite(total) && (total ?? 0) > 0) ? total : m.total;
- `core/duelSummary.js:50` } else if (Number.isFinite(total) && (total ?? 0) > 0) {
- `core/editorModes.js:257` pres().vsAnimation = b.dataset.id || '';
- `core/editorModes.js:285` pres().taskMaxAttempts = Math.max(1, Number(valor(el)) || 1);
- `core/editorPanels.js:113` on(root, 'input', '#f-ppw', (_, el) => { a.scoring.pointsPerWrong = +valor(el) || 0; ctx.onChange(a); refrescar(); });
- `core/editorPanels.js:190` on(root, 'input', '#l-read', (_, el) => { a.live.readSeconds = Math.max(0, Math.min(30, Math.round(+valor(el) || 0))); oc(a); });
- `core/editorPanels.js:200` on(root, 'input', '#l-bonus', (_, el) => { a.live.speedBonusMax = +valor(el) || 0; oc(a); });
- `core/editorPrimitives.js:74` on(root, 'click', '.item-del', (_, b) => { list.splice(+(b.dataset.i ?? 0), 1); ctx.onChange(a); ctx.repaint(); });
- `core/editorPrimitives.js:75` on(root, 'click', '.item-up', (_, b) => { reorderArray(list, +(b.dataset.i ?? 0), -1); ctx.onChange(a); ctx.repaint(); });
- `core/editorPrimitives.js:76` on(root, 'click', '.item-down', (_, b) => { reorderArray(list, +(b.dataset.i ?? 0), +1); ctx.onChange(a); ctx.repaint(); });
- `core/editorPrimitives.js:95` const it = lista()[Number(el.dataset.i)];
- `core/editorPrimitives.js:96` if (!it) return;
- `core/editorPrimitives.js:157` a.rules.timer = Math.max(0, +(/** @type {HTMLInputElement} */ (el).value) || 0);
- `core/editorPrimitives.js:224` const item = (list || propios || [])[+(el.dataset.i ?? 0)];
- `core/editorPrimitives.js:226` const v = Math.round(+(/** @type {HTMLInputElement} */ (el).value) || 0);
- `core/editorPrimitives.js:303` const v = Math.round(Number(campo?.value));
- `core/errorLog.js:73` const n = detalle?.dropped || 0;
- `core/events.js:40` if (!sel) return cb(e, el);
- `core/events.js:44` const m = t && typeof t.closest === 'function' ? t.closest(sel) : null;
- `core/fullscreen.js:103` return ambito.querySelector?.(contenido) ?? null;
- `core/fullscreen.js:118` const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
- `core/fullscreen.js:128` return { w: he.offsetWidth || 0, h: he.offsetHeight || 0 };
- `core/fullscreen.js:154` if (!widget) return [];
- `core/fullscreen.js:195` || ((cb) => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb); else cb(); });
- `core/fullscreen.js:205` if (!vivo) return;
- `core/homePreview.js:53` const trunc = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
- `core/homePreview.js:71` const v = _cache.get(key) ?? '';
- `core/homePreview.js:207` return o?.text || o?.word || '';
- `core/html.js:30` return String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);
- `core/iaKeys.js:85` return Array.isArray(items) ? /** @type {ClaveIA[]} */ (items) : [];
- `core/iaKeys.js:156` motivo: texto(cuerpo.motivo) || null,
- `core/iaKeys.js:157` modelos: Array.isArray(modelos) ? modelos.map(String) : [],
- `core/imagePicker.js:95` toast('Error subiendo imagen: ' + (err instanceof Error ? err.message : String(err)), 'danger', TOAST_NORMAL);
- `core/imageSearch.js:52` const lista = (v) => (Array.isArray(v) ? v : []);
- `core/imageSearch.js:54` const cadena = (v) => (typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''));
- `core/imageSearchModal.js:84` <p id="${id}-nota" class="text-muted small mb-2">${escapeHtml(FUENTES[FUENTE_POR_DEFECTO]?.nota || '')}</p>
- `core/imageSearchModal.js:157` aviso('<i class="bi bi-exclamation-triangle"></i> ${escapeHtml(e instanceof Error ? e.message : String(e))} Comprueba tu conexión o sube la 
- `core/imageSearchModal.js:166` $('-nota').textContent = FUENTES[$sel('-src').value]?.nota || '';
- `core/imageSearchModal.js:172` const btn = /** @type {HTMLElement|null} */ (t?.closest?.('.ww-is-pick') ?? null);
- `core/imageSearchModal.js:174` const img = resultados[Number(btn.dataset.i)];
- `core/imageSearchModal.js:184` aviso('<i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err instanceof Error ? err.message : String(err))}', 'danger');
- `core/imageTile.js:50` const file = b.closest(tileSel)?.querySelector('.${prefix}img-file') ?? null;
- `core/imageTile.js:61` if (!input) return;
- `core/imageTile.js:69` } catch (err) { toast(err instanceof Error ? err.message : String(err), 'danger', TOAST_NORMAL); }
- `core/imageTile.js:75` const r = await abrirBuscadorImagenes({ consulta: String(items[i][queryField] ?? '') });
- `core/io.js:61` try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON inválido: ' + (e instanceof Error ? e.message : String(e))
- `core/io.js:66` if (sobre?.format === FORMAT && Number(sobre.version) > FORMAT_VERSION) {
- `core/io.js:72` if (sobre?.format === FORMAT && Array.isArray(sobre.activities)) activities = sobre.activities;
- `core/io.js:105` const nombre = esObjeto(raw) ? String(raw.title || raw.id || '?') : '?';
- `core/io.js:106` errors.push('"${nombre}": ${e instanceof Error ? e.message : String(e)}');
- `core/itemStats.js:108` if (partKeys.has(k)) marked.set(k, (marked.get(k) ?? 0) + 1);
- `core/itemStats.js:114` nMarked: marked.get(p.key) ?? 0, pctMarked: n ? (marked.get(p.key) ?? 0) / n : 0,
- `core/likes.js:33` return new Set((data?.items || []).map(r => String(r.activity ?? '')));
- `core/liveTransport.js:39` if (typeof fn !== 'function') throw new Error('realtime backend no soporta "${method}"');
- `core/ls.js:42` console.warn('[ls] localStorage write failed:', e instanceof Error ? e.message : String(e));
- `core/ls.js:76` console.warn('[ls] sessionStorage write failed:', e instanceof Error ? e.message : String(e));
- `core/ls.js:92` if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
- `core/migrate.js:65` const skin = NOMBRES_RETIRADOS[a.presentation?.skin || ''];
- `core/migrate.js:67` const solo = NOMBRES_RETIRADOS[a.scoring?.mode || ''];
- `core/migrate.js:69` const vivo = NOMBRES_RETIRADOS[a.live?.pointsModel || ''];
- `core/migrate.js:168` if (Array.isArray(v)) return v.length;
- `core/modalFallback.js:67` if (t && typeof t.closest === 'function' && t.closest('[data-bs-dismiss="modal"]')) cerrar();
- `core/penCalibration.js:62` const key = campo.dataset.tool || '';
- `core/playerHud.js:111` const el = /** @type {HTMLElement|null} */ (raiz?.querySelector('[data-hud="${campo}"]') ?? null);
- `core/playerHud.js:132` const barra = /** @type {HTMLElement|null} */ (raiz?.querySelector('[data-progreso] i') ?? null);
- `core/raceE2e.js:27` return String(x);
- `core/raceE2e.js:235` report.notes.push('Prueba interrumpida: ${e instanceof Error ? e.message : String(e)}');
- `core/registry.js:74` export function getTemplate(name) { return (name && _templates[name]) || null; }
- `core/resultScreen.js:21` if (icon === undefined && (maxScore ?? 0) > 0) {
- `core/resultScreen.js:22` const ratio = (score ?? 0) / (maxScore ?? 1);
- `core/results.js:101` console.warn('[results] save failed — queuing for retry:', e instanceof Error ? e.message : String(e));
- `core/search.js:77` if (key && cache.has(key)) return cache.get(key) ?? '';
- `core/selftest.js:121` assert(Array.isArray(/** @type {QaContent} */ (a.content).items), 'content.items migrado');
- `core/selftest.js:180` received = (d && typeof d === 'object' && 'v' in d) ? Number(d.v) : null;
- `core/selftest.js:369` r = { group: t.group, name: t.name, pass: false, error: e instanceof Error ? e.message : String(e) };
- `core/serverMs.js:32` const t = typeof v === 'string' ? Date.parse(v.replace(' ', 'T')) : Number(v);
- `core/skins.js:144` if (!skin) return;   // no hay ni 'default': nada que aplicar
- `core/skins.js:153` el.style.fontFamily = skin.fontFamily || '';
- `core/skins.js:182` if (!s) return '';
- `core/sounds.js:55` if (_cache.has(name)) return _cache.get(name) || null;
- `core/stageClaim.js:33` ? /** @type {StageNode|null} */ (globalThis.document?.querySelector(root) ?? null)
- `core/storage.js:60` return e instanceof Error ? e.message : String(e);
- `core/stressTest.js:160` if (v !== true) ansStatus[String(v)] = (ansStatus[String(v)] || 0) + 1;
- `core/stressTest.js:196` await delMany('live_answers', laRows.map(r => String(r.id)));
- `core/stressTest.js:197` await delMany('live_players', lpRows.map(r => String(r.id)));
- `core/stressTest.js:216` await delMany('assignment_attempts', aaRows.map(r => String(r.id)));
- `core/submitQueue.js:65` const estadoDe = (e) => (e && typeof e === 'object' && 'status' in e ? Number(e.status) : null);
- `core/submitQueue.js:67` const motivo = (e) => (e instanceof Error ? e.message : String(e));
- `core/teachers.js:18` id: String(u.id ?? ''), name: String(u.name ?? ''), email: String(u.email ?? ''),
- `core/teachers.js:19` role: String(u.role || u.Role || ''), created: String(u.created ?? ''),
- `core/templateContract.js:85` if (!['ejercicio', 'juego'].includes(m.kind ?? '')) {
- `core/templateContract.js:142` const liveRaw = /** @type {string[]} */ (Array.isArray(m.play.live) ? m.play.live : (m.play.live ? [m.play.live] : []));
- `core/templateContract.js:179` if (typeof T.renderRound === 'function' && !(m.play.submit && SUBMIT_KINDS.includes(m.play.submit))) {
- `core/templateContract.js:191` const model = getModel(m.contentModel ?? '');
- `core/templateContract.js:198` try { dc = /** @type {import('../kernel/contracts/activity.js').ActivityContent} */ (m.defaultContent()); } catch (e) { issues.push('default
- `core/templateContract.js:268` } catch (e) { issues.push('migrateContent lanza sobre defaultContent: ${e instanceof Error ? e.message : String(e)}'); }
- `core/textCorrectionDraw.js:110` pos: Number(el.dataset.pos), el,
- `core/textCorrectionDraw.js:115` hit: prevHit.get(Number(el.dataset.pos)) || false,
- `core/textCorrectionDraw.js:322` const action = votos.has(e.pointerId) ? resolver(e.pointerId) : (pointerAction.get(e.pointerId) || null);
- `core/textCorrectionEditor.js:48` if (!Array.isArray(hoja(a)?.passages)) a.content = { passages: [newPassage()] };
- `core/textCorrectionEditor.js:73` const n = hoja(a).passages.filter(p => String(p.text || '').trim() && !(p.marks || []).length).length;
- `core/textCorrectionEditor.js:88` const idx = Number(el.dataset.i);
- `core/textCorrectionEditor.js:91` if (!p) return;
- `core/textCorrectionEditor.js:118` hoja(a).passages = hoja(a).passages.filter(p => String(p.text || '').trim() !== '');
- `core/textCorrectionEditor.js:125` hoja(a).passages = hoja(a).passages.filter(p => !String(p.text || '').trim() || (p.marks || []).length);
- `core/textCorrectionEditor.js:132` on(root, 'click', '.item-del', (_, b) => { hoja(a).passages.splice(Number(b.dataset.i), 1); ctx.onChange(a); ctx.repaint(); });
- `core/textCorrectionEditor.js:133` on(root, 'click', '.item-up', (_, b) => { reorderArray(hoja(a).passages, Number(b.dataset.i), -1); ctx.onChange(a); ctx.repaint(); });
- `core/textCorrectionEditor.js:134` on(root, 'click', '.item-down', (_, b) => { reorderArray(hoja(a).passages, Number(b.dataset.i), +1); ctx.onChange(a); ctx.repaint(); });
- `core/timings.js:79` const raw = (item && typeof item === 'object' && 'seconds' in item) ? Number(item.seconds) : NaN;
- `core/toast.js:123` return String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);
- `core/upload.js:73` if (!ctx) return null;                                 // sin 2D no hay compresión posible
- `core/vsAnimStore.js:31` if (!Array.isArray(crudo)) return [];
- `core/vsAnimStore.js:66` return entry.src || '';
- `core/vsAnimations.js:76` export function getVsAnimation(id) { return _providers.get(id || '') || _providers.get('svg-tug'); }
- `core/vsAnimations.js:355` registerVsAnimation(lottieProvider({ id: entry.id, label: entry.label, description: entry.description || '', src: blobSrc(entry) }));
- `main.embed.js:64` const detalle = e instanceof Error ? (e.stack || e.message) : String(e);
- `main.student.js:43` } catch (err) { console.warn('[boot] auth failed:', err instanceof Error ? err.message : String(err)); }
- `main.teacher.js:123` try { const _res = await completeOAuthLogin(_code, _state); _returnHash = _res?.returnHash || ''; }
- `main.teacher.js:125` const _msg = e instanceof Error ? e.message : String(e);
- `templates/ballsort/play.js:167` if (!last) return;
- `templates/ballsort/render/drag.js:44` const idx = parseInt(tube.dataset.index ?? '', 10);
- `templates/ballsort/render/drag.js:97` const tube = /** @type {HTMLElement|null} */ (destino?.closest?.('.tube') ?? null);
- `templates/ballsort/render/drag.js:99` const idx = parseInt(tube.dataset.index ?? '', 10);
- `templates/base.js:77` const prompt = payload?.question ?? payload?.text ?? it.question ?? it.text ?? '';
- `templates/base.js:79` ? '<p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(it.answer))}</p>'
- `templates/crossword/editor.js:18` const palabras = (a) => /** @type {{words?: CrosswordWord[]}} */ (a.content ?? {}).words ?? [];
- `templates/crossword/editor.js:40` if (!Array.isArray(contenido.words)) contenido.words = [];
- `templates/crossword/editor.js:161` words().splice(+(btn.dataset.i ?? 0), 1);
- `templates/crossword/editor.js:178` const w = words()[+(el.dataset.i ?? 0)];
- `templates/crossword/editor.js:183` on(root, 'input', '.cw-clue',  (e, el) => { words()[+(el.dataset.i ?? 0)].clue = valorDe(e); ctx.onChange(a); });
- `templates/crossword/editor.js:184` on(root, 'input', '.cw-row',   (e, el) => { words()[+(el.dataset.i ?? 0)].row  = Math.max(0, +valorDe(e) || 0); ctx.onChange(a); refreshPrev
- `templates/crossword/editor.js:185` on(root, 'input', '.cw-col',   (e, el) => { words()[+(el.dataset.i ?? 0)].col  = Math.max(0, +valorDe(e) || 0); ctx.onChange(a); refreshPrev
- `templates/crossword/editor.js:187` on(root, 'change', '.cw-dir',  (e, el) => { words()[+(el.dataset.i ?? 0)].dir = valorDe(e) === 'V' ? 'V' : 'H'; ctx.onChange(a); refreshPrev
- `templates/diagram/editor.js:36` if (!Array.isArray(cont(a).pins)) cont(a).pins = [];
- `templates/diagram/editor.js:133` } catch (err) { toast('No se pudo cargar la imagen: ' + (err instanceof Error ? err.message : String(err)), 'warning', TOAST_NORMAL); }
- `templates/diagram/editor.js:157` c.pins[Number(el.dataset.i)].label = campo.value;
- `templates/diagram/editor.js:160` on(root, 'click', '.dg-pin-del', (_, b) => { c.pins.splice(Number(b.dataset.i), 1); ctx.onChange(a); ctx.repaint(); });
- `templates/diagram/editor.js:176` const pin = /** @type {HTMLElement|null} */ (destino?.closest?.('.dg-edit-pin') ?? null);
- `templates/diagram/editor.js:179` drag = { i: Number(pin.dataset.i), moved: false, pointerId: e.pointerId };
- `templates/match/editor.js:86` const p = pares(a)[Number(el.dataset.i)];
- `templates/match/editor.js:87` if (!p) return;
- `templates/match/editor.js:92` const p = pares(a)[Number(el.dataset.i)];
- `templates/match/editor.js:93` if (!p) return;
- `templates/match/editor.js:101` const par = /** @type {Record<string, unknown>|undefined} */ (pares(a)[Number(btn.dataset.i)]);
- `templates/match/editor.js:103` if (!par) return;
- `templates/match/editor.js:119` } catch (err) { toast(err instanceof Error ? err.message : String(err), 'danger', TOAST_NORMAL); }
- `templates/match/editor.js:128` const par = pares(a)[Number(btn.dataset.i)];
- `templates/match/editor.js:129` if (!par) return;
- `templates/match/editor.js:144` const par = pares(a)[Number(btn.dataset.i)];
- `templates/match/editor.js:145` if (!par) return;
- `templates/math/editor.js:17` const operaciones = (a) => /** @type {{items?: QaItem[]}} */ (a.content ?? {}).items ?? [];
- `templates/math/editor.js:31` if (!Array.isArray(contenido.items)) contenido.items = [];
- `templates/math/editor.js:65` const n = Math.max(1, Math.min(12, +(campo?.value ?? '') || 2));
- `templates/math/editor.js:66` for (let i = 1; i <= 10; i++) items.push({ id: rid('m_'), question: '${n} × ${i}', answer: String(n * i) });
- `templates/math/editor.js:69` on(root, 'input', '.it-q', (e, el) => { items[+(el.dataset.i ?? 0)].question = valorDe(e); ctx.onChange(a); });
- `templates/math/editor.js:70` on(root, 'input', '.it-a', (e, el) => { items[+(el.dataset.i ?? 0)].answer = valorDe(e).trim(); ctx.onChange(a); });
- `templates/math/editor.js:72` on(root, 'click', '.it-del', (_, b) => { items.splice(+(b.dataset.i ?? 0), 1); ctx.onChange(a); ctx.repaint(); });
- `templates/math/editor.js:101` if (!items.length) return '<p class="text-muted">Sin operaciones. Usa "Generar" o "Añadir operación".</p>';
- `templates/puzzle/editor.js:98` if (!banco || !Array.isArray(dibujos) || !dibujos.length) {
- `templates/puzzle/editor.js:128` const [f, c] = ('value' in el ? String(el.value) : '').split('x').map(Number);
- `templates/puzzle/editor.js:136` if (!nombre) return;
- `templates/question-live/editor.js:33` if (!Array.isArray(/** @type {ItemsContent} */ (a.content)?.items)) {
- `templates/question-live/editor.js:54` <input class="form-control ql-q" data-i="${i}" placeholder="Escribe la pregunta aquí…" value="${escapeHtml(item.question ?? /** @type {CardI
- `templates/question-live/editor.js:58` <div class="col-12 col-md-3 text-center" id="ql-img-${i}">${imageTileHtml(item.image || '', { prefix: 'ql-', height: 90 })}</div>
- `templates/quiz/editor.js:21` const preguntas = (a) => /** @type {{items?: QaItem[]}} */ (a?.content ?? {}).items ?? [];
- `templates/quiz/editor.js:50` if (!Array.isArray(contenido.items)) contenido.items = [];
- `templates/quiz/editor.js:51` contenido.items.forEach(it => { if (!Array.isArray(it.options)) it.options = ['', '', '', '']; });
- `templates/quiz/editor.js:86` on(root, 'click', '.item-del', (_, btn) => { items.splice(+(btn.dataset.i ?? 0), 1); ctx.onChange(a); ctx.repaint(); });
- `templates/quiz/editor.js:87` on(root, 'click', '.item-up', (_, btn) => { reorderArray(items, +(btn.dataset.i ?? 0), -1); ctx.onChange(a); ctx.repaint(); });
- `templates/quiz/editor.js:88` on(root, 'click', '.item-down', (_, btn) => { reorderArray(items, +(btn.dataset.i ?? 0), +1); ctx.onChange(a); ctx.repaint(); });
- `templates/quiz/editor.js:89` on(root, 'input', '.it-q', (e, el) => { items[+(el.dataset.i ?? 0)].question = valorDe(e); ctx.onChange(a); });
- `templates/quiz/editor.js:91` const i = +(el.dataset.i ?? 0), k = +(el.dataset.k ?? 0), item = items[i];
- `templates/quiz/editor.js:100` const i = +(el.dataset.i ?? 0), k = +(el.dataset.k ?? 0), item = items[i];
- `templates/quiz/editor.js:109` items[+(el.dataset.i ?? 0)].points = +valorDe(e) || 1;
- `templates/quiz/editor.js:199` if (!Array.isArray(item.options)) item.options = [];
- `templates/quiz/editor.js:229` if (!items.length) return '<p class="text-muted">No hay preguntas todavía.</p>';
- `templates/tangram/editor.js:30` if (!c || !Array.isArray(c.items) || !c.items.length) {
- `templates/tangram/editor.js:76` if (!figura) return;
- `templates/tangram/game/mascara.js:89` if (Array.isArray(f)) return Array.isArray(f[0]) ? f : null;
- `templates/wheel/editor.js:35` if (Array.isArray(legado.entries) && !Array.isArray(legado.items)) {
- `templates/wheel/editor.js:39` if (!Array.isArray(legado.items)) a.content = { items: [newItem(), newItem(), newItem(), newItem()] };
- `templates/wheel/editor.js:58` <input class="form-control we-entry" data-i="${i}" placeholder="Opción ${i + 1}" value="${escapeHtml(item.question ?? /** @type {CardItemLeg
- `templates/wheel/editor.js:62` <div class="col-12 col-md-3 text-center" id="we-img-${i}">${imageTileHtml(item.image ?? '', { prefix: 'we-', height: 80 })}</div>
- `templates/wordsearch/editor.js:20` if (!Array.isArray(c.words)) c.words = [];
- `templates/wordsearch/editor.js:46` const size  = SIZE_MAP[wordsearchRules(a).gridSize ?? ''] || 15;
- `templates/wordsearch/editor.js:124` const size = SIZE_MAP[rules.gridSize ?? ''] || 15;
- `templates/wordsearch/editor.js:150` palabras(a)[Number(el.dataset.i)] = /** @type {HTMLInputElement} */ (el).value;
- `templates/wordsearch/editor.js:158` palabras(a).splice(Number(btn.dataset.i), 1);
- `templates/wordsearch/editor.js:161` on(root, 'click', '.item-up',   (_, btn) => { reorderArray(palabras(a), Number(btn.dataset.i), -1); ctx.onChange(a); ctx.repaint(); });
- `templates/wordsearch/editor.js:162` on(root, 'click', '.item-down', (_, btn) => { reorderArray(palabras(a), Number(btn.dataset.i), +1); ctx.onChange(a); ctx.repaint(); });
- `templates/wordsearch/editor.js:174` const txt = /** @type {HTMLTextAreaElement|null} */ (root.querySelector('#ws-bulk-txt'))?.value || '';
- `templates/wordsearch/generator.js:126` let best = generateGrid(words, { ...opts, seedSalt: '${opts.seedSalt || ''}#0' });
- `templates/wordsearch/generator.js:127` if (!best.failed.length) return best;
- `views/activityCardWire.js:38` if (b.dataset.locked) { pedirCuentaParaModo(b.dataset.mode || ''); return; }
- `views/admin/ai.js:9` const msgDe = (e) => (e instanceof Error && e.message ? e.message : String(e));
- `views/admin/ai.js:104` return { token: String(d?.token ?? ''), PB_URL };
- `views/admin/ai.js:109` throw new Error(String(b.message || 'Error de autenticación (${r.status})'));
- `views/admin/ai.js:161` const id = btn.dataset.id ?? '';
- `views/admin/ai.js:189` await cambiarEstado(token, btn.dataset.id ?? '', btn.dataset.activa === '0');
- `views/admin/ai.js:202` await eliminarClave(token, btn.dataset.id ?? '');
- `views/admin/ai.js:211` const etiqueta = campo('ia-label')?.value?.trim() || '';
- `views/admin/ai.js:262` curso: '5.º de primaria', cantidad: 2, url: '${PB_URL}/api/ia/contenido', token: getAuthToken() || '' });
- `views/admin/ai.js:266` const items = Array.isArray(brutos) ? /** @type {unknown[]} */ (brutos) : [];
- `views/admin/ai.js:284` const modelos = (d && Array.isArray(d.modelos)) ? /** @type {unknown[]} */ (d.modelos) : [];
- `views/admin/capacity.js:15` const msgDe = (e) => (e instanceof Error && e.message ? e.message : String(e));
- `views/admin/collections.js:38` const msgDe = (e) => (e instanceof Error && e.message ? e.message : String(e));
- `views/admin/collections.js:63` if (!out) return;
- `views/admin/collections.js:86` return String(d?.token ?? '');
- `views/admin/collections.js:91` throw new Error(String(b.message || 'Error de autenticación (${r.status})'));
- `views/admin/collections.js:326` return d?.id == null ? null : String(d.id);
- `views/admin/dataSystem.js:16` return typeof fn === 'function' ? /** @type {() => void} */ (fn) : null;
- `views/admin/liveWords.js:51` const raw = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('lw-words'))?.value || '';
- `views/admin/loadTests.js:13` const msgDe = (e) => (e instanceof Error && e.message ? e.message : String(e));
- `views/admin/loadTests.js:80` const n = Number(sel?.value) || 30;
- `views/admin/maintenance.js:40` catch (e) { fallos.push('${id}: ${e instanceof Error ? e.message : String(e)}'); console.warn('[admin] no se pudo borrar', id, e); }
- `views/admin/matrix.js:26` targets: caps.filter(dst => dst.name !== src.name && canConvert(src.contentModel || '', dst.contentModel || ''))
- `views/admin/teachers.js:11` const msgDe = (e) => (e instanceof Error && e.message ? e.message : String(e));
- `views/admin/teachers.js:66` const id = b.dataset.id ?? '', role = b.dataset.role ?? '';
- `views/admin/teachers.js:81` const pass = campo('teach-pass')?.value || '';
- `views/admin/vsAnimations.js:69` removeCustomAnim(b.dataset.id ?? '');
- `views/admin/vsAnimations.js:98` if (errEl) errEl.textContent = e instanceof Error ? e.message : String(e);
- `views/assignments.js:103` const title = (campo('t-title')?.value || '').trim();
- `views/assignments.js:104` const due = campo('t-due')?.value || '';
- `views/assignments.js:105` const max = +(campo('t-max')?.value || '') || 1;
- `views/assignments.js:110` } catch (e) { toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL); }
- `views/assignments.js:113` navigator.clipboard?.writeText(b.dataset.url || '');
- `views/assignments.js:144` if (!rotId) return;
- `views/assignments.js:148` } catch (e) { toast('Error rotando PIN: ' + (e instanceof Error ? e.message : String(e)), 'danger'); }
- `views/assignments.js:154` if (!closeId) return;
- `views/assignments.js:189` const suyos = byName.get(k) ?? [];
- `views/assignments.js:248` if (!out) return;   // la vista ya no está montada
- `views/author.js:125` toast('No se pudo guardar la imagen: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL);
- `views/author.js:181` const val = (id) => (/** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (document.getElementById(id))?.value || '').trim();
- `views/author.js:194` toast('No se pudo guardar el perfil: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL);
- `views/author.js:200` const oldP = /** @type {HTMLInputElement|null} */ (document.getElementById('au-pw-old'))?.value || '';
- `views/author.js:201` const newP = /** @type {HTMLInputElement|null} */ (document.getElementById('au-pw-new'))?.value || '';
- `views/author.js:208` toast(e instanceof Error ? e.message : String(e), 'danger', TOAST_NORMAL);
- `views/author.js:218` catch (e) { toast(e instanceof Error ? e.message : String(e), 'danger', TOAST_NORMAL); btn.disabled = false; }
- `views/editList.js:45` if (!raiz) return;
- `views/editList.js:132` if (!rmId) return;
- `views/editList.js:144` if (!addId) return;
- `views/editView.js:189` if (!silent) toast('No se pudo sincronizar: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_LARGO);
- `views/editView.js:204` const label = (btn.textContent || '').trim();
- `views/editView.js:205` if (!name) return;
- `views/embedModal.js:102` if (!el) return;
- `views/embedModal.js:116` const sIdx = +($sel(id + '-size')?.value || 0);
- `views/embedModal.js:117` const skin = $sel(id + '-skin')?.value || '';
- `views/embedModal.js:118` const bg = $sel(id + '-bg')?.value || '';
- `views/embedModal.js:119` const tpl = $sel(id + '-tpl')?.value || '';
- `views/embedModal.js:140` await navigator.clipboard.writeText($snippet()?.value || '');
- `views/explore.js:69` if (lista) lista.innerHTML = '<div class="alert alert-danger">${escapeHtml(e instanceof Error ? e.message : String(e))}</div>';
- `views/home.js:170` if (!id) return;
- `views/home.js:195` if (!delId) return;
- `views/home.js:199` toast('Eliminada localmente; no se pudo borrar en el servidor: ' + (e instanceof Error ? e.message : String(e)), 'warning', TOAST_NORMAL);
- `views/hostLive.js:125` const needsSetup = /live_sessions/.test(err.message || '');
- `views/hostLive.js:366` rt.answers = await listAnswers(sessionId, rt.session.current_item ?? 0);
- `views/itemStatsView.js:45` const stats = aggregate({ items, template: T, rows: rows ?? [], activity: activity ?? null });
- `views/landing.js:111` const q = (/** @type {HTMLInputElement|null} */ (document.getElementById('lp-q'))?.value || '').trim();
- `views/landing.js:122` if (!likeId) return;
- `views/landing.js:131` toast(err instanceof Error ? err.message : String(err), 'info', TOAST_NORMAL);
- `views/listView.js:39` if (!raiz) return;
- `views/listView.js:116` leftName = (/** @type {HTMLInputElement|null} */ (document.getElementById('list-name-left'))?.value || '').trim() || 'Alumno 1';
- `views/listView.js:117` rightName = (/** @type {HTMLInputElement|null} */ (document.getElementById('list-name-right'))?.value || '').trim() || 'Alumno 2';
- `views/loginModal.js:91` const uri = code?.textContent || '';
- `views/loginModal.js:108` catch (err) { showErr(err instanceof Error ? err.message : String(err)); }
- `views/loginModal.js:112` const email = $inp('#lm-email')?.value.trim() || '';
- `views/loginModal.js:113` const pass = $inp('#lm-pass')?.value || '';
- `views/loginModal.js:134` const email = campo?.value.trim() || '';
- `views/moderate.js:107` const q = campo?.value || '';
- `views/moderate.js:186` if (!id) return;
- `views/moderate.js:188` catch (e) { toast('No se pudo: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL); }
- `views/moderate.js:194` if (!row?.dataset.activity) return;
- `views/registro.js:42` try { await signInWithGoogle(); } catch (e) { err(e instanceof Error ? e.message : String(e)); }
- `views/registro.js:53` const v = (id) => /** @type {HTMLInputElement|null} */ (document.getElementById(id))?.value ?? '';
- `views/registro.js:66` catch (e2) { console.warn('[registro] cuenta creada; el perfil no se pudo sellar aún:', e2 instanceof Error ? e2.message : String(e2)); }
- `views/reports.js:49` const activity = rec.activity || null;
- `views/reports.js:53` activityId: activity?.id || null,

## Diff de runtime por fichero (niveles A y B; el C queda cubierto por la matriz, los recorridos y la lista de arriba)

## A · puntos, sala y datos

### adapters/pocketbase/realtimeRooms.js (+104 −75)

```diff
@@ línea 14
+import { blobDeSala, esFila, estadoDeSala, estadoPb, fila, filas, mapaNumeros, mapaTextos, numero, numeroOnulo, paraHidratar, texto, textoOnulo } from '../frontera.js';
@@ línea 61
-  const iso = rec?.updated;
+  const iso = textoOnulo(fila(rec).updated);
@@ línea 64
-  const idx = ('current_item' in patch) ? Number(patch.current_item) : engine.state.currentItem;
+  const s = blobDeSala(engine);
+  const idx = ('current_item' in patch) ? Number(patch.current_item) : s.currentItem;
@@ línea 67
-  const map = engine.state.itemOpenedAt || (engine.state.itemOpenedAt = {});
+  const map = s.itemOpenedAt || (s.itemOpenedAt = {});
@@ línea 81
-  const q = rec?.ql || {};
-  const s = rec?.state || {};
+  const q = fila(fila(rec).ql);
+  const s = fila(fila(rec).state);
@@ línea 84
-    ql_open: q.open ?? s.qlOpen ?? null,
-    ql_question: q.question ?? s.qlQuestion ?? null,
-    ql_image: q.image ?? s.qlImage ?? null,
-    ql_by: q.by ?? s.qlBy ?? null,
-    ql_by_name: q.byName ?? s.qlByName ?? null,
-    ql_points: s.qlPoints ?? {},
-    ql_taken: s.qlTaken ?? {},
+    ql_open: numeroOnulo(q.open) ?? numeroOnulo(s.qlOpen),
+    ql_question: textoOnulo(q.question) ?? textoOnulo(s.qlQuestion),
+    ql_image: textoOnulo(q.image) ?? textoOnulo(s.qlImage),
+    ql_by: textoOnulo(q.by) ?? textoOnulo(s.qlBy),
+    ql_by_name: textoOnulo(q.byName) ?? textoOnulo(s.qlByName),
+    ql_points: mapaNumeros(s.qlPoints),
+    ql_taken: mapaTextos(s.qlTaken),
@@ línea 95
+const actividadDe = (x) => (esFila(x) ? /** @type {Activity} */ (x) : null);
+const conBlob = (f) => ({
+  id: texto(f.id), code: texto(f.code),
+  activity: actividadDe(f.activity), state: estadoDeSala(f.state),
+});
+const filaDeSala = (rec) => /** @type {RoomRecord} */ (rec);
@@ línea 117
-  const MAP = { ql_open: 'open', ql_question: 'question', ql_image: 'image', ql_by: 'by', ql_by_name: 'byName' };
@@ línea 120
-  for (const [k, v] of Object.entries(MAP)) if (k in patch) { out[v] = patch[k] ?? null; touched = true; }
+  if ('ql_open' in patch) { out.open = patch.ql_open ?? null; touched = true; }
+  if ('ql_question' in patch) { out.question = patch.ql_question ?? null; touched = true; }
+  if ('ql_image' in patch) { out.image = patch.ql_image ?? null; touched = true; }
+  if ('ql_by' in patch) { out.by = patch.ql_by ?? null; touched = true; }
+  if ('ql_by_name' in patch) { out.byName = patch.ql_by_name ?? null; touched = true; }
@@ línea 160
-    if (keyCache.has(sessionId)) return keyCache.get(sessionId);
+    const enCache = keyCache.get(sessionId);
+    if (enCache !== undefined) return enCache;
@@ línea 166
-      full = res?.items?.[0]?.activity || null;
+      full = actividadDe(filas(res)[0]?.activity);
@@ línea 168
-    const act = full || rec?.activity || null;
+    const act = full || actividadDe(fila(rec).activity);
@@ línea 175
-    const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
-    if (!rec) throw new Error('Sala no encontrada');
-    const engine = createLiveRoom(await fullActivity(sessionId, rec), { state: rec.state, code: rec.code });
+    const res = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
+    if (!esFila(res)) throw new Error('Sala no encontrada');
+    const rec = res;
+    const act = /** @type {Activity} */ (await fullActivity(sessionId, rec));
+    const engine = /** @type {LiveEngine} */ (
+      createLiveRoom(act, { state: paraHidratar(estadoDeSala(rec.state)), code: texto(rec.code) })
+    );
@@ línea 205
-    return (res?.items || []).map(r => ({ id: r.id, name: r.name, userId: r.user_id, score: 0 }));
+    return filas(res).map(r => ({ id: texto(r.id), name: texto(r.name), userId: texto(r.user_id), score: 0 }));
@@ línea 213
-      let usedCodes = new Set();
+      const usedCodes = new Set();
@@ línea 217
-        for (const rec of res?.items || []) usedCodes.add(rec.code);
+        for (const rec of filas(res)) usedCodes.add(texto(rec.code));
@@ línea 224
-        const engine = createLiveRoom(activity, { code });
+        const engine = /** @type {LiveEngine} */ (createLiveRoom(activity, { code }));
@@ línea 229
-          const rec = await pbFetch(`/api/collections/${COLL}/records`, {
+          const rec = fila(await pbFetch(`/api/collections/${COLL}/records`, {
@@ línea 232
-          });
+          }));
+          const salaId = texto(rec.id);
@@ línea 239
-              method: 'POST', body: JSON.stringify({ session: rec.id, activity }),
+              method: 'POST', body: JSON.stringify({ session: salaId, activity }),
@@ línea 242
-            if (ke?.status === 404) {
+            if (estadoPb(ke) === 404) {
@@ línea 248
-          keyCache.set(rec.id, activity);
-          return { id: rec.id, code };
+          keyCache.set(salaId, activity);
+          return { id: salaId, code };
@@ línea 251
-          if (e.status === 404) {
+          if (estadoPb(e) === 404) {
@@ línea 261
-          const retryable = !e.status || e.status === 400 || e.status === 409 || e.status >= 500;
+          const estado = estadoPb(e);
+          const retryable = !estado || estado === 400 || estado === 409 || estado >= 500;
@@ línea 277
-      const rec = res?.items?.[0];
-      if (!rec) return null;
+      const bruta = filas(res)[0];
+      if (!bruta) return null;
+      const rec = conBlob(bruta);
@@ línea 292
+        started_at: rec.state?.startedAt ?? null,
@@ línea 297
-        ...qlOf(rec),
+        ...qlOf(bruta),
@@ línea 303
-      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
-      if (!rec) throw new Error('Sala no encontrada');
+      const bruta = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
+      if (!esFila(bruta)) throw new Error('Sala no encontrada');
+      const rec = conBlob(bruta);
@@ línea 320
-        ...qlOf(rec),
+        ...qlOf(bruta),
@@ línea 344
-        return res?.items || [];
+        return filas(res).map(filaDeSala);
@@ línea 347
-        return res?.items || [];
+        return filas(res).map(filaDeSala);
@@ línea 354
-      try { return await pbFetch(`/api/collections/${COLL}/records/${sessionId}`); }
-      catch (e) { if (e?.status === 404) return null; throw e; }
+      try {
+        const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
+        return esFila(rec) ? filaDeSala(rec) : null;
+      }
+      catch (e) { if (estadoPb(e) === 404) return null; throw e; }
@@ línea 368
-      return rec?.state || {};
+      return estadoDeSala(fila(rec).state);
@@ línea 377
-      const rec = res?.items?.[0];
+      const rec = filas(res)[0];
@@ línea 379
-      if (rec.state?.status === 'ended') throw new Error('La sala ha terminado');
-      const live = rec.activity?.live || {};
-      if (rec.state?.status !== 'lobby' && live.allowLateJoin === false) throw new Error('La partida ya empezó');
+      const salaId = texto(rec.id);
+      const estadoSala = estadoDeSala(rec.state);
+      if (estadoSala.status === 'ended') throw new Error('La sala ha terminado');
+      const live = actividadDe(rec.activity)?.live || {};
+      if (estadoSala.status !== 'lobby' && live.allowLateJoin === false) throw new Error('La partida ya empezó');
@@ línea 396
-        const mine = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(rec.id, `user_id='${pbEscape(userId)}'`)}&perPage=1`);
-        if (mine?.items?.length && claimSecret(rec.id)) {
-          const row = mine.items[0];
-          return { sessionId: rec.id, playerId: row.id, name: row.name };
+        const mine = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(salaId, `user_id='${pbEscape(userId)}'`)}&perPage=1`);
+        const mia = filas(mine)[0];
+        if (mia && claimSecret(salaId)) {
+          return { sessionId: salaId, playerId: texto(mia.id), name: texto(mia.name) };
@@ línea 402
-        const cnt = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(rec.id)}&perPage=1`);
-        if ((cnt?.totalItems || 0) >= maxPlayers) throw new Error('La sala está llena');
+        const cnt = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(salaId)}&perPage=1`);
+        if (numero(fila(cnt).totalItems) >= maxPlayers) throw new Error('La sala está llena');
@@ línea 407
-            const row = await pbFetch(`/api/collections/${PLR}/records`, {
-              method: 'POST', body: JSON.stringify({ session: rec.id, name, user_id: userId }),
-            });
+            const row = fila(await pbFetch(`/api/collections/${PLR}/records`, {
+              method: 'POST', body: JSON.stringify({ session: salaId, name, user_id: userId }),
+            }));
@@ línea 412
-            await registerClaim(rec.id, row.id);
-            return { sessionId: rec.id, playerId: row.id, name: row.name };
+            await registerClaim(salaId, texto(row.id));
+            return { sessionId: salaId, playerId: texto(row.id), name: texto(row.name) };
@@ línea 416
-            if (e?.status === 400 && n <= 40) { name = `${f.value} ${n}`; continue; }
+            if (estadoPb(e) === 400 && n <= 40) { name = `${f.value} ${n}`; continue; }
@@ línea 423
-      const engine = createLiveRoom(rec.activity, { state: rec.state, code: rec.code });
+      const engine = /** @type {LiveEngine} */ (
+        createLiveRoom(/** @type {Activity} */ (actividadDe(rec.activity)), { state: paraHidratar(estadoSala), code: texto(rec.code) })
+      );
@@ línea 427
-      await saveState(rec.id, engine);
-      return { sessionId: rec.id, playerId: p.id, name: p.name };
+      await saveState(salaId, engine);
+      return { sessionId: salaId, playerId: p.id, name: p.name };
@@ línea 469
-      if (patch.status !== undefined) engine.state.status = patch.status;
-      if (patch.phase !== undefined) engine.state.phase = patch.phase;
-      if ('current_item' in patch) engine.state.currentItem = patch.current_item;
-      if ('deadline' in patch) engine.state.deadline = patch.deadline ?? null;
+      const s = blobDeSala(engine);
+      if (patch.status !== undefined) s.status = patch.status;
+      if (patch.phase !== undefined) s.phase = patch.phase;
+      if (patch.current_item !== undefined) s.currentItem = patch.current_item;
+      if ('deadline' in patch) s.deadline = patch.deadline ?? null;
@@ línea 478
-      if ('answers_open_at' in patch) engine.state.answersOpenAt = patch.answers_open_at ?? null;
-      if ('read_secs' in patch) engine.state.readSecs = patch.read_secs ?? null;
+      if ('answers_open_at' in patch) s.answersOpenAt = patch.answers_open_at ?? null;
+      if ('read_secs' in patch) s.readSecs = patch.read_secs ?? null;
@@ línea 487
-      if ('loop' in patch) engine.state.loop = patch.loop ?? null;
-      if ('end_policy' in patch) engine.state.endPolicy = patch.end_policy ?? null;
-      if ('end_n' in patch) engine.state.endN = patch.end_n ?? null;
-      if ('started_at' in patch) engine.state.startedAt = patch.started_at ?? null;
-      if ('ql_points' in patch) engine.state.qlPoints = patch.ql_points ?? {};
+      if ('loop' in patch) s.loop = patch.loop ?? null;
+      if ('end_policy' in patch) s.endPolicy = patch.end_policy ?? null;
+      if ('end_n' in patch) s.endN = patch.end_n ?? null;
+      if ('started_at' in patch) s.startedAt = patch.started_at ?? null;
+      if ('ql_points' in patch) s.qlPoints = patch.ql_points ?? {};
@@ línea 495
-      if ('ql_taken' in patch) engine.state.qlTaken = patch.ql_taken ?? {};
+      if ('ql_taken' in patch) s.qlTaken = patch.ql_taken ?? {};
@@ línea 498
-        const p = engine.state.players.find(pl => pl.id === playerId);
+        const p = (s.players || []).find(pl => pl.id === playerId);
```

### core/textCorrectionRound.js (+58 −37)

```diff
@@ línea 24
+const desde = (t) => {
+  const el = /** @type {HTMLElement|null} */ (t);
+  return { closest: (sel) => (typeof el?.closest === 'function'
+    ? /** @type {HTMLElement|null} */ (el.closest(sel))
+    : null) };
+};
+const frasesDe = (a) => {
+  const c = /** @type {TextCorrectionContent|undefined} */ (a?.content);
+  return Array.isArray(c?.passages) ? c.passages : [];
+};
@@ línea 72
-  const p = (activity.content?.passages || [])[itemIndex];
+  const p = frasesDe(activity)[itemIndex];
@@ línea 85
-  const passages = (act.content?.passages || []).filter(p => p && p.text);
+  const passages = frasesDe(act).filter(p => p && p.text);
@@ línea 95
-      <div class="tc-passage">${passageHtml(passages[0].text, kind)}</div>
+      <div class="tc-passage">${passageHtml(passages[0]?.text || '', kind)}</div>
@@ línea 119
-  const stateCls = (pos, isTargetMarkable) => {
+  const stateCls = (pos) => {
@@ línea 393
-      ${cabeceraHtml({ herramientas, pagina: chips.left || null, tiempo: reloj ? '' : null,
+      ${cabeceraHtml({ herramientas, pagina: chips.left || undefined, tiempo: reloj ? '' : undefined,
@@ línea 401
-  const areaEl = root.querySelector('.tc-passage-area');
-  const passageEl = root.querySelector('.tc-passage');
+  const areaEl = /** @type {HTMLElement} */ (root.querySelector('.tc-passage-area'));
+  const passageEl = /** @type {HTMLElement} */ (root.querySelector('.tc-passage'));
@@ línea 423
-  root.querySelector('.tc-done').addEventListener('click', submit);
+  root.querySelector('.tc-done')?.addEventListener('click', submit);
@@ línea 434
-  const sw = root.querySelector('.tc-switch');
-  sw.addEventListener('click', (e) => {
+  const sw = /** @type {HTMLElement|null} */ (root.querySelector('.tc-switch'));
+  sw?.addEventListener('click', (e) => {
@@ línea 437
-    const lado = e.target.closest('.tc-switch__side')?.dataset.side;
+    const lado = desde(e.target).closest('.tc-switch__side')?.dataset.side;
@@ línea 506
-  let esperando = null, ultimo = '';
+  let esperando = null;
+  let ultimo = '';
@@ línea 552
-export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = {}) {
-  const passages = (activity.content?.passages || []).filter(p => p.text);
+export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = { kind: 'tilde' }) {
+  const passages = frasesDe(activity).filter(p => p.text);
@@ línea 582
-  const saved = ctx.loadProgress();
-  if (saved && Number.isInteger(saved.idx) && saved.idx > 0 && saved.idx < passages.length
-      && Array.isArray(saved.results)) {
-    idx = saved.idx; score = saved.score || 0;
-    hits = saved.hits || 0; misses = saved.misses || 0; over = saved.over || 0;
-    for (const r of saved.results) {
-      const p = passages[r.i];
+  const guardado = /** @type {{idx?: unknown, score?: unknown, hits?: unknown,
+  const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
+  if (guardado && Number.isInteger(guardado.idx) && num(guardado.idx) > 0
+      && num(guardado.idx) < passages.length && Array.isArray(guardado.results)) {
+    idx = num(guardado.idx); score = num(guardado.score);
+    hits = num(guardado.hits); misses = num(guardado.misses); over = num(guardado.over);
+    for (const cruda of guardado.results) {
+      const r = /** @type {{i?: number, got?: number[], hits?: number, misses?: number,
+      const p = passages[num(r?.i)];
@@ línea 596
-      passageResults.push({ p, got: new Set(r.got), want: wantOf(p), hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points });
+      passageResults.push({ p, got: new Set(r.got || []), want: wantOf(p), hits: num(r.hits),
+        misses: num(r.misses), over: num(r.over), total: num(r.total),
+        correct: !!r.correct, points: num(r.points) });
@@ línea 634
-    const ronda = renderTextCorrectionRound(body, passages[idx], {
+    if (!body) return;
+    const ronda = renderTextCorrectionRound(body, passages[idx] || null, {
@@ línea 681
+    if (!prev) return null;
@@ línea 685
-    over += rr.over - prev.over;
+    over += (rr.over ?? 0) - prev.over;
@@ línea 702
+    if (!p) return;
@@ línea 709
-    score += r.points; hits += r.hits; misses += miss; over += r.over;
+    score += r.points; hits += r.hits; misses += miss; over += (r.over ?? 0);
@@ línea 712
-    passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: r.over, total: r.total, correct: r.perfect, points: r.points });
+    passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: (r.over ?? 0), total: r.total, correct: !!r.perfect, points: r.points });
@@ línea 716
-    reveal(value, { hits: r.hits, over: r.over, misses: miss, total: r.total, correct: r.perfect });
+    reveal(value, { hits: r.hits, over: (r.over ?? 0), misses: miss, total: r.total, correct: !!r.perfect });
@@ línea 726
+    if (!p) return;
@@ línea 761
-      const b = e.target.closest('[data-anular]');
+      const b = desde(e.target).closest('[data-anular]');
@@ línea 776
-    const areaEl = document.querySelector('.tc-passage-area');
-    const passageEl = areaEl.querySelector('.tc-passage');
+    const areaEl = /** @type {HTMLElement} */ (document.querySelector('.tc-passage-area'));
+    const passageEl = /** @type {HTMLElement} */ (areaEl.querySelector('.tc-passage'));
@@ línea 780
-    document.querySelector('.tc-next').addEventListener('click', () => {
+    document.querySelector('.tc-next')?.addEventListener('click', () => {
@@ línea 816
-                  ${panelRevisionHtml(filasRevision(r.p, kind, r.got), anuladosDe.get(i), { anulable })}
+                  ${panelRevisionHtml(filasRevision(r.p, kind, r.got), anuladosDe.get(i) || new Set(), { anulable })}
@@ línea 823
-        const b = e.target.closest('[data-anular]');
+        const b = desde(e.target).closest('[data-anular]');
@@ línea 825
-          const i = Number(b.closest('[data-hoja]').dataset.hoja);
+          const hoja = /** @type {HTMLElement|null} */ (b.closest('[data-hoja]'));
+          const i = Number(hoja?.dataset.hoja);
@@ línea 829
+          if (!set) return;
@@ línea 835
-        if (e.target.closest('.tc-fin')) finish();
+        if (desde(e.target).closest('.tc-fin')) finish();
@@ línea 886
-    const cls = heatClass(p.pctMarked);
-    const pct = Math.round(p.pctMarked * 100);
+    const cls = heatClass(p.pctMarked ?? 0);
+    const pct = Math.round((p.pctMarked ?? 0) * 100);
```

### adapters/local/realtime.js (+39 −22)

```diff
@@ línea 16
+import { blobDeSala, esFila, fila, mensajeDe, paraHidratar } from '../frontera.js';
@@ línea 86
+function salaLocal(x) {
+  return esFila(x) && esFila(x.state) ? /** @type {SalaLocal} */ (x) : null;
+}
+function tablaDe(x) {
+  return x === 'sessions' || x === 'players' || x === 'answers' ? x : null;
+}
@@ línea 109
-    if (kv) { try { return JSON.parse(kv.getItem(k) || 'null'); } catch { return null; } }
-    return mem.get(k) || null;
+    if (kv) { try { return salaLocal(JSON.parse(kv.getItem(k) || 'null')); } catch { return null; } }
+    return salaLocal(mem.get(k));
@@ línea 135
-    return { room, engine: createLiveRoom(room.activity, { state: room.state, code }) };
+    return { room, engine: /** @type {LiveEngine} */ (createLiveRoom(room.activity, { state: paraHidratar(room.state), code })) };
@@ línea 137
-  function save(code, room, engine) { room.state = engine.state; write(code, room); }
+  function save(code, room, engine) { room.state = blobDeSala(engine); write(code, room); }
@@ línea 152
-          for (let i = 0; i < kv.length; i++) {
-            const k = kv.key(i);
+          for (let i = 0; i < (kv.length ?? 0); i++) {
+            const k = kv.key?.(i);
@@ línea 157
-          usedCodes = new Set(mem.keys()).difference ? new Set([...mem.keys()].map(k => k.slice(PREFIX.length))) : usedCodes;
+          usedCodes = new Set([...mem.keys()].map(k => k.slice(PREFIX.length)));
@@ línea 161
-      const engine = createLiveRoom(activity, { code });
+      const engine = /** @type {LiveEngine} */ (createLiveRoom(activity, { code }));
@@ línea 164
-      write(code, { activity, state: engine.state, created: new Date(clock.now()).toISOString() });
+      write(code, { activity, state: blobDeSala(engine), created: new Date(clock.now()).toISOString() });
@@ línea 177
-      const s = engine.state;
+      const s = blobDeSala(engine);
@@ línea 189
-      if ('current_item' in patch) s.currentItem = patch.current_item;
+      if (patch.current_item !== undefined) s.currentItem = patch.current_item;
@@ línea 203
-      const MAP = { ql_open: 'open', ql_question: 'question', ql_image: 'image', ql_by: 'by', ql_by_name: 'byName' };
-      for (const [k, f] of Object.entries(MAP)) if (k in patch) (room.ql ||= {})[f] = patch[k] ?? null;
+      const ql = () => (room.ql ||= {});
+      if ('ql_open' in patch) ql().open = patch.ql_open ?? null;
+      if ('ql_question' in patch) ql().question = patch.ql_question ?? null;
+      if ('ql_image' in patch) ql().image = patch.ql_image ?? null;
+      if ('ql_by' in patch) ql().by = patch.ql_by ?? null;
+      if ('ql_by_name' in patch) ql().byName = patch.ql_by_name ?? null;
@@ línea 211
-        const p = s.players.find(pl => pl.id === playerId);
+        const p = (s.players || []).find(pl => pl.id === playerId);
@@ línea 307
-          ms: v.ms,   // paridad con el adaptador PB: reanudar recupera la hora de meta
+          ms: v.msTaken,
@@ línea 316
-      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
+      engine.state.players = engine.state.players.filter((p) => p.id !== playerId);
@@ línea 329
-        if (kv) { for (let i = 0; i < kv.length; i++) { const k = kv.key(i); if (k?.startsWith(PREFIX)) codes.push(k.slice(PREFIX.length)); } }
+        if (kv) { for (let i = 0; i < (kv.length ?? 0); i++) { const k = kv.key?.(i); if (k?.startsWith(PREFIX)) codes.push(k.slice(PREFIX.length)); } }
@@ línea 331
-      } catch (e) { out.errors.push(e.message); return out; }
+      } catch (e) { out.errors.push(mensajeDe(e)); return out; }
@@ línea 339
-        if (!dryRun) { try { kv ? kv.removeItem(PREFIX + code) : mem.delete(PREFIX + code); } catch (e) { out.errors.push(`${code}: ${e.message}`); } }
+        if (!dryRun) {
+          try {
+            if (!kv) mem.delete(PREFIX + code);
+            else if (kv.removeItem) kv.removeItem(PREFIX + code);
+            else throw new Error('el almacén no sabe borrar');   // R6: no en silencio
+          } catch (e) { out.errors.push(`${code}: ${mensajeDe(e)}`); }
+        }
@@ línea 398
-    async listSessions() {
+    async listSessions({ limit = 500 } = {}) {
@@ línea 407
-      return out;
+      return out.slice(0, Number(limit) || 500);
@@ línea 422
-      const h = (ev) => onChange({ table: ev?.data?.table, eventType: '*' });
+      const h = (ev) => { const t = tablaDe(fila(ev?.data).table); if (t) onChange({ table: t, eventType: '*' }); };
```

### adapters/pocketbase/remoteStore.js (+29 −24)

```diff
@@ línea 14
+import { esFila, fila, filas, estadoPb, numero, texto } from '../frontera.js';
@@ línea 16
+const comoResultado = (row) => /** @type {ResultRow} */ (row);
+const comoActividad = (x) => (esFila(x) ? /** @type {Activity} */ (x) : null);
@@ línea 40
-  if (originalId) return originalId;
+  if (typeof originalId === 'string' && originalId) return originalId;
@@ línea 111
-          if (e.status !== 404) throw e;
+          if (estadoPb(e) !== 404) throw e;
@@ línea 126
-          if (e.status !== 404) throw e;
+          if (estadoPb(e) !== 404) throw e;
@@ línea 140
-        if (e.status !== 404) throw e;
+        if (estadoPb(e) !== 404) throw e;
@@ línea 151
-        return rec.data ?? null;
+        return comoActividad(fila(rec).data);
@@ línea 153
-        if (e.status === 404) return null;
+        if (estadoPb(e) === 404) return null;
@@ línea 163
-      return (rec?.items || []).map(row => {
-        markSynced(row.id);
-        return { id: fromId(row.id, row.data?.id), data: row.data };
+      return filas(rec).map(row => {
+        const id = texto(row.id);
+        markSynced(id);
+        const data = comoActividad(row.data);
+        return { id: fromId(id, data?.id), data: data ?? /** @type {Activity} */ (fila(row.data)) };
@@ línea 191
-      const rows = (rec?.items || []).map(row => ({
-        id: row.data?.id || row.id,
-        data: row.data || {},
-        language: row.language || 'es',
-        tags: row.tags || [],
+      const rows = filas(rec).map(row => ({
+        id: texto(comoActividad(row.data)?.id) || texto(row.id),
+        data: comoActividad(row.data) ?? /** @type {Activity} */ (fila(row.data)),
+        language: texto(row.language) || 'es',
+        tags: Array.isArray(row.tags) ? row.tags.map(t => texto(t)) : [],
@@ línea 198
-        owner: row.owner || '',
-        updated_at: row.data?.updatedAt || row.updated || '',
+        owner: texto(row.owner),
+        updated_at: texto(comoActividad(row.data)?.updatedAt) || texto(row.updated),
@@ línea 211
-      for (const row of rec?.items || []) {
-        const o = row.owner || '';
+      for (const row of filas(rec)) {
+        const o = texto(row.owner);
@@ línea 228
-      try { items = JSON.parse(txt).items || []; } catch { items = []; }
+      try { items = filas(JSON.parse(txt)); } catch { items = []; }
@@ línea 240
-        if (e?.status === 400 && r._qid) {
+        if (estadoPb(e) === 400 && r._qid) {
@@ línea 242
-          if (dup?.items?.length) return;   // el primer envío SÍ llegó
+          if (filas(dup).length) return;   // el primer envío SÍ llegó
@@ línea 274
-        return rec?.items || [];
-      } catch (e) {
+        return filas(rec).map(comoResultado);
+      } catch {
@@ línea 277
-        return rec?.items || [];
+        return filas(rec).map(comoResultado);
```

### adapters/pocketbase/realtimeAnswers.js (+27 −21)

```diff
@@ línea 19
+import { blobDeSala, estadoPb, filas, numero, texto } from '../frontera.js';
+const filasRespuesta = (res) =>
+  filas(res)
+    .filter((f) => typeof f.id === 'string' && typeof f.player === 'string')
+    .map((f) => /** @type {FilaRespuesta} */ (f));
@@ línea 141
+    const s = blobDeSala(engine);
@@ línea 143
-      createdAt: r.created, updatedAt: r.updated,
-      openedAt: openedAtFor(engine.state.itemOpenedAt, itemIndex, engine.state.phase) || origenRespaldo,
-      claimedMs: r.ms, phase: engine.state.phase,
+      createdAt: texto(r.created), updatedAt: texto(r.updated),
+      openedAt: openedAtFor(s.itemOpenedAt, itemIndex, s.phase) || origenRespaldo,
+      claimedMs: numero(r.ms), phase: texto(s.phase),
@@ línea 151
-      correct: r.scored ? (r.unscorable ? null : r.correct) : null,
+      correct: r.scored ? (r.unscorable ? null : !!r.correct) : null,
@@ línea 165
-    return dedupeByPlayer(res?.items);
+    return dedupeByPlayer(filasRespuesta(res));
@@ línea 173
-    return res?.items?.[0] || null;
+    return filasRespuesta(res)[0] || null;
@@ línea 186
-    catch (e) { if (e?.status === 400) return { conflict: true }; throw e; }
+    catch (e) { if (estadoPb(e) === 400) return { conflict: true }; throw e; }
@@ línea 198
-    if (!probe?.items?.length) return 0;
-    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=500`);
+    if (!filas(probe)[0]) return 0;
+    const todas = filasRespuesta(await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=500`));
@@ línea 206
-    const origenSala = esCarrera ? origenServidor(res?.items || []) : null;
-    const byItem = new Map();
-    for (const r of res?.items || []) {
+    const origenSala = esCarrera ? origenServidor(todas) : null;
+    const byItem = /** @type {Map<number, FilaRespuesta[]>} */ (new Map());
+    for (const r of todas) {
@@ línea 210
-      if (!byItem.has(it)) byItem.set(it, []);
-      byItem.get(it).push(r);
+      const lista = byItem.get(it) ?? [];
+      byItem.set(it, lista); lista.push(r);
@@ línea 213
-    const toPatch = [];
+    const toPatch = /** @type {ParcheRespuesta[]} */ ([]);
@@ línea 388
-        const r = res?.items?.[0];
-        return r ? { playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? r.correct : null, points: r.points } : null;
+        const r = filasRespuesta(res)[0];
+        return r ? { playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? !!r.correct : null, points: r.points } : null;
@@ línea 406
-        return (res?.items || []).map(r => ({
-          itemIndex: r.item, value: r.value,
+        return filasRespuesta(res).map(r => ({
+          itemIndex: Number(r.item), value: r.value,
@@ línea 434
-        return rows.map(r => ({ playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? r.correct : null, points: r.points, v0: r.v0, c0: r.c0, created: r.created, updated: r.updated, 
+        return rows.map(r => ({ playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? !!r.correct : null, points: r.points, v0: r.v0, c0: r.c0, created: r.created, updated: r.updated
@@ línea 469
-          rows = res?.items || [];   // core/liveRank.js acepta la fila tal cual
+          rows = filas(res);   // core/liveRank.js acepta la fila tal cual
```

### adapters/pocketbase/assignments.js (+18 −12)

```diff
@@ línea 30
+import { esFila, fila, filas, estadoPb, numero, texto } from '../frontera.js';
@@ línea 52
+const comoTarea = (row) => /** @type {AssignmentRecord} */ (row);
+const comoIntento = (row) => /** @type {AssignmentAttempt} */ (row);
@@ línea 70
-  const val = (x, def) => (typeof x === 'function' ? x() : x) || def;
-  const uid = () => val(userId, 'local-anon');
-  const mios = () => val(identities, null) || [uid()];
+  const uid = () => (typeof userId === 'function' ? userId() : userId) || 'local-anon';
+  const mios = () => (typeof identities === 'function' ? identities() : identities) || [uid()];
@@ línea 91
-      return { id: rec.id, code: rec.code };
+      const row = esFila(rec) ? rec : {};
+      return { id: texto(row.id), code: texto(row.code, code) };
@@ línea 112
-      return (res?.items || []).filter(r => esMiTarea(r, mios()));
+      return filas(res).map(comoTarea).filter(r => esMiTarea(r, mios()));
@@ línea 120
-      return res?.items?.[0] || null;
+      const row = filas(res)[0];
+      return row ? comoTarea(row) : null;
@@ línea 144
-      return res?.items || [];
+      return filas(res).map(comoIntento);
@@ línea 152
-      return res?.totalItems ?? 0;
+      return numero(fila(res).totalItems, 0);
@@ línea 171
-      ).then(r => r?.items || []).catch(() => []);
+      ).then(filas).catch(() => []);
@@ línea 175
-          return await postAttempt(taken + 1);
+          await postAttempt(taken + 1);
+          return;
@@ línea 180
-          if (e?.status === 403) {
+          const estado = estadoPb(e);
+          if (estado === 403) {
@@ línea 184
-          if (e?.status !== 400 || tries === 3) throw e;
+          if (estado !== 400 || tries === 3) throw e;
```

### adapters/pocketbase/realtime.js (+16 −14)

```diff
@@ línea 42
+import { fila, numeroOnulo, texto } from '../frontera.js';
@@ línea 72
-    if (e?.name === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
+    if (texto(fila(e).name) === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
@@ línea 90
-      const transient = e?.timeout || e?.status === 0 || e?.status >= 500;
+      const estado = numeroOnulo(fila(e).status);
+      const transient = fila(e).timeout === true || estado === 0 || (estado ?? 0) >= 500;
@@ línea 112
-      if (body?.message?.includes('Missing collection')) return (cached = false);
+      if (texto(fila(body).message).includes('Missing collection')) return (cached = false);
@@ línea 139
-    postAnswer: (...args) => answersSection.postAnswer(...args),
-    getAnswerRow: (...args) => answersSection.getAnswerRow(...args),
-    settlePendingInto: (...args) => answersSection.settlePendingInto(...args),
+    postAnswer: (body) => answersSection.postAnswer(body),
+    getAnswerRow: (sessionId, itemIndex, playerId) => answersSection.getAnswerRow(sessionId, itemIndex, playerId),
+    settlePendingInto: (engine, sessionId) => answersSection.settlePendingInto(engine, sessionId),
@@ línea 305
-        self.addEventListener('PB_CONNECT', async (e) => {
+        self.addEventListener('PB_CONNECT', async (/** @type {MessageEvent} */ e) => {
@@ línea 311
-            const { clientId } = JSON.parse(e.data);
+            const clientId = texto(fila(JSON.parse(e.data)).clientId);
@@ línea 336
-        self.addEventListener(topic, (e) => {
+        self.addEventListener(topic, (/** @type {MessageEvent} */ e) => {
@@ línea 340
-            const { action } = JSON.parse(e.data);
+            const action = texto(fila(JSON.parse(e.data)).action);
@@ línea 346
-          } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, e?.data?.slice?.(0, 120)); }
+          } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, texto(e?.data).slice(0, 120)); }
@@ línea 353
-        self.addEventListener(PLR, (e) => {
+        self.addEventListener(PLR, (/** @type {MessageEvent} */ e) => {
@@ línea 356
-          try { onChange({ table: 'players', eventType: JSON.parse(e.data).action }); }
-          catch { onChange({ table: 'players' }); }
+          try { onChange({ table: 'players', eventType: texto(fila(JSON.parse(e.data)).action) }); }
+          catch { onChange({ table: 'players', eventType: '*' }); }
```

### kernel/session/vsMachine.js (+15 −14)

```diff
@@ línea 107
-  const declared = !!T.meta?.play?.vs && T.meta.play.vs !== 'none';
+  const politica = T.meta?.play?.vs;
+  const declared = !!politica && politica !== 'none';
@@ línea 114
-    console.warn(`[isVsCompatible] ${activity?.template}: declara play.vs="${T.meta.play.vs}" pero le falta scoreSubmission/renderRound (contrato roto)`);
+    console.warn(`[isVsCompatible] ${activity?.template}: declara play.vs="${politica}" pero le falta scoreSubmission/renderRound (contrato roto)`);
@@ línea 144
-  const state = opts.state ? { ...opts.state } : {
+  const state = /** @type {VsState} */ (opts.state ? { ...opts.state } : {
@@ línea 153
-  };
+  });
@@ línea 190
-    if (s.cursor >= total && !state.finishedBy) state.finishedBy = sideId;
+    if (s.cursor >= total && !state.finishedBy) state.finishedBy = sideId === 'right' ? 'right' : 'left';
@@ línea 211
-    const con = (s.answers || []).filter(a => a.detail);
+    const con = (s.answers || []).flatMap(a => (a.detail ? [a.detail] : []));
@@ línea 213
-    const out = con.reduce((acc, a) => ({
-      hits: acc.hits + (a.detail.hits || 0),
-      over: acc.over + (a.detail.over || 0),
-      total: acc.total + (a.detail.total || 0),
+    const suma = (acc, d) => ({
+      hits: acc.hits + (d.hits || 0),
+      over: acc.over + (d.over || 0),
+      total: acc.total + (d.total || 0),
@@ línea 219
-      marca: acc.marca || Number.isFinite(a.detail.over),
-    }), { hits: 0, over: 0, total: 0, marca: false });
-    return out;
+      marca: acc.marca || Number.isFinite(d.over),
+    });
+    return con.reduce(suma, { hits: 0, over: 0, total: 0, marca: false });
@@ línea 227
-    let leader = 'tie';
+    let leader = /** @type {VsSideId|'tie'} */ ('tie');
```

### adapters/pocketbase/realtimeMantenimiento.js (+14 −12)

```diff
@@ línea 5
+import { filas, mensajeDe, texto } from '../frontera.js';
@@ línea 32
-      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
+      engine.state.players = engine.state.players.filter((p) => p.id !== playerId);
@@ línea 54
-        sessions = res?.items || [];
-      } catch (e) { out.errors.push(`salas: ${e.message}`); return out; }
+        sessions = filas(res);
+      } catch (e) { out.errors.push(`salas: ${mensajeDe(e)}`); return out; }
@@ línea 61
-      const childCounts = { [ANS]: 'answers', [PLR]: 'players', [CLM]: 'claims' };
+      const childCounts = [[ANS, 'answers'], [PLR, 'players'], [CLM, 'claims']];
@@ línea 64
-        const f = pbFilterParam(`session='${pbEscape(s.id)}'`);
-        for (const [coll, key] of Object.entries(childCounts)) {
+        const salaId = texto(s.id);
+        const f = pbFilterParam(`session='${pbEscape(salaId)}'`);
+        for (const [coll, key] of childCounts) {
@@ línea 69
-            const rows = res?.items || [];
+            const rows = filas(res);
@@ línea 73
-                await pbFetch(`/api/collections/${coll}/records/${r.id}`, { method: 'DELETE' })
-                  .catch(e => out.errors.push(`${coll}/${r.id}: ${e.message}`));
+                await pbFetch(`/api/collections/${coll}/records/${texto(r.id)}`, { method: 'DELETE' })
+                  .catch(e => out.errors.push(`${coll}/${texto(r.id)}: ${mensajeDe(e)}`));
@@ línea 77
-          } catch (e) { out.errors.push(`${coll}: ${e.message}`); }
+          } catch (e) { out.errors.push(`${coll}: ${mensajeDe(e)}`); }
@@ línea 80
-          await pbFetch(`/api/collections/${COLL}/records/${s.id}`, { method: 'DELETE' })
-            .catch(e => out.errors.push(`sala ${s.id}: ${e.message}`));
+          await pbFetch(`/api/collections/${COLL}/records/${salaId}`, { method: 'DELETE' })
+            .catch(e => out.errors.push(`sala ${salaId}: ${mensajeDe(e)}`));
```

### adapters/local/remoteStore.js (+20 −5)

```diff
@@ línea 17
+import { esFila } from '../frontera.js';
@@ línea 38
+function actividadDe(r) {
+  if (r.activityId) return r.activityId;
+  const legado = /** @type {Record<string, unknown>} */ (r).activity_id;
+  return typeof legado === 'string' ? legado : undefined;
+}
@@ línea 65
-  const readMap = () => read(KEY) || {};
+  const readMap = () => {
+    const m = read(KEY);
+    return esFila(m) ? /** @type {Record<string, Activity>} */ (m) : {};
+  };
+  const readLog = () => {
+    const l = read(KEY_RESULTS);
+    return Array.isArray(l) ? /** @type {ResultRecord[]} */ (l) : [];
+  };
@@ línea 87
-    async listPublicActivities({ limit = 120 } = {}) {
+    async listPublicActivities({ language = '', owner = '', limit = 120 } = {}) {
@@ línea 92
+        .filter(([, data]) => !language || (data.language || 'es') === language)
+        .filter(([, data]) => !owner || (data.owner || '') === owner)
@@ línea 104
-      const log = read(KEY_RESULTS) || [];
+      const log = readLog();
@@ línea 114
-      const log = read(KEY_RESULTS) || [];
-      return activityId ? log.filter(r => (r.activityId || r.activity_id) === activityId) : log;
+      const log = readLog();
+      return activityId ? log.filter(r => actividadDe(r) === activityId) : log;
```

### adapters/local/assignments.js (+14 −8)

```diff
@@ línea 8
+import { esFila } from '../frontera.js';
@@ línea 34
-  const read = (key, fallback) => {
-    if (kv) { try { return JSON.parse(kv.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
-    return mem.has(key) ? mem.get(key) : fallback;
+  const read = (key) => {
+    if (kv) { try { return JSON.parse(kv.getItem(key) || 'null'); } catch { return null; } }
+    return mem.has(key) ? mem.get(key) : null;
@@ línea 45
-  const val = (x, def) => (typeof x === 'function' ? x() : x) || def;
-  const uid = () => val(userId, 'local-anon');
-  const mios = () => val(identities, null) || [uid()];
+  const uid = () => (typeof userId === 'function' ? userId() : userId) || 'local-anon';
+  const mios = () => (typeof identities === 'function' ? identities() : identities) || [uid()];
@@ línea 48
-  const assignments = () => read(K_ASSIGN, {});
-  const attempts = () => read(K_ATTEMPTS, []);
+  const assignments = () => {
+    const m = read(K_ASSIGN);
+    return esFila(m) ? /** @type {Record<string, AssignmentRecord>} */ (m) : {};
+  };
+  const attempts = () => {
+    const l = read(K_ATTEMPTS);
+    return Array.isArray(l) ? /** @type {AssignmentAttempt[]} */ (l) : [];
+  };
```

### kernel/session/teamsMachine.js (+10 −9)

```diff
@@ línea 97
-  const canAuto = canAutoScoreRound(T);
+  const canAuto = canAutoScoreRound(/** @type {import('../../core/templateCapability.js').Plantilla} */ (T));
@@ línea 107
-  const seedTeams = () => seedTeamsShared(opts, { withMembers: true });
+  const seedTeams = () => /** @type {RosterTeam[]} */ (seedTeamsShared(opts, { withMembers: true }));
@@ línea 109
-  const state = opts.state ? { answers: {}, _seq: 0, ...opts.state } : {
+  const state = /** @type {TeamsState} */ (opts.state ? { answers: {}, _seq: 0, ...opts.state } : {
@@ línea 120
-  };
+  });
@@ línea 143
-    const member = { id: 'p' + (++state._seq), userId, name: f.value };
+    const member = { id: 'p' + (++state._seq), userId, name: f.ok ? f.value : String(nickname ?? '').trim() };
@@ línea 162
-    const pa = plan.patch;
+    const pa = /** @type {RoomPatch} */ (plan.patch);
@@ línea 165
-    if ('current_item' in pa) state.currentItem = pa.current_item;
+    if (pa.current_item !== undefined) state.currentItem = pa.current_item;
@@ línea 195
-      const r = autoScore(T, { value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'teams' });
+      const scorer = /** @type {ScoringTemplate} */ (T);
+      const r = autoScore(scorer, { value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'teams' });
@@ línea 218
-    const pts = Number.isFinite(points) ? points : (correct ? basePoints(item, activity?.scoring) : 0);
+    const pts = Number.isFinite(points) ? Number(points) : (correct ? basePoints(item, activity?.scoring) : 0);
```

### adapters/frontera.js (+17 −0)

```diff
@@ línea 1
+export const esFila = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
+export const fila = (x) => (esFila(x) ? x : {});
+export function filas(res) {
+  const items = fila(res).items;
+  return Array.isArray(items) ? items.filter(esFila) : [];
+}
+export const texto = (x, def = '') => (typeof x === 'string' ? x : def);
+export const numero = (x, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def);
+export const textoOnulo = (x) => (typeof x === 'string' ? x : null);
+export const numeroOnulo = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
+export const mapaNumeros = (x) => (esFila(x) ? /** @type {Record<string, number>} */ (x) : {});
+export const mapaTextos = (x) => (esFila(x) ? /** @type {Record<string, string>} */ (x) : {});
+export const estadoPb = (e) => numero(fila(e).status, 0);
+export const mensajeDe = (e) => (e instanceof Error ? e.message : String(e));
+export const estadoDeSala = (x) => (esFila(x) ? /** @type {Partial<BlobSala>} */ (x) : {});
+export const paraHidratar = (s) =>
+export const blobDeSala = (engine) => /** @type {BlobSala} */ (engine.state);
```

### kernel/session/liveMachine.js (+6 −5)

```diff
@@ línea 76
-  const state = opts.state ? { players: [], answers: {}, _seq: 0, ...opts.state } : {
+  const state = /** @type {LiveState} */ (opts.state ? { players: [], answers: {}, _seq: 0, ...opts.state } : {
@@ línea 85
-  };
+  });
@@ línea 112
-    const p = { id: 'p' + (++state._seq), userId, name: uniqueNickname(f.value), score: 0 };
+    const limpio = f.ok ? f.value : String(nickname ?? '').trim();
+    const p = { id: 'p' + (++state._seq), userId, name: uniqueNickname(limpio), score: 0 };
@@ línea 138
-    const pa = plan.patch;
+    const pa = /** @type {RoomPatch} */ (plan.patch);
@@ línea 141
-    if ('current_item' in pa) state.currentItem = pa.current_item;
+    if (pa.current_item !== undefined) state.currentItem = pa.current_item;
```

### adapters/pocketbase/realtimeClaims.js (+6 −3)

```diff
@@ línea 13
+import { estadoPb } from '../frontera.js';
@@ línea 30
-    if (claims.has(sessionId)) return claims.get(sessionId);
+    const enMemoria = claims.get(sessionId);
+    if (enMemoria) return enMemoria;
@@ línea 55
-      if (e?.status !== 404 && e?.status !== 400) throw e;
-      if (e?.status === 400) return null;
+      const estado = estadoPb(e);
+      if (estado !== 404 && estado !== 400) throw e;
+      if (estado === 400) return null;
```

### core/scoring/award.js (+7 −2)

```diff
@@ línea 8
+function itemPoints(item) {
+  if (!item || typeof item !== 'object' || !('points' in item)) return 0;
+  const p = /** @type {{points?: unknown}} */ (item).points;
+  return typeof p === 'number' ? p : 0;
+}
@@ línea 32
-  return item?.points || scoring?.pointsPerCorrect || 1;
+  return itemPoints(item) || scoring?.pointsPerCorrect || 1;
@@ línea 92
-    const remain = Math.max(0, 1 - (msTaken || 0) / itemWindowMs(activity, item));
+    const remain = Math.max(0, 1 - (msTaken || 0) / itemWindowMs(activity ?? null, item));
```

### core/scoring/marks.js (+7 −2)

```diff
@@ línea 15
+function marksOf(item) {
+  if (!item || typeof item !== 'object' || !('marks' in item)) return [];
+  const m = /** @type {{marks?: unknown}} */ (item).marks;
+  return Array.isArray(m) ? /** @type {TextMark[]} */ (m) : [];
+}
@@ línea 33
-  const want = new Set((item?.marks || []).filter(m => kinds.includes(m.kind)).map(m => m.pos));
+  const want = new Set(marksOf(item).filter(m => kinds.includes(m.kind)).map(m => m.pos));
@@ línea 56
-  const want = new Set((item?.marks || []).filter(m => kinds.includes(m.kind)).map(m => m.pos));
+  const want = new Set(marksOf(item).filter(m => kinds.includes(m.kind)).map(m => m.pos));
```

### core/liveLoops.js (+6 −2)

```diff
@@ línea 50
+const esBucle = (x) => typeof x === 'string'
+  && /** @type {string[]} */ (LIVE_LOOPS).includes(x);
@@ línea 98
-  return raw.filter(x => LIVE_LOOPS.includes(x));
+  return raw.filter(esBucle);
@@ línea 192
+  const puntuar = tpl?.scoreSubmission;
+  if (typeof puntuar !== 'function') return row.correct === true;
@@ línea 195
-    return racePassed(tpl.scoreSubmission({
+    return racePassed(puntuar({
```

### adapters/index.js (+4 −3)

```diff
@@ línea 125
-      identities: () => [cuenta(), anonId].filter(Boolean),
+      identities: () => /** @type {string[]} */ ([cuenta(), anonId].filter(Boolean)),
@@ línea 145
-  globalThis.ww = globalThis.ww || {};
-  globalThis.ww.setBackend = (name) => {
+  const g = /** @type {{ ww?: Record<string, unknown> }} */ (globalThis);
+  g.ww = g.ww || {};
+  g.ww.setBackend = (/** @type {string} */ name) => {
```

### core/liveSnapshot.js (+4 −3)

```diff
@@ línea 54
-  for (const k of KEEP) if (activity[k] !== undefined) out[k] = activity[k];
+  const origen = /** @type {Record<string, unknown>} */ (activity);
+  for (const k of KEEP) if (origen[k] !== undefined) out[k] = origen[k];
@@ línea 86
-  return out;
+  return /** @type {SnapshotActivity} */ (out);
@@ línea 94
-  return !!activity && !activity.sanitized;
+  return !!activity && !(/** @type {{sanitized?: boolean}} */ (activity).sanitized);
```

### kernel/session/score.js (+4 −3)

```diff
@@ línea 98
+  const respaldo = /** @type {RoundPayload|null} */ (fallback);
@@ línea 103
-  if (Array.isArray(pre)) return pre[itemIndex] ?? fallback;
-  try { return T?.getRoundPayload ? T.getRoundPayload(activity, { itemIndex, ...ctx }) : fallback; }
-  catch { return fallback; }
+  if (Array.isArray(pre)) return pre[itemIndex] ?? respaldo;
+  try { return (T?.getRoundPayload && activity) ? T.getRoundPayload(activity, { itemIndex, ...ctx }) : respaldo; }
+  catch { return respaldo; }
```

### kernel/session/memory.js (+3 −3)

```diff
@@ línea 73
-  const state = opts.state ? { ...opts.state } : {
+  const state = /** @type {MemoryState} */ (opts.state ? { ...opts.state } : {
@@ línea 81
-  };
+  });
@@ línea 103
-    if (a.pairId === b.pairId) {
+    if (a && b && a.pairId === b.pairId) {
```

### core/liveEnd.js (+3 −2)

```diff
@@ línea 34
-  const policy = END_POLICIES.includes(session?.end_policy) ? session.end_policy : DEFAULT_POLICY;
+  const pedida = String(session?.end_policy ?? '');
+  const policy = END_POLICIES.includes(pedida) ? /** @type {'all'|'firstN'|'time'} */ (pedida) : DEFAULT_POLICY;
@@ línea 79
-    const left = Math.max(0, Math.min(n, players) - finished);
+    const left = Math.max(0, Math.min(n ?? DEFAULT_FIRST_N, players) - finished);
```

### kernel/session/engine.js (+3 −2)

```diff
@@ línea 64
+  const conScorer = () => /** @type {import('./score.js').ScoringTemplate} */ (T);
@@ línea 70
-    case FORMATS.LIVE:  return createLiveSession(activity, T, opts);
+    case FORMATS.LIVE:  return createLiveSession(activity, conScorer(), opts);
@@ línea 72
-    case FORMATS.VS:    return createVsSession(activity, T, opts);
+    case FORMATS.VS:    return createVsSession(activity, conScorer(), opts);
```

### core/sessionModel.js (+3 −1)

```diff
@@ línea 39
-    const r = template?.scoreSubmission?.({ value: row.value, item, activity, mode: 'report' });
+    const r = template?.scoreSubmission?.(
+      { value: row.value, item, activity: /** @type {Activity} */ (activity), mode: 'report' });
@@ línea 79
+    if (!p) continue;
```

### core/raceResume.js (+2 −1)

```diff
@@ línea 32
-      if (Number.isFinite(r.ms) && (finishMs == null || r.ms > finishMs)) finishMs = r.ms;
+      const ms = Number(r.ms);
+      if (Number.isFinite(ms) && (finishMs == null || ms > finishMs)) finishMs = ms;
```

### core/liveRank.js (+1 −1)

```diff
@@ línea 96
-    .map(p => ({ id: p.id, name: p.name, ...(tally.get(p.id) || { score: 0, finishMs: -1 }) }))
+    .map(p => ({ id: p.id, name: p.name || p.id, ...(tally.get(p.id) || { score: 0, finishMs: -1 }) }))
```

### core/textMarks.js (+1 −1)

```diff
@@ línea 160
-    .map(m => ({ key: m.pos, label: wordAtPos(item.text, m.pos), ok: true }));
+    .map(m => ({ key: m.pos, label: wordAtPos(item?.text, m.pos), ok: true }));
```

## B · el juego y el alumno

### core/editorShell.js (+51 −44)

```diff
@@ línea 130
-  if (!iaSabeEscribir(modelo)) return '';
+  if (!iaSabeEscribir(modelo ?? '')) return '';
+  const ficha = MODELOS_IA[/** @type {keyof typeof MODELOS_IA} */ (modelo)];
@@ línea 135
-            title="La IA propone ${escapeHtml(MODELOS_IA[modelo].etiqueta)}; tú decides si entran">
+            title="La IA propone ${escapeHtml(ficha.etiqueta)}; tú decides si entran">
@@ línea 138
-    <span class="text-muted small">Escribe ${escapeHtml(MODELOS_IA[modelo].etiqueta)} sobre el tema que le digas.
+    <span class="text-muted small">Escribe ${escapeHtml(ficha.etiqueta)} sobre el tema que le digas.
@@ línea 154
-  if (!T.meta.editor.generado && !sinEscribirNada(a)) return '';
+  if (!T?.meta?.editor?.generado && !sinEscribirNada(a)) return '';
@@ línea 184
-  const caja = root.querySelector('#ww-falta');
+  const caja = /** @type {HTMLElement|null} */ (root.querySelector('#ww-falta'));
@@ línea 215
-  spec = paneles;
-  const liveOn = !!T?.meta?.modes?.live && !!spec.live;
+  const liveOn = !!T?.meta?.modes?.live && !!paneles.live;
@@ línea 220
-  const showModes = hasModes || !!spec.rules;
-  const presOn = spec.presentation !== false;
+  const showModes = hasModes || !!paneles.rules;
+  const presOn = paneles.presentation !== false;
@@ línea 225
-  const tabs = [
-    { id: 'tab-content', label: spec.content.label || 'Contenido',
+  const tabs = /** @type {EditorTab[]} */ ([
+    { id: 'tab-content', label: paneles.content.label || 'Contenido',
@@ línea 233
-      body: () => primerPasoHtml(T, a) + iaBotonHtml(T) + '<div id="ww-falta">' + faltaHtml(a) + '</div>' + spec.content.html(a) },
-    spec.scoring && { id: 'tab-scoring', label: 'Puntuación', body: () => spec.scoring.html(a) },
+      body: () => primerPasoHtml(T, a) + iaBotonHtml(T) + '<div id="ww-falta">' + faltaHtml(a) + '</div>' + paneles.content.html(a) },
+    paneles.scoring && { id: 'tab-scoring', label: 'Puntuación', body: () => paneles.scoring.html(a) },
@@ línea 246
-      const indiv = spec.rules ? `
+      const indiv = paneles.rules ? `
@@ línea 248
-          <h6 class="mb-1"><i class="bi bi-person-fill text-success"></i> ${escapeHtml(spec.rules.label || 'Individual')}</h6>
-          ${spec.rules.html(a)}
+          <h6 class="mb-1"><i class="bi bi-person-fill text-success"></i> ${escapeHtml(paneles.rules.label || 'Individual')}</h6>
+          ${paneles.rules.html(a)}
@@ línea 251
-      const resto = hasModes ? renderModesTab(a, { yaHayTituloIndividual: !!spec.rules }) : '';
+      const resto = hasModes ? renderModesTab(a, { yaHayTituloIndividual: !!paneles.rules }) : '';
@@ línea 254
-    liveOn && { id: 'tab-live', label: 'En vivo', icon: 'bi-broadcast', body: () => spec.live.html(a) },
+    liveOn && { id: 'tab-live', label: 'En vivo', icon: 'bi-broadcast', body: () => paneles.live.html(a) },
@@ línea 256
-  ].filter(Boolean);
+  ].filter(Boolean));
@@ línea 287
-    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
-    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
+    on(root, 'input', '#f-title', (_, el) => { a.title = /** @type {HTMLInputElement} */ (el).value; onChange(a); });
+    on(root, 'input', '#f-subtitle', (_, el) => { a.subtitle = /** @type {HTMLInputElement} */ (el).value; onChange(a); });
@@ línea 292
-      const prev = root.querySelector('#pres-preview');
+      const prev = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
@@ línea 294
-        const p = root.querySelector('#pres-preview');
+        const p = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
@@ línea 302
-        (a.presentation = a.presentation || {}).skin = b.dataset.name; onChange(a);
+        a.presentation = a.presentation || {};
+        a.presentation.skin = b.dataset.name; onChange(a);
@@ línea 305
-        const p = root.querySelector('#pres-preview');
+        const p = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
@@ línea 312
-        (a.presentation = a.presentation || {}).background = b.dataset.name; onChange(a);
+        a.presentation = a.presentation || {};
+        a.presentation.background = b.dataset.name; onChange(a);
@@ línea 334
-        const pv = tile?.querySelector('.ww-bg-preview');
+        const pv = /** @type {HTMLElement|null} */ (tile?.querySelector('.ww-bg-preview') ?? null);
@@ línea 338
-        const errEl = root.querySelector('#bg-custom-err');
+        const errEl = /** @type {HTMLElement|null} */ (root.querySelector('#bg-custom-err'));
@@ línea 345
-      const bgFile = root.querySelector('#bg-custom-file');
-      if (bgFile) bgFile.addEventListener('change', async (e) => {
-        const errEl = root.querySelector('#bg-custom-err');
+      const bgFile = /** @type {HTMLInputElement|null} */ (root.querySelector('#bg-custom-file'));
+      if (bgFile) bgFile.addEventListener('change', async () => {
+        const errEl = /** @type {HTMLElement|null} */ (root.querySelector('#bg-custom-err'));
@@ línea 349
-          ponerFondo(await readBackgroundImage(e.target.files[0]));
+          ponerFondo(await readBackgroundImage(bgFile.files?.[0]));
@@ línea 351
-          if (errEl) { errEl.className = 'text-danger small mt-2'; errEl.textContent = err.message; errEl.hidden = false; }
-          e.target.value = '';
+          const msg = err instanceof Error ? err.message : String(err);
+          if (errEl) { errEl.className = 'text-danger small mt-2'; errEl.textContent = msg; errEl.hidden = false; }
+          bgFile.value = '';
@@ línea 361
-        if (elegido) ponerFondo(elegido.url, elegido.atribucion);
+        if (elegido) ponerFondo(elegido.url, /** @type {ImageCredit} */ (elegido.atribucion));
@@ línea 369
-    on(root, 'click', '#ww-ia-go', async (_, b) => {
+    on(root, 'click', '#ww-ia-go', async (_, el) => {
+      const b = /** @type {HTMLButtonElement} */ (el);
@@ línea 373
+        const modelo = T?.meta?.contentModel;
+        if (!modelo) return;
@@ línea 379
-          modelo: T?.meta?.contentModel,
+          modelo,
@@ línea 393
-        const fusionado = fusionarContenido(a.content, nuevo);
-        a.content = T?.adoptContent ? T.adoptContent(fusionado, T?.meta?.contentModel) : fusionado;
+        const fusionado = /** @type {import('../kernel/contracts/activity.js').ActivityContent} */ (
+          fusionarContenido(a.content, nuevo) ?? a.content);
+        a.content = (T?.adoptContent ? T.adoptContent(fusionado, modelo) : null) ?? fusionado;
@@ línea 403
-        toast('No se pudo abrir el asistente: ' + e.message, 'danger', TOAST_LARGO);
+        toast('No se pudo abrir el asistente: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_LARGO);
@@ línea 416
-    spec.content.wire?.(root, a, ctx);
+    paneles.content.wire?.(root, a, ctx);
@@ línea 429
-    spec.rules?.wire?.(root, a, ctx);
-    spec.scoring?.wire?.(root, a, ctx);
-    if (liveOn) spec.live.wire?.(root, a, ctx);
+    paneles.rules?.wire?.(root, a, ctx);
+    paneles.scoring?.wire?.(root, a, ctx);
+    if (liveOn) paneles.live.wire?.(root, a, ctx);
```

### templates/quiz/template.js (+46 −31)

```diff
@@ línea 71
-    const item = activity.content.items[ctx.itemIndex];
+    const item = (/** @type {QaContent} */ (activity.content)).items[ctx.itemIndex];
@@ línea 86
-    return (item?.options || []).map(o => ({ key: String(o), label: String(o), ok: String(o) === String(item?.answer) }));
+    const it = comoQaItem(item);
+    return (it?.options || []).map(o => ({ key: String(o), label: String(o), ok: String(o) === String(it?.answer) }));
@@ línea 94
-  static itemLabel(item) { return item?.question || ''; }
+  static itemLabel(item) { return comoQaItem(item)?.question || ''; }
@@ línea 115
-    const opts = item?.options || [];
+    const it = comoQaItem(item);
+    const opts = it?.options || [];
@@ línea 118
-      const counts = opts.map(o => answers.filter(a => String(a.value) === String(o)).length);
+      const counts = opts.map(o => answers.filter(a => String(valorRespondido(a)) === String(o)).length);
@@ línea 121
-        <h3 class="text-center mb-3">${escapeHtml(item?.question || '')}</h3>
-        <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(item?.answer ?? ''))}</p>
+        <h3 class="text-center mb-3">${escapeHtml(it?.question || '')}</h3>
+        <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(it?.answer ?? ''))}</p>
@@ línea 125
-            const isOk = String(o) === String(item?.answer);
+            const isOk = String(o) === String(it?.answer);
@@ línea 138
-      <h2 class="text-center my-4">${escapeHtml(item?.question || '')}</h2>
-      ${item?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(item.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
+      <h2 class="text-center my-4">${escapeHtml(it?.question || '')}</h2>
+      ${it?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(it.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
@@ línea 154
+    if (!content || typeof content !== 'object' || !('items' in content)) return content;
@@ línea 162
-    if (content && Array.isArray(content.items)) {
-      for (const it of content.items) {
-        if (it && Array.isArray(it.answerIdx) && it.answerIdx.length) {
-          const texts = it.answerIdx
-            .filter(k => k >= 0 && k < (it.options || []).length)
-            .map(k => String(it.options[k] ?? ''))
-            .filter(t => t.trim() !== '');
-          const lost = Array.isArray(it.answer)
-            ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
-            : String(it.answer ?? '').trim() === '';
-          if (lost && texts.length) it.answer = texts.length === 1 ? texts[0] : texts;
-        }
-        if (it && !Array.isArray(it.answerIdx)) {
-          const ans = it.answer;
-          it.answerIdx = (it.options || []).reduce((acc, o, k) => {
-            const hit = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
-            if (hit) acc.push(k);
-            return acc;
-          }, []);
-        }
-      }
+    if (Array.isArray(content.items)) {
+      rellenarAnswerIdx(content.items);
@@ línea 168
+function comoQaItem(item) {
+  if (!item || typeof item !== 'object') return null;
+  return /** @type {QaItem} */ (item);
+}
+function rellenarAnswerIdx(items) {
+  for (const it of items) {
+    if (!it) continue;
+    const opciones = it.options || [];
+    if (Array.isArray(it.answerIdx) && it.answerIdx.length) {
+      const texts = it.answerIdx
+        .filter(k => k >= 0 && k < opciones.length)
+        .map(k => String(opciones[k] ?? ''))
+        .filter(t => t.trim() !== '');
+      const lost = Array.isArray(it.answer)
+        ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
+        : String(it.answer ?? '').trim() === '';
+      if (lost && texts.length) it.answer = texts.length === 1 ? texts[0] : texts;
+    }
+    if (!Array.isArray(it.answerIdx)) {
+      const ans = it.answer;
+      it.answerIdx = opciones.reduce((acc, o, k) => {
+        const hit = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
+        if (hit) acc.push(k);
+        return acc;
+      }, /** @type {number[]} */ ([]));
+    }
+  }
+}
+function valorRespondido(a) {
+  return (a && typeof a === 'object' && 'value' in a) ? a.value : undefined;
+}
```

### templates/diagram/player.js (+37 −30)

```diff
@@ línea 10
-import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt } from '../../core/connectRope.js';
+import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt, puntuarEnlaces } from '../../core/connectRope.js';
@@ línea 16
+const idDe = (el) => /** @type {HTMLElement} */ (el).dataset.id ?? '';
@@ línea 35
-  const pins = (activity.content?.pins || []).filter(pinUsable);
-  const image = activity.content?.image || null;
+  const contenido = /** @type {DiagramContent} */ (activity.content);
+  const pins = (contenido?.pins || []).filter(pinUsable);
+  const image = contenido?.image || null;
@@ línea 64
-  const root       = document.querySelector(rootSel);
-  const arena      = root.querySelector('.ww-field');
-  const svg        = root.querySelector('.ww-lines-svg');
+  const raiz = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
+  const campo = raiz?.querySelector('.ww-field');
+  const lienzo = raiz?.querySelector('.ww-lines-svg');
+  if (!raiz || !campo || !lienzo) return;
+  const root  = /** @type {HTMLElement} */ (raiz);
+  const arena = /** @type {HTMLElement} */ (campo);
+  const svg   = /** @type {SVGSVGElement} */ (lienzo);
@@ línea 74
-  const submitBtn  = root.querySelector('.dg-submit');
-  const { layer } = mountRopeLayer(svg);
+  const submitBtn  = /** @type {HTMLButtonElement|null} */ (root.querySelector('.dg-submit'));
+  const cuerdas = mountRopeLayer(svg);
+  if (!cuerdas.layer) return;
+  const layer = /** @type {Element} */ (cuerdas.layer);
@@ línea 111
-    root.querySelectorAll('.dg-label').forEach(c => c.classList.toggle('dg-linked', linkedLabels.has(c.dataset.id)));
-    root.querySelectorAll('.dg-pin').forEach(c => c.classList.toggle('dg-linked', linkedPins.has(c.dataset.id)));
+    root.querySelectorAll('.dg-label').forEach(c => c.classList.toggle('dg-linked', linkedLabels.has(idDe(c))));
+    root.querySelectorAll('.dg-pin').forEach(c => c.classList.toggle('dg-linked', linkedPins.has(idDe(c))));
@@ línea 126
-    let best = null, bestD = Infinity;
+    let best = null;
+    let bestD = Infinity;
@@ línea 140
-    const label = e.target.closest('.dg-label');
-    const pin   = e.target.closest('.dg-pin');
+    const destino = /** @type {HTMLElement|null} */ (e.target);
+    const label = destino?.closest?.('.dg-label') ?? null;
+    const pin   = destino?.closest?.('.dg-pin') ?? null;
@@ línea 147
+    if (!dotEl) return;
@@ línea 149
-    state.dragging = { pointerId: e.pointerId, kind: label ? 'label' : 'pin', fromId: from.dataset.id, x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
+    state.dragging = { pointerId: e.pointerId, kind: label ? 'label' : 'pin', fromId: idDe(from), x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
@@ línea 169
-      if (hit) setLink(drag.fromId, hit.dataset.id); else removeByLabel(drag.fromId);
+      if (hit) setLink(drag.fromId, idDe(hit)); else removeByLabel(drag.fromId);
@@ línea 172
-      if (hit) setLink(hit.dataset.id, drag.fromId); else removeByPin(drag.fromId);
+      if (hit) setLink(idDe(hit), drag.fromId); else removeByPin(drag.fromId);
@@ línea 187
-    let correct = 0, score = 0;
-    for (const [l, p] of state.links) {
-      const res = scoreDiagramSubmission({ value: p, item: pinById.get(l), activity });
-      score += res.points;
-      if (res.correct) correct++;
-    }
-    score = Math.max(0, score);
-    const wrong = state.links.size - correct;
+    const { correct, score, wrong } = puntuarEnlaces(state.links,
+      (l, p) => scoreDiagramSubmission({ value: p, item: pinById.get(l), activity }));
@@ línea 190
+      const id = idDe(c);
@@ línea 192
-        ? state.links.get(c.dataset.id) === c.dataset.id
-        : [...state.links].some(([l, p]) => p === c.dataset.id && l === c.dataset.id);
+        ? state.links.get(id) === id
+        : [...state.links].some(([l, p]) => p === id && l === id);
@@ línea 198
-    submitBtn.disabled = true;
+    if (submitBtn) submitBtn.disabled = true;
@@ línea 226
-  const imgEl = root.querySelector('.dg-img');
+  const imgEl = /** @type {HTMLImageElement|null} */ (root.querySelector('.dg-img'));
@@ línea 235
-  const boxEl = root.querySelector('.dg-img-box');
+  const boxEl = /** @type {HTMLElement|null} */ (root.querySelector('.dg-img-box'));
@@ línea 283
-  const w = Number(activity.content?.imageW) || 0, h = Number(activity.content?.imageH) || 0;
+  const c = /** @type {DiagramContent} */ (activity.content);
+  const w = Number(c?.imageW) || 0, h = Number(c?.imageH) || 0;
```

### templates/match/player.js (+36 −29)

```diff
@@ línea 10
-import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt } from '../../core/connectRope.js';
+import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt, puntuarEnlaces } from '../../core/connectRope.js';
@@ línea 16
+function bajoElDedo(e, sel) {
+  const t = /** @type {{closest?: (s: string) => Element|null}|null} */ (e.target);
+  return t && typeof t.closest === 'function' ? /** @type {HTMLElement|null} */ (t.closest(sel)) : null;
+}
@@ línea 55
-  const raw = (activity.content?.pairs || []).filter(pairComplete);
+  const raw = (/** @type {PairsContent} */ (activity.content)?.pairs || []).filter(pairComplete);
@@ línea 67
+  const quizaBarajar = (a) => (doShuffle ? shuffle(a) : a);
@@ línea 70
-  const lefts  = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
-  const rights = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));
+  const lefts  = quizaBarajar(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
+  const rights = quizaBarajar(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));
@@ línea 87
-  const root       = document.querySelector(rootSel);
-  const arena      = root.querySelector('.ww-field');
-  const svg        = root.querySelector('.ww-lines-svg');
-  const submitBtn  = root.querySelector('.ww-match-submit');
+  const raiz = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
+  const campo = /** @type {HTMLElement|null} */ (raiz?.querySelector('.ww-field'));
+  const lienzo = /** @type {SVGElement|null} */ (raiz?.querySelector('.ww-lines-svg'));
+  const submitBtn = /** @type {HTMLButtonElement|null} */ (raiz?.querySelector('.ww-match-submit'));
@@ línea 94
+  if (!raiz || !campo || !lienzo) return;
@@ línea 98
-  const { layer } = mountRopeLayer(svg);
+  const capa = mountRopeLayer(lienzo).layer;
+  if (!capa) return;
+  const root = raiz, arena = campo, svg = lienzo, layer = capa;
+  const todas = (sel) => /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel));
@@ línea 151
-    root.querySelectorAll('.ww-card').forEach(c => {
-      const on = c.dataset.side === 'L' ? linkedL.has(c.dataset.id) : linkedR.has(c.dataset.id);
+    todas('.ww-card').forEach(c => {
+      const id = c.dataset.id ?? '';
+      const on = c.dataset.side === 'L' ? linkedL.has(id) : linkedR.has(id);
@@ línea 173
-    const cards = [...root.querySelectorAll(`.ww-card[data-side="${side}"]`)];
+    const cards = [...todas(`.ww-card[data-side="${side}"]`)];
@@ línea 189
-    let best = null, bestD = Infinity;
+    let best = null;
+    let bestD = Infinity;
@@ línea 202
-    if (e.target.closest('.ww-match-submit')) return;
-    const card = e.target.closest('.ww-card');
+    if (bajoElDedo(e, '.ww-match-submit')) return;
+    const card = bajoElDedo(e, '.ww-card');
@@ línea 207
+    const fromSide = card.dataset.side, fromId = card.dataset.id;
+    if (!dot || !fromSide || !fromId) return;
@@ línea 210
-    state.dragging = { pointerId: e.pointerId, fromSide: card.dataset.side, fromId: card.dataset.id,
+    state.dragging = { pointerId: e.pointerId, fromSide, fromId,
@@ línea 232
-    if (hit) {
+    if (hit?.dataset.id) {
@@ línea 251
-    let correct = 0, score = 0;
-    for (const [l, r] of state.links) {
-      const res = scoreMatchSubmission({ value: byId.get(r)?.right ?? '', item: byId.get(l), activity });
-      score += res.points;
-      if (res.correct) correct++;
-    }
-    score = Math.max(0, score);
-    const wrong = state.links.size - correct;
+    const { correct, score, wrong } = puntuarEnlaces(state.links,
+      (l, r) => scoreMatchSubmission({ value: byId.get(r)?.right ?? '', item: byId.get(l), activity }));
@@ línea 254
-    root.querySelectorAll('.ww-card').forEach(c => {
-      const id = c.dataset.id, side = c.dataset.side;
+    todas('.ww-card').forEach(c => {
+      const id = c.dataset.id ?? '', side = c.dataset.side;
@@ línea 263
-    submitBtn.disabled = true;
+    if (submitBtn) submitBtn.disabled = true;
@@ línea 305
-    root.querySelectorAll('.ww-card').forEach(c => {
+    todas('.ww-card').forEach(c => {
```

### views/playerView.js (+33 −28)

```diff
@@ línea 6
-import { html, escapeHtml, mount } from '../core/html.js';
+import { html, escapeHtml, mount, $$ } from '../core/html.js';
@@ línea 46
-  const a = await getAnywhere(id);
-  if (!a) {
+  const cargada = await getAnywhere(id);
+  if (!cargada) {
@@ línea 51
+  const a = cargada;
@@ línea 182
-        return ok
-          ? `<a href="${m.href(a)}" class="btn btn-outline-${m.color}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</a>`
+        const enlace = m.href?.(a);
+        return ok && enlace
+          ? `<a href="${enlace}" class="btn btn-outline-${m.color}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</a>`
@@ línea 205
+    const modeId = m.id;
@@ línea 218
-    currentMode = id;
-    document.querySelectorAll('.ww-mode').forEach(btn => {
-      const on = btn.dataset.mode === id;
+    currentMode = modeId;
+    $$('.ww-mode').forEach(btn => {
+      const on = btn.dataset.mode === modeId;
@@ línea 226
-    document.getElementById('ww-frame')?.classList.toggle('is-expanded', id !== 'solo');
+    document.getElementById('ww-frame')?.classList.toggle('is-expanded', modeId !== 'solo');
@@ línea 230
-    if (id === 'solo') {
+    if (modeId === 'solo') {
@@ línea 233
-      const disposer = await runMode(id, '#ww-player-widget', playActivity(), ctx);
+      const disposer = await runMode(modeId, '#ww-player-widget', playActivity(), ctx);
@@ línea 248
+    if (!widget) return null;
@@ línea 249
-      frame: document.getElementById('ww-frame'),
@@ línea 251
-      onOption: (id, value) => { playChoices = { ...playChoices, [id]: value }; },
+      onOption: (id, value) => { if (id) playChoices = { ...playChoices, [id]: value }; },
@@ línea 254
-        const anim = mountSoloAnimator(document.getElementById('ww-solo-anim'), playActivity());
+        const lane = document.getElementById('ww-solo-anim');
+        const anim = lane ? mountSoloAnimator(lane, playActivity()) : null;
@@ línea 259
-        if (myToken !== modeToken) { try { anim.dispose(); } catch {} try { disposer.dispose(); } catch {} return; }
+        if (myToken !== modeToken) { try { anim?.dispose(); } catch {} try { disposer.dispose(); } catch {} return; }
@@ línea 431
-      document.querySelectorAll('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentSkin));
+      $$('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentSkin));
@@ línea 444
-      document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentBg));
+      $$('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentBg));
@@ línea 447
+      const input = /** @type {HTMLInputElement|null} */ (e.target);
@@ línea 449
-        currentBgImage = await readBackgroundImage(e.target.files[0]);
+        currentBgImage = await readBackgroundImage(input?.files?.[0]);
@@ línea 457
-        document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === 'custom'));
+        $$('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === 'custom'));
@@ línea 459
-        toast(err.message, 'warning', TOAST_NORMAL);
-        e.target.value = '';
+        toast(err instanceof Error ? err.message : String(err), 'warning', TOAST_NORMAL);
+        if (input) input.value = '';
@@ línea 491
-      const name = b.dataset.name;
-      const label = b.textContent.trim();
+      const name = b.dataset.name || '';
+      const label = (b.textContent || '').trim();
@@ línea 509
-      if (error) { toast(error, 'danger', TOAST_ERROR); return; }
+      if (!copia) { toast(error ?? '', 'danger', TOAST_ERROR); return; }
@@ línea 528
-    on(rootSel, 'click', '.ww-mode-locked', (_, b) => pedirCuentaParaModo(b.dataset.lock));
+    on(rootSel, 'click', '.ww-mode-locked', (_, b) => pedirCuentaParaModo(b.dataset.lock || ''));
@@ línea 546
-    fsDisposer = attachFullscreenButton('#ww-frame', { target: document.getElementById('ww-frame') });
+    fsDisposer = attachFullscreenButton('#ww-frame', { target: document.getElementById('ww-frame') || undefined, contenido: '#ww-player-widget' });
@@ línea 553
-      const fork = {
+      const fork = /** @type {Activity} */ ({
@@ línea 562
-      };
+      });
```

### templates/wordsearch/player.js (+32 −28)

```diff
@@ línea 12
+import { wordsearchRules, wordsearchWords } from './template.js';
@@ línea 64
-  ln.setAttribute('x1', ra.left + ra.width / 2 - sr.left);
-  ln.setAttribute('y1', ra.top  + ra.height / 2 - sr.top);
-  ln.setAttribute('x2', rb.left + rb.width / 2 - sr.left);
-  ln.setAttribute('y2', rb.top  + rb.height / 2 - sr.top);
+  ln.setAttribute('x1', String(ra.left + ra.width / 2 - sr.left));
+  ln.setAttribute('y1', String(ra.top  + ra.height / 2 - sr.top));
+  ln.setAttribute('x2', String(rb.left + rb.width / 2 - sr.left));
+  ln.setAttribute('y2', String(rb.top  + rb.height / 2 - sr.top));
@@ línea 69
-  ln.setAttribute('stroke-width', Math.max(5, ra.width * 0.7));
+  ln.setAttribute('stroke-width', String(Math.max(5, ra.width * 0.7)));
@@ línea 71
-  ln.setAttribute('opacity', opacity);
+  ln.setAttribute('opacity', String(opacity));
@@ línea 84
-  const rawWords = (activity.content?.words || [])
-    .map(w => typeof w === 'string' ? w : (w?.word || '')).filter(Boolean);
+  const rawWords = wordsearchWords(activity);
@@ línea 91
-  const rules    = activity.rules  || {};
+  const rules    = wordsearchRules(activity);
@@ línea 93
-  const gridN    = SIZE_MAP[rules.gridSize] || 15;
-  const color    = PLAYER_COLORS[opts.playerIndex || 0];
+  const gridN    = SIZE_MAP[rules.gridSize ?? ''] || 15;
+  const color    = PLAYER_COLORS[0];   // Individual: un solo jugador (el duelo pinta por lado, abajo)
@@ línea 145
-  let cellMap;
+  let cellMap = new Map();
@@ línea 151
-    g?.querySelectorAll('.ws-cell').forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
+    (g?.querySelectorAll('.ws-cell'))?.forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
@@ línea 155
-  function getCell(r, c) { return cellMap?.get(`${r},${c}`) ?? null; }
+  function getCell(r, c) { return cellMap.get(`${r},${c}`) ?? null; }
@@ línea 160
-    const el = document.elementFromPoint(x, y);
+    const el = /** @type {HTMLElement|null} */ (document.elementFromPoint(x, y));
@@ línea 162
-    return { r: +el.dataset.r, c: +el.dataset.c };
+    return { r: +el.dataset.r, c: +(el.dataset.c ?? 0) };
@@ línea 253
-    const colorIdx = opts.playerIndex || 0;
-    for (const { r, c } of p.cells) getCell(r, c)?.classList.add(`ws-found-${colorIdx}`);
+    for (const { r, c } of p.cells) getCell(r, c)?.classList.add('ws-found-0');
@@ línea 256
-    const svg = document.getElementById('ws-svg');
+    const svg = /** @type {SVGElement|null} */ (document.getElementById('ws-svg'));
@@ línea 262
-    if (wEl) { wEl.classList.add('ws-word-found'); wEl.querySelector('.ws-word-dot').textContent = '✓'; }
+    if (wEl) {
+      wEl.classList.add('ws-word-found');
+      const dot = wEl.querySelector('.ws-word-dot');
+      if (dot) dot.textContent = '✓';
+    }
@@ línea 307
-  const { grid, cols, placed = [], found = [], side = 'left' } = payload;
+  const { grid, cols, placed = [], found = [], side = 'left' } = /** @type {WsRoundPayload} */ (payload);
+  if (!Array.isArray(grid)) return;
@@ línea 316
-  let selSet = new Set(), cellMap;
+  const selSet = new Set();
+  const cellMap = new Map();
@@ línea 343
-  cellMap = new Map();
-  root.querySelectorAll('.ws-cell').forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
+  (root.querySelectorAll('.ws-cell')).forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
@@ línea 349
-    const el = document.elementFromPoint(x, y);
-    return el?.dataset?.r ? { r: +el.dataset.r, c: +el.dataset.c } : null;
+    const el = /** @type {HTMLElement|null} */ (document.elementFromPoint(x, y));
+    return el?.dataset?.r ? { r: +el.dataset.r, c: +(el.dataset.c ?? 0) } : null;
@@ línea 353
-  const svg = root.querySelector('.ww-ws-svg');
-  const gridEl = root.querySelector('#ws-grid-r');
+  const svg = /** @type {SVGElement|null} */ (root.querySelector('.ww-ws-svg'));
+  const gridEl = /** @type {HTMLElement|null} */ (root.querySelector('#ws-grid-r'));
```

### core/roundRender.js (+31 −25)

```diff
@@ línea 26
-  const opts = payload?.options || [];
+  const opts = Array.isArray(payload?.options) ? payload.options : [];
@@ línea 41
-  root.querySelectorAll('.rq-opt').forEach(btn => btn.addEventListener('pointerdown', (e) => {
-    e.preventDefault();
-    if (done) return;
-    done = true;
-    root.querySelectorAll('.rq-opt').forEach(b => { b.disabled = true; });
-    btn.classList.add('rq-picked');
-    onSubmit?.(btn.dataset.value);
-  }));
+  root.querySelectorAll('.rq-opt').forEach(el => {
+    const btn = /** @type {HTMLButtonElement} */ (el);
+    btn.addEventListener('pointerdown', (e) => {
+      e.preventDefault();
+      if (done) return;
+      done = true;
+      root.querySelectorAll('.rq-opt').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
+      btn.classList.add('rq-picked');
+      onSubmit?.(btn.dataset.value ?? '');
+    });
+  });
@@ línea 81
-  const disp = root.querySelector('[data-display]');
+  const disp = /** @type {HTMLElement|null} */ (root.querySelector('[data-display]'));
@@ línea 84
-  const draw = () => { disp.textContent = val === '' ? '0' : val; };
+  const draw = () => { if (disp) disp.textContent = val === '' ? '0' : val; };
@@ línea 86
-  root.querySelectorAll('.ww-key').forEach(btn => btn.addEventListener('pointerdown', (e) => {
-    e.preventDefault();
-    if (done) return;
-    const k = btn.dataset.k;
-    if (k === 'back') { val = val.slice(0, -1); draw(); return; }
-    if (k === 'ok') {
-      if (val === '') return;            // ignore empty submit
-      done = true;
-      root.querySelectorAll('.ww-key').forEach(b => { b.disabled = true; });
-      onSubmit?.(val);
-      return;
-    }
-    if (val.length < 9) { val += k; draw(); }
-  }));
+  root.querySelectorAll('.ww-key').forEach(el => {
+    const btn = /** @type {HTMLButtonElement} */ (el);
+    btn.addEventListener('pointerdown', (e) => {
+      e.preventDefault();
+      if (done) return;
+      const k = btn.dataset.k ?? '';
+      if (k === 'back') { val = val.slice(0, -1); draw(); return; }
+      if (k === 'ok') {
+        if (val === '') return;            // ignore empty submit
+        done = true;
+        root.querySelectorAll('.ww-key').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
+        onSubmit?.(val);
+        return;
+      }
+      if (val.length < 9) { val += k; draw(); }
+    });
+  });
```

### views/vsView.js (+30 −22)

```diff
@@ línea 82
-function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), ''); }
+function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), '') || ''; }
@@ línea 87
+const ladoDe = (v) => (v === 'left' || v === 'right' ? v : null);
@@ línea 139
-  const T = getTemplate(a.template);
+  const T = /** @type {PlantillaDuelo} */ (getTemplate(a.template));
@@ línea 217
-        save(id === 'anim' ? setVsAnimacion(a, encendido) : setVsFeedback(a, id, encendido));
+        if (id === 'anim') save(setVsAnimacion(a, encendido));
+        else if (id === 'flash' || id === 'confetti') save(setVsFeedback(a, id, encendido));
@@ línea 226
-      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { playChoices = { ...playChoices, [id]: v }; } },
+      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { if (id) playChoices = { ...playChoices, [id]: v }; } },
@@ línea 239
-          const side = input.id.endsWith('left') ? 'left' : 'right';
-          const file = input.files[0];
+          const campo = /** @type {HTMLInputElement} */ (input);
+          const side = /** @type {Lado} */ (campo.id.endsWith('left') ? 'left' : 'right');
+          const file = campo.files?.[0];
@@ línea 251
-            if (errEl) { errEl.textContent = err?.message || 'No se pudo leer la imagen.'; errEl.hidden = false; }
-            input.value = '';
+            if (errEl) {
+              errEl.textContent = err instanceof Error ? err.message : String(err);
+              errEl.hidden = false;
+            }
+            campo.value = '';
@@ línea 261
-          const side = btn.dataset.side;
+          const side = /** @type {Lado} */ (btn.dataset.side === 'right' ? 'right' : 'left');
@@ línea 269
-        const left  = ($('#vs-name-left')?.value  || '').trim() || 'Alumno 1';
-        const right = ($('#vs-name-right')?.value || '').trim() || 'Alumno 2';
+        const campo = (sel) => /** @type {HTMLInputElement|null} */ ($(sel));
+        const left  = (campo('#vs-name-left')?.value  || '').trim() || 'Alumno 1';
+        const right = (campo('#vs-name-right')?.value || '').trim() || 'Alumno 2';
@@ línea 284
-    const session = createSession(applyPlayOptions(T, a, playChoices),
-      { format: FORMATS.VS, left: leftName, right: rightName });
+    const session = /** @type {SesionVs} */ (createSession(applyPlayOptions(T, a, playChoices),
+      { format: FORMATS.VS, left: leftName, right: rightName }));
@@ línea 347
-      if (!animOff) {
-        currentAnim = animDef.create(document.getElementById('vs-stage-canvas'), { src: a.presentation?.vsAnimationSrc });
+      const lienzo = document.getElementById('vs-stage-canvas');
+      if (!animOff && animDef && lienzo) {
+        currentAnim = animDef.create(lienzo, { src: a.presentation?.vsAnimationSrc });
@@ línea 419
-      ['left', 'right'].forEach(s => {
@@ línea 468
-      if (scoreEl) scoreEl.textContent = session.standings()[side].score;
+      if (scoreEl) scoreEl.textContent = String(session.standings()[side].score);
@@ línea 494
-          const ws = st.finishedBy || (st.leader !== 'tie' ? st.leader : null);
+          const ws = ladoDe(st.finishedBy) || ladoDe(st.leader);
@@ línea 528
-      const byPoints = st.leader !== 'tie' ? st.leader : null;
-      const winnerSide = st.race ? (st.finishedBy || byPoints) : (byPoints || st.finishedBy);
+      const byPoints = ladoDe(st.leader);
+      const primero = ladoDe(st.finishedBy);
+      const winnerSide = st.race ? (primero || byPoints) : (byPoints || primero);
@@ línea 532
-      const winner = tie ? null : st[winnerSide];
+      const winner = winnerSide ? st[winnerSide] : null;
@@ línea 549
-      const flourish = `<div class="vs-celeb-score">${tie ? `${st.left.score} – ${st.right.score}` : `${winner.score} pts`}</div>`;
+      const flourish = `<div class="vs-celeb-score">${winner ? `${winner.score} pts` : `${st.left.score} – ${st.right.score}`}</div>`;

```

### views/teamsView.js (+28 −21)

```diff
@@ línea 28
+const campos = (item) =>
@@ línea 87
-  const usesGenericRound = ['turns', 'board'].includes(T?.meta?.play?.teams);
-  if (usesGenericRound && typeof T.renderRound !== 'function') {
-    console.warn(`[teamsView] ${a.template}: declara play.teams="${T.meta.play.teams}" pero no implementa renderRound (contrato roto)`);
+  const usesGenericRound = ['turns', 'board'].includes(T?.meta?.play?.teams ?? '');
+  if (usesGenericRound && typeof T?.renderRound !== 'function') {
+    console.warn(`[teamsView] ${a.template}: declara play.teams="${T?.meta?.play?.teams}" pero no implementa renderRound (contrato roto)`);
@@ línea 128
-      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { playChoices = { ...playChoices, [id]: v }; } },
+      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { if (id) playChoices = { ...playChoices, [id]: v }; } },
@@ línea 134
-          $('#teams-count').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
+          $$('#teams-count button').forEach(x => x.classList.toggle('active', x === b));
@@ línea 138
-        on(host, 'click', '#teams-scoring button', (_, b) => {
-          if (b.disabled) return;
-          $('#teams-scoring').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
+        on(host, 'click', '#teams-scoring button', (_, el) => {
+          if (/** @type {HTMLButtonElement} */ (el).disabled) return;
+          $$('#teams-scoring button').forEach(x => x.classList.toggle('active', x === el));
@@ línea 144
-        const names = $$('#teams-names input').map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
-        const scoring = $('#teams-scoring .active')?.dataset.mode || (canAuto ? 'auto' : 'judge');
+        const entradas = /** @type {HTMLInputElement[]} */ ($$('#teams-names input'));
+        const names = entradas.map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
+        const elegido = $('#teams-scoring .active')?.dataset.mode;
+        const scoring = elegido === 'auto' || elegido === 'judge' ? elegido : (canAuto ? 'auto' : 'judge');
@@ línea 183
-    const session = createSession(applyPlayOptions(T, a, playChoices),
-      { format: FORMATS.TEAMS, teams: names, scoring });
+    const session = /** @type {SesionEquipos} */ (createSession(applyPlayOptions(T, a, playChoices),
+      { format: FORMATS.TEAMS, teams: names, scoring }));
@@ línea 251
-      const prompt = payload?.question || promptOf(item);
+      const prompt = campos(payload).question || promptOf(item);
@@ línea 253
-      if (payload?.image || item?.image) media = `<div class="text-center mb-2"><img src="${escapeHtml(payload?.image || item.image)}" style="max-height:150px" class="img-fluid"></div>`;
+      const imagen = campos(payload).image || campos(item).image;
+      if (imagen) media = `<div class="text-center mb-2"><img src="${escapeHtml(imagen)}" style="max-height:150px" class="img-fluid"></div>`;
@@ línea 280
-      return item.question || item.text || item.prompt || item.left || '';
+      const it = campos(item);
+      return it.question || it.text || it.prompt || it.left || '';
@@ línea 286
-      if (Array.isArray(item.marks)) return applyMarks(item.text || '', item.marks); // textCorrection
-      if (item.answer != null) return Array.isArray(item.answer) ? item.answer.join(' / ') : String(item.answer);
-      if (item.right != null) return String(item.right); // pairs
+      const it = campos(item);
+      if (Array.isArray(it.marks)) return applyMarks(it.text || '', it.marks); // textCorrection
+      if (it.answer != null) return Array.isArray(it.answer) ? it.answer.join(' / ') : String(it.answer);
+      if (it.right != null) return String(it.right); // pairs
@@ línea 335
-      if (roundEl && scoring === 'auto' && phase === 'question' && payload) {
-        T.renderRound(roundEl, payload, { onSubmit: (value) => {
+      if (roundEl && scoring === 'auto' && phase === 'question' && payload
+          && typeof T?.renderRound === 'function') {
+        T.renderRound(roundEl, /** @type {RoundPayload} */ (payload), { onSubmit: (value) => {
@@ línea 342
-          const rev = $('#teams-reveal');
+          const rev = /** @type {HTMLButtonElement|null} */ ($('#teams-reveal'));
```

### templates/memory/player.js (+27 −15)

```diff
@@ línea 11
+import { memoryRules } from './template.js';
@@ línea 41
-  const pairs = (activity.content?.pairs || []).filter(pairComplete);
+  const pairs = (/** @type {PairsContent} */ (activity.content)?.pairs || []).filter(pairComplete);
@@ línea 54
-  const revealMs = activity.rules?.revealMs ?? DEFAULT_REVEAL_MS;
-  const columns = Math.max(2, Math.min(8, activity.rules?.columns || 4));
+  const rules = memoryRules(activity);
+  const revealMs = rules.revealMs ?? DEFAULT_REVEAL_MS;
+  const columns = Math.max(2, Math.min(8, rules.columns || 4));
@@ línea 65
-  const saved = ctx.loadProgress();
-  let deck = null, restored = false;
-  if (saved && Array.isArray(saved.deckIds) && saved.deckIds.length === allCards.length && Array.isArray(saved.locked)) {
+  const bruto = ctx.loadProgress();
+  const saved = bruto && typeof bruto === 'object' ? /** @type {Record<string, unknown>} */ (bruto) : null;
+  const deckIds = Array.isArray(saved?.deckIds) ? saved.deckIds.map(String) : null;
+  const lockedIds = Array.isArray(saved?.locked) ? saved.locked.map(String) : null;
+  let recompuesto = null;
+  if (deckIds && lockedIds && deckIds.length === allCards.length) {
@@ línea 74
-    const ordered = saved.deckIds.map(id => cardById.get(id));
-    if (ordered.every(Boolean)) { deck = ordered; restored = true; } // orden y cartas coherentes
+    const ordered = [];
+    for (const id of deckIds) {
+      const c = cardById.get(id);
+      if (!c) { ordered.length = 0; break; }
+      ordered.push(c);
+    }
+    if (ordered.length === deckIds.length) recompuesto = ordered; // orden y cartas coherentes
@@ línea 83
-  if (!deck) deck = shuffle(allCards.slice());
+  const restored = !!recompuesto;
+  const deck = recompuesto ?? shuffle(allCards.slice());
@@ línea 94
-  if (restored) {
-    state.score = saved.score || 0;
-    state.matched = saved.matched || 0;
-    state.mistakes = saved.mistakes || 0;
-    state.flips = saved.flips || 0;
-    state.locked = new Set(saved.locked);
+  if (restored && saved) {
+    state.score = Number(saved.score) || 0;
+    state.matched = Number(saved.matched) || 0;
+    state.mistakes = Number(saved.mistakes) || 0;
+    state.flips = Number(saved.flips) || 0;
+    state.locked = new Set(lockedIds ?? []);
@@ línea 132
+    if (!cardId) return;
```

### views/studentLive.js (+19 −17)

```diff
@@ línea 17
-import { html, escapeHtml, mount } from '../core/html.js';
+import { html, escapeHtml, mount, $ } from '../core/html.js';
@@ línea 90
-    const code = document.getElementById('f-code').value.trim().toUpperCase();
-    const nick = document.getElementById('f-nick').value.trim();
-    const err = document.getElementById('err');
+    const inCode = /** @type {HTMLInputElement|null} */ ($('#f-code'));
+    const inNick = /** @type {HTMLInputElement|null} */ ($('#f-nick'));
+    const err = $('#err');
+    const btn = /** @type {HTMLButtonElement|null} */ ($('#btn-join'));
+    if (!inCode || !inNick || !err || !btn) return;
+    const code = inCode.value.trim().toUpperCase();
+    const nick = inNick.value.trim();
@@ línea 101
-    document.getElementById('btn-join').disabled = true;
+    btn.disabled = true;
@@ línea 118
-      err.textContent = e.message;
-      document.getElementById('btn-join').disabled = false;
+      err.textContent = e instanceof Error ? e.message : String(e);
+      btn.disabled = false;
@@ línea 132
-  const player = JSON.parse(cached);
+  const player = /** @type {LivePlayer} */ (JSON.parse(cached));
@@ línea 135
-  let session = null;
-  let activity = null;
+  let session;
+  let activity;
@@ línea 142
-    if (!sess) { mount(rootSel, html`<div class="alert alert-warning m-3">Sala no encontrada.</div>`); return; }
+    if (!sess?.activity_snap) { mount(rootSel, html`<div class="alert alert-warning m-3">Sala no encontrada.</div>`); return; }
@@ línea 148
-    mount(rootSel, html`<div class="alert alert-danger m-3">${escapeHtml(e.message)}</div>`); return;
+    mount(rootSel, html`<div class="alert alert-danger m-3">${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`); return;
@@ línea 161
-  if (activity?.appVersion && activity.appVersion !== VERSION) {
+  if (activity.appVersion && activity.appVersion !== VERSION) {
@@ línea 213
+    refreshSession, paintWaiting, paint,
@@ línea 252
-  rt.refreshSession = refreshSession;
@@ línea 256
-      if (ev.new) adoptSession(ev.new);
+      if (ev.new) adoptSession(/** @type {Partial<LiveRoom>} */ (ev.new));
@@ línea 278
-  rt.paintWaiting = paintWaiting;
@@ línea 321
-  rt.paint = paint;   // studentPalabra.js lo llama al cerrarse un giro de ruleta
```

### views/studentTask.js (+21 −15)

```diff
@@ línea 2
-import { html, escapeHtml, mount } from '../core/html.js';
+import { html, escapeHtml, mount, $ } from '../core/html.js';
@@ línea 40
-    const msg = {
+    const motivos = {
@@ línea 43
-      pastDue:         ['danger',    `Esta tarea venció el ${escapeHtml(new Date(t.due_at).toLocaleString())}.`],
+      pastDue:         ['danger',    `Esta tarea venció el ${escapeHtml(new Date(t.due_at ?? '').toLocaleString())}.`],
@@ línea 45
-    }[gate.reason] || ['warning', 'Esta tarea no está disponible.'];
+    };
+    const msg = motivos[gate.reason ?? ''] || ['warning', 'Esta tarea no está disponible.'];
@@ línea 67
-      const v = document.getElementById('f-nick').value.trim();
+      const campo = /** @type {HTMLInputElement|null} */ ($('#f-nick'));
+      const err = $('#err');
+      if (!campo || !err) return;
+      const v = campo.value.trim();
@@ línea 72
-      if (!f.ok) { document.getElementById('err').textContent = 'Apodo: ' + f.reason; return; }
+      if (!f.ok) { err.textContent = 'Apodo: ' + f.reason; return; }
@@ línea 102
-  let marcoTarea = null;
@@ línea 108
-  await new Promise(resolve => {
+  const arranque = new Promise(resolve => {
@@ línea 114
-      playOpts: { T: tpl, activity, choices: elecciones, onChange: (id, v) => { elecciones = { ...elecciones, [id]: v }; } },
+      playOpts: { T: tpl, activity, choices: elecciones, onChange: (id, v) => { if (id) elecciones = { ...elecciones, [id]: v }; } },
@@ línea 121
-      onStart: () => { marcoTarea = montarMarcoJuego(rootSel, activity); resolve(); return marcoTarea.frame; },
+      onStart: () => { const marco = montarMarcoJuego(rootSel, activity); resolve(marco); return marco.frame; },
@@ línea 124
+  const marcoTarea = await arranque;
@@ línea 140
-      const timeUsed = state.timeUsed ?? Math.round((clock.now() - (state.startedAt ?? clock.now())) / 1000);
+      const inicio = typeof state.startedAt === 'number' ? state.startedAt : clock.now();
+      const timeUsed = state.timeUsed ?? Math.round((clock.now() - inicio) / 1000);
@@ línea 144
-      const answers = packAnswers(state.answers || []);
+      const answers = packAnswers(Array.isArray(state.answers) ? state.answers : []);
@@ línea 153
-            toast(r.error, 'warning', TOAST_ERROR);
+            const fallo = r.error || 'No se pudo entregar el intento.';
+            toast(fallo, 'warning', TOAST_ERROR);
@@ línea 156
-            if (note) note.textContent = r.error;
+            if (note) note.textContent = fallo;
@@ línea 164
-        .catch(e => console.warn('record failed', e.message));
+        .catch(e => console.warn('record failed', e instanceof Error ? e.message : String(e)));
```

### views/live/hostRondas.js (+21 −14)

```diff
@@ línea 29
+  function pintarEnProyector(ctx) {
+    const hueco = document.getElementById('host-round');
+    if (!hueco) throw new Error('[hostRondas] falta el hueco #host-round');
+    if (typeof rt.tpl?.renderRoundHost !== 'function') {
+      throw new Error(`[hostRondas] ${rt.activity.template}: no implementa renderRoundHost`);
+    }
+    rt.tpl.renderRoundHost(hueco, ctx);
+  }
@@ línea 45
-    const idx = rt.session.current_item;
+    const idx = rt.session.current_item ?? 0;
@@ línea 84
-      rt.tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'question', item, payload });
+      pintarEnProyector({ phase: 'question', item, payload: /** @type {import('../../kernel/contracts/session.js').RoundPayload|null} */ (payload) });
@@ línea 123
-    if (tickHandle) clearInterval(tickHandle);
+    if (tickHandle != null) clearInterval(tickHandle);
@@ línea 126
-      if (rt.session.phase !== 'question') { clearInterval(tickHandle); tickHandle = null; return; }
+      if (rt.session.phase !== 'question') { if (tickHandle != null) clearInterval(tickHandle); tickHandle = null; return; }
@@ línea 191
-    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
-    const btn = document.getElementById('btn-reveal');
+    if (tickHandle != null) { clearInterval(tickHandle); tickHandle = null; }
+    const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-reveal'));
@@ línea 196
-      toast('Error al revelar: ' + e.message, 'danger', TOAST_NORMAL);
+      toast('Error al revelar: ' + (e instanceof Error ? e.message : String(e)), 'danger', TOAST_NORMAL);
@@ línea 203
-    const idx = rt.session.current_item;
+    const idx = rt.session.current_item ?? 0;
@@ línea 214
-      const pid = a.playerId || a.player_id;
-      const name = playerById[pid];
+      const name = playerById[a.playerId];
@@ línea 249
-    rt.tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'reveal', item, answers: rt.answers, playerMap });
+    pintarEnProyector({ phase: 'reveal', item, answers: rt.answers, playerMap });
@@ línea 282
-      if (!prevRanks || !prevRanks.has(id)) return '';
-      const before = prevRanks.get(id);
+      const before = prevRanks?.get(id);
+      if (before == null) return '';
@@ línea 289
-    const idx = rt.session.current_item;
+    const idx = rt.session.current_item ?? 0;
```

### templates/ballsort/template.js (+18 −15)

```diff
@@ línea 5
-import { renderBallsortEditor, ensureContent } from './editor.js';
+import { renderBallsortEditor, ensureContent, bsContent } from './editor.js';
@@ línea 54
-        get: (a) => a?.content?.mode || 'moves',
+        get: (a) => bsContent(a)?.mode || 'moves',
@@ línea 61
-            ...a.content, mode: v,
-            items: (a.content?.items || []).map(it => ({ ...it, mode: v })),
+            ...bsContent(a), mode: /** @type {'moves'|'time'} */ (v),
+            items: (bsContent(a)?.items || []).map(it => ({ ...it, mode: /** @type {'moves'|'time'} */ (v) })),
@@ línea 89
-  static getRoundPayload(activity, ctx = {}) {
+  static getRoundPayload(activity, ctx) {
@@ línea 96
-    const i = ctx.itemIndex || 0;
-    const item = activity.content.items[i] || activity.content.items[0];
-    return { board: item.board, mode: item.mode || activity.content.mode || 'moves' };
+    const c = bsContent(activity);
+    const i = ctx?.itemIndex || 0;
+    const item = c.items[i] || c.items[0];
+    return { board: item.board, mode: item.mode || c.mode || 'moves' };
@@ línea 110
-    if (!payload?.board) return null;
-    return mountBallSort(root, {
-      board: payload.board,
-      mode: payload.mode || 'moves',
+    const board = /** @type {import('../../kernel/contracts/activity.js').BallsortBoard|undefined} */ (payload?.board);
+    if (!board) return null;
+    return mountBallSort(/** @type {HTMLElement} */ (root), {
+      board,
+      mode: payload.mode === 'time' ? 'time' : 'moves',
@@ línea 127
-    const board = payload?.board || item?.board;
+    const puzle = /** @type {{board?: import('../../kernel/contracts/activity.js').BallsortBoard}} */ (item && typeof item === 'object' ? item : {});
+    const board = /** @type {import('../../kernel/contracts/activity.js').BallsortBoard|undefined} */ (payload?.board) || puzle.board;
@@ línea 141
-    const v = value || {};
+    const v = /** @type {Partial<BallsortSnapshot>} */ (value && typeof value === 'object' ? value : {});
@@ línea 149
-          <span class="bs-cell-name">${escapeHtml(name || '—')}</span>
+          <span class="bs-cell-name">${escapeHtml(typeof name === 'string' && name ? name : '—')}</span>
```

### templates/question-live/player.js (+18 −15)

```diff
@@ línea 26
-  return sessionItems(activity).map(i =>
-    typeof i === 'string' ? { question: i, image: null } : { question: i?.question ?? i?.q ?? '', image: i?.image || null }
-  );
+  return sessionItems(activity).map(i => {
+    if (typeof i === 'string') return { question: i, image: null };
+    const it = /** @type {CardItemLegado} */ (i);
+    return { question: it.question ?? it.q ?? '', image: it.image || null };
+  });
@@ línea 76
-      done, openIdx, open: openIdx, cls: 'ab-box',
+      done, open: openIdx, cls: 'ab-box',
@@ línea 81
-    const openItem = openIdx !== null ? items[openIdx] : null;
+    const abierta = openIdx !== null && items[openIdx] ? { i: openIdx, item: items[openIdx] } : null;
@@ línea 88
-        ${openItem != null ? `
-          <div class="ab-open card border-2 mx-auto mt-4" style="max-width:480px;border-color:${QL_COLORS[openIdx % QL_COLORS.length]};border-width:2px">
+        ${abierta != null ? `
+          <div class="ab-open card border-2 mx-auto mt-4" style="max-width:480px;border-color:${QL_COLORS[abierta.i % QL_COLORS.length]};border-width:2px">
@@ línea 91
-              <small class="text-muted d-block mb-2">Caja ${openIdx + 1}</small>
-              ${openItem.image ? `<img src="${escapeHtml(openItem.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
-              <h4 class="card-title text-center">${escapeHtml(openItem.question || '')}</h4>
+              <small class="text-muted d-block mb-2">Caja ${abierta.i + 1}</small>
+              ${abierta.item.image ? `<img src="${escapeHtml(abierta.item.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
+              <h4 class="card-title text-center">${escapeHtml(abierta.item.question || '')}</h4>
@@ línea 106
-      const i = +b.dataset.i;
+      const i = Number(b.dataset.i);
@@ línea 141
-      const item = items[openIdx];
+      const idx = openIdx;
+      const item = items[idx];
@@ línea 147
-              <small class="text-muted d-block mb-2">Pregunta ${openIdx + 1}</small>
+              <small class="text-muted d-block mb-2">Pregunta ${idx + 1}</small>
@@ línea 158
-      on(rootSel, 'click', '#ab-done', () => { done.add(openIdx); openIdx = null; paint(); });
+      on(rootSel, 'click', '#ab-done', () => { done.add(idx); openIdx = null; paint(); });
@@ línea 193
-      const btn = rootEl()?.querySelector('#ab-spin');
+      const btn = /** @type {HTMLButtonElement|null} */ (rootEl()?.querySelector('#ab-spin') ?? null);
```

### core/soloPlayer.js (+19 −13)

```diff
@@ línea 22
+function leerProgreso(key) {
+  let saved = null;
+  try { saved = JSON.parse(lsGet(key, '') || 'null'); } catch { saved = null; }
+  return saved && typeof saved === 'object' && !Array.isArray(saved)
+    ? /** @type {Record<string, unknown>} */ (saved)
+    : null;
+}
@@ línea 220
-    let saved = null;
-    try { saved = JSON.parse(lsGet(pKey, '') || 'null'); } catch { saved = null; }
+    const saved = leerProgreso(pKey);
@@ línea 222
-    if (saved.startedAt) startedAt = saved.startedAt;
+    if (typeof saved.startedAt === 'number') startedAt = saved.startedAt;
@@ línea 281
-  return { finish, saveProgress, loadProgress, alive, alAgotarse: (cb) => { alAgotarseCb = cb; } };
+  return { finish, saveProgress, loadProgress, alive, alAgotarse: (/** @type {() => void} */ cb) => { alAgotarseCb = cb; } };
@@ línea 310
-export function runSequentialPlayer(rootSel, activity, opts = {}, callbacks = {}) {
-  const source = activity.content?.items || [];
+export function runSequentialPlayer(rootSel, activity, opts = {}, callbacks) {
+  const contenido = /** @type {Record<string, unknown>} */ (activity.content || {});
+  const source = /** @type {I[]} */ (Array.isArray(contenido.items) ? contenido.items : []);
@@ línea 343
-    let saved = null;
-    try { saved = JSON.parse(lsGet(pKey, '') || 'null'); } catch { saved = null; }
+    const saved = leerProgreso(pKey);
@@ línea 345
-        && Number.isInteger(saved.idx) && saved.idx > 0 && saved.idx < items.length) {
-      state.idx = saved.idx;
-      state.score = saved.score || 0;
+        && Number.isInteger(saved.idx) && Number(saved.idx) > 0 && Number(saved.idx) < items.length) {
+      state.idx = Number(saved.idx);
+      state.score = Number(saved.score) || 0;
@@ línea 349
-      state.startedAt = saved.startedAt || state.startedAt;
+      if (typeof saved.startedAt === 'number') state.startedAt = saved.startedAt;
@@ línea 422
-        const item = items[state.idx];
+        const item = /** @type {{id?: string}|undefined} */ (items[state.idx]);
```

### templates/crossword/player.js (+17 −14)

```diff
@@ línea 24
-  const wordsRaw = (activity.content?.words || [])
+  const contenido = /** @type {{words?: CrosswordWord[]}|null|undefined} */ (activity.content);
+  const wordsRaw = (contenido?.words || [])
@@ línea 28
+  const raiz = () => (typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel);
+  const dentro = (sel) => /** @type {HTMLElement|null} */ (raiz()?.querySelector(sel) ?? null);
+  const todos = (sel) => [...(raiz()?.querySelectorAll(sel) ?? [])].map(el => /** @type {HTMLElement} */ (el));
@@ línea 134
-    const wrap = document.querySelector(`${rootSel} .cw-grid-wrap`);
-    const grid = document.querySelector(`${rootSel} #cw-grid`);
+    const wrap = dentro('.cw-grid-wrap');
+    const grid = dentro('#cw-grid');
@@ línea 149
-    const wrap = document.querySelector(`${rootSel} .cw-grid-wrap`);
+    const wrap = dentro('.cw-grid-wrap');
@@ línea 156
-    const ki = document.getElementById('cw-ki'); // keyboard input (mobile)
-    const gridEl = document.getElementById('cw-grid');
+    const ki = /** @type {HTMLInputElement|null} */ (document.getElementById('cw-ki')); // keyboard input (mobile)
@@ línea 161
-      const r = +el.dataset.r, c = +el.dataset.c;
+      const r = +(el.dataset.r ?? -1), c = +(el.dataset.c ?? -1);
@@ línea 183
-    ki?.addEventListener('input', (e) => {
+    ki?.addEventListener('input', () => {
@@ línea 185
-      const raw = e.target.value.replace(/\s/g, '');
-      e.target.value = '';
+      const raw = ki.value.replace(/\s/g, '');
+      ki.value = '';
@@ línea 216
-    return document.querySelector(`#cw-grid [data-r="${r}"][data-c="${c}"]`);
+    return /** @type {HTMLElement|null} */ (document.querySelector(`#cw-grid [data-r="${r}"][data-c="${c}"]`));
@@ línea 266
-    document.querySelectorAll(`${rootSel} .cw-white`).forEach(el => el.classList.remove('cw-active-word', 'cw-active-cell'));
-    document.querySelectorAll(`${rootSel} .cw-clue`).forEach(el => el.classList.remove('cw-clue-active'));
+    todos('.cw-white').forEach(el => el.classList.remove('cw-active-word', 'cw-active-cell'));
+    todos('.cw-clue').forEach(el => el.classList.remove('cw-clue-active'));
@@ línea 472
-    document.querySelectorAll(`${rootSel} .cw-clue`).forEach(el => el.classList.remove('cw-clue-solved','cw-clue-wrong'));
+    todos('.cw-clue').forEach(el => el.classList.remove('cw-clue-solved','cw-clue-wrong'));
```

### views/live/studentCarrera.js (+19 −12)

```diff
@@ línea 9
-import { html, escapeHtml, mount } from '../../core/html.js';
+import { html, escapeHtml, mount, $$ } from '../../core/html.js';
@@ línea 38
+    if (typeof tpl?.renderRound !== 'function' || typeof tpl.scoreSubmission !== 'function') {
+      throw new Error(`[studentCarrera] ${rt.activity.template}: no implementa renderRound + scoreSubmission`);
+    }
@@ línea 121
-          deadline: deadlineMs, ctx: rt.ctx,
+          deadline: deadlineMs, setIntervalFn: rt.ctx.setInterval,
@@ línea 123
-          onTick: (leftMs) => {
+          onTick: ({ remainMs }) => {
@@ línea 127
-            if (el) el.textContent = mmss(leftMs, Math.ceil);
+            if (el) el.textContent = mmss(remainMs, Math.ceil);
@@ línea 134
-    const idx = rt.raceQueue[0];
+    const cola = rt.raceQueue;
+    const idx = cola[0];
@@ línea 141
+    if (!payload) return;   // índice fuera del snapshot: no hay ronda que pintar
@@ línea 160
-      right: `${rt.raceQueue.length} restantes`,
+      right: `${cola.length} restantes`,
@@ línea 165
-    const ronda = tpl.renderRound(document.getElementById('s-round'), payload, {
-      mode: 'live',
+    const hueco = document.getElementById('s-round');
+    if (!hueco) return;
+    const puntuar = tpl.scoreSubmission.bind(tpl);
+    const ronda = tpl.renderRound(hueco, payload, {
@@ línea 185
-          const r = tpl.scoreSubmission({ value, item: allItems[idx], msTaken: ms, activity: rt.activity, mode: pointsModeFor(rt.session.loop || 'race') });
+          const r = puntuar({ value, item: allItems[idx], msTaken: ms, activity: rt.activity, mode: pointsModeFor(rt.session.loop || 'race') });
@@ línea 203
-          const picked = [...roundEl.querySelectorAll('.rq-opt')].find(b => b.dataset.value === value)
+          const picked = $$('.rq-opt', roundEl).find(b => b.dataset.value === value)
@@ línea 209
-        rt.raceQueue.shift();
-        if (!ok) rt.raceQueue.push(idx);
+        cola.shift();
+        if (!ok) cola.push(idx);
```

### kernel/content/convert.js (+16 −11)

```diff
@@ línea 33
+function itemsConPregunta(content) {
+  const crudos = 'items' in content && Array.isArray(content.items) ? content.items : [];
+  const out = [];
+  for (const it of crudos) if (it && typeof it === 'object' && 'question' in it) out.push(/** @type {QaItem} */ (it));
+  return out;
+}
+function parejas(content) {
+  return 'pairs' in content && Array.isArray(content.pairs) ? content.pairs : [];
+}
@@ línea 60
-    const items = Array.isArray(content?.items) ? content.items : [];
-    const out = items
+    const out = itemsConPregunta(content)
@@ línea 68
-    const items = Array.isArray(content?.items) ? content.items : [];
-    const out = items
+    const out = itemsConPregunta(content)
@@ línea 75
-    const ps = Array.isArray(content?.pairs) ? content.pairs : [];
-    const valid = ps.filter(p => nonEmpty(p.left) && nonEmpty(p.right));
+    const valid = parejas(content).filter(p => nonEmpty(p.left) && nonEmpty(p.right));
@@ línea 89
-    const ps = Array.isArray(content?.pairs) ? content.pairs : [];
-    const out = ps.flatMap(p => [
-      nonEmpty(p.left) ? { id: rid('it_'), question: String(p.left), image: p.leftImage ?? p.image ?? null } : null,
-      nonEmpty(p.right) ? { id: rid('it_'), question: String(p.right), image: p.rightImage ?? null } : null,
-    ]).filter(Boolean);
+    const out = parejas(content).flatMap(p => [
+      ...(nonEmpty(p.left) ? [{ id: rid('it_'), question: String(p.left), image: p.leftImage ?? p.image ?? null }] : []),
+      ...(nonEmpty(p.right) ? [{ id: rid('it_'), question: String(p.right), image: p.rightImage ?? null }] : []),
+    ]);
```

### kernel/content/models.js (+17 −8)

```diff
@@ línea 33
+function listaDe(content, key) {
+  if (!content || typeof content !== 'object') return null;
+  const v = /** @type {Record<string, unknown>} */ (content)[key];
+  return Array.isArray(v) ? v : null;
+}
+export function erroresDeLista(content, key) {
+  return listaDe(content, key) ? [] : [`${key} must be an array`];
+}
@@ línea 70
-      if (!Array.isArray(content?.items)) errors.push('items must be an array');
-      else if (content.items.length === 0) errors.push('needs at least one item');
+      const items = listaDe(content, 'items');
+      if (!items) errors.push('items must be an array');
+      else if (items.length === 0) errors.push('needs at least one item');
@@ línea 100
-      if (!Array.isArray(content?.words)) errors.push('words must be an array');
+      if (!listaDe(content, 'words')) errors.push('words must be an array');
@@ línea 106
-    newEmpty: () => ({ level: 'classic', mode: 'moves', random: true, items: [] }),
+    newEmpty: () => ({ level: 'classic', mode: /** @type {'moves'} */ ('moves'), random: true, items: [] }),
@@ línea 110
-      if (!Array.isArray(content?.items)) errors.push('items must be an array');
+      if (!listaDe(content, 'items')) errors.push('items must be an array');
@@ línea 124
-      if (!Array.isArray(content?.items)) errors.push('items must be an array');
+      if (!listaDe(content, 'items')) errors.push('items must be an array');
@@ línea 134
-      if (!Array.isArray(content?.items)) errors.push('items must be an array');
+      if (!listaDe(content, 'items')) errors.push('items must be an array');
@@ línea 144
-      if (!Array.isArray(content?.items)) errors.push('items must be an array');
+      if (!listaDe(content, 'items')) errors.push('items must be an array');
```

### views/live/studentTablero.js (+17 −8)

```diff
@@ línea 34
+    if (typeof tpl?.renderRound !== 'function') {
+      throw new Error(`[studentTablero] ${rt.activity.template}: no implementa renderRound`);
+    }
@@ línea 40
-    if (!payload?.board) return rt.paintWaiting('Esperando…');
+    const board = payload?.board;
+    if (!board || typeof board !== 'object') return rt.paintWaiting('Esperando…');
+    const medidas = /** @type {Record<string, unknown>} */ (board);
@@ línea 55
-    let lastSent = 0, pendingSnap = null, flushHandle = null, solved = false;
+    let lastSent = 0, solved = false;
+    let pendingSnap = null;
+    let flushHandle = null;
@@ línea 79
-    tpl.renderRound(document.getElementById('s-round'), payload, {
-      mode: 'live',
+    const hueco = document.getElementById('s-round');
+    if (!hueco) return;
+    tpl.renderRound(hueco, payload, {
@@ línea 85
+        const hecho = /** @type {Record<string, unknown>} */ (res && typeof res === 'object' ? res : {});
@@ línea 89
-          tubes: res.tubes,
-          tubeCapacity: payload.board.tubeCapacity,
-          colors: payload.board.colors,
-          moveCount: res.moveCount, elapsedMs: res.elapsedMs, solved: true,
+          tubes: hecho.tubes,
+          tubeCapacity: medidas.tubeCapacity,
+          colors: medidas.colors,
+          moveCount: hecho.moveCount, elapsedMs: hecho.elapsedMs, solved: true,
```

### templates/tildes/template.js (+16 −7)

```diff
@@ línea 12
+const esObjeto = (v) => !!v && typeof v === 'object';
+const esTextCorrection = (c) => esObjeto(c) && Array.isArray(/** @type {{passages?: unknown}} */ (c).passages);
@@ línea 106
-  static renderRoundHost(root, ctx) {
-    renderTextCorrectionHost(root, { ...ctx, kind: 'tilde' });
+  static renderRoundHost(root, ctx = {}) {
+    renderTextCorrectionHost(root, {
+      phase: ctx.phase,
+      item: esObjeto(ctx.item) ? /** @type {Passage} */ (ctx.item) : null,
+      kind: 'tilde',
+    });
@@ línea 123
-  static itemParts({ item }) { return markPartsFor(item, 'tilde'); }
+  static itemParts({ item }) {
+    return markPartsFor(esObjeto(item) ? /** @type {Passage} */ (item) : null, 'tilde');
+  }
@@ línea 131
-  static itemLabel(item) { return passageLabel(item); }
+  static itemLabel(item) {
+    return passageLabel(esObjeto(item) ? /** @type {Passage} */ (item) : null);
+  }
@@ línea 150
-    const passages = content?.passages;
-    if (!Array.isArray(passages)) return content;
-    for (const p of passages) {
+    if (!esTextCorrection(content)) return content;
+    for (const p of content.passages) {
```

### views/live/hostTablero.js (+16 −7)

```diff
@@ línea 35
-    const mode = rt.activity.content?.mode || 'moves';
-    const initialBoard = roundPayloadOf(rt.tpl, rt.activity, 0)?.board || null;
+    const contenido = /** @type {Record<string, unknown>} */ (rt.activity.content || {});
+    const mode = typeof contenido.mode === 'string' ? contenido.mode : 'moves';
+    const payload = roundPayloadOf(rt.tpl, rt.activity, 0);
+    const board = payload?.board;
+    const initialBoard = board && typeof board === 'object'
+      ? /** @type {Record<string, unknown>} */ (board) : null;
@@ línea 49
-    for (const r of rows) byPlayer[r.playerId || r.player_id] = r.value;
+    for (const r of rows) {
+      if (r.value && typeof r.value === 'object') byPlayer[r.playerId] = /** @type {SnapTablero} */ (r.value);
+    }
@@ línea 59
-      value: byPlayer[p.id] || (initialBoard ? { tubes: initialBoard.tubes, tubeCapacity: initialBoard.tubeCapacity, colors: initialBoard.colors, moveCount: 0, elapsedMs: 0, solved: false } : null),
+      value: byPlayer[p.id] || (initialBoard ? /** @type {SnapTablero} */ ({ tubes: initialBoard.tubes, tubeCapacity: initialBoard.tubeCapacity, colors: initialBoard.colors, moveCount: 0, elapsedMs: 
@@ línea 93
-    if (declaresBoard && typeof rt.tpl.renderRaceCell !== 'function') {
+    if (declaresBoard && typeof rt.tpl?.renderRaceCell !== 'function') {
@@ línea 103
-        try { rt.tpl.renderRaceCell(cellEl, { value: c.value, name: c.name, mode }); }
+        try {
+          if (typeof rt.tpl?.renderRaceCell !== 'function') throw new Error('no implementa renderRaceCell');
+          rt.tpl.renderRaceCell(cellEl, { value: c.value, name: c.name, mode });
+        }
@@ línea 116
-      const btn = document.getElementById('btn-end-race');
+      const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-end-race'));
```

### templates/globos/player.js (+13 −9)

```diff
@@ línea 47
-    const btn = e.target.closest('.gl-balloon');
+    const t = /** @type {{closest?: (sel: string) => Element|null}|null} */ (e.target);
+    const btn = /** @type {HTMLButtonElement|null} */ (typeof t?.closest === 'function' ? t.closest('.gl-balloon') : null);
@@ línea 63
-  runSequentialPlayer(rootSel, activity, opts, {
+  const callbacks = {
@@ línea 66
-    renderItem({ rootSel, item, idx, total, score, timerSecs, submit, alAgotarse }) {
+    renderItem({ rootSel, item, idx, total, timerSecs, submit, alAgotarse }) {
@@ línea 74
-            racha: streak >= 2 ? String(streak) : null,   // el 🔥 lo pone el chip (core/playerHud.js)
+            racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
@@ línea 84
-      const root = document.querySelector(rootSel);
+      const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
+      if (!root) return;
@@ línea 90
+      const globos = () => [...root.querySelectorAll('.gl-balloon')].map(b => /** @type {HTMLButtonElement} */ (b));
@@ línea 97
-        root.querySelectorAll('.gl-balloon').forEach(b => {
-          if (good.includes(b.dataset.value)) b.classList.add('gl-good');
+        globos().forEach(b => {
+          if (b.dataset.value !== undefined && good.includes(b.dataset.value)) b.classList.add('gl-good');
@@ línea 101
-      const disableAll = () => root.querySelectorAll('.gl-balloon').forEach(b => { b.disabled = true; });
+      const disableAll = () => globos().forEach(b => { b.disabled = true; });
@@ línea 128
-  });
+  };
+  runSequentialPlayer(rootSel, activity, opts, callbacks);
```

### templates/tangram/player.js (+13 −9)

```diff
@@ línea 66
-    if (anchoFilaActual + gap + c.w > anchoObjetivo && filas.at(-1).length > 0) {
+    if (anchoFilaActual + gap + c.w > anchoObjetivo && filas[filas.length - 1].length > 0) {
@@ línea 70
-    filas.at(-1).push(c);
+    filas[filas.length - 1].push(c);
@@ línea 109
-  const item = activity.content.items[0];
+  const item = /** @type {TangramContent} */ (activity.content).items[0];
@@ línea 137
-  const hueco = document.querySelector(rootSel);
+  const hueco = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
@@ línea 172
-  const root = document.querySelector(rootSel);
-  const svg = root.querySelector('.ta-svg');
-  const capa = root.querySelector('.ta-piezas');
+  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
+  const svgOpt = /** @type {SVGSVGElement|null} */ (root?.querySelector('.ta-svg') ?? null);
+  const capaOpt = root?.querySelector('.ta-piezas') ?? null;
+  if (!svgOpt || !capaOpt) return;   // el marco no llegó a montarse: no hay tablero que cablear
+  const svg = svgOpt, capa = capaOpt;
@@ línea 213
-    const lista = ORDEN_PIEZAS.map(n => ({ pieza: n, ...colocaciones[n] }));
+    const lista = ORDEN_PIEZAS.map(n => ({ ...colocaciones[n], pieza: n }));
@@ línea 236
-    const g = e.target.closest('.ta-pieza');
+    const destino = /** @type {Element|null} */ (e.target);
+    const g = /** @type {SVGElement|null} */ (destino?.closest('.ta-pieza') ?? null);
@@ línea 240
+    if (!n) return;
```

### views/live/studentRondas.js (+15 −7)

```diff
@@ línea 65
-    const idx = rt.session.current_item;
+    const idx = rt.session.current_item ?? 0;
@@ línea 109
+    const readSecs = rt.session.read_secs;
@@ línea 111
-      : (Number.isFinite(rt.session.read_secs) ? rt.session.read_secs * 1000 : readWindowMs(rt.activity));
+      : (typeof readSecs === 'number' && Number.isFinite(readSecs) ? readSecs * 1000 : readWindowMs(rt.activity));
@@ línea 132
+    if (typeof tpl?.renderRound !== 'function') {
+      throw new Error(`[studentRondas] ${rt.activity.template}: no implementa renderRound`);
+    }
@@ línea 141
+    if (!payload) return;
@@ línea 158
-      el.classList.add('s-reading');
-      try { tpl.renderRound(el, payload, { mode: 'live', onSubmit: () => {} }); } catch { /* payload raro: la cuenta atrás sigue */ }
+      if (el) {
+        el.classList.add('s-reading');
+        try { tpl.renderRound(el, payload, { onSubmit: () => {} }); } catch { /* payload raro: la cuenta atrás sigue */ }
+      }
@@ línea 179
-    const handle = tpl.renderRound(document.getElementById('s-round'), payload, {
-      mode: 'live',
+    const hueco = document.getElementById('s-round');
+    if (!hueco) return;
+    const handle = tpl.renderRound(hueco, payload, {
@@ línea 226
-    const idx = rt.session.current_item;
+    const idx = rt.session.current_item ?? 0;
```

### templates/quiz/player.js (+14 −7)

```diff
@@ línea 41
-  runSequentialPlayer(rootSel, activity, opts, {
+  const callbacks = {
@@ línea 45
-    renderItem({ rootSel, item, idx, total, score, timerSecs, submit, alAgotarse }) {
+    renderItem({ rootSel, item, idx, total, timerSecs, submit, alAgotarse }) {
@@ línea 53
-            racha: streak >= 2 ? String(streak) : null,   // el 🔥 lo pone el chip (core/playerHud.js)
+            racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
@@ línea 72
-      const opts$ = () => document.querySelectorAll(`${rootSel} .ww-opt`);
+      const opts$ = () => {
+        const nodos = typeof rootSel === 'string'
+          ? document.querySelectorAll(`${rootSel} .ww-opt`)
+          : rootSel.querySelectorAll('.ww-opt');
+        return [...nodos].map(b => /** @type {HTMLButtonElement} */ (b));
+      };
@@ línea 88
-          if (correct.includes(b.dataset.value)) b.classList.add('btn-success');
+          if (b.dataset.value !== undefined && correct.includes(b.dataset.value)) b.classList.add('btn-success');
@@ línea 102
-      on(rootSel, 'click', '.ww-opt', (_, btn) => {
+      on(rootSel, 'click', '.ww-opt', (_, el) => {
+        const btn = /** @type {HTMLButtonElement} */ (el);
@@ línea 121
-  });
+  };
+  runSequentialPlayer(rootSel, activity, opts, callbacks);
```

### views/memoryView.js (+14 −7)

```diff
@@ línea 37
-  const pairs = (a.content?.pairs || []).filter(p => p?.left && p?.right);
+  const vivo = () => (typeof host === 'string' ? document.querySelector(host) : host);
+  const c = a.content;
+  const crudos = /** @type {Pair[]} */ (
+    c && typeof c === 'object' && 'pairs' in c && Array.isArray(c.pairs) ? c.pairs : []);
+  const pairs = crudos.filter(p => p?.left && p?.right);
@@ línea 77
-          $('#mem-count').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
+          $$('#mem-count button').forEach(x => x.classList.toggle('active', x === b));
@@ línea 82
-        const names = $$('#mem-names input').map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
+        const campos = /** @type {HTMLInputElement[]} */ ($$('#mem-names input'));
+        const names = campos.map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
@@ línea 97
-    const game = createMemoryGame(a, { teams: names });
+    const game = createMemoryGame(
+      { teams: names });
@@ línea 146
-      on(host, 'click', '.mem-card', (_, btn) => {
+      on(host, 'click', '.mem-card', (_, el) => {
+        const btn = /** @type {HTMLButtonElement} */ (el);
@@ línea 149
-        const r = game.flip(btn.dataset.id);
+        const r = game.flip(btn.dataset.id || '');
@@ línea 159
-          setTimeout(() => { if (!host.isConnected) return; game.cover(); busy = false; paint(); }, COVER_MS);
+          setTimeout(() => { if (!vivo()?.isConnected) return; game.cover(); busy = false; paint(); }, COVER_MS);
```

### templates/wordsearch/template.js (+12 −7)

```diff
@@ línea 7
+export const wordsearchRules = (activity) => /** @type {WordsearchRules} */ (activity.rules || {});
+export function wordsearchWords(activity) {
+  const c = /** @type {WordsContent} */ (activity.content);
+  return (c?.words || []).map(w => (typeof w === 'string' ? w : (w?.word || ''))).filter(Boolean);
+}
@@ línea 77
-    const ws = content?.words || [];
-    if (!ws.length || typeof ws[0] === 'string') return content;
-    return { ...content, words: ws.map(w => String(w?.word || '')).filter(Boolean) };
+    const c = /** @type {WordsContent} */ (content);
+    const ws = c?.words || [];
+    if (!ws.length || typeof ws[0] === 'string') return /** @type {WordsearchContent} */ (content);
+    return { ...c, words: ws.map(w => String((typeof w === 'string' ? w : w?.word) || '')).filter(Boolean) };
@@ línea 94
-    const words = (activity.content?.words || [])
-      .map(w => String(w || '').trim()).filter(Boolean);
+    const words = wordsearchWords(activity).map(w => w.trim()).filter(Boolean);
@@ línea 96
-    const rules = activity.rules || {};
-    const n = SIZE_MAP[rules.gridSize] || 15;
+    const rules = wordsearchRules(activity);
+    const n = SIZE_MAP[rules.gridSize ?? ''] || 15;
```

### views/live/studentPalabra.js (+13 −6)

```diff
@@ línea 23
+  function visible(idx) {
+    const raw = visibleItem(rt.activity, idx);
+    if (typeof raw === 'string') return { label: raw, image: null };
+    const o = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
+    const label = typeof o.question === 'string' ? o.question
+      : typeof o.q === 'string' ? o.q : '';   // q: sesión en vuelo pre-migración
+    return { label, image: typeof o.image === 'string' ? o.image : null };
+  }
@@ línea 42
-    const raw = visibleItem(rt.activity, idx);
@@ línea 44
-    const label = typeof raw === 'string' ? raw : (raw?.question ?? raw?.q ?? '');   // ?? q: sesión en vuelo pre-migración
+    const { label } = visible(idx);
@@ línea 79
-    const qlImage    = qlOpen !== null ? (visibleItem(rt.activity, qlOpen)?.image ?? null) : null;
+    const qlImage    = qlOpen !== null ? visible(qlOpen).image : null;
@@ línea 103
-    on(rt.rootSel, 'click', '.ql-sbox:not([disabled])', (_, btn) => qlOpenQuestion(+btn.dataset.idx));
+    on(rt.rootSel, 'click', '.ql-sbox:not([disabled])', (_, btn) => qlOpenQuestion(Number(btn.dataset.idx)));
@@ línea 112
-    const qlImage    = qlOpen !== null ? (visibleItem(rt.activity, qlOpen)?.image ?? null) : null;
+    const qlImage    = qlOpen !== null ? visible(qlOpen).image : null;
@@ línea 159
-    const btn = rootEl()?.querySelector('#ql-spin');
+    const btn = /** @type {HTMLButtonElement|null} */ (rootEl()?.querySelector('#ql-spin') ?? null);
```

### core/modes.js (+11 −7)

```diff
@@ línea 39
+const paresDe = (a) => {
+  const c = a?.content;
+  return c && typeof c === 'object' && 'pairs' in c && Array.isArray(c.pairs) ? c.pairs : [];
+};
@@ línea 107
-    isAvailable: (a) => isVsCompatible(a),
+    isAvailable: (a) => !!a && isVsCompatible(a),
@@ línea 120
-      ? (a?.content?.pairs || []).filter(p => p?.left && p?.right).length >= 2
-      : sessionItems(a).length >= 1,
+      ? paresDe(a).filter(p => p?.left && p?.right).length >= 2
+      : sessionItems(a ?? null).length >= 1,
@@ línea 131
-    hostAction: 'crear una sala en vivo',
+    hostActionLabel: 'crear una sala en vivo',
@@ línea 143
-    hostAction: 'crear una tarea',
+    hostActionLabel: 'crear una tarea',
@@ línea 225
-  if (!modeNeedsAuth(m)) return '';
-  return `Inicia sesión para ${m.hostAction || `usar ${m.label}`}`;
+  if (!m || !modeNeedsAuth(m)) return '';
+  return `Inicia sesión para ${m.hostActionLabel || `usar ${m.label}`}`;
```

### templates/ballsort/player.js (+10 −7)

```diff
@@ línea 17
-import { ensureContent } from './editor.js';
+import { ensureContent, bsContent } from './editor.js';
@@ línea 26
-  const item = activity.content.items[0];
-  const mode = item.mode || activity.content.mode || 'moves';
+  const c = bsContent(activity);
+  const item = c.items[0];
+  const mode = item.mode || c.mode || 'moves';
@@ línea 30
-  const board = activity.content.random
-    ? randomBoard(activity.content.level || 'classic')
-    : (item.board || createBoard(activity.content.level || 'classic'));
+  const board = c.random
+    ? randomBoard(c.level || 'classic')
+    : (item.board || createBoard(c.level || 'classic'));
@@ línea 41
-  const host = document.querySelector(`${rootSel} #bs-solo-host`);
+  const raiz = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
+  const host = /** @type {HTMLElement|null} */ (raiz?.querySelector('#bs-solo-host') ?? null);
+  if (!host) return;   // la ruta cambió mientras se montaba (§23)
```

### templates/comas/template.js (+13 −4)

```diff
@@ línea 12
+const esObjeto = (v) => !!v && typeof v === 'object';
@@ línea 100
-  static renderRoundHost(root, ctx) {
-    renderTextCorrectionHost(root, { ...ctx, kind: 'coma' });
+  static renderRoundHost(root, ctx = {}) {
+    renderTextCorrectionHost(root, {
+      phase: ctx.phase,
+      item: esObjeto(ctx.item) ? /** @type {Passage} */ (ctx.item) : null,
+      kind: 'coma',
+    });
@@ línea 116
-  static itemParts({ item }) { return markPartsFor(item, 'coma'); }
+  static itemParts({ item }) {
+    return markPartsFor(esObjeto(item) ? /** @type {Passage} */ (item) : null, 'coma');
+  }
@@ línea 124
-  static itemLabel(item) { return passageLabel(item); }
+  static itemLabel(item) {
+    return passageLabel(esObjeto(item) ? /** @type {Passage} */ (item) : null);
+  }
```

### templates/puzzle/player.js (+10 −6)

```diff
@@ línea 66
-  const item = activity.content?.items?.[0] || { dibujo: 'casa', filas: 2, columnas: 2 };
+  const contenido = /** @type {Partial<PuzzleContent>} */ (activity.content ?? {});
+  const item = contenido.items?.[0] || { id: '', dibujo: 'casa', filas: 2, columnas: 2 };
@@ línea 82
-  const root = document.querySelector(rootSel);
+  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
@@ línea 84
-  const arena   = root.querySelector('.pu-arena');
-  const boardEl = root.querySelector('[data-pu-board]');
+  const arenaOpt   = /** @type {HTMLElement|null} */ (root.querySelector('.pu-arena'));
+  const boardOpt   = /** @type {HTMLElement|null} */ (root.querySelector('[data-pu-board]'));
@@ línea 93
-  const piecesEl = root.querySelector('[data-pu-pieces]');
+  const piecesOpt  = /** @type {HTMLElement|null} */ (root.querySelector('[data-pu-pieces]'));
+  if (!arenaOpt || !boardOpt || !piecesOpt) return;   // el marco no llegó a montarse
+  const arena = arenaOpt, boardEl = boardOpt, piecesEl = piecesOpt;
@@ línea 149
-    const pieza = e.target.closest('.pu-piece');
+    const destino = /** @type {Element|null} */ (e.target);
+    const pieza = /** @type {HTMLElement|null} */ (destino?.closest('.pu-piece') ?? null);
```

### templates/puzzle/template.js (+9 −7)

```diff
@@ línea 24
+function contenidoDe(a) {
+  return /** @type {Partial<PuzzleContent>} */ (a?.content ?? {});
+}
@@ línea 75
-        get: (a) => tamanoDe(a?.content?.items?.[0]),
+        get: (a) => tamanoDe(contenidoDe(a).items?.[0]),
@@ línea 78
-          return {
-            ...a,
-            content: {
-              ...a.content,
-              items: (a.content?.items || []).map(it => ({ ...it, filas: t.filas, columnas: t.columnas })),
-            },
+          const c = contenidoDe(a);
+          const content = {
+            ...c,
+            items: (c.items || []).map(it => ({ ...it, filas: t.filas, columnas: t.columnas })),
@@ línea 84
+          return { ...a, content };
```

### templates/wheel/player.js (+9 −7)

```diff
@@ línea 9
+import { wheelRules } from './template.js';
@@ línea 19
-  const c = activity.content || {};
+  const c = /** @type {ItemsContentLegado} */ (activity.content || {});
@@ línea 34
-  const dur = clampSpinDur(activity.rules?.spinDurationMs);
-  const remove = !!activity.rules?.removeAfterSpin;
+  const rules = wheelRules(activity);
+  const dur = clampSpinDur(rules.spinDurationMs);
+  const remove = !!rules.removeAfterSpin;
@@ línea 57
-          pagina: history.length ? `Giros: ${history.length}` : null,
+          pagina: history.length ? `Giros: ${history.length}` : undefined,
@@ línea 61
-          extra: remove ? `${entries.length} sin salir` : null,
+          extra: remove ? `${entries.length} sin salir` : undefined,
@@ línea 97
-    const btnSpin = rootEl()?.querySelector('#btn-spin');
-    const btnEnd = rootEl()?.querySelector('#btn-end');
+    const btnSpin = /** @type {HTMLButtonElement|null|undefined} */ (rootEl()?.querySelector('#btn-spin'));
+    const btnEnd = /** @type {HTMLButtonElement|null|undefined} */ (rootEl()?.querySelector('#btn-end'));
```

### views/live/hostLobby.js (+9 −5)

```diff
@@ línea 14
-import { supportsLoop, defaultLoop, LOOP_LABELS, hasAdvanceChoice } from '../../core/liveLoops.js';
+import { supportsLoop, defaultLoop, LOOP_LABELS, hasAdvanceChoice, LIVE_LOOPS } from '../../core/liveLoops.js';
@@ línea 19
+const esBucle = (x) => !!x && /** @type {string[]} */ (LIVE_LOOPS).includes(x);
@@ línea 131
-    on(rt.rootSel, 'click', '.loop-pick', (_, b) => { loop = b.dataset.loop; rt.loop = loop; paintLobby(false); });
+    on(rt.rootSel, 'click', '.loop-pick', (_, b) => {
+      if (!esBucle(b.dataset.loop)) return;
+      loop = b.dataset.loop; rt.loop = loop; paintLobby(false);
+    });
@@ línea 137
-    const readEl = document.getElementById('read-secs');
-    if (readEl) readEl.onchange = (e) => { rt.readSecs = Math.max(0, Math.min(READ_SECONDS_MAX, Math.round(+e.target.value || 0))); };
+    const readEl = /** @type {HTMLInputElement|null} */ (document.getElementById('read-secs'));
+    if (readEl) readEl.onchange = () => { rt.readSecs = Math.max(0, Math.min(READ_SECONDS_MAX, Math.round(+readEl.value || 0))); };
@@ línea 166
-    on(rt.rootSel, 'click', '.kick', (_, b) => kickPlayer(rt.sessionId, b.dataset.id));
+    on(rt.rootSel, 'click', '.kick', (_, b) => kickPlayer(rt.sessionId, b.dataset.id || ''));
```

### templates/crossword/template.js (+8 −5)

```diff
@@ línea 73
-    const ws = content?.words || [];
+    const c = /** @type {WordsContent} */ (content);
+    const ws = c?.words || [];
@@ línea 78
-    if (!ws.length || ws.every(palabraColocada)) return content;
+    if (!ws.length || ws.every(palabraColocada)) return c;
@@ línea 87
-    if (opts.soloForma || ws.some(palabraColocada)) return { ...content, words: defs };
-    return { ...content, words: autoLayout(defs) };
+    const fichas = /** @type {Array<string|import('../../kernel/contracts/activity.js').CrosswordWord>} */ (defs);
+    if (opts.soloForma || ws.some(palabraColocada)) return { ...c, words: fichas };
+    return { ...c, words: autoLayout(defs) };
@@ línea 105
-    const words = (activity.content?.words || [])
+    const contenido = /** @type {CrosswordContent} */ (activity.content);
+    const words = (contenido?.words || [])
```

### views/live/hostInforme.js (+7 −6)

```diff
@@ línea 5
-import { html, escapeHtml, mount } from '../../core/html.js';
+import { html, escapeHtml, mount, $$ } from '../../core/html.js';
@@ línea 143
+    if (!out) return;   // el hueco acaba de montarse: sin él no hay informe que cablear
@@ línea 148
-    async function showTab(tab) {
-      document.querySelectorAll('.ll-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
+    const showTab = async (tab) => {
+      $$('.ll-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
@@ línea 158
-      } catch (e) { out.innerHTML = `<div class="alert alert-warning">No se pudo cargar: ${escapeHtml(e.message)}</div>`; }
-    }
-    document.querySelectorAll('.ll-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
+      } catch (e) { out.innerHTML = `<div class="alert alert-warning">No se pudo cargar: ${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`; }
+    };
+    $$('.ll-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
```

### templates/colorear/player.js (+6 −4)

```diff
@@ línea 45
-  const item = activity.content.items[0];
+  const item = /** @type {ColorearContent} */ (activity.content).items[0];
@@ línea 65
-  const raiz = document.querySelector(rootSel);
+  const raiz = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
@@ línea 75
-    colorElegido = el.dataset.hex;
-    raiz.querySelectorAll('.co-color').forEach(b => b.classList.toggle('co-color--on', b === el));
+    const hex = el.dataset.hex;
+    if (!hex) return;
+    colorElegido = hex;
+    raiz?.querySelectorAll('.co-color').forEach(b => b.classList.toggle('co-color--on', b === el));
```

### kernel/content/qaAdapt.js (+7 −2)

```diff
@@ línea 30
+function itemsQa(content) {
+  return 'items' in content && Array.isArray(content.items)
+    ? /** @type {QaItem[]} */ (content.items)
+    : [];
+}
@@ línea 94
-  const items = Array.isArray(content?.items) ? content.items : [];
+  const items = itemsQa(content);
@@ línea 156
-  const items = Array.isArray(content?.items) ? content.items : [];
+  const items = itemsQa(content);
```

### templates/math/scorer.js (+7 −2)

```diff
@@ línea 12
+function claveDe(item) {
+  if (!item || typeof item !== 'object' || !('answer' in item)) return null;
+  return item.answer;
+}
@@ línea 28
-  if (item.answer == null || item.answer === '') return { correct: null, points: 0, hits: 0, total: 0 };
-  const v = normNum(value), a = normNum(item.answer);
+  const answer = claveDe(item);
+  if (answer == null || answer === '') return { correct: null, points: 0, hits: 0, total: 0 };
+  const v = normNum(value), a = normNum(answer);
```

### templates/wheel/template.js (+7 −2)

```diff
@@ línea 11
+export const wheelRules = (activity) => /** @type {WheelRules} */ (activity.rules || {});
@@ línea 68
-  static migrateContent(content) { return migrateLegacyItems(content); }
+  static migrateContent(content) {
+    return migrateLegacyItems(/** @type {import('../../core/contentModels/items.js').ItemsContentLegado} */ (content));
+  }
@@ línea 78
-  static getRoundPayload(activity, { itemIndex }) { return itemRoundPayload(activity, itemIndex); }
+  static getRoundPayload(activity, { itemIndex }) {
+    return itemRoundPayload(/** @type {import('../../kernel/contracts/activity.js').Activity<ItemsContent>} */ (activity), itemIndex);
+  }
```

### templates/ballsort/scorer.js (+5 −3)

```diff
@@ línea 21
-export function scoreBallsort({ value, item, activity } = {}) {
-  const v = value || {};
-  const mode = item?.mode || activity?.content?.mode || activity?.rules?.mode || 'moves';
+export function scoreBallsort({ value, item, activity }) {
+  const v = /** @type {Partial<BallsortSnapshot>} */ (value && typeof value === 'object' ? value : {});
+  const puzle = /** @type {{mode?: string}} */ (item && typeof item === 'object' ? item : {});
+  const contenido = /** @type {{mode?: string}} */ (activity?.content ?? {});
+  const mode = puzle.mode || contenido.mode || activity?.rules?.mode || 'moves';
```

### templates/globos/template.js (+4 −4)

```diff
@@ línea 71
-    const item = activity.content.items[ctx.itemIndex];
+    const item = (/** @type {QaContent} */ (activity.content)).items[ctx.itemIndex];
@@ línea 92
-      ${balloonFieldHtml(payload?.options || [])}
+      ${balloonFieldHtml(Array.isArray(payload?.options) ? payload.options : [])}
@@ línea 95
-      root.querySelectorAll('.gl-balloon').forEach(b => { b.disabled = true; });
+      root.querySelectorAll('.gl-balloon').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
@@ línea 104
-  static migrateContent(content) { return stripSeededPoints(content); }
+  static migrateContent(content) { return stripSeededPoints(/** @type {C & {items?: unknown}} */ (content)); }
```

### templates/math/player.js (+5 −3)

```diff
@@ línea 23
-  runSequentialPlayer(rootSel, activity, opts, {
-    renderItem({ rootSel, activity, item, idx, total, score, submit }) {
+  const callbacks = {
+    renderItem({ rootSel, activity, item, idx, total, submit }) {
@@ línea 32
+      if (!roundEl) return;
@@ línea 46
-  });
+  };
+  runSequentialPlayer(rootSel, activity, opts, callbacks);
```

### templates/math/template.js (+6 −2)

```diff
@@ línea 50
-  static getRoundPayload(activity, ctx) { const it = activity.content.items[ctx.itemIndex]; return it ? { question: it.question } : null; }
+  static getRoundPayload(activity, ctx) {
+    const content = /** @type {QaContent} */ (activity.content);
+    const it = content.items[ctx.itemIndex];
+    return it ? { question: it.question } : null;
+  }
@@ línea 70
-  static migrateContent(content) { return stripSeededPoints(content); }
+  static migrateContent(content) { return stripSeededPoints(/** @type {C & {items?: unknown}} */ (content)); }
```

### templates/question-live/template.js (+6 −2)

```diff
@@ línea 55
-  static migrateContent(content) { return migrateLegacyItems(content); }
+  static migrateContent(content) {
+    return migrateLegacyItems(/** @type {ItemsContent} */ (content));
+  }
@@ línea 66
-  static getRoundPayload(activity, { itemIndex }) { return itemRoundPayload(activity, itemIndex); }
+  static getRoundPayload(activity, { itemIndex }) {
+    return itemRoundPayload(/** @type {import('../../kernel/contracts/activity.js').Activity<ItemsContent>} */ (activity), itemIndex);
+  }
```

### views/live/hostCarrera.js (+4 −4)

```diff
@@ línea 45
-      const pid = a.playerId || a.player_id;
-      if (!prog[pid]) continue;
+      const avance = prog[a.playerId];
+      if (!avance) continue;
@@ línea 55
-        prog[pid].items.add(a.itemIndex);
+        avance.items.add(a.itemIndex);
@@ línea 105
-      const btn = document.getElementById('btn-end-race');
+      const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-end-race'));
```

### kernel/content/sessionItems.js (+5 −2)

```diff
@@ línea 24
-  const c = activity?.content || {};
+  const c = /** @type {Record<string, unknown>} */ (activity?.content || {});
@@ línea 31
-  for (const k of ITEM_KEYS) if (c[k] != null) return c[k];
+  for (const k of ITEM_KEYS) {
+    const v = c[k];
+    if (v != null) return Array.isArray(v) ? v : [];
+  }
```

### templates/crossword/scorer.js (+6 −1)

```diff
@@ línea 11
+function claveDe(item) {
+  if (!item || typeof item !== 'object') return null;
+  if ('word' in item && item.word != null) return item.word;
+  return ('answer' in item) ? item.answer : null;
+}
@@ línea 27
-  const want = norm(item?.word ?? item?.answer);
+  const want = norm(claveDe(item));
```

### templates/puzzle/scorer.js (+4 −2)

```diff
@@ línea 19
-  const total = Math.max(1, value?.total || (item ? (item.filas || 1) * (item.columnas || 1) : 1));
-  const hits = Math.max(0, Math.min(total, value?.encajadas ?? 0));
+  const v = /** @type {ValorPuzzle} */ (value && typeof value === 'object' ? value : {});
+  const it = /** @type {{filas?: number, columnas?: number}} */ (item && typeof item === 'object' ? item : {});
+  const total = Math.max(1, v.total || (item ? (it.filas || 1) * (it.columnas || 1) : 1));
+  const hits = Math.max(0, Math.min(total, v.encajadas ?? 0));
```

### views/live/hostPalabra.js (+4 −2)

```diff
@@ línea 47
-    const qlImage    = qlOpen !== null ? (rt.items[qlOpen]?.image || null) : null;
+    const itemAbierto = qlOpen !== null ? rt.items[qlOpen] : null;
+    const campos     = /** @type {Record<string, unknown>} */ (itemAbierto && typeof itemAbierto === 'object' ? itemAbierto : {});
+    const qlImage    = typeof campos.image === 'string' && campos.image ? campos.image : null;
@@ línea 99
-      const points    = +btn.dataset.pts;
+      const points    = Number(btn.dataset.pts);
```

### core/playOptions.js (+3 −1)

```diff
@@ línea 129
-  for (const btn of root?.querySelectorAll('.ww-playopt-btn') || []) {
+  if (!root) return;
+  for (const el of root.querySelectorAll('.ww-playopt-btn')) {
+    const btn = /** @type {HTMLElement} */ (el);
```

### templates/diagram/scorer.js (+2 −1)

```diff
@@ línea 12
-  const correct = String(value) === String(item?.id ?? '');
+  const pin = /** @type {{id?: string}|null} */ (item && typeof item === 'object' ? item : null);
+  const correct = String(value) === String(pin?.id ?? '');
```

### templates/match/scorer.js (+2 −1)

```diff
@@ línea 14
-  const correct = String(value) === String(item?.right ?? '');
+  const par = item && typeof item === 'object' ? /** @type {{right?: unknown}} */ (item) : null;
+  const correct = String(value) === String(par?.right ?? '');
```

### templates/memory/scorer.js (+2 −1)

```diff
@@ línea 13
-  const correct = !!item?.id && String(value) === String(item.id);
+  const par = item && typeof item === 'object' ? /** @type {{id?: unknown}} */ (item) : null;
+  const correct = !!par?.id && String(value) === String(par.id);
```

### templates/quiz/scorer.js (+2 −1)

```diff
@@ línea 14
-  const ok = isCorrect(item, value);
+  if (!item || typeof item !== 'object') return { correct: null, points: 0, hits: 0, total: 0 };
+  const ok = isCorrect(/** @type {import('../../kernel/contracts/activity.js').QaItem} */ (item), value);
```

### templates/tangram/scorer.js (+2 −1)

```diff
@@ línea 29
-  const resuelto = !!value?.resuelto;
+  const v = /** @type {ValorTangram} */ (value && typeof value === 'object' ? value : {});
+  const resuelto = !!v.resuelto;
```

### templates/wordsearch/scorer.js (+2 −1)

```diff
@@ línea 24
-  const words = (activity.content?.words || []).map(norm);
+  const c = /** @type {import('../../kernel/contracts/activity.js').WordsContent} */ (activity.content);
+  const words = (c?.words || []).map(norm);
```

### templates/colorear/scorer.js (+1 −1)

```diff
@@ línea 26
-  const v = value || {};
+  const v = /** @type {ValorColorear} */ (value && typeof value === 'object' ? value : {});
```

### templates/match/template.js (+1 −1)

```diff
@@ línea 66
-    const pairs = activity.content?.pairs || [];
+    const pairs = /** @type {PairsContent} */ (activity.content)?.pairs || [];
```

### templates/memory/template.js (+1 −0)

```diff
@@ línea 11
+export const memoryRules = (activity) => /** @type {MemoryRules} */ (activity.rules || {});
```
