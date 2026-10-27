(() => {
'use strict';
const { DIRECTIONS, STOPS_URL, VEHICLES_URL, serviceDate, orderedStops, trackBuses } = globalThis.MagnusBus;

// Each page fetches SEPTA directly. Only the ordered stop metadata is cached;
// every refresh requests a new live vehicle feed.
function createDataClient({ fetchImpl = globalThis.fetch.bind(globalThis), now = Date.now } = {}) {
  let stopCache;
  async function getJSON(url, signal) {
    const response = await fetchImpl(url, {
      mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: { accept: 'application/json' }, signal
    });
    if (!response.ok) throw new Error('SEPTA unavailable');
    return response.json();
  }
  async function getTracking(direction, { signal } = {}) {
    if (!Object.hasOwn(DIRECTIONS, direction)) throw new Error('Invalid direction');
    const at = now();
    const cached = stopCache && at - stopCache.at < 3600000 && stopCache.date === serviceDate(at);
    const [feed, stops] = await Promise.all([
      getJSON(VEHICLES_URL, signal),
      cached ? stopCache.data : getJSON(STOPS_URL, signal)
    ]);
    if (signal?.aborted) throw signal.reason;
    // Validate before caching so a malformed response never poisons later refreshes.
    orderedStops(stops, now(), direction);
    const result = trackBuses(feed, stops, now(), direction);
    if (!cached) stopCache = { at: now(), date: serviceDate(now()), data: stops };
    return result;
  }
  return { getTracking };
}
Object.assign(globalThis.MagnusBus, { createDataClient });
})();
