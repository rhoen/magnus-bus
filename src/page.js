import { DIRECTIONS, defaultDirection } from './directions.js';
export const page = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f6f5f0"><meta name="description" content="A simpler school run. Track Route 42 to school from 49th & Spruce and back home from 42nd & Spruce."><meta name="apple-mobile-web-app-title" content="Magnus's Bus"><title>Magnus's Bus · Route 42</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%231c4237'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-family='Arial' font-size='34' font-weight='bold' fill='%23e8f2b0'%3E42%3C/text%3E%3C/svg%3E">
<style>
:root{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#203e35;background:#f6f5f0;font-synthesis:none}*{box-sizing:border-box}body{margin:0;-webkit-font-smoothing:antialiased}button,a,summary{-webkit-tap-highlight-color:transparent}button{font:inherit;cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #327b62;outline-offset:5px}a{color:inherit}svg{display:block}.wrap{width:min(100% - 64px,1040px);margin:auto}.stopbar{display:flex;align-items:center;gap:17px;padding:21px 23px;background:#fffefa;border:1px solid #e1e3d9;border-radius:17px}.route-badge{background:#e9efda;border:1px solid #dce4c9;border-radius:10px;display:grid;place-items:center;min-width:49px;height:49px;font-size:24px;font-weight:750}.stop-title{font-size:18px;font-weight:650;letter-spacing:-.5px}.stop-sub{font-size:12px;color:#728074;margin-top:6px}.east{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:#506c5a;background:#f1f3e9;padding:9px 12px;border-radius:30px}.section-label{display:flex;align-items:center;justify-content:space-between;margin:30px 0 13px}.section-label h2{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:750;margin:0;color:#67776b}.status{font-size:12px;display:flex;align-items:center;gap:7px;color:#697769}.dot{width:6px;height:6px;display:inline-block;border-radius:50%;background:#8b937f}.status.live .dot{background:#367d59;box-shadow:0 0 0 3px #e5ecd9}.cards{display:grid;grid-template-columns:1.25fr 1fr;gap:18px}.card{min-height:317px;border-radius:21px;padding:27px 29px;display:flex;flex-direction:column;position:relative;overflow:hidden}.primary{background:#244a3d;color:#fffdf2}.secondary{background:#e9eddf;border:1px solid #dce1d1;color:#2b493b}.card-top{display:flex;align-items:center;justify-content:space-between}.card-title{font-size:12px;font-weight:550;letter-spacing:.2px;display:flex;gap:9px;align-items:center}.bus-id{font-size:10px;letter-spacing:.5px;padding:6px 8px;border-radius:5px;background:#ffffff12;color:#cddbcc}.secondary .bus-id{background:#dce3d2;color:#607353}.distance{display:flex;align-items:baseline;gap:14px;margin:20px 0 20px;min-height:85px}.number{font-size:83px;line-height:1;font-weight:500;letter-spacing:-5px;font-variant-numeric:tabular-nums}.primary .number{color:#e4efac}.unit{font-size:17px;line-height:1.4;max-width:130px}.unit small{font-size:12px;display:block;opacity:.65}.next-stop{border-top:1px solid #ffffff25;padding-top:18px;margin-top:auto}.secondary .next-stop{border-color:#cfd8c4}.next-label{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;opacity:.62;margin:0 0 8px}.next-name{font-size:17px;font-weight:550;letter-spacing:-.4px;line-height:1.4;margin:0}.seen{font-size:11px;opacity:.6;margin:9px 0 0}.empty-title{font-size:28px;line-height:1.2;letter-spacing:-.8px;font-weight:500;margin:32px 0 16px;max-width:260px}.empty-text{font-size:13px;line-height:1.6;opacity:.75;max-width:300px;margin:0}.at-stop .number{font-size:50px;letter-spacing:-2px}.at-stop .distance{display:block;margin:30px 0}.at-stop .unit{margin-top:9px;font-size:13px;max-width:none}.updates{min-height:59px;display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:11px;color:#7b8377}.refresh{display:flex;align-items:center;gap:7px;border:none;background:none;color:#45634e;font-size:12px;font-weight:600;padding:10px 0 10px 12px}.refresh:disabled{opacity:.5;cursor:wait}.warning{background:#f3ead4;color:#766036;border:1px solid #e5d9bb;padding:13px 17px;font-size:12px;line-height:1.6;border-radius:12px;margin:0 0 16px}.journey{padding:25px 27px 29px;background:#fffefa;border:1px solid #e1e3d9;border-radius:17px;margin-top:8px}.journey-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.journey h2{font-size:14px;font-weight:650;margin:0}.journey-head span{font-size:11px;color:#7c8578}.line{display:flex;padding-top:28px;overflow:auto;padding-bottom:6px}.station{flex:1;min-width:75px;position:relative;text-align:center;font-size:10px;color:#8b9285;line-height:1.4;padding-top:25px}.station:before{content:"";height:2px;background:#dce1ce;position:absolute;left:-50%;right:50%;top:5px}.station:first-child:before{display:none}.station:after{content:"";width:9px;height:9px;background:#fbfcf3;border:2px solid #c3cbb7;border-radius:50%;position:absolute;left:calc(50% - 5px);top:1px}.station.home{color:#36513d;font-weight:700}.station.home:after{width:13px;height:13px;top:-1px;left:calc(50% - 7px);border:4px solid #315a42;background:#e7eebd;box-shadow:0 0 0 4px #ecf0df}.station.active{color:#365b44;font-weight:650}.station.active:after{background:#92a858;border-color:#92a858;box-shadow:0 0 0 4px #ecf0df}.station small{display:block;font-size:9px;margin-top:3px;letter-spacing:.1px}.helper{margin:22px 0 27px;color:#788173;font-size:11px;line-height:1.7;display:flex;gap:9px}.helper svg{flex-shrink:0;margin-top:1px}.helper p{margin:0}details{border-top:1px solid #dedfd5;padding:17px 0;color:#73806e;font-size:12px}summary{cursor:pointer;width:fit-content;font-weight:500}details p{max-width:740px;line-height:1.8;font-size:12px;margin:12px 0}footer{display:flex;justify-content:space-between;gap:20px;margin:13px 0 28px;font-size:10px;letter-spacing:.2px;color:#87907e}.footer-love{display:flex;gap:6px}.hidden{display:none!important}@media(min-width:1400px){.wrap{width:1040px}}@media(max-width:680px){.wrap{width:calc(100% - 36px)}.stopbar{padding:17px 15px;gap:12px}.stop-title{font-size:16px}.stop-sub{font-size:11px}.east{font-size:0;padding:9px}.east b{font-size:16px}.cards{grid-template-columns:1fr;gap:12px}.card{padding:23px;min-height:282px}.secondary{min-height:230px}.secondary .distance{margin:15px 0;min-height:62px}.secondary .number{font-size:60px}.secondary .unit{font-size:15px}.secondary .empty-title{margin:22px 0 12px}.section-label{margin-top:26px}.journey{padding:22px 17px}.journey-head span{font-size:10px}.station{min-width:46px;font-size:9px}.updates{font-size:10px}.number{font-size:80px}footer{font-size:9px}.helper{font-size:10px}.status{font-size:10px}.empty-title{font-size:26px}}@media(prefers-reduced-motion:no-preference){.live .dot{animation:breathe 3s ease-in-out infinite}@keyframes breathe{50%{box-shadow:0 0 0 5px #367d5910}}}
.app-title{font-size:20px;font-weight:750;letter-spacing:-.6px;margin:22px 0 0;line-height:1.2}
.direction-switch{display:flex;align-items:center;justify-content:center;gap:20px;padding:18px 0;margin:0 0 4px;min-height:80px}
.direction-label{border:0;background:transparent;padding:10px 0;font-size:13px;line-height:1.4;color:#87907e;min-height:44px;flex:1;max-width:230px;transition:color .18s}
.west-label{text-align:right}.east-label{text-align:left}.direction-label[aria-pressed="true"]{color:#244a3d;font-weight:700}
.slider-control{position:relative;width:90px;height:44px;flex-shrink:0;border-radius:24px}.slider-rail{position:absolute;inset:7px 0;background:#e3e8d5;border:1px solid #cdd7bc;border-radius:24px}
.bus-thumb{position:absolute;left:4px;top:4px;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;color:#e8f2b0;background:#254c3f;box-shadow:0 2px 5px #203e3520;pointer-events:none;transform:translateX(46px);transition:transform .2s ease}
.bus-thumb.west{transform:translateX(0)}.slider-control:focus-within{outline:3px solid #327b62;outline-offset:4px}
#direction-slider{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.auto-direction{border:0;background:transparent;color:#365b44;text-decoration:underline;font:inherit;padding:10px 0;min-height:40px}
@media(max-width:680px){.direction-switch{gap:12px;min-height:72px;padding:14px 0}.direction-label{font-size:12px}.east{font-size:11px;white-space:nowrap}.stop-sub{line-height:1.5}.stopbar{flex-wrap:wrap}.east{margin-left:61px}}
@media(prefers-reduced-motion:reduce){.bus-thumb,.direction-label{transition:none}}
</style>
</head>
<body><div class="wrap">
<main><h1 class="app-title">Magnus’s bus</h1>
<section class="direction-switch" aria-label="Trip direction">
<button id="direction-west" class="direction-label west-label" type="button" aria-controls="cards">west - heading home</button>
<div class="slider-control"><div class="slider-rail" aria-hidden="true"></div><span class="bus-thumb" id="bus-thumb" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M9 3v8M6 19v2m12-2v2M9 6h7"/><circle cx="8.5" cy="15.5" r=".8" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".8" fill="currentColor"/></svg></span><input id="direction-slider" type="range" min="0" max="1" step="1" value="1" aria-label="Bus direction" aria-valuetext="east - going to school" aria-controls="cards"></div>
<button id="direction-east" class="direction-label east-label" type="button" aria-controls="cards">east - going to school</button>
</section>
<div class="stopbar"><div class="route-badge" aria-label="Route 42">42</div><div><div class="stop-title" id="stop-title">Your Route 42 stop</div><div class="stop-sub" id="stop-sub"></div></div><div class="east" id="direction-badge"></div></div>
<div class="section-label"><h2>On the way to your stop</h2><div class="status" id="status" role="status"><span class="dot"></span><span id="status-text">Connecting to SEPTA</span></div></div>
<div class="warning hidden" id="warning" role="status"></div>
<div class="cards" id="cards" aria-busy="true"><article class="card primary"><div class="card-title">↗ &nbsp; Closest bus</div><h2 class="empty-title">Finding your bus…</h2><p class="empty-text">Checking eastbound Route 42.</p></article><article class="card secondary"><div class="card-title">Following bus</div><h2 class="empty-title">One moment…</h2><p class="empty-text">Looking a little farther down the route.</p></article></div>
<div class="updates"><span id="updated">Refreshes every 15 seconds while open</span><button class="refresh" id="refresh" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-2"/></svg><span>Refresh now</span></button></div>
<section class="journey"><div class="journey-head"><h2>The home stretch</h2><span id="route-caption">Along Spruce Street</span></div><div class="line" id="route-line" aria-label="Eastbound stops on Spruce Street"></div></section>
<div class="helper"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v5m0-9v1"/></svg><p>Stop counts, without the guesswork. We show each bus’s reported next stop and how many stops it is from yours.</p></div>
<details><summary>How this works</summary><button id="auto-direction" type="button" class="auto-direction hidden">Use time of day</button><p>Locations come from SEPTA’s TransitView feed. “Approaching” is the next stop SEPTA reports, not confirmation that a bus has reached or left it. For school, the stop is 49th &amp; Spruce eastbound. For home, it is 42nd &amp; Spruce westbound. A reported next stop directly before your boarding stop is 1 stop from yours. At your boarding stop, we show “Your stop is next.”</p><p>Philadelphia time selects eastbound before noon and westbound from noon onward, including when you return to an open tab. A manual choice stays selected until you reload or choose “Use time of day.” We show up to two buses in your selected direction, ordered by stops remaining, with GPS proximity used to break ties. This is route progress, not an arrival-time prediction or a guarantee of arrival order. Traffic, detours, and buses passing one another can change the order. GPS reports older than two minutes are excluded. A bus still finishing a trip in the opposite direction is excluded even if SEPTA has already assigned its next trip.</p><p>The stop order is refreshed from SEPTA, with the Wycombe and 61st &amp; Pine branches counted separately. This app is an independent project using <a href="https://www3.septa.org/#/Real%20Time%20Data/TransitView" target="_blank" rel="noreferrer">SEPTA’s public data</a>. Check <a href="https://www.septa.org/alerts/" target="_blank" rel="noreferrer">SEPTA alerts</a> for service changes.</p></details>
</main><footer><span class="footer-love">♡ &nbsp; Made for Magnus’s mornings.</span><span>Philadelphia, PA · Powered by SEPTA data</span></footer>
</div>
<script>
const $ = id => document.getElementById(id);
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = value => new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(value);
const directions = ${JSON.stringify(DIRECTIONS)};
const defaultDirection = ${defaultDirection.toString()};
let direction = defaultDirection(), manualDirection = false;
let data = null, loading = false, failed = false, requestId = 0, controller;
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
  $('route-caption').textContent = 'Along Spruce Street · ' + config.name;
  $('auto-direction').classList.toggle('hidden', !manualDirection);
  drawRoute();
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
  const target = directions[direction].target;
  $('route-line').setAttribute('aria-label', directions[direction].name + ' stops on Spruce Street');
  $('route-line').innerHTML = directions[direction].homeStops.map(([id,name]) => '<div class="station '+(id===target?'home':'')+' '+(buses.some(b=>b.nextStopId===id)?'active':'')+'">'+name+' St'+(id===target?'<small>YOUR STOP</small>':buses.some(b=>b.nextStopId===id)?'<small>BUS NEXT STOP</small>':'')+'</div>').join('');
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
    const response=await fetch('/api/buses?direction='+requestedDirection,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(14000)])});
    if(!response.ok) throw new Error('Unavailable');
    const next=await response.json();
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
</script></body></html>`;
