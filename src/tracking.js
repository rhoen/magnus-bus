(() => {
'use strict';
const { TRACKERS } = globalThis.MagnusBus;
const MAX_AGE = 120;
const STOPS_URL = 'https://www3.septa.org/api/v2/stops/?route_id=42';
const VEHICLES_URL = 'https://www3.septa.org/api/v2/trips/?route_id=42';

function serviceDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replaceAll('-', '');
}

function trackerConfig(direction) {
  const config = typeof direction === 'string' ? TRACKERS[direction] : direction;
  if (!config || !config.route || !['0','1'].includes(config.gtfs) || !config.target) throw new Error('Invalid direction');
  return config;
}

function orderedStops(rows, now, direction = 'east') {
  const config = trackerConfig(direction);
  if (!Array.isArray(rows)) throw new Error('Invalid stop response');
  const eligible = rows.filter(s => String(s.route_id) === config.route && String(s.direction_id) === config.gtfs && /^\d{8}$/.test(s.release_name) && s.release_name <= serviceDate(now));
  const release = eligible.map(s => s.release_name).sort().at(-1);
  if (!release) throw new Error('No current stop order');
  const seen = new Set();
  const stops = eligible.filter(s => s.release_name === release).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)).filter(s => {
    if (seen.has(String(s.stop_id))) return false;
    seen.add(String(s.stop_id)); return true;
  });
  if (!stops.some(s => String(s.stop_id) === config.target) || (config.route === '42' && direction === 'east' && !stops.some(s => String(s.stop_id) === '670'))) throw new Error('Stop missing from route');
  return { stops, release };
}

function trackBuses(feed, rows, now = Date.now(), direction = 'east', tripUpdates = {}) {
  if (!Array.isArray(feed)) throw new Error('Invalid vehicle response');
  const { stops, release } = orderedStops(rows, now, direction);
  const config = trackerConfig(direction);
  // SEPTA's route-wide list combines two branches. Wycombe buses do NOT
  // visit the 61st & Pine loop; counting the combined list adds two false stops.
  const longPattern = stops.filter(s => !['437', '26108'].includes(String(s.stop_id)));
  const commonStart = stops.findIndex(s => String(s.stop_id) === '670');
  const shortPattern = [...stops.filter(s => ['437', '26108'].includes(String(s.stop_id))), ...stops.slice(commonStart)];
  let stale = 0, unknown = 0;
  const fresh = feed.filter(b => {
    const stamp = Number(b.timestamp);
    const valid = Number.isFinite(stamp) && stamp > 0 && now / 1000 - stamp <= MAX_AGE && stamp <= now / 1000 + 30;
    if (!valid && b.direction_name === config.name && String(b.route_id) === config.route) stale++;
    return valid && String(b.route_id) === config.route;
  });
  const candidates = [];
  for (const bus of fresh) {
    if (bus.direction_id != null ? String(bus.direction_id) !== config.gtfs : bus.direction_name !== config.name) continue;
    if (['CANCELED','CANCELLED','NO GPS'].includes(bus.status)) continue;
    const vehicleId = String(bus.vehicle_id || '');
    if (!vehicleId || ['None','null','0'].includes(vehicleId)) { unknown++; continue; }
    // Exclude a future assignment while the bus still has an active trip
    // in the opposite direction.
    if (Number(bus.next_stop_sequence) === 1 && fresh.some(b => b.direction_name !== config.name && String(b.vehicle_id) === vehicleId)) continue;
    const stopId = String(bus.next_stop_id);
    let pattern = config.route !== '42' || config.gtfs === '1' ? stops : ['437', '26108'].includes(stopId) ? shortPattern : longPattern;
    if (config.kind === 'trolley' || config.exactTrips) {
      const update = tripUpdates[String(bus.trip_id)];
      if (!validTripUpdate(update, bus, config) || update.trip.transit_date !== bus.transit_date) { unknown++; continue; }
      pattern = update.stop_times.filter(s => !s.is_skipped).sort((a,b) => Number(a.stop_sequence)-Number(b.stop_sequence)).map(s => ({
        ...stops.find(row => String(row.stop_id) === String(s.stop_id)), ...s, stop_id:String(s.stop_id)
      }));
      if (config.requiredStop && !pattern.some(s => s.stop_id === config.requiredStop)) continue;
    }
    const exact = config.kind === 'trolley' || config.exactTrips;
    // Loops can visit the same stop twice. Use the reported sequence when
    // available, then choose the next occurrence of the boarding stop.
    let index = exact ? pattern.findIndex(s => String(s.stop_id) === stopId && Number(s.stop_sequence) === Number(bus.next_stop_sequence)) : -1;
    if (index < 0 && (!exact || pattern.filter(s => String(s.stop_id) === stopId).length === 1)) index = pattern.findIndex(s => String(s.stop_id) === stopId);
    const targetIndex = pattern.findIndex((s,i) => String(s.stop_id) === config.target && (!exact || (i >= index && !s.departed)));
    if (index < 0) { unknown++; continue; }
    if (targetIndex < 0 || index > targetIndex) continue;
    const stop = pattern[index];
    const lat = Number(bus.lat), lng = Number(bus.lon);
    const proximity = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(Number(stop.stop_lat)) && Number.isFinite(Number(stop.stop_lon)) ? Math.hypot(lat - Number(stop.stop_lat), (lng - Number(stop.stop_lon)) * 0.77) : Infinity;
    candidates.push({ vehicleId, tripId: String(bus.trip_id || ''), nextStopId: stopId, nextStopName: stop.stop_name,
      stopsAway: targetIndex - index, reportedAt: Number(bus.timestamp) * 1000, proximity,
      route: pattern.slice(index, targetIndex + 1).map(s => ({ id: String(s.stop_id), name: s.stop_name })) });
  }
  // Choose the newest record for a physical bus before ranking by progress.
  const unique = new Map();
  for (const bus of candidates.sort((a,b) => b.reportedAt - a.reportedAt)) if (!unique.has(bus.vehicleId)) unique.set(bus.vehicleId, bus);
  const buses = [...unique.values()].sort((a,b) => a.stopsAway - b.stopsAway || a.proximity - b.proximity || b.reportedAt - a.reportedAt).slice(0,2);
  return { buses, departures: getDepartures(feed, tripUpdates, config, now), fetchedAt: now, stale, unknown, release, stopId: config.target, direction };
}

