// The Supabase client loads only when the leaderboard is first used, so it never slows the first screen.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// false when the keys are missing: the app still runs, the world leaderboard just stays off
export const online = !!(url && key);

// Some calls skip the library and go straight to the database's web address (see rest() in leaderboard.js):
// saving progress has to work while the page closes, and before the library has loaded.
export const restUrl = online ? `${url.replace(/\/+$/, '')}/rest/v1/rpc/` : '';
export const restHeaders = online ? { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } : {};

let client = null;
export function getSupabase() {
  if (!online) return Promise.resolve(null);
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    );
    // a failed download (offline) can be tried again later
    client.catch(() => { client = null; });
  }
  return client;
}
