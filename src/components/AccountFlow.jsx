import { useState } from 'react';
import { CODE_RE, NAME_RE, claimName, cleanCode, markBackedUp, signIn } from '../leaderboard';
import { nameProblem } from '../names';
import NewAccount from './NewAccount';
import { Dice, Key, Shield, UserPlus } from './icons';

// Getting a leaderboard name, with no email and no password.
//  choose  -> "I'm new" or "I have a code"
//  new     -> type a name (or get a suggestion), with a privacy warning
//  confirm -> "Create SkyRider42?" Nothing is created before this, so a typo can't make an account by accident
//  code    -> the new secret code: copy or download it, tick "I saved it", then continue
//  back    -> name and code together; this only ever signs in, it never creates anything
// onAccount(acc, how) stores the account (how: 'new' for a name made just now, 'signin' for one made before); onFinish(acc, isNew) runs at the end; onLock(bool) stops the dialog
// from closing while the new code is on screen.
const A = ['Sky', 'Jet', 'Aero', 'Cloud', 'Wing', 'Radar', 'Tower', 'Comet', 'Falcon', 'Hawk', 'Swift', 'Orbit', 'Nova', 'Turbo', 'Glide', 'Runway', 'Polar', 'Delta', 'Vector', 'Echo'];
const B = ['Rider', 'Hopper', 'Runner', 'Spotter', 'Flyer', 'Scout', 'Chaser', 'Pilot', 'Racer', 'Ace', 'Nav', 'Glider', 'Jumper', 'Dash'];
const pickOne = (l) => l[Math.floor(Math.random() * l.length)];
function suggestName() {
  for (let i = 0; i < 20; i++) {
    const n = pickOne(A) + pickOne(B) + (10 + Math.floor(Math.random() * 90));
    if (NAME_RE.test(n) && !nameProblem(n)) return n;
  }
  return 'SkyRider' + (10 + Math.floor(Math.random() * 90));
}

