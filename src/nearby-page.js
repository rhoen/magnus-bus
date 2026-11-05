(() => {
'use strict';
const {nearbyRoutes,mountTransitPanels,createDataClient}=globalThis.MagnusBus;
const $=id=>document.getElementById(id);
const client=createDataClient();
const manualLocation=$('nearby-discovery').dataset.locationMode==='manual';
function showLocationPrompt(){
  $('nearby-locate').hidden=false;$('nearby-locate').disabled=false;$('nearby-locate').textContent='Find my location';
  $('nearby-status').textContent='Tap “Find my location” to find nearby buses and trolleys.';
}
let result=null,position=null,selection=null,panel=null,generation=0,expanded=false;
let recoveryTimer=null;
function clearRecovery(){clearTimeout(recoveryTimer);recoveryTimer=null;}
function locationContext(){
  let policy='not exposed by this browser';
  try{
    const api=document.permissionsPolicy||document.featurePolicy;
    if(api?.allowsFeature)policy=api.allowsFeature('geolocation')?'allowed':'blocked';
  }catch{}
  return {
    visibility:document.visibilityState,
    focused:document.hasFocus?.()??'not exposed by this browser',
    active:navigator.userActivation?.isActive??'not exposed by this browser',
    embedded:window.self!==window.top,
    standalone:Boolean(navigator.standalone||window.matchMedia?.('(display-mode: standalone)')?.matches),
    policy
  };
}
function showLocationDetails(request,source,started,context,error){
  const details=$('nearby-location-details'),output=$('nearby-location-debug');
  const lines=[
    'Location check: 2026-11-05-permissions',
    'Request: '+source,
    'Result: '+(error.name||'Geolocation error')+' / '+(error.code??'no code'),
    'Browser message: '+(error.message||'No message supplied'),
    'Elapsed: '+(Date.now()-started)+' ms',
    'Origin: '+window.location.origin,
    'Secure context: '+globalThis.isSecureContext,
    'Page: '+window.location.pathname,
    'Location mode: '+(manualLocation?'button only':'automatic'),
    'Visibility at request: '+context.visibility,
    'Focused at request: '+context.focused,
    'User activation at request: '+context.active,
    'Page visibility at response: '+document.visibilityState,
    'Embedded page: '+context.embedded,
    'Home screen: '+context.standalone,
    'Geolocation policy: '+context.policy,
    'Browser: '+navigator.userAgent
  ];
  details.hidden=false;output.textContent=lines.join('\n');
  // Query only after the request. Some Safari versions report a misleading state.
  // Diagnostic failures must never interfere with location requests or retry help.
  const report=state=>{
    if(request===generation&&!details.hidden)output.textContent=lines.concat('Reported permission (diagnostic only): '+state).join('\n');
  };
  report('not available');
  try{
    if(navigator.permissions?.query)navigator.permissions.query({name:'geolocation'}).then(permission=>report(permission.state)).catch(()=>report('query failed'));
  }catch{report('query failed');}
}
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
function locationFailure(error,context){
  const messages={1:'Location access was denied by the browser. This does not mean you tapped Deny: website or browser permissions can block it without a prompt. Check this website’s Location permission in your browser, then tap “Try location again”. Phone location settings alone may not be enough. See Location details below.',2:'Your location is unavailable. Check that location services are on, then try again.',3:'Finding your location took too long. Move somewhere with a clearer signal, then try again.'};
  let message=messages[error.code]||'We couldn’t find your location. Please try again.';
  if(error.code===1&&context.policy==='blocked')message='Location is blocked by this page’s permissions policy. If you opened an embedded preview, open the site directly in your browser. Retrying cannot override the policy.';
  else if(error.code===1&&context.embedded)message+=' This page is embedded; try opening the site directly in your browser.';
  $('nearby-status').textContent=message;
}
function locate(source='automatic'){
  clearRecovery();
  const request=++generation;showList();result=null;position=null;expanded=false;
  $('nearby-location-details').hidden=true;$('nearby-location-debug').textContent='';
  $('nearby-locate').hidden=!manualLocation;
  $('nearby-routes').replaceChildren();$('nearby-more').hidden=true;$('nearby-location').textContent='';$('nearby-location').hidden=true;
  if(!globalThis.isSecureContext){$('nearby-status').textContent='Location needs a secure connection. Open this site over HTTPS (or localhost for a local preview).';return;}
  if(!navigator.geolocation){$('nearby-status').textContent='This browser doesn’t support location. Open this page in a browser with location services.';return;}
  if(!globalThis.MagnusBus.stopDirectory){$('nearby-status').textContent='The stop directory couldn’t load. Reload this page and try again.';return;}
  $('nearby-locate').disabled=true;$('nearby-locate').textContent='Finding you…';
  $('nearby-status').textContent='Finding nearby routes…';
  const started=Date.now(),context=locationContext();
  // The API timeout excludes permission-prompt waiting. Keep a direct retry available.
  recoveryTimer=setTimeout(()=>{
    if(request!==generation)return;
    $('nearby-locate').hidden=false;$('nearby-locate').disabled=false;$('nearby-locate').textContent='Try location again';
    $('nearby-status').textContent='Still waiting for the browser’s location response. If no prompt appeared, tap “Try location again”.';
    showLocationDetails(request,source,started,context,{name:'Pending request',message:'getCurrentPosition has not called either callback.'});
  },20000);
  const failed=error=>{
    if(request!==generation)return;
    clearRecovery();
    $('nearby-locate').hidden=false;$('nearby-locate').disabled=false;$('nearby-locate').textContent='Try location again';locationFailure(error,context);
    showLocationDetails(request,source,started,context,error);
  };
  // Keep this in the click handler’s synchronous call stack; do not await permission queries.
  try{navigator.geolocation.getCurrentPosition(value=>{
    if(request!==generation)return;
    clearRecovery();$('nearby-location-details').hidden=true;
    $('nearby-locate').hidden=false;$('nearby-locate').disabled=false;$('nearby-locate').textContent='Update my location';
    position={latitude:value.coords.latitude,longitude:value.coords.longitude};
    try{
      result=nearbyRoutes(globalThis.MagnusBus.stopDirectory,position);
      if(value.coords.accuracy>150){
        $('nearby-location').textContent='Location accuracy is low; check your stop or try again outdoors.';
        $('nearby-location').hidden=false;
      }
      renderRoutes();
    }catch{$('nearby-status').textContent='The stop directory is unavailable. Reload this page and try again.';}
  },failed,{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  }catch(error){failed(error);}
}
$('nearby-locate').addEventListener('click',()=>locate('button tap'));
$('nearby-back').addEventListener('click',()=>showList(true));
$('nearby-more').addEventListener('click',()=>{expanded=true;renderRoutes();});
window.addEventListener('pagehide',()=>{generation++;clearRecovery();clearPanel();position=null;});
window.addEventListener('pageshow',event=>{
  if(event.persisted){
    if(selection)selectRoute(selection);
    else if(!manualLocation)locate();
    else if(!result)showLocationPrompt();
  }
});
// Safari can load a page before it becomes visible. Request once it is foregrounded.
if(manualLocation){
  showLocationPrompt();
}else if(document.visibilityState==='hidden'){
  const onVisible=()=>{
    if(document.visibilityState==='hidden')return;
    document.removeEventListener('visibilitychange',onVisible);
    if(generation===0)locate();
  };
  document.addEventListener('visibilitychange',onVisible);
}else locate();
})();
