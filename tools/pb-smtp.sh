#!/usr/bin/env bash
# CORREO SALIENTE DE POCKETBASE — configurar y PROBAR de verdad.
#
#   ssh duecaz@pio.local
#   git -C ~/ac pull && bash ~/ac/tools/pb-smtp.sh
#
# QUÉ ES ESTO Y QUÉ NO. No se toca la base de datos ni se escribe código en la
# Pi: enviar correo es un AJUSTE de PocketBase (el mismo que hay en su panel,
# Settings → Mail settings). Se hace por script y no a mano en el panel para
# que quede constancia de qué se configuró, y sobre todo para PROBARLO: un SMTP
# «guardado» que no envía se descubre el día que un profe pierde la contraseña.
#
# PARA QUÉ SIRVE, hoy: «¿Olvidaste tu contraseña?» del modal de entrar. Sin
# correo saliente, ese botón no puede existir — por eso todavía no está puesto.
# Con esto configurado, se activa (el código ya existe: requestPasswordReset()
# en core/auth.js).
#
# QUÉ NECESITAS ANTES — un proveedor de envío. NO vale «el correo del colegio»
# sin más: hace falta un servidor SMTP con usuario y clave. Dos caminos:
#
#   · Brevo (recomendado, gratis 300 correos/día, sin tarjeta)
#       Alta en brevo.com → SMTP & API → SMTP → crear una clave.
#       host: smtp-relay.sendinblue.com   puerto: 587   TLS: sí (STARTTLS)
#       OJO con el host: Brevo se llamaba Sendinblue y su certificado sigue
#       emitido para `*.sendinblue.com`. Si pones `smtp-relay.brevo.com` —el
#       nombre que ellos mismos publican— la conexión se cae antes de enviar:
#         x509: certificate is valid for …sendinblue.com, not smtp-relay.brevo.com
#       Son los MISMOS servidores; usando el nombre del certificado, el cifrado
#       se verifica de verdad y no hay que desactivar nada.
#       usuario: el que te dé Brevo (algo como 8a1b2c001@smtp-brevo.com)
#       clave:   la clave SMTP que generas ahí
#       remitente: un correo TUYO ya verificado en Brevo.
#
#   · Gmail (solo si ya usas Google Workspace del colegio)
#       Requiere verificación en 2 pasos Y una «contraseña de aplicación»
#       (myaccount.google.com → Seguridad). La contraseña normal NO funciona.
#       host: smtp.gmail.com   puerto: 587   TLS: sí   usuario: tu correo
#
# El superadmin y la clave SMTP se teclean aquí y NUNCA quedan en el historial
# ni viajan al chat (misma regla que tools/pb-reglas-users.sh).
set -euo pipefail

PB="${PB:-http://127.0.0.1:8090}"

echo "── Credenciales de PocketBase (no se guardan) ──"
read -rp  "Email superadmin: " PB_EMAIL
read -rsp "Contraseña superadmin: " PB_PASS; echo

echo
echo "── Datos del proveedor de correo ──"
read -rp  "Host SMTP [smtp-relay.sendinblue.com]: " SMTP_HOST
SMTP_HOST="${SMTP_HOST:-smtp-relay.sendinblue.com}"
# Se CORRIGE, no se avisa: el nombre que Brevo publica no coincide con su propio
# certificado, y equivocarse cuesta una vuelta entera del script (pasó).
if [[ "$SMTP_HOST" == *brevo.com ]]; then
  echo "   ⚠️ «$SMTP_HOST» no coincide con el certificado de Brevo (emitido para"
  echo "      *.sendinblue.com). Se usa smtp-relay.sendinblue.com — mismos servidores."
  SMTP_HOST="smtp-relay.sendinblue.com"
fi
read -rp  "Puerto [587]: " SMTP_PORT
SMTP_PORT="${SMTP_PORT:-587}"
read -rp  "Usuario SMTP: " SMTP_USER
read -rsp "Clave SMTP: " SMTP_PASS; echo
echo "   (el remitente debe estar VERIFICADO en el proveedor: en Brevo, Senders"
echo "    & IP → Senders. Un dominio propio como noresponder@tudominio.com exige"
echo "    además verificar el dominio con sus registros DNS.)"
read -rp  "Remitente (correo que verá el profe) [$PB_EMAIL]: " FROM_ADDR
FROM_ADDR="${FROM_ADDR:-$PB_EMAIL}"
# Limpiar lo invisible (espacios raros, marcas de dirección que pega el móvil o
# el portapapeles) ANTES de mandarlo: PocketBase solo dice «no es un correo».
# Se conserva SOLO lo que puede aparecer en una dirección: así un espacio de
# ancho cero pegado desde el móvil o los <> del portapapeles no llegan a
# PocketBase, que solo sabría decir «no es un correo». Se limpia y se ENSEÑA.
FROM_ADDR="$(printf '%s' "$FROM_ADDR" | tr -cd 'A-Za-z0-9._%+@-')"
if ! printf '%s' "$FROM_ADDR" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo
  echo "❌ El remitente no es un correo válido. Esto es lo que se ha capturado,"
  echo "   entre comillas para que se vea si hay algo raro:  «$FROM_ADDR»"
  printf '   bytes: '; printf '%s' "$FROM_ADDR" | od -c | head -2
  echo "   Vuelve a correrlo y tecléalo (no lo pegues): el portapapeles cuela"
  echo "   caracteres invisibles que PocketBase rechaza sin decir cuál."
  exit 1
