// Auth facade. Wraps Supabase auth + profiles.
import { getClient } from './supabase.js';

let _user = null;
let _profile = null;
const listeners = new Set();

export async function getUser() {
  if (_user !== null) return _user;
  const sb = await getClient();
  const { data } = await sb.auth.getUser();
  _user = data?.user || null;
  return _user;
}

export async function getProfile() {
  if (_profile) return _profile;
  const u = await getUser();
  if (!u) return null;
  const sb = await getClient();
  const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
  _profile = data || null;
  return _profile;
}

export async function signUp(email, password, displayName) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { display_name: displayName || email.split('@')[0] } }
  });
  if (error) throw error;
  _user = data.user; _profile = null;
  notify();
  return data;
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _user = data.user; _profile = null;
  notify();
  return data;
}

export async function signInWithGoogle() {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname }
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut();
  _user = null; _profile = null;
  // Re-trigger anonymous auth so the app keeps working.
  await sb.auth.signInAnonymously();
  notify();
}

export async function updateProfile(patch) {
  const u = await getUser();
  if (!u) throw new Error('not signed in');
  const sb = await getClient();
  const { data, error } = await sb.from('profiles').update(patch).eq('id', u.id).select().single();
  if (error) throw error;
  _profile = data;
  notify();
  return data;
}

export function isAnonymous(user) {
  return !!user && (user.is_anonymous || !user.email);
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { for (const fn of listeners) fn({ user: _user, profile: _profile }); }

// Reset cache when Supabase auth changes externally (token refresh, OAuth callback).
(async () => {
  const sb = await getClient();
  sb.auth.onAuthStateChange((_evt, session) => {
    _user = session?.user || null;
    _profile = null;
    notify();
  });
})();
