#!/usr/bin/env bash
# check-pb.sh — smoke-test de PocketBase para AulaReto.
# Corre las consultas EXACTAS que hace la app y reporta OK/FALLA por cada una.
# Úsalo tras CUALQUIER actualización de PocketBase, ANTES de que jueguen los alumnos.
#
# Uso:  ./check-pb.sh            (usa http://localhost:8090)
#       PB=https://pb.lanube.uno ./check-pb.sh
set -u
PB="${PB:-http://localhost:8090}"
command -v jq >/dev/null || { echo "Falta jq: sudo apt-get install -y jq"; exit 1; }

read -rp "Email superadmin PB: " EMAIL
read -rsp "Password superadmin PB: " PASS; echo
TOKEN=$(curl -s -X POST "$PB/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.token // empty')

ok=0; fail=0
green(){ echo -e "  \033[32m✓\033[0m $1"; ok=$((ok+1)); }
red(){   echo -e "  \033[31m✗\033[0m $1 — $2"; fail=$((fail+1)); }

# 1) health
curl -s "$PB/api/health" | jq -e '.code==200' >/dev/null && green "API health" || red "API health" "no responde 200"

# 2) token
[ -n "$TOKEN" ] && green "auth superadmin" || { red "auth superadmin" "sin token (password?)"; echo "Aborta."; exit 1; }

# 3) colecciones esperadas
for c in users activities activity_likes reports results profiles live_answers live_players; do
  curl -s "$PB/api/collections/$c" -H "Authorization: $TOKEN" | jq -e '.id' >/dev/null \
    && green "colección $c existe" || red "colección $c" "no existe"
done

# 4) activities tiene los campos que la app necesita
FIELDS=$(curl -s "$PB/api/collections/activities" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
for f in data visibility owner; do
  echo "$FIELDS" | grep -qw "$f" && green "activities.$f" || red "activities.$f" "campo ausente"
done

# 4b) assignment_attempts.answers (analítica por ítem de tareas, F3)
AAF=$(curl -s "$PB/api/collections/assignment_attempts" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
echo "$AAF" | grep -qw answers && green "assignment_attempts.answers" || red "assignment_attempts.answers" "campo ausente (corre 'Crear colecciones' en #/admin)"

# 4c) live_answers.v0/c0 (primer intento en carrera, para capturar errores)
LAF=$(curl -s "$PB/api/collections/live_answers" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
for f in v0 c0; do
  echo "$LAF" | grep -qw "$f" && green "live_answers.$f" || red "live_answers.$f" "campo ausente (re-corre setup-pocketbase.ps1 o añade el campo)"
done

# 4d) live_players (deuda A) + su índice único (session,name)
LPF=$(curl -s "$PB/api/collections/live_players" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
for f in session name user_id; do
  echo "$LPF" | grep -qw "$f" && green "live_players.$f" || red "live_players.$f" "campo ausente (corre 'Crear colecciones' en #/admin)"
done
LPI=$(curl -s "$PB/api/collections/live_players" -H "Authorization: $TOKEN" | jq -r '.indexes[]?' | tr '\n' ' ')
echo "$LPI" | grep -qi "unique" && echo "$LPI" | grep -qi "session" \
  && green "live_players índice único (session,name)" \
  || red "live_players índice único" "falta el UNIQUE (session,name) → apodos podrían duplicarse"

# 5) La consulta de EXPLORAR / PORTADA (como la hace el navegador, anónimo, SIN sort)
Q=$(curl -s -G "$PB/api/collections/activities/records" \
  --data-urlencode "filter=visibility='public'" --data-urlencode "perPage=5")
echo "$Q" | jq -e 'has("items")' >/dev/null \
  && green "query Explorar (public)" || red "query Explorar" "$(echo "$Q" | jq -r '.message // "?"')"

# 6) La consulta de LIKES (conteo)
L=$(curl -s "$PB/api/collections/activity_likes/records?perPage=1" -H "Authorization: $TOKEN")
echo "$L" | jq -e 'has("items")' >/dev/null \
  && green "query likes" || red "query likes" "$(echo "$L" | jq -r '.message // "?"')"

# 7) auth-methods expone Google (login)
curl -s "$PB/api/collections/users/auth-methods" | jq -e '(.oauth2.providers // .authProviders // [])[]?.name | select(.=="google")' >/dev/null \
  && green "login Google habilitado" || red "login Google" "proveedor google no activo"

# 8) ENDURECIMIENTO (U1): crear una actividad SIN sesión DEBE fallar (403/400).
#    Si devuelve 200 la regla quedó abierta → cualquiera puede escribir en la BD.
#    Se captura la respuesta: si por estar abierta se creó una fila, se BORRA con
#    el token de superadmin para no dejar basura de diagnóstico.
RESP=$(curl -s -w $'\n%{http_code}' -X POST "$PB/api/collections/activities/records" \
  -H "Content-Type: application/json" -d '{"data":{"id":"checkpbtmp"},"visibility":"unlisted"}')
SC=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
if [ "$SC" = "400" ] || [ "$SC" = "403" ]; then
  green "create anónimo de activities bloqueado ($SC)"
else
  red "create anónimo de activities" "devolvió $SC (regla abierta)"
  JUNK=$(echo "$BODY" | jq -r '.id // empty')
  [ -n "$JUNK" ] && curl -s -o /dev/null -X DELETE "$PB/api/collections/activities/records/$JUNK" -H "Authorization: $TOKEN" \
    && echo "    (fila de diagnóstico $JUNK borrada)"
fi

# 9) ENDURECIMIENTO (U1): alta de usuario SIN sesión DEBE fallar (signup público cerrado).
SC=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PB/api/collections/users/records" \
  -H "Content-Type: application/json" -d '{"email":"checkpb_'$RANDOM'@x.com","password":"12345678","passwordConfirm":"12345678"}')
{ [ "$SC" = "400" ] || [ "$SC" = "403" ]; } \
  && green "signup público de users bloqueado ($SC)" || red "signup público de users" "devolvió $SC (createRule abierto)"

echo ""
echo "Resultado: $ok OK, $fail FALLA(S)."
[ "$fail" -eq 0 ] && echo "Todo verde ✅" || { echo "Hay fallos ❌ — pégaselos a Claude para arreglar antes de usar con alumnos."; exit 1; }
