import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/stop.js';
import '../data/stop-directory.js';

const {resolveStopLink,stopDirectory,serviceDate}=globalThis.MagnusBus;
const now=Date.parse('2026-11-02T20:00:00Z');
const east='?route=42&stop=22120&direction=0';
const west='?route=42&stop=22151&direction=1';

test('sticker links resolve real route, stop, and direction metadata without time-of-day switching',()=>{
  for(const at of [Date.parse('2026-11-02T09:00:00Z'),now]) {
    const config=resolveStopLink(east,stopDirectory,at);
    assert.equal(config.route,'42');assert.equal(config.target,'22120');
    assert.equal(config.gtfs,'0');assert.equal(config.name,'Eastbound');
    assert.match(config.stopName,/Spruce.*49th/);assert.equal(config.exactTrips,true);
    const home=resolveStopLink(west,stopDirectory,at);
    assert.equal(home.target,'22151');assert.equal(home.name,'Westbound');
  }
  const trolley=resolveStopLink('?route=T2&stop=20659&direction=1',stopDirectory,now);
  assert.equal(trolley.kind,'trolley');assert.equal(trolley.destination,'Toward 61st-Baltimore');
});

test('missing, duplicate, unknown, and mismatched link parameters cannot select a default stop',()=>{
  for(const query of ['', '?route=42&stop=22120','?route=&stop=22120&direction=0',
    east+'&route=21',east+'&stop=22151',east+'&direction=1',
    '?route=42&stop=22120&direction=east','?route=42&stop=22120&direction=2',
    '?route=unknown&stop=22120&direction=0','?route=42&stop=not-a-stop&direction=0',
    '?route=42&stop=22120&direction=1','?route=T2&stop=22120&direction=0',
    '?route=%3Cscript%3E&stop=22120&direction=0']) {
    assert.throws(()=>resolveStopLink(query,stopDirectory,now),undefined,query);
  }
  assert.throws(()=>resolveStopLink(east,undefined,now),/directory couldn’t load/);
});

test('link membership uses the latest effective release in Philadelphia time',()=>{
  const directory={stops:[['old','Old stop'],['new','New stop']],routes:[{
    id:'42',kind:'bus',directions:{0:{name:'Eastbound',destination:'Terminal'}},
    releases:{20261001:{0:[0]},20261102:{0:[1]}}
  }]};
  const query='?route=42&stop=old&direction=0';
  assert.equal(resolveStopLink(query,directory,Date.parse('2026-11-02T04:59:00Z')).target,'old');
  assert.throws(()=>resolveStopLink(query,directory,Date.parse('2026-11-02T05:00:00Z')),/current directory/);
  assert.equal(resolveStopLink('?route=42&stop=new&direction=0',directory,now).stopName,'New stop');
  assert.throws(()=>resolveStopLink(query,directory,Date.parse('2026-09-01')),/current directory/);
});

const scripts=await Promise.all(['stop.js','transit-page.js','stop-page.js'].map(file=>readFile(new URL('../src/'+file,import.meta.url),'utf8')));
function pageHarness(search=east,{directory=stopDirectory,fail=false}={}) {
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
      if(fail)throw new Error('Offline');
      return {buses:[{vehicleId:'123',reportedAt:now,stopsAway:3,nextStopName:'Spruce & 52nd',
        route:[{id:'previous',name:'Spruce & 52nd'},{id:config.target,name:config.stopName}]}],departures:[],fetchedAt:now};
    }})}});
  for(const script of scripts)vm.runInContext(script,context);
  return {get,requests,timers,document,emit(name,event={}){for(const fn of [...listeners.get(name)||[]])fn(event);},
    advance(ms){at+=ms;for(const timer of timers.values())if(timer.ms===1000)timer.fn();}};
}
const settled=()=>new Promise(resolve=>setImmediate(resolve));

test('landing page mounts standard live cards for the URL stop and cleans up on navigation',async()=>{
  const p=pageHarness();
  assert.match(p.get('stop-cards').innerHTML,/Checking SEPTA/);
  await settled();
  assert.equal(p.requests.length,1);assert.equal(p.requests[0].config.target,'22120');
  assert.equal(p.get('stop-route-badge').textContent,'42');
  assert.match(p.get('stop-description').textContent,/Eastbound.*Stop #22120/);
  assert.match(p.get('stop-cards').innerHTML,/class="number">3</);
  assert.match(p.get('stop-cards').innerHTML,/Spruce &amp; 52nd/);
  assert.match(p.get('stop-route-badge').textContent,/42/);
  assert.match(p.get('stop-panels').innerHTML,/aria-labelledby="stop-title"/);
  const html=await readFile(new URL('../stop.html',import.meta.url),'utf8');
  const ids=[...html.concat(p.get('stop-panels').innerHTML).matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'The landing page and shared panel must have unique element IDs');
  assert.match(p.get('stop-route').innerHTML,/Spruce &amp; 52nd/);
  assert.equal(p.get('stop-error').hidden,true);
  p.get('stop-refresh').handlers.click();await settled();assert.equal(p.requests.length,2);
  p.advance(121000);assert.doesNotMatch(p.get('stop-cards').innerHTML,/class="number">3</);
  p.emit('pagehide');assert.equal(p.timers.size,0);assert.equal(p.requests[1].signal.aborted,true);
  p.emit('pageshow',{persisted:true});await settled();
  assert.equal(p.timers.size,2);assert.equal(p.requests.length,3);
  assert.equal(p.requests[2].config.target,'22120');
  p.emit('pagehide');
});

test('invalid links and missing directory show recovery without fetching arrivals',()=>{
  for(const [search,options] of [['',{}],['?route=42&stop=22120&direction=1',{}],[east,{directory:null}]]) {
    const p=pageHarness(search,options);
    assert.equal(p.requests.length,0);assert.equal(p.timers.size,0);
    assert.equal(p.get('stop-error').hidden,false);
    assert.ok(p.get('stop-error-message').textContent.length);
    assert.equal(p.get('stop-help').hidden,true);assert.equal(p.get('stop-route-badge').hidden,true);
  }
});

test('arrival service failure keeps the chosen stop visible with standard retry controls',async()=>{
  const p=pageHarness(west,{fail:true});await settled();
  assert.match(p.get('stop-description').textContent,/Westbound.*22151/);
  assert.match(p.get('stop-cards').innerHTML,/Can’t reach SEPTA/);
  assert.equal(p.get('stop-refresh').disabled,false);
  p.get('stop-refresh').handlers.click();await settled();assert.equal(p.requests.length,2);
  p.emit('pagehide');
});
