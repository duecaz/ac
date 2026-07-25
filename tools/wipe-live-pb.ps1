<#
  wipe-live-pb.ps1 — vacía las colecciones EFÍMERAS de PocketBase (datos de
  partidas en vivo, resultados e intentos de tarea). Sirve para poder crear el
  índice ÚNICO (session,player,item) de live_answers sin chocar con filas
  duplicadas de partidas viejas.

  NO toca `activities` ni `profiles` ni `users` — tus actividades quedan intactas.
  Solo borra FILAS, no colecciones (las reglas/campos/índices se conservan).

  Uso:
    ./wipe-live-pb.ps1 -PbUrl "https://pb.lanube.uno"
  Te pedirá el email y la contraseña de SUPERADMIN de PocketBase (no se guardan).

  Tras correrlo: en la web → #/admin → "Crear colecciones" (creará el índice).
#>
param([string]$PbUrl = "https://pb.lanube.uno")

$email = Read-Host "Email superadmin PB"
$sec   = Read-Host "Password superadmin" -AsSecureString
$pass  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
           [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

function Auth {
  foreach ($p in @("_superusers","admins")) {
    try {
      $r = Invoke-RestMethod -Method Post -Uri "$PbUrl/api/collections/$p/auth-with-password" `
        -ContentType "application/json" -Body (@{ identity = $email; password = $pass } | ConvertTo-Json)
      return $r.token
    } catch { }
  }
  throw "No se pudo autenticar como superadmin. Revisa la URL, el email y la contraseña."
}

$token = Auth
$H = @{ Authorization = $token }

# SOLO colecciones efímeras (datos de juego/resultados). Nunca activities/profiles/users.
foreach ($c in @("live_answers","live_players","live_sessions","results","assignment_attempts")) {
  $deleted = 0
  while ($true) {
    try { $page = Invoke-RestMethod -Uri "$PbUrl/api/collections/$c/records?perPage=200" -Headers $H }
    catch { Write-Host "  $c: (no existe o sin acceso) — se omite"; break }
    if (-not $page.items -or $page.items.Count -eq 0) { break }
    foreach ($r in $page.items) {
      try { Invoke-RestMethod -Method Delete -Uri "$PbUrl/api/collections/$c/records/$($r.id)" -Headers $H | Out-Null; $deleted++ } catch { }
    }
  }
  Write-Host "  $c: $deleted fila(s) borrada(s)"
}

Write-Host ""
Write-Host "Listo. Ahora en la web: #/admin -> 'Crear colecciones' (creara el indice unico de live_answers)."
