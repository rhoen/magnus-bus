import { trackBuses, STOPS_URL, VEHICLES_URL } from './tracking.js';
import { page } from './page.js';
let stopCache, feedCache, inFlight;
async function getJSON(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('SEPTA unavailable');
  return response.json();
}
export async function getTracking() {
  if (feedCache && Date.now() - feedCache.fetchedAt < 10000) return feedCache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [feed, stops] = await Promise.all([
      getJSON(VEHICLES_URL),
      stopCache && Date.now() - stopCache.at < 3600000 ? stopCache.data : getJSON(STOPS_URL).then(data => { stopCache = { at: Date.now(), data }; return data; })
    ]);
    const result = trackBuses(feed, stops);
    feedCache = result;
    return result;
  })();
  try { return await inFlight; } finally { inFlight = null; }
}
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
    if (path === '/api/buses') {
      try { return Response.json(await getTracking(), { headers }); }
      catch { return Response.json({ error: 'SEPTA data is temporarily unavailable. Please try again.' }, { status: 503, headers }); }
    }
    if (path === '/') return new Response(request.method === 'HEAD' ? null : page, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'" } });
    return new Response('Not found', { status: 404, headers });
  }
};
