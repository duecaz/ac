#!/usr/bin/env bash
# REPRODUCIR LA PETICIÓN DE VERDAD DESDE LA PI — la que el navegador no deja ver.
#
#   curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-probar-ia.sh | bash
#
# Por qué hace falta: la consola del navegador dijo que la petición llegó y el
# servidor contestó 502 SIN cabecera de permiso, así que el navegador oculta el
# cuerpo — que es justo donde está el motivo. El diagnóstico anterior solo podía
# probar SIN sesión (401), y el 401 sale ANTES de llamar a la IA: nunca tocaba
# el trozo que falla. Este entra con la cuenta de profe y pide de verdad.
#
# Pide el email y la contraseña del profe (los de aulareto.com, no los de
# superadmin). No se guardan en ningún sitio y no se imprimen.
set -u
LOCAL="${WW_PB_LOCAL:-http://127.0.0.1:8090}"
PUBLICO="${WW_PB_URL:-https://pb.lanube.uno}"

linea() { printf '\n── %s\n' "$1"; }
echo "════════ PRUEBA REAL DE IA · $(date -Is) ════════"

# `curl | bash` deja stdin ocupado por el propio guion: para preguntar hay que
# hablar con la terminal directamente.
if [ ! -t 0 ] && [ ! -r /dev/tty ]; then
  echo "No hay terminal para preguntar la contraseña. Descarga y ejecuta:"
  echo "  curl -fsSLO https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-probar-ia.sh && bash pi-probar-ia.sh"
  exit 1
fi
printf 'Email de profe (aulareto.com): ' > /dev/tty
read -r EMAIL < /dev/tty
printf 'Contraseña: ' > /dev/tty
read -rs PASS < /dev/tty
echo > /dev/tty

# 1. Entrar. Si esto falla, lo demás no significa nada.
linea "Entrando como profe"
AUTH=$(curl -s -X POST "$LOCAL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data-binary "$(printf '{"identity":"%s","password":"%s"}' "$EMAIL" "$PASS")")
TOKEN=$(printf '%s' "$AUTH" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "   NO se pudo entrar. Respuesta del servidor:"
  printf '%s\n' "$AUTH" | head -c 300 | sed 's/^/   /'
  echo; echo "   (email o contraseña equivocados, o la cuenta no es de esta base)"
  exit 1
fi
echo "   ✓ sesión obtenida (no se imprime)"

# 2. LA PETICIÓN QUE FALLA, con sesión. Local y público: si local va y público
#    no, el problema está delante de PocketBase (Cloudflare); si fallan las dos,
#    es el hook y el cuerpo dirá por qué.
for base in "$LOCAL" "$PUBLICO"; do
  linea "POST CON sesión $base/api/ia/contenido"
  curl -s -o /tmp/ia-real.txt -w '   http %{http_code} · %{time_total}s\n' \
    -X POST "$base/api/ia/contenido" \
    -H 'Content-Type: application/json' -H "Authorization: $TOKEN" \
    -H 'Origin: https://aulareto.com' \
    -d '{"modelo":"qa","tema":"los planetas del sistema solar","curso":"5.º de primaria","cantidad":2}'
  head -c 400 /tmp/ia-real.txt | sed 's/^/   /'; echo
done

# 3. ¿Llega la Pi a Google? Sin clave: un 401/403 YA prueba que hay camino.
#    Un fallo de red aquí explicaría el 502 sin tocar nada más.
linea "¿Alcanza la Pi al proveedor?"
curl -s -o /dev/null -m 15 -w '   generativelanguage.googleapis.com → http %{http_code} · %{time_total}s\n' \
  https://generativelanguage.googleapis.com/v1beta/models || echo '   sin respuesta (la Pi no llega a Google)'
curl -s -o /dev/null -m 15 -w '   api.x.ai → http %{http_code} · %{time_total}s\n' \
  https://api.x.ai/v1/models || echo '   sin respuesta'

# 4. El registro del hook. `$app.logger()` escribe en la BASE, no en la salida
#    de docker — por eso `docker logs` salía limpio y parecía que no pasaba nada.
linea "Últimos avisos del hook (registro de PocketBase)"
echo "   Si aquí no sale nada, míralo en $PUBLICO/_/#/logs (filtro: IA)"
docker exec pocketbase sh -c 'ls /pb_data/*.db 2>/dev/null' >/dev/null 2>&1 \
  && docker exec pocketbase sh -c \
    "sqlite3 /pb_data/auxiliary.db \"SELECT created, message FROM _logs WHERE message LIKE '%IA:%' ORDER BY created DESC LIMIT 10;\" 2>/dev/null" \
    | sed 's/^/   /' || echo "   (no se pudo leer el registro desde aquí)"

echo
echo "════════ fin · copia TODO esto ════════"
