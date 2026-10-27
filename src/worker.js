import { DIRECTIONS } from './directions.js';
import { trackBuses, STOPS_URL, VEHICLES_URL } from './tracking.js';
import { page } from './page.js';
let stopCache;
const feedCache = new Map(), inFlight = new Map();
async function getJSON(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('SEPTA unavailable');
  return response.json();
}
export async function getTracking(direction = 'east') {
  const cached = feedCache.get(direction);
  if (cached && Date.now() - cached.fetchedAt < 10000) return cached;
  if (inFlight.has(direction)) return inFlight.get(direction);
  const pending = (async () => {
    const [feed, stops] = await Promise.all([
      getJSON(VEHICLES_URL),
      stopCache && Date.now() - stopCache.at < 3600000 ? stopCache.data : getJSON(STOPS_URL).then(data => { stopCache = { at: Date.now(), data }; return data; })
    ]);
    const result = trackBuses(feed, stops, Date.now(), direction);
    feedCache.set(direction, result);
    return result;
  })();
  inFlight.set(direction, pending);
  try { return await pending; } finally { inFlight.delete(direction); }
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
    if (path === '/api/buses') {
      const direction = url.searchParams.get('direction') || 'east';
      if (!Object.hasOwn(DIRECTIONS, direction)) return Response.json({ error: 'Choose east or west.' }, { status: 400, headers });
      try { return Response.json(await getTracking(direction), { headers }); }
      catch { return Response.json({ error: 'SEPTA data is temporarily unavailable. Please try again.' }, { status: 503, headers }); }
    }
    if (path === '/') return new Response(request.method === 'HEAD' ? null : page, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'" } });
    return new Response('Not found', { status: 404, headers });
  }
};
