import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { defaultDirection } from '../src/directions.js';
import { page } from '../src/page.js';
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
 const context=vm.createContext({Intl,Date:class extends Date{static now(){return now;}},AbortController,AbortSignal,
  document:{getElementById:get,addEventListener(){},hidden:false},window:{addEventListener(){}},
  setInterval(fn,ms){intervals.push({fn,ms});},
  fetch(url){return new Promise(resolve=>requests.push({url,resolve}));}
 });
 vm.runInContext(page.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {get,requests,flush,advance(iso){now=Date.parse(iso);intervals.find(i=>i.ms===1000).fn();},
  async reply(index,direction){requests[index].resolve({ok:true,json:async()=>({buses:[],fetchedAt:now,direction})});await flush();}};
}
test('manual toggle changes stop immediately and ignores a slower opposite-direction request',async()=>{
 const b=browser();assert.match(b.requests[0].url,/direction=east/);
 b.get('direction-slider').value = b.get('direction-slider').value === '1' ? '0' : '1';
 b.get('direction-slider').handlers.input();
 assert.equal(b.get('stop-title').textContent,'Spruce St & 42nd St');
 assert.match(b.requests[1].url,/direction=west/);
 await b.reply(1,'west'); await b.reply(0,'east');
 assert.match(b.get('cards').innerHTML,/westbound/);
 assert.doesNotMatch(b.get('cards').innerHTML,/eastbound/);
 b.get('direction-slider').value = b.get('direction-slider').value === '1' ? '0' : '1';
 b.get('direction-slider').handlers.input();
 assert.equal(b.get('stop-title').textContent,'Spruce St & 49th St');
 assert.match(b.requests[2].url,/direction=east/);
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
