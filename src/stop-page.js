(() => {
'use strict';
const {resolveStopLink,mountTransitPanels,createDataClient}=globalThis.MagnusBus;
const $=id=>document.getElementById(id);
const client=createDataClient();
let panel=null;

function start() {
  panel?.destroy();panel=null;
  $('stop-error').hidden=true;
  let config;
  try {
    config=resolveStopLink(window.location.search,globalThis.MagnusBus.stopDirectory);
  } catch(error) {
    $('stop-title').textContent='We couldn’t find this stop';
    $('stop-description').textContent='Check your sticker link or find a nearby stop.';
    $('stop-error-message').textContent=error.message;
    $('stop-error').hidden=false;
    $('stop-help').hidden=true;
    document.title='Magnus’s Bus · Stop unavailable';
    return;
  }
  const routes=[...new Set(config.services.map(service=>service.route))];
  $('stop-title').textContent=config.stopName;
  $('stop-description').textContent='Stop #'+config.target+' · Routes '+routes.join(', ');
  $('stop-help').hidden=false;
  document.title='Magnus’s Bus · Stop '+config.target+' · '+config.stopName;
  const trackers=Object.fromEntries(config.services.map((service,index)=>['stop-service-'+index,
    {...service,allArrivals:true,headingTitle:service.name,arrow:''}]));
  panel=mountTransitPanels($('stop-panels'),trackers,{client,dynamic:true});
}

window.addEventListener('pagehide',()=>{panel?.destroy();panel=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)start();});
start();
})();
