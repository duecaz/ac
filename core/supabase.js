// Lazy Supabase client + anonymous auth. Uses dynamic import so a network
// failure on the SDK doesn't blank the page (the error boundary catches it).
let _client = null;
let _clientPromise = null; // in-flight init, so concurrent callers share one client
let _user = null;

export async function getClient() {
  if (_client) return _client;
  // Cache the in-flight promise: without this, two callers racing before the
  // first createClient resolves would each build a client with the same
  // storageKey → "Multiple GoTrueClient instances detected" warning.
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    const [{ createClient }, cfg] = await Promise.all([
      import('https://esm.sh/@supabase/supabase-js@2'),
      import('../supabase.config.js')
    ]);
    const client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      // All app tables live in the dedicated `repo_ac` schema (namespaced so this
      // shared Supabase project clearly identifies the `ac` repo's data). The
      // schema must be added to API → Exposed schemas in the dashboard.
      db: { schema: 'repo_ac' },
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ww.auth' },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    // Invalidate _user whenever auth state changes (signOut, token refresh,
    // OAuth callback, anonymous sign-in). Without this, code calling ensureAuth
    // after a logout would keep returning the previous user.
    client.auth.onAuthStateChange((_evt, session) => {
      _user = session?.user || null;
    });
    _client = client;
    return client;
  })();
  return _clientPromise;
}

export async function ensureAuth() {
  const sb = await getClient();
  if (_user) return _user;
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) { _user = session.user; return _user; }
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw new Error('Anonymous Sign-In no está activado en Supabase. Auth → Providers.');
  _user = data.user;
  return _user;
}
