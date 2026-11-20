import { useState } from 'react';
import { codeFileText, markBackedUp, prettyCode } from '../leaderboard';
import { Copy, Download } from './icons';

// Shows an account code with Copy and Download. Either one counts as backed up.
export default function CodeBox({ account, onBackedUp }) {
  const [status, setStatus] = useState('');
  const pretty = prettyCode(account.code);
  const done = (msg) => {
    markBackedUp(account.name, account.shared);
    onBackedUp?.();
    setStatus(msg);
    setTimeout(() => setStatus(''), 2400);
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty);
      done('Copied');
    } catch {
      // clipboard blocked: select the text so it can be copied by hand
      const el = document.getElementById('codebox-text');
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      setStatus('Selected. Press Ctrl+C (or Cmd+C) to copy.');
    }
  }
  function download() {
    const blob = new Blob([codeFileText(account)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `airport-code-trainer-${account.name}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    done('Saved to your downloads');
  }
  return (
    <div className="codebox">
      <span className="k">Account code for {account.name}</span>
      <span id="codebox-text" className="codebox-t" aria-label={`Account code ${pretty.split('').join(' ')}`}>{pretty}</span>
      <div className="code-actions">
        <button type="button" className="btn sm" onClick={copy}><Copy />Copy</button>
        <button type="button" className="btn sm" onClick={download}><Download />Download</button>
      </div>
      <span className="k" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
