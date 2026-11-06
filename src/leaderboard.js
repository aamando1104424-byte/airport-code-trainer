import { supabase } from './supabase';

export const GAMES = {
  defender: { name: 'Air Defender', unit: 'Wave', levels: { cadet: 'Cadet', pilot: 'Pilot', ace: 'Ace' } },
  tower: { name: 'Tower Control', unit: 'Shift', levels: { trainee: 'Trainee', controller: 'Controller', chief: 'Chief' } },
};
export const boardName = (game, level) => `${GAMES[game]?.name ?? game} · ${GAMES[game]?.levels[level] ?? level}`;
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c) => cleanCode(c).replace(/(.{4})(?=.)/g, '$1-');

// The account lives in this browser: { name, code }
const KEY = 'wyo-account-v1';
export function loadAccount() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    return a && a.name && a.code ? a : null;
  } catch {
    return null;
  }
}
export function saveAccount(a) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the account just won't be remembered */
  }
}

const MESSAGES = {
  name_taken: 'That name is taken.',
  bad_login: "That name and account code don't match.",
  bad_name: 'Names are 3 to 16 letters, numbers or underscores.',
  name_blocked: "Pick a different name. That one isn't allowed.",
  slow_down: 'Too fast. Wait a few seconds and try again.',
  bad_score: 'That score could not be posted.',
  bad_board: "That leaderboard doesn't exist.",
  bad_run: "This round can't be posted. It may have started while you were offline.",
};
function toError(error) {
  const msg = error?.message || '';
  for (const code in MESSAGES) {
    if (msg.includes(code)) return Object.assign(new Error(MESSAGES[code]), { code });
  }
  return Object.assign(new Error("Couldn't reach the leaderboard. Check your connection and try again."), { code: 'network' });
}
async function rpc(fn, args, raw = false) {
  if (!supabase) throw Object.assign(new Error('The world leaderboard is not set up yet.'), { code: 'offline' });
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw raw ? error : toError(error);
  return data;
}
// A game asks for a round id when it starts. Posting needs it, so a score can't be made up from nothing.
// null if the leaderboard is off or the database hasn't been updated yet.
export const startRun = (game, level) => rpc('start_run', { p_game: game, p_level: level }).catch(() => null);

export const claimName = (name) => rpc('claim_name', { p_name: name });
export const signIn = (name, code) => rpc('sign_in', { p_name: name, p_code: cleanCode(code) });
export const submitScore = async (acc, r) => {
  const args = {
    p_name: acc.name,
    p_code: acc.code,
    p_game: r.game,
    p_level: r.level,
    p_score: Math.round(r.score),
    p_wave: Math.max(1, Math.round(r.wave || 1)),
    p_map: r.map || 'Wyoming',
  };
  let data;
  try {
    data = await rpc('submit_score', { ...args, p_run: r.run || null }, true);
  } catch (e) {
    // a database that hasn't run the newest schema.sql yet has no p_run: post the old way
    if (e?.code === 'PGRST202' || /p_run|function.*not find|Could not find the function/i.test(e?.message || '')) data = await rpc('submit_score', args);
    else throw toError(e);
  }
  // only a score that reaches the top 5 changes what the live boards show, so only then ping everyone
  if (data?.improved && data.rank <= 5) announce(r.game, r.level);
  return data;
};

// ---- live updates -------------------------------------------------------
// A new top-5 score is announced on a Supabase Realtime broadcast channel, so every
// open copy of the app refreshes its boards within a couple of seconds. Broadcast needs no
// table access, so the tables stay locked. Boards also re-check on a timer, so
// they still stay fresh if Realtime is ever unreachable.
const listeners = new Set();
let channel = null;
function liveChannel() {
  if (!supabase) return null;
  if (!channel) {
    channel = supabase.channel('act-board', { config: { broadcast: { self: true } } });
    channel.on('broadcast', { event: 'score' }, ({ payload }) => listeners.forEach((fn) => fn(payload || {})));
    channel.subscribe();
  }
  return channel;
}
function announce(game, level) {
  const c = liveChannel();
  // tell this tab right away too, in case the socket is still connecting
  listeners.forEach((fn) => fn({ game, level, local: true }));
  try {
    c?.send({ type: 'broadcast', event: 'score', payload: { game, level } });
  } catch {
    /* the timer refresh covers it */
  }
}
export function onBoardChange(fn) {
  listeners.add(fn);
  liveChannel();
  return () => listeners.delete(fn);
}
export const getLeaderboard = (game, level, limit = 25) => rpc('get_leaderboard', { p_game: game, p_level: level, p_limit: limit });
export const getNotices = (acc) => rpc('my_notices', { p_name: acc.name, p_code: acc.code });
export const dismissNotices = (acc) => rpc('dismiss_notices', { p_name: acc.name, p_code: acc.code });
export const getMyScores = (acc) => rpc('my_scores', { p_name: acc.name, p_code: acc.code });
