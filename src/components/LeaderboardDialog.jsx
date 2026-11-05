import { useEffect, useState } from 'react';
import Modal from './Modal';
import { GAMES, fmt, getLeaderboard } from '../leaderboard';

export default function LeaderboardDialog({ game: g0 = 'defender', level: l0, account, onClose }) {
  const [game, setGame] = useState(g0);
  const [level, setLevel] = useState(l0 || Object.keys(GAMES[g0].levels)[0]);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setRows(null);
    setErr('');
    getLeaderboard(game, level, 25)
      .then((r) => live && setRows(r || []))
      .catch((x) => live && setErr(x.message));
    return () => { live = false; };
  }, [game, level, tick]);

  function pickGame(k) {
    setGame(k);
    setLevel(Object.keys(GAMES[k].levels)[0]);
  }
  const me = account?.name?.toLowerCase();
  const unit = GAMES[game].unit;

  return (
    <Modal title="World Leaderboard" onClose={onClose} wide>
      <div className="tabs" role="tablist" aria-label="Game">
        {Object.entries(GAMES).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={game === k} className="tab" onClick={() => pickGame(k)}>{v.name}</button>
        ))}
      </div>
      <div className="seg" role="tablist" aria-label="Level">
        {Object.entries(GAMES[game].levels).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={level === k} className="seg-b" onClick={() => setLevel(k)}>{v}</button>
        ))}
      </div>

      {err && (
        <div className="panel">
          <p className="err">{err}</p>
          <button className="btn sm" onClick={() => setTick((t) => t + 1)}>Try again</button>
        </div>
      )}
      {!err && rows === null && <p className="lead">Loading…</p>}
      {!err && rows && rows.length === 0 && (
        <div className="panel"><p>No scores yet on {GAMES[game].name} · {GAMES[game].levels[level]}. Play a round and claim #1.</p></div>
      )}
      {!err && rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="lbt">
            <thead>
              <tr><th>#</th><th>Name</th><th className="n">Score</th><th className="n">{unit}</th><th>Map</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={r.name.toLowerCase() === me ? 'me' : ''}>
                  <td className="rk">{r.rank}</td>
                  <td className="nm">{r.name}{r.name.toLowerCase() === me && <span className="you">you</span>}</td>
                  <td className="n">{fmt(r.score)}</td>
                  <td className="n">{r.wave}</td>
                  <td>{r.map}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">Top 25. Each player's best score per level counts once.</p>
    </Modal>
  );
}
