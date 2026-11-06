/* Game art: city landmarks, bombs, interceptors, launchers and airliners.
   Every city's picture comes from what it's known for (data/landmarks.json): either a hand-drawn
   landmark from motifs.js, or an emoji drawn as a tinted icon so it matches the screen colors.
   A small skyline seeded from the airport code sits behind it, so no two cities look the same.
   All city drawing is in map units around the city's dot: x about -12..12, ground at y = 0, up is negative. */
import { MOTIFS } from './motifs.js';
import LANDMARKS from '../data/landmarks.json';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color",sans-serif';

export function knownFor(code) { return LANDMARKS[code] ? LANDMARKS[code][1] : ''; }
export function motifOf(code) { return LANDMARKS[code] ? LANDMARKS[code][0] : ''; }

function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; }
function seeded(seed) {
  let s = seed || 1;
  return () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- emoji drawn as tinted icons ---------- */
const P2D = new Map();
const path = (d) => { let p = P2D.get(d); if (!p) { p = new Path2D(d); P2D.set(d, p); } return p; };
const isVector = (k) => !!MOTIFS[k];
let emojiOK = null;
const EMO = new Map();
function rgb(c) {
  const ctx = rgb.ctx || (rgb.ctx = document.createElement('canvas').getContext('2d'));
  ctx.fillStyle = '#000'; ctx.fillStyle = c; const v = ctx.fillStyle;
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  const m = v.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
}
// one glyph rendered once, then recolored: light parts take the city color, dark outlines fall back toward the screen
function emojiSprite(ch, col, bg) {
  const key = ch + '|' + col + '|' + bg; let c = EMO.get(key); if (c) return c;
  const S = 72, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.font = `${S * 0.8}px ${EMOJI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
  x.fillText(ch, S / 2, S * 0.86);
  let img; try { img = x.getImageData(0, 0, S, S); } catch (e) { EMO.set(key, cv); return cv; }
  const d = img.data, [cr, cg, cb] = rgb(col), [br, bgc, bb] = rgb(bg);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255, t = Math.min(1, 0.28 + lum * 1.05);
    d[i] = br + (cr - br) * t; d[i + 1] = bgc + (cg - bgc) * t; d[i + 2] = bb + (cb - bb) * t;
  }
  x.putImageData(img, 0, 0); EMO.set(key, cv); if (EMO.size > 600) EMO.clear(); return cv;
}
// does this device draw emoji at all? (some Linux boxes show empty boxes instead)
function canEmoji() {
  if (emojiOK !== null) return emojiOK;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d', { willReadFrequently: true });
    const shot = (ch) => { x.clearRect(0, 0, 32, 32); x.font = `26px ${EMOJI_FONT}`; x.fillText(ch, 2, 26); return x.getImageData(0, 0, 32, 32).data; };
    const a = shot('🐻'), b = shot(''); let diff = 0, ink = 0;
    for (let i = 0; i < a.length; i += 4) { if (a[i + 3]) ink++; if (a[i + 3] !== b[i + 3]) diff++; }
    // a black-and-white emoji font is fine too: the glyph gets tinted either way
    emojiOK = ink > 40 && diff > 40;
  } catch (e) { emojiOK = false; }
  return emojiOK;
}
function drawEmoji(ctx, ch, col, bg) {
  if (!canEmoji()) { drawLayers(ctx, MOTIFS.townhall, col, bg, col, 0); return; }
  // the glyph sits on the ground line, about 17 units tall
  ctx.drawImage(emojiSprite(ch, col, bg), -9.6, -18.6, 19.2, 19.2);
}

/* ---------- hand-drawn landmarks ---------- */
const ANIM = {
  // blades and pump beams move; lighthouse beams sweep
  windmill(ctx, t, col) { ctx.save(); ctx.translate(0, -15); ctx.rotate(t * 2.2); ctx.fillStyle = col; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(0.6, -0.45, 4.2, 0.9); } ctx.restore(); },
  windfarm(ctx, t, col) {
    ctx.fillStyle = col;
    for (const [x, y, s, ph] of [[-7, -14, 1, 0], [1, -17, 1.15, 1.3], [8, -12, 0.85, 2.4]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.6 + ph);
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, -0.35); ctx.lineTo(5.4 * s, -0.15); ctx.lineTo(5.4 * s, 0.15); ctx.lineTo(0, 0.35); ctx.fill(); }
      ctx.restore();
    }
  },
  pumpjack(ctx, t, col) {
    const a = Math.sin(t * 2.4) * 0.28; ctx.save(); ctx.translate(-0.5, -9); ctx.rotate(a); ctx.fillStyle = col;
    ctx.fillRect(-7, -0.7, 13, 1.4); ctx.beginPath(); ctx.moveTo(6, -2.4); ctx.quadraticCurveTo(8.4, 0, 6, 2.4); ctx.lineTo(5.4, 2.4); ctx.lineTo(5.4, -2.4); ctx.fill(); ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(6.6, -9 + Math.sin(t * 2.4) * 2.2); ctx.lineTo(6.6, -1.2); ctx.stroke();
  },
  beam(ctx, t, col, acc, y) {
    const k = (Math.sin(t * 1.3) + 1) / 2; ctx.save(); ctx.globalAlpha *= 0.22 + 0.25 * k; ctx.fillStyle = acc; ctx.beginPath();
    const dir = Math.sin(t * 0.65) >= 0 ? 1 : -1; ctx.moveTo(0, y); ctx.lineTo(dir * 13, y - 3.2); ctx.lineTo(dir * 13, y + 2.2); ctx.fill(); ctx.restore();
  },
};
ANIM.lighthouse = (c, t, col, acc) => ANIM.beam(c, t, col, acc, -15.4);
ANIM.stripelight = ANIM.lighthouse;
ANIM.pierlight = (c, t, col, acc) => ANIM.beam(c, t, col, acc, -11.2);

function drawLayers(ctx, L, col, bg, acc, t) {
  for (const ly of L) {
    const op = ly[0];
    if (op === 'U') { ctx.save(); ctx.translate(ly[2], ly[3]); if (ly[5]) ctx.rotate(ly[5]); ctx.scale(ly[4], ly[4]); drawMotif(ctx, ly[1], col, bg, acc, t); ctx.restore(); continue; }
    if (op === 'T') {
      ctx.save(); ctx.fillStyle = ly[5] === 'b' ? bg : ly[5] === 'h' ? acc : col; ctx.font = `700 ${ly[4]}px ${MONO}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ly[1], ly[2], ly[3]); ctx.restore(); continue;
    }
    const k = op[0], v = op.length > 1 ? +op.slice(1) : 0, p = path(ly[1]);
    ctx.save();
    if (k === 'f') { ctx.fillStyle = col; ctx.fill(p); }
    else if (k === 'b') { ctx.fillStyle = bg; ctx.fill(p); }
    else if (k === 'h') { ctx.fillStyle = acc; ctx.fill(p); }
    else if (k === 'a') { ctx.globalAlpha *= v; ctx.fillStyle = col; ctx.fill(p); }
    else if (k === 'H') { ctx.globalAlpha *= v; ctx.fillStyle = acc; ctx.fill(p); }
    else { ctx.lineWidth = v || 0.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = k === 's' ? col : k === 'S' ? acc : bg; ctx.stroke(p); }
    ctx.restore();
  }
}
function drawMotif(ctx, key, col, bg, acc, t, still) {
  const L = MOTIFS[key];
  if (L) { drawLayers(ctx, L, col, bg, acc, t); if (ANIM[key] && !still) ANIM[key](ctx, t, col, acc); return; }
  if (key && !/^[a-z0-9]+$/.test(key)) drawEmoji(ctx, key, col, bg);
  else drawLayers(ctx, MOTIFS.townhall, col, bg, acc, t);
}

