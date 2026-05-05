// Lazy Supabase client + anonymous auth. Uses dynamic import so a network
// failure on the SDK doesn't blank the page (the error boundary catches it).
let _client = null;
let _user = null;

export async function getClient() {
  if (_client) return _client;
  const [{ createClient }, cfg] = await Promise.all([
    import('https://esm.sh/@supabase/supabase-js@2'),
    import('../supabase.config.js')
  ]);
  _client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ww.auth' },
    realtime: { params: { eventsPerSecond: 10 } }
  });
  // Invalidate _user whenever auth state changes (signOut, token refresh,
  // OAuth callback, anonymous sign-in). Without this, code calling ensureAuth
  // after a logout would keep returning the previous user.
  _client.auth.onAuthStateChange((_evt, session) => {
    _user = session?.user || null;
  });
  return _client;
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
