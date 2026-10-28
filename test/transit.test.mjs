import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/data.js';
const {TRACKERS,trackBuses,createDataClient,scheduledDepartures,scheduleTimestamp}=globalThis.MagnusBus;
const load=async route=>JSON.parse(await readFile(new URL('./fixtures/'+route+'-stops.json',import.meta.url)));
const [t2,t3,bus21]=await Promise.all([load('t2'),load('t3'),load('21')]);
const now=Date.parse('2026-10-27T19:30:00Z');
const vehicle=(overrides={})=>({route_id:'T2',direction_id:0,direction_name:'Eastbound',trip_id:'a',vehicle_id:'9001',transit_date:'2026-10-27',timestamp:now/1000-10,next_stop_id:'20869',next_stop_sequence:12,status:'ON-TIME',...overrides});
const update=(v,stopIds,options={})=>({trip:{route_id:v.route_id,trip_id:v.trip_id,direction_id:v.direction_id,transit_date:v.transit_date,status:v.status,'real-time':true,trip_headsign:'13th-Market',...options},stop_times:stopIds.map((id,i)=>({stop_id:id,stop_sequence:i+1,stop_name:'Stop '+id,eta:now/1000+(i+1)*60,departed:false,is_skipped:false}))});
test('T2 inbound counts the actual trip stops to Florence/48th and requires service to City Hall',()=>{
 const v=vehicle(),u=update(v,['20869','600','20870','20871','31140']);
 const result=trackBuses([v],t2,now,'t2City',{a:u});
 assert.equal(result.buses[0].stopsAway,2);assert.deepEqual(result.buses[0].route.map(s=>s.id),['20869','600','20870']);
 const short=update(v,['20869','600','20870','21248']);
 assert.equal(trackBuses([v],t2,now,'t2City',{a:short}).buses.length,0);
});
test('trolleys with no GPS expose scheduled departures without inventing a position',()=>{
 for(const [id,rows] of [['t2Home',t2],['t3Home',t3]]){
  const c=TRACKERS[id],v=vehicle({route_id:c.route,direction_id:1,direction_name:'Westbound',vehicle_id:'None',next_stop_id:null,timestamp:63240,status:'NO GPS'});
  const u=update(v,['283','20659','20660'],{'real-time':false});
  const result=trackBuses([v],rows,now,id,{a:u});
  assert.equal(result.buses.length,0);assert.equal(result.departures.length,1);assert.equal(result.departures[0].realtime,false);
  u.stop_times[1].departed=true;assert.equal(trackBuses([v],rows,now,id,{a:u}).departures.length,0);
 }
});
test('canceled, skipped, mismatched, and past trolley departures are excluded',()=>{
 const v=vehicle({direction_id:1,direction_name:'Westbound',vehicle_id:'None',next_stop_id:null,timestamp:63240,status:'NO GPS'});
 for(const change of [u=>u.trip.status='CANCELED',u=>u.stop_times[1].is_skipped=true,u=>u.trip.route_id='T3',u=>u.trip.transit_date='2026-10-26',u=>u.stop_times[1].eta=now/1000-1]){
  const u=update(v,['283','20659','20660']);change(u);
  assert.equal(trackBuses([v],t2,now,'t2Home',{a:u}).departures.length,0);
 }
});
test('Route 21 uses the westbound Walnut/16th stop and excludes eastbound trips',()=>{
 const v=vehicle({route_id:'21',direction_id:1,direction_name:'Westbound',next_stop_id:'14079'});
 assert.equal(trackBuses([v],bus21,now,'bus21Home').buses[0].stopsAway,1);
 assert.equal(trackBuses([vehicle({route_id:'21'})],bus21,now,'bus21Home').buses.length,0);
});
test('the data client isolates route caches and requests actual trolley trip details',async()=>{
 const calls=[],v=vehicle(),u=update(v,['20869','600','20870','31140']);
 const client=createDataClient({now:()=>now,fetchImpl:async url=>{
  calls.push(url);
  if(url.includes('trip-update/'))return Response.json(u);
  if(url.includes('stops/'))return Response.json(url.endsWith('T2')?t2:bus21);
  return Response.json(url.endsWith('T2')?[v]:[vehicle({route_id:'21',direction_id:1,direction_name:'Westbound',next_stop_id:'14079'})]);
 }});
 assert.equal((await client.getTracking('t2City')).buses[0].stopsAway,2);
 assert.equal((await client.getTracking('bus21Home')).buses[0].stopsAway,1);
 assert.equal(calls.filter(u=>u.includes('stops/')).length,2);
 assert.ok(calls.some(u=>u.endsWith('trip-update/?trip_id=a')));
});
test('Center City panels update independently and expire old departure times',async()=>{
 let at=now;const elements=new Map(),pending=new Map(),intervals=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{dataset:{trackers:'t2Home,t3Home,bus21Home'},innerHTML:'',textContent:'',classList:{toggle(){}},setAttribute(){},addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({Intl,AbortSignal,AbortController,Date:class extends Date{static now(){return at;}},document:{getElementById:get,hidden:false,addEventListener(){}},window:{addEventListener(){}},setInterval(fn,ms){intervals.push({fn,ms});},MagnusBus:{TRACKERS,createDataClient:()=>({getTracking(id){return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));}})}});
 vm.runInContext(await readFile(new URL('../src/transit-page.js',import.meta.url),'utf8'),context);
 pending.get('t2Home').reject(new Error('Unavailable'));
 pending.get('t3Home').resolve({buses:[],departures:[{departureAt:now+600000,realtime:false,destination:'Yeadon'}],fetchedAt:now});
 pending.get('bus21Home').resolve({buses:[{vehicleId:'123',reportedAt:now,stopsAway:2,nextStopName:'Walnut & Broad',route:[]}],departures:[],fetchedAt:now});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(get('t2Home-cards').innerHTML,/Can’t reach SEPTA/);
 assert.match(get('t3Home-cards').innerHTML,/SCHEDULED/);
 assert.match(get('bus21Home-cards').innerHTML,/Walnut &amp; Broad/);
 at+=46000;intervals.find(i=>i.ms===1000).fn();
 assert.doesNotMatch(get('t3Home-cards').innerHTML,/SCHEDULED/);
 assert.match(get('bus21Home-cards').innerHTML,/Walnut &amp; Broad/);
});

