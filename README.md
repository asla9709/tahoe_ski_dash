# Tahoe ski dash

**Live page: https://asla9709.github.io/tahoe_ski_dash/**

Run and lift maps for Northstar, Heavenly and Kirkwood. Open terrain is colored by difficulty and closed terrain is gray. The output is a single self-contained page, `dist/ski-maps.html`, with one tab per resort.

## Refresh the open/closed status

You need Node.js 18 or newer.

```sh
git clone https://github.com/asla9709/tahoe_ski_dash && cd tahoe_ski_dash
npm run setup      # once: installs Playwright and its Chromium
npm run update     # fetch today's status for every resort and rebuild the page
```

Then open `dist/ski-maps.html` in a browser.

- `npm run update -- heavenly` refreshes a single resort.
- If a resort's site fails, its previous status file is kept, the page still builds, and the command exits with code 1.
- The resort sites block plain HTTP clients, which is why this uses a headless browser.

To run it on a schedule, use cron (or Task Scheduler on Windows), for example every 30 minutes from 7am to 4pm:

```cron
*/30 7-16 * * ## Automatic updates with GitHub Actions

`.github/workflows/update.yml` runs three times a day, at 4am, 8am and 11pm Pacific (an hour later during daylight time), until **February 20, 2027**. On the first scheduled run after that date, the workflow turns itself off. You can also start it anytime with **Run workflow** on the Actions tab while it's enabled.

Each run does three things:

1. Runs `npm run update`.
2. Commits the new status files and `dist/ski-maps.html` to `main`.
3. Publishes the page to the `gh-pages` branch, which GitHub Pages serves at the link above.

- If the site doesn't appear, open Settings > Pages and set Source to "Deploy from a branch", with branch `gh-pages` and folder `/ (root)`.
- A run fails if no resort could be fetched, which would most likely mean the resort sites are blocking GitHub's servers.
- To change the schedule, edit the `cron` line. It's in UTC.
- To run it longer, change `ACTIVE_UNTIL` near the top of the workflow. If the end date already passed and the workflow turned itself off, re-enable it on the Actions tab.

n.
- To change the schedule, edit the `cron` line. It's in UTC.
- To run it longer, change `ACTIVE_UNTIL` near the top of the workflow. If the end date already passed and the workflow turned itself off, re-enable it on the Actions tab.

## How it works

| File | What it is |
| --- | --- |
| `resorts.json` | Each resort's status page URL, OpenSkiMap ski-area IDs, map rotation, and name aliases |
| `data/shapes/<resort>.json` | Run and lift lines from OpenSkiMap. Changes rarely. |
| `data/status/<resort>.json` | Open/closed status from the resort site. Rewritten by `npm run update`. |
| `fetch_status.js` | Downloads the status. Each site embeds a `TerrainStatusFeed` JSON blob in its page. |
| `build.js` | Matches run names between the two sources and writes `dist/ski-maps.html` from `template.html` |
| `fetch_shapes.js` | Re-downloads the run shapes (`npm run shapes`). Only needed when adding a resort. |

## When names don't match

OpenStreetMap and the resort sometimes name a run differently. `build.js` prints two lists on every run:

- **on map but not in status report:** lines drawn thin gray, with no status
- **in status report but not on map:** runs OpenStreetMap doesn't have

If the same run appears in both lists under different names, add an alias to that resort in `resorts.json`, with the map name on the left and the status-report name on the right:

```json
"aliases": { "Cloud 9": "Cloud Nine" }
```

Some differences are already handled automatically:

- a leading "The", punctuation and capitalization
- word order of Upper/Lower/Left/Right ("Upper Mombo" matches "Mombo Upper")
- lift words like Express, Quad, Triple and Chair
- one map line that covers a run the report splits into Upper and Lower pieces. It's drawn dotted when only some of the pieces are open.

## Adding a resort

Any Vail Resorts mountain should work.

1. Find the ski area on openskimap.org. Search `https://api.openskimap.org/search?query=<name>` to get its ID.
2. Add an entry to `resorts.json`.
3. Run `npm run shapes`, then `npm run update`.

Data: runs and lifts © OpenStreetMap contributors via OpenSkiMap; status from each resort's website.
