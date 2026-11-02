import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/stop.js';
import '../data/stop-directory.js';

const {resolveStopLink,buildStopCatalog,stopDirectory,serviceDate}=globalThis.MagnusBus;
const now=Date.parse('2026-11-02T20:00:00Z');
const directions={0:{name:'Eastbound',destination:'East terminal'},1:{name:'Westbound',destination:'West terminal'}};
const sharedDirectory={stops:[['shared','Shared boarding stop'],['opposite','Across the street']],routes:[
  {id:'42',kind:'bus',directions,releases:{20261101:{0:[0,0],1:[0,1]}}},
  {id:'21',kind:'bus',directions,releases:{20261001:{1:[0]},20261201:{0:[1]}}}
]};

test('stop-only links find every current route serving the exact boarding stop',()=>{
  for(const at of [Date.parse('2026-11-02T09:00:00Z'),now]) {
    const stop=resolveStopLink('?stop=22120',stopDirectory,at);
    assert.equal(stop.target,'22120');assert.match(stop.stopName,/Spruce.*49th/);
    assert.ok(stop.services.some(s=>s.route==='42'&&s.gtfs==='0'));
    assert.ok(stop.services.every(s=>s.target==='22120'&&s.exactTrips));
    const shared=resolveStopLink('?stop=22151',stopDirectory,at);
    assert.deepEqual(shared.services.map(s=>s.route),['42','T2','T3','T4','T5']);
  }
  const city=resolveStopLink('?stop=20659',stopDirectory,now);
  assert.deepEqual(city.services.map(s=>s.route),['T1','T2','T3','T4','T5']);
});

test('shared stops include both directions without duplicating a service or combining adjacent stops',()=>{
  const stop=resolveStopLink('?stop=shared',sharedDirectory,now);
  assert.deepEqual(stop.services.map(s=>s.route+':'+s.gtfs),['21:1','42:0','42:1']);
  assert.equal(buildStopCatalog(sharedDirectory,now).size,2);
  assert.equal(resolveStopLink('?stop=opposite',sharedDirectory,now).services.length,1);
});

test('legacy route and direction parameters do not filter an all-routes stop page',()=>{
  const expected=resolveStopLink('?stop=shared',sharedDirectory,now);
  for(const suffix of ['&route=42&direction=0','&route=unknown&direction=east','&route=42&route=21&direction=1']) {
    assert.deepEqual(resolveStopLink('?stop=shared'+suffix,sharedDirectory,now),expected);
  }
});

test('missing, duplicate, and unknown stops cannot silently select a boarding location',()=>{
  for(const query of ['', '?route=42&direction=0','?stop=','?stop=shared&stop=opposite','?stop=unknown','?stop=%3Cscript%3E']) {
    assert.throws(()=>resolveStopLink(query,sharedDirectory,now),undefined,query);
  }
  assert.throws(()=>resolveStopLink('?stop=shared',undefined,now),/directory couldn’t load/);
});

test('each route uses its latest effective release, with Philadelphia date boundaries',()=>{
  const directory={stops:[['old','Old stop'],['new','New stop']],routes:[{
    id:'42',kind:'bus',directions,releases:{20261001:{0:[0]},20261102:{0:[1]}}
  }]};
  assert.equal(resolveStopLink('?stop=old',directory,Date.parse('2026-11-02T04:59:00Z')).target,'old');
  assert.throws(()=>resolveStopLink('?stop=old',directory,Date.parse('2026-11-02T05:00:00Z')),/current directory/);
  assert.equal(resolveStopLink('?stop=new',directory,now).stopName,'New stop');
  assert.throws(()=>resolveStopLink('?stop=old',directory,Date.parse('2026-09-01')),/current directory/);
  assert.equal(resolveStopLink('?stop=shared',sharedDirectory,now).services.length,3);
});