fi
echo "   remitente: «$FROM_ADDR»"
read -rp  "Nombre del remitente [AulaReto]: " FROM_NAME
FROM_NAME="${FROM_NAME:-AulaReto}"
read -rp  "Correo al que mandar la PRUEBA [$PB_EMAIL]: " TEST_TO
TEST_TO="${TEST_TO:-$PB_EMAIL}"

export PB PB_EMAIL PB_PASS SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS FROM_ADDR FROM_NAME TEST_TO

python3 - <<'PY'
import json, os, urllib.request, urllib.error

PB = os.environ['PB']

def req(path, data=None, tok=None, method=None):
    r = urllib.request.Request(
        PB + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': tok} if tok else {})},
        method=method)
    try:
        with urllib.request.urlopen(r, timeout=45) as resp:
            cuerpo = resp.read()
            return resp.status, (json.loads(cuerpo) if cuerpo else {})
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}
    except Exception as e:
        return 0, {'message': str(e)}

# ── Entrar como superadmin (0.23+ y, de respaldo, el camino viejo) ───────────
st, d = req('/api/collections/_superusers/auth-with-password',
            {'identity': os.environ['PB_EMAIL'], 'password': os.environ['PB_PASS']})
tok = d.get('token', '')
if not tok:
    st, d = req('/api/admins/auth-with-password',
                {'identity': os.environ['PB_EMAIL'], 'password': os.environ['PB_PASS']})
    tok = d.get('token', '')
print('auth:', 'OK' if tok else f'FALLO ({st}) — ¿credenciales?')
if not tok:
    raise SystemExit(1)

AJUSTES = {
    'smtp': {
        'enabled':    True,
        'host':       os.environ['SMTP_HOST'],
        'port':       int(os.environ['SMTP_PORT']),
        'username':   os.environ['SMTP_USER'],
        'password':   os.environ['SMTP_PASS'],
        # 587 = STARTTLS (tls=False y el servidor sube el cifrado);
        # 465 = TLS directo. Ponerlo al revés es el fallo más común.
        'tls':        int(os.environ['SMTP_PORT']) == 465,
        'authMethod': 'PLAIN',
    },
    'meta': {
        'senderName':    os.environ['FROM_NAME'],
        'senderAddress': os.environ['FROM_ADDR'],
    },
}

st, d = req('/api/settings', AJUSTES, tok, 'PATCH')
print('guardar ajustes:', st)
if st != 200:
    detalle = f"{d.get('message', '')} {d.get('data', '')}"
    print('  ✗ no se guardaron:', detalle)
    if 'senderAddress' in detalle:
        print(f"\n   PocketBase rechaza el remitente «{os.environ['FROM_ADDR']}».")
        print('   El formato ya se comprobó aquí, así que lo que no le gusta es el')
        print('   valor en sí. Sal del paso con tu propio correo como remitente')
        print(f"   ({os.environ['PB_EMAIL']}): la prueba de envío es lo que importa")
        print('   ahora, y el remitente definitivo se pone cuando el dominio esté')
        print('   verificado en el proveedor.')
    raise SystemExit(1)

# ── LA PRUEBA. Guardar no es enviar: PocketBase acepta cualquier host y solo
#    falla al intentarlo de verdad. Sin este paso, «configurado» es una promesa.
st, d = req('/api/settings/test/email',
            {'email': os.environ['TEST_TO'], 'template': 'password-reset',
             'collection': 'users'}, tok)
if st in (200, 204):
    print(f"\n✅ SMTP CONFIGURADO Y PROBADO — mira la bandeja de {os.environ['TEST_TO']}")
    print('   (revisa también SPAM: el primer correo de un remitente nuevo suele caer ahí)')
    print('\n   Siguiente paso, del lado del código: activar «¿Olvidaste tu contraseña?»')
    print('   en el modal de entrar (core/auth.js ya tiene requestPasswordReset).')
else:
    detalle = f"{d.get('message', '')} {d.get('data', '')}"
    print(f'\n❌ los ajustes se guardaron pero el envío FALLA ({st}):')
    print('  ', detalle)
    # El fallo de Brevo tiene nombre y una salida exacta: no dejar que se pierda
    # entre las causas genéricas, que mandan a mirar la clave y el remitente
    # cuando el problema es el NOMBRE del host.
    if 'x509' in detalle or 'certificate is valid for' in detalle:
        print('\n   ⚠️ ES EL NOMBRE DEL HOST, no tus credenciales.')
        print('      Brevo se llamaba Sendinblue y su certificado sigue emitido para')
        print('      *.sendinblue.com, así que `smtp-relay.brevo.com` no lo verifica.')
        print('      SOLUCIÓN: vuelve a correr este script y pon como host')
        print('          smtp-relay.sendinblue.com')
        print('      (mismos servidores, mismo usuario y clave; el cifrado se sigue')
        print('       verificando — no hace falta desactivar nada).')
        raise SystemExit(1)
    print('\n   Lo más habitual, por orden:')
    print('   · usuario/clave del proveedor mal (en Gmail hace falta contraseña de APLICACIÓN)')
    print('   · el remitente no está verificado en el proveedor')
    print('   · puerto 465 con tls=false o 587 con tls=true (este script lo deduce del puerto)')
    print('   · la Pi no puede salir al 587: pruébalo con  nc -vz %s %s'
          % (os.environ['SMTP_HOST'], os.environ['SMTP_PORT']))
    raise SystemExit(1)
PY
