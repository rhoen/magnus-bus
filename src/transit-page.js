(() => {
'use strict';
const { TRACKERS, createDataClient } = globalThis.MagnusBus;
const page = document.getElementById('transit-page');
const ids = page.dataset.trackers.split(',');
const states = new Map(ids.map(id => [id,{ data:null, failed:false, loading:false, generation:0, routeKey:null }]));
const client = createDataClient();
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = value => new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(value);
$('tracker-panels').innerHTML = ids.map(id => {
  const c = TRACKERS[id];
  return '<section class="tracker-panel" aria-labelledby="'+id+'-title"><div class="tracker-heading"><span class="route-badge">'+c.route+'</span><div><h2 id="'+id+'-title">'+esc(c.stopName)+'</h2><p>'+esc(c.destination)+' · #'+c.target+'</p></div><span class="tracker-direction">'+c.arrow+' '+c.name+'</span></div><div class="section-label"><h3>Next two '+(c.kind==='trolley'?'trolleys':'buses')+'</h3><div class="status" id="'+id+'-status" role="status"><span class="dot"></span><span id="'+id+'-status-text">Connecting to SEPTA</span></div></div><p class="warning hidden" id="'+id+'-warning" role="status"></p><div class="cards" id="'+id+'-cards" aria-busy="true"></div><div class="updates"><span id="'+id+'-updated">Refreshes every 15 seconds</span><button class="refresh" id="'+id+'-refresh" type="button">Refresh '+c.route+'</button></div><section class="journey"><div class="journey-head"><h3>The home stretch</h3><span id="'+id+'-caption">'+c.name+'</span></div><ol class="line" id="'+id+'-route" tabindex="0" aria-label="Stops to your '+c.route+' boarding stop"></ol></section></section>';
}).join('');
function card(item,index,c,failed,waiting) {
  const kind = c.kind==='trolley'?'trolley':'bus';
  const cls = index?'secondary':'primary';
  if (!item) return '<article class="card '+cls+'"><div class="card-title">'+(index?'Following ':'Next ')+kind+'</div><h3 class="empty-title">'+(waiting?'Checking SEPTA…':failed?'Can’t reach SEPTA':index?'No second '+kind+' in view':'No '+kind+' in view')+'</h3><p class="empty-text">'+(waiting?'Looking for '+c.route+' departures.':failed?'We’ll try again automatically.':'A fresh location'+(c.kind==='trolley'?' or departure time':'')+' will appear when SEPTA reports it.')+'</p></article>';
  if ('departureAt' in item) return '<article class="card '+cls+' departure-card"><div class="card-top"><div class="card-title">'+(index?'Following departure':'Next departure')+'</div><span class="bus-id">'+(item.realtime?'LIVE ESTIMATE':'SCHEDULED')+'</span></div><div class="departure-time">'+time(item.departureAt)+'</div><div class="departure-note">'+(item.realtime?'SEPTA’s estimated departure':'Timetable · no live position')+'</div><div class="next-stop"><p class="next-label">Destination</p><p class="next-name">'+esc(item.destination)+'</p></div></article>';
  return '<article class="card '+cls+(item.stopsAway===0?' at-stop':'')+'"><div class="card-top"><div class="card-title">'+(index?'Following ':'Closest ')+kind+'</div><span class="bus-id">'+kind.toUpperCase()+' '+esc(item.vehicleId)+'</span></div><div class="distance"><span class="number">'+(item.stopsAway===0?'You’re next':item.stopsAway)+'</span><div class="unit">'+(item.stopsAway===0?'Your stop is next':(item.stopsAway===1?'stop':'stops')+'<small>from yours</small>')+'</div></div><div class="next-stop"><p class="next-label">Approaching</p><p class="next-name">'+esc(item.nextStopName)+'</p><p class="seen">Location reported '+time(item.reportedAt)+'</p></div></article>';
}
function render(id) {
  const state=states.get(id),c=TRACKERS[id],now=Date.now(),data=state.data;
  const vehicles=(data?.buses||[]).filter(v=>now-v.reportedAt<=120000);
  const departures=data && now-data.fetchedAt<=45000 ? (data.departures||[]).filter(d=>d.departureAt>=now) : [];
  const items=vehicles.length?vehicles:departures;
  const waiting=!data&&!state.failed;
  $(id+'-cards').setAttribute('aria-busy',String(waiting));
  $(id+'-cards').innerHTML=[0,1].map(i=>card(items[i],i,c,state.failed&&!data,waiting)).join('');
  $(id+'-status').classList.toggle('live',!state.failed&&Boolean(vehicles.length));
  $(id+'-status-text').textContent=state.failed?'Connection interrupted':waiting?'Connecting to SEPTA':vehicles.length?'Live locations':departures.length?'Departure times':'Waiting for SEPTA data';
  let note=state.failed?'SEPTA is temporarily unavailable for this route. Only still-fresh previous reports are shown.':data?.updatesFailed?'Some trip details could not be loaded. Available results are shown.':data?.unknown?'Some reported stops could not be matched to this trip. Only verified routes are shown.':'';
  if (!note && c.kind==='trolley'&&!vehicles.length&&!waiting) note='Trolley positions can be unavailable in the tunnel. Any timetable times shown are labeled Scheduled.';
  $(id+'-warning').textContent=note;$(id+'-warning').classList.toggle('hidden',!note);
  $(id+'-updated').textContent=data?'Checked '+time(data.fetchedAt)+' · Auto-refresh 15s':'Auto-refresh every 15 seconds';
  const first=vehicles[0],stops=first?.route||[];
  const key=JSON.stringify([first?.vehicleId,stops,Boolean(departures.length)]);
  if(key!==state.routeKey){
    state.routeKey=key;
    $(id+'-caption').textContent=first?c.route+' '+c.kind+' '+first.vehicleId:c.name;
    $(id+'-route').innerHTML=stops.length?stops.map((stop,i)=>'<li class="station '+(i===0?'active ':'')+(stop.id===c.target?'home':'')+'"><span class="station-tag">'+(stop.id===c.target?'YOUR STOP':i===0?'NEXT STOP':'&nbsp;')+'</span><span class="station-name">'+esc(stop.name)+'</span></li>').join(''):'<li class="route-empty">'+(departures.length?'Departure times are available above. A route diagram appears when SEPTA reports a fresh position.':'Waiting for a fresh position to show the stops to yours.')+'</li>';
  }
}
async function refresh(id) {
  const state=states.get(id);
  if(state.loading)return;
  state.loading=true;const generation=++state.generation;
  const button=$(id+'-refresh');button.disabled=true;button.textContent='Checking…';
  try{
    const result=await client.getTracking(id,{signal:AbortSignal.timeout(14000)});
    if(generation!==state.generation)return;
    state.data=result;state.failed=false;
  }catch{if(generation===state.generation)state.failed=true;}
  finally{state.loading=false;button.disabled=false;button.textContent='Refresh '+TRACKERS[id].route;render(id);}
}
for(const id of ids){$(id+'-refresh').addEventListener('click',()=>refresh(id));render(id);refresh(id);}
setInterval(()=>{if(!document.hidden)for(const id of ids)refresh(id);},15000);
setInterval(()=>{if(!document.hidden)for(const id of ids)render(id);},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const id of ids){render(id);refresh(id);}});
window.addEventListener('online',()=>{for(const id of ids)refresh(id);});
window.addEventListener('offline',()=>{for(const id of ids){states.get(id).failed=true;render(id);}});
})();
