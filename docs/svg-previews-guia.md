# Guía — Diseñar previews SVG para las tarjetas del home (Fase 2c)

> Para el usuario (diseña en Windows) y para Claude (integra). El plan general
> vive en `docs/handoff-previews-home.md`; esto es el brief de diseño + entrega.

## Lienzo y exportación
- **viewBox="0 0 320 150"**, `preserveAspectRatio="xMidYMid meet"`. Diseña a 320×150.
- **Fondo TRANSPARENTE** — detrás se pinta el tema/fondo de la actividad (Fase 2b),
  así que comprueba tu diseño sobre blanco Y sobre oscuro (`#141c2e`).
- Margen de seguridad: ~12px sin contenido en los bordes.
- **Texto → trazados** (Figma: outline text · Illustrator: Crear contornos ·
  Inkscape: Objeto a trayecto). Mejor aún: evita palabras reales, el preview no
  las necesita.
- **Prohibido**: imágenes raster embebidas (PNG/JPG), `<script>`, fuentes externas,
  y filtros SVG de sombra (`feDropShadow` colapsa con bbox degenerado — bug ya
  sufrido en las cuerdas; si quieres sombra, dibuja un trazo desplazado).
- Peso objetivo **<10 KB**. Exporta "SVG optimizado/plano":
  Figma → Export SVG (outline text ON, include id OFF) ·
  Illustrator → Guardar como SVG (atributos de presentación) ·
  Inkscape → Guardar como "SVG optimizado".

## Paleta de la familia AulaReto
- Vivos: verde `#16a34a` · rojo `#ef4444` · azul `#2563eb` · ámbar `#f59e0b` ·
  cian `#0891b2` · morado `#8b5cf6` · teal `#14b8a6`
- Suaves (rellenos): `#e8f6ee` `#fdeaea` `#e7f0fe` `#fef3e2` `#e2f8fb` `#eef2ff` `#f5f3ff`
- Tinta: `#141c2e`. Estilo: esquinas redondeadas (rx 6-10), trazos 3-4px con
  `stroke-linecap="round"` — como la cuerda de Emparejar.

## Brief por plantilla (una idea clara, sin saturar)
| archivo | dibujo |
|---|---|
| `question-live.svg` (Abre Cajas) | 6 cajas 3×2 cerradas, UNA abierta con destello/estrella |
| `wheel.svg` (Ruleta) | rueda de 8 sectores de color + aguja arriba |
| `wordsearch.svg` (Sopa) | rejilla 5×5 de letras, una palabra resaltada en cápsula |
| `crossword.svg` (Crucigrama) | cuadrícula blanca/negra con 2-3 letras |
| `ballsort.svg` (Ordena las Pelotas) | 3 tubos con bolas de color, uno a medio ordenar |
| `globos.svg` (Explota Globos) | 4-5 globos con cuerda, uno explotando (estrellitas) |
| (opcionales) `match/quiz/math/diagram/comas/tildes/memory.svg` | ya tienen esquema; rediseña solo si quieres superarlo |

Los nombres son el NOMBRE INTERNO del template (carpeta en `templates/`).

## Entrega
- Opción A: pegar el código SVG en el chat de Claude.
- Opción B (PowerShell, con gh ya autenticado):
  ```powershell
  git checkout main; git pull
  mkdir assets/card-previews -ea 0
  # copia ahí tus .svg y luego:
  git add assets/card-previews; git commit -m "SVGs previews home"; git push
  ```
- **Integración (la hace Claude, no editar a mano las plantillas):** sanitiza
  (metadata del editor, ids colisionantes), tokeniza colores si aporta, e inserta
  el SVG INLINE en el `cardPreviewHtml` de esa plantilla. Nunca `<img src>`.
- Un SVG entregado SUSTITUYE al esquema programático de esa plantilla.

## Checklist antes de entregar
[ ] viewBox 320×150 · [ ] fondo transparente · [ ] texto en trazados ·
[ ] <10 KB · [ ] sin raster/filtros/script · [ ] legible sobre `#141c2e`
