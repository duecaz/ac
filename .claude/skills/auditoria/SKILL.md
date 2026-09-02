---
name: auditoria
description: La pasada de limpieza del sistema — basura mecánica (citas rotas, exports muertos) + apretar los ratchets a mano probando a quitar excepciones. Lo que aparezca dos veces se convierte en test.
---

# /auditoria — borrar basura y apretar ratchets

Por qué es un skill y no un informe: la auditoría de 2026-07 dejó un doc que
envejeció gritando urgencias falsas; lo que de aquella auditoría se convirtió
en TESTS sigue trabajando hoy solo. Regla de salida de cada pasada: **lo que
aparezca dos veces se convierte en test, no en párrafo.**

## 1. La parte mecánica (corre sola, también en el preflight)
```
node tools/auditoria.mjs
```
Tres barridos: **citas rotas** (todo camino citado en CLAUDE.md/docs/README
existe — las menciones de ficheros borrados van en `CITAS_CRONICA` con motivo),
**exports muertos** (nadie nombra el export fuera de su fichero) y el
**inventario de excepciones** (informativo). Si falla:
- cita rota → o el doc miente (corrígelo) o el fichero se renombró (apunta al
  nuevo). NUNCA añadir a `CITAS_CRONICA` una promesa viva.
- export muerto → tres salidas, en este orden de preferencia:
  1. **conectar**: ¿hay un número/regla a mano en otro sitio que debería usar
     este export? (caso real: `MAX_PARRAFOS` moría exportado mientras
     `editorPrimitives` llevaba un `|| 4` a mano — §21b);
  2. **des-exportar**: se usa dentro de su fichero → quita el `export`;
  3. **borrar**: no se usa en ningún sitio → fuera (§30).

## 2. La parte de criterio: APRETAR los ratchets
`node tools/auditoria.mjs --listas` enumera las listas de excepción por tamaño.
Para cada entrada de las listas gordas (empezando por la mayor):
1. QUITA la entrada.
2. Corre el test dueño de esa lista (está en el mismo fichero o lo nombra el
   comentario de la lista).
3. ¿Verde? → la entrada estaba muerta: se queda fuera, con una línea en el
   commit. ¿Rojo? → la entrada sigue viva: se devuelve TAL CUAL.
No hace falta barrer todas en cada pasada: las 2-3 más grandes por vez.

## 3. Otras miradas (rotar una por pasada, no todas)
- `node tools/css-inventory.mjs` — familias CSS con pocos usos (¿selector muerto?).
- ¿Docs con deuda ya resuelta? → `docs/historico/deuda-resuelta.md`.
- ¿Un módulo pasó de 500 líneas? → candidato a partir (los cortes se MAPEAN
  antes de operar, como los 4 grandes de la cola del norte).

## 3b. Las costuras (docs/handoff-costuras.md) — cómo se corre cada barrido
Cada barrido es un script `tools/costuras-*.mjs` con baseline (solo baja) que
`tools/auditoria.mjs` ejecuta. Para juzgar sus listas se lanzan agentes
baratos con la plantilla de veredicto de §3 del plan. REGLAS que costaron
sangre el 2026-09-02:
- **Un agente EDITA ficheros; NUNCA ejecuta git** (`stash`/`checkout`/`reset`
  borró el trabajo en curso de otro agente). Va en cada prompt.
- **Un barrido a la vez** por sesión. Los JUECES sí pueden ir en paralelo (solo
  leen); los EJECUTORES no comparten ficheros entre sí.
- **Al retomar (reinicio del contenedor, aviso perdido): `git status` + suite
  antes de dar nada por hecho.** Los avisos de fin de agente se pierden.
- **Cada red nueva se comprueba en ROJO antes de creerla en verde**: se
  reintroduce el defecto a propósito y la red tiene que gritar.
- Lo que el juez marque `legítimo` entra en la lista de excepciones del
  barrido CON su motivo; lo `replantear` va al dueño en una sola pregunta.

## 4. Salida
- Todo lo borrado, en el commit con su porqué (una línea por pieza).
- Ratchets apretados: el número viejo → nuevo, en el commit.
- Hallazgo repetido (2ª vez que un barrido manual encuentra la misma clase de
  basura) → escribe el test/barrido que la cace sola y añádelo a
  `tools/auditoria.mjs` o a `tests/`.
- Entregar con `/entregar` (versión · preflight · push a las tres ramas).
