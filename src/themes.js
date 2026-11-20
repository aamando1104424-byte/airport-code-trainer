// Color themes and Light / Dark mode.
// Light and Dark are the page's own setting (data-mode on <html>), picked in the top bar. Dark is the default,
// so the page matches the game screens; Auto follows the device. A color theme (data-crt) tints both modes.
// index.html applies both before the first paint; this module keeps the lists, remembers choices in this
// browser and tells running games to recolor. The colors themselves are in trainer/tokens.css.
export const THEMES = [
  { id: 'green', name: 'Original', note: 'Signage yellow' },
  { id: 'forest', name: 'Forest', note: 'Pine green' },
  { id: 'red', name: 'Red', note: 'Hot and bold' },
  { id: 'orange', name: 'Orange', note: 'Sunset' },
  { id: 'blue', name: 'Blue', note: 'Night radar' },
  { id: 'purple', name: 'Purple', note: 'Neon violet' },
  { id: 'pink', name: 'Pink', note: 'Arcade' },
  { id: 'ice', name: 'Ice', note: 'Cool cyan' },
  { id: 'mono', name: 'Mono', note: 'Black and white' },
];
export const MODES = [
  { id: 'light', name: 'Light', note: 'Light mode' },
  { id: 'dark', name: 'Dark', note: 'Dark mode' },
  { id: 'auto', name: 'Auto', note: 'Auto: match this device' },
];
const KEY = 'act-color-mode';
const MKEY = 'act-ui-mode';
const valid = (id) => THEMES.some((t) => t.id === id);
const validMode = (m) => MODES.some((x) => x.id === m);
const lightQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* not saved, still applied */ } };

export function getTheme() {
  const v = read(KEY);
  return valid(v) ? v : 'green';
}
export function getModePref() {
  const v = read(MKEY);
  return validMode(v) ? v : 'dark';
}
// what Auto means right now
export const resolveMode = (pref) => (pref === 'auto' ? (lightQuery && lightQuery.matches ? 'light' : 'dark') : pref);

// the browser's own bars (phones) match the page
function syncMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const c = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  if (meta && c) meta.content = c;
}
function notify() {
  window.dispatchEvent(new CustomEvent('act-theme', { detail: { theme: getTheme(), mode: document.documentElement.dataset.mode } }));
}

export function applyTheme(id) {
  const t = valid(id) ? id : 'green';
  if (t === 'green') delete document.documentElement.dataset.crt;
  else document.documentElement.dataset.crt = t;
  syncMeta();
  return t;
}
export function applyMode(pref) {
  const p = validMode(pref) ? pref : 'dark';
  document.documentElement.dataset.mode = resolveMode(p);
  syncMeta();
  return p;
}

export function setTheme(id) {
  const t = applyTheme(id);
  write(KEY, t);
  notify();
  return t;
}
export function setModePref(pref) {
  const p = applyMode(pref);
  write(MKEY, p);
  notify();
  return p;
}

// Auto follows the device while the page is open
if (lightQuery) {
  const onChange = () => { if (getModePref() === 'auto') { applyMode('auto'); notify(); } };
  if (lightQuery.addEventListener) lightQuery.addEventListener('change', onChange);
  else if (lightQuery.addListener) lightQuery.addListener(onChange);
}