function validTripUpdate(update, vehicle, config) {
  return update?.trip && Array.isArray(update.stop_times)
    && String(update.trip.trip_id) === String(vehicle.trip_id)
    && String(update.trip.route_id) === config.route
    && String(update.trip.direction_id) === config.gtfs
    && !['CANCELED','CANCELLED'].includes(update.trip.status);
}
function getDepartures(feed, updates, config, now) {
  if (config.kind !== 'trolley') return [];
  const result = [], seen = new Set();
  for (const vehicle of feed) {
    const update = updates[String(vehicle.trip_id)];
    if (!validTripUpdate(update, vehicle, config) || ['CANCELED','CANCELLED'].includes(vehicle.status)) continue;
    if (vehicle.transit_date !== update.trip.transit_date) continue;
    if (config.requiredStop && !update.stop_times.some(s => String(s.stop_id) === config.requiredStop && !s.is_skipped)) continue;
    const stop = update.stop_times.find(s => String(s.stop_id) === config.target);
    const at = Number(stop?.eta) * 1000;
    if (!stop || stop.is_skipped || stop.departed || !Number.isFinite(at) || at < now || at > now + 10800000 || seen.has(String(vehicle.trip_id))) continue;
    seen.add(String(vehicle.trip_id));
    result.push({ tripId:String(vehicle.trip_id), departureAt:at,
      realtime:update.trip['real-time'] === true, destination:update.trip.trip_headsign || vehicle.trip_headsign || config.destination });
  }
  return result.sort((a,b) => a.departureAt-b.departureAt).slice(0,2);
}

// The stop-schedule endpoint mixes service calendars. Only use a calendar and
// release demonstrated by a current trip update for this route and direction.
function scheduledDepartures(rows, feed, updates, config, now) {
  if (!Array.isArray(rows)) throw new Error('Invalid schedule response');
  const services = new Map();
  const canceled = new Set(feed.filter(v => ['CANCELED','CANCELLED'].includes(v.status)).map(v => String(v.trip_id)));
  const today = serviceDate(now);
  for (const vehicle of feed) {
    const update = updates[String(vehicle.trip_id)];
    if (!validTripUpdate(update,vehicle,config) || vehicle.transit_date !== update.trip.transit_date) continue;
    if (update.trip.transit_date.replaceAll('-','') !== today) continue;
    const trip = update.trip;
    services.set(String(trip.release_name) + ':' + String(trip.service_id), trip.transit_date);
  }
  const result = [];
  for (const row of rows) {
    const date = services.get(String(row.release_name) + ':' + String(row.service_id));
    if (!date || String(row.route_id) !== config.route || String(row.direction_id) !== config.gtfs || String(row.stop_id) !== config.target || canceled.has(String(row.trip_id))) continue;
    if (config.requiredStop && !/13th|15th|City Hall/i.test(row.trip_headsign || '')) continue;
    const at = scheduleTimestamp(date,row.arrival_time);
    if (!Number.isFinite(at) || at < now || at > now + 10800000) continue;
    result.push({tripId:String(row.trip_id),departureAt:at,realtime:false,destination:row.trip_headsign || config.destination});
  }
  return [...new Map(result.sort((a,b)=>a.departureAt-b.departureAt).map(r=>[r.tripId,r])).values()].slice(0,2);
}
function scheduleTimestamp(date,time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}:\d{2}$/.test(time)) return NaN;
  const [year,month,day]=date.split('-').map(Number), [hour,minute,second]=time.split(':').map(Number);
  if (hour>47 || minute>59 || second>59) return NaN;
  const wall=Date.UTC(year,month-1,day,hour,minute,second);
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let value=wall;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(formatter.formatToParts(value).map(p=>[p.type,p.value]));
    const shown=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    const delta=wall-shown;if(!delta)return value;value+=delta;
  }
  return NaN;
}

Object.assign(globalThis.MagnusBus ??= {}, { trackerConfig, MAX_AGE, STOPS_URL, VEHICLES_URL, serviceDate, orderedStops, trackBuses, validTripUpdate, scheduledDepartures, scheduleTimestamp });
})();
