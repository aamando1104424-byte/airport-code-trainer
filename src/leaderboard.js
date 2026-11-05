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
  slow_down: 'Too fast. Wait a few seconds and try again.',
  bad_score: 'That score could not be posted.',
  bad_board: "That leaderboard doesn't exist.",
};
function toError(error) {
  const msg = error?.message || '';
  for (const code in MESSAGES) {
    if (msg.includes(code)) return Object.assign(new Error(MESSAGES[code]), { code });
  }
  return Object.assign(new Error("Couldn't reach the leaderboard. Check your connection and try again."), { code: 'network' });
}
async function rpc(fn, args) {
  if (!supabase) throw Object.assign(new Error('The world leaderboard is not set up yet.'), { code: 'offline' });
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toError(error);
  return data;
}

export const claimName = (name) => rpc('claim_name', { p_name: name });
export const signIn = (name, code) => rpc('sign_in', { p_name: name, p_code: cleanCode(code) });
export const submitScore = (acc, r) =>
  rpc('submit_score', {
    p_name: acc.name,
    p_code: acc.code,
    p_game: r.game,
    p_level: r.level,
    p_score: Math.round(r.score),
    p_wave: Math.max(1, Math.round(r.wave || 1)),
    p_map: r.map || 'Wyoming',
  });
export const getLeaderboard = (game, level, limit = 25) => rpc('get_leaderboard', { p_game: game, p_level: level, p_limit: limit });
export const getNotices = (acc) => rpc('my_notices', { p_name: acc.name, p_code: acc.code });
export const dismissNotices = (acc) => rpc('dismiss_notices', { p_name: acc.name, p_code: acc.code });
export const getMyScores = (acc) => rpc('my_scores', { p_name: acc.name, p_code: acc.code });
