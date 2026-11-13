import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/seat-availability.js';
const {seatAvailabilityFlag}=globalThis.MagnusBus;
test('known seat statuses get readable flags and every unknown value uses the null flag',()=>{
 for(const [value,label] of [['FEW_SEATS_AVAILABLE','Few seats'],['MANY_SEATS_AVAILABLE','Many seats'],['EMPTY','Empty']]) {
  assert.ok(seatAvailabilityFlag(value).includes('Seat availability: '+label));
  assert.notEqual(seatAvailabilityFlag(value),seatAvailabilityFlag(null));
 }
 for(const value of [undefined,'NEW_STATUS','FULL','',0,{},'<img src=x onerror=alert(1)>','toString','__proto__']) {
  assert.equal(seatAvailabilityFlag(value),seatAvailabilityFlag(null));
 }
});
