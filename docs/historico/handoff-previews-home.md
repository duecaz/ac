# HANDOFF — Previews del HOME: contrato por plantilla, esquemas faltantes, centrado y rendimiento

> 🗄️ **HISTÓRICO — EJECUTADO (Fases 1-2b).** Se archivó en v1.51.424 al consolidar la
> documentación: el preview del home lo pinta `core/homePreview.js`, vigilado por `tests/homePreview.test.mjs`.
> Se conserva porque explica **por qué** se hizo así, que es lo que un plan
> terminado sigue valiendo. **No es trabajo pendiente.**

> ## ✅ EJECUTADO (v1.51.200) — lo hecho y lo que queda
> - **Fase 2 (HECHO):** las 13 plantillas tienen esquema propio en `core/homePreview.js`
>   (nuevos: wheel/ruleta, wordsearch/sopa, crossword/crucigrama, ballsort/pelotas,
>   globos, question-live/abre-cajas; memory refleja nº de pares). **0 respaldos
>   genéricos.** Verificado headless (13 tarjetas, captura grid).
> - **Fase 3 (HECHO + BUG DE CENTRADO CORREGIDO DE RAÍZ, v1.51.202):** el centrado
>   ≤6px que se midió antes era solo en el eje VERTICAL. En HORIZONTAL, quiz/comas/tildes
>   y memory salían corridos a la IZQUIERDA (medido headless: dx quiz −10px, texto −16px,
>   memory −39px). Causa GENERAL (no un fallo por plantilla): `.pv` está en
>   `position:absolute; inset:0` (left:0+right:0) y varios esquemas fijan `width:<100%`
>   sobre ESE mismo elemento (quiz 86%, texto 82%, memory 68%); al sobre-restringir, el
>   navegador ignora `right:0` y ancla el bloque a la izquierda. **Fix de raíz (una línea):
>   `margin:auto` en la regla base `.pv`** — reparte el hueco a ambos lados, así CUALQUIER
>   esquema (actual o futuro) que acote su ancho queda centrado sin parche por plantilla.
>   Verificado headless para las 13: dx=0 en todas; dy dentro de ±6px (los −5.5 de la
>   ruleta y +5.3 de memory son artefactos de la aguja decorativa/rejilla casi a tope, no
>   descentrado real — el disco y la rejilla SÍ están centrados).
> - **Fase 4·1 (HECHO):** memoización `id:updatedAt → html` (LRU 300) en el dispatcher.
> - **"Si es norma, es test" (HECHO, variante):** en vez de migrar a un método por
>   plantilla (`cardPreviewHtml`), se mantuvo el switch central PERO con un test que
>   garantiza 0 genéricos: `tests/homePreview.test.mjs` (lista canónica desde
>   `templates/`). Decisión de altitud pragmática: el switch es chrome decorativo, y el
>   test cierra el agujero de drift (una plantilla nueva sin esquema falla en CI).
>   *(Si se prefiere el método por plantilla en el futuro, la Fase 1 de abajo sigue válida.)*
> - **Fase 2b (HECHO, v1.51.201):** el preview respeta el TEMA/FONDO de la actividad.
>   `previewBgStyle(presentation)` en `core/homePreview.js` (fondo elegido > skin > neutro)
>   pinta el `.acard-preview` inline desde `views/home.js card()`. Fondos por textura en el
>   mapa `BG_REPR` (notebook/blackboard/greenboard/paper/grid/corkboard/classroom/arena/stars,
>   color/gradiente dominante); skins vía `getSkin().bgImage||--ww-bg`; `custom` (imagen
>   propia) se omite a propósito (data-URL por tarjeta). Legibilidad resuelta con pastilla
>   clara (`rgba(255,255,255,.85)`) en `.pv-quiz__q` y `.pv-text__line` → texto legible sobre
>   CUALQUIER fondo. Verificado headless con blackboard/stars/grid/classroom + skins
>   retro/arcade (oscuros): todo legible, el fondo se ve. La memoización `id:updatedAt` se
>   invalida sola al cambiar la presentación (`save()` refresca `updatedAt`).
>
> ## 🎨 DEUDA DE DISEÑO (aparcada a propósito — la retoma un DISEÑADOR a futuro)
> Decisión del usuario (2026-07): lo FUNCIONAL de los previews está cerrado (13 esquemas,
> 0 genéricos, tema/fondo respetado, centrado correcto de raíz). El PULIDO VISUAL de cada
> esquema se deja como deuda para que un diseñador lo haga bien, sin bloquear el resto. Qué
> falta y cómo entrarle:
> - **Fase 2c — SVGs diseñados por plantilla:** los esquemas de `core/homePreview.js` son
>   PLACEHOLDER programáticos. El pipeline de integración está listo y documentado en
>   **`docs/svg-previews-guia.md`** (lienzo `viewBox 0 0 320 150`, fondo transparente porque
>   la Fase 2b ya pinta el tema detrás, <10 KB, sin `<script>`, colores recolorables a
>   `var(--soft-*)`). Cada SVG entregado SUSTITUYE al esquema de su plantilla en el `build()`
>   central; el resto sigue igual. Entrega: pegado en chat o commit en
>   `assets/card-previews/<template>.svg` (el usuario tiene `gh` en Windows).
> - **Nivel de acabado objetivo:** que cada preview se entienda de un vistazo y esté al
>   nivel del de Emparejar (composición centrada, 2-4 colores de paleta, formas redondeadas).
>   Iterar con capturas headless (montar → screenshot → ajustar). Ver Fase 2 "MODO DISEÑADOR".
> - **NO tocar sin diseñador:** afinar a mano colores/proporciones de los esquemas actuales
>   es justo lo que se aparca; el contrato (Fase 1) y el test de 0-genéricos siguen protegiendo
>   que ninguna plantilla se quede sin preview.
>
> ## 🔧 DEUDA TÉCNICA (no visual, pendiente)
> - **Fase 4·2 (filtrar sin re-montar):** NO hecho. La memoización ya abarata el re-paint por
>   tecleo; el refactor de `paint()` (pintar la rejilla una vez y alternar `hidden` por tarjeta)
>   queda como mejora de rendimiento aparte.
>
> ---
> **Estado original:** PLAN aprobado por el usuario.
> Contexto: el usuario reporta que en "Mis actividades" (1) algunos previews no están
> centrados, (2) varias plantillas NI tienen preview (cae el respaldo genérico icono+nombre),
> y (3) quiere que carguen más rápido.

