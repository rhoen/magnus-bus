import { DIRECTIONS } from './directions.js';
export const MAX_AGE = 120;
export const STOPS_URL = 'https://www3.septa.org/api/v2/stops/?route_id=42';
export const VEHICLES_URL = 'https://www3.septa.org/api/TransitView/index.php?route=42';

export function serviceDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replaceAll('-', '');
}

export function orderedStops(rows, now, direction = 'east') {
  if (!Object.hasOwn(DIRECTIONS, direction)) throw new Error('Invalid direction');
  const config = DIRECTIONS[direction];
  if (!Array.isArray(rows)) throw new Error('Invalid stop response');
  const eligible = rows.filter(s => String(s.route_id) === '42' && String(s.direction_id) === config.gtfs && /^\d{8}$/.test(s.release_name) && s.release_name <= serviceDate(now));
  const release = eligible.map(s => s.release_name).sort().at(-1);
  if (!release) throw new Error('No current stop order');
  const seen = new Set();
  const stops = eligible.filter(s => s.release_name === release).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)).filter(s => {
    if (seen.has(String(s.stop_id))) return false;
    seen.add(String(s.stop_id)); return true;
  });
  if (!stops.some(s => String(s.stop_id) === config.target) || (direction === 'east' && !stops.some(s => String(s.stop_id) === '670'))) throw new Error('Stop missing from route');
  return { stops, release };
}

export function trackBuses(feed, rows, now = Date.now(), direction = 'east') {
  if (!feed || !Array.isArray(feed.bus)) throw new Error('Invalid vehicle response');
  const { stops, release } = orderedStops(rows, now, direction);
  const config = DIRECTIONS[direction];
  // SEPTA's route-wide list combines two branches. Wycombe buses do NOT
  // visit the 61st & Pine loop; counting the combined list adds two false stops.
  const longPattern = stops.filter(s => !['437', '26108'].includes(String(s.stop_id)));
  const commonStart = stops.findIndex(s => String(s.stop_id) === '670');
  const shortPattern = [...stops.filter(s => ['437', '26108'].includes(String(s.stop_id))), ...stops.slice(commonStart)];
  let stale = 0, unknown = 0;
  const fresh = feed.bus.filter(b => {
    const stamp = Number(b.timestamp);
    const valid = Number.isFinite(stamp) && stamp > 0 && now / 1000 - stamp <= MAX_AGE && stamp <= now / 1000 + 30;
    if (!valid && b.Direction === config.name && String(b.route_id) === '42') stale++;
    return valid && String(b.route_id) === '42';
  });
  const candidates = [];
  for (const bus of fresh) {
    if (bus.Direction !== config.name) continue;
    const vehicleId = String(bus.VehicleID || bus.label || '');
    if (!vehicleId) { unknown++; continue; }
    // Exclude a future assignment while the bus still has an active trip
    // in the opposite direction.
    if (Number(bus.next_stop_sequence) === 1 && fresh.some(b => b.Direction === (direction === 'east' ? 'Westbound' : 'Eastbound') && String(b.VehicleID || b.label) === vehicleId)) continue;
    const stopId = String(bus.next_stop_id);
    const pattern = direction === 'west' ? stops : ['437', '26108'].includes(stopId) ? shortPattern : longPattern;
    const index = pattern.findIndex(s => String(s.stop_id) === stopId);
    const targetIndex = pattern.findIndex(s => String(s.stop_id) === config.target);
    if (index < 0) { unknown++; continue; }
    if (index > targetIndex) continue;
    const stop = pattern[index];
    const lat = Number(bus.lat), lng = Number(bus.lng);
    const proximity = Number.isFinite(lat) && Number.isFinite(lng) ? Math.hypot(lat - Number(stop.stop_lat), (lng - Number(stop.stop_lon)) * 0.77) : Infinity;
    candidates.push({ vehicleId, tripId: String(bus.trip || ''), nextStopId: stopId, nextStopName: stop.stop_name,
      stopsAway: targetIndex - index, reportedAt: Number(bus.timestamp) * 1000, proximity,
      route: pattern.slice(index, targetIndex + 1).map(s => ({ id: String(s.stop_id), name: s.stop_name })) });
  }
  // Choose the newest record for a physical bus before ranking by progress.
  const unique = new Map();
  for (const bus of candidates.sort((a,b) => b.reportedAt - a.reportedAt)) if (!unique.has(bus.vehicleId)) unique.set(bus.vehicleId, bus);
  const buses = [...unique.values()].sort((a,b) => a.stopsAway - b.stopsAway || a.proximity - b.proximity || b.reportedAt - a.reportedAt).slice(0,2);
  return { buses, fetchedAt: now, stale, unknown, release, stopId: config.target, direction };
}
