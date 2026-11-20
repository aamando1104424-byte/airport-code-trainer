import { useEffect, useRef, useState } from 'react';
import { THEMES, getTheme, setTheme } from '../themes';

// A tiny picture of the app in one color theme, in the current light/dark mode:
// the flight board, the main button, a game screen and the mode cards. Colors come from tokens.css.
function MiniPage({ id }) {
  return (
    <span className="tp-page" data-crt-prev={id} aria-hidden="true">
      <span className="tp-board"><i className="tp-h" /><span className="tp-fl"><i /><i /><i /></span></span>
      <span className="tp-body"><i className="tp-cta" /><i className="tp-crt" /></span>
      <span className="tp-cards"><i /><i /><i /></span>
    </span>
  );
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(getTheme);
  const wrap = useRef(null);
  const btn = useRef(null);
  const grid = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // the menu's own Escape: close it and keep a game underneath from pausing
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); btn.current?.focus(); }
    };
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    grid.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const pick = (id) => setCur(setTheme(id));
  function onGridKey(e) {
    const cols = window.innerWidth <= 380 ? 2 : 3;
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = THEMES.findIndex((t) => t.id === cur);
    const next = THEMES[Math.min(THEMES.length - 1, Math.max(0, i + d))].id;
    pick(next);
    grid.current?.querySelector(`[data-id="${next}"]`)?.focus();
  }
  const curName = THEMES.find((t) => t.id === cur)?.name || 'Original';

  return (
    <div className="tp" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="tbtn"
        aria-expanded={open}
        aria-controls="tp-panel"
        aria-label={`Color theme: ${curName}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="swatch" aria-hidden="true" />
        <span className="tl">Theme</span>
      </button>
      {open && (
        <div className="tp-panel" id="tp-panel" role="dialog" aria-label="Color theme">
          <div className="tp-head">
            <div>
              <b>Color theme</b>
              <span>Repaints the page and both games, in light or dark. Saved on this device.</span>
            </div>
            <button className="x" type="button" onClick={() => { setOpen(false); btn.current?.focus(); }} aria-label="Close color themes">×</button>
          </div>
          <div className="tp-grid" role="radiogroup" aria-label="Color themes" ref={grid} onKeyDown={onGridKey}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tp-card"
                role="radio"
                data-id={t.id}
                aria-checked={t.id === cur}
                tabIndex={t.id === cur ? 0 : -1}
                onClick={() => pick(t.id)}
              >
                <MiniPage id={t.id} />
                <span className="tp-name"><b>{t.name}</b><span>{t.id === cur ? 'In use' : t.note}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