## Quién hace qué HOY
- `views/home.js card()` → llama `homePreviewHtml(a)`.
- `core/homePreview.js` → **switch central** por `a.template`: match, diagram, math,
  quiz, comas/tildes, memory. Todo lo demás → `genericPv` (icono + label teñidos).
- `styles/home.css` → estilos `.pv-*` (chrome, EXCLUIDO del ratchet).
- Ya señalado por la revisión /simplify (agente de altitud): el switch central es la
  anti-norma del proyecto — para la miniatura real ya existe el contrato por plantilla
  `static previewHtml` test-enforced justamente para "no tener un switch que olvidar".

## FASE 1 — Contrato por plantilla (fix de altitud)
1. Crear `core/cardPreviewKit.js` con los helpers compartidos (esc/et/trunc, paleta soft,
   builders actuales movidos desde homePreview.js).
2. Cada plantilla declara **`static cardPreviewHtml(act)`** en `templates/<t>/template.js`
   (las 13). Las 6 existentes se MUEVEN; las 7 sin esquema reciben uno (Fase 2).
   ⚠️ Nombrar distinto del contrato existente: `cardPreviewHtml` (esquema ligero del home)
   vs `previewHtml` (render real 1280×800 de activityThumb) — ambos conviven.
3. `core/homePreview.js` queda como dispatcher fino: `T.cardPreviewHtml?.(a)` con
   try/catch → fallback `genericPv` (se mantiene ahí, solo como último recurso).
4. **Si es norma, es test**: `core/templateContract.js` exige `cardPreviewHtml` función
   que devuelva string no vacío con el `defaultContent()` de la plantilla;
   `tests/templateContract.test.mjs` lo cubre solo. `tools/new-template.mjs` debe emitir
   un stub en el esqueleto (o `tests/newTemplate.test.mjs` fallará — verificarlo).

## FASE 2 — Esquemas nuevos (≤20 nodos, sin imágenes, sin animación, colores por --soft-* / paleta ROPES)
**MODO DISEÑADOR (pedido por el usuario):** esta fase se ejecuta con vocación
visual, no solo funcional. Usar `docs/svg-previews-guia.md` como brief (lienzo,
paleta, estilo redondeado) y **ITERAR con capturas headless** (montar → screenshot
→ ajustar → screenshot) hasta que cada preview esté al nivel del de Emparejar.
Puede hacerse con subagentes de diseño en paralelo (uno por plantilla) revisados
por el orquestador. Criterio de aceptación visual: composición centrada, 2-4
colores de la paleta, formas redondeadas, y que el juego se entienda de un
vistazo. El usuario puede sustituir cualquiera con su propio SVG (Fase 2c).
- **wheel (Ruleta)**: SVG rueda de 8 sectores de color + aguja arriba.
- **wordsearch (Sopa de Letras)**: rejilla 5×5 de letras (usar letras de `content.words`),
  una palabra resaltada en color.
- **crossword (Crucigrama)**: rejilla con celdas blancas/negras y 2-3 letras puestas.
- **ballsort (Ordena las Pelotas)**: 3 tubos con bolas de colores, uno incompleto.
- **globos (Explota Globos)**: 4-5 globos de color con cuerdas + pregunta corta arriba.
- **question-live ("Abre Cajas" — VERIFICAR label real en registry)**: 6 cajas 3×2,
  una abierta con estrella/premio.
- memory ya existe: revisar que refleje contenido real (nº cartas = min(items·2, 8)).