/* ---------- a city's picture ---------- */
const ARTC = {};
// big = one of the 50 busiest: a fuller skyline behind the landmark
export function cityArt(code, big) {
  const key = code + (big ? '*' : ''); if (ARTC[key]) return ARTC[key];
  const r = seeded(hashStr(key)), motif = motifOf(code) || 'townhall', vec = isVector(motif);
  // buildings behind the landmark: a city gets a skyline, a town a couple of low roofs
  const n = big ? 5 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2), b = [];
  const left = -12.5, span = 25, slot = span / n;
  for (let i = 0; i < n; i++) {
    const w = slot * (0.55 + r() * 0.35), x = left + i * slot + (slot - w) * r(), h = big ? 5 + r() * 9 : 2.5 + r() * 3.5;
    b.push({ x, w, h, roof: big ? ['flat', 'flat', 'step', 'antenna', 'slant'][Math.floor(r() * 5)] : ['flat', 'peak', 'peak'][Math.floor(r() * 3)], lit: Math.floor(r() * 997) });
  }
  return ARTC[key] = { key, b, motif, vec, big };
}
function drawSkyline(ctx, A, col, bg) {
  ctx.save(); ctx.globalAlpha *= A.big ? 0.42 : 0.38; ctx.fillStyle = col;
  for (const B of A.b) {
    ctx.fillRect(B.x, -B.h, B.w, B.h);
    if (B.roof === 'step' && B.w > 2) ctx.fillRect(B.x + B.w * 0.22, -B.h - 1.6, B.w * 0.56, 1.6);
    else if (B.roof === 'antenna') ctx.fillRect(B.x + B.w / 2 - 0.3, -B.h - 3.5, 0.6, 3.5);
    else if (B.roof === 'slant') { ctx.beginPath(); ctx.moveTo(B.x, -B.h); ctx.lineTo(B.x + B.w, -B.h - 2.2); ctx.lineTo(B.x + B.w, -B.h); ctx.fill(); }
    else if (B.roof === 'peak') { ctx.beginPath(); ctx.moveTo(B.x - 0.3, -B.h); ctx.lineTo(B.x + B.w / 2, -B.h - 2); ctx.lineTo(B.x + B.w + 0.3, -B.h); ctx.fill(); }
  }
  ctx.restore();
}
// x,y = the city's dot; k = art scale (bigger on small screens); t = game clock for moving parts
// The still part of each city is drawn once into a small image (per color and size) and reused every frame;
// only the moving bits (windmill blades, lighthouse beams, pump jacks) are drawn live.
const BMP = new Map();
export function drawCityArt(ctx, A, x, y, k, col, bg, acc, t = 0) {
  acc = acc || col;
  const m = ctx.getTransform(), q = Math.max(0.5, Math.round(Math.hypot(m.a, m.b) * k * 8) / 8), key = A.key + '|' + col + '|' + bg + '|' + acc + '|' + q;
  let c = BMP.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.ceil(27 * q); c.height = Math.ceil(25 * q);
    const g = c.getContext('2d'); g.scale(q, q); g.translate(13.5, 23.4);
    drawSkyline(g, A, col, bg); drawMotif(g, A.motif, col, bg, acc, 0, true);
    g.globalAlpha = 0.55; g.fillStyle = col; g.fillRect(-12.5, 0, 25, 0.9);
    BMP.set(key, c); if (BMP.size > 500) BMP.delete(BMP.keys().next().value);
  }
  ctx.drawImage(c, x - 13.5 * k, y + 6 * k - 23.4 * k, 27 * k, 25 * k);
  if (ANIM[A.motif]) { ctx.save(); ctx.translate(x, y + 6 * k); ctx.scale(k, k); ANIM[A.motif](ctx, t, col, acc); ctx.restore(); }
}
// a landmark on its own (city spotlight, cheat sheet): no skyline, fills a w x h box
export function drawLandmark(ctx, code, cx, base, size, col, bg, acc, t = 0) {
  ctx.save(); ctx.translate(cx, base); ctx.scale(size / 24, size / 24); drawMotif(ctx, motifOf(code) || 'townhall', col, bg, acc || col, t); ctx.restore();
}
/* ---------- bombs, interceptors and launchers (Air Defender) ----------
   Drawn pointing along +x, then turned to the direction of travel. Metal is shaded with a gradient
   across the body so it reads as round; a thin glow in the screen's warning color keeps it visible. */
