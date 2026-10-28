import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/data.js';
import '../src/nearby.js';
import '../data/stop-directory.js';
const {nearbyRoutes,distanceMeters,stopDirectory,trackBuses,createDataClient}=globalThis.MagnusBus;
const now=Date.parse('2026-10-28T15:00:00Z');
const directions={'0':{name:'Eastbound',destination:'East terminal'},'1':{name:'Westbound',destination:'West terminal'}};
const route=(id,zero,one=[],kind='bus')=>({id,kind,directions,releases:{20260927:{0:zero,1:one}}});
const directory={stops:[['shared','Shared stop',40,-75],['opposite','Across the street',40.0001,-75],['other','Another block',40.003,-75],['far','Too far',41,-75]],routes:[route('42',[0],[1]),route('21',[0],[1]),route('T3',[2],[3],'trolley')]};

test('closest shared stop returns every serving route, deduplicated across directions',()=>{
 const result=nearbyRoutes(directory,{latitude:40,longitude:-75},now);
 assert.deepEqual(result.routes.map(r=>r.route),['21','42']);
 assert.equal(result.routes[0].directions[0].target,'shared');
 assert.equal(result.routes[0].directions[1].target,'opposite');
 assert.equal(result.routes[0].directions[1].destination,'Toward West terminal');
 assert.equal(result.allRoutes.length,3);
 assert.equal(result.allRoutes[2].directions.length,1);
});
test('one stop can produce one route and the nearer direction is selected first',()=>{
 const result=nearbyRoutes(directory,{latitude:40.003,longitude:-75},now);
 assert.deepEqual(result.routes.map(r=>r.route),['T3']);
 const opposite=nearbyRoutes(directory,{latitude:40.0001,longitude:-75},now);
 assert.equal(opposite.routes[0].directions[0].gtfs,'1');
});
test('out-of-area and malformed locations do not invent nearby stops',()=>{
 assert.equal(nearbyRoutes(directory,{latitude:45,longitude:-75},now).routes.length,0);
 for(const latitude of [NaN,Infinity,91,null])assert.throws(()=>nearbyRoutes(directory,{latitude,longitude:-75},now),/Invalid location/);
 assert.ok(Math.abs(distanceMeters(40,-75,40.001,-75)-111.19)<1);
});
test('discovery uses the latest effective stop release, never a future one',()=>{
 const data=structuredClone(directory);
 data.routes[0].releases['20261101']={0:[3]};
 assert.ok(nearbyRoutes(data,{latitude:40,longitude:-75},now).routes.some(r=>r.route==='42'));
 assert.ok(!nearbyRoutes(data,{latitude:40,longitude:-75},Date.parse('2026-11-02')).allRoutes.some(r=>r.route==='42'));
});
test('bundled SEPTA directory includes real shared trolley stops and destination labels',()=>{
 const stop=stopDirectory.stops.find(s=>s[0]==='600');
 const result=nearbyRoutes(stopDirectory,{latitude:stop[2],longitude:stop[3]},now);
 const t2=result.routes.find(r=>r.route==='T2');
 assert.ok(t2);
 assert.equal(t2.directions[0].target,'600');
 assert.equal(t2.directions.find(c=>c.gtfs==='0').destination,'Toward 13th-Market');
 assert.equal(t2.directions.find(c=>c.gtfs==='1').destination,'Toward 61st-Baltimore');
 const city=stopDirectory.stops.find(s=>s[0]==='20659');
 const shared=nearbyRoutes(stopDirectory,{latitude:city[2],longitude:city[3]},now);
 for(const id of ['T1','T2','T3','T4','T5'])assert.ok(shared.routes.some(r=>r.route===id));
 assert.ok(stopDirectory.routes.length>100);
 for(const r of stopDirectory.routes)assert.ok(['bus','trolley'].includes(r.kind));
});
const config={route:'42',kind:'bus',gtfs:'1',name:'Westbound',target:'b',destination:'Toward terminal',stopName:'Board here',exactTrips:true};
const stops=['a','skip','b','c'].map((id,i)=>({route_id:'42',direction_id:1,release_name:'20260927',stop_id:id,stop_name:id,stop_sequence:i+1}));
const bus={route_id:'42',direction_id:1,direction_name:'Westbound',trip_id:'trip',vehicle_id:'123',timestamp:now/1000,next_stop_id:'a',next_stop_sequence:2,transit_date:'2026-10-28'};
const update={trip:{route_id:'42',direction_id:1,trip_id:'trip',transit_date:'2026-10-28'},stop_times:[{stop_id:'a',stop_sequence:1,stop_name:'A'},{stop_id:'skip',stop_sequence:2,is_skipped:true},{stop_id:'b',stop_sequence:3,stop_name:'B'},{stop_id:'c',stop_sequence:4,stop_name:'C'}]};
test('dynamic bus trackers count the actual trip, omit skipped stops, and reject wrong dates or short turns',()=>{
 assert.equal(trackBuses([bus],stops,now,config,{trip:update}).buses[0].stopsAway,1);
 assert.equal(trackBuses([bus],stops,now,config,{}).buses.length,0);
 for(const change of [u=>u.stop_times=u.stop_times.filter(s=>s.stop_id!=='b'),u=>u.trip.transit_date='2026-10-27',u=>u.stop_times.find(s=>s.stop_id==='b').is_skipped=true,u=>u.trip.direction_id=0]){
  const u=structuredClone(update);change(u);assert.equal(trackBuses([bus],stops,now,config,{trip:u}).buses.length,0);
 }
 assert.equal(trackBuses([{...bus,next_stop_id:'c'}],stops,now,config,{trip:update}).buses.length,0);
 assert.equal(trackBuses([{...bus,direction_id:0}],stops,now,config,{trip:update}).buses.length,0);
});
test('dynamic tracking fetches bus trip details, caches stops, and surfaces partial failure',async()=>{
 const calls=[];let fail=false;
 const client=createDataClient({now:()=>now,fetchImpl:async url=>{
  calls.push(url);
  if(url.includes('trip-update/')){if(fail)throw new Error('Unavailable');return Response.json(update);}
  return Response.json(url.includes('stops/')?stops:[bus]);
 }});
 assert.equal((await client.getTracking(config)).buses[0].stopsAway,1);
 fail=true;const result=await client.getTracking(config);
 assert.equal(result.buses.length,0);assert.equal(result.updatesFailed,1);
 assert.equal(calls.filter(u=>u.includes('stops/')).length,1);
 assert.ok(calls.every(u=>!u.includes('lat=')&&!u.includes('lon=')));
});

