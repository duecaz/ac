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
# Las TRECE del esquema (views/adminView.js DEFS) + `users`. Esta lista estaba
# escrita a mano y se quedó en 8: faltaban live_sessions, live_keys, live_claims,
# assignments y assignment_attempts — justo las que, si no están, la app degrada
# EN SILENCIO al blob legado. Lo vigila tests/pbSchema.test.mjs.
for c in users activities results live_sessions live_claims live_keys live_answers live_players assignments assignment_attempts activity_likes reports profiles ia_config ia_usos; do
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
LA=$(curl -s "$PB/api/collections/live_answers" -H "Authorization: $TOKEN")
LAF=$(echo "$LA" | jq -r '.fields[].name' | tr '\n' ' ')
for f in v0 c0; do
  echo "$LAF" | grep -qw "$f" && green "live_answers.$f" || red "live_answers.$f" "campo ausente (re-corre setup-pocketbase.ps1 o añade el campo)"
done
# índice único (session,player,item) — deuda F: upsert atómico, sin filas duplicadas
LAI=$(echo "$LA" | jq -r '.indexes[]?' | tr '\n' ' ')
echo "$LAI" | grep -qi "unique" && echo "$LAI" | grep -qi "player" \
  && green "live_answers índice único (session,player,item)" \
  || red "live_answers índice único" "falta el UNIQUE (session,player,item) → posibles filas duplicadas por jugador"