const scripts=await Promise.all(['stop.js','transit-page.js','stop-page.js'].map(file=>readFile(new URL('../src/'+file,import.meta.url),'utf8')));
function pageHarness(search='?stop=shared',{directory=sharedDirectory,failRoute=null}={}) {
  const elements=new Map(),timers=new Map(),listeners=new Map(),requests=[];
  let nextTimer=0,at=now;
  const get=id=>{
    if(id==='transit-page')return null;
    if(!elements.has(id))elements.set(id,{hidden:false,innerHTML:'',textContent:'',attributes:{},handlers:{},
      classList:{toggle(){}},setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(name,fn){this.handlers[name]=fn;}});
    return elements.get(id);
  };
  const events={addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);}};
  const document={getElementById:get,hidden:false,...events};
  const context=vm.createContext({Intl,URLSearchParams,AbortController,AbortSignal,
    Date:class extends Date{static now(){return at;}},document,window:{location:{search},...events},
    setInterval(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearInterval(id){timers.delete(id);},
    MagnusBus:{serviceDate,stopDirectory:directory,createDataClient:()=>({async getTracking(config,{signal}) {
      requests.push({config,signal});
      if(config.route===failRoute)throw new Error('Offline');
      return {buses:[1,2,3].map(i=>({vehicleId:String(i),tripId:'trip'+i,reportedAt:now,stopsAway:i,nextStopName:'Spruce & 52nd',destination:'Test & terminal',
        route:[{id:'previous',name:'Spruce & 52nd'},{id:config.target,name:config.stopName}]})),
        departures:[{tripId:'trip1',departureAt:now+60000,destination:'Duplicate live trip'},
          {tripId:'no-gps',departureAt:now+120000,destination:'Other departure',realtime:true}],fetchedAt:now};
    }})}});
  for(const script of scripts)vm.runInContext(script,context);
  return {get,requests,timers,document,emit(name,event={}){for(const fn of [...listeners.get(name)||[]])fn(event);},
    advance(ms){at+=ms;for(const timer of timers.values())if(timer.ms===1000)timer.fn();}};
}
const settled=()=>new Promise(resolve=>setImmediate(resolve));

test('stop page shows all routes, more than two vehicles, and distinct departure estimates',async()=>{
  const p=pageHarness();await settled();
  assert.deepEqual(p.requests.map(r=>r.config.route+':'+r.config.gtfs),['21:1','42:0','42:1']);
  assert.ok(p.requests.every(r=>r.config.target==='shared'&&r.config.allArrivals));
  assert.match(p.get('stop-description').textContent,/Stop #shared · Routes 21, 42/);
  const cards=p.get('stop-service-0-cards').innerHTML;
  assert.equal((cards.match(/<article /g)||[]).length,4);
  assert.match(cards,/class="number">3</);assert.match(cards,/Destination: Test &amp; terminal/);
  assert.match(cards,/Other departure/);assert.doesNotMatch(cards,/Duplicate live trip/);
  const html=await readFile(new URL('../info.html',import.meta.url),'utf8');
  const ids=[...html.concat(p.get('stop-panels').innerHTML).matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.match(p.get('stop-panels').innerHTML,/Arriving buses/);
  assert.equal(p.get('stop-error').hidden,true);
  p.get('stop-service-0-refresh').handlers.click();await settled();assert.equal(p.requests.length,4);
  p.advance(121000);assert.doesNotMatch(p.get('stop-service-0-cards').innerHTML,/class="number">3</);
  p.emit('pagehide');assert.equal(p.timers.size,0);assert.ok(p.requests.every(r=>r.signal.aborted||r===p.requests[0]));
  p.emit('pageshow',{persisted:true});await settled();assert.equal(p.timers.size,2);assert.equal(p.requests.length,7);
  p.emit('pagehide');
});

test('invalid links and missing directory show recovery without fetching arrivals',()=>{
  for(const [search,options] of [['',{}],['?stop=unknown',{}],['?stop=shared',{directory:null}]]) {
    const p=pageHarness(search,options);
    assert.equal(p.requests.length,0);assert.equal(p.timers.size,0);
    assert.equal(p.get('stop-error').hidden,false);assert.ok(p.get('stop-error-message').textContent.length);
    assert.equal(p.get('stop-help').hidden,true);
  }
});

test('one route failure does not prevent other routes or directions from showing arrivals',async()=>{
  const p=pageHarness('?stop=shared',{failRoute:'21'});await settled();
  assert.match(p.get('stop-service-0-cards').innerHTML,/Can’t reach SEPTA/);
  assert.match(p.get('stop-service-1-cards').innerHTML,/class="number">3</);
  assert.match(p.get('stop-service-2-cards').innerHTML,/class="number">3</);
  p.get('stop-service-0-refresh').handlers.click();await settled();assert.equal(p.requests.length,4);
  p.emit('pagehide');
});
