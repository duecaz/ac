#!/usr/bin/env bash
# REGLAS DE `users` EN LA Pi — aplicar, PROBAR y limpiar.
#
#   ssh duecaz@pio.local
#   git -C ~/ac pull && bash ~/ac/tools/pb-reglas-users.sh
#
# Por qué existe como fichero y no como bloque para pegar: el pegado por SSH se
# comió el bloque DOS veces (2026-08-11) — media línea perdida y el script hace
# otra cosa. Un fichero versionado viaja entero y, además, deja la regla junto al
# código que la necesita.
#
# Por qué NO lo hace el panel `#/admin`: `users` es la colección de AUTH; tocar
# su esquema desde el navegador es la clase de accidente que te deja sin poder
# entrar. Las reglas se declaran UNA vez en `core/pbRules.js` (USERS_RULES) y
# `tests/pbRules.test.mjs` comprueba que este script y el .ps1 dicen lo mismo.
#
# El superadmin se teclea aquí y NUNCA queda en el historial ni viaja al chat.
set -euo pipefail

PB="${PB:-http://127.0.0.1:8090}"

read -rp "Email superadmin: " PB_EMAIL
read -rsp "Contraseña superadmin: " PB_PASS; echo
export PB PB_EMAIL PB_PASS

python3 - <<'PY'
import json, os, urllib.parse, urllib.request, urllib.error

PB = os.environ['PB']

def req(path, data=None, tok=None, method=None):
    r = urllib.request.Request(
        PB + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': tok} if tok else {})},
        method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            cuerpo = resp.read()          # DELETE responde 204 SIN cuerpo
            return resp.status, (json.loads(cuerpo) if cuerpo else {})
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}

# ── Las reglas: copia literal de USERS_RULES (core/pbRules.js) ───────────────
REGLAS = {
    'viewRule':   'id = @request.auth.id || @request.auth.role = "admin"',
    'listRule':   '@request.auth.role = "admin"',
    'createRule': '@request.body.role:isset = false || @request.auth.role = "admin"',
}

st, d = req('/api/collections/_superusers/auth-with-password',
            {'identity': os.environ['PB_EMAIL'], 'password': os.environ['PB_PASS']})
tok = d.get('token', '')
if not tok:
    # PocketBase < 0.23 usaba /api/admins
    st, d = req('/api/admins/auth-with-password',
                {'identity': os.environ['PB_EMAIL'], 'password': os.environ['PB_PASS']})
    tok = d.get('token', '')
print('auth:', 'OK' if tok else f'FALLO ({st}) — ¿credenciales?')
if not tok:
    raise SystemExit(1)

st, d = req('/api/collections/users', REGLAS, tok, 'PATCH')
print('aplicar reglas:', st)
print('  createRule →', d.get('createRule'))
if st != 200:
    print('  ✗ no se aplicaron:', d.get('message', ''))
    raise SystemExit(1)

# ── La PUERTA, probada de verdad (no basta con que el PATCH diga 200) ────────
CORREO = 'prueba-regla@test.local'
st1, d1 = req('/api/collections/users/records',
              {'email': CORREO, 'password': 'clave12345',
               'passwordConfirm': 'clave12345', 'name': 'Prueba Regla'})
print(f'alta SIN role → {st1}', '✓' if st1 == 200 else '✗ (debería ser 200: el profe no se puede registrar)')
st2, _ = req('/api/collections/users/records',
             {'email': 'prueba-regla2@test.local', 'password': 'clave12345',
              'passwordConfirm': 'clave12345', 'name': 'Colado', 'role': 'admin'})
print(f'alta CON role → {st2}', '✓' if st2 == 400 else '✗ (debería ser 400: alguien puede registrarse como ADMIN)')

# ── Limpieza: ninguna cuenta de prueba se queda en la base ───────────────────
st, d = req('/api/collections/users/records?perPage=50&filter='
            + urllib.parse.quote("email~'prueba-regla'"), None, tok)
sobras = d.get('items', [])
for u in sobras:
    s, _ = req(f"/api/collections/users/records/{u['id']}", None, tok, 'DELETE')
    print('  borrada la cuenta de prueba', u['email'], '→', s)

bien = st1 == 200 and st2 == 400
print('\n' + ('✅ REGLAS DE users APLICADAS Y PROBADAS' if bien
              else '❌ LA PUERTA NO SE COMPORTA — pégale esta salida a Claude'))
raise SystemExit(0 if bien else 1)
PY

unset PB_EMAIL PB_PASS
