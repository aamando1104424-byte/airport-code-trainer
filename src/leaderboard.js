import { getSupabase, online } from './supabase';

export { online };
export const GAMES = {
  defender: { name: 'Air Defender', unit: 'Wave', levels: { cadet: 'Cadet', pilot: 'Pilot', ace: 'Ace' } },
  tower: { name: 'Tower Control', unit: 'Shift', levels: { trainee: 'Trainee', controller: 'Controller', chief: 'Chief' } },
};
export const isBoard = (game, level) => !!GAMES[game]?.levels[level];
export const boardName = (game, level) => `${GAMES[game]?.name ?? game} · ${GAMES[game]?.levels[level] ?? level}`;
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c) => cleanCode(c).replace(/(.{4})(?=.)/g, '$1-');
// account codes use 32 characters and never contain 0, O, 1 or I
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{12}$/;

// ---- the account on this device -------------------------------------------
// { name, code }. Kept in localStorage, or only for this tab's session on a shared computer.
const KEY = 'wyo-account-v1';
const BACKUP = 'wyo-backup-v1';
const store = (s) => { try { return s === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; } };
export function loadAccount() {
  for (const s of ['local', 'session']) {
    try {
      const a = JSON.parse(store(s)?.getItem(KEY) || 'null');
      if (a && a.name && a.code) return { name: a.name, code: a.code, shared: s === 'session' };
    } catch { /* try the next one */ }
  }
  return null;
}
export function saveAccount(a) {
  try {
    store('local')?.removeItem(KEY);
    store('session')?.removeItem(KEY);
    if (a) store(a.shared ? 'session' : 'local')?.setItem(KEY, JSON.stringify({ name: a.name, code: a.code }));
  } catch {
    /* private mode: the account just won't be remembered */
  }
}
// has this player copied, downloaded or typed their code at least once? Kept in the same place as the account
// (only for this tab on a shared computer). If storage is blocked there's nothing to nag about.
export function isBackedUp(name, shared = false) {
  try {
    const s = store(shared ? 'session' : 'local');
    if (!s) return true;
    return (JSON.parse(s.getItem(BACKUP) || '[]') || []).includes(String(name).toLowerCase());
  } catch { return true; }
}
export function markBackedUp(name, shared = false) {
  try {
    const s = store(shared ? 'session' : 'local');
    const l = JSON.parse(s?.getItem(BACKUP) || '[]') || [];
    const n = String(name).toLowerCase();
    if (!l.includes(n)) s?.setItem(BACKUP, JSON.stringify([...l, n].slice(-20)));
  } catch { /* nothing to do */ }
}
// a plain text file the player can keep
export function codeFileText(acc) {
  return [
    'Airport Code Trainer account',
    '',
    `Name: ${acc.name}`,
    `Account code: ${prettyCode(acc.code)}`,
    '',
    `To sign in on another phone or computer, open ${location.origin} , choose "Pick a name", then "I have a code".`,
    'Keep this code private. Anyone who has it can post scores as you, and it cannot be reset.',
    '',
  ].join('\r\n');
}

