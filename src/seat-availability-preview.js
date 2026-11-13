(() => {
'use strict';
const cases = ['FEW_SEATS_AVAILABLE','MANY_SEATS_AVAILABLE','EMPTY',null,'UNRECOGNIZED_VALUE'];
const configs = Object.fromEntries(cases.map((value,i) => ['sample'+i, {
  route:'42', kind:'bus', target:'22120', name:'Eastbound', headingTitle:value ?? 'null',
  destination:'Sample data · '+(i === 4 ? 'Unknown value fallback' : 'Seat availability'), stopName:'Spruce St & 49th St'
}]));
const client = {async getTracking(id) {
  const seatAvailability = cases[Number(id.replace('sample',''))], now = Date.now();
  return {buses:[0,1].map(i => ({vehicleId:String(100+i),seatAvailability,stopsAway:2+i,
    nextStopName:i ? 'Spruce St & 52nd St' : 'Spruce St & 51st St',reportedAt:now,route:[]})),
    departures:[],fetchedAt:now};
}};
globalThis.MagnusBus.mountTransitPanels(document.getElementById('seat-preview'),configs,{client,showJourney:false});
})();
