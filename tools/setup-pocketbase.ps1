<#
  setup-pocketbase.ps1 — configura la base de datos de AulaReto en PocketBase.
  Idempotente: se puede re-correr sin miedo (crea lo que falte, actualiza reglas,
  añade campos que falten SIN borrar los existentes, crea índices).

  Uso:
    ./setup-pocketbase.ps1 -PbUrl "https://pb.lanube.uno"
  Te pedirá el email y la contraseña de SUPERADMIN de PocketBase.

  Requiere PowerShell 5+ (Windows) o PowerShell 7 (pwsh). Diseñado para PocketBase
  0.23+. Ver docs/handoff-esquema-pb.md para el diseño del esquema.
#>
param(
  [string]$PbUrl = "https://pb.lanube.uno",
  [string]$AdminEmail,
  [string]$AdminPassword
)

$ErrorActionPreference = "Stop"
if (-not $AdminEmail)    { $AdminEmail    = Read-Host "Email de superadmin PB" }
if (-not $AdminPassword) { $AdminPassword = Read-Host "Password de superadmin PB" }

function Auth {
  foreach ($p in @("_superusers","admins")) {
    try {
      $r = Invoke-RestMethod -Method Post -Uri "$PbUrl/api/collections/$p/auth-with-password" `
        -ContentType "application/json" -Body (@{ identity = $AdminEmail; password = $AdminPassword } | ConvertTo-Json)
      return $r.token
    } catch { }
  }
  throw "No se pudo autenticar como superadmin. Revisa la URL, el email y la contraseña."
}

$token = Auth
$H = @{ Authorization = $token }

function Get-Col($name) {
  try { return Invoke-RestMethod -Uri "$PbUrl/api/collections/$name" -Headers $H } catch { return $null }
}

# Campos de sistema created/updated (autodate) para ordenar por -updated / -created.
$sysFields = @(
  @{ name = "created"; type = "autodate"; onCreate = $true;  onUpdate = $false },
  @{ name = "updated"; type = "autodate"; onCreate = $true;  onUpdate = $true  }
)

# Definición de colecciones base (name → fields, rules, indexes).
$defs = @(
  @{ name = "activities";
     fields = @(
       @{ name="data"; type="json"; maxSize=5242880 },
       @{ name="owner"; type="text" },
       @{ name="visibility"; type="text" },
       @{ name="tags"; type="json"; maxSize=2000000 },
       @{ name="language"; type="text" }
     );
     indexes = @(
       "CREATE INDEX ``idx_act_owner`` ON ``activities`` (``owner``)",
       "CREATE INDEX ``idx_act_vis``   ON ``activities`` (``visibility``)"
     );
     # U1 ENDURECIDO: sin cláusula transitoria owner="" y crear exige sesión + ser
     # tu propio owner (nadie anónimo crea; nadie edita/borra ajenas salvo admin).
     rules = @{
       listRule   = 'visibility = "public" || owner = @request.auth.id || @request.auth.role = "admin"';
       viewRule   = 'visibility = "public" || owner = @request.auth.id || @request.auth.role = "admin"';
       createRule = '@request.auth.id != "" && owner = @request.auth.id';
       updateRule = 'owner = @request.auth.id || @request.auth.role = "admin"';
       deleteRule = 'owner = @request.auth.id || @request.auth.role = "admin"'
     } },

  @{ name = "activity_likes";
     fields = @( @{ name="activity"; type="text"; required=$true }, @{ name="user"; type="text"; required=$true } );
     indexes = @( "CREATE UNIQUE INDEX ``idx_like_act_user`` ON ``activity_likes`` (``activity``, ``user``)" );
     rules = @{
       listRule=""; viewRule="";
       createRule='@request.auth.id != "" && user = @request.auth.id';
       updateRule=$null;
       deleteRule='@request.auth.id != "" && user = @request.auth.id'
     } },

  @{ name = "reports";
     fields = @( @{ name="activity"; type="text"; required=$true }, @{ name="by"; type="text" }, @{ name="reason"; type="text" } );
     indexes = @();
     rules = @{
       createRule='@request.auth.id != ""';
       listRule='@request.auth.role = "admin"'; viewRule='@request.auth.role = "admin"';
       updateRule=$null; deleteRule='@request.auth.role = "admin"'
     } },

  # Perfil PÚBLICO del profe (colegio/frase/avatar) — separado de users (email privado).
  @{ name = "profiles";
     fields = @( @{ name="owner"; type="text"; required=$true }, @{ name="name"; type="text" }, @{ name="school"; type="text" }, @{ name="bio"; type="text" }, @{ name="avatar"; type="text" } );
     indexes = @( "CREATE UNIQUE INDEX ``idx_profile_owner`` ON ``profiles`` (``owner``)" );
     rules = @{
       listRule=""; viewRule="";
       createRule='@request.auth.id != "" && owner = @request.auth.id';
       updateRule='owner = @request.auth.id';
       deleteRule='owner = @request.auth.id'
     } },

  @{ name = "results";
     fields = @(
       @{ name="activity_id"; type="text" }, @{ name="session_id"; type="text" }, @{ name="user_id"; type="text" },
       @{ name="player_name"; type="text" }, @{ name="score_auto"; type="number" }, @{ name="score_final"; type="number" },
       @{ name="max_score"; type="number" }, @{ name="time_used"; type="number" }, @{ name="overrides"; type="json"; maxSize=200000 }
     );
     indexes = @();
     rules = @{ createRule=""; listRule='@request.auth.id != ""'; viewRule='@request.auth.id != ""'; updateRule=$null; deleteRule=$null } },

  # Alumno anónimo — se dejan públicas por ahora (deuda A / live aparte).
  @{ name = "live_sessions";
     fields = @( @{ name="code"; type="text"; required=$true }, @{ name="activity"; type="json"; maxSize=5242880 }, @{ name="state"; type="json"; maxSize=5242880 }, @{ name="status"; type="text" } );
     indexes = @( "CREATE INDEX ``idx_ls_code`` ON ``live_sessions`` (``code``)" );
     rules = @{ listRule=""; viewRule=""; createRule=""; updateRule=""; deleteRule="" } },

  @{ name = "live_answers";
     fields = @( @{ name="session"; type="text"; required=$true }, @{ name="player"; type="text"; required=$true }, @{ name="item"; type="number" }, @{ name="value"; type="json"; maxSize=200000 }, @{ name="ms"; type="number" }, @{ name="scored"; type="bool" }, @{ name="correct"; type="bool" }, @{ name="points"; type="number" }, @{ name="v0"; type="json"; maxSize=200000 }, @{ name="c0"; type="bool" } );
     indexes = @( "CREATE INDEX ``idx_la_session`` ON ``live_answers`` (``session``)", "CREATE UNIQUE INDEX ``idx_la_session_player_item`` ON ``live_answers`` (``session``, ``player``, ``item``)" );
     rules = @{ listRule=""; viewRule=""; createRule=""; updateRule=""; deleteRule="" } },

  # live_players (deuda A): una fila por jugador → los joins concurrentes no se
  # pisan en el blob. Índice UNICO (session,name) = apodos únicos atómicos.
  @{ name = "live_players";
     fields = @( @{ name="session"; type="text"; required=$true }, @{ name="name"; type="text"; required=$true }, @{ name="user_id"; type="text" } );
     indexes = @( "CREATE UNIQUE INDEX ``idx_lp_session_name`` ON ``live_players`` (``session``, ``name``)" );
     rules = @{ listRule=""; viewRule=""; createRule=""; updateRule=""; deleteRule="" } },

  @{ name = "assignments";
     fields = @( @{ name="code"; type="text"; required=$true }, @{ name="activity_id"; type="text" }, @{ name="activity_snap"; type="json"; maxSize=5242880 }, @{ name="author_id"; type="text" }, @{ name="title"; type="text" }, @{ name="due_at"; type="text" }, @{ name="max_attempts"; type="number" }, @{ name="status"; type="text" } );
     indexes = @( "CREATE INDEX ``idx_asg_code`` ON ``assignments`` (``code``)" );
     rules = @{ listRule=""; viewRule=""; createRule=""; updateRule=""; deleteRule="" } },

  @{ name = "assignment_attempts";
     fields = @( @{ name="assignment_id"; type="text" }, @{ name="activity_id"; type="text" }, @{ name="user_id"; type="text" }, @{ name="player_name"; type="text" }, @{ name="score_auto"; type="number" }, @{ name="score_final"; type="number" }, @{ name="max_score"; type="number" }, @{ name="time_used"; type="number" }, @{ name="answers"; type="json"; maxSize=200000 } );
     indexes = @();
     rules = @{ createRule=""; listRule='@request.auth.id != ""'; viewRule='@request.auth.id != ""'; updateRule=$null; deleteRule=$null } }
)

function Merge-Fields($existing, $wanted) {
  # Añade los campos que falten (por nombre) sin tocar los existentes.
  $names = @(); if ($existing) { $names = $existing | ForEach-Object { $_.name } }
  $out = @(); if ($existing) { $out += $existing }
  foreach ($f in $wanted) { if ($names -notcontains $f.name) { $out += $f } }
  return $out
}

function Apply-Collection($def) {
  $existing = Get-Col $def.name
  $wantFields = @($def.fields + $sysFields)
  $body = @{}
  foreach ($k in $def.rules.Keys) { $body[$k] = $def.rules[$k] }
  if ($def.indexes) { $body["indexes"] = $def.indexes }

  if ($existing) {
    # Merge de campos (no borrar) + reglas + índices.
    $body["fields"] = Merge-Fields $existing.fields $wantFields
    Invoke-RestMethod -Method Patch -Uri "$PbUrl/api/collections/$($existing.id)" -Headers $H `
      -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host "  ~ $($def.name): reglas/campos/índices actualizados" -ForegroundColor Yellow
  } else {
    $body["name"] = $def.name; $body["type"] = "base"; $body["fields"] = $wantFields
    Invoke-RestMethod -Method Post -Uri "$PbUrl/api/collections" -Headers $H `
      -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host "  + $($def.name): creada" -ForegroundColor Green
  }
}

# --- users (auth): SOLO reglas admin. NO tocamos el esquema de la colección de
# auth (email/password/etc.) para no arriesgar el login. El campo `role` se añade
# a mano en PB (Collections → users → New field → role, text, minúscula). ---
function Apply-Users {
  $u = Get-Col "users"
  if (-not $u) { Write-Host "  ! users no existe. Sáltalo." -ForegroundColor Red; return }
  $hasRole = ($u.fields | ForEach-Object { $_.name }) -contains "role"
  if (-not $hasRole) {
    Write-Host "  ! users NO tiene el campo 'role'. Añádelo a mano en PB (Plain text, nombre 'role' en minúscula) y re-corre este script." -ForegroundColor Red
  }
  # U1: alta de cuentas de correo SOLO por admin (el signup público se retiró; el
  # alta de autoservicio queda por Google/OAuth). OJO: en PocketBase el login
  # con OAuth2 NO pasa por createRule, así que cerrar create no impide el primer
  # login con Google — solo bloquea el signup anónimo por correo.
  $body = @{
    viewRule   = 'id = @request.auth.id || @request.auth.role = "admin"'
    listRule   = '@request.auth.role = "admin"'
    createRule = '@request.auth.role = "admin"'
  }
  Invoke-RestMethod -Method Patch -Uri "$PbUrl/api/collections/$($u.id)" -Headers $H `
    -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host "  ~ users: reglas admin aplicadas (view/list/create)" -ForegroundColor Yellow
}

Write-Host "Configurando PocketBase en $PbUrl ..." -ForegroundColor Cyan
try { Apply-Users } catch {
  Write-Host "  x users: ERROR — $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host "    $($_.ErrorDetails.Message)" -ForegroundColor DarkRed }
}
foreach ($d in $defs) {
  try { Apply-Collection $d } catch {
    Write-Host "  x $($d.name): ERROR — $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host "    $($_.ErrorDetails.Message)" -ForegroundColor DarkRed }
  }
}
Write-Host "Listo. Si algo salió en rojo, pégamelo y lo ajustamos." -ForegroundColor Cyan
Write-Host "Recuerda: pon role='admin' (minúscula) en tu fila de 'users', y en la web haz Salir/Entrar." -ForegroundColor Cyan
