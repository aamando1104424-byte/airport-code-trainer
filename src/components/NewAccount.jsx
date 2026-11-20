import { useEffect, useRef, useState } from 'react';
import CodeBox from './CodeBox';

// Shown right after a name is made: the code, how to keep it, and a check before moving on.
export default function NewAccount({ account, doneLabel = 'Done', onDone }) {
  const [saved, setSaved] = useState(false);
  const top = useRef(null);
  // the step changed under the keyboard: start reading from the top of it
  useEffect(() => { top.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="stack-s new-acct">
      <p className="lead" ref={top} tabIndex={-1}>
        You're <b>{account.name}</b>. This is your secret code. It's the only way to get <b>{account.name}</b> back on another
        phone or computer, and nobody can reset it, not even us.
      </p>
      <CodeBox account={account} onBackedUp={() => setSaved(true)} />
      <p className="note">
        {account.shared
          ? 'This is a shared computer, so you will be signed out when this tab closes. Save the code now.'
          : 'This browser remembers you, so you only need the code on a new device or after signing out.'}
      </p>
      <label className="check">
        <input type="checkbox" id="saved-code" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I saved my code somewhere safe
      </label>
      <button className="btn primary big" type="button" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  );
}