test('scheduled fallback uses only a service calendar confirmed for today and excludes known cancellations',()=>{
 const v=vehicle({direction_id:1,direction_name:'Westbound',status:'NO GPS'});
 const u=update(v,['283','20659'],{service_id:'46',release_name:'20260927','real-time':false});
 const row={route_id:'T2',direction_id:1,stop_id:'20659',trip_id:'future',release_name:'20260927',service_id:'46',arrival_time:'16:00:00',trip_headsign:'61st-Baltimore'};
 const rows=[{...row,service_id:'weekend',trip_id:'wrong-day'},{...row,release_name:'20261101',trip_id:'future-release'},{...row,trip_id:'canceled'},row];
 const feed=[v,vehicle({trip_id:'canceled',status:'CANCELED'})];
 assert.deepEqual(scheduledDepartures(rows,feed,{a:u},TRACKERS.t2Home,now).map(d=>d.tripId),['future']);
 assert.deepEqual(scheduledDepartures(rows,feed,{},TRACKERS.t2Home,now),[]);
 u.trip.transit_date='2026-10-26';assert.deepEqual(scheduledDepartures(rows,feed,{a:u},TRACKERS.t2Home,now),[]);
});
test('scheduled clock times respect Philadelphia timezone and GTFS hours after midnight',()=>{
 assert.equal(scheduleTimestamp('2026-10-27','16:00:00'),Date.parse('2026-10-27T20:00:00Z'));
 assert.equal(scheduleTimestamp('2026-12-01','16:00:00'),Date.parse('2026-12-01T21:00:00Z'));
 assert.equal(scheduleTimestamp('2026-10-27','24:30:00'),Date.parse('2026-10-28T04:30:00Z'));
 assert.ok(Number.isNaN(scheduleTimestamp('2026-10-27','12:99:00')));
});