const PATHS = {
  bombBody: 'M6 0C6-1 5-1.9 3.2-2.1H-3.4L-5.6-1.2V1.2L-3.4 2.1H3.2C5 1.9 6 1 6 0Z',
  bombFins: 'M-4.6-1.3L-7.6-3.6H-8.4L-7.1-1ZM-4.6 1.3L-7.6 3.6H-8.4L-7.1 1Z',
  misBody: 'M7.4 0L5.4-1.1H-6.6V1.1H5.4Z', misNose: 'M7.4 0L5.4-1.1V1.1Z',
  misFins: 'M-4.6-1L-7-3.4H-7.8L-6.6-1ZM-4.6 1L-7 3.4H-7.8L-6.6 1ZM2.4-1L1.4-2.1H.8L1.2-1ZM2.4 1L1.4 2.1H.8L1.2 1Z',
  rv: 'M6.6 0L-3-2.7Q-4.4-2.7-4.4 0Q-4.4 2.7-3 2.7Z',
  dart: 'M3.6 0L2.3-.85H-2.6V.85H2.3Z', dartFins: 'M-1.6-.7L-3.4-2H-3.9L-3-.6ZM-1.6.7L-3.4 2H-3.9L-3 .6Z',
  rkBody: 'M4.8 0L3.1-1H-3.6V1H3.1Z', rkNose: 'M4.8 0L3.1-1V1Z', rkFins: 'M-2.2-.9L-4.2-2.4H-4.8L-3.8-.8ZM-2.2.9L-4.2 2.4H-4.8L-3.8.8Z',
};
function metal(ctx, r, top, mid, bot) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, top); g.addColorStop(0.42, mid); g.addColorStop(1, bot); return g; }
function flame(ctx, x, len, w, flick) {
  const L = len * (0.8 + flick * 0.4), g = ctx.createLinearGradient(x, 0, x - L, 0);
  g.addColorStop(0, 'rgba(255,255,240,.95)'); g.addColorStop(0.25, 'rgba(255,214,110,.9)'); g.addColorStop(0.6, 'rgba(255,120,40,.55)'); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -w); ctx.quadraticCurveTo(x - L * 0.5, -w * 1.2, x - L, 0); ctx.quadraticCurveTo(x - L * 0.5, w * 1.2, x, w); ctx.fill();
}
const fillP = (ctx, d, style) => { ctx.fillStyle = style; ctx.fill(path(d)); };
// b: { x, y, ux, uy, kind (0 bomb, 1 missile, 2 warhead), child, spin }; warn = about to split
export function drawBombArt(ctx, b, k, clock, col, warn) {
  const a = Math.atan2(b.uy, b.ux), s = k * (b.child ? 0.8 : 1), flick = (Math.sin(clock * 40 + b.spin * 9) + 1) / 2;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.scale(s, s);
  ctx.shadowColor = warn ? col.amb : col.red; ctx.shadowBlur = warn ? 12 : 7;
  if (b.child) {
    flame(ctx, -2.6, 3.4, 0.6, flick); ctx.shadowBlur = 0;
    fillP(ctx, PATHS.dartFins, '#3B4045'); fillP(ctx, PATHS.dart, metal(ctx, 0.85, '#E9EDEF', '#9AA3A8', '#4A5358'));
    fillP(ctx, 'M1.2-.85H1.8V.85H1.2Z', warn ? col.amb : '#D9442F');
  } else if (b.kind === 1) {
    flame(ctx, -6.6, 6.5, 0.9, flick); ctx.shadowBlur = 0;
    fillP(ctx, PATHS.misFins, '#353A3F'); fillP(ctx, PATHS.misBody, metal(ctx, 1.1, '#F4F6F6', '#B8C0C4', '#5C666C'));
    fillP(ctx, PATHS.misNose, metal(ctx, 1.1, '#7A8288', '#3C4246', '#1E2226'));
    fillP(ctx, 'M-1.6-1.1H-.9V1.1H-1.6ZM3.4-1.1H3.9V1.1H3.4Z', warn ? col.amb : '#1F2427');
  } else if (b.kind === 2) {
    // a re-entry warhead: dark heat shield glowing hot at the nose
    ctx.save(); ctx.globalAlpha = 0.55; const tr = ctx.createLinearGradient(-4, 0, -12, 0); tr.addColorStop(0, 'rgba(255,170,90,.7)'); tr.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = tr; ctx.beginPath(); ctx.moveTo(-4, -2.4); ctx.lineTo(-12, 0); ctx.lineTo(-4, 2.4); ctx.fill(); ctx.restore();
    ctx.shadowBlur = 0; fillP(ctx, PATHS.rv, metal(ctx, 2.7, '#8F8676', '#4E463B', '#211D18'));
    const hot = ctx.createRadialGradient(6.2, 0, 0.2, 5, 0, 5); hot.addColorStop(0, 'rgba(255,246,210,.95)'); hot.addColorStop(0.35, 'rgba(255,170,70,.75)'); hot.addColorStop(1, 'rgba(255,90,30,0)');
    fillP(ctx, PATHS.rv, hot); fillP(ctx, 'M-2.4-2.5H-1.7V2.5H-2.4Z', warn ? col.amb : '#C9B27A');
  } else {
    ctx.shadowBlur = 0;
    fillP(ctx, PATHS.bombFins, '#3F4532');
    ctx.strokeStyle = '#3F4532'; ctx.lineWidth = 0.5; ctx.strokeRect(-8.4, -3.6, 0.8, 7.2);
    fillP(ctx, PATHS.bombBody, metal(ctx, 2.1, '#C9CDB8', '#7D8466', '#363B2B'));
    fillP(ctx, 'M3.4-2.05H4.2V2.05H3.4ZM-2.6-2.1H-2V2.1H-2.6Z', warn ? col.amb : '#E8C547');
    fillP(ctx, 'M6-.45H6.9V.45H6Z', '#2A2E22');
  }
  ctx.restore();
}
// the player's interceptor: white body, red nose, bright exhaust
export function drawRocketArt(ctx, m, k, col) {
  const a = Math.atan2(m.b.y - m.y, m.b.x - m.x); ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a); ctx.scale(k, k);
  flame(ctx, -3.6, 5, 0.75, Math.random()); fillP(ctx, PATHS.rkFins, '#2E3338');
  fillP(ctx, PATHS.rkBody, metal(ctx, 1, '#FFFFFF', '#D4DADD', '#7E888E')); fillP(ctx, PATHS.rkNose, '#E0483A');
  fillP(ctx, 'M-.8-1H-.3V1H-.8Z', col.hi); ctx.restore();
}
// a launcher at the bottom of the map: a shaded turret with twin tubes that swing toward the last shot
export function drawLauncherArt(ctx, L, k, col, H) {
  ctx.save(); ctx.translate(L.x, H); ctx.scale(k, k);
  ctx.save(); ctx.rotate(L.ang + Math.PI / 2); const rec = (L.kick || 0) * 2.4;
  ctx.fillStyle = metal(ctx, 2.4, '#9AA39A', '#5E6860', '#2C332E'); ctx.fillRect(-2.6, -16 + rec, 2.2, 10.5); ctx.fillRect(0.4, -16 + rec, 2.2, 10.5);
  ctx.fillStyle = '#1C211E'; ctx.fillRect(-2.4, -16 + rec, 1.8, 0.8); ctx.fillRect(0.6, -16 + rec, 1.8, 0.8); ctx.restore();
  ctx.fillStyle = metal(ctx, 4, '#AEB5AE', '#6B746D', '#323833'); ctx.beginPath(); ctx.arc(0, -2.6, 6, Math.PI, 0); ctx.fill();
  ctx.fillStyle = metal(ctx, 1.6, '#7C857D', '#4B534D', '#262B27'); ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-9, -3); ctx.lineTo(9, -3); ctx.lineTo(11, 0); ctx.fill();
  ctx.strokeStyle = col.mid; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, -2.6, 6, Math.PI, 0); ctx.stroke(); ctx.globalAlpha = 1;
  if (L.kick > 0) {
    const fx = Math.cos(L.ang) * 15, fy = -2.6 + Math.sin(L.ang) * 15, g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 4.2);
    g.addColorStop(0, `rgba(255,250,220,${L.kick})`); g.addColorStop(0.5, `rgba(255,190,90,${L.kick * 0.7})`); g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 4.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ---------- airliners (Tower Control), seen from above, nose along +x ----------
   Five real-world types. The body is white with gray wings and dark engines; the tail, wingtips and a
   soft halo carry the plane's state color (selected, cleared, low on fuel) so the radar still reads at a glance. */
