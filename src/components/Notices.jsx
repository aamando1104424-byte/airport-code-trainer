import { boardName, fmt } from '../leaderboard';

// "mango passed your 7,900 on Air Defender · Cadet with 8,200. You're now #4."
export default function Notices({ account, notices, onOpenBoard, onDismiss }) {
  if (!account || !notices.length) return null;
  const shown = notices.slice(0, 3);
  return (
    <section className="notices" aria-label="Scores that passed yours">
      {shown.map((n) => (
        <div className="notice" key={n.id}>
          <p>
            <b>{n.by_name}</b> passed your {fmt(n.their_score)} on {boardName(n.game, n.level)} with {fmt(n.new_score)}.{' '}
            {n.dropped_off ? "You're out of the top 10 now." : `You're now #${n.new_rank}.`}
          </p>
          <button type="button" className="btn sm" onClick={() => onOpenBoard(n.game, n.level)}>See board</button>
        </div>
      ))}
      <div className="notice-foot">
        {notices.length > shown.length && <span className="note">+{notices.length - shown.length} more</span>}
        <button type="button" className="link" onClick={onDismiss}>Dismiss all</button>
      </div>
    </section>
  );
}
