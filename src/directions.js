(() => {
'use strict';
const DIRECTIONS = {
  east: {
    id: 'east', gtfs: '0', name: 'Eastbound', target: '22120',
    title: 'To school', stopName: 'Spruce St & 49th St', destination: 'Toward 2nd & Spruce',
    arrow: '→'
  },
  west: {
    id: 'west', gtfs: '1', name: 'Westbound', target: '22151',
    title: 'Back home', stopName: 'Spruce St & 42nd St', destination: 'Toward 61st & Pine / Wycombe',
    arrow: '←'
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
