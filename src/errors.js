// Errors the site hits in players' browsers go to the database (table act_errors), so a problem at any center
// shows up without anyone having to report it. Only the error itself is sent: no names, codes or answers, and the
// browser is reduced to its name, version and system ("Chrome 131 · Windows"). At most 3 reports per visit.
import { online, reportError } from './leaderboard';

const MAX = 3;
const sent = new Set();
/* global __BUILD__ */
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';
// network hiccups, browser quirks and other sites' scripts: nothing to fix in this code
const NOISE = /ResizeObserver loop|^Script error|Load failed|Failed to fetch|NetworkError|AbortError|aborted|dynamically imported module|Importing a module script failed/i;

function browser() {
  const ua = navigator.userAgent || '';
  const pick = [[/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'], [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'], [/Version\/(\d+)[\d.]* .*Safari/, 'Safari']];
  let b = 'Other';
  for (const [re, name] of pick) { const m = ua.match(re); if (m) { b = `${name} ${m[1]}`; break; } }
  const os = /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return `${b} · ${os}`;
}
// only errors in this site's own files count; the address is trimmed to the file name and position
const ours = (file) => !!file && file.startsWith(location.origin + '/');
const where = (file, line, col) => `${file.slice(location.origin.length)}:${line || 0}:${col || 0}`;
function fromStack(stack) {
  for (const m of String(stack || '').matchAll(/(https?:\/\/[^\s()]+?):(\d+):(\d+)/g)) if (ours(m[1])) return where(m[1], m[2], m[3]);
  return '';
}
function send(msg, src) {
  const m = String(msg || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!m || !src || NOISE.test(m)) return;
  const k = m + '|' + src;
  if (sent.has(k) || sent.size >= MAX) return;
  sent.add(k);
  reportError(m, src, browser(), BUILD);
}

export function watchErrors() {
  if (!online || import.meta.env.DEV || typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    const err = e.error;
    const src = ours(e.filename) ? where(e.filename, e.lineno, e.colno) : fromStack(err && err.stack);
    send(e.message || (err && err.message), src);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && typeof r === 'object' && r.stack) send(`Unhandled ${r.name || 'Error'}: ${r.message || ''}`, fromStack(r.stack));
  });
}
// a screen that crashed while drawing (from the error boundary)
export function reportCrash(err) {
  if (!online || import.meta.env.DEV) return;
  send(`Crash: ${(err && err.message) || String(err)}`, fromStack(err && err.stack) || 'react');
}
