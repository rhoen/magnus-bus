(() => {
'use strict';
const $ = id => document.getElementById(id);
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = value => new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(value);
const { DIRECTIONS: directions, defaultDirection, createDataClient } = globalThis.MagnusBus;
const client = createDataClient();
let direction = defaultDirection(), manualDirection = false;
let data = null, loading = false, failed = false, requestId = 0, controller;
let routeKey = null;
function drawDirection() {
  const config = directions[direction];
  $('direction-slider').value = direction === 'east' ? '1' : '0';
  $('direction-slider').setAttribute('aria-valuetext', direction === 'east' ? 'east - going to school' : 'west - heading home');
  $('bus-thumb').classList.toggle('west', direction === 'west');
  $('direction-west').setAttribute('aria-pressed', String(direction === 'west'));
  $('direction-east').setAttribute('aria-pressed', String(direction === 'east'));
  $('stop-title').textContent = config.stopName;
  $('stop-sub').textContent = 'Your stop · #' + config.target + ' · ' + config.destination;
  $('direction-badge').textContent = config.arrow + ' ' + config.name;
  $('auto-direction').classList.toggle('hidden', !manualDirection);
  drawRoute((data?.buses || []).filter(b => Date.now()-b.reportedAt <= 120000));
}
function selectDirection(next) {
  if (next === direction) { drawDirection(); return; }
  direction = next;
  controller?.abort(); requestId++; loading = false; data = null; failed = false;
  $('status').classList.remove('live'); $('status-text').textContent = 'Checking ' + directions[direction].name.toLowerCase() + ' buses';
  $('warning').classList.add('hidden'); $('updated').textContent = 'Refreshes every 15 seconds while open';
  drawDirection(); render(); refresh();
}
function drawRoute(buses = []) {
  const config = directions[direction];
  const bus = buses[0];
  const stops = bus?.route || [];
  const key = JSON.stringify([direction, bus?.vehicleId, stops]);
  if (key === routeKey) return;
  routeKey = key;
  $('route-caption').textContent = bus
    ? 'Bus ' + bus.vehicleId + ' · ' + config.name
    : config.name;
  $('route-hint').classList.toggle('hidden', stops.length <= 6);
  $('route-line').setAttribute('aria-label', bus
    ? 'Stops from bus ' + bus.vehicleId + '’s reported next stop to ' + config.stopName
    : 'Waiting for the closest bus to ' + config.stopName);
  if (!stops.length) {
    $('route-line').innerHTML = '<li class="route-empty">The stops to yours will appear when a fresh bus location is available.</li>';
    return;
  }
  $('route-line').innerHTML = stops.map((stop, index) => {
    const home = stop.id === config.target;
    const first = index === 0;
    const tag = home && first ? 'BUS NEXT STOP<br>YOUR STOP' : home ? 'YOUR STOP' : first ? 'BUS NEXT STOP' : '&nbsp;';
    return '<li class="station ' + (home ? 'home ' : '') + (first ? 'active' : '') + '"><span class="station-tag">' + tag + '</span><span class="station-name">' + escapeHTML(stop.name) + '</span></li>';
  }).join('');
}

function card(bus, index, error) {
  const title = index ? 'Following bus' : 'Closest bus';
  const cls = index ? 'secondary' : 'primary';
  if (!bus) return '<article class="card '+cls+'"><div class="card-title">'+(index?'':'↗ &nbsp; ')+title+'</div><h2 class="empty-title">'+(error?'Can’t reach SEPTA':index?'No second bus in view':'No approaching bus in view')+'</h2><p class="empty-text">'+(error?'We’ll keep trying. Refresh to check again.':index?'The next one will appear here when SEPTA reports it.':'No fresh '+directions[direction].name.toLowerCase()+' bus is currently reported before your stop. Check again shortly.')+'</p></article>';
  const atStop = bus.stopsAway === 0;
  return '<article class="card '+cls+(atStop?' at-stop':'')+'"><div class="card-top"><div class="card-title">'+(index?'':'↗ &nbsp; ')+title+'</div><span class="bus-id">BUS '+escapeHTML(bus.vehicleId)+'</span></div><div class="distance"><span class="number">'+(atStop?'You’re next':bus.stopsAway)+'</span><div class="unit">'+(atStop?'Your stop is next':(bus.stopsAway===1?'stop':'stops')+'<small>from yours</small>')+'</div></div><div class="next-stop"><p class="next-label">Approaching</p><p class="next-name">'+escapeHTML(bus.nextStopName)+'</p><p class="seen">GPS reported '+time(bus.reportedAt)+' · '+Math.max(0,Math.floor((Date.now()-bus.reportedAt)/1000))+'s ago</p></div></article>';
}
function render() {
  if (!data && !failed) {
    $('cards').setAttribute('aria-busy','true');
    $('cards').innerHTML = '<article class="card primary"><div class="card-title">Closest bus</div><h2 class="empty-title">Finding your bus…</h2><p class="empty-text">Checking '+directions[direction].name.toLowerCase()+' Route 42.</p></article><article class="card secondary"><div class="card-title">Following bus</div><h2 class="empty-title">One moment…</h2><p class="empty-text">Looking a little farther down the route.</p></article>';
    return;
  }
  const buses = (data?.buses || []).filter(b => Date.now()-b.reportedAt <= 120000);
  const expired = Boolean(data?.buses?.length && buses.length < data.buses.length);
  $('cards').innerHTML = [0,1].map(i=>card(buses[i],i,failed&&!data)).join('');
  $('cards').setAttribute('aria-busy','false');
  const old = data && Date.now()-data.fetchedAt > 45000;
  $('status').classList.toggle('live',!failed&&!old&&!expired&&Boolean(buses.length));
  $('status-text').textContent = failed ? 'Connection interrupted' : old||expired ? 'Waiting for fresh GPS' : buses.length ? 'Live bus locations' : 'No buses in view';
  let warning = failed ? 'SEPTA is temporarily unavailable. Any buses still shown are the last fresh reports; they disappear when their GPS data is two minutes old.' : '';
  if (!warning && (expired||data?.stale)) warning = 'Some GPS reports are over two minutes old. Those buses are hidden until SEPTA sends a fresh location.';
  if (!warning && data?.unknown) warning = 'Some buses have an unrecognized next stop. Only buses with a verified stop count are shown.';
  $('warning').textContent=warning; $('warning').classList.toggle('hidden',!warning);
  $('updated').textContent = data ? 'Checked '+time(data.fetchedAt)+' · Auto-refresh 15s' : 'Auto-retrying every 15 seconds';
  drawRoute(buses);
}
async function refresh() {
  if(loading) return;
  const id = ++requestId, requestedDirection = direction;
  controller = new AbortController();
  loading=true; $('refresh').disabled=true; $('refresh').querySelector('span').textContent='Checking…';
  try {
    const next=await client.getTracking(requestedDirection,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(14000)])});
    if(!Array.isArray(next.buses)||!Number.isFinite(next.fetchedAt)||next.direction!==requestedDirection) throw new Error('Invalid feed');
    if(id !== requestId) return;
    data=next; failed=false;
  } catch { if(id === requestId) failed=true; }
  finally { if(id !== requestId) return; loading=false; $('refresh').disabled=false; $('refresh').querySelector('span').textContent='Refresh now'; render(); }
}
function tick(){
  const now=Date.now();
  if(!manualDirection && defaultDirection(now)!==direction) selectDirection(defaultDirection(now));
  render();
}
$('direction-slider').addEventListener('input',()=>{manualDirection=true;selectDirection($('direction-slider').value==='1'?'east':'west');});
$('direction-west').addEventListener('click',()=>{manualDirection=true;selectDirection('west');});
$('direction-east').addEventListener('click',()=>{manualDirection=true;selectDirection('east');});
$('auto-direction').addEventListener('click',()=>{manualDirection=false;selectDirection(defaultDirection());});
$('refresh').addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();refresh();}});
window.addEventListener('online',refresh);
window.addEventListener('offline',()=>{failed=true;render();});
setInterval(()=>{if(!document.hidden)refresh();},15000);
setInterval(()=>{if(!document.hidden)tick();},1000);
drawDirection();tick();refresh();
})();
