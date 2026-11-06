// Color modes for the game screens (Air Defender, Tower Control, the home cards).
// The colors themselves live in trainer/styles.css under [data-crt="..."]; this file
// keeps the list, remembers the choice in this browser and tells running games to recolor.
export const THEMES = [
  { id: 'green', name: 'Green', note: 'The original' },
  { id: 'red', name: 'Red', note: 'Hot and bold' },
  { id: 'orange', name: 'Orange', note: 'Sunset amber' },
  { id: 'blue', name: 'Blue', note: 'Night radar' },
  { id: 'purple', name: 'Purple', note: 'Neon violet' },
  { id: 'pink', name: 'Pink', note: 'Arcade pink' },
  { id: 'ice', name: 'Ice', note: 'Cool cyan' },
  { id: 'mono', name: 'Mono', note: 'Black and white' },
];
const KEY = 'act-color-mode';
const valid = (id) => THEMES.some((t) => t.id === id);

export function getTheme() {
  try {
    const v = localStorage.getItem(KEY);
    if (valid(v)) return v;
  } catch (e) { /* storage blocked: use the default */ }
  return 'green';
}

export function applyTheme(id) {
  const t = valid(id) ? id : 'green';
  if (t === 'green') delete document.documentElement.dataset.crt;
  else document.documentElement.dataset.crt = t;
  return t;
}

export function setTheme(id) {
  const t = applyTheme(id);
  try { localStorage.setItem(KEY, t); } catch (e) { /* not saved, still applied */ }
  window.dispatchEvent(new CustomEvent('act-theme', { detail: t }));
  return t;
}
