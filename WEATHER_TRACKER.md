# KLAX weather market tracker

The public dashboard lives at `weather.html`. It is intentionally static so it works on GitHub Pages without exposing credentials or depending on a server.

## Add a morning snapshot

1. Run the forecast/nowcast in the weather project.
2. Add the forecast distribution, threshold probabilities, quoted prices, and any position to `weather-snapshots.json`.
3. Regenerate the browser data:

```bash
npm run update:weather
```

Commit `weather-snapshots.json` and the generated `weather-data.js` together. When a market settles, add its official KLAX high and realized P&L to that snapshot's `outcome` field, regenerate, and publish again.

The dashboard labels model probabilities separately from transcribed Robinhood quotes. It should remain an audit log, not a claim that the strategy is proven or profitable.
