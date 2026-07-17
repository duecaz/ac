# docs/ — índice de la documentación

Qué leer según lo que necesites. La **fuente de verdad del estado actual** es
`CLAUDE.md` (raíz); estos docs profundizan por tema.

## Empezar / entender
| Necesitas… | Lee |
|---|---|
| Visión general, stack, cómo arrancar | `README.md` (raíz) |
| Reglas del repo + estándares + deuda técnica | `CLAUDE.md` (raíz) |
| Correr y probar en local (sin backend) | `dev-local.md` |

## Catálogo y referencia
| Necesitas… | Lee |
|---|---|
| **Qué hace cada actividad + features + en qué modo se juega** | **`panorama-actividades.md`** |
| Esquema JSON de una actividad + modelo de contenido por plantilla | `ESTRUCTURA.md` |
| Contrato de los modos (Solo/VS/Equipos/Live/Tarea) + recetas | `modos-de-juego.md` |
| El modo SOLO (Wordwall) por dentro | `modo-wordwall.md` |
| **Sistema de plantillas** (crear/validar/jugar · qué módulo hace qué) | **`sistema-de-plantillas.md`** |
| Contrato de CSS de actividad (relativo + tokens de skin) | `estilos-de-actividad.md` |
| Mapa de módulos `core/` por rol | `../core/README.md` |

## Hacer
| Necesitas… | Lee |
|---|---|
| **Añadir una plantilla nueva** | `../templates/HOW_TO_ADD.md` |
| **Probar** (suites Node + self-tests + headless) | `testing.md` |

## Histórico / temas puntuales
| Tema | Doc |
|---|---|
| Identidad (anon id + auth PocketBase) | `identidad.md` |
| Auditoría del camino SOLO (resuelta) | `auditoria-solo.md` |
| Arquitectura completa (ANTERIOR a PocketBase, ver banner) | `historico/arquitectura.md` |
| Snapshot antiguo (handoff v1.31.4) | `historico/ESTADO.md` |

> Nota: `auditoria-solo.md` describe una auditoría ya resuelta (queda como
> registro). `historico/arquitectura.md` y `historico/ESTADO.md` son snapshots
> ANTERIORES a la migración a PocketBase — llevan su propio aviso. Para el
> estado vigente, `CLAUDE.md` (raíz) manda siempre.
