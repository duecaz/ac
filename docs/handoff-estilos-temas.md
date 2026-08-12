# Plan · Estandarizar TEMAS (skins) y FONDOS — quién pinta qué, quién gana y cómo se garantiza el contraste

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> Decidido con el dueño el 2026-08-12, a raíz de dos hallazgos de la misma semana:
> el enunciado ilegible sobre una foto (resuelto con la placa, v1.51.450) y el
> reporte «algunos fondos son muy oscuros y no se ven las letras» (prueba 10 de la
> ronda del compañero, aún sin datos). Los dos son el MISMO defecto de diseño:
> los fondos no declaran nada, así que la legibilidad depende de parches caso a caso.

## 0 · Cómo está hoy (diagnóstico)

Dos ejes independientes, bien desacoplados en módulos (§3):

| Eje | Módulo dueño | Qué declara hoy | Contrato |
|---|---|---|---|
| **Tema (skin)** | `core/skins.js` | `cssVars` con TODOS los tokens `--ww-*` (lista canónica = skin `default`) | ✅ `core/skinContract.js` + `tests/skins.test.mjs` |
| **Fondo** | `core/backgrounds.js` + `styles/backgrounds.css` | solo `label` y `description`; la textura vive en CSS | ❌ ninguno |

Los problemas nacen todos del segundo eje:

1. **Fondos oscuros con colores a pelo**: `bg-blackboard`/`bg-greenboard` fijan
   `color: #f5f5dc` y hasta `.card { background: … }` con hex directos — un fondo
   pintando COMPONENTES, que es terreno del skin. Es la fuente más probable del
   hallazgo 10 (letras ilegibles con fondos oscuros en VS/Equipos: el fondo pone
   tinta clara u oscura por su cuenta y el skin no se entera).
2. **La placa de legibilidad existe SOLO para `bg-custom`** (v1.51.450). Corcho,
   aula, arena o estrellado son texturas «ruidosas» que la necesitarían igual — hoy
   dependen de que su hex hardcodeado acierte.
3. **El contraste se vigila al final del túnel** (la matriz mide «se lee a 3 m» en
   headless), pero no en el ORIGEN: nada impide registrar un skin cuyo ámbar con
   letra blanca dé 2.4:1 — se descubre al correr la matriz, no al declararlo.
   Ya pasó dos veces (ámbar del Kahoot-grid, etiquetas del diagrama).

## 1 · Las reglas que se fijan (la respuesta a «¿gana fondo o tema?»)

**R1 — Cada eje tiene su terreno y NO pisa el del otro:**
- El **TEMA** pone la **paleta completa**: todos los tokens `--ww-*` con que se
  pintan los componentes (tarjetas, opciones, aciertos, formas…).
- El **FONDO** pone el **lienzo**: la textura y DOS tokens propios, nada más:
  - `--ww-bg-ink` — la tinta legible para texto suelto directamente sobre su textura;
  - la marca de si necesita **placa** (ver R2).
- Prohibiciones (entran a `leyes.md` §3 como cuadro dueño→PROHIBIDO):
  - un fondo NUNCA define tokens de skin ni estila componentes (los `.card {…}` de
    blackboard/greenboard se migran);
  - un skin NUNCA pinta texturas;
  - una actividad NUNCA lee la clase `bg-X` (solo consume tokens).

**R2 — La victoria no es por orden de carga sino por CERCANÍA al píxel:**

```
veredicto (verde/rojo)  >  placa/tarjeta (--ww-card-*)  >  tinta del fondo (--ww-bg-ink)  >  paleta base del skin
```

- Texto DENTRO de una tarjeta/placa → tinta del **skin** (`--ww-card-fg`). El fondo no existe para él.
- Texto SUELTO sobre el lienzo → tinta del **fondo** (`--ww-bg-ink`). El skin no puede saber si el lienzo es claro u oscuro.
- El veredicto (acierto/error) gana a todo — ya es ley (0-4-0 sin `!important`).
- El orden de aplicación en JS (skin primero, fondo después, `core/presentation.js`) queda como está: es irrelevante porque ya no compiten por las mismas propiedades.

