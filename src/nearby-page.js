(() => {
'use strict';
const {nearbyRoutes,mountTransitPanels,createDataClient}=globalThis.MagnusBus;
const $=id=>document.getElementById(id);
const client=createDataClient();
let result=null,position=null,selection=null,panel=null,generation=0,expanded=false;
const distance=value=>value<160?Math.max(10,Math.round(value*3.28084/10)*10)+' ft':(value/1609.344).toFixed(1)+' mi';
function clearPanel(){panel?.destroy();panel=null;}
function showList(focus=false){
  clearPanel();selection=null;
  $('nearby-detail').hidden=true;$('nearby-discovery').hidden=false;
  if(focus)$('nearby-heading').focus();
}
function renderRoutes(){
  const list=$('nearby-routes');list.replaceChildren();
  const routes=expanded?result.allRoutes:result.routes;
  for(const route of routes){
    const button=document.createElement('button');button.type='button';button.className='nearby-route';
    const badge=document.createElement('span');badge.className='route-badge';badge.textContent=route.route;
    const info=document.createElement('span');info.className='nearby-route-info';
    const title=document.createElement('strong');title.textContent=(route.kind==='trolley'?'Trolley ':'Bus ')+route.route;
    info.append(title);
    const stopNames=new Set();
    for(const direction of route.directions){
      const name=direction.stopName.trim(),key=name.toLowerCase().replace(/\s+/g,' ');
      if(stopNames.has(key))continue;
      stopNames.add(key);
      const stop=document.createElement('span');stop.textContent=name;info.append(stop);
    }
    const away=document.createElement('span');away.className='nearby-distance';away.textContent=distance(route.distance)+' →';
    button.append(badge,info,away);button.addEventListener('click',()=>selectRoute(route));list.append(button);
  }
  $('nearby-more').hidden=expanded||result.allRoutes.length===result.routes.length;
  $('nearby-status').textContent=routes.length?'':'No SEPTA bus or trolley stops found within ½ mile. Try again when you’re closer to a stop.';
}
function selectDirection(config){
  clearPanel();
  for(const button of $('nearby-directions').children)button.setAttribute('aria-pressed',String(button.dataset.direction===config.gtfs));
  $('nearby-route-badge').textContent=config.route;
  $('nearby-title').textContent=config.stopName;
  $('nearby-destination').textContent=config.destination+' · #'+config.target+' · '+distance(config.distance)+' away';
  panel=mountTransitPanels($('nearby-panels'),{nearby:config},{client,dynamic:true,showHeading:false});
}
function selectRoute(route){
  selection=route;$('nearby-discovery').hidden=true;$('nearby-detail').hidden=false;
  const directions=$('nearby-directions');directions.replaceChildren();
  for(const config of route.directions){
    const button=document.createElement('button');button.type='button';button.dataset.direction=config.gtfs;
    button.textContent=config.destination;button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>selectDirection(config));directions.append(button);
  }
  selectDirection(route.directions[0]);$('nearby-title').focus();
}
function locationFailure(error){
  const messages={1:'Location access was denied. Allow location for this site in your browser settings, then try again.',2:'Your location is unavailable. Check that location services are on, then try again.',3:'Finding your location took too long. Move somewhere with a clearer signal, then try again.'};
  $('nearby-status').textContent=messages[error.code]||'We couldn’t find your location. Please try again.';
}
function locate(){
  const request=++generation;showList();result=null;position=null;expanded=false;
  $('nearby-routes').replaceChildren();$('nearby-more').hidden=true;$('nearby-location').textContent='';$('nearby-location').hidden=true;
  if(!globalThis.isSecureContext){$('nearby-status').textContent='Location needs a secure connection. Open this site over HTTPS (or localhost for a local preview).';return;}
  if(!navigator.geolocation){$('nearby-status').textContent='This browser doesn’t support location. Open this page in a browser with location services.';return;}
  if(!globalThis.MagnusBus.stopDirectory){$('nearby-status').textContent='The stop directory couldn’t load. Reload this page and try again.';return;}
  $('nearby-locate').disabled=true;$('nearby-locate').textContent='Finding you…';
  $('nearby-status').textContent='';
  navigator.geolocation.getCurrentPosition(value=>{
    if(request!==generation)return;
    $('nearby-locate').disabled=false;$('nearby-locate').textContent='Update my location';
    position={latitude:value.coords.latitude,longitude:value.coords.longitude};
    try{
      result=nearbyRoutes(globalThis.MagnusBus.stopDirectory,position);
      if(value.coords.accuracy>150){
        $('nearby-location').textContent='Location accuracy is low; check your stop or try again outdoors.';
        $('nearby-location').hidden=false;
      }
      renderRoutes();
    }catch{$('nearby-status').textContent='The stop directory is unavailable. Reload this page and try again.';}
  },error=>{
    if(request!==generation)return;
    $('nearby-locate').disabled=false;$('nearby-locate').textContent='Try location again';locationFailure(error);
  },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
}
$('nearby-locate').addEventListener('click',locate);
$('nearby-back').addEventListener('click',()=>showList(true));
$('nearby-more').addEventListener('click',()=>{expanded=true;renderRoutes();});
window.addEventListener('pagehide',()=>{generation++;clearPanel();position=null;});
window.addEventListener('pageshow',event=>{
  if(event.persisted){$('nearby-locate').disabled=false;$('nearby-locate').textContent='Update my location';if(selection)selectRoute(selection);}
});
})();
