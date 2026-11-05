import { useState } from 'react';
import Modal from './Modal';
import NameForm from './NameForm';
import NewAccount from './NewAccount';
import { GAMES, boardName, fmt, submitScore } from '../leaderboard';

// Shown to guests after a run with a score: pick a name, then the score posts
export default function SubmitDialog({ result, onClose, onAccount, onOpenBoard }) {
  const [phase, setPhase] = useState('name'); // name | posting | done
  const [created, setCreated] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [err, setErr] = useState('');

  async function post(acc) {
    setPhase('posting');
    setErr('');
    try {
      setOutcome(await submitScore(acc, result));
      setPhase('done');
    } catch (x) {
      setErr(x.message);
      setPhase('error');
    }
  }

  const unit = GAMES[result.game]?.unit ?? 'Wave';
  return (
    <Modal title="Post your score?" onClose={onClose}>
      <div className="score-hero">
        <span className="k">{boardName(result.game, result.level)}</span>
        <span className="big">{fmt(result.score)}</span>
        <span className="note">{unit} {result.wave} · {result.map}</span>
      </div>

      {phase === 'name' && (
        <>
          <p className="lead">Put it on the world leaderboard. Just pick a name.</p>
          <NameForm
            submitLabel="Post my score"
            busyLabel="Posting…"
            onSignedIn={(acc, isNew) => {
              onAccount(acc);
              if (isNew) setCreated(acc);
              post(acc);
            }}
          />
          <button className="link" onClick={() => onClose()}>Not now</button>
        </>
      )}
      {phase === 'posting' && <p className="lead">Posting…</p>}
      {phase === 'error' && (
        <>
          <p className="err">{err}</p>
          <button className="btn big" onClick={() => onClose()}>Close</button>
        </>
      )}
      {phase === 'done' && outcome && (
        <>
          <p className="result-line">
            {outcome.improved
              ? `You're #${outcome.rank} in the world on ${boardName(result.game, result.level)}.`
              : `Your best is still ${fmt(outcome.best)} (#${outcome.rank}). This run didn't beat it.`}
          </p>
          {created && <NewAccount account={created} />}
          <div className="row">
            <button className="btn primary" onClick={() => onOpenBoard(result.game, result.level)}>See leaderboard</button>
            <button className="btn" onClick={() => onClose()}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
