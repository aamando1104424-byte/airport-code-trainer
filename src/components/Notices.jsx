import { boardName, fmt } from '../leaderboard';

// "cortes, mango beat your 8,200 on Air Defender · Cadet. You're now #4."
export default function Notices({ account, notices, onOpenBoard, onDismiss }) {
  if (!account || !notices.length) return null;
  const shown = notices.slice(0, 3);
  return (
    <section className="notices" aria-live="polite">
      {shown.map((n) => (
        <div className="notice" key={n.id}>
          <p>
            <b>{account.name}</b>, your high score was beaten by <b>{n.by_name}</b>. They scored {fmt(n.new_score)} on{' '}
            {boardName(n.game, n.level)}, passing your {fmt(n.their_score)}.{' '}
            {n.dropped_off ? 'That knocked you off the top 10.' : `You're now #${n.new_rank}.`}
          </p>
          <button className="btn sm" onClick={() => onOpenBoard(n.game, n.level)}>See board</button>
        </div>
      ))}
      <div className="notice-foot">
        {notices.length > shown.length && <span className="note">+{notices.length - shown.length} more</span>}
        <button className="link" onClick={onDismiss}>Dismiss</button>
      </div>
    </section>
  );
}
