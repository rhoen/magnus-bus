(() => {
'use strict';
const DIRECTIONS = {
  east: {
    id: 'east', gtfs: '0', name: 'Eastbound', target: '22120',
    title: 'To school', stopName: 'Spruce St & 49th St', destination: 'Toward 2nd & Spruce',
    arrow: '→',
    homeStops: [['22116','54th'],['22117','53rd'],['671','52nd'],['22118','51st'],['22119','50th'],['22120','49th']]
  },
  west: {
    id: 'west', gtfs: '1', name: 'Westbound', target: '22151',
    title: 'Back home', stopName: 'Spruce St & 42nd St', destination: 'Toward 61st & Pine / Wycombe',
    arrow: '←',
    homeStops: [['22143','39th'],['674','40th'],['22147','41st'],['22151','42nd']]
  }
};
function defaultDirection(now = Date.now()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23'
  }).format(now));
  return hour < 12 ? 'east' : 'west';
}

Object.assign(globalThis.MagnusBus ??= {}, { DIRECTIONS, defaultDirection });
})();
