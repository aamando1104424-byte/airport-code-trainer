import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children, wide = false }) {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const first = box.current?.querySelector('input, button:not(.x)');
    first?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="x" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
