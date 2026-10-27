import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/data.js';
const { createDataClient, STOPS_URL, VEHICLES_URL } = globalThis.MagnusBus;
const stops = JSON.parse(await readFile(new URL('./fixtures/stops.json', import.meta.url)));
const start = Date.parse('2026-10-27T15:00:00Z');
const feed = at => [
  {route_id:'42',direction_name:'Eastbound',vehicle_id:'100',timestamp:at/1000,next_stop_id:'22119',next_stop_sequence:13},
  {route_id:'42',direction_name:'Westbound',vehicle_id:'200',timestamp:at/1000,next_stop_id:'22147',next_stop_sequence:39}
];
test('fetches SEPTA directly and calculates both directions entirely in the client', async () => {
  const calls=[];
  const client=createDataClient({now:()=>start,fetchImpl:async(url,options)=>{
    calls.push({url,options});return Response.json(url===STOPS_URL?stops:feed(start));
  }});
  const east=await client.getTracking('east'),west=await client.getTracking('west');
  assert.equal(east.buses[0].vehicleId,'100');assert.equal(east.stopId,'22120');
  assert.equal(west.buses[0].vehicleId,'200');assert.equal(west.stopId,'22151');
  assert.equal(calls.filter(c=>c.url===STOPS_URL).length,1);
  assert.equal(calls.filter(c=>c.url===VEHICLES_URL).length,2);
  for(const call of calls){assert.match(call.url,/^https:\/\/www3\.septa\.org\/api\/v2\//);assert.equal(call.options.credentials,'omit');assert.equal(call.options.mode,'cors');}
});
test('refreshes the stop cache hourly and at the next Philadelphia date', async () => {
  let now=start, stopCalls=0;
  const client=createDataClient({now:()=>now,fetchImpl:async url=>{if(url===STOPS_URL)stopCalls++;return Response.json(url===STOPS_URL?stops:feed(now));}});
  await client.getTracking('east');now+=3600001;await client.getTracking('east');assert.equal(stopCalls,2);
  now=Date.parse('2026-10-28T03:59:59Z');await client.getTracking('east');assert.equal(stopCalls,3);
  now+=2000;await client.getTracking('east');assert.equal(stopCalls,4);
});
test('network errors and invalid feeds reject instead of inventing bus data', async () => {
  const broken=createDataClient({fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
  await assert.rejects(()=>broken.getTracking('east'),/Failed to fetch/);
  for(const value of [{bus:[]},null,{}]){
    const client=createDataClient({now:()=>start,fetchImpl:async url=>Response.json(url===STOPS_URL?stops:value)});
    await assert.rejects(()=>client.getTracking('east'),/Invalid vehicle/);
  }
  const unavailable=createDataClient({fetchImpl:async()=>new Response('Unavailable',{status:503})});
  await assert.rejects(()=>unavailable.getTracking('west'),/SEPTA unavailable/);
});
test('an aborted refresh cannot return bus data', async () => {
  const controller=new AbortController();
  const client=createDataClient({now:()=>start,fetchImpl:async url=>{controller.abort(new Error('Direction changed'));return Response.json(url===STOPS_URL?stops:feed(start));}});
  await assert.rejects(()=>client.getTracking('east',{signal:controller.signal}),/Direction changed/);
});
