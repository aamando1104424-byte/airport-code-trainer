import { useState } from 'react';
import Modal from './Modal';
import AccountFlow from './AccountFlow';
import { GAMES, boardName, fmt, submitScore } from '../leaderboard';

// Shown to guests after a round with a score: get a name (new or returning), save the code, then the score posts.
export default function SubmitDialog({ result, onClose, onAccount, onOpenBoard, onBackedUp }) {
  const [phase, setPhase] = useState('name'); // name | posting | done | error
  const [outcome, setOutcome] = useState(null);
  const [err, setErr] = useState('');
  const [locked, setLocked] = useState(false);
  const [acc, setAcc] = useState(null);

  async function post(a) {
    setPhase('posting');
    setErr('');
    try {
      setOutcome(await submitScore(a, result));
      setPhase('done');
    } catch (x) {
      setErr(x.message);
      setPhase('error');
    }
  }

  const unit = GAMES[result.game]?.unit ?? 'Wave';
  return (
    <Modal title="Post your score?" onClose={onClose} locked={locked || phase === 'posting'}>
      <div className="score-hero">
        <span className="k">{boardName(result.game, result.level)}</span>
        <span className="big">{fmt(result.score)}</span>
        <span className="note">{unit} {result.wave} · {result.map}</span>
      </div>

      {phase === 'name' && (
        <>
          <AccountFlow
            intro={<p className="lead">Put it on the world leaderboard. A name also saves your progress for any computer. No email, no password.</p>}
            doneLabel="Post my score"
            onLock={setLocked}
            onAccount={(a, how) => { setAcc(a); onAccount(a, how); }}
            onFinish={(a, isNew) => { if (isNew) onBackedUp?.(); post(a); }}
          />
          {!locked && <button type="button" className="link" onClick={() => onClose()}>Not now</button>}
        </>
      )}
      {phase === 'posting' && <p className="lead" role="status">Posting your score…</p>}
      {phase === 'error' && (
        <>
          <p className="err" role="alert">{err}</p>
          <div className="row">
            {acc && <button type="button" className="btn primary" onClick={() => post(acc)}>Try again</button>}
            <button type="button" className="btn" onClick={() => onClose()}>Close</button>
          </div>
        </>
      )}
      {phase === 'done' && outcome && (
        <>
          <p className="result-line" role="status">
            {outcome.improved
              ? `You're #${outcome.rank} in the world on ${boardName(result.game, result.level)}.`
              : `Your best is still ${fmt(outcome.best)} (#${outcome.rank}). This round didn't beat it.`}
          </p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => onOpenBoard(result.game, result.level)}>See the leaderboard</button>
            <button type="button" className="btn" onClick={() => onClose()}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