export default function AccountFlow({ onAccount, onFinish, onLock, doneLabel = 'Done', intro }) {
  const [step, setStep] = useState('choose');
  const [shared, setShared] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const go = (s) => { setErr(''); setStep(s); };

  function checkName(e) {
    e.preventDefault();
    const n = name.trim();
    if (!NAME_RE.test(n)) return setErr('Use 3 to 16 letters, numbers or underscores (_). No spaces.');
    const why = nameProblem(n);
    if (why) return setErr(why);
    go('confirm');
  }
  async function create() {
    setBusy(true);
    setErr('');
    // lock first: closing the dialog mid-request must not make a name whose code is never shown
    onLock?.(true);
    try {
      const r = await claimName(name.trim());
      const acc = { name: r.name, code: r.code, shared };
      onAccount(acc, 'new');
      setMade(acc);
      onLock?.(true);
      setStep('code');
    } catch (x) {
      onLock?.(false);
      setErr(x.message);
      if (x.code === 'name_taken') setStep('new');
    } finally {
      setBusy(false);
    }
  }
  async function signBackIn(e) {
    e.preventDefault();
    const n = name.trim();
    const c = cleanCode(code);
    if (!NAME_RE.test(n)) return setErr('Type your name exactly as you made it: 3 to 16 letters, numbers or _.');
    if (/[01IO]/.test(c)) return setErr('Codes never use the letters O and I or the numbers 0 and 1. Check those characters.');
    if (!CODE_RE.test(c)) return setErr('Account codes are 12 letters and numbers, like K7QM-2XPA-9DTE.');
    setBusy(true);
    setErr('');
    try {
      const r = await signIn(n, c);
      const acc = { name: r.name, code: c, shared };
      markBackedUp(acc.name, shared);
      onAccount(acc, 'signin');
      onFinish?.(acc, false);
    } catch (x) {
      setErr(x.code === 'bad_login'
        ? "That name and code don't match. Check the spelling of your name (capitals don't matter) and every character of the code."
        : x.message);
    } finally {
      setBusy(false);
    }
  }

  const errP = err ? <p className="err" id="af-err" role="alert">{err}</p> : null;
  const sharedBox = (
    <label className="check">
      <input type="checkbox" id="af-shared" checked={shared} onChange={(e) => setShared(e.target.checked)} />
      This is a shared or school computer (don't remember me here)
    </label>
  );

  if (step === 'code' && made) {
    return <NewAccount account={made} doneLabel={doneLabel} onDone={() => { onLock?.(false); onFinish?.(made, true); }} />;
  }

  if (step === 'confirm') {
    return (
      <div className="stack-s">
        <div className="confirmname">
          <span className="k">Create this name?</span>
          <span className="big">{name.trim()}</span>
          <p className="note">Everyone on the world board will see it. You can't rename it later, but you can always make a new name.</p>
        </div>
        {errP}
        <button className="btn primary big" type="button" disabled={busy} onClick={create} autoFocus>{busy ? 'Creating…' : `Create ${name.trim()}`}</button>
        <button className="btn" type="button" disabled={busy} onClick={() => go('new')}>Change the name</button>
      </div>
    );
  }

  if (step === 'new') {
    const left = 16 - name.length;
    return (
      <form className="form" onSubmit={checkName} noValidate>
        <label htmlFor="af-name">
          <span className="lrow2"><span>Pick a name</span><span className="count" aria-hidden="true">{name.length}/16</span></span>
        </label>
        <div className="namebox">
          <input
            id="af-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value.replace(/\s/g, '').slice(0, 16)); setErr(''); }}
            placeholder="e.g. SkyRider42"
            maxLength={16}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            aria-invalid={!!err}
            aria-describedby={`af-hint${err ? ' af-err' : ''}`}
          />
          <button type="button" className="btn" onClick={() => { setName(suggestName()); setErr(''); }} aria-label="Suggest a name">
            <Dice />
            Suggest
          </button>
        </div>
        <p className="hint" id="af-hint">Letters, numbers and _ only. Spaces are removed. {left <= 3 && left >= 0 ? `${left} left.` : ''}</p>
        <div className="warnbox"><Shield /><span>Everyone in the world can see this name. Don't use your real name, your school, or a name you use online.</span></div>
        {errP}
        {/already taken/.test(err) && (
          <button type="button" className="btn" onClick={() => go('back')}>It's my name: sign in with my code</button>
        )}
        <button className="btn primary big" type="submit">Next</button>
        <button type="button" className="link" onClick={() => go('choose')}>Back</button>
      </form>
    );
  }

  if (step === 'back') {
    return (
      <form className="form" onSubmit={signBackIn} noValidate>
        <label>
          Your name
          <input
            id="af-bname"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value.replace(/\s/g, '').slice(0, 16)); setErr(''); }}
            maxLength={16}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            aria-invalid={!!err}
            aria-describedby={err ? 'af-err' : undefined}
          />
        </label>
        <label>
          Account code
          <input
            id="af-code"
            type="text"
            className="code-input"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(''); }}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            aria-invalid={!!err}
            aria-describedby={`af-chint${err ? ' af-err' : ''}`}
          />
        </label>
        <p className="hint" id="af-chint">12 letters and numbers. Dashes are optional.</p>
        {sharedBox}
        {errP}
        <button className="btn primary big" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="note"><b>Lost your code?</b> It can't be reset. Make a new name instead; your old scores stay on the board.</p>
        <button type="button" className="link" onClick={() => go('choose')}>Back</button>
      </form>
    );
  }

  return (
    <div className="stack-s">
      {intro || <p className="lead">Everything works without an account. A name puts your scores on the world leaderboard and saves your progress, so you can pick up on any computer. No email, no password.</p>}
      <div className="paths">
        <button type="button" className="pathbtn primary" onClick={() => go('new')} autoFocus>
          <span className="pi"><UserPlus /></span>
          <span><b>I'm new</b><span>Pick a name. It takes ten seconds.</span></span>
        </button>
        <button type="button" className="pathbtn" onClick={() => go('back')}>
          <span className="pi"><Key /></span>
          <span><b>I have a code</b><span>Made a name before? Sign back in with its 12-letter code.</span></span>
        </button>
      </div>
      {sharedBox}
    </div>
  );
}