**R3 — La placa deja de ser un parche de `bg-custom` y pasa a ser una PROPIEDAD del fondo:**
cada fondo declara `plate: true|false` en su manifest (`BACKGROUNDS`):
- `plate: true` → foto del profe (**custom**: siempre, es incontrolable), corcho, aula, arena, estrellado — texturas con varianza donde ninguna tinta plana es fiable.
- `plate: false` → los lisos (papel, cuadrícula, cuaderno, pizarras): basta `--ww-bg-ink`.
- `applyBackground()` añade la clase `bg-plated` cuando el manifest lo pide; el CSS
  de la placa (hoy `.bg-custom …`) pasa a colgar de `bg-plated`. Un fondo nuevo
  elige su modo de legibilidad DECLARÁNDOLO, no escribiendo CSS nuevo.

**R4 — Ningún color pintable sin su pareja de tinta:**
todo token de skin que lleve texto encima tiene su `-fg` (`--ww-shape-3` ⇒
`--ww-shape-3-fg`). Ya es el patrón de Globos/Kahoot-grid/diagram; se vuelve
obligatorio en el contrato. Y cada fondo con `plate:false` declara un `colorBase`
(hex representativo de su textura) para poder VERIFICAR su `--ww-bg-ink`.

## 2 · Cómo se garantiza el contraste — TRES niveles, del origen a la red final

1. **Computado en CI sobre los manifests** (nuevo, el que falta): los valores de
   `core/skins.js` y `BACKGROUNDS` son hex conocidos → el ratio WCAG se calcula en
   Node puro, sin navegador. Test nuevo `tests/contrast.test.mjs`:
   - por cada skin: cada par `token`/`token-fg` da **≥ 4.5:1**;
   - por cada fondo `plate:false`: `--ww-bg-ink` contra `colorBase` da **≥ 4.5:1**;
   - contra-prueba: un skin de juguete con ámbar+blanco (2.4:1) es RECHAZADO.
   Con esto, los dos bugs de contraste que ya tuvimos habrían muerto en CI al
   declararse, no en la pizarra.
2. **Placa donde no se puede garantizar** (R3): fotos y texturas ruidosas no se
   «resuelven» con una tinta — se les pone lienzo propio (tokens de tarjeta). Es lo
   que ya validó la captura del dueño.
3. **Medido en headless como red final**: la matriz ya calcula «se lee a 3 m» con
   estilos computados. Se le añade UNA pasada de tortura con la peor combinación
   declarada (skin más oscuro × fondo más oscuro) para cazar lo que los manifests
   no ven (opacidades, sombras, imágenes).

## 3 · Qué DEBE contener cada uno (el estándar, resumido)

| | Tema (skin) | Fondo |
|---|---|---|
| Identidad | `name`, `label` | clave en `BACKGROUNDS`, `label`, `description` |
| Pinta | `cssVars` = set canónico COMPLETO (contrato actual) **+ pareja `-fg` de todo token con texto** | textura CSS (`styles/backgrounds.css`) |
| Legibilidad | pares con ratio ≥4.5:1 (verificado en CI) | `plate: true` **o** (`--ww-bg-ink` + `colorBase` con ratio ≥4.5:1) |
| Prohibido | texturas; estilar por clase de fondo | tokens de skin; estilar componentes (`.card`, `color:` global) |

## 4 · Fases de ejecución (cada una committeable y verde por sí sola)

- **F1 · Manifest + placa genérica** — `BACKGROUNDS` gana `plate`/`ink`/`colorBase`;
  `applyBackground()` aplica `bg-plated`; el CSS de la placa se cuelga de
  `bg-plated` (custom incluido); los `color:`/`.card` hardcodeados de
  blackboard/greenboard migran a `--ww-bg-ink` + placa. *Resuelve por diseño el
  hallazgo 10 sin esperar sus datos.*
- **F2 · Contrato ejecutable** — `tests/contrast.test.mjs` (ratio WCAG en Node) +
  ampliar `skinContract`/nuevo `bgContract` con los campos de arriba; ambos corren
  también en `#/admin` (patrón de siempre). Contra-prueba obligatoria.
- **F3 · Tortura en la matriz** — pasada skin-oscuro × fondo-oscuro del punto 2.3.
- **F4 · Ley escrita** — cuadro §3 en `leyes.md` (dueño→prohibido→test) +
  actualizar `estilos-de-actividad.md`; este handoff pasa a `docs/historico/` al
  terminar.

Riesgo principal: fondos aplicados a `<body>` en vistas inmersivas (tarea/en vivo)
comparten reglas con el marco del profe — al migrar blackboard/greenboard hay que
re-verificar las DOS pantallas (el preflight cubre ambas rutas). Nada de esto toca
contenido ni datos: es 100 % presentación.