const pageSource=await readFile(new URL('../src/nearby-page.js',import.meta.url),'utf8');
function pageHarness({secure=true,geolocation=true,directoryAvailable=true}={}){
 const elements=new Map(),requests=[],mounts=[],events={};let destroyed=0;
 const element=()=>({children:[],dataset:{},attributes:{},handlers:{},hidden:false,disabled:false,textContent:'',
  addEventListener(name,fn){this.handlers[name]=fn;},setAttribute(name,value){this.attributes[name]=value;},
  replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},focus(){this.focused=true;}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 vm.runInNewContext(pageSource,{isSecureContext:secure,navigator:{geolocation:geolocation?{getCurrentPosition(success,error,options){requests.push({success,error,options});}}:undefined},
  document:{getElementById:get,createElement:element},window:{addEventListener(name,fn){events[name]=fn;}},
  MagnusBus:{stopDirectory:directoryAvailable?directory:undefined,nearbyRoutes:(d,p)=>nearbyRoutes(d,p,now),createDataClient:()=>({}),mountTransitPanels(container,configs){mounts.push(configs.nearby);return{destroy(){destroyed++;}};}}});
 return{get,requests,mounts,events,get destroyed(){return destroyed;},click:id=>get(id).handlers.click(),locate(){get('nearby-locate').handlers.click();requests.at(-1).success({coords:{latitude:40,longitude:-75,accuracy:10}});}};
}
test('location is requested only on tap; shared route selection and direction changes update boarding stops',()=>{
 const p=pageHarness();assert.equal(p.requests.length,0);p.locate();
 assert.equal(p.requests[0].options.enableHighAccuracy,true);
 assert.equal(p.get('nearby-routes').children.length,2);
 p.get('nearby-routes').children[0].handlers.click();
 assert.equal(p.mounts[0].target,'shared');assert.equal(p.get('nearby-discovery').hidden,true);
 p.get('nearby-directions').children[1].handlers.click();
 assert.equal(p.mounts[1].target,'opposite');assert.equal(p.destroyed,1);
 assert.equal(p.get('nearby-title').textContent,'Across the street');
 assert.equal(p.get('nearby-route-badge').textContent,'21');
 assert.equal(p.get('nearby-destination').textContent,'Toward West terminal · #opposite');
 assert.equal(p.get('nearby-directions').children[1].attributes['aria-pressed'],'true');
 p.click('nearby-back');assert.equal(p.destroyed,2);assert.equal(p.get('nearby-detail').hidden,true);assert.ok(p.get('nearby-heading').focused);
 p.click('nearby-more');assert.equal(p.get('nearby-routes').children.length,3);
});
test('denied, unavailable, and timed-out locations provide retry without starting a tracker',()=>{
 for(const [code,message] of [[1,/denied/],[2,/unavailable/],[3,/too long/]]){
  const p=pageHarness();p.click('nearby-locate');p.requests[0].error({code});
  assert.match(p.get('nearby-status').textContent,message);assert.equal(p.get('nearby-locate').disabled,false);assert.equal(p.mounts.length,0);
  p.locate();assert.equal(p.get('nearby-routes').children.length,2);
 }
});
test('insecure origins, unsupported browsers, and missing directory fail clearly before prompting',()=>{
 for(const [options,message] of [[{secure:false},/HTTPS/],[{geolocation:false},/doesn’t support/],[{directoryAvailable:false},/directory couldn’t load/]]){
  const p=pageHarness(options);p.click('nearby-locate');assert.equal(p.requests.length,0);assert.match(p.get('nearby-status').textContent,message);
 }
});
test('late geolocation callbacks cannot restore results after navigation away',()=>{
 const p=pageHarness();p.click('nearby-locate');p.events.pagehide();
 p.requests[0].success({coords:{latitude:40,longitude:-75,accuracy:10}});
 assert.equal(p.get('nearby-routes').children.length,0);
 p.events.pageshow({persisted:true});assert.equal(p.get('nearby-locate').disabled,false);
});

test('switching dynamic panels aborts requests, stops timers, and ignores late results',async()=>{
 const elements=new Map(),timers=new Map(),pending=[],listeners=new Map();let timerId=0;
 const get=id=>{if(id==='transit-page')return null;if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{toggle(){}},setAttribute(){},addEventListener(){}});return elements.get(id);};
 const events={addEventListener(name,fn){listeners.set(fn,name);},removeEventListener(name,fn){listeners.delete(fn);}};
 const context=vm.createContext({Intl,Date:class extends Date{static now(){return now;}},AbortController,AbortSignal,
  document:{getElementById:get,hidden:false,...events},window:events,
  setInterval(fn){const id=++timerId;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},MagnusBus:{createDataClient:()=>({})}});
 vm.runInContext(await readFile(new URL('../src/transit-page.js',import.meta.url),'utf8'),context);
 const client={getTracking(c,{signal}){return new Promise(resolve=>pending.push({c,signal,resolve}));}};
 const mount=context.MagnusBus.mountTransitPanels,container=get('panels');
 const first=mount(container,{nearby:config},{client,dynamic:true});
 first.destroy();assert.equal(pending[0].signal.aborted,true);assert.equal(timers.size,0);assert.equal(listeners.size,0);
 const other={...config,target:'c'};
 const second=mount(container,{nearby:other},{client,dynamic:true});
 pending[1].resolve({buses:[{vehicleId:'new',reportedAt:now,stopsAway:2,nextStopName:'New direction',route:[]}],departures:[],fetchedAt:now});
 await new Promise(resolve=>setImmediate(resolve));
 pending[0].resolve({buses:[{vehicleId:'old',reportedAt:now,stopsAway:5,nextStopName:'Old direction',route:[]}],departures:[],fetchedAt:now});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(get('nearby-cards').innerHTML,/New direction/);assert.doesNotMatch(get('nearby-cards').innerHTML,/Old direction/);
 second.destroy();assert.equal(timers.size,0);assert.equal(listeners.size,0);
});

