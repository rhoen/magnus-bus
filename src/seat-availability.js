(() => {
'use strict';
// Only render labels we know; never insert raw API values into card HTML.
function seatAvailabilityFlag(value) {
  let state = 'unknown', label = 'Seats unknown';
  if (value === 'FEW_SEATS_AVAILABLE') { state = 'few'; label = 'Few seats'; }
  else if (value === 'MANY_SEATS_AVAILABLE') { state = 'many'; label = 'Many seats'; }
  else if (value === 'EMPTY') { state = 'empty'; label = 'Empty'; }
  return '<span class="seat-flag seat-flag--'+state+'" aria-label="Seat availability: '+label+'">'+label+'</span>';
}
Object.assign(globalThis.MagnusBus ??= {}, {seatAvailabilityFlag});
})();