## FASE 2b — El preview respeta el TEMA y el FONDO de la actividad
Hoy el marco del preview es blanco/neutro: una actividad con skin "Retro" o fondo
"Pizarra" se ve igual que una default. Fix BARATO, sin render del juego:
- `getSkin(a.presentation?.skin)` (core/skins.js) y el manifiesto de
  `core/backgrounds.js` ya exponen colores/gradientes (`--ww-bg`, `bgImage`) — son
  los mismos que pintan las fichas del picker en playerView. Aplicar ese fondo al
  `.acard-preview` como estilo inline. Prioridad: fondo elegido > skin > blanco.
- Legibilidad: los esquemas usan chips/piezas con fondo propio → legibles sobre
  oscuro; VERIFICAR en headless con skin oscuro (retro/arcade) que nada se pierde.
- La memoización de Fase 4 sigue válida: `save()` actualiza `updatedAt` al cambiar
  la presentación → la clave `id:updatedAt` invalida sola.

## FASE 2c — Previews DISEÑADOS por el usuario (pipeline de integración)
**Guía completa de diseño/entrega: `docs/svg-previews-guia.md`** (brief por plantilla,
paleta, export, checklist). Los esquemas de Fase 2 son PLACEHOLDER: un SVG del
usuario sustituye al de su plantilla cuando llegue — sin bloquear el resto del plan.
Contrato de entrega (resumen):
- Lienzo `viewBox="0 0 320 150"` + `preserveAspectRatio="xMidYMid meet"` (marco de
  150px de alto, ancho fluido ~260-380px). Fondo TRANSPARENTE (Fase 2b pinta detrás).
- Sin fuentes externas (texto→trazados o tipografía del sistema), sin rasters
  embebidos; objetivo <10 KB por SVG. Un archivo por plantilla.
- Entrega: pegado en el chat O commit en `assets/card-previews/<template>.svg`
  (el usuario tiene gh en Windows).
- Integración (la hace Claude): sanitizar (metadata del editor, ids/clases que
  colisionen, nada de <script>), tokenizar colores recolorables a var(--soft-*)
  cuando aporte, e INLINE como string en el `cardPreviewHtml` de esa plantilla —
  NUNCA `<img src>` (evita un fetch por tarjeta y permite recolor por CSS).
- Un SVG diseñado SUSTITUYE al esquema programático de Fase 2 para esa plantilla;
  el contrato de Fase 1 no cambia (el método devuelve el SVG).

## FASE 3 — Centrado / diagramación
- Regla única `.pv` (position absolute inset:0, flex center, padding 12px, overflow hidden)
  y auditar cada `.pv-*` para centrado óptico del bloque interior.
- **Criterio medible (headless)**: |centroY(contenido) − centroY(preview)| ≤ 6px con
  anchos de tarjeta 260px y 380px. Igual en X.
- `textPv` (comas/tildes): frase con line-clamp 2 líneas; frase+regla+botón como un
  solo bloque compacto centrado (hoy queda aire desigual).
- Tras Fases 1-2, `genericPv` NO debe verse para ninguna de las 13 (test lo garantiza).

## FASE 4 — Rendimiento
1. **Memoizar** el HTML del preview: Map módulo `id:updatedAt → html` con tope LRU ~200,
   en el dispatcher (el esquema es string puro → cache trivial).
2. **Filtrar sin re-montar**: hoy `paint()` re-monta TODA la rejilla en cada tecleo (y
   obligó al hack de re-focus del buscador). Cambiar a: pintar la rejilla UNA vez y en
   `oninput` solo alternar `hidden` en cada `.acard` (title/tags pre-normalizados en
   dataset). El foco deja de perderse por construcción; coste por tecleo = O(n) toggles.
   `paint()` completo queda solo para cambios de datos (import/borrar/sync).
3. `diagram`: `<img decoding="async">` (loading="lazy" ya está). Es el único preview
   con imagen (data-URL) — no re-escapar (ya resuelto en v1.51.185).
4. Opcional si aún hiciera falta: `content-visibility:auto` en `.acard` +
   `contain-intrinsic-size` (150px de preview + cuerpo).

## Verificación obligatoria
- `node tests/run.mjs` verde (incluye el contrato nuevo).
- Headless (receta docs/testing.md, servir por localhost): sembrar 13 actividades
  (una por plantilla con su `defaultContent()`), captura a 1440px y 390px:
  0 respaldos genéricos, centrado ≤6px, filtro por tecleo mantiene foco.
- Actualizar CLAUDE.md (nota: homePreview → contrato `cardPreviewHtml`) y el mapa
  `docs/sistema-de-plantillas.md`.
- VERSION bump en cada commit + push a `main` (sirve aulareto.com) y ACTIVIDAD2. TODO AL MAIN.

## Riesgos / notas
- NO tocar `previewHtml`/`core/activityThumb.js` (otro contrato, otros usos).
- El ratchet de estilos excluye `home.css` (chrome) — sin cambios en styles.test.mjs.
- Bootstrap-CDN está bloqueada en el sandbox headless: los iconos bi-* salen en blanco
  en capturas locales; no es un bug (en aulareto.com cargan).
