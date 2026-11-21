/* Progress that follows a signed-in player to any computer or phone.
   pack() turns the trainer's saved state into the small copy kept online: only codes that have been studied,
   due times in minutes, the picked codes as one string. unpack() turns it back into the shape the engine's
   merge() reads (merge() still checks every field). combine() joins two copies of one player's progress, say this
   device's and the account's, without losing either side's work. Nothing here touches the page, so it can be
   tested on its own.

   Every rule in combine() gives the same result however many times the same copy is joined in. That matters: a
   save can reach the database after the page that sent it has closed, so the same progress may be merged twice.
   - Each code keeps the copy with more answers on it (it was practiced more recently).
   - XP is kept per browser (xpd: {browser id: XP earned there}); the total is the sum, and joining takes the
     higher number for each browser. XP earned in two places adds up; the same XP seen twice counts once.
   - High-score lists are combined, each score once. Streaks that touch become one streak.
   - Own codes carry the time they were added; a removed code leaves a note (cdel) so it stays removed.
   - A reset stamps the copy (rs). A copy that never saw the newest reset is dropped, so erased progress never
     comes back from a device that was offline at the time. */

const DAY = 864e5;
const LEVELS = { hs: ['cadet', 'pilot', 'ace'], ths: ['trainee', 'controller', 'chief'] };
const PREFS = ['mute', 'diff', 'tdiff', 'hlv', 'area', 'gmap', 'intro'];
const clone = (o) => JSON.parse(JSON.stringify(o));

export const sumXP = (xpd) => Object.values(xpd || {}).reduce((t, n) => t + n, 0);

export function pack(S) {
  const it = {};
  for (const c in S.items) {
    const x = S.items[c];
    if (!x || !(x.box || x.due || x.r || x.w || x.learned)) continue;
    it[c] = [x.box, Math.round(x.due / 6e4), x.r, x.w, x.learned ? 1 : 0];
  }
  const p = {};
  for (const k of PREFS) p[k] = S[k];
  return {
    f: 2, t: S.t || 0, rs: S.rs || 0, it, sel: S.sel.join(''), custom: S.custom, cdel: S.cdel,
    xp: S.xp, xd: S.xpd, streak: S.streak, best: S.best, hs: S.hs, ths: S.ths, p,
  };
}

export function unpack(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const items = {};
  if (o.it && typeof o.it === 'object') {
    for (const c in o.it) {
      const a = o.it[c];
      if (/^[A-Z]{3}$/.test(c) && Array.isArray(a)) items[c] = { box: a[0], due: (+a[1] || 0) * 6e4, r: a[2], w: a[3], learned: !!a[4] };
    }
  }
  const p = o.p && typeof o.p === 'object' && !Array.isArray(o.p) ? o.p : {};
  return {
    ...p, v: 2, t: o.t, rs: o.rs, items, sel: typeof o.sel === 'string' ? o.sel.match(/[A-Z]{3}/g) || [] : [],
    custom: o.custom, cdel: o.cdel, xp: o.xp, xpd: o.xd, streak: o.streak, best: o.best, hs: o.hs, ths: o.ths,
  };
}

// 'YYYY-MM-DD' to a day number (NaN if it isn't a date)
const dayNum = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Math.round(Date.parse(d + 'T00:00:00Z') / DAY) : NaN);

// two streaks of the same player: if the older run reaches the day before the newer run starts, they are one run
export function joinStreak(a, b) {
  const da = dayNum(a.last), db = dayNum(b.last);
  if (!Number.isFinite(da) || !a.n) return { ...b };
  if (!Number.isFinite(db) || !b.n) return { ...a };
  if (da === db) return { n: Math.max(a.n, b.n), last: a.last };
  const [hi, lo, dhi, dlo] = da > db ? [a, b, da, db] : [b, a, db, da];
  const startHi = dhi - hi.n + 1, startLo = dlo - lo.n + 1;
  if (dlo >= startHi - 1) return { n: dhi - Math.min(startHi, startLo) + 1, last: hi.last };
  return { ...hi };
}

