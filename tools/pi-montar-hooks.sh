#!/usr/bin/env bash
# AÑADIR EL MONTAJE `./pb_hooks:/pb_hooks` AL COMPOSE DE LA PI — con red.
#
#   curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-montar-hooks.sh | bash
#
# Existe porque la alternativa era «edita el docker-compose.yml con nano»: en
# YAML un espacio de más rompe el fichero, y este compose levanta una Pi
# COMPARTIDA con `aportes` y `equipos_activados` — romperlo tira los tres.
#
# La red, en este orden:
#   1. copia de seguridad con fecha ANTES de tocar nada;
#   2. la línea se añade con la MISMA sangría que las que ya hay (no se inventa);
#   3. `docker compose config` VALIDA el resultado — y si no valida, se restaura
#      la copia automáticamente y no se reinicia nada;
#   4. enseña el diff y para. El reinicio lo lanzas tú, viéndolo.
#
# Idempotente: si el montaje ya está, no hace nada.
set -u
DIR="${WW_PB_DIR:-$HOME/docker/pocketbase}"
azul() { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
mal()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }

YML=""
for f in "$DIR/docker-compose.yml" "$DIR/docker-compose.yaml" "$DIR/compose.yml" "$DIR/compose.yaml"; do
  [ -f "$f" ] && { YML="$f"; break; }
done
[ -n "$YML" ] || { mal "No encuentro el compose en $DIR"; exit 1; }
ok "compose: $YML"

if grep -qE '^\s*-\s*\./pb_hooks:/pb_hooks\s*$' "$YML"; then
  ok "el montaje YA está — nada que hacer"; exit 0
fi

azul "1. Copia de seguridad"
COPIA="$YML.bak.$(date +%Y%m%d-%H%M%S)"
cp "$YML" "$COPIA" || exit 1
ok "$COPIA"

azul "2. Añadir la línea con la sangría de las que ya hay"
python3 - "$YML" <<'PY' || { mal "no se pudo editar"; exit 1; }
import re, sys
ruta = sys.argv[1]
lineas = open(ruta, encoding='utf-8').read().split('\n')

# Se busca el `volumes:` que YA monta pb_data: es inequívocamente el de
# PocketBase, y así no hay que adivinar cuál de los servicios del compose es.
destino = None
for i, l in enumerate(lineas):
    if re.match(r'^\s*-\s*\./pb_data:/pb_data\s*$', l):
        destino = i
        break
if destino is None:
    print('NO_ENCONTRADO', file=sys.stderr)
    sys.exit(1)

sangria = re.match(r'^(\s*)-', lineas[destino]).group(1)
lineas.insert(destino + 1, f'{sangria}- ./pb_hooks:/pb_hooks')
open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas))
PY
if [ $? -ne 0 ]; then
  mal "No encontré la línea './pb_data:/pb_data' para colgarme de ella."
  echo "  Añade a mano, en el servicio pocketbase, dentro de volumes:"
  echo "        - ./pb_hooks:/pb_hooks"
  exit 1
fi
ok "línea añadida"

azul "3. ¿Sigue siendo un compose válido?"
if ( cd "$DIR" && docker compose config >/dev/null 2>/tmp/compose-err.txt ); then
  ok "válido"
else
  mal "el compose quedó INVÁLIDO — se restaura la copia y no se toca nada más"
  cp "$COPIA" "$YML"
  sed 's/^/    /' /tmp/compose-err.txt
  exit 1
fi

azul "4. Esto es lo que cambió"
diff -u "$COPIA" "$YML" | sed 's/^/  /'
cat <<'FIN'

  Si lo ves bien, aplica y comprueba con:

      cd ~/docker/pocketbase && docker compose up -d --force-recreate pocketbase
      sleep 6 && curl -s http://127.0.0.1:8090/api/ia/estado; echo

  Se espera algo como:  {"instalado":true,"configurado":false,...}
FIN
