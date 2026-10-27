import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { trackBuses, orderedStops } from '../src/tracking.js';
const stops=JSON.parse(await readFile(new URL('./fixtures/stops.json',import.meta.url)));
const now=Date.parse('2026-10-27T15:00:00Z');
const bus=(overrides={})=>({route_id:'42',Direction:'Eastbound',VehicleID:'100',trip:'1',timestamp:now/1000-10,next_stop_id:'22119',next_stop_sequence:13,lat:'39.9541',lng:'-75.2222',...overrides});
const track=(buses)=>trackBuses({bus:buses},stops,now);
test('50th is one stop from 49th; 49th means your stop is next',()=>{
 assert.equal(track([bus()]).buses[0].stopsAway,1);
 assert.equal(track([bus({next_stop_id:'22120'})]).buses[0].stopsAway,0);
});
test('excludes westbound buses and buses that have passed the target',()=>{
 assert.equal(track([bus({Direction:'Westbound'}),bus({next_stop_id:'22121'})]).buses.length,0);
});
test('excludes stale, missing and future timestamps',()=>{
 for(const timestamp of [now/1000-121,undefined,0,now/1000+60]) assert.equal(track([bus({timestamp})]).buses.length,0);
});
test('counts the Wycombe branch without the two Pine loop stops',()=>{
 assert.equal(track([bus({next_stop_id:'26125',next_stop_sequence:1})]).buses[0].stopsAway,27);
 assert.equal(track([bus({next_stop_id:'22110'})]).buses[0].stopsAway,12);
});
test('counts the short branch independently',()=>{
 assert.equal(track([bus({next_stop_id:'437'})]).buses[0].stopsAway,13);
 assert.equal(track([bus({next_stop_id:'26108'})]).buses[0].stopsAway,12);
});
test('returns two closest physical buses, selecting newest duplicate',()=>{
 const result=track([bus({VehicleID:'2',next_stop_id:'671'}),bus({VehicleID:'3',next_stop_id:'22116'}),bus({next_stop_id:'22117',timestamp:now/1000-20}),bus()]);
 assert.deepEqual(result.buses.map(b=>b.vehicleId),['100','2']);
 assert.deepEqual(result.buses.map(b=>b.stopsAway),[1,3]);
});
test('does not count a future eastbound assignment while bus is still westbound',()=>{
 assert.equal(track([bus({next_stop_id:'26125',next_stop_sequence:1}),bus({Direction:'Westbound'})]).buses.length,0);
});
test('selects current release and deduplicates stop IDs',()=>{
 const result=orderedStops([...stops,...stops],now);
 assert.equal(result.release,'20260927');
 assert.equal(result.stops.length,new Set(result.stops.map(s=>s.stop_id)).size);
 assert.equal(orderedStops(stops,Date.parse('2026-11-02T15:00:00Z')).release,'20261101');
});
test('unknown stops are not assigned invented counts',()=>{
 const result=track([bus({next_stop_id:'bogus'})]);
 assert.equal(result.unknown,1);assert.equal(result.buses.length,0);
});
test('malformed upstream data fails rather than reporting no buses',()=>{
 assert.throws(()=>trackBuses({},stops,now));
 assert.throws(()=>trackBuses({bus:[]},{},now));
 assert.throws(()=>trackBuses({bus:[]},[],now));
});
