# Créditos y licencia de las láminas

> **Tipo**: referencia · **Sube a**: [`../../../docs/handoff-juegos-inicial.md`](../../../docs/handoff-juegos-inicial.md) · **Vigila**: `tests/colorear.test.mjs`

Las 43 láminas de esta carpeta vienen de **[OpenMoji](https://openmoji.org)**, el
proyecto abierto de emojis e iconos de la HfG Schwäbisch Gmünd.

- **Autoría**: *All emojis designed by OpenMoji – the open-source emoji and icon
  project.*
- **Licencia**: **CC BY-SA 4.0**
  ([texto completo](https://creativecommons.org/licenses/by-sa/4.0/)).
- **Qué se cambió**: se tomó la variante de CONTORNO (`black/svg`), se reescaló
  de su lienzo de 72×72 al de 100×100 del banco y se quitaron los `id` internos
  para que dos láminas puedan convivir en la misma página. Nada más: la línea es
  la original. La conversión está en `tools/importar-dibujos.mjs` y se puede
  repetir.
- **Cada fichero lleva su crédito dentro**, en un comentario XML con el punto de
  código Unicode del que salió.

## Lo que el share-alike obliga

CC BY-SA es *compartir igual*: **estos SVG, y cualquier versión modificada de
ellos, siguen siendo CC BY-SA 4.0** y deben distribuirse con la atribución de
arriba. Eso es lo que este fichero cumple.

Lo que **no** cambia es la licencia de la aplicación: mostrar una imagen no
convierte al programa en obra derivada de ella. Si algún día alguien PUBLICA una
lámina modificada por su cuenta, esa lámina va con esta misma licencia.

El dueño aceptó estas condiciones el 2026-09-17, sabiendo que la alternativa
—[Openclipart](https://openclipart.org), dominio público y sin atribución— tenía
mejor licencia pero peor arte para este uso.

## Añadir más

```
node tools/importar-dibujos.mjs
```

El catálogo (`CATALOGO`, por temas) está en la cabecera de esa herramienta. Al
añadir una lámina hay que mirarla: el balón de fútbol (U+26BD) se descartó
porque sus pentágonos son NEGROS de diseño y como lámina para colorear es una
mancha. Lo que se importa se VE antes de darlo por bueno.
