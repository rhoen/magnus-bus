(() => {
'use strict';
const {serviceDate}=globalThis.MagnusBus;

function resolveStopLink(search,directory,now=Date.now()) {
  const params=new URLSearchParams(search);
  if(['route','stop','direction'].some(key=>params.getAll(key).length!==1 || !params.get(key))) {
    throw new Error('This link is incomplete or ambiguous. Scan the sticker again, or find your stop using Nearby stops.');
  }
  const routeId=params.get('route'),target=params.get('stop'),gtfs=params.get('direction');
  if(!['0','1'].includes(gtfs)) {
    throw new Error('This link has an invalid travel direction. Scan the sticker again, or find your stop using Nearby stops.');
  }
  if(!directory?.routes?.length || !directory?.stops?.length) {
    throw new Error('The stop directory couldn’t load. Reload this page to try again.');
  }
  const route=directory.routes.find(route=>route.id===routeId);
  if(!route)throw new Error('This route is not in our stop directory. Try Nearby stops to find a supported bus or trolley.');
  const release=Object.keys(route.releases).filter(date=>date<=serviceDate(now)).sort().at(-1);
  const direction=route.directions[gtfs];
  const stop=route.releases[release]?.[gtfs]?.map(index=>directory.stops[index]).find(stop=>stop?.[0]===target);
  if(!direction || !stop) {
    throw new Error('This stop is not listed for this route and direction in our current directory. The sticker may be out of date. Try Nearby stops to find your boarding stop.');
  }
  return {route:route.id,kind:route.kind,gtfs,target,stopName:stop[1],name:direction.name,
    destination:'Toward '+direction.destination,exactTrips:true};
}

Object.assign(globalThis.MagnusBus,{resolveStopLink});
})();
