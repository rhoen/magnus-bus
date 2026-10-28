# Magnus’s Bus

A browser-only static website for everyday SEPTA trips. The original **Route 42 school and home page** uses eastbound at Spruce & 49th (stop 22120), and westbound at Spruce & 42nd (stop 22151). Shows the two closest approaching buses, their reported next stops, and how many stops those are from yours. Refreshes every 15 seconds while visible.

## Pages

Use the hamburger menu to switch between four static pages:

- `nearby.html`: find nearby buses and trolleys, then track a selected route in either direction.
- `index.html`: Route 42 school/home tracker with the time-of-day direction slider.
- `t2.html`: T2 eastbound at Baltimore & 48th toward 15th St / City Hall. SEPTA names this boarding stop **Baltimore Av & Florence Av**, ID **20870**. Short-turn trips not continuing to City Hall are excluded.
- `center-city.html`: three independent westbound panels: T2 and T3 at **15th St / City Hall**, stop **20659**, and Route 21 at **Walnut & 16th**, stop **14080**. Chestnut & 16th is eastbound, so Walnut is used for the return trip.

Trolley GPS may be unavailable in the tunnel. When a fresh position is available, the cards show stops away and the actual trip's remaining stop list. Otherwise, trolley cards use SEPTA trip-update departure times, labeled **Live estimate** or **Scheduled** according to SEPTA's real-time flag. If active trip updates do not include the next departure, the timetable is filtered to the schedule release and service calendar verified by a current-day trip update. It never mixes all weekday/weekend calendars or turns a timetable into a GPS position. Timetable departures are not guaranteed; service alerts and cancellations can change them.

Each route refreshes independently every 15 seconds. One failing route does not block the others. Menu links and all assets are relative for GitHub Pages project URLs.

## Nearby stops

`nearby.html` is the location-based page in every hamburger menu. Tap **Use my location** to request browser location access. The closest stops (within 800 meters / roughly ½ mile) determine the route list. All routes sharing those stops appear once; adjacent stops within 30 meters of the closest distance are included. **Show more routes** expands the list to all routes within 800 meters. Distances are straight-line estimates, not walking directions.

Choose a route to see the existing two arrival cards and stop diagram. Destination buttons use SEPTA’s `directions.txt` destination names, including branches. Each direction picks its own nearest boarding stop; the compact route heading updates the stop name, destination, stop ID and distance from your location. Directions with no stop within 800 meters are omitted. Actual trip updates determine stop counts for both buses and trolleys, so short turns and skipped stops are respected. Switching direction or returning to the route list aborts outstanding requests and removes polling timers. Location denial, timeout, unsupported browsers and locations outside the service area have retry/help states.

Location requires a secure browser context (HTTPS on the hosted site, or localhost for development). Coordinates remain in page memory and are never sent to SEPTA, persisted, or logged. The page requests location only on a button press; use **Update my location** after moving. Live route and trip requests contain route, stop or trip IDs only.

### Maintaining the bundled directory

