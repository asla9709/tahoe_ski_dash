// Refresh open/closed status for every resort, then rebuild dist/ski-maps.html.
// Usage: npm run update            (all resorts)
//        npm run update -- heavenly (just one)
const fetchStatus = require('./fetch_status');
const build = require('./build');
(async () => {
  await fetchStatus();   // a resort that fails keeps its previous status file
  build();
})();
