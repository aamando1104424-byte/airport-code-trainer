import { useState } from 'react';
import { prettyCode } from '../leaderboard';

// Shows an account code with a copy button
export default function CodeBox({ code }) {
  const [copied, setCopied] = useState(false);
  const pretty = prettyCode(code);
  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.getElementById('codebox-text');
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  }
  return (
    <div className="codebox">
      <span id="codebox-text" className="codebox-t">{pretty}</span>
      <button type="button" className="btn sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}
