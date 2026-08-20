#!/usr/bin/env bash
# INSTALAR EL HOOK DE LA IA EN LA PI — se ejecuta EN LA PI (ssh duecaz@pio.local).
#
#   curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-instalar-hook.sh | bash
#
# Qué hace, en este orden:
#   1. AVERIGUA cómo está montado PocketBase (no da nada por supuesto: este doc
#      puede quedarse viejo y el servidor es el de verdad).
#   2. Descarga `pb_hooks/aulareto.pb.js` del repo público.
#   3. Si `/pb_hooks` NO está montado, NO toca el compose: lo dice y enseña la
#      línea exacta. La Pi está COMPARTIDA con `aportes` y `equipos_activados`,
#      y un script que edita el compose de un servidor compartido a ciegas es
#      justo lo que no se debe hacer.
#   4. Reinicia y comprueba que la ruta responde.
#
# Es idempotente: se puede correr las veces que haga falta.
set -u

REPO_RAW="https://raw.githubusercontent.com/duecaz/ac/main"
DIR="${WW_PB_DIR:-$HOME/docker/pocketbase}"
PB_URL="${WW_PB_URL:-http://127.0.0.1:8090}"
azul() { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
mal()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }

azul "1. Cómo está montado PocketBase ahora"
docker ps --filter name=pocketbase --format '  contenedor: {{.Names}} · {{.Image}} · {{.Status}}' || {
  mal "No se pudo hablar con Docker. ¿Estás en la Pi y con permisos?"; exit 1; }
MONTAJES="$(docker inspect pocketbase --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)"
echo "$MONTAJES" | sed 's/^/  monta: /'
[ -d "$DIR" ] || { mal "No existe $DIR (pon WW_PB_DIR=/ruta si el compose está en otro sitio)"; exit 1; }
ok "compose en $DIR"

azul "2. Bajar el hook del repo público"
mkdir -p "$DIR/pb_hooks" || exit 1
# DOS ficheros: el que registra las rutas y el módulo con todo lo demás. Van
# separados porque los handlers de PocketBase corren en un runtime aparte y no
# ven el ámbito exterior — con todo en un fichero, la ruta devolvía 400.
for f in aulareto.pb.js aulareto-lib.js; do
  if curl -fsSL "$REPO_RAW/pb_hooks/$f" -o "$DIR/pb_hooks/$f"; then
    ok "$DIR/pb_hooks/$f ($(wc -c < "$DIR/pb_hooks/$f") bytes)"
  else
    mal "No se pudo descargar $f. ¿Tiene la Pi salida a internet?"; exit 1
  fi
done

azul "3. ¿Está /pb_hooks montado en el contenedor?"
if echo "$MONTAJES" | grep -q '> */pb_hooks'; then
  ok "sí — no hay que tocar el compose"
else
  mal "NO. El fichero está en la Pi pero el contenedor no lo ve."
  cat <<'AVISO'

  Añade esta línea al servicio `pocketbase` de tu docker-compose.yml, en `volumes:`

        - ./pb_hooks:/pb_hooks

  Con copia de seguridad primero (la Pi está compartida con otros proyectos):

        cp ~/docker/pocketbase/docker-compose.yml ~/docker/pocketbase/docker-compose.yml.bak
        nano ~/docker/pocketbase/docker-compose.yml

  Y luego vuelve a lanzar este script.
AVISO
  exit 2
fi

azul "4. Reiniciar y comprobar"
( cd "$DIR" && docker compose up -d --force-recreate pocketbase >/dev/null 2>&1 ) || docker restart pocketbase >/dev/null
sleep 6
CODIGO="$(curl -s -o /tmp/ia-estado.json -w '%{http_code}' "$PB_URL/api/ia/estado")"
if [ "$CODIGO" = "200" ]; then
  ok "el hook responde: $(cat /tmp/ia-estado.json)"
  echo
  echo "  Ahora, en aulareto.com → #/admin → «IA que escribe contenido»: pega la clave."
else
  mal "la ruta /api/ia/estado devolvió $CODIGO (se esperaba 200)"
  echo "  Log de PocketBase (últimas líneas) — aquí sale el error del hook si lo hay:"
  docker logs pocketbase --tail 30 2>&1 | sed 's/^/    /'
  exit 1
fi
