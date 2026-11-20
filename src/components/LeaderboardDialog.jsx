import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { GAMES, fmt, getLeaderboard, getMyScores } from '../leaderboard';

// arrow keys move between tabs, like any tab list
function arrows(e, keys, cur, set) {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const el = e.currentTarget;
  const next = keys[(keys.indexOf(cur) + d + keys.length) % keys.length];
  set(next);
  requestAnimationFrame(() => el.querySelector(`[data-k="${next}"]`)?.focus());
}

export default function LeaderboardDialog({ game: gIn = 'defender', level: lIn, account, onClose }) {
  const g0 = GAMES[gIn] ? gIn : 'defender';
  const l0 = GAMES[g0].levels[lIn] ? lIn : Object.keys(GAMES[g0].levels)[0];
  const [game, setGame] = useState(g0);
  const [level, setLevel] = useState(l0);
  const [rows, setRows] = useState(null);
  const [mine, setMine] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const myScores = useRef(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    setErr('');
    getLeaderboard(game, level, 25)
      .then((r) => live && setRows(r || []))
      .catch((x) => live && setErr(x.message));
    return () => { live = false; };
  }, [game, level, tick]);

  // a signed-in player outside the top 25 still sees where they stand
  useEffect(() => {
    let live = true;
    setMine(null);
    if (!account) return undefined;
    (myScores.current || (myScores.current = getMyScores(account).catch(() => [])))
      .then((l) => { if (live) setMine((l || []).find((s) => s.game === game && s.level === level) || null); });
    return () => { live = false; };
  }, [account, game, level]);

  function pickGame(k) {
    setGame(k);
    setLevel(Object.keys(GAMES[k].levels)[0]);
  }
  const me = account?.name?.toLowerCase();
  const unit = GAMES[game].unit;
  const inTop = rows && me && rows.some((r) => r.name.toLowerCase() === me);

  return (
    <Modal title="World leaderboard" onClose={onClose} wide>
      <div className="tabs" role="tablist" aria-label="Game" onKeyDown={(e) => arrows(e, Object.keys(GAMES), game, pickGame)}>
        {Object.entries(GAMES).map(([k, v]) => (
          <button key={k} type="button" data-k={k} role="tab" aria-selected={game === k} tabIndex={game === k ? 0 : -1} className="tab" onClick={() => pickGame(k)}>{v.name}</button>
        ))}
      </div>
      <div className="seg" role="tablist" aria-label="Level" onKeyDown={(e) => arrows(e, Object.keys(GAMES[game].levels), level, setLevel)}>
        {Object.entries(GAMES[game].levels).map(([k, v]) => (
          <button key={k} type="button" data-k={k} role="tab" aria-selected={level === k} tabIndex={level === k ? 0 : -1} className="seg-b" onClick={() => setLevel(k)}>{v}</button>
        ))}
      </div>

      {err && (
        <div className="panel">
          <p className="err" role="alert">{err}</p>
          <button type="button" className="btn sm" onClick={() => setTick((t) => t + 1)}>Try again</button>
        </div>
      )}
      {!err && rows === null && <p className="lead" role="status">Loading the board…</p>}
      {!err && rows && rows.length === 0 && (
        <div className="panel"><p>No scores yet on {GAMES[game].name} · {GAMES[game].levels[level]}. Play a round and take #1.</p></div>
      )}
      {!err && rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="lbt">
            <caption>Top 25 on {GAMES[game].name} · {GAMES[game].levels[level]}. Each player's best score counts once. "Map" is the map they played.</caption>
            <thead>
              <tr><th scope="col">#</th><th scope="col">Name</th><th scope="col" className="n">Score</th><th scope="col" className="n">{unit}</th><th scope="col" className="mapc">Map</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={r.name.toLowerCase() === me ? 'me' : ''}>
                  <td className="rk">{r.rank}</td>
                  <td className="nm">{r.name}{r.name.toLowerCase() === me && <span className="you">you</span>}</td>
                  <td className="n">{fmt(r.score)}</td>
                  <td className="n">{r.wave}</td>
                  <td className="mapc">{r.map}</td>
                </tr>
              ))}
              {!inTop && mine && (
                <tr className="me mine">
                  <td className="rk">{mine.rank}</td>
                  <td className="nm">{account.name}<span className="you">you</span></td>
                  <td className="n">{fmt(mine.score)}</td>
                  <td className="n">{mine.wave}</td>
                  <td className="mapc" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