# 4d) live_players (deuda A) + su índice único (session,name)
LPF=$(curl -s "$PB/api/collections/live_players" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
for f in session name user_id; do
  echo "$LPF" | grep -qw "$f" && green "live_players.$f" || red "live_players.$f" "campo ausente (corre 'Crear colecciones' en #/admin)"
done
LPI=$(curl -s "$PB/api/collections/live_players" -H "Authorization: $TOKEN" | jq -r '.indexes[]?' | tr '\n' ' ')
echo "$LPI" | grep -qi "unique" && echo "$LPI" | grep -qi "session" \
  && green "live_players índice único (session,name)" \
  || red "live_players índice único" "falta el UNIQUE (session,name) → apodos podrían duplicarse"

# 4e) Los campos MUDOS: si faltan, PocketBase ignora la clave al escribir y no
#     hay ningún error — el dato se pierde y nadie se entera.
#     · live_answers.unscorable: sin él, un ítem sin clave de respuesta (Pregunta
#       en Vivo, Ruleta) se guarda como INCORRECTO para toda la clase.
#     · results.qid / assignment_attempts.qid: sin ellos (y sin su índice único
#       parcial) un ACK perdido duplica la fila y gasta un intento del alumno.
echo "$LAF" | grep -qw unscorable && green "live_answers.unscorable" || red "live_answers.unscorable" "campo ausente → un ítem no puntuable se guardaría como fallo de toda la clase"
RF=$(curl -s "$PB/api/collections/results" -H "Authorization: $TOKEN" | jq -r '.fields[].name' | tr '\n' ' ')
echo "$RF" | grep -qw qid && green "results.qid" || red "results.qid" "campo ausente → un reintento tras ACK perdido duplica el resultado"
for f in qid attempt_no; do
  echo "$AAF" | grep -qw "$f" && green "assignment_attempts.$f" || red "assignment_attempts.$f" "campo ausente (corre 'Crear colecciones' en #/admin)"
done
AAI=$(curl -s "$PB/api/collections/assignment_attempts" -H "Authorization: $TOKEN" | jq -r '.indexes[]?' | tr '\n' ' ')
echo "$AAI" | grep -qi "qid" && green "assignment_attempts índice de qid" || red "assignment_attempts índice de qid" "falta el UNIQUE parcial sobre qid → la idempotencia no aplica"

# 4f) El TOPE de una actividad (§25): 2 MB. El panel #/admin NO corrige atributos
#     de un campo que ya existe, así que este valor se queda desfasado en silencio.
DMAX=$(curl -s "$PB/api/collections/activities" -H "Authorization: $TOKEN" | jq -r '.fields[] | select(.name=="data") | .maxSize')
[ "$DMAX" = "2097152" ] && green "activities.data maxSize = 2 MB (§25)" \
  || red "activities.data maxSize" "es $DMAX y debería ser 2097152 (ajústalo a mano en pb/_/ → activities → data)"

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


# ── FASE DE REGLAS LIVE (§22) — chequeos NEGATIVOS: lo que un alumno NO puede ──
# Se necesita una sala de verdad para probar contra ella; se crea con el token de
# superadmin y se borra al final. Si alguno de estos pasa, la trampa está abierta.
LIVE_SESS=$(curl -s -X POST "$PB/api/collections/live_sessions/records" \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"CHECKPB","state":{"status":"running","phase":"question"}}' | jq -r '.id // empty')
if [ -z "$LIVE_SESS" ]; then
  red "crear sala de diagnóstico" "no se pudo (¿falta la colección live_sessions?)"
else
  LIVE_ANS=$(curl -s -X POST "$PB/api/collections/live_answers/records" \
    -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
    -d "{\"session\":\"$LIVE_SESS\",\"player\":\"checkpb\",\"item\":0,\"value\":\"x\",\"scored\":false,\"points\":0}" | jq -r '.id // empty')
  LIVE_PLR=$(curl -s -X POST "$PB/api/collections/live_players/records" \
    -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
    -d "{\"session\":\"$LIVE_SESS\",\"name\":\"CheckPB\"}" | jq -r '.id // empty')

  # 1) AUTO-PUNTUARSE (el ataque que neutralizaba C6 entero).
  SC=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$PB/api/collections/live_answers/records/$LIVE_ANS" \
    -H "Content-Type: application/json" -d '{"scored":true,"correct":true,"points":9999}')
  { [ "$SC" = "403" ] || [ "$SC" = "400" ]; } \
    && green "auto-puntuarse una respuesta bloqueado ($SC)" \
    || red "auto-puntuarse una respuesta" "devolvió $SC — un alumno puede inflar su puntaje desde DevTools"

  # 2) El alumno SÍ debe poder corregir su valor (si esto falla, se rompe el juego).
  SC=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$PB/api/collections/live_answers/records/$LIVE_ANS" \
    -H "Content-Type: application/json" -d '{"value":"y","ms":123}')
  [ "$SC" = "200" ] && green "el alumno sí puede corregir su respuesta ($SC)" \
    || red "corregir la propia respuesta" "devolvió $SC — la regla quedó DEMASIADO cerrada (rompe carrera y tablero)"

  # 3) CONTROLAR LA SALA (terminarla, saltar pregunta, tocar puntajes).
  SC=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$PB/api/collections/live_sessions/records/$LIVE_SESS" \
    -H "Content-Type: application/json" -d '{"state":{"status":"ended"}}')
  { [ "$SC" = "403" ] || [ "$SC" = "400" ]; } \
    && green "controlar la sala (blob state) bloqueado ($SC)" \
    || red "controlar la sala" "devolvió $SC — un alumno puede terminar la clase o saltar preguntas"

  # 4) PEDIR LA PALABRA sí debe funcionar (Pregunta en Vivo, campo `ql`).
  SC=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$PB/api/collections/live_sessions/records/$LIVE_SESS" \
    -H "Content-Type: application/json" -d '{"ql":{"open":1,"by":"checkpb"}}')
  [ "$SC" = "200" ] && green "pedir la palabra sí funciona ($SC)" \
    || red "pedir la palabra (campo ql)" "devolvió $SC — Pregunta en Vivo se rompe (¿falta el campo ql?)"

  # 5) EXPULSAR a un compañero.
  SC=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$PB/api/collections/live_players/records/$LIVE_PLR")
  { [ "$SC" = "403" ] || [ "$SC" = "400" ]; } \
    && green "expulsar a un compañero bloqueado ($SC)" \
    || red "expulsar a un compañero" "devolvió $SC — cualquier alumno puede echar a otro"

  # 6) REABRIR una tarea cerrada / subirse el tope de intentos.
  ASG=$(curl -s -X POST "$PB/api/collections/assignments/records" -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" -d '{"code":"CHECKPBT","status":"closed","max_attempts":1}' | jq -r '.id // empty')
  if [ -n "$ASG" ]; then
    SC=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$PB/api/collections/assignments/records/$ASG" \
      -H "Content-Type: application/json" -d '{"status":"open","max_attempts":99}')
    { [ "$SC" = "403" ] || [ "$SC" = "400" ]; } \
      && green "reabrir tarea / subir intentos bloqueado ($SC)" \
      || red "reabrir tarea cerrada" "devolvió $SC — el gateo de tareas es solo de cliente"
    curl -s -o /dev/null -X DELETE "$PB/api/collections/assignments/records/$ASG" -H "Authorization: $TOKEN"
  fi

  # Limpieza del diagnóstico.
  [ -n "$LIVE_ANS" ] && curl -s -o /dev/null -X DELETE "$PB/api/collections/live_answers/records/$LIVE_ANS" -H "Authorization: $TOKEN"
  [ -n "$LIVE_PLR" ] && curl -s -o /dev/null -X DELETE "$PB/api/collections/live_players/records/$LIVE_PLR" -H "Authorization: $TOKEN"
  curl -s -o /dev/null -X DELETE "$PB/api/collections/live_sessions/records/$LIVE_SESS" -H "Authorization: $TOKEN"
fi

echo ""
echo "Resultado: $ok OK, $fail FALLA(S)."
[ "$fail" -eq 0 ] && echo "Todo verde ✅" || { echo "Hay fallos ❌ — pégaselos a Claude para arreglar antes de usar con alumnos."; exit 1; }
