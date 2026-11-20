// Small line icons (24x24, drawn with the current text color)
const I = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>{children}</svg>
);

export const Sun = (p) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></I>
);
export const Moon = (p) => <I {...p}><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" /></I>;
export const Auto = (p) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" /></I>
);
export const Trophy = (p) => (
  <I {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20h7M10 17h4" /></I>
);
export const Palette = (p) => (
  <I {...p}><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.5-1.1.2-2.3 1.4-2.3h1.9a3.8 3.8 0 0 0 3.8-3.8c0-5-3.8-9-8.5-9z" /><circle cx="7.6" cy="11" r="1.2" /><circle cx="10.5" cy="7.3" r="1.2" /><circle cx="15" cy="7.6" r="1.2" /></I>
);
export const UserPlus = (p) => (
  <I {...p}><circle cx="9.5" cy="8" r="3.6" /><path d="M3 20c.6-3.6 3.2-5.6 6.5-5.6S15.4 16.4 16 20M19 8v6M16 11h6" /></I>
);
export const Key = (p) => (
  <I {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></I>
);
export const Download = (p) => <I {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></I>;
export const Copy = (p) => (
  <I {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></I>
);
export const Shield = (p) => <I {...p}><path d="M12 3.5l7 2.8v5.3c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.3z" /><path d="M12 8.5v4M12 15.8v.2" /></I>;
export const Dice = (p) => (
  <I {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><circle cx="9" cy="9" r="1.1" fill="currentColor" /><circle cx="15" cy="15" r="1.1" fill="currentColor" /><circle cx="15" cy="9" r="1.1" fill="currentColor" /><circle cx="9" cy="15" r="1.1" fill="currentColor" /></I>
);
// the airliner seen from above (same shape as the games use)
export const Plane = (p) => (
  <svg viewBox="-12 -10 24 20" aria-hidden="true" focusable="false" {...p}>
    <path d="M10 0C10-.9 9.2-1.3 8-1.3H-7.4L-10-.5V.5L-7.4 1.3H8C9.2 1.3 10 .9 10 0ZM1.8-1.2L-5.2-9.4H-6.6L-3.4-1.2ZM1.8 1.2L-5.2 9.4H-6.6L-3.4 1.2ZM-7.2-1L-9.6-4.4H-10.4L-9.2-.8ZM-7.2 1L-9.6 4.4H-10.4L-9.2.8Z" />
  </svg>
);
