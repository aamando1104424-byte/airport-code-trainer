// The Supabase client loads only when the leaderboard is first used, so it never slows the first screen.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// false when the keys are missing: the app still runs, the world leaderboard just stays off
export const online = !!(url && key);

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
