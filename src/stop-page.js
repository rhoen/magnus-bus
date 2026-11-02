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
    $('stop-route-badge').hidden=true;
    $('stop-title').textContent='We couldn’t find this stop';
    $('stop-description').textContent='Check your sticker link or find a nearby stop.';
    $('stop-error-message').textContent=error.message;
    $('stop-error').hidden=false;
    $('stop-help').hidden=true;
    document.title='Magnus’s Bus · Stop unavailable';
    return;
  }
  $('stop-route-badge').hidden=false;
  $('stop-route-badge').textContent=config.route;
  $('stop-route-badge').setAttribute('aria-label','Route '+config.route);
  $('stop-title').textContent=config.stopName;
  $('stop-description').textContent=config.name+' · '+config.destination+' · Stop #'+config.target;
  $('stop-help').hidden=false;
  document.title='Magnus’s Bus · '+config.route+' · '+config.stopName;
  panel=mountTransitPanels($('stop-panels'),{stop:config},{client,dynamic:true,showHeading:false});
}

window.addEventListener('pagehide',()=>{panel?.destroy();panel=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)start();});
start();
})();
