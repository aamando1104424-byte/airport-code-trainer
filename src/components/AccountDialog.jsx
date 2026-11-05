import { useEffect, useState } from 'react';
import Modal from './Modal';
import CodeBox from './CodeBox';
import { boardName, fmt, getMyScores } from '../leaderboard';

export default function AccountDialog({ account, onClose, onSignOut, onOpenBoard }) {
  const [scores, setScores] = useState(null);
  const [err, setErr] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    getMyScores(account).then((r) => setScores(r || [])).catch((x) => setErr(x.message));
  }, [account]);

  return (
    <Modal title={account.name} onClose={onClose}>
      <section className="stack-s">
        <span className="k">Your world bests</span>
        {err && <p className="err">{err}</p>}
        {!err && scores === null && <p className="note">Loading…</p>}
        {scores && scores.length === 0 && <p className="note">Nothing posted yet. Finish a round of Air Defender or Tower Control.</p>}
        {scores && scores.map((s) => (
          <button key={s.game + s.level} className="best-row" onClick={() => onOpenBoard(s.game, s.level)}>
            <span>{boardName(s.game, s.level)}</span>
            <span className="n">{fmt(s.score)}</span>
            <span className="rank">#{s.rank}</span>
          </button>
        ))}
      </section>

      <section className="stack-s">
        <span className="k">Account code</span>
        <p className="note">Use it with your name to sign in on another phone or browser.</p>
        {showCode ? <CodeBox code={account.code} /> : <button className="btn sm" onClick={() => setShowCode(true)}>Show my code</button>}
      </section>

      {!confirm ? (
        <button className="btn" onClick={() => setConfirm(true)}>Sign out</button>
      ) : (
        <div className="panel confirm">
          <p>Before you go, save your code. You'll need it to get <b>{account.name}</b> back.</p>
          <CodeBox code={account.code} />
          <div className="row">
            <button className="btn" onClick={() => setConfirm(false)}>Stay signed in</button>
            <button className="btn primary" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
