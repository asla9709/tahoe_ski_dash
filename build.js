// Combines data/shapes/*.json (run/lift lines) with data/status/*.json (open/closed)
// and writes dist/ski-maps.html, a single self-contained page.
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const resorts = JSON.parse(fs.readFileSync(path.join(HERE, 'resorts.json'), 'utf8'));
// Name matching: lowercase, drop a leading "the" and punctuation, and move position
// words (upper/lower/left/right) to the end so "Upper Mombo" == "Mombo Upper".
const POS = ['upper', 'lower', 'left', 'right'];
const LIFT_WORDS = ['express', 'quad', 'triple', 'double', 'chair', 'chairlift', 'lift', 'platter'];
function words(s) {
  return (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).filter((w, i) => !(i === 0 && w === 'the'));
}
function canon(s, dropLiftWords) {
  let w = words(s);
  if (dropLiftWords) { const k = w.filter(x => !LIFT_WORDS.includes(x)); if (k.length) w = k; }
  return [...w.filter(x => !POS.includes(x)), ...w.filter(x => POS.includes(x))].join('');
}
const base = s => words(s).filter(x => !POS.includes(x)).join('');
const norm = s => canon(s, false);
const round = c => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];

function parts(g) {
  if (g.type === 'LineString') return [g.coordinates.map(round)];
  if (g.type === 'MultiLineString') return g.coordinates.map(l => l.map(round));
  if (g.type === 'Polygon') return [g.coordinates[0].map(round)];
  if (g.type === 'MultiPolygon') return g.coordinates.map(p => p[0].map(round));
  return [];
}

function build() {
const out = {};
for (const [key, r] of Object.entries(resorts)) {
  const shapes = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'shapes', `${key}.json`), 'utf8'));
  const statusPath = path.join(HERE, 'data', 'status', `${key}.json`);
  const status = fs.existsSync(statusPath) ? JSON.parse(fs.readFileSync(statusPath, 'utf8')) : { trails: [], lifts: [] };
  // aliases: map name -> report name (or a list of candidate report names)
  const aliases = Object.fromEntries(Object.entries(r.aliases || {}).map(([a, b]) => [norm(a), [].concat(b)]));
  const makeIndex = (list, isLift) => {
    const exact = {}, loose = {}, groups = {};
    list.forEach(x => {
      exact[norm(x.name)] = x;
      if (isLift) loose[canon(x.name, true)] = x;
      (groups[base(x.name)] = groups[base(x.name)] || []).push(x);
    });
    return { isLift, exact, loose, groups };
  };
  // Returns the matching status entries for a map name (several when the report
  // splits one run into upper/lower pieces).
  const lookup = (name, ix) => {
    for (const cand of [...(aliases[norm(name)] || []), name]) {
      const n = norm(cand);
      if (ix.exact[n]) return [ix.exact[n]];
      if (ix.isLift && ix.loose[canon(cand, true)]) return [ix.loose[canon(cand, true)]];
      const g = ix.groups[base(cand)];
      if (g && words(cand).every(w => !POS.includes(w))) return g;
      if (ix.exact[base(cand)]) return [ix.exact[base(cand)]];
    }
    return null;
  };
  const T = makeIndex(status.trails, false), L = makeIndex(status.lifts, true);
  const reporting = status.trails.length + status.lifts.length > 0;
  const used = new Set(), unmatched = new Set();
  const feats = [];
  const add = (kind, s, ix) => {
    const m = s.name ? lookup(s.name, ix) : null;
    if (m) m.forEach(x => used.add(kind + norm(x.name))); else if (s.name) unmatched.add(s.name);
    let st = reporting ? null : 'closed';
    if (m) { const o = m.filter(x => x.open).length; st = o === 0 ? 'closed' : o === m.length ? 'open' : 'partial'; }
    feats.push({
      t: kind,
      name: m && m.length === 1 ? m[0].name : s.name || '',
      diff: s.difficulty || null,
      status: st,
      p: parts(s.geometry),
    });
  };
  shapes.runs.forEach(s => add('run', s, T));
  shapes.lifts.forEach(s => add('lift', s, L));
  const missing = [...status.trails.map(x => ['run', x]), ...status.lifts.map(x => ['lift', x])]
    .filter(([k, x]) => !used.has(k + norm(x.name))).map(([, x]) => x.name);
  if (!reporting) console.log(`${r.name}: no run/lift status reported (closed or not open yet); showing everything closed`);
  else if (unmatched.size) console.log(`${r.name}: on map but not in status report -> ${[...unmatched].sort().join(', ')}`);
  if (missing.length) console.log(`${r.name}: in status report but not on map -> ${missing.sort().join(', ')}`);
  out[key] = {
    name: r.name, rotate: r.rotate || 0, statusUrl: r.statusUrl, onTheSnowUrl: r.onTheSnowUrl || null, asOf: status.asOf || null, reporting,
    counts: {
      runsOpen: status.trails.filter(t => t.open).length, runs: status.trails.length,
      liftsOpen: status.lifts.filter(l => l.open).length, lifts: status.lifts.length,
    },
    feats,
  };
}
const weatherPath = path.join(HERE, 'data', 'weather.json');
const weather = fs.existsSync(weatherPath) ? JSON.parse(fs.readFileSync(weatherPath, 'utf8')) : null;
for (const key of Object.keys(out)) out[key].weather = weather && weather.resorts[key] ? weather.resorts[key] : null;
const tpl = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
const html = tpl.replace('__DATA__', () => JSON.stringify({ resorts: out, weatherFetchedAt: weather ? weather.fetchedAt : null }));
fs.writeFileSync(path.join(HERE, 'dist', 'ski-maps.html'), html);
console.log(`Wrote dist/ski-maps.html (${Math.round(html.length / 1024)} KB)`);
}
module.exports = build;
if (require.main === module) build();
