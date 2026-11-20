// Downloads hourly temperature and snowfall for each resort's summit and base
// (4 days back, today + 4 days ahead) from Open-Meteo, adjusted to each point's
// elevation. Writes data/weather.json. Summit/base points come from the highest
// and lowest points on the run/lift lines in data/shapes.
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const resorts = JSON.parse(fs.readFileSync(path.join(HERE, 'resorts.json'), 'utf8'));

function extremes(key) {
  const shapes = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'shapes', `${key}.json`), 'utf8'));
  let lo = null, hi = null;
  for (const f of [...shapes.runs, ...shapes.lifts]) {
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const l of lines) for (const c of l) {
      if (c.length < 3) continue;
      if (!lo || c[2] < lo[2]) lo = c;
      if (!hi || c[2] > hi[2]) hi = c;
    }
  }
  return { summit: hi, base: lo };
}

async function fetchWeather() {
  const points = [];
  for (const key of Object.keys(resorts)) {
    const e = extremes(key);
    for (const which of ['summit', 'base']) points.push({ key, which, lon: e[which][0], lat: e[which][1], elev: e[which][2] });
  }
  const q = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(4)).join(','),
    longitude: points.map(p => p.lon.toFixed(4)).join(','),
    elevation: points.map(p => Math.round(p.elev)).join(','),
    hourly: 'temperature_2m,snowfall',
    past_days: '4',
    forecast_days: '5',
    temperature_unit: 'fahrenheit',
    precipitation_unit: 'inch',
    timezone: 'America/Los_Angeles',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { headers: { 'User-Agent': 'tahoe-ski-dash' } });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Open-Meteo: ${body.reason || res.status}`);
  const list = Array.isArray(body) ? body : [body];
  const out = { fetchedAt: new Date().toISOString(), timezone: 'America/Los_Angeles', resorts: {} };
  list.forEach((d, i) => {
    const p = points[i];
    (out.resorts[p.key] = out.resorts[p.key] || {})[p.which] = {
      elevationFt: Math.round(p.elev * 3.28084),
      start: d.hourly.time[0],              // local time, hourly steps
      temp: d.hourly.temperature_2m,         // °F
      snow: d.hourly.snowfall,               // inches per hour
    };
  });
  fs.writeFileSync(path.join(HERE, 'data', 'weather.json'), JSON.stringify(out));
  console.log(`Weather: ${list.length} points, ${list[0].hourly.time.length} hours each`);
}

module.exports = async () => {
  try { await fetchWeather(); return true; }
  catch (e) { console.error(`Weather: FAILED - ${e.message}. Keeping previous weather file.`); return false; }
};
if (require.main === module) module.exports().then(ok => { if (!ok) process.exitCode = 1; });
