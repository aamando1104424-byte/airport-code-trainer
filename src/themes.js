// Color modes. "Original" is the sectional-chart paper with green game screens.
// Every other mode repaints the whole page (background, cards, buttons, maps) and the game screens.
// The colors live in trainer/styles.css under [data-crt="..."]; this file keeps the list,
// remembers the choice in this browser and tells running games to recolor.
export const THEMES = [
  { id: 'green', name: 'Original', note: 'Paper + green' },
  { id: 'forest', name: 'Forest', note: 'Pine green' },
  { id: 'red', name: 'Red', note: 'Hot and bold' },
  { id: 'orange', name: 'Orange', note: 'Sunset' },
  { id: 'blue', name: 'Blue', note: 'Night radar' },
  { id: 'purple', name: 'Purple', note: 'Neon violet' },
  { id: 'pink', name: 'Pink', note: 'Arcade' },
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
  // the browser's own bars (phones) match the page
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || meta.content;
  return t;
}

export function setTheme(id) {
  const t = applyTheme(id);
  try { localStorage.setItem(KEY, t); } catch (e) { /* not saved, still applied */ }
  window.dispatchEvent(new CustomEvent('act-theme', { detail: t }));
  return t;
}
