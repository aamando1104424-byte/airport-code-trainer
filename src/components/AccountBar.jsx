import ThemePicker from './ThemePicker';

export default function AccountBar({ account, online, unread, onSignIn, onBoard, onAccount, onSetup }) {
  return (
    <div className="acctbar">
      <div className="acct-l">
        {account ? (
          <>
            <span className="avatar" aria-hidden="true">{account.name[0].toUpperCase()}</span>
            <span>Signed in as <b>{account.name}</b></span>
          </>
        ) : (
          <span className="guest">Playing as guest</span>
        )}
      </div>
      <div className="acct-r">
        <ThemePicker />
        {!online ? (
          <button className="btn sm" onClick={onSetup}>Leaderboard is off</button>
        ) : (
          <>
            <button className="btn sm" onClick={onBoard}>Leaderboard</button>
            {account ? (
              <button className="btn sm" onClick={onAccount}>
                Account{unread > 0 && <span className="badge" aria-label={`${unread} new`}>{unread}</span>}
              </button>
            ) : (
              <button className="btn sm primary" onClick={onSignIn}>Sign in</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
