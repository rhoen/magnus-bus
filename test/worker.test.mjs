import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const stops=JSON.parse(await readFile(new URL('./fixtures/stops.json',import.meta.url)));
test('upstream failures return a retryable 503 without invented data',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('network unavailable');};
 try {
  const {default:worker}=await import('../src/worker.js?failure');
  const r=await worker.fetch(new Request('http://localhost/api/buses'));
  assert.equal(r.status,503);
  assert.match((await r.json()).error,/temporarily unavailable/);
 } finally { globalThis.fetch=original; }
});
test('real response format passes through the Worker API with no-store headers',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>Response.json(String(url).includes('/stops/')?stops:{bus:[{route_id:'42',Direction:'Eastbound',VehicleID:'100',timestamp:Math.floor(Date.now()/1000),next_stop_id:'22119',next_stop_sequence:13}]});
 try {
  const {default:worker}=await import('../src/worker.js?success');
  const r=await worker.fetch(new Request('http://localhost/api/buses'));
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  const data=await r.json();assert.equal(data.buses[0].stopsAway,1);
  assert.equal((await worker.fetch(new Request('http://localhost/not-a-route'))).status,404);
  assert.equal((await worker.fetch(new Request('http://localhost/api/buses',{method:'POST'}))).status,405);
 } finally { globalThis.fetch=original; }
});
