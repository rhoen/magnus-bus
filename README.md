# Magnus’s Bus

A small, mobile-friendly tracker for **SEPTA Route 42 to school and back home**: eastbound at Spruce & 49th (stop 22120), and westbound at Spruce & 42nd (stop 22151). Shows the two closest approaching buses, each bus’s reported next stop, and the number of stops from that stop to yours. Refreshes every 15 seconds while visible.

## Direction selection

A large button switches between **To school · Eastbound** and **Back home · Westbound**, updating the boarding stop, bus list and route strip together. Philadelphia time (`America/New_York`) chooses eastbound before 12:00 PM and westbound from 12:00 PM onward. This follows daylight saving time and checks again when a background tab is reopened.

A manual choice overrides the clock for the current page visit. Choose **Use time of day** or reload to restore the automatic default. The app does not persist a manual choice into a later visit. Direction switches cancel the previous request and discard late responses, so an eastbound response cannot populate the westbound view.

## Run

Requires Node.js 22 or later. No dependencies or API keys.

```sh
npm start
```

Open http://localhost:3000. Use `PORT=3001 npm start` to change the port.

```sh
npm test
npm run build
```

The build creates a self-contained Cloudflare-compatible ESM Worker in `dist/server/index.js`, plus the Sites hosting manifest. The frontend and a same-origin `/api/buses` endpoint are served by the Worker. The backend fetches public SEPTA data, avoiding browser CORS restrictions. No personal data, location permission, or analytics are collected.

## Data and counting

- Vehicles: https://www3.septa.org/api/TransitView/index.php?route=42
- Ordered stops: https://www3.septa.org/api/v2/stops/?route_id=42
- Stop verification: https://www3.septa.org/api/Stops/index.php?req1=42
- Documentation: https://www3.septa.org/#/Real%20Time%20Data/TransitView
- Route listing: https://www3.septa.org/VIBusAndTrolley.html

Selects Route 42 / direction 0 (east) or 1 (west) stop metadata from the newest schedule release effective on the current Philadelphia date, ignoring future releases. The route-wide list merges two branches: Wycombe and 61st & Pine. Their distinct prefixes were checked against SEPTA GTFS on October 27, 2026; Wycombe buses skip the Pine loop stops (437 and 26108). The westbound stop order through stop 22151 was also checked against SEPTA’s stop list and GTFS. The dynamic stop list refreshes hourly, and results are cached independently for each direction for ten seconds per server instance. Changes to branch routing may require updating `src/tracking.js`.

TransitView's `next_stop_id` is the **reported next stop**, not the last visited stop or a prediction of arrival time. “1 stop from yours” means the reported next stop is directly before your stop. Zero means “Your stop is next.” Buses beyond the target are excluded. Buses are ranked by remaining stops, breaking ties with GPS proximity to the next stop. Arrival order can change. There are no invented ETAs or simulated buses.

Only GPS reports up to two minutes old are used; stale reports are also removed in the browser between refreshes and immediately upon returning to the tab. Physical buses are deduplicated. A future assignment is excluded while the same bus has an active record in the opposite direction. Unrecognized stops are omitted with a notice. API failures show an error and retry, retaining only still-fresh earlier reports. No fresh buses is not a claim that service has stopped.

The route strip is a schematic of the final Spruce Street stops before the selected boarding stop, not a map or an interpolated bus location. For detours and service changes, use the SEPTA alerts link in “How this works.”

## Files

- `src/directions.js`: stop configuration and Philadelphia-time default.
- `src/tracking.js`: feed validation, branch-aware counting, filtering and sorting.
- `src/worker.js`: HTML/API serving, upstream timeouts, cache.
- `src/page.js`: responsive interface, refresh and freshness handling.
- `scripts/dev.mjs`: local HTTP adapter for the same Worker.
- `scripts/build.mjs`: dependency-free deployment bundle.
- `test/tracking.test.mjs`: branch counts, direction, passed stops, duplicate vehicles, freshness, invalid feeds and release transitions.

The app is independent of SEPTA. Publication is private to the owner unless access is explicitly changed.

Direction tests cover the noon boundary, daylight saving time, midnight, manual overrides, racing responses, westbound stop counts and API cache isolation. Run `npm test` for the complete suite.
