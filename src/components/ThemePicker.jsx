import { useEffect, useRef, useState } from 'react';
import { THEMES, getTheme, setTheme } from '../themes';

// A small picture of the front page in one color mode: title, clock tile,
// study column, and the game cards on the right (Air Defender with a skyline, Tower, Challenge).
function MiniPage({ id }) {
  return (
    <div className="tp-page" data-crt-prev={id} aria-hidden="true">
      <div className="tp-top"><i className="tp-h" /><i className="tp-clock">10:07</i></div>
      <div className="tp-cols">
        <div className="tp-main">
          <i className="tp-line w80" /><i className="tp-line w60" />
          <i className="tp-cta" />
          <div className="tp-modes"><i /><i /><i /><i /><i /><i /></div>
        </div>
        <div className="tp-side">
          <div className="tp-feat">
            <b>AIR DEFENDER</b>
            <svg viewBox="0 0 60 22" className="tp-sky">
              <path className="tp-trail" d="M44 0 L36 12" />
              <circle className="tp-bomb" cx="36" cy="12" r="1.8" />
              <path className="tp-city" d="M4 22V15h4v-4h3v4h3V9h4v13zM24 22v-6h3v-3h4v3h2v6zM40 22V12h3V8h1v4h3v10zM50 22v-5h6v5z" />
            </svg>
          </div>
          <div className="tp-feat radar"><b>TOWER</b><span className="tp-ring" /></div>
          <div className="tp-feat chal"><b>50 BUSIEST</b><span className="tp-chips"><i /><i /><i /></span></div>
        </div>
      </div>
    </div>
  );
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(getTheme);
  const wrap = useRef(null);
  const rail = useRef(null);

  // close on Escape or a tap outside
  useEffect(() => {
    if (!open) return undefined;
    // the menu's own Escape: close it and keep the game underneath from pausing
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    // bring the current color into view
    const el = rail.current && rail.current.querySelector('[aria-pressed="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const pick = (id) => setCur(setTheme(id));
  const slide = (dir) => {
    const r = rail.current;
    if (r) r.scrollBy({ left: dir * Math.max(160, r.clientWidth * 0.8), behavior: 'smooth' });
  };
  const curName = THEMES.find((t) => t.id === cur)?.name || 'Original';

  return (
    <div className="tp" ref={wrap}>
      <button className="btn sm tp-btn" aria-expanded={open} aria-controls="tp-panel" onClick={() => setOpen((o) => !o)}>
        <span className="tp-dot" data-crt-prev={cur} aria-hidden="true" />Colors<span className="tp-cur">· {curName}</span>
        <span className="tp-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="tp-panel" id="tp-panel" role="dialog" aria-label="Color mode">
          <div className="tp-head">
            <b>Color mode</b>
            <span>Repaints the whole page and both games. Saved on this device.</span>
            <button className="link tp-x" onClick={() => setOpen(false)} aria-label="Close colors">Close</button>
          </div>
          <div className="tp-slider">
            <button className="tp-arrow" onClick={() => slide(-1)} aria-label="Previous colors">‹</button>
            <div className="tp-rail" ref={rail} role="radiogroup" aria-label="Color modes">
              {THEMES.map((t) => (
                <button key={t.id} className="tp-card" role="radio" aria-checked={t.id === cur} aria-pressed={t.id === cur} onClick={() => pick(t.id)}>
                  <MiniPage id={t.id} />
                  <span className="tp-name"><b>{t.name}</b><span>{t.id === cur ? 'In use' : t.note}</span></span>
                </button>
              ))}
            </div>
            <button className="tp-arrow" onClick={() => slide(1)} aria-label="More colors">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
