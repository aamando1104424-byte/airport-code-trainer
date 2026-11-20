import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

// A dialog over the page. Focus moves in and stays in (Tab wraps), the page behind can't be reached,
// and focus goes back to whatever opened it. locked = Escape and clicks outside don't close it
// (used while a new account code is on screen, so it can't be dismissed by accident).
export default function Modal({ title, onClose, children, wide = false, locked = false }) {
  const box = useRef(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockRef = useRef(locked);
  lockRef.current = locked;

  useEffect(() => {
    const opener = document.activeElement;
    const root = document.getElementById('root');
    if (root) root.inert = true;
    const focusables = () => [...(box.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])].filter((el) => !el.disabled && el.offsetParent !== null);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!lockRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const first = box.current?.querySelector('[autofocus], input, button:not(.x)');
    (first || box.current)?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (root) root.inert = false;
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={id} ref={box} tabIndex={-1}>
        <div className="modal-h">
          <h2 id={id}>{title}</h2>
          {!locked && <button className="x" type="button" onClick={onClose} aria-label="Close">×</button>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
