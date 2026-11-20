// Generates the color tokens for every color theme in light and dark mode.
// Colors are designed in OKLCH and written out as hex, because the game canvases read
// some of these tokens back with getComputedStyle and parse them as hex/rgb.
import { writeFileSync } from 'node:fs';

function oklch(L, C, H) {
  const conv = (c) => {
    const h = (H * Math.PI) / 180, a = c * Math.cos(h), b = c * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  const inG = (v) => v.every((x) => x >= -1e-4 && x <= 1 + 1e-4);
  let rgb = conv(C);
  if (!inG(rgb)) { let lo = 0, hi = C; for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (inG(conv(mid))) lo = mid; else hi = mid; } rgb = conv(lo); }
  const enc = (v) => { v = Math.min(1, Math.max(0, v)); const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(s * 255); };
  return '#' + rgb.map(enc).map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// nh/nc = hue and chroma of the neutrals; acc = accent [L, C, H] for each mode; ink = accent used as text on light surfaces
const THEMES = [
  { id: 'green', nh: 250, nc: 0.012, acc: { light: [0.84, 0.165, 86], dark: [0.86, 0.16, 88] }, ink: [0.55, 0.12, 72], chart: true },
  { id: 'forest', nh: 155, nc: 0.016, acc: { light: [0.5, 0.13, 152], dark: [0.79, 0.15, 150] } },
  { id: 'red', nh: 25, nc: 0.016, acc: { light: [0.52, 0.18, 27], dark: [0.74, 0.15, 24] } },
  { id: 'orange', nh: 55, nc: 0.018, acc: { light: [0.56, 0.16, 48], dark: [0.8, 0.15, 62] } },
  { id: 'blue', nh: 255, nc: 0.018, acc: { light: [0.5, 0.16, 258], dark: [0.76, 0.12, 252] } },
  { id: 'purple', nh: 300, nc: 0.018, acc: { light: [0.5, 0.18, 300], dark: [0.77, 0.13, 302] } },
  { id: 'pink', nh: 355, nc: 0.018, acc: { light: [0.53, 0.18, 358], dark: [0.8, 0.13, 355] } },
  { id: 'ice', nh: 215, nc: 0.018, acc: { light: [0.52, 0.1, 218], dark: [0.85, 0.11, 205] } },
  { id: 'mono', nh: 0, nc: 0, acc: { light: [0.25, 0, 0], dark: [0.93, 0, 0] } },
];

function tokens(t, mode) {
  const n = (L, k = 1) => oklch(L, t.nc * k, t.nh);
  const dark = mode === 'dark';
  const accent = oklch(...t.acc[mode]);
  const boardAcc = oklch(...t.acc.dark);
  const T = {};
  if (!dark) {
    Object.assign(T, {
      paper: n(0.955, 1.1), panel: n(0.995, 0.35), 'panel-2': n(0.972, 0.8), line: n(0.885, 1.3), 'line-2': n(0.74, 1.5),
      ink: n(0.22, 1.6), muted: n(0.475, 1.6),
      board: n(0.2, 1.7), 'board-2': n(0.255, 1.7), 'board-line': n(0.32, 1.6), 'board-ink': n(0.97, 0.4), 'board-muted': n(0.74, 1),
      tile: n(0.21, 1.3), 'tile-ink': n(0.975, 0.4), 'tile-split': n(0.1, 1),
    });
  } else {
    Object.assign(T, {
      paper: n(0.165, 1.35), panel: n(0.205, 1.45), 'panel-2': n(0.245, 1.45), line: n(0.305, 1.4), 'line-2': n(0.43, 1.4),
      ink: n(0.95, 0.5), muted: n(0.735, 0.9),
      board: n(0.125, 1.5), 'board-2': n(0.175, 1.5), 'board-line': n(0.27, 1.4), 'board-ink': n(0.97, 0.4), 'board-muted': n(0.72, 0.9),
      tile: n(0.105, 1.2), 'tile-ink': n(0.975, 0.4), 'tile-split': n(0.3, 1),
    });
  }
  T.accent = accent;
  // text on the accent: whichever of the dark board or the light panel reads better
  const darkOn = n(0.16, 1.2), lightOn = n(0.99, 0.3);
  T['on-accent'] = contrast(accent, darkOn) >= contrast(accent, lightOn) ? darkOn : lightOn;
  // accent used as text, lines and focus rings on the page's own surfaces
  T['accent-ink'] = dark ? accent : t.ink ? oklch(...t.ink) : accent;
  T['board-acc'] = boardAcc;
  T.title = T['accent-ink'];
  T.bar = T['accent-ink'];
  // maps: the original theme keeps the look of an aviation sectional chart, the rest tint the map with the theme
  if (t.chart) {
    Object.assign(T, dark
      ? { terrain: oklch(0.275, 0.025, 150), grid: oklch(0.37, 0.02, 200), sea: oklch(0.2, 0.03, 245), land2: oklch(0.235, 0.012, 230), mtn: oklch(0.335, 0.025, 100), 'mtn-line': oklch(0.5, 0.035, 95), water: oklch(0.66, 0.1, 240) }
      : { terrain: oklch(0.925, 0.035, 125), grid: oklch(0.78, 0.03, 130), sea: oklch(0.885, 0.03, 235), land2: oklch(0.955, 0.01, 110), mtn: oklch(0.85, 0.045, 90), 'mtn-line': oklch(0.62, 0.06, 80), water: oklch(0.6, 0.1, 245) });
  } else {
    const m = (L, C) => oklch(L, Math.min(C, t.nc ? C : 0), t.nh);
    Object.assign(T, dark
      ? { terrain: m(0.27, 0.024), grid: m(0.37, 0.02), sea: m(0.19, 0.02), land2: m(0.23, 0.01), mtn: m(0.325, 0.025), 'mtn-line': m(0.49, 0.03), water: m(0.67, 0.07) }
      : { terrain: m(0.925, 0.03), grid: m(0.75, 0.02), sea: m(0.875, 0.022), land2: m(0.955, 0.008), mtn: m(0.855, 0.03), 'mtn-line': m(0.62, 0.04), water: m(0.57, 0.08) });
  }
  return T;
}

// mode-level tokens: the same for every color theme
const MODE = {
  light: { good: oklch(0.52, 0.13, 150), bad: oklch(0.53, 0.18, 28), blue: oklch(0.5, 0.15, 255), magenta: oklch(0.5, 0.17, 350), ochre: oklch(0.55, 0.12, 70), shadow: 'rgba(22,30,42,.16)' },
  dark: { good: oklch(0.78, 0.14, 152), bad: oklch(0.73, 0.15, 28), blue: oklch(0.77, 0.11, 250), magenta: oklch(0.76, 0.13, 350), ochre: oklch(0.8, 0.13, 78), shadow: 'rgba(0,0,0,.55)' },
};

// game screens (unchanged from the old color modes; Original keeps a green Air Defender and a blue Tower radar)
const CRT = {
  green: '--crt-bg:#03100A;--crt-hi:#86FFAD;--crt-mid:#36B96A;--crt-lo:#0E3320;--crt-amber:#FFC15A;--crt-red:#FF5C4D;--crt-water:#3FB7A6;--crt-sea:#020A06;--crt-land:#0B2A1A;--rad-good:#6BE39A',
  radar: '--crt-bg:#06121C;--crt-hi:#E4F2FF;--crt-mid:#4DB2DD;--crt-lo:#123049;--crt-amber:#FFC15A;--crt-red:#FF6B5C;--rad-good:#6BE39A;--crt-water:#3D86D6;--crt-sea:#030B12;--crt-land:#0F2940',
  red: '--crt-bg:#140506;--crt-hi:#FFB4A9;--crt-mid:#EC5A45;--crt-lo:#401310;--crt-amber:#FFD36B;--crt-red:#FFF4E0;--crt-water:#C24A3A;--crt-sea:#0A0203;--crt-land:#2A0C0A;--rad-good:#FFD36B',
  orange: '--crt-bg:#140B03;--crt-hi:#FFD7A3;--crt-mid:#F5932F;--crt-lo:#42280C;--crt-amber:#FFF1A6;--crt-red:#FF5248;--crt-water:#D88A35;--crt-sea:#0B0602;--crt-land:#2C1907;--rad-good:#C8F07A',
  blue: '--crt-bg:#030B18;--crt-hi:#C4E4FF;--crt-mid:#4AA3F0;--crt-lo:#0F2D50;--crt-amber:#FFC15A;--crt-red:#FF6B5C;--crt-water:#3B7FE3;--crt-sea:#020712;--crt-land:#0D2546;--rad-good:#6BE39A',
  purple: '--crt-bg:#0C0617;--crt-hi:#E8D2FF;--crt-mid:#AE78FF;--crt-lo:#2C1849;--crt-amber:#FFC97A;--crt-red:#FF5C86;--crt-water:#7A5DE6;--crt-sea:#060310;--crt-land:#1E1135;--rad-good:#7DF0B0',
  pink: '--crt-bg:#17050F;--crt-hi:#FFC9E7;--crt-mid:#FF63B4;--crt-lo:#481232;--crt-amber:#8DF2FF;--crt-red:#FFE45C;--crt-water:#E0559F;--crt-sea:#0C0208;--crt-land:#2E0B1F;--rad-good:#8DF2FF',
  ice: '--crt-bg:#021317;--crt-hi:#CCFBFF;--crt-mid:#3DD5E8;--crt-lo:#0B3842;--crt-amber:#FFC15A;--crt-red:#FF6B5C;--crt-water:#2CA6C7;--crt-sea:#010A0C;--crt-land:#0A2B32;--rad-good:#9DF59A',
  mono: '--crt-bg:#0A0B0C;--crt-hi:#F4F4F4;--crt-mid:#A7ADB3;--crt-lo:#2F3439;--crt-amber:#FFC15A;--crt-red:#FF5C4D;--crt-water:#7C858D;--crt-sea:#050607;--crt-land:#1B1E21;--rad-good:#8FE3A6',
};
CRT.forest = CRT.green;

const decl = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
const PREV = ['paper', 'panel', 'line', 'ink', 'muted', 'accent', 'board', 'board-2', 'board-line', 'board-acc', 'tile'];
const pick = (o) => Object.fromEntries(PREV.map((k) => [k, o[k]]));

let css = '/* ================= color tokens (generated by gen-themes.mjs: 9 color themes x light/dark) =================\n'
  + '   Dark is the default. data-mode="light" on <html> switches to light; data-crt picks the color theme (none = Original). */\n';
const g = THEMES[0];
css += `:root{${decl(tokens(g, 'dark'))};${decl(MODE.dark)};${CRT.green};color-scheme:dark}\n`;
css += `:root[data-mode="light"]{${decl(tokens(g, 'light'))};${decl(MODE.light)};color-scheme:light}\n`;
css += `.radar{${CRT.radar}}\n`;
for (const t of THEMES.slice(1)) {
  css += `:root[data-crt="${t.id}"]{${decl(tokens(t, 'dark'))}}\n`;
  css += `:root[data-crt="${t.id}"][data-mode="light"]{${decl(tokens(t, 'light'))}}\n`;
}
// game screens per theme (forest keeps the green defender and turns the Tower radar green too)
css += `:root[data-crt="forest"] .radar{${CRT.green}}\n`;
for (const id of ['red', 'orange', 'blue', 'purple', 'pink', 'ice', 'mono']) css += `:root[data-crt="${id}"],:root[data-crt="${id}"] .radar{${CRT[id]}}\n`;
// the little previews in the Colors menu show each theme in the current mode
css += '/* previews in the Colors menu */\n';
for (const t of THEMES) {
  css += `.tp-page[data-crt-prev="${t.id}"]{${decl(pick(tokens(t, 'dark')))};${CRT[t.id]}}\n`;
  css += `:root[data-mode="light"] .tp-page[data-crt-prev="${t.id}"]{${decl(pick(tokens(t, 'light')))}}\n`;
}
writeFileSync(new URL('../src/trainer/tokens.css', import.meta.url), css);

// contrast report for the pairs that carry text
const report = [];
for (const t of THEMES) for (const mode of ['light', 'dark']) {
  const T = tokens(t, mode);
  report.push(`${t.id.padEnd(7)} ${mode.padEnd(5)} ink/panel ${contrast(T.ink, T.panel).toFixed(1)}  muted/panel ${contrast(T.muted, T.panel).toFixed(1)}  muted/paper ${contrast(T.muted, T.paper).toFixed(1)}  on-accent/accent ${contrast(T['on-accent'], T.accent).toFixed(1)}  accent-ink/panel ${contrast(T['accent-ink'], T.panel).toFixed(1)}  board-acc/board ${contrast(T['board-acc'], T.board).toFixed(1)}  board-muted/board ${contrast(T['board-muted'], T.board).toFixed(1)}  accent ${T.accent}`);
}
console.log(report.join('\n'));
console.log('bytes', css.length);
