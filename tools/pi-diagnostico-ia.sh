#!/usr/bin/env bash
# DIAGNÓSTICO DEL EXTREMO DE IA — mide, no supone.
#
#   curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-diagnostico-ia.sh | bash
#
# Nació después de TRES arreglos seguidos apuntando al permiso de origen sin
# ninguna medida delante. Esto contesta las preguntas que hacían falta desde el
# principio, y en particular una que no se había probado: todas las
# comprobaciones anteriores fueron contra 127.0.0.1, que SE SALTA Cloudflare —
# y el navegador va por pb.lanube.uno, que no. Aquí se comparan las dos.
#
# No imprime la clave ni parte de ella.
set -u
LOCAL="${WW_PB_LOCAL:-http://127.0.0.1:8090}"
PUBLICO="${WW_PB_URL:-https://pb.lanube.uno}"
ORIGEN="${WW_ORIGEN:-https://aulareto.com}"

echo "════════ DIAGNÓSTICO IA · $(date -Is) ════════"

linea() { printf '\n── %s\n' "$1"; }

# 1. ¿Responde la ruta, y con qué? Local vs público = con y sin Cloudflare.
for base in "$LOCAL" "$PUBLICO"; do
  linea "GET $base/api/ia/estado"
  curl -s -o /tmp/ia-est.txt -w '   http %{http_code} · %{time_total}s\n' "$base/api/ia/estado"
  sed 's/^/   /' /tmp/ia-est.txt; echo
done

# 2. EL PREFLIGHT: es lo que manda el navegador ANTES del POST. Si esto no
#    responde con las cabeceras de permiso, `fetch` lanza y la app no llega ni a
#    enviar la petición de verdad.
for base in "$LOCAL" "$PUBLICO"; do
  linea "OPTIONS (preflight) $base/api/ia/contenido"
  curl -s -D /tmp/ia-h.txt -o /dev/null -X OPTIONS "$base/api/ia/contenido" \
    -H "Origin: $ORIGEN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type,authorization" \
    -w '   http %{http_code}\n'
  grep -i -E '^(HTTP|access-control|server|cf-)' /tmp/ia-h.txt | sed 's/^/   /'
done

# 3. El POST sin sesión: DEBE dar 401. Si da 404 la ruta no existe; si da 400,
#    el handler revienta. Distingue «no llega» de «llega y no autoriza».
for base in "$LOCAL" "$PUBLICO"; do
  linea "POST sin sesión $base/api/ia/contenido (se espera 401)"
  curl -s -D /tmp/ia-h2.txt -o /tmp/ia-p.txt -X POST "$base/api/ia/contenido" \
    -H "Origin: $ORIGEN" -H 'Content-Type: application/json' \
    -d '{"modelo":"qa","tema":"prueba","cantidad":1}' \
    -w '   http %{http_code}\n'
  grep -i -E '^access-control' /tmp/ia-h2.txt | sed 's/^/   cabecera: /'
  head -c 200 /tmp/ia-p.txt | sed 's/^/   /'; echo
done

# 4. ¿Qué dice PocketBase? Aquí sale el aviso si las cabeceras no se pudieron
#    poner, y cualquier error del hook.
linea "Log de PocketBase (últimas 25)"
docker logs pocketbase --tail 25 2>&1 | sed 's/^/   /'

# 5. Comparación de control: una ruta PROPIA de PocketBase, que en el navegador
#    SÍ funciona (el panel crea colecciones sin problema). Si su preflight
#    responde y el nuestro no, el problema es de la ruta añadida a mano; si
#    tampoco responde, es de más arriba (Cloudflare / proxy).
linea "CONTROL · preflight de una ruta propia de PocketBase"
curl -s -D /tmp/ia-h3.txt -o /dev/null -X OPTIONS "$PUBLICO/api/collections/ia_config/records" \
  -H "Origin: $ORIGEN" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  -w '   http %{http_code}\n'
grep -i -E '^(HTTP|access-control|cf-)' /tmp/ia-h3.txt | sed 's/^/   /'

echo
echo "════════ fin · copia TODO esto ════════"