// ---- server calls -------------------------------------------------------------
const MESSAGES = {
  name_taken: 'That name is already taken. Pick another one, or if it is yours, sign back in with your code.',
  bad_login: "That name and code don't match.",
  bad_name: 'Names are 3 to 16 letters, numbers or underscores, with no spaces.',
  name_blocked: "That name isn't allowed here. Try another one (no rude words, even with numbers swapped in).",
  slow_down: 'Too many tries at once. Wait a minute and try again.',
  bad_score: 'That score could not be posted.',
  bad_board: "That leaderboard doesn't exist.",
  bad_run: "This round couldn't be posted. Play another round and it will count.",
};
function toError(error) {
  const msg = error?.message || '';
  for (const code in MESSAGES) {
    if (msg.includes(code)) return Object.assign(new Error(MESSAGES[code]), { code });
  }
  if (/fetch|network|Failed to|Load failed|timeout/i.test(msg) || !msg) {
    return Object.assign(new Error("Couldn't reach the leaderboard. Check your connection and try again."), { code: 'network' });
  }
  return Object.assign(new Error('Something went wrong on the leaderboard. Try again in a minute.'), { code: 'server' });
}
const missing = (e) => e?.code === 'PGRST202' || /Could not find the function|function .* does not exist/i.test(e?.message || '');
async function rpc(fn, args, raw = false) {
  const sb = await getSupabase().catch(() => null);
  if (!sb) {
    const e = online
      ? Object.assign(new Error("Couldn't reach the leaderboard. Check your connection and try again."), { code: 'network' })
      : Object.assign(new Error('The world leaderboard is not set up yet.'), { code: 'offline' });
    throw e;
  }
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), 15000); });
  let res;
  try {
    res = await Promise.race([sb.rpc(fn, args), timeout]);
  } catch (e) {
    throw Object.assign(new Error("Couldn't reach the leaderboard. Check your connection and try again."), { code: 'network' });
  } finally {
    clearTimeout(timer);
  }
  const { data, error } = res;
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
    if (missing(e) || /p_run/i.test(e?.message || '')) data = await rpc('submit_score', args);
    else throw toError(e);
  }
  // only a score that reaches the top 5 changes what the live boards show, so only then ping everyone
  if (data?.improved && data.rank <= 5) announce(r.game, r.level);
  return data;
};
export const getLeaderboard = (game, level, limit = 25) => rpc('get_leaderboard', { p_game: game, p_level: level, p_limit: limit });
// Several boards in one request (the home page shows two). Older databases don't have get_boards yet:
// then each board is fetched on its own, and get_boards isn't asked for again this visit.
let noBoardsFn = false;
export async function getBoards(keys, n = 5) {
  const want = [...new Set(keys)].filter((k) => isBoard(...k.split('/'))).slice(0, 6);
  if (!want.length) return {};
  if (!noBoardsFn) {
    try {
      const d = await rpc('get_boards', { p_keys: want }, true);
      const out = {};
      for (const k of want) out[k] = Array.isArray(d?.[k]) ? d[k].slice(0, n) : [];
      return out;
    } catch (e) {
      if (missing(e)) noBoardsFn = true;
      else throw toError(e);
    }
  }
  const rows = await Promise.all(want.map((k) => getLeaderboard(...k.split('/'), n)));
  return Object.fromEntries(want.map((k, i) => [k, rows[i] || []]));
}
export const getNotices = (acc) => rpc('my_notices', { p_name: acc.name, p_code: acc.code });
export const dismissNotices = (acc) => rpc('dismiss_notices', { p_name: acc.name, p_code: acc.code });
export const getMyScores = (acc) => rpc('my_scores', { p_name: acc.name, p_code: acc.code });

// ---- live updates -------------------------------------------------------
// A new top-5 score is announced on a Supabase Realtime broadcast channel so open copies refresh their boards.
// The socket only opens while a live board is on screen and the tab is visible, and closes a minute after that
// stops, so idle tabs don't use up the free plan's 200 connections. Boards also re-check on a timer.
// Anyone can send on a public channel, so incoming pings are checked and rate-limited before they trigger anything.
const listeners = new Set();
let channel = null;
let wanted = false;
let closeT = 0;
let lastPing = 0;
function deliver(payload) {
  const p = payload || {};
  if (!isBoard(p.game, p.level)) return;
  const now = Date.now();
  if (!p.local && now - lastPing < 3000) return; // ignore floods
  if (!p.local) lastPing = now;
  listeners.forEach((fn) => fn({ game: p.game, level: p.level, local: !!p.local }));
}
async function open() {
  if (channel || !online) return;
  channel = 'opening';
  const sb = await getSupabase().catch(() => null);
  if (!sb || channel !== 'opening' || !shouldOpen()) { if (channel === 'opening') channel = null; return; }
  try {
    const c = sb.channel('act-board', { config: { broadcast: { self: false } } });
    c.on('broadcast', { event: 'score' }, ({ payload }) => deliver(payload));
    c.subscribe();
    channel = c;
  } catch {
    channel = null; // the timer refresh covers it; the next update() tries again
  }
}
async function close() {
  const c = channel;
  channel = null;
  if (c && c !== 'opening') {
    try { const sb = await getSupabase(); await sb?.removeChannel(c); } catch { /* already gone */ }
  }
}
const shouldOpen = () => wanted && listeners.size > 0 && document.visibilityState === 'visible';
function update() {
  clearTimeout(closeT);
  if (shouldOpen()) open();
  else if (channel) closeT = setTimeout(() => { if (!shouldOpen()) close(); }, 60000);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
// the engine says whether a live board is on screen
export function setLiveWanted(on) {
  if (wanted === !!on) return;
  wanted = !!on;
  update();
}
async function announce(game, level) {
  // tell this tab right away
  deliver({ game, level, local: true });
  const msg = { type: 'broadcast', event: 'score', payload: { game, level } };
  try {
    // an open channel sends over the socket; one that isn't joined yet sends over HTTP
    if (channel && channel !== 'opening') { await channel.send(msg); return; }
    const sb = await getSupabase();
    if (!sb) return;
    const c = sb.channel('act-board', { config: { broadcast: { self: false } } });
    await c.send(msg);
    if (c !== channel) sb.removeChannel(c);
  } catch { /* the timer refresh covers it */ }
}
export function onBoardChange(fn) {
  listeners.add(fn);
  update();
  return () => { listeners.delete(fn); update(); };
}