test('loop trips use the reported stop sequence and skip boarding stops already departed',()=>{
 const loop=structuredClone(update);
 loop.stop_times=[{stop_id:'a',stop_sequence:1,departed:true},{stop_id:'b',stop_sequence:2,departed:true},{stop_id:'a',stop_sequence:3},{stop_id:'b',stop_sequence:4}];
 const result=trackBuses([{...bus,next_stop_sequence:3}],stops,now,config,{trip:loop});
 assert.equal(result.buses[0].stopsAway,1);
 assert.equal(trackBuses([{...bus,next_stop_sequence:99}],stops,now,config,{trip:loop}).buses.length,0);
 const departed=structuredClone(update);departed.stop_times.find(s=>s.stop_id==='b').departed=true;
 assert.equal(trackBuses([bus],stops,now,config,{trip:departed}).buses.length,0);
});
test('location accuracy and outside-service-area states are visible without fabricating routes',()=>{
 const p=pageHarness();p.click('nearby-locate');p.requests[0].success({coords:{latitude:45,longitude:-75,accuracy:300}});
 assert.match(p.get('nearby-location').textContent,/accuracy is low/);
 assert.match(p.get('nearby-status').textContent,/No SEPTA/);
 assert.equal(p.get('nearby-routes').children.length,0);assert.equal(p.mounts.length,0);
});
