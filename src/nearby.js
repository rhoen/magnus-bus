(() => {
'use strict';
const {serviceDate} = globalThis.MagnusBus;
const MAX_NEARBY_METERS = 800;
function distanceMeters(latitude,longitude,stopLatitude,stopLongitude) {
  const rad=Math.PI/180, deltaLat=(stopLatitude-latitude)*rad, deltaLon=(stopLongitude-longitude)*rad;
  const a=Math.sin(deltaLat/2)**2+Math.cos(latitude*rad)*Math.cos(stopLatitude*rad)*Math.sin(deltaLon/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));
}
function nearbyRoutes(directory,position,now=Date.now()) {
  const {latitude,longitude}=position;
  if (!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new Error('Invalid location');
  if (!directory?.routes?.length || !directory?.stops?.length) throw new Error('Stop directory unavailable');
  const date=serviceDate(now);
  const distances=directory.stops.map(s=>distanceMeters(latitude,longitude,s[2],s[3]));
  const candidates=[];
  for(const route of directory.routes){
    const release=Object.keys(route.releases).filter(r=>r<=date).sort().at(-1);
    if(!release)continue;
    const directions=[];
    for(const [gtfs,indices] of Object.entries(route.releases[release])){
      const nearest=indices.reduce((best,i)=>best===null||distances[i]<distances[best]?i:best,null);
      if(nearest===null || distances[nearest]>MAX_NEARBY_METERS)continue;
      const [target,stopName]=directory.stops[nearest],meta=route.directions[gtfs];
      if(!meta)continue;
      directions.push({route:route.id,kind:route.kind,gtfs,name:meta.name,destination:'Toward '+meta.destination,
        target,stopName,distance:distances[nearest],exactTrips:true,arrow:gtfs==='0'?'→':'←'});
    }
    directions.sort((a,b)=>a.distance-b.distance);
    if(directions.length)candidates.push({route:route.id,kind:route.kind,distance:directions[0].distance,directions});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.route.localeCompare(b.route,undefined,{numeric:true}));
  // Include every route at the closest stop, plus adjacent boarding poles.
  // Broader discovery is an explicit choice, so standing at one stop doesn't
  // produce a list of every route several blocks away.
  const closest=candidates[0]?.distance;
  return {nearest:closest??null,routes:candidates.filter(r=>r.distance<=closest+30),allRoutes:candidates};
}
Object.assign(globalThis.MagnusBus,{distanceMeters,nearbyRoutes,MAX_NEARBY_METERS});
})();
