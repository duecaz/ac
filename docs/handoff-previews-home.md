# HANDOFF — Previews del HOME: contrato por plantilla, esquemas faltantes, centrado y rendimiento

> **Para:** próxima sesión (Opus 4.8). **Estado:** PLAN aprobado por el usuario, sin ejecutar.
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
El usuario quiere diseñar a mano algunos previews (p.ej. Abre Cajas). Contrato de entrega:
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