`data/stop-directory.js` contains stop coordinates and route memberships for 161 bus/trolley routes. It is loaded only on the nearby page (about 1 MB uncompressed). It was generated on October 28, 2026 from [SEPTA’s public data](https://www3.septa.org/developer/gtfs_public.zip) and v2 stop responses. Current and upcoming v2 releases are retained; the browser chooses the latest effective release independently per route. Destination names come from the published GTFS `directions.txt`. The currently published GTFS metadata is `v202611010`; current stop memberships come from the v2 release effective today, rather than prematurely using November’s stops. Temporary FOX_BUS and WTR_BUS routes have no v2 stops and are omitted. A listed route does not guarantee service at the current time.

Refresh the directory when SEPTA changes schedules or stops:

```sh
python3 scripts/build-stop-directory.py
```

This optional maintenance script uses only Python’s standard library and fetches official public data with at most four requests in flight. It requires no packages, API key, backend or browser-location upload. You may supply an already downloaded public archive with `--gtfs /path/to/gtfs_public.zip`. Regenerate and publish the resulting file with the site; the directory cannot discover later stop changes until it is refreshed. The older geographic lookup API does not allow browser CORS requests, so it is not used at runtime.

## Open or host

**Open `index.html` in a modern browser.** No Node.js, npm install, build step, application server, API key, or proxy is required. The HTML loads ordinary JavaScript files and is designed to work from disk in a standard desktop browser. Some in-app browsers block local file URLs; use a static website URL in those browsers. An internet connection is required for live SEPTA data. Direct browser fetching was verified over static HTTP hosting; the in-app browser does not permit testing file URLs.

For a website URL, upload these files, keeping their paths, to any static website host:

```text
.nojekyll
index.html
t2.html
center-city.html
nearby.html
data/
  stop-directory.js
favicon.svg
apple-touch-icon.png
styles.css
src/
  directions.js
  tracking.js
  data.js
  app.js
  navigation.js
  transit-page.js
  nearby.js
  nearby-page.js
```

The app uses relative asset paths, so it works at a domain root or in a subdirectory such as a GitHub Pages project site. No routing or server-side endpoints are involved.

## GitHub Pages publishing (when ready)

The repository root is the publishing folder. `.nojekyll` tells GitHub Pages to serve the static files without Jekyll processing. No `docs/` copy, `dist/` output, npm build, or custom GitHub Actions workflow is needed.

After local verification and when you are ready to publish:

1. Push the approved branch to your GitHub repository.
2. Open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Select the branch containing these files and **/(root)** as the folder.
5. Save. GitHub provides the website URL on that page.

The local project has not configured GitHub Pages or triggered a deployment. The publishing branch and remote can be selected when you are ready.

See [GitHub’s publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

For an optional local HTTP preview, use any static file server. For example, if Python is already installed:

```sh
python3 -m http.server 3000 --bind 127.0.0.1
```

Then open http://localhost:3000. This server only serves files; all data requests and calculations still run in the browser.

## Direction selection

The compact slider moves the bus logo between **west - heading home** on the left and **east - going to school** on the right. Drag the bus, use the arrow keys, or tap a direction label.

Philadelphia time (`America/New_York`) chooses eastbound before noon and westbound from noon onward, including when you return to an open tab. A manual choice overrides the clock for the current page visit. Select **Use time of day** inside **How this works**, or reload to restore the automatic default. Direction changes cancel the earlier refresh and discard late results.

## Browser data flow

The browser fetches the route feeds directly from SEPTA (Route 42 examples):

- Live vehicles: https://www3.septa.org/api/v2/trips/?route_id=42
- Ordered stops: https://www3.septa.org/api/v2/stops/?route_id=42

Trolley pages also request `/api/v2/trip-update/?trip_id=…` for exact trip stop patterns and departure predictions, and `/api/v2/stop-schedule/?route_id=…&stop_id=…` for validated timetable fallback. The route parameter is T2, T3, or 21 on those pages.

The v2 endpoints returned `Access-Control-Allow-Origin: *` when verified on October 27, 2026. Requests omit cookies and authentication. The older TransitView endpoint does not provide that CORS header, so this version uses the v2 trip feed. The site depends on SEPTA continuing to allow cross-origin browser requests; failures show a visible message and retry automatically. There is no backend fallback or third-party proxy.

The browser selects the current schedule release and direction, sorts the stop list, and calculates stops remaining. Stop metadata is cached separately per route in memory for an hour and refreshed when the Philadelphia date changes. Every refresh fetches a new live vehicle feed. The fixed-stop pages do not request location. The nearby page requests it on demand for local distance calculations; no coordinates or analytics are collected.

## Counting and freshness

SEPTA’s `next_stop_id` is the reported next stop, not confirmation that the bus has reached or left it. If that stop is immediately before your boarding stop, the app shows **1 stop from yours**. If it is your boarding stop, it shows **Your stop is next**.

The route-wide eastbound list combines the Wycombe and 61st & Pine branches. Wycombe buses skip the Pine loop stops (437 and 26108); the two branches are counted separately. Both eastbound branch prefixes and the westbound order through stop 22151 were checked against SEPTA’s GTFS on October 27, 2026. Changes to branch routing may require updating `src/tracking.js`.

Buses beyond the target and GPS reports older than two minutes are excluded. Physical buses are deduplicated. A future assignment is excluded while that vehicle is still traveling in the opposite direction. Unknown stops are omitted with a notice. Buses are ranked by stops remaining, breaking ties using GPS proximity to the reported next stop. This is route progress; traffic, detours, and overtaking can change arrival order.

On a failed refresh, earlier reports remain visible only while still fresh. No buses in view does not mean service has stopped. The home stretch shows every stop from the closest fresh bus’s reported next stop through the selected boarding stop, using that bus’s branch-specific route. Full stop names run vertically; long routes scroll horizontally. It shows a waiting message when no fresh bus is available. The diagram is a schematic, not a map or an exact GPS position. See the SEPTA alerts link for service changes.

## Files and optional tests

- `index.html`: the complete static page structure.
- `styles.css`: responsive layout and slider styling.
- `src/directions.js`: stop configuration and Philadelphia-time defaults.
- `src/tracking.js`: validation, branch-aware counting, sorting and freshness.
- `src/data.js`: direct browser requests, timeouts supplied by the app, and stop caching.
- `src/app.js`: Route 42 rendering, direction controls, cancellation and refresh behavior.
- `src/navigation.js`: hamburger-menu dismissal with Escape or an outside click.
- `src/transit-page.js`: reusable departure panels with request cancellation and polling cleanup.
- `nearby.html`, `src/nearby.js`, `src/nearby-page.js`: nearby route discovery, destination selection and location handling.
- `data/stop-directory.js`, `scripts/build-stop-directory.py`: bundled public stop directory and dependency-free refresh script.
- `test/`: automated checks for counting, direct requests, caching, failures, direction changes and time boundaries.

Developers with Node.js 22 or later can optionally run `npm test` (or `node --test`). Node is only a test runner; the website does not use it. There are no npm dependencies.

The app is independent of SEPTA.
