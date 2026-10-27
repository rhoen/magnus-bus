import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import '../src/directions.js';
const { defaultDirection } = globalThis.MagnusBus;
const app = await readFile(new URL('../src/app.js',import.meta.url),'utf8');
test('Philadelphia default changes at noon, including daylight and standard time',()=>{
 for(const [iso,expected] of [
  ['2026-10-27T15:59:59Z','east'],['2026-10-27T16:00:00Z','west'],
  ['2026-12-01T16:59:59Z','east'],['2026-12-01T17:00:00Z','west'],
  ['2026-10-28T03:59:59Z','west'],['2026-10-28T04:00:00Z','east']
 ]) assert.equal(defaultDirection(Date.parse(iso)),expected,iso);
});
function browser() {
 let now=Date.parse('2026-10-27T15:59:00Z');
 const elements=new Map(), requests=[], intervals=[];
 const get=id=>{
  if(!elements.has(id)) elements.set(id,{textContent:'',innerHTML:'',disabled:false,handlers:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelector(){return get(id+'-span');},addEventListener(type,fn){this.handlers[type]=fn;}});
  return elements.get(id);
 };
 const context=vm.createContext({MagnusBus:{...globalThis.MagnusBus,defaultDirection:(value=now)=>defaultDirection(value),createDataClient:()=>({getTracking(direction){return new Promise(resolve=>requests.push({direction,resolve}));}})},Intl,Date:class extends Date{static now(){return now;}},AbortController,AbortSignal,
  document:{getElementById:get,addEventListener(){},hidden:false},window:{addEventListener(){}},
  setInterval(fn,ms){intervals.push({fn,ms});},
  fetch(url){return new Promise(resolve=>requests.push({url,resolve}));}
 });
 vm.runInContext(app,context);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {get,requests,flush,advance(iso){now=Date.parse(iso);intervals.find(i=>i.ms===1000).fn();},
  async reply(index,direction,buses=[]){requests[index].resolve({buses,fetchedAt:now,direction});await flush();}};
}
test('manual toggle changes stop immediately and ignores a slower opposite-direction request',async()=>{
 const b=browser();assert.equal(b.requests[0].direction,'east');
 b.get('direction-slider').value = b.get('direction-slider').value === '1' ? '0' : '1';
 b.get('direction-slider').handlers.input();
 assert.equal(b.get('stop-title').textContent,'Spruce St & 42nd St');
 assert.equal(b.requests[1].direction,'west');
 await b.reply(1,'west'); await b.reply(0,'east');
 assert.match(b.get('cards').innerHTML,/westbound/);
 assert.doesNotMatch(b.get('cards').innerHTML,/eastbound/);
 b.get('direction-slider').value = b.get('direction-slider').value === '1' ? '0' : '1';
 b.get('direction-slider').handlers.input();
 assert.equal(b.get('stop-title').textContent,'Spruce St & 49th St');
 assert.equal(b.requests[2].direction,'east');
});
test('automatic selection follows noon; manual override survives ticks and can be reset',async()=>{
 const b=browser();await b.reply(0,'east');
 b.advance('2026-10-27T16:00:00Z');
 assert.equal(b.get('stop-title').textContent,'Spruce St & 42nd St');
 await b.reply(1,'west');
 b.get('direction-slider').value = b.get('direction-slider').value === '1' ? '0' : '1';
 b.get('direction-slider').handlers.input();await b.reply(2,'east');
 b.advance('2026-10-27T17:00:00Z');
 assert.equal(b.get('stop-title').textContent,'Spruce St & 49th St');
 b.get('auto-direction').handlers.click();
 assert.equal(b.get('stop-title').textContent,'Spruce St & 42nd St');
});

test('home stretch follows all remaining stops of the closest fresh bus',async()=>{
 const b=browser();
 const route=[
  {id:'22114',name:'Spruce St & 56th St'},
  {id:'22115',name:'Spruce St & 55th St'},
  {id:'22116',name:'Spruce St & 54th St'},
  {id:'22117',name:'Spruce St & 53rd St'},
  {id:'671',name:'Spruce St & 52nd St'},
  {id:'22118',name:'Spruce St & 51st St'},
  {id:'22119',name:'Spruce St & 50th St'},
  {id:'22120',name:'Spruce St & 49th St'}
 ];
 await b.reply(0,'east',[
  {vehicleId:'100',reportedAt:Date.parse('2026-10-27T15:58:50Z'),stopsAway:7,nextStopName:route[0].name,route},
  {vehicleId:'200',reportedAt:Date.parse('2026-10-27T15:58:50Z'),stopsAway:9,nextStopName:'Spruce St & 58th St',route:[{id:'22112',name:'Spruce St & 58th St'},...route]}
 ]);
 const html=b.get('route-line').innerHTML;
 assert.equal((html.match(/class="station /g)||[]).length,route.length);
 let position=-1;
 for(const stop of route){const next=html.indexOf(stop.name.replaceAll('&','&amp;'));assert.ok(next>position);position=next;}
 assert.doesNotMatch(html,/58th/);
 assert.match(html,/BUS NEXT STOP/);assert.match(html,/YOUR STOP/);
 assert.equal(b.get('route-caption').textContent,'Bus 100 · Eastbound');
 b.get('direction-east').handlers.click();
 b.advance('2026-10-27T15:59:55Z');
 assert.equal(b.get('route-line').innerHTML,html);
 b.advance('2026-10-27T16:01:00Z');
 assert.doesNotMatch(b.get('route-line').innerHTML,/56th/);
 assert.match(b.get('route-line').innerHTML,/fresh bus location/);
});
