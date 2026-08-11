# docs/ — índice de la documentación

> **Tipo**: mapa · **Sube a**: [`CLAUDE.md`](../CLAUDE.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

Qué leer según lo que necesites. La **fuente de verdad del estado actual** es
`CLAUDE.md` (raíz); estos docs profundizan por tema.

## Empezar / entender
| Necesitas… | Lee |
|---|---|
| **Para quién es la app y cómo se decide qué entra** (la escena real, las restricciones duras, qué NO somos, los referentes, el viaje del profesor) | **`norte.md`** — manda sobre el resto de la documentación |
| TODAS las leyes del proyecto, cada una con el test que la vigila | `leyes.md` |
| Cómo está montado hoy (capas, imports, mapa de datos) | `arquitectura-modulos.md` (GENERADO) |
| Visión general, stack, cómo arrancar | `README.md` (raíz) |
| Reglas del repo + estándares + deuda técnica | `CLAUDE.md` (raíz) |
| Correr y probar en local (sin backend) | `dev-local.md` |

## Catálogo y referencia
| Necesitas… | Lee |
|---|---|
| **Qué hace cada actividad + features + en qué modo se juega** | **`panorama-actividades.md`** |
| Esquema JSON de una actividad + modelo de contenido por plantilla | `ESTRUCTURA.md` |
| Contrato de los modos (Solo/VS/Equipos/Live/Tarea) + recetas | `modos-de-juego.md` |
| **Estudiar/decidir el diseño de cada modo** (fichas, Gherkin, decisiones abiertas) | `modos-de-juego.md` §9 |
| El modo SOLO (Wordwall) por dentro | `modo-wordwall.md` |
| **Sistema de plantillas** (crear/validar/jugar · qué módulo hace qué) | **`sistema-de-plantillas.md`** |
| Contrato de CSS de actividad (relativo + tokens de skin) | `estilos-de-actividad.md` |
| Mapa de módulos `core/` por rol | `../core/README.md` |
| Diseñar los previews SVG de las tarjetas del home (brief de diseño) | `svg-previews-guia.md` |

## Hacer
| Necesitas… | Lee |
|---|---|
| **El sistema de plantillas de punta a punta** (crear/validar/jugar) | `sistema-de-plantillas.md` |
| **Añadir una plantilla nueva** | `../templates/HOW_TO_ADD.md` (o `node tools/new-template.mjs`) |
| **Probar** (suites Node + self-tests + headless) | `testing.md` |

## Los SEIS documentos vivos (todo lo demás es referencia o histórico)

Consolidado en v1.51.424: `docs/` tenía 35 archivos, 15 de ellos handoffs, y la
mayoría describían trabajo TERMINADO. Un índice que ofrece quince sitios donde
mirar entrena a no mirar en ninguno — y esta semana dos avisos falsos nos
costaron tiempo por esa misma razón. Lo resuelto se archivó en `historico/`
(con su cabecera diciendo qué se hizo y dónde vive la regla ahora); lo vivo
quedó aquí.

| Doc vivo | Para qué, y por qué sigue vivo |
|---|---|
| **`norte.md`** | QUÉ construimos y para quién. Manda sobre todo lo demás |
| **`leyes.md`** | CÓMO se construye: las doce leyes, cada una con el test que la vigila |
| **`handoff-acceso-docente.md`** | PIN/NFC para pizarras (U2-U4): trabajo futuro pedido por el usuario, aún sin hacer |
| **`handoff-google-classroom.md`** | Guía de CONFIGURACIÓN en Google Cloud: se necesita cada vez que se toque Classroom |
| **`handoff-seguridad-pb.md`** | Las fases de seguridad de PB; su Fase 3 (validador en el servidor) es hoy un límite declarado en §22 |
| **`handoff-player-frame.md`** | Etapas 1 y 2 PENDIENTES: el plan para cuando se vuelva al problema del marco |

Se le suman dos que no son handoffs sino REFERENCIA permanente:
`infraestructura-pb.md` (cómo está la Pi de verdad) y `handoff-esquema-pb.md`
(el diseño del esquema; el dueño ejecutable es `views/adminView.js` + `tools/check-pb.sh`).

Y el **diagnóstico del reloj** (`handoff-reloj-aparatos.md`) se queda a la vista
aunque esté resuelto: lo que enseñó —que todo lo que DIFIERE entre aparatos nos
era invisible— vale más que el fallo.

## Histórico / temas puntuales
| Tema | Doc |
|---|---|
| La crónica de deuda YA RESUELTA (movida de CLAUDE.md) | `historico/deuda-resuelta.md` |
| Identidad (anon id + auth PocketBase) | `identidad.md` |
| Auditoría del camino SOLO (resuelta) | `auditoria-solo.md` |
| **Planes YA EJECUTADOS** (puntuación · biblioteca pública · analítica · auditoría Fable · deuda A · Emparejar vertical · previews · mejoras live/tareas · centralización) | `historico/handoff-*.md` — cada uno con su cabecera de estado |
| Arquitectura completa (ANTERIOR a PocketBase, ver banner) | `historico/arquitectura.md` |
| Snapshot antiguo (handoff v1.31.4) | `historico/ESTADO.md` |

> Un documento archivado **no es basura**: explica POR QUÉ se hizo así, que es
> lo que un plan terminado sigue valiendo. Lo que ya no hace es fingir que hay
> trabajo pendiente. Para el estado vigente, `CLAUDE.md` (raíz) manda siempre.
