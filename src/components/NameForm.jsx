import { useState } from 'react';
import { NAME_RE, claimName, signIn, cleanCode } from '../leaderboard';
import { nameProblem } from '../names';

// Step 1: type a name. New name → account is made. Taken name → step 2: type its account code.
// onSignedIn({ name, code }, isNew)
export default function NameForm({ onSignedIn, submitLabel = 'Continue', busyLabel = 'Checking…' }) {
  const [step, setStep] = useState('name');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitName(e) {
    e.preventDefault();
    const n = name.trim();
    if (!NAME_RE.test(n)) {
      setErr('Use 3 to 16 letters, numbers or underscores. No spaces.');
      return;
    }
    const why = nameProblem(n);
    if (why) {
      setErr(why);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await claimName(n);
      onSignedIn({ name: r.name, code: r.code }, true);
    } catch (x) {
      if (x.code === 'name_taken') setStep('code');
      else setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (cleanCode(code).length < 12) {
      setErr('Account codes are 12 letters and numbers, like K7QM-2XPA-9DTE.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await signIn(name.trim(), code);
      onSignedIn({ name: r.name, code: cleanCode(code) }, false);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code')
    return (
      <form className="form" onSubmit={submitCode}>
        <p>
          <b>{name.trim()}</b> is already taken. If it's yours, type the account code you got when you made it.
        </p>
        <label>
          Account code
          <input
            id="lb-code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            autoFocus
          />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="link" onClick={() => { setStep('name'); setCode(''); setErr(''); }}>
          Use a different name
        </button>
      </form>
    );

  return (
    <form className="form" onSubmit={submitName}>
      <label>
        Your name
        <input
          id="lb-name"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/\s/g, ''))}
          placeholder="cortes"
          maxLength={16}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
      </label>
      <p className="note">No email, no password. Letters, numbers and _ only, like cortes, mango or apple1244.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn primary big" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
    </form>
  );
}