const PLANES = {
  narrow: { len: 1, fus: 'M10 0C10-.9 9.2-1.3 8-1.3H-7.4L-10-.5V.5L-7.4 1.3H8C9.2 1.3 10 .9 10 0Z', wing: 'M1.8-1.2L-5.2-9.4H-6.6L-3.4-1.2ZM1.8 1.2L-5.2 9.4H-6.6L-3.4 1.2Z',
    tail: 'M-7.2-1L-9.6-4.4H-10.4L-9.2-.8ZM-7.2 1L-9.6 4.4H-10.4L-9.2.8Z', eng: [[-0.4, -4.2, 1.7, 0.62], [-0.4, 4.2, 1.7, 0.62]], tips: 9.4 },
  wide: { len: 1.15, fus: 'M11 0C11-1.1 10-1.6 8.4-1.6H-8L-11-.6V.6L-8 1.6H8.4C10 1.6 11 1.1 11 0Z', wing: 'M2.2-1.5L-6-11.4H-7.8L-4-1.5ZM2.2 1.5L-6 11.4H-7.8L-4 1.5Z',
    tail: 'M-7.8-1.2L-10.4-5.4H-11.4L-10-1ZM-7.8 1.2L-10.4 5.4H-11.4L-10 1Z', eng: [[-0.3, -5, 2.3, 0.85], [-0.3, 5, 2.3, 0.85]], tips: 11.4 },
  jumbo: { len: 1.2, fus: 'M11.4 0C11.4-1.4 10.2-1.8 8-1.8L5-1.6H-8.4L-11.2-.6V.6L-8.4 1.6H5L8 1.8C10.2 1.8 11.4 1.4 11.4 0Z', wing: 'M2.4-1.5L-6.4-11.8H-8.2L-4.2-1.5ZM2.4 1.5L-6.4 11.8H-8.2L-4.2 1.5Z',
    tail: 'M-8-1.2L-10.6-5.6H-11.6L-10.2-1ZM-8 1.2L-10.6 5.6H-11.6L-10.2 1Z', eng: [[0.4, -4.2, 1.9, 0.7], [-2.6, -7.6, 1.8, 0.66], [0.4, 4.2, 1.9, 0.7], [-2.6, 7.6, 1.8, 0.66]], tips: 11.8 },
  regional: { len: 0.82, fus: 'M9 0C9-.8 8.3-1.1 7.2-1.1H-7.4L-9.4-.4V.4L-7.4 1.1H7.2C8.3 1.1 9 .8 9 0Z', wing: 'M1.4-1L-3.4-7.4H-4.6L-2.4-1ZM1.4 1L-3.4 7.4H-4.6L-2.4 1Z',
    tail: 'M-8-.6L-9.8-3.6H-10.4L-9.6-.4ZM-8 .6L-9.8 3.6H-10.4L-9.6.4Z', eng: [[-5.6, -1.9, 1.5, 0.55], [-5.6, 1.9, 1.5, 0.55]], tips: 7.4 },
  prop: { len: 0.85, fus: 'M8.6 0C8.6-.8 8-1.1 7-1.1H-7L-9.2-.4V.4L-7 1.1H7C8 1.1 8.6.8 8.6 0Z', wing: 'M1.6-1L1.2-9H-.8L-1.2-1ZM1.6 1L1.2 9H-.8L-1.2 1Z',
    tail: 'M-7.2-.6L-8.4-3.6H-9.2L-8.8-.4ZM-7.2.6L-8.4 3.6H-9.2L-8.8.4Z', eng: [[1.6, -3.6, 1.6, 0.5], [1.6, 3.6, 1.6, 0.5]], tips: 9, props: true },
};
export const PLANE_TYPES = Object.keys(PLANES);
// p: { x, y, hdg, type }, c = state color, sel = selected; ground = refueling (no shadow, no props spinning)
export function drawPlaneArt(ctx, p, c, sel, ground, clock) {
  const T = PLANES[p.type] || PLANES.narrow, s = T.len * 1.15;
  // shadow on the ground below a flying plane
  if (!ground) { ctx.save(); ctx.translate(p.x + 2.4, p.y + 3); ctx.rotate(p.hdg); ctx.scale(s, s); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.fill(path(T.wing)); ctx.fill(path(T.fus)); ctx.fill(path(T.tail)); ctx.restore(); }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.hdg); ctx.scale(s, s);
  ctx.shadowColor = c; ctx.shadowBlur = sel ? 12 : 7;
  ctx.fillStyle = metal(ctx, T.tips, '#E6EBEE', '#B9C2C7', '#7F8A91'); ctx.fill(path(T.wing)); ctx.shadowBlur = 0;
  ctx.fillStyle = metal(ctx, 4, '#D9E0E4', '#AEB8BE', '#7C878E'); ctx.fill(path(T.tail));
  for (const [ex, ey, rx, ry] of T.eng) {
    const g = ctx.createLinearGradient(0, ey - ry, 0, ey + ry); g.addColorStop(0, '#8E979C'); g.addColorStop(0.5, '#4B5359'); g.addColorStop(1, '#262B2F');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, 7); ctx.fill();
    if (T.props) { ctx.save(); ctx.globalAlpha = ground ? 0.5 : 0.35; ctx.strokeStyle = '#D9DEE1'; ctx.lineWidth = 0.35; ctx.beginPath();
      const r = 2.6, w = ground ? 0 : clock * 30; ctx.moveTo(ex + rx, ey - r * Math.cos(w)); ctx.lineTo(ex + rx, ey + r * Math.cos(w)); ctx.stroke(); ctx.globalAlpha = ground ? 0 : 0.18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex + rx, ey, 0.4, r, 0, 0, 7); ctx.fill(); ctx.restore(); }
  }
  ctx.fillStyle = metal(ctx, 1.6, '#FFFFFF', '#E9EEF0', '#A9B3B9'); ctx.fill(path(T.fus));
  // tail fin seen from above, and a livery stripe, in the state color
  ctx.fillStyle = c; ctx.fillRect(-9.8 * (T.len < 0.9 ? 0.95 : 1), -0.32, 3.4, 0.64); ctx.fillRect(-5, -0.18, 11, 0.36);
  // cockpit windows and wingtip lights (red left, green right)
  ctx.fillStyle = '#1B2328'; const nx = T === PLANES.wide || T === PLANES.jumbo ? 9.6 : 8.2;
  ctx.beginPath(); ctx.moveTo(nx, -0.8); ctx.quadraticCurveTo(nx + 1, 0, nx, 0.8); ctx.lineTo(nx - 0.4, 0.6); ctx.lineTo(nx - 0.4, -0.6); ctx.fill();
  const blink = Math.floor(clock * 2) % 2 === 0, tipX = T.props ? 0 : -5.9 * (T.tips / 9.4);
  ctx.fillStyle = '#FF4B3E'; ctx.beginPath(); ctx.arc(tipX, -T.tips + 0.3, 0.45, 0, 7); ctx.fill();
  ctx.fillStyle = '#4BFF8A'; ctx.beginPath(); ctx.arc(tipX, T.tips - 0.3, 0.45, 0, 7); ctx.fill();
  if (blink && !ground) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(-9.4, 0, 0.45, 0, 7); ctx.fill(); }
  ctx.restore();
}
export const ALL_MOTIFS = () => Object.keys(MOTIFS);
export { drawMotif };
