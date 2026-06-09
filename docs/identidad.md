# Identidad y migración anónimo → cuenta

> Cómo persisten las actividades y cómo se "migran" cuando el docente entra con
> una cuenta real. Verificado contra `core/auth.js`, `core/supabase.js`,
> `core/storage.js` y `adapters/supabase/remoteStore.js`.

## El modelo
- Cada actividad se guarda con `author_id = uid del usuario`. La lista del Home
  muestra `author_id = uid_actual` (+ filas `author_id is null` heredadas).
- Al arrancar, si no hay sesión, se crea un usuario **anónimo** persistente
  (`ensureAuth` en `core/supabase.js`). **`ensureAuth` cachea la promesa en
  vuelo** para que llamadas concurrentes (boot + realtime + uploads) NO creen
  varios anónimos a la vez (ese era el origen de la dispersión de identidades).
- LocalStorage es la fuente de verdad de lectura, scopeado por uid
  (`ww.activities.<uid>`); `sync()` baja del backend y reconcilia.

## La migración: ENLAZAR, no copiar
Cuando un usuario **anónimo** entra con Google, `core/auth.js → signInWithGoogle`
llama a **`linkIdentity({ provider: 'google' })`**, que **enlaza** Google al
usuario anónimo actual:

- Se **preserva el mismo `user.id`** → todas sus actividades (que ya cuelgan de
  ese id) pasan a ser de la cuenta permanente **sin mover ni una fila** y sin
  chocar con RLS. La cuenta deja de ser anónima.
- Si el usuario **no** es anónimo (ya tiene cuenta), se hace login OAuth normal.

Por eso la consolidación previa de las actividades dispersas bajo **una** sola
identidad anónima (la del navegador del docente) es lo que hace la migración
trivial: al enlazar Google en ese navegador, ese id se vuelve permanente y se
lleva todo.

## Requisitos en el panel de Supabase (una vez)
1. **Auth → Providers → Google**: configurado (Client ID/Secret + redirect URI
   autorizada = la URL del sitio).
2. **Auth → Settings → Manual linking**: **activado** (lo necesita
   `linkIdentity`). Si está desactivado, la UI muestra un aviso pidiendo
   activarlo (no crea una cuenta nueva a tu espalda).
3. **Anonymous Sign-Ins**: activado (ya lo estaba).

## Plan B (si no se usa linking)
Si se prefiere no activar manual linking, al entrar con Google se crea una cuenta
nueva (uid distinto) y las actividades anónimas **no** la siguen. En ese caso la
migración es un `UPDATE author_id` de la identidad anónima al uid de Google
(las filas migradas guardan su `author_id` original en `data._prevAuthor`, así
que es un solo UPDATE verificable).

## Limitación conocida
El **registro por email** (`signUp`) aún crea cuenta nueva (no enlaza), porque el
cambio de email de un anónimo requiere confirmación. La vía recomendada para
conservar el trabajo es **Google** (enlace en el sitio). Pendiente: upgrade por
email vía `updateUser({ email, password })` con su flujo de confirmación.
