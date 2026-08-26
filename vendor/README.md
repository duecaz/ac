# `vendor/` — dependencias de terceros, copiadas aquí a propósito

> **Tipo**: referencia · **Sube a**: [`docs/README.md`](../docs/README.md) · **Vigila**: `tests/vendor.test.mjs`

Nada de este directorio se edita. Son copias exactas del paquete publicado, con
su versión en el nombre de la carpeta y su licencia al lado.

## Por qué están aquí y no en un CDN

Bootstrap entraba por `cdn.jsdelivr.net` en las cuatro páginas. Eso tenía dos
costes, y ninguno era teórico:

1. **La clase depende de la red de otro.** `styles/theme.css` ya lo dice en su
   primera línea: sin Bootstrap, `box-sizing: border-box` desaparece y **toda**
   la maquetación cambia de modelo de caja — los anchos en % se desbordan por su
   propio relleno. En un colegio sin internet, o el día que el CDN falle, la app
   no se ve mal: se ve rota. La deuda estaba declarada en `docs/leyes.md` §3
   («CSS propio, Bootstrap fuera»); vendorizar es el paso que la hace inofensiva
   mientras esa sustitución no exista.
2. **Las redes medían una pantalla que nadie ve.** `tools/shots.mjs` corre en un
   entorno sin salida a jsDelivr, así que fotografiaba la app con media hoja de
   estilos ausente. No es un detalle de laboratorio: por eso una medición dio
   «la calculadora tiene dos tipografías» y hubo que retirar la conclusión —
   los botones caían a la fuente del navegador porque Bootstrap no estaba, no
   porque el código lo hiciera. Una red que mide otra pantalla es peor que no
   tenerla.

## Qué hay

| Carpeta | Versión | Origen |
|---|---|---|
| `bootstrap-5.3.3/` | 5.3.3 | `npm pack bootstrap@5.3.3` → `dist/css/bootstrap.min.css` + `dist/js/bootstrap.bundle.min.js` |
| `bootstrap-icons-1.11.3/` | 1.11.3 | `npm pack bootstrap-icons@1.11.3` → `font/bootstrap-icons.min.css` + `font/fonts/*` |
| `press-start-2p-5.3.0/` | 5.3.0 | `npm pack @fontsource/press-start-2p` → `latin.css` + los dos `latin-400-normal` (woff2/woff) |

La fuente de píxeles del tema Arcade venía de `fonts.googleapis.com` y se coló
por donde la primera versión de la red no miraba: un `@import` DENTRO de una
hoja, no un `<link>` en el HTML. La ley decía «cero recursos externos» mientras
quedaba uno, y sin red el tema Arcade se quedaba en Courier. Se trae solo el
subconjunto **latin** (`U+0000-00FF` y algo más): cubre `¡`, `ñ` y las tildes
del texto de la marquesina. Los símbolos decorativos (★ ◉ ▶) no están en esa
fuente ni lo estaban en la de Google — el navegador cae a Courier para ellos,
igual que antes.

Único cambio sobre el original: se han quitado las dos líneas
`sourceMappingURL`, porque los `.map` no se distribuyen y solo darían un 404 en
la consola.

Las fuentes de los iconos se referencian con ruta **relativa** (`fonts/…`) desde
su propio CSS, así que la estructura de carpetas no se puede aplanar.

## Cómo actualizar

```
npm pack bootstrap@<nueva>              # y bootstrap-icons@<nueva>
tar xzf bootstrap-<nueva>.tgz
# copiar a vendor/bootstrap-<nueva>/, borrar la carpeta vieja,
# quitar las dos líneas sourceMappingURL y apuntar los 4 HTML a la nueva ruta
node tools/preflight.mjs                # y mirar las capturas: cambia el CSS de toda la app
```

La versión va en el NOMBRE de la carpeta a propósito: así el navegador no puede
servir la anterior desde caché, y un `grep` dice de un vistazo qué se está
usando. Que las rutas de los HTML y las carpetas de aquí coincidan lo comprueba
`tests/vendor.test.mjs`.