function joinBest(a, b) {
  const m = [a.match, b.match].filter((x) => x > 0);
  return { quick: Math.max(a.quick || 0, b.quick || 0), match: m.length ? Math.min(...m) : 0, mock: Math.max(a.mock || 0, b.mock || 0) };
}

// high-score lists: both copies' entries, once each, best first, top 10
function joinScores(x = [], y = []) {
  const seen = new Set(), out = [];
  for (const e of [...x, ...y]) {
    const k = [e.n, e.s, e.w, e.m, e.d].join('|');
    if (!seen.has(k)) { seen.add(k); out.push({ ...e }); }
  }
  return out.sort((p, q) => q.s - p.s).slice(0, 10);
}

/* mine and theirs are full saved states (already checked by merge()).
   opts.add: theirs is separate play being added (guest progress added to a name): its resets never erase mine.
   opts.theirsFirst: settings and picks come from theirs even if mine was saved later (mine started out blank). */
export function combine(mine, theirs, opts = {}) {
  if (!opts.add) {
    const rm = mine.rs || 0, rt = theirs.rs || 0;
    if (rt > rm) return clone(theirs);
    if (rm > rt) return clone(mine);
  }
  const newer = opts.theirsFirst || (theirs.t || 0) > (mine.t || 0) ? theirs : mine, older = newer === mine ? theirs : mine;
  // settings and the picked codes come from whichever copy was used last
  const out = clone(newer);
  for (const c in older.items) {
    const x = older.items[c], y = out.items[c];
    if (!y) { out.items[c] = { ...x }; continue; }
    const nx = x.r + x.w, ny = y.r + y.w, learned = !!(x.learned || y.learned);
    if (nx > ny || (nx === ny && (x.box > y.box || (x.box === y.box && x.due > y.due)))) out.items[c] = { ...x, learned };
    else y.learned = learned;
  }
  out.xpd = { ...(newer.xpd || {}) };
  for (const k in older.xpd || {}) out.xpd[k] = Math.max(out.xpd[k] || 0, older.xpd[k]);
  out.xp = sumXP(out.xpd);
  out.streak = joinStreak(mine.streak, theirs.streak);
  out.best = joinBest(mine.best, theirs.best);
  for (const k of LEVELS.hs) out.hs[k] = joinScores(mine.hs[k], theirs.hs[k]);
  for (const k of LEVELS.ths) out.ths[k] = joinScores(mine.ths[k], theirs.ths[k]);
  // own codes: the latest version of each from either copy, unless it was removed after it was added
  const cdel = { ...(older.cdel || {}) };
  for (const k in newer.cdel || {}) cdel[k] = Math.max(cdel[k] || 0, newer.cdel[k]);
  const byCode = new Map();
  for (const c of [...older.custom, ...newer.custom]) {
    const cur = byCode.get(c.code);
    if (!cur || (c.at || 0) >= (cur.at || 0)) byCode.set(c.code, { ...c });
  }
  const had = new Set(newer.custom.map((c) => c.code));
  out.custom = [...byCode.values()].filter((c) => !(cdel[c.code] > 0 && cdel[c.code] >= (c.at || 0)));
  out.cdel = cdel;
  // a code only the older copy had stays picked if it was picked there
  for (const c of out.custom) if (!had.has(c.code) && older.sel.includes(c.code) && !out.sel.includes(c.code)) out.sel.push(c.code);
  const gone = new Set(newer.custom.concat(older.custom).map((c) => c.code).filter((code) => !out.custom.some((c) => c.code === code)));
  out.sel = out.sel.filter((code) => !gone.has(code));
  out.intro = !!(mine.intro || theirs.intro);
  out.rs = mine.rs || 0;
  out.t = Math.max(mine.t || 0, theirs.t || 0);
  return out;
}
