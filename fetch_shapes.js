// Downloads run and lift SHAPES from OpenSkiMap for the ski areas in resorts.json
// and writes data/shapes/<resort>.json. Only needed when adding a resort or when
// OpenStreetMap's run lines change; `npm run update` does not need it.
const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const HERE = __dirname;
const resorts = JSON.parse(fs.readFileSync(path.join(HERE, 'resorts.json'), 'utf8'));
const want = {};
for (const [key, r] of Object.entries(resorts)) for (const id of r.skiAreaIds) want[id] = key;
const out = Object.fromEntries(Object.keys(resorts).map(k => [k, { runs: [], lifts: [] }]));

function stream(kind) {
  const url = `https://tiles.openskimap.org/geojson/${kind}.geojson`;
  console.log(`Downloading ${url} (large; takes a few minutes)`);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ski-maps/1.0' } }, res => {
      if (res.statusCode !== 200) return reject(new Error(`${url}: HTTP ${res.statusCode}`));
      const rl = readline.createInterface({ input: res, crlfDelay: Infinity });
      rl.on('line', raw => {
        const line = raw.trim().replace(/,$/, '');
        if (!line.startsWith('{"type":"Feature"')) return;
        const hit = Object.keys(want).find(id => line.includes(id));
        if (!hit) return;
        const f = JSON.parse(line), p = f.properties;
        const areaIds = (p.skiAreas || []).map(a => a.properties && a.properties.id);
        const key = want[areaIds.find(a => want[a]) || hit];
        out[key][kind].push({ name: p.name, difficulty: p.difficulty || null, liftType: p.liftType || null, geometry: f.geometry });
      });
      rl.on('close', resolve);
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  await stream('runs');
  await stream('lifts');
  fs.mkdirSync(path.join(HERE, 'data', 'shapes'), { recursive: true });
  for (const [key, d] of Object.entries(out)) {
    fs.writeFileSync(path.join(HERE, 'data', 'shapes', `${key}.json`), JSON.stringify(d));
    console.log(`${key}: ${d.runs.length} runs, ${d.lifts.length} lifts`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
