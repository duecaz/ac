---
name: entregar
description: El ritual de entrega del proyecto — versión, regenerados, preflight, revisión, sonda, docs y push a las tres ramas. Úsalo al terminar CUALQUIER cambio, antes de decir «hecho».
---

# /entregar — el ritual de entrega

CLAUDE.md prometía este skill desde hace versiones y no existía en el repo: el
ritual vivía en la memoria, que es donde los rituales se pudren. Aquí está
escrito. Los pasos van EN ESTE ORDEN; ninguno es opcional salvo donde se dice.

## 1. Versión
- Sube `VERSION` en `core/constants.js` (patch: `1.51.622` → `1.51.623`).
  Nunca hacia atrás. UNA subida por commit.

## 2. Regenerados (los docs que salen del código)
```
node tools/stamp-assets.mjs     # sella los HTML con la versión nueva
node tools/module-map.mjs       # docs/arquitectura-modulos.md
node tools/docgen.mjs           # cuadros de modos/bucles en los MD
node tools/tokens.mjs           # docs/tokens.md
```
Si el cambio tocó piezas o conversiones: `node tools/piezas.mjs` y
`node tools/conversiones.mjs --md`.

## 3. Preflight — la puerta
```
node tools/preflight.mjs        # 12 redes, ~350 s
```
La red `basura` (`tools/auditoria.mjs`) incluye los seis barridos de costuras
(§31/`docs/handoff-costuras.md`), cada uno con su baseline: si tocas una
declaración, un método del contrato o un ajuste de sala, este paso lo cubre.
- `--rapido` (solo suites) vale ÚNICAMENTE para cambios de lógica pura que no
  tocan vistas, CSS, router ni HTML. Ante la duda, completo. Ya se empujó una
  vez con `--rapido` un cambio que sellaba HTML: no repetir.
- El pre-push de `main` compara `.preflight-ok` con el árbol empujado: si no
  corres el preflight sobre lo que vas a empujar, el hook PARA.

## 4. Revisión — los dos skills, en este orden
1. `/code-review` — bugs de corrección. Cada hallazgo se arregla o se descarta
   con motivo escrito; no se ignora en silencio.
2. `/simplify` — reuso · simplificación · eficiencia · altitud. Igual.
Si algún arreglo tocó código: repite el paso 3 (la suite como mínimo; preflight
completo si tocó vistas/CSS/router).

## 5. Sonda en navegador
Lo que el cambio dice que hace, VERLO hacer en un navegador de verdad
(Playwright headless contra `teacher.html?backend=local`), midiendo píxeles o
estado — no `querySelector` a secas. Si una red del preflight ya lo mide
(matriz, lápiz, cq, colores…), ese paso cuenta como sonda.

## 6. Docs
- ¿El cambio crea o mueve una NORMA? → `docs/leyes.md` + su test (si es norma,
  es test) + la fila del índice en CLAUDE.md.
- ¿Cierra deuda registrada? → múevela a `docs/historico/deuda-resuelta.md`.
- CLAUDE.md tiene presupuesto de 560 líneas (`tests/docs.test.mjs`): para
  añadir, poda.

## 7. Commit y push a las TRES ramas
Mensaje de commit: QUÉ y POR QUÉ, con el defecto que cierra nombrado.
```
git push -u origin <rama-de-trabajo>
git push origin <rama-de-trabajo>:main        # ← sirve aulareto.com; SIEMPRE
git push origin <rama-de-trabajo>:ACTIVIDAD2  # legado
```
`main` no puede quedarse atrás ni un commit (se quedó 154 una vez).

## 8. El cierre en el chat
- Di la versión `(vX.Y.Z)` — la misma del commit.
- Di QUÉ QUEDA SIN VERIFICAR y POR QUIÉN (p. ej. «lápiz en pizarra real:
  compañero, hoja de pruebas parte 1»). Un «todo verde» sin este párrafo es
  una entrega a medias.
