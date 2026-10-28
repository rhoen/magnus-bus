(() => {
'use strict';
const { trackerConfig, serviceDate, orderedStops, trackBuses, scheduledDepartures } = globalThis.MagnusBus;
const api = 'https://www3.septa.org/api/v2/';
function createDataClient({ fetchImpl = globalThis.fetch.bind(globalThis), now = Date.now } = {}) {
  const stopCache = new Map(), scheduleCache = new Map();
  async function getJSON(url, signal) {
    const response = await fetchImpl(url, {
      mode:'cors', credentials:'omit', cache:'no-store',
      headers:{accept:'application/json'}, signal
    });
    if (!response.ok) throw new Error('SEPTA unavailable');
    return response.json();
  }
  async function getTracking(direction, { signal } = {}) {
    const config = trackerConfig(direction), at = now();
    const cache = stopCache.get(config.route);
    const cached = cache && at-cache.at < 3600000 && cache.date === serviceDate(at);
    const [feed, stops] = await Promise.all([
      getJSON(api+'trips/?route_id='+encodeURIComponent(config.route),signal),
      cached ? cache.data : getJSON(api+'stops/?route_id='+encodeURIComponent(config.route),signal)
    ]);
    if (signal?.aborted) throw signal.reason;
    if (!Array.isArray(feed)) throw new Error('Invalid vehicle response');
    orderedStops(stops,now(),direction);
    if (!cached) stopCache.set(config.route,{at:now(),date:serviceDate(now()),data:stops});
    const updates = {};
    let updatesFailed = 0;
    if (config.kind === 'trolley' || config.exactTrips) {
      const trips = [...new Map(feed.filter(v => String(v.route_id) === config.route && String(v.direction_id) === config.gtfs
        && (config.kind === 'trolley' || (Number(v.timestamp) > now()/1000-120 && v.vehicle_id && !['None','0','null'].includes(String(v.vehicle_id))))
        && !['CANCELED','CANCELLED'].includes(v.status) && /^\d{4}-\d{2}-\d{2}$/.test(v.transit_date)).map(v => [String(v.trip_id),v])).values()];
      // Bound trip-detail requests even on busy routes.
      let next = 0;
      await Promise.all(Array.from({length:Math.min(4,trips.length)}, async () => {
        while (next < trips.length) {
          const vehicle = trips[next++];
          try { updates[String(vehicle.trip_id)] = await getJSON(api+'trip-update/?trip_id='+encodeURIComponent(vehicle.trip_id),signal); }
          catch (error) { if (signal?.aborted) throw error; updatesFailed++; }
        }
      }));
    }
    if (signal?.aborted) throw signal.reason;
    const result = trackBuses(feed,stops,now(),direction,updates);
    if (config.kind === 'trolley' && !result.buses.length && result.departures.length < 2) {
      try {
        const key=config.route+':'+config.target, cachedSchedule=scheduleCache.get(key);
        const rows=cachedSchedule && now()-cachedSchedule.at<60000 ? cachedSchedule.data : await getJSON(api+'stop-schedule/?route_id='+encodeURIComponent(config.route)+'&stop_id='+encodeURIComponent(config.target),signal);
        const scheduled=scheduledDepartures(rows,feed,updates,config,now());
        scheduleCache.set(key,{at:cachedSchedule && now()-cachedSchedule.at<60000?cachedSchedule.at:now(),data:rows});
        const combined=new Map(scheduled.map(d=>[d.tripId,d]));
        for(const departure of result.departures)combined.set(departure.tripId,departure);
        result.departures=[...combined.values()].sort((a,b)=>a.departureAt-b.departureAt).slice(0,2);
      } catch(error) { if(signal?.aborted)throw error;updatesFailed++; }
    }
    return {...result,updatesFailed};
  }
  return { getTracking };
}
Object.assign(globalThis.MagnusBus,{ createDataClient });
})();
