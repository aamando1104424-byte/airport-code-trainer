import ModeSwitch from './ModeSwitch';
import ThemePicker from './ThemePicker';
import { Plane, Trophy } from './icons';

// The top bar: the name (back to home), Light/Dark/Auto, the color theme, the leaderboard and the account.
export default function AccountBar({ account, online, unread, needsBackup, onSignIn, onBoard, onAccount, onSetup }) {
  const home = () => window.dispatchEvent(new Event('act-home'));
  return (
    <header className="appbar">
      <div className="appbar-in">
        <button className="brand" type="button" onClick={home} aria-label="Airport Code Trainer: go to the home screen">
          <span className="brand-mark" aria-hidden="true"><Plane /></span>
          <span className="brand-name" aria-hidden="true"><span className="ba">Airport </span>Code Trainer</span>
        </button>
        <div className="ab-r">
          <ModeSwitch />
          <ThemePicker />
          {!online ? (
            <button className="tbtn lb" type="button" onClick={onSetup} aria-label="The leaderboard is off. How to turn it on">
              <Trophy /><span className="tl">Leaderboard off</span>
            </button>
          ) : (
            <>
              <button className="tbtn lb" type="button" onClick={onBoard} aria-label="World leaderboard">
                <Trophy /><span className="tl">Leaderboard</span>
              </button>
              {account ? (
                <button
                  className="tbtn"
                  type="button"
                  onClick={onAccount}
                  aria-label={`Account: ${account.name}${unread ? `, ${unread} new` : ''}${needsBackup ? ', code not backed up yet' : ''}`}
                >
                  <span className="avatar" aria-hidden="true">{account.name[0].toUpperCase()}</span>
                  <span className="tl" aria-hidden="true">{account.name}</span>
                  {unread > 0 && <span className="badge" aria-hidden="true">{unread}</span>}
                  {needsBackup && !unread && <span className="dot" aria-hidden="true" title="Back up your code" />}
                </button>
              ) : (
                <>
                  <span className="guest-note">Playing as guest</span>
                  <button className="tbtn primary" type="button" onClick={onSignIn}>
                    <span className="tl">Pick a name</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
