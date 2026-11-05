import CodeBox from './CodeBox';

// Shown once, right after a name is claimed
export default function NewAccount({ account }) {
  return (
    <div className="panel new-acct">
      <p>
        You're <b>{account.name}</b>. This browser remembers you, so you won't have to sign in again here.
      </p>
      <p className="note">
        Your account code is below. You only need it to sign in on another phone or browser, or after signing out. Screenshot
        it or copy it somewhere safe. It's the only way to prove the name is yours.
      </p>
      <CodeBox code={account.code} />
    </div>
  );
}
