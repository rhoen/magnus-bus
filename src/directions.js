(() => {
'use strict';
const DIRECTIONS = {
  east: {
    id: 'east', route: '42', kind: 'bus', gtfs: '0', name: 'Eastbound', target: '22120',
    title: 'To school', stopName: 'Spruce St & 49th St', destination: 'Toward 2nd & Spruce',
    arrow: '→'
  },
  west: {
    id: 'west', route: '42', kind: 'bus', gtfs: '1', name: 'Westbound', target: '22151',
    title: 'Back home', stopName: 'Spruce St & 42nd St', destination: 'Toward 61st & Pine / Wycombe',
    arrow: '←'
  }
};
const TRACKERS = {
  ...DIRECTIONS,
  t2City: { id:'t2City', route:'T2', kind:'trolley', gtfs:'0', name:'Eastbound', target:'20870',
    stopName:'Baltimore & 48th / Florence', officialStopName:'Baltimore Av & Florence Av',
    destination:'Toward 15th St / Center City', requiredStop:'31140', arrow:'→' },
  t2Home: { id:'t2Home', route:'T2', kind:'trolley', gtfs:'1', name:'Westbound', target:'20659',
    stopName:'15th St / City Hall', destination:'Toward 61st & Baltimore', arrow:'←' },
  t3Home: { id:'t3Home', route:'T3', kind:'trolley', gtfs:'1', name:'Westbound', target:'20659',
    stopName:'15th St / City Hall', destination:'Toward Yeadon / Darby', arrow:'←' },
  bus21Home: { id:'bus21Home', route:'21', kind:'bus', gtfs:'1', name:'Westbound', target:'14080',
    stopName:'Walnut St & 16th St', destination:'Toward 69th St Transit Center', arrow:'←' }
};
function defaultDirection(now = Date.now()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23'
  }).format(now));
  return hour < 12 ? 'east' : 'west';
}

Object.assign(globalThis.MagnusBus ??= {}, { DIRECTIONS, TRACKERS, defaultDirection });
})();
