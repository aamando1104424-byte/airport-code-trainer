import { useEffect, useState } from 'react';
import Modal from './Modal';
import CodeBox from './CodeBox';
import { boardName, fmt, getMyScores, isBackedUp } from '../leaderboard';
import { Shield } from './icons';

export default function AccountDialog({ account, onClose, onSignOut, onOpenBoard, onBackedUp }) {
  const [scores, setScores] = useState(null);
  const [err, setErr] = useState('');
  const [backed, setBacked] = useState(() => isBackedUp(account.name, account.shared));
  const [showCode, setShowCode] = useState(() => !isBackedUp(account.name, account.shared));
  const [confirm, setConfirm] = useState(false);
  const refresh = () => { setBacked(isBackedUp(account.name, account.shared)); onBackedUp?.(); };

  useEffect(() => {
    getMyScores(account).then((r) => setScores(r || [])).catch((x) => setErr(x.message));
  }, [account]);

  return (
    <Modal title={account.name} onClose={onClose}>
      {!backed && (
        <div className="warnbox"><Shield /><span><b>Back up your code.</b> Copy or download it below. Without it, nobody can get {account.name} back on another device.</span></div>
      )}
      <section className="stack-s">
        <span className="k">Your world bests</span>
        {err && <p className="err" role="alert">{err}</p>}
        {!err && scores === null && <p className="note">Loading…</p>}
        {scores && scores.length === 0 && <p className="note">Nothing posted yet. Finish a round of Air Defender or Tower Control.</p>}
        {scores && scores.map((s) => (
          <button key={s.game + s.level} type="button" className="best-row" onClick={() => onOpenBoard(s.game, s.level)}>
            <span>{boardName(s.game, s.level)}</span>
            <span className="n">{fmt(s.score)}</span>
            <span className="rank">#{s.rank}</span>
          </button>
        ))}
      </section>

      <section className="stack-s">
        <span className="k">Account code</span>
        <p className="note">Use it with your name to sign in on another phone or computer.{account.shared ? ' This is a shared computer, so you will be signed out when this tab closes.' : ''}</p>
        {showCode ? <CodeBox account={account} onBackedUp={refresh} /> : <button type="button" className="btn sm" onClick={() => setShowCode(true)}>Show my code</button>}
      </section>

      {!confirm ? (
        <button type="button" className="btn" onClick={() => setConfirm(true)}>Sign out</button>
      ) : (
        <div className="panel confirm">
          <p>Signing out removes <b>{account.name}</b> from this device. The only way back in is the code{backed ? '.' : ', and you haven\'t backed it up yet.'}</p>
          {!backed && <CodeBox account={account} onBackedUp={refresh} />}
          <div className="row">
            <button type="button" className="btn primary" onClick={() => setConfirm(false)}>Stay signed in</button>
            <button type="button" className="btn" onClick={onSignOut}>{backed ? 'Sign out' : 'Sign out anyway'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
