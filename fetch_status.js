// Downloads current lift/run status for each resort in resorts.json and writes
// data/status/<resort>.json. The resort sites block plain HTTP clients, so this
// uses a headless Chromium via Playwright.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const resorts = JSON.parse(fs.readFileSync(path.join(HERE, 'resorts.json'), 'utf8'));
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));

function extractFeed(html) {
  // The page embeds the status as `TerrainStatusFeed = {...};` (the last copy is the current format).
  const re = /TerrainStatusFeed = (\{.*?\});\s*\n/g;
  let m, last = null;
  while ((m = re.exec(html))) last = m[1];
  if (!last) throw new Error('TerrainStatusFeed not found on page');
  return JSON.parse(last);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  fs.mkdirSync(path.join(HERE, 'data', 'status'), { recursive: true });
  let failures = 0, attempted = 0;
  for (const [key, r] of Object.entries(resorts)) {
    if (only.length && !only.includes(key)) continue;
    attempted++;
    const page = await ctx.newPage();
    try {
      await page.goto(r.statusUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => document.documentElement.innerHTML.includes('TerrainStatusFeed ='), null, { timeout: 60000 });
      const feed = extractFeed(await page.content());
      const trails = [], lifts = [];
      for (const a of feed.GroomingAreas) {
        for (const t of a.Trails) trails.push({ name: t.Name, area: a.Name, open: !!t.IsOpen, groomed: !!t.IsGroomed, difficulty: t.Difficulty });
        for (const l of a.Lifts) lifts.push({ name: l.Name, area: a.Name, status: l.Status, open: l.Status === 'Open' });
      }
      const out = { resort: key, asOf: feed.Date, fetchedAt: new Date().toISOString(), trails, lifts };
      fs.writeFileSync(path.join(HERE, 'data', 'status', `${key}.json`), JSON.stringify(out, null, 1));
      console.log(`${r.name}: ${trails.filter(t => t.open).length}/${trails.length} runs, ${lifts.filter(l => l.open).length}/${lifts.length} lifts open (as of ${feed.Date})`);
    } catch (e) {
      failures++;
      console.error(`${r.name}: FAILED - ${e.message}. Keeping previous status file.`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  // exit code 1: some resorts failed (previous status kept); 2: all failed
  if (failures) process.exitCode = failures === attempted ? 2 : 1;
}
module.exports = main;
if (require.main === module) main();
