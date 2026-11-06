// A first-pass name filter so the world leaderboard stays school-friendly.
// The word lists are ROT13'd so the file doesn't read like a list of swears.
// The same check runs in the database (supabase/schema.sql), so it can't be skipped.
const R = (w) => w.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
// never OK anywhere inside a name
const STRICT = ["shpx", "spx", "cuhpx", "fuvg", "fu1g", "ovgpu", "ovngpu", "phag", "avttre", "avttn", "avtt", "xvxr", "puvax", "tbbx", "jrgonpx", "ornare", "snttbg", "sntbg", "genaal", "ergneq", "ergeq", "juber", "fyhg", "cbea", "chffl", "cravf", "intvan", "qvyqb", "obare", "oybjwbo", "unaqwbo", "wvmm", "phzfubg", "encvfg", "zbyrfg", "anmv", "uvgyre", "xxx", "wvunq", "pbpxfhpx", "zbgures", "nffubyr", "qvpxurnq", "onfgneq", "jnaxre", "gjng", "obyybpx", "gvgf", "gvggl", "obbo", "zvys", "uragnv"].map(R);
// only blocked as a whole word, so names like Cassie, Bass, Fagan or Dickens still work
const WORDS = new Set(["nff", "nefr", "phz", "frk", "qvpx", "pbpx", "gvg", "ubr", "wnc", "fcvp", "fcvpx", "encr", "crqb", "fhvpvqr", "snt", "qlxr", "avtn", "shx", "ubeal", "nqzva", "zbqrengbe", "bssvpvny", "naguebcvp"].map(R));
// real words that happen to contain a blocked one
const ALLOW = ["matsushita", "shiitake", "shitake", "therapist", "scunthorpe", "penistone"];
const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' };
const squash = (s) => s.replace(/(.)\1+/g, '$1');
// "seeex" counts as "sex", but "Jaap" doesn't count as "jap": only runs of three or more get squashed
const stretched = (s) => (/(.)\1\1/.test(s) ? squash(s) : s);

// '' when the name is fine, otherwise a short reason to show
export function nameProblem(name) {
  const low = String(name || '').toLowerCase(), tr = low.replace(/[0-9]/g, (d) => LEET[d]);
  let flat = tr.replace(/_/g, '');
  for (const a of ALLOW) flat = flat.split(a).join('');
  const no = "Pick a different name. That one isn't allowed.";
  for (const w of STRICT) if (flat.includes(w) || (squash(w) === w && squash(flat).includes(w))) return no;
  const parts = [flat, ...tr.split(/_+/), ...low.split(/[_0-9]+/)].filter(Boolean);
  if (parts.some((p) => WORDS.has(p) || WORDS.has(stretched(p)))) return no;
  return '';
}
