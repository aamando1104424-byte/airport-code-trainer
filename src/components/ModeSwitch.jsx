import { useRef, useState } from 'react';
import { MODES, getModePref, setModePref } from '../themes';
import { Auto, Moon, Sun } from './icons';

const ICON = { light: <Sun />, dark: <Moon />, auto: <Auto /> };

// Light / Dark / Auto, always in the top bar. Saved on this device.
export default function ModeSwitch() {
  const [pref, setPref] = useState(getModePref);
  const group = useRef(null);
  const pick = (id) => setPref(setModePref(id));

  // arrow keys move between the three, like any radio group
  function onKey(e) {
    const i = MODES.findIndex((m) => m.id === pref);
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = MODES[(i + d + MODES.length) % MODES.length].id;
    pick(next);
    group.current?.querySelector(`[data-m="${next}"]`)?.focus();
  }

  return (
    <div className="modesw" role="radiogroup" aria-label="Light or dark mode" ref={group} onKeyDown={onKey}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          data-m={m.id}
          aria-checked={pref === m.id}
          aria-label={m.note}
          title={m.note}
          tabIndex={pref === m.id ? 0 : -1}
          onClick={() => pick(m.id)}
        >
          {ICON[m.id]}
          <span className="ml" aria-hidden="true">{m.name}</span>
        </button>
      ))}
    </div>
  );
}
