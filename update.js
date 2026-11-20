// Refresh open/closed status and weather, then rebuild dist/ski-maps.html.
// Usage: npm run update            (all resorts)
//        npm run update -- heavenly (status for just one resort)
const fetchStatus = require('./fetch_status');
const fetchWeather = require('./fetch_weather');
const build = require('./build');
(async () => {
  await fetchStatus();   // a resort that fails keeps its previous status file
  await fetchWeather();  // on failure the previous weather file is kept
  build();
})();
