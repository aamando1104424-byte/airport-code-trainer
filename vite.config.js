import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/* ---------- map data, packed ----------
   src/data/geo.json stays the readable source. At build time every list of [lon, lat] points becomes a short
   string (delta-encoded integers at 3 decimals, the same precision the file already has), and the page unpacks it
   on load. The build stops if unpacking doesn't give back exactly the same numbers. */
const GEO = fileURLToPath(new URL('./src/data/geo.json', import.meta.url));
const VIRTUAL = '\0geo-packed';
const isPts = (a) => Array.isArray(a) && a.length > 1 && a.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
function encNum(v, out) {
  v = v < 0 ? ~(v << 1) : v << 1;
  while (v >= 0x20) { out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63)); v >>= 5; }
  out.push(String.fromCharCode(v + 63));
}
function encLine(pts) {
  const out = ['~'];
  let px = 0, py = 0;
  for (const [x, y] of pts) {
    const ix = Math.round(x * 1000), iy = Math.round(y * 1000);
    encNum(ix - px, out); encNum(iy - py, out);
    px = ix; py = iy;
  }
  return out.join('');
}
const pack = (o) => (isPts(o) ? encLine(o) : Array.isArray(o) ? o.map(pack) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, pack(v)])) : o);
// the same decoder ships in the page (keep the two in step)
const UNPACK = `function decLine(s){const out=[];let i=1,x=0,y=0;const n=s.length;
  while(i<n){let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);x+=(r&1)?~(r>>1):(r>>1);
    r=0;sh=0;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);y+=(r&1)?~(r>>1):(r>>1);out.push([x/1000,y/1000]);}
  return out;}
function unpack(o){if(typeof o==='string')return o.charCodeAt(0)===126?decLine(o):o;if(Array.isArray(o))return o.map(unpack);
  if(o&&typeof o==='object'){for(const k in o)o[k]=unpack(o[k]);return o;}return o;}`;
function geoPack() {
  return {
    name: 'act-geo-pack',
    enforce: 'pre',
    resolveId(src, importer) {
      if (importer && /[\\/]src[\\/]trainer[\\/]engine\.js$/.test(importer) && src === '../data/geo.json') return VIRTUAL;
      return null;
    },
    load(id) {
      if (id !== VIRTUAL) return null;
      this.addWatchFile(GEO);
      const geo = JSON.parse(readFileSync(GEO, 'utf8'));
      const packed = pack(geo);
      // eslint-disable-next-line no-new-func
      const check = new Function(`${UNPACK};return unpack(JSON.parse(arguments[0]));`)(JSON.stringify(packed));
      if (!isDeepStrictEqual(check, geo)) this.error('geo.json: packed map data does not unpack to the same numbers');
      return `${UNPACK}\nexport default unpack(JSON.parse(${JSON.stringify(JSON.stringify(packed))}));`;
    },
  };
}

/* ---------- Netlify headers ----------
   Written into dist/_headers on every build: a content security policy, no sniffing, a quiet referrer, no device
   APIs, and long caching for the hashed files in /assets. The Supabase address comes from the build's environment.
   'unsafe-inline' scripts and styles are needed by Netlify's own badge (an iframe built from inline code) and by the
   theme script in index.html. The site may be embedded in other pages (see README), so frame-ancestors is left open. */
function netlifyHeaders(env) {
  let sb = '';
  try { sb = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).host : ''; } catch { sb = ''; }
  const connect = ["'self'", ...(sb ? [`https://${sb}`, `wss://${sb}`] : [])].join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
  const body = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
  return {
    name: 'act-netlify-headers',
    apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: '_headers', source: body }); },
    // open the connection to the leaderboard early (only when it's configured)
    transformIndexHtml() {
      return sb ? [{ tag: 'link', attrs: { rel: 'preconnect', href: `https://${sb}`, crossorigin: '' }, injectTo: 'head' }] : [];
    },
  };
}

/* ---------- colors for older browsers ----------
   color-mix() needs Chrome 111 / Safari 16.2 / Firefox 113. School Chromebooks stuck on an older Chrome drop those
   declarations, so the build writes a plain-color version right before each one: older browsers use it and newer
   ones override it with the mix. The fallback is whichever color makes up most of the mix. */
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
function mixFallback(value) {
  let out = '', i = 0;
  for (;;) {
    const j = value.indexOf('color-mix(', i);
    if (j < 0) return out + value.slice(i);
    out += value.slice(i, j);
    let depth = 0, k = j + 'color-mix'.length;
    for (; k < value.length; k++) {
      if (value[k] === '(') depth++;
      else if (value[k] === ')' && --depth === 0) break;
    }
    const [, a = '', b = ''] = splitTop(value.slice(j + 'color-mix('.length, k));
    const pct = (x) => { const m = x.match(/(\d+(?:\.\d+)?)%\s*$/); return m ? +m[1] : null; };
    const bare = (x) => x.replace(/\s+\d+(?:\.\d+)?%\s*$/, '').trim();
    let pa = pct(a), pb = pct(b);
    if (pa == null && pb == null) { pa = 50; pb = 50; } else if (pa == null) pa = 100 - pb; else if (pb == null) pb = 100 - pa;
    out += mixFallback(pa >= pb ? bare(a) : bare(b));
    i = k + 1;
  }
}
const colorMixFallback = {
  postcssPlugin: 'act-color-mix-fallback',
  Declaration(decl) {
    if (decl.prop.startsWith('--') || !decl.value.includes('color-mix(')) return;
    const prev = decl.prev();
    if (prev && prev.type === 'decl' && prev.prop === decl.prop && !prev.value.includes('color-mix(')) return;
    const fb = mixFallback(decl.value);
    if (fb && fb !== decl.value) decl.cloneBefore({ value: fb });
  },
};

// host: true lets your phone open the dev server on the same Wi-Fi
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [geoPack(), react(), netlifyHeaders(env)],
    css: { postcss: { plugins: [colorMixFallback] } },
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // code, React and the airport/map data change at different times, so they're cached separately:
          // a code-only update re-downloads just the small app file
          manualChunks(id) {
            if (id === VIRTUAL || /[\\/]src[\\/]data[\\/]/.test(id) || /[\\/]src[\\/]trainer[\\/]motifs\.js$/.test(id)) return 'data';
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
