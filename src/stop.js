(() => {
'use strict';
const {serviceDate}=globalThis.MagnusBus;

// A boarding stop can be shared by routes and even by both directions of a route.
// Keep each service, but give the physical stop a single identity.
function buildStopCatalog(directory,now=Date.now()) {
  if(!directory?.routes?.length || !directory?.stops?.length) {
    throw new Error('The stop directory couldn’t load. Reload this page to try again.');
  }
  const catalog=new Map(),date=serviceDate(now);
  for(const route of [...directory.routes].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))) {
    const release=Object.keys(route.releases).filter(value=>value<=date).sort().at(-1);
    for(const gtfs of ['0','1']) {
      const direction=route.directions[gtfs],seen=new Set();
      if(!direction)continue;
      for(const index of route.releases[release]?.[gtfs]||[]) {
        const stop=directory.stops[index];
        if(!stop || seen.has(stop[0]))continue;
        seen.add(stop[0]);
        if(!catalog.has(stop[0]))catalog.set(stop[0],{target:stop[0],stopName:stop[1],latitude:stop[2],longitude:stop[3],services:[]});
        catalog.get(stop[0]).services.push({route:route.id,kind:route.kind,gtfs,target:stop[0],stopName:stop[1],
          name:direction.name,destination:'Toward '+direction.destination,exactTrips:true});
      }
    }
  }
  return catalog;
}

function resolveStopLink(search,directory,now=Date.now()) {
  const params=new URLSearchParams(search);
  if(params.getAll('stop').length!==1 || !params.get('stop')) {
    throw new Error('This link is incomplete or ambiguous. Scan the sticker again, or find your stop using Nearby stops.');
  }
  // Older stickers may include route and direction. They now open the same
  // all-routes page as a stop-only link; those legacy fields do not filter it.
  const stop=buildStopCatalog(directory,now).get(params.get('stop'));
  if(!stop)throw new Error('This stop is not served in our current directory. The sticker may be out of date. Try Nearby stops to find your boarding stop.');
  return stop;
}

Object.assign(globalThis.MagnusBus,{buildStopCatalog,resolveStopLink});
})();
