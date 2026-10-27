# Magnus’s Bus

A browser-only static website for **SEPTA Route 42 to school and back home**: eastbound at Spruce & 49th (stop 22120), and westbound at Spruce & 42nd (stop 22151). Shows the two closest approaching buses, their reported next stops, and how many stops those are from yours. Refreshes every 15 seconds while visible.

## Open or host

**Open `index.html` in a modern browser.** No Node.js, npm install, build step, application server, API key, or proxy is required. The HTML loads ordinary JavaScript files and is designed to work from disk in a standard desktop browser. Some in-app browsers block local file URLs; use a static website URL in those browsers. An internet connection is required for live SEPTA data. Direct browser fetching was verified over static HTTP hosting; the in-app browser does not permit testing file URLs.

For a website URL, upload these files, keeping their paths, to any static website host:

```text
index.html
styles.css
src/
  directions.js
  tracking.js
  data.js
  app.js
```

The app uses relative asset paths, so it works at a domain root or in a subdirectory such as a GitHub Pages project site. No routing or server-side endpoints are involved. `.openai/hosting.json` configures the existing private Sites publication. Sites requires the same static files to be copied into `dist/` for upload; this is deployment packaging only, with no compilation or JavaScript runtime on the server.

For an optional local HTTP preview, use any static file server. For example, if Python is already installed:

```sh
python3 -m http.server 3000 --bind 127.0.0.1
```

Then open http://localhost:3000. This server only serves files; all data requests and calculations still run in the browser.

## Direction selection

The compact slider moves the bus logo between **west - heading home** on the left and **east - going to school** on the right. Drag the bus, use the arrow keys, or tap a direction label.

Philadelphia time (`America/New_York`) chooses eastbound before noon and westbound from noon onward, including when you return to an open tab. A manual choice overrides the clock for the current page visit. Select **Use time of day** inside **How this works**, or reload to restore the automatic default. Direction changes cancel the earlier refresh and discard late results.

## Browser data flow

The browser fetches both feeds directly from SEPTA:

- Live vehicles: https://www3.septa.org/api/v2/trips/?route_id=42
- Ordered stops: https://www3.septa.org/api/v2/stops/?route_id=42

Both endpoints returned `Access-Control-Allow-Origin: *` when verified on October 27, 2026. Requests omit cookies and authentication. The older TransitView endpoint does not provide that CORS header, so this version uses the v2 trip feed. The site depends on SEPTA continuing to allow cross-origin browser requests; failures show a visible message and retry automatically. There is no backend fallback or third-party proxy.

The browser selects the current schedule release and direction, sorts the stop list, and calculates stops remaining. Stop metadata is cached in memory for an hour and refreshed when the Philadelphia date changes. Every refresh fetches a new live vehicle feed. No personal data, location permission, or analytics are collected.

## Counting and freshness

SEPTA’s `next_stop_id` is the reported next stop, not confirmation that the bus has reached or left it. If that stop is immediately before your boarding stop, the app shows **1 stop from yours**. If it is your boarding stop, it shows **Your stop is next**.

The route-wide eastbound list combines the Wycombe and 61st & Pine branches. Wycombe buses skip the Pine loop stops (437 and 26108); the two branches are counted separately. Both eastbound branch prefixes and the westbound order through stop 22151 were checked against SEPTA’s GTFS on October 27, 2026. Changes to branch routing may require updating `src/tracking.js`.

Buses beyond the target and GPS reports older than two minutes are excluded. Physical buses are deduplicated. A future assignment is excluded while that vehicle is still traveling in the opposite direction. Unknown stops are omitted with a notice. Buses are ranked by stops remaining, breaking ties using GPS proximity to the reported next stop. This is route progress; traffic, detours, and overtaking can change arrival order.

On a failed refresh, earlier reports remain visible only while still fresh. No buses in view does not mean service has stopped. The route strip is a schematic of the final Spruce Street stops, not a map. See the SEPTA alerts link for service changes.

## Files and optional tests

- `index.html`: the complete static page structure.
- `styles.css`: responsive layout and slider styling.
- `src/directions.js`: stop configuration and Philadelphia-time defaults.
- `src/tracking.js`: validation, branch-aware counting, sorting and freshness.
- `src/data.js`: direct browser requests, timeouts supplied by the app, and stop caching.
- `src/app.js`: rendering, direction controls, cancellation and refresh behavior.
- `test/`: automated checks for counting, direct requests, caching, failures, direction changes and time boundaries.

Developers with Node.js 22 or later can optionally run `npm test` (or `node --test`). Node is only a test runner; the website does not use it. There are no npm dependencies.

The app is independent of SEPTA. The existing Sites publication remains private to its owner.
